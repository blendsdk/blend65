import { describe, expect, it } from "vitest";
import { cia2FunctionVariants, cia2PrgBytes } from "./cia2-output-fixture.js";
import {
  libraryEntry,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

/** Ordinary byte operators retain the source order of both volatile control-register reads. */
const SOURCE = `module Game;
const CIA1_CRA: word = $DC0E;
const CIA1_CRB: word = $DC0F;
place(at: $3200) let result: byte;
export function predicate(): byte {
  if (((peek(CIA1_CRA) | peek(CIA1_CRB)) & 2) != 0) {
    return 1;
  }
  return 0;
}
export function observed(): void { }
export function main(): void {
  while (true) {
    result = predicate();
    observed();
  }
}`;

/** Independent NMOS widths/base cycles for byte ALU, staging and flag instructions. */
const NMOS = new Map<number, readonly [number, number]>();
// The ALU opcode families share these eight addressing-mode offsets.
for (const family of [0, 32, 64, 96, 128, 160, 192, 224]) {
  for (const [mode, width, cycles] of [
    [1, 2, 6],
    [5, 2, 3],
    [9, 2, 2],
    [13, 3, 4],
    [17, 2, 5],
    [21, 2, 4],
    [25, 3, 4],
    [29, 3, 4],
  ]) {
    if (family === 128 && mode === 9) continue;
    const storeCycles = mode === 17 ? 6 : mode === 25 || mode === 29 ? 5 : cycles;
    NMOS.set(family + mode!, [width!, family === 128 ? storeCycles! : cycles!]);
  }
}
for (const encoded of [
  "a0:2:2 a4:2:3 ac:3:4 b4:2:4 bc:3:4 a2:2:2 a6:2:3 ae:3:4 b6:2:4 be:3:4",
  "84:2:3 8c:3:4 94:2:4 86:2:3 8e:3:4 96:2:4",
  "c0:2:2 c4:2:3 cc:3:4 e0:2:2 e4:2:3 ec:3:4 24:2:3 2c:3:4",
  "08:1:3 18:1:2 28:1:4 38:1:2 48:1:3 58:1:2 68:1:4 78:1:2",
  "88:1:2 8a:1:2 98:1:2 9a:1:2 a8:1:2 aa:1:2 b8:1:2 ba:1:2",
  "c8:1:2 ca:1:2 d8:1:2 e8:1:2 ea:1:2 f8:1:2",
]) {
  for (const item of encoded.split(" ")) {
    const [opcode, width, cycles] = item.split(":");
    NMOS.set(Number.parseInt(opcode!, 16), [Number(width), Number(cycles)]);
  }
}

/**
 * Decode the actual PRG from function entry through its first equality branch, including all
 * nested producers and staging. No source-range slice may silently discard a producer's cost.
 * Base cycles exclude the declared branch/page-cross penalties; taking the branch adds one.
 */
function predicatePrefix(bytes: Uint8Array): {
  branchOffset: number;
  bytes: number;
  untakenCycles: number;
} {
  let offset = 0;
  let cycles = 0;
  while (offset < bytes.length) {
    const opcode = bytes[offset]!;
    if (opcode === 0xd0 || opcode === 0xf0) {
      return { branchOffset: offset, bytes: offset + 2, untakenCycles: cycles + 2 };
    }
    const instruction = NMOS.get(opcode);
    if (!instruction) throw new Error(`Unaccounted predicate opcode ${opcode} at ${offset}`);
    offset += instruction[0];
    cycles += instruction[1];
  }
  throw new Error("Predicate has no equality branch");
}

// LDA CRA; ORA CRB; AND #2; BEQ/BNE: the complete predicate costs 10 bytes, 12/13 cycles.
const EXPERT_INSTRUCTIONS = [
  [3, 4],
  [3, 4],
  [2, 2],
  [2, 2],
];
const EXPERT_BYTES = EXPERT_INSTRUCTIONS.reduce((sum, instruction) => sum + instruction[0]!, 0);
const EXPERT_UNTAKEN = EXPERT_INSTRUCTIONS.reduce((sum, instruction) => sum + instruction[1]!, 0);

describe("ordered CIA control predicate", () => {
  it.each(sourceLibraryProfiles)(
    "should read both controls once in order and preserve predicate state on %s",
    async (profile) => {
      await withLibraryBuild(SOURCE, "module Extra;", profile, async (artifacts, built) => {
        const variants = cia2FunctionVariants(artifacts, "predicate");
        expect(variants).toHaveLength(1);
        const variant = variants[0]!;
        const prefix = predicatePrefix(cia2PrgBytes(artifacts, variant.start, variant.end));
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          for (const [cra, crb, expected] of [
            [0, 0, 0],
            [2, 0, 1],
            [0, 2, 1],
            [2, 2, 1],
          ]) {
            await monitor.writeIo(0xdc0e, Uint8Array.from([cra!, crb!]));
            await stopAt(variant.start);
            const entry = await monitor.readCpuRegisters();
            const reads = [await monitor.setAccessTracepoint(0xdc0e, "load")];
            reads.push(await monitor.setAccessTracepoint(0xdc0f, "load"));
            const writes = [await monitor.setAccessTracepoint(0xdc0e, "store")];
            writes.push(await monitor.setAccessTracepoint(0xdc0f, "store"));
            const traces = [...reads, ...writes];
            await monitor.takeCheckpointHits();
            await stopAt(variant.start + prefix.branchOffset);
            const condition = await monitor.readCpuRegisters();
            expect(condition.p & 2).toBe(expected === 0 ? 2 : 0);
            expect(condition.p & 0x4d).toBe(entry.p & 0x4d);
            expect(condition.x).toBe(entry.x);
            expect(condition.y).toBe(entry.y);
            expect(condition.sp).toBe(entry.sp);
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.observed"));
            const hits = (await monitor.takeCheckpointHits()).filter((id) => traces.includes(id));
            expect(hits).toEqual(reads);
            expect(Array.from(await monitor.readMemory(0x3200, 0x3200))).toEqual([expected]);
            for (const trace of traces) await monitor.deleteCheckpoint(trace);
          }
        });
      });
    },
    180_000,
  );

  it.each(sourceLibraryProfiles)(
    "should meet expert cost for the complete predicate through its first branch on %s",
    async (profile) => {
      await withLibraryBuild(SOURCE, "module Extra;", profile, async (artifacts) => {
        expect(EXPERT_BYTES).toBe(10);
        expect(EXPERT_UNTAKEN).toBe(12);
        const variants = cia2FunctionVariants(artifacts, "predicate");
        expect(variants).toHaveLength(1);
        for (const variant of variants) {
          const prefix = predicatePrefix(cia2PrgBytes(artifacts, variant.start, variant.end));
          expect(prefix.bytes).toBeLessThanOrEqual(EXPERT_BYTES);
          expect(prefix.untakenCycles).toBeLessThanOrEqual(EXPERT_UNTAKEN);
          expect(prefix.untakenCycles + 1).toBeLessThanOrEqual(13);
        }
      });
    },
    180_000,
  );
});
