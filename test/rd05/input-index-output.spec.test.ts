import { describe, expect, it } from "vitest";
import { cia2FunctionVariants } from "./cia2-output-fixture.js";
import {
  libraryEntry,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

/** A full word column reaches an ordinary borrowed-array leaf without a source narrowing cast. */
const SOURCE = `module Game;
place(at: $30FC) let rows: byte[8];
place(at: $3200) let input: word;
place(at: $3202) let result: byte;
export function row(data: const byte[8], column: word): byte {
  return data[column & 7];
}
export function observed(): void { }
export function main(): void {
  while (true) {
    let column: word = peekw($3200);
    result = row(rows, column);
    observed();
  }
}`;

/** Documented NMOS instruction widths and base cycles; indexed read penalties are separate. */
const NMOS = new Map<number, readonly [number, number]>();
/** Shared ALU addressing forms: opcode offset, encoded width, and documented base cycles. */
const ALU_MODES = [
  [1, 2, 6],
  [5, 2, 3],
  [9, 2, 2],
  [13, 3, 4],
  [17, 2, 5],
  [21, 2, 4],
  [25, 3, 4],
  [29, 3, 4],
];
for (const family of [0, 32, 64, 96, 128, 160, 192, 224]) {
  for (const [mode, width, cycles] of ALU_MODES) {
    if (family === 128 && mode === 9) continue;
    const storeCycles = mode === 17 ? 6 : mode === 25 || mode === 29 ? 5 : cycles;
    NMOS.set(family + mode!, [width!, family === 128 ? storeCycles! : cycles!]);
  }
}
for (const family of [0, 32, 64, 96, 192, 224]) {
  for (const [mode, width, cycles] of [
    [6, 2, 5],
    [14, 3, 6],
    [22, 2, 6],
    [30, 3, 7],
  ]) {
    NMOS.set(family + mode!, [width!, cycles!]);
  }
  if (family < 128) NMOS.set(family + 10, [1, 2]);
}
for (const encoded of [
  "a0:2:2 a4:2:3 ac:3:4 b4:2:4 bc:3:4",
  "a2:2:2 a6:2:3 ae:3:4 b6:2:4 be:3:4",
  "84:2:3 8c:3:4 94:2:4 86:2:3 8e:3:4 96:2:4",
  "c0:2:2 c4:2:3 cc:3:4 e0:2:2 e4:2:3 ec:3:4 24:2:3 2c:3:4",
  "08:1:3 18:1:2 28:1:4 38:1:2 48:1:3 58:1:2 68:1:4 78:1:2",
  "88:1:2 8a:1:2 98:1:2 9a:1:2 a8:1:2 aa:1:2 b8:1:2 ba:1:2",
  "c8:1:2 ca:1:2 d8:1:2 e8:1:2 ea:1:2 f8:1:2 60:1:6 4c:3:3",
  "10:2:2 30:2:2 50:2:2 70:2:2 90:2:2 b0:2:2 d0:2:2 f0:2:2",
]) {
  for (const item of encoded.split(" ")) {
    const [opcode, width, cycles] = item.split(":");
    NMOS.set(Number.parseInt(opcode!, 16), [Number(width), Number(cycles)]);
  }
}

/**
 * Count the complete leaf's worst nominal path, including RTS. Internal branches are allowed;
 * loops and out-of-range transfers cannot hide work outside this bounded cost witness.
 * Indexed reads use their non-crossing timing, matching the analytical nominal comparison.
 */
function nominalCycles(bytes: Uint8Array): number {
  const instructions = new Map<number, readonly [number, number]>();
  for (let offset = 0; offset < bytes.length; ) {
    const instruction = NMOS.get(bytes[offset]!);
    if (!instruction) throw new Error(`Unaccounted leaf opcode ${bytes[offset]} at ${offset}`);
    instructions.set(offset, instruction);
    offset += instruction[0];
  }
  const visit = (offset: number, ancestors: ReadonlySet<number>): number => {
    const instruction = instructions.get(offset);
    if (!instruction || ancestors.has(offset)) throw new Error("Leaf cost path is not bounded");
    const [width, cycles] = instruction;
    const opcode = bytes[offset]!;
    if (opcode === 0x60) return cycles;
    if (opcode === 0x4c) throw new Error("External transfer needs complete target accounting");
    const next = new Set([...ancestors, offset]);
    const following = offset + width;
    if ((opcode & 0x1f) === 0x10) {
      const displacement = bytes[offset + 1]!;
      const target = following + (displacement < 128 ? displacement : displacement - 256);
      return cycles + Math.max(visit(following, next), 1 + visit(target, next));
    }
    return cycles + visit(following, next);
  };
  return visit(0, new Set());
}

// Absolute column/base homes, one ZP pointer, Y=0 and a byte result in A cost 23 bytes/37 cycles.
// Each pair represents one instruction: load, mask, carry setup, low add/store, high add/store,
// Y setup, indirect read and RTS. The high add consumes the low-byte carry without staging zero.
const EXPERT_INSTRUCTIONS = [
  [3, 4],
  [2, 2],
  [1, 2],
  [3, 4],
  [2, 3],
  [3, 4],
  [2, 2],
  [2, 3],
  [2, 2],
  [2, 5],
  [1, 6],
];
const EXPERT_BYTES = EXPERT_INSTRUCTIONS.reduce((sum, instruction) => sum + instruction[0]!, 0);
const EXPERT_CYCLES = EXPERT_INSTRUCTIONS.reduce((sum, instruction) => sum + instruction[1]!, 0);

describe("masked borrowed byte lookup", () => {
  it.each(sourceLibraryProfiles)(
    "should return the addressed byte with page carry on %s",
    async (profile) => {
      await withLibraryBuild(SOURCE, "module Extra;", profile, async (artifacts, built) => {
        const variants = cia2FunctionVariants(artifacts, "row");
        expect(variants).toHaveLength(1);
        const variant = variants[0]!;
        expect(variant.bytes.at(-1)).toBe(0x60);
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          const values = [0x31, 0x42, 0x53, 0x64, 0x75, 0x86, 0x97, 0xa8];
          await monitor.writeMemory(0x30fc, Uint8Array.from(values));
          for (const column of [0, 7, 255, 256, 65535]) {
            await monitor.writeMemory(0x3200, Uint8Array.from([column & 255, column >>> 8]));
            await stopAt(variant.start);
            const entry = await monitor.readCpuRegisters();
            const traces = [await monitor.setAccessTracepoint(0x30fc, "load")];
            for (let index = 1; index < values.length; index += 1) {
              traces.push(await monitor.setAccessTracepoint(0x30fc + index, "load"));
            }
            await monitor.takeCheckpointHits();
            await stopAt(variant.end - 1);
            const exit = await monitor.readCpuRegisters();
            // Keep the leaf's exit registers, then let VICE report the final
            // instruction's access before the next source invocation begins.
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.observed"));
            const hits = (await monitor.takeCheckpointHits()).filter((id) => traces.includes(id));
            expect(hits).toEqual([traces[column & 7]]);
            expect(exit.a).toBe(values[column & 7]);
            expect(exit.x).toBe(entry.x);
            expect(exit.y).toBe(0);
            expect(exit.sp).toBe(entry.sp);
            expect(exit.p & 0x0c).toBe(entry.p & 0x0c);
            for (const trace of traces) await monitor.deleteCheckpoint(trace);
            expect(Array.from(await monitor.readMemory(0x3202, 0x3202))).toEqual([
              values[column & 7],
            ]);
            expect(Array.from(await monitor.readMemory(0x3200, 0x3201))).toEqual([
              column & 255,
              column >>> 8,
            ]);
          }
        });
      });
    },
    180_000,
  );

  it.each(sourceLibraryProfiles)(
    "should meet expert leaf cost without widened zero staging on %s",
    async (profile) => {
      await withLibraryBuild(SOURCE, "module Extra;", profile, async (artifacts) => {
        expect(EXPERT_BYTES).toBe(23);
        expect(EXPERT_CYCLES).toBe(37);
        const variants = cia2FunctionVariants(artifacts, "row");
        expect(variants).toHaveLength(1);
        for (const variant of variants) {
          expect(variant.bytes.length).toBeLessThanOrEqual(EXPERT_BYTES);
          expect(nominalCycles(variant.bytes)).toBeLessThanOrEqual(EXPERT_CYCLES);
        }
      });
    },
    180_000,
  );
});
