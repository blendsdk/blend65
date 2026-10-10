import { describe, expect, it } from "vitest";
import { cia2FunctionVariants, cia2PrgBytes } from "./cia2-output-fixture.js";
import {
  libraryEntry,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

/** Opposite zero/nonzero clobbers make stale flags and a lost saved accumulator observable. */
const SOURCE = `module Game;
const MARKER: word = $3200;
const NOISE: word = $3201;
const CIA1_CRA: word = $DC0E;
const CIA1_CRB: word = $DC0F;
place(at: $3200) let marker: byte;
place(at: $3201) let noise: byte;
place(at: $3202) let freshResult: byte;
place(at: $3203) let guardedResult: byte;
place(at: $3204) let used: byte;
place(at: $3205) let noiseSink: byte;
place(at: $3206) let blockSink: byte;
place(at: $3207) let first: byte;
place(at: $3208) let second: byte;
export function fresh(): byte {
  if (peek(MARKER) == 0) { return 1; }
  return 0;
}
function interfere(): void { noiseSink = peek(NOISE); }
function guarded(): byte {
  let value: byte = peek(MARKER);
  used = value;
  noiseSink = peek(NOISE);
  interfere();
  if (peek(NOISE) != 0) { blockSink = value; }
  if (value == 0) { return 1; }
  return 0;
}
function retained(): void {
  let saved: byte = peek(CIA1_CRA) | peek(CIA1_CRB);
  first = saved;
  interfere();
  second = saved;
}
export function observed(): void { }
export function main(): void {
  while (true) {
    freshResult = fresh();
    guardedResult = guarded();
    retained();
    observed();
  }
}`;

/** Documented byte-ALU addressing widths prevent operand bytes being mistaken for instructions. */
const WIDTHS = new Map<number, number>();
for (const family of [0, 32, 64, 96, 128, 160, 192, 224]) {
  for (const [mode, width] of [
    [1, 2],
    [5, 2],
    [9, 2],
    [13, 3],
    [17, 2],
    [21, 2],
    [25, 3],
    [29, 3],
  ]) {
    if (family !== 128 || mode !== 9) WIDTHS.set(family + mode!, width!);
  }
}
for (const [width, encoded] of [
  [1, "08 18 28 38 48 58 68 78 88 8a 98 9a a8 aa b8 ba c8 ca d8 e8 ea f8"],
  [2, "a0 a4 b4 a2 a6 b6 84 94 86 96 c0 c4 e0 e4 24"],
  [3, "ac bc ae be 8c 8e cc ec 2c"],
] as const) {
  for (const opcode of encoded.split(" ")) WIDTHS.set(Number.parseInt(opcode, 16), width);
}

/** Decode the complete adjacent load/test prefix through its equality branch from real PRG bytes. */
function freshInstructions(bytes: Uint8Array): readonly { opcode: number; operand: number }[] {
  const instructions = [];
  for (let offset = 0; offset < bytes.length; ) {
    const opcode = bytes[offset]!;
    if (opcode === 0xf0 || opcode === 0xd0) return instructions;
    const width = WIDTHS.get(opcode);
    if (!width) throw new Error(`Unaccounted fresh-test opcode ${opcode} at ${offset}`);
    instructions.push({ opcode, operand: bytes[offset + 1]! });
    offset += width;
  }
  throw new Error("Fresh marker test has no equality branch");
}

describe("byte value and flag retention", () => {
  it.each(sourceLibraryProfiles)(
    "should retain saved bytes across uses, reads, calls and blocks on %s",
    async (profile) => {
      await withLibraryBuild(SOURCE, "module Extra;", profile, async (artifacts, built) => {
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          for (const [marker, cra, crb] of [
            [0, 0, 0],
            [1, 2, 0],
            [128, 0, 2],
            [1, 2, 2],
          ]) {
            const noise = marker === 0 ? 128 : 0;
            const isZero = marker === 0 ? 1 : 0;
            const saved = cra! | crb!;
            await monitor.writeMemory(
              0x3200,
              Uint8Array.from([marker!, noise, ...Array.from({ length: 7 }, () => 0xcc)]),
            );
            await monitor.writeIo(0xdc0e, Uint8Array.from([cra!, crb!]));
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.fresh"));
            const reads = [await monitor.setAccessTracepoint(0x3200, "load")];
            for (const address of [0x3201, 0xdc0e, 0xdc0f]) {
              reads.push(await monitor.setAccessTracepoint(address, "load"));
            }
            const writes = [await monitor.setAccessTracepoint(0xdc0e, "store")];
            writes.push(await monitor.setAccessTracepoint(0xdc0f, "store"));
            const traces = [...reads, ...writes];
            await monitor.takeCheckpointHits();
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.observed"));
            const hits = (await monitor.takeCheckpointHits()).filter((id) => traces.includes(id));
            expect(hits).toEqual([
              reads[0],
              reads[0],
              reads[1],
              reads[1],
              reads[1],
              reads[2],
              reads[3],
              reads[1],
            ]);
            expect(Array.from(await monitor.readMemory(0x3200, 0x3208))).toEqual([
              marker,
              noise,
              isZero,
              isZero,
              marker,
              noise,
              noise === 0 ? 0xcc : marker,
              saved,
              saved,
            ]);
            expect(Array.from(await monitor.readIo(0xdc0e, 0xdc0f))).toEqual([cra, crb]);
            for (const trace of traces) await monitor.deleteCheckpoint(trace);
          }
        });
      });
    },
    180_000,
  );

  it.each(sourceLibraryProfiles)(
    "should use fresh marker zero flags without an exclusive-or-zero instruction on %s",
    async (profile) => {
      await withLibraryBuild(SOURCE, "module Extra;", profile, async (artifacts) => {
        const variants = cia2FunctionVariants(artifacts, "fresh");
        expect(variants).toHaveLength(1);
        for (const variant of variants) {
          const instructions = freshInstructions(
            cia2PrgBytes(artifacts, variant.start, variant.end),
          );
          expect(instructions.some(({ opcode, operand }) => opcode === 0x49 && operand === 0)).toBe(
            false,
          );
        }
      });
    },
    180_000,
  );
});
