import { describe, expect, it } from "vitest";
import {
  expectLibraryAccounting,
  libraryEntry,
  libraryStartup,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";
import type { LibraryArtifacts } from "./source-library-fixture.js";
import { cia2FunctionVariants } from "./cia2-output-fixture.js";

/** A complete private snapshot and two fixed observations define the caller's work. */
const SOURCE = `module Game;
struct Snapshot { rows: byte[8]; raw1: byte; raw2: byte; quality: byte; }
function sample(): Snapshot {
  return { rows: [$13, $27, $3B, $4F, $63, $77, $8B, $9F], raw1: $42, raw2: $68, quality: $AC };
}
function query(snapshot: const Snapshot, column: byte): byte {
  return snapshot.rows[column & 7];
}
function main(): void {
  let snapshot: Snapshot = sample();
  poke($3300, snapshot.quality);
  poke($3301, query(snapshot, 0));
}`;
/** Declaration order places quality at offset ten with no padding. */
const SNAPSHOT_BYTES = [0x13, 0x27, 0x3b, 0x4f, 0x63, 0x77, 0x8b, 0x9f, 0x42, 0x68, 0xac];

/** Official NMOS lengths and nominal cycles for straight-line caller instructions. */
const OPCODES = new Map<number, readonly [number, number]>();
for (const [length, cycles, opcodes] of [
  [1, 2, "18 38 aa a8 8a 98 ea"],
  [2, 2, "a9 a2 a0 29 69"],
  [2, 3, "a5 a6 a4 85 86 84 65"],
  [3, 4, "ad ae ac 8d 8e 8c 6d"],
  [2, 5, "b1"],
  [2, 6, "91"],
  [3, 6, "20"],
  [3, 3, "4c"],
] as const) {
  for (const opcode of opcodes.split(" ")) OPCODES.set(parseInt(opcode, 16), [length, cycles]);
}

/** Decode real instruction boundaries, rejecting any unaccounted caller operation. */
function decode(bytes: Uint8Array, start: number) {
  const instructions: { address: number; opcode: number; operand: number; cycles: number }[] = [];
  for (let offset = 0; offset < bytes.length; ) {
    const opcode = bytes[offset]!;
    const facts = OPCODES.get(opcode);
    if (!facts) throw new Error(`Unaccounted NMOS caller opcode ${opcode.toString(16)}`);
    const [length, cycles] = facts;
    expect(offset + length, "complete legal instruction").toBeLessThanOrEqual(bytes.length);
    instructions.push({
      address: start + offset,
      opcode,
      operand: (bytes[offset + 1] ?? 0) | ((length === 3 ? bytes[offset + 2]! : 0) << 8),
      cycles,
    });
    offset += length;
  }
  return instructions;
}

/** Select the real published main entry without guessing labels or backend homes. */
function mainVariant(artifacts: LibraryArtifacts) {
  const entry = libraryEntry(artifacts, "src/game.blend::Game.main");
  const variant = cia2FunctionVariants(artifacts, "main").find(({ start }) => start === entry);
  expect(variant, "main has a published actual-byte variant").toBeDefined();
  return variant!;
}

describe.sequential("fixed snapshot caller output", () => {
  for (const profile of sourceLibraryProfiles) {
    // Complete main includes both calls and its final restoration jump; callee work is separate.
    it(`should meet the complete two-call snapshot caller budget on ${profile}`, async () => {
      await withLibraryBuild(SOURCE, "module Extra;", profile, async (artifacts) => {
        expectLibraryAccounting(artifacts);
        const variants = cia2FunctionVariants(artifacts, "main");
        expect(variants.length).toBeGreaterThan(0);
        for (const variant of variants) {
          const code = decode(variant.bytes, variant.start);
          // Hidden destination 8B/10c; two JSRs 6B/12c; quality 6B/8c;
          // borrowed argument 10B/12c; column 5B/6c; result STA 3B/4c;
          // restoration JMP 3B/3c. Its target body is outside this caller.
          expect.soft(variant.bytes.length).toBeLessThanOrEqual(41);
          expect
            .soft(code.reduce((cycles, instruction) => cycles + instruction.cycles, 0))
            .toBeLessThanOrEqual(55);
          const calls = code.filter(({ opcode }) => opcode === 0x20);
          expect(calls.map(({ operand }) => operand)).toEqual([
            libraryEntry(artifacts, "src/game.blend::Game.sample"),
            libraryEntry(artifacts, "src/game.blend::Game.query"),
          ]);
          expect(code.at(-2)).toMatchObject({ opcode: 0x8d, operand: 0x3301 });
          expect(code.at(-1)).toMatchObject({
            opcode: 0x4c,
            operand: libraryStartup(artifacts, "startup.restore"),
          });
        }
      });
    }, 120_000);

    // Runtime observes the destination identity, actual parameter homes and A-result delivery.
    it(`should preserve the caller-owned snapshot and deliver the query byte directly on ${profile}`, async () => {
      await withLibraryBuild(SOURCE, "module Extra;", profile, async (artifacts, built) => {
        const variant = mainVariant(artifacts);
        const code = decode(variant.bytes, variant.start);
        const calls = code.filter(({ opcode }) => opcode === 0x20);
        expect(calls).toHaveLength(2);
        const [sample, query] = calls;
        const hidden = code.filter(
          ({ address, opcode }) => address < sample!.address && [0x85, 0x86, 0x84].includes(opcode),
        );
        expect(hidden, "hidden-result parameter uses the specified zero-page pair").toHaveLength(2);
        expect(hidden[1]!.operand).toBe(hidden[0]!.operand + 1);
        const argumentsToQuery = code.filter(
          ({ address, opcode, operand }) =>
            address > sample!.address &&
            address < query!.address &&
            [0x8d, 0x8e, 0x8c].includes(opcode) &&
            operand !== 0x3300,
        );
        expect(
          argumentsToQuery,
          "borrowed pointer and byte parameter use absolute homes",
        ).toHaveLength(3);
        expect(argumentsToQuery[1]!.operand).toBe(argumentsToQuery[0]!.operand + 1);
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          await stopAt(variant.start);
          const stack = (await monitor.readCpuRegisters()).sp;
          await monitor.writeMemory(0x3300, Uint8Array.of(0xcc, 0xcc));
          const qualityStore = await monitor.setAccessTracepoint(0x3300, "store");
          const queryStore = await monitor.setAccessTracepoint(0x3301, "store");
          await monitor.takeCheckpointHits();
          await stopAt(sample!.address);
          const hiddenAddress = await monitor.readMemory(hidden[0]!.operand, hidden[1]!.operand);
          const destination = hiddenAddress[0]! | (hiddenAddress[1]! << 8);
          await stopAt(sample!.address + 3);
          expect(Array.from(await monitor.readMemory(destination, destination + 10))).toEqual(
            SNAPSHOT_BYTES,
          );
          const qualityLoad = code.find(
            ({ address, opcode, operand }) =>
              address > sample!.address &&
              address < query!.address &&
              opcode === 0xad &&
              operand === destination + 10,
          );
          expect(qualityLoad, "fixed quality field has its exact declared offset").toBeDefined();
          await stopAt(query!.address);
          const borrowed = await monitor.readMemory(
            argumentsToQuery[0]!.operand,
            argumentsToQuery[1]!.operand,
          );
          expect(borrowed[0]! | (borrowed[1]! << 8)).toBe(destination);
          expect(
            (
              await monitor.readMemory(argumentsToQuery[2]!.operand, argumentsToQuery[2]!.operand)
            )[0],
          ).toBe(0);
          expect((await monitor.readMemory(0x3300, 0x3300))[0]).toBe(0xac);
          await stopAt(query!.address + 3);
          expect((await monitor.readCpuRegisters()).a).toBe(0x13);
          await stopAt(libraryStartup(artifacts, "startup.restore"));
          const hits = await monitor.takeCheckpointHits();
          expect(hits.filter((id) => [qualityStore, queryStore].includes(id))).toEqual([
            qualityStore,
            queryStore,
          ]);
          expect(Array.from(await monitor.readMemory(0x3300, 0x3301))).toEqual([0xac, 0x13]);
          expect(Array.from(await monitor.readMemory(destination, destination + 10))).toEqual(
            SNAPSHOT_BYTES,
          );
          expect((await monitor.readCpuRegisters()).sp).toBe(stack);
          expect(code.find(({ address }) => address === query!.address + 3)).toMatchObject({
            opcode: 0x8d,
            operand: 0x3301,
          });
        });
      });
    }, 120_000);
  }
});
