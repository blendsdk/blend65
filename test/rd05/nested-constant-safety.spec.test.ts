import { describe, expect, it } from "vitest";
import {
  expectLibraryAccounting,
  libraryStartup,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

const emptyLibrary = "module Library;";
const source = `module Game;
struct Captured { rows: byte[4]; later: byte; }
struct Effectful { rows: byte[2]; last: byte; }
struct Overlap { before: byte; rows: byte[1][3]; after: byte; }
let original: byte[4] = [11,13,17,19];
let calls: byte = 0;
let globalValue: Captured = { rows: [21,23,29,31], later: 37 };
function changeOriginal(): byte {
  calls += 1;
  original[0] = 99;
  poke($c014, calls);
  return 41;
}
function nestedEffect(): byte {
  poke($c012, 51);
  return peek($c011);
}
function lastEffect(): byte {
  poke($c013, 53);
  return 59;
}
function inspectGlobal(): byte {
  poke($c015, globalValue.rows[0]);
  return 61;
}
function borrowWrite(value: Captured): void {
  value.rows = [71,73,79,83];
  value.later = 89;
}
function callerResult(): Captured {
  return { rows: original, later: changeOriginal() };
}
function emit(address: word, size: word, destination: word): void {
  for (let index: word = 0; index < size; index += 1) {
    poke(destination + index, peek(address + index));
  }
}
function main(): void {
  asm_php(); asm_sei();
  let captured: Captured = { rows: original, later: changeOriginal() };
  emit(&captured, sizeof(Captured), $c020);
  emit(&original, 4, $c025);
  let effects: Effectful = { rows: [peek($c010), nestedEffect()], last: lastEffect() };
  emit(&effects, sizeof(Effectful), $c030);
  globalValue = { rows: [2,3,5,7], later: inspectGlobal() };
  emit(&globalValue, sizeof(Captured), $c040);
  let assigned: Captured = captured;
  captured.rows[0] = 97;
  emit(&assigned, sizeof(Captured), $c050);
  borrowWrite(captured);
  emit(&captured, sizeof(Captured), $c055);
  captured = captured;
  emit(&captured, sizeof(Captured), $c05a);
  original = [101,103,107,109];
  let returned: Captured = callerResult();
  emit(&returned, sizeof(Captured), $c060);
  let repeated: byte[3][3] = [[1,2,3]; [5,7,11]];
  repeated[1][0] = 13;
  emit(&repeated, sizeof(byte[3][3]), $c070);
  let overlap: Overlap = { before: 7, rows: [[1,2,3]], after: 99 };
  let ordinal: word = peekw($c018);
  overlap.rows[ordinal] = overlap.rows[0];
  emit(&overlap, sizeof(Overlap), $c080);
  overlap = { before: 7, rows: [[1,2,3]], after: 99 };
  overlap.rows[0] = overlap.rows[ordinal];
  emit(&overlap, sizeof(Overlap), $c085);
  asm_plp();
}`;

/** Source-visible volatile operations have an exact order and count, including nested calls. */
const effectOperations = [
  [0xc010, "load"],
  [0xc012, "store"],
  [0xc011, "load"],
  [0xc013, "store"],
] as const;

describe.sequential.each(sourceLibraryProfiles)("constant nested safety on %s", (profile) => {
  // Aggregate reads capture the complete earlier value before later calls can mutate its source.
  it("should preserve snapshots, overlapping copies, borrowed writes and effectful fallback paths", async () => {
    await withLibraryBuild(source, emptyLibrary, profile, async (artifacts, built) => {
      expectLibraryAccounting(artifacts);
      await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
        await monitor.writeMemory(0xc010, Uint8Array.of(43, 47));
        await monitor.writeMemory(0xc014, new Uint8Array(2).fill(0xa5));
        // Three-byte row stride × 21845 is 65535: the unchecked row aliases one byte earlier.
        // Both copy directions therefore exercise actual partial overlap in the address domain.
        await monitor.writeMemory(0xc018, Uint8Array.of(0x55, 0x55));
        await monitor.writeMemory(0xc020, new Uint8Array(0x70).fill(0xa5));
        await stopAt(libraryStartup(artifacts, "startup.restore"));
        expect([...(await monitor.readMemory(0xc020, 0xc028))]).toEqual([
          11, 13, 17, 19, 41, 99, 13, 17, 19,
        ]);
        expect([...(await monitor.readMemory(0xc014, 0xc015))]).toEqual([2, 21]);
        expect([...(await monitor.readMemory(0xc030, 0xc032))]).toEqual([43, 47, 59]);
        expect([...(await monitor.readMemory(0xc040, 0xc044))]).toEqual([2, 3, 5, 7, 61]);
        expect([...(await monitor.readMemory(0xc050, 0xc054))]).toEqual([11, 13, 17, 19, 41]);
        expect([...(await monitor.readMemory(0xc055, 0xc05e))]).toEqual([
          71, 73, 79, 83, 89, 71, 73, 79, 83, 89,
        ]);
        expect([...(await monitor.readMemory(0xc060, 0xc064))]).toEqual([101, 103, 107, 109, 41]);
        expect([...(await monitor.readMemory(0xc070, 0xc078))]).toEqual([
          1, 2, 3, 13, 7, 11, 5, 7, 11,
        ]);
        expect([...(await monitor.readMemory(0xc080, 0xc089))]).toEqual([
          1, 2, 3, 3, 99, 7, 7, 1, 2, 99,
        ]);
      });
    });
  }, 180_000);

  // Pure-looking siblings must not move any real volatile access ahead of its source predecessor.
  it("should execute each nested volatile read and effectful call exactly once in source order", async () => {
    const effectSource = `module Game;
struct Value { prefix: byte[2]; effects: byte[2]; suffix: byte[2]; last: byte; }
function nestedEffect(): byte { poke($c012, 51); return peek($c011); }
function lastEffect(): byte { poke($c013, 53); return 59; }
function main(): void {
  asm_php(); asm_sei();
  let value: Value = { prefix: [2,3], effects: [peek($c010), nestedEffect()],
    suffix: [5,7], last: lastEffect() };
  poke($c020, value.prefix[0]); poke($c021, value.prefix[1]);
  poke($c022, value.effects[0]); poke($c023, value.effects[1]);
  poke($c024, value.suffix[0]); poke($c025, value.suffix[1]);
  poke($c026, value.last);
  asm_plp();
}`;
    await withLibraryBuild(effectSource, emptyLibrary, profile, async (artifacts, built) => {
      expectLibraryAccounting(artifacts);
      await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
        await monitor.writeMemory(0xc010, Uint8Array.of(43, 47));
        const tracepoints: number[] = [];
        try {
          for (const [address, operation] of effectOperations)
            tracepoints.push(await monitor.setAccessTracepoint(address, operation));
          monitor.takeCheckpointHits();
          await stopAt(libraryStartup(artifacts, "startup.restore"));
          expect(
            monitor.takeCheckpointHits().filter((checkpoint) => tracepoints.includes(checkpoint)),
          ).toEqual(tracepoints);
          expect([...(await monitor.readMemory(0xc020, 0xc026))]).toEqual([2, 3, 43, 47, 5, 7, 59]);
          expect([...(await monitor.readMemory(0xc012, 0xc013))]).toEqual([51, 53]);
        } finally {
          for (const checkpoint of tracepoints) await monitor.deleteCheckpoint(checkpoint);
        }
      });
    });
  }, 180_000);
});
