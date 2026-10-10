import { describe, expect, it } from "vitest";
import {
  libraryEntry,
  libraryStartup,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

/** Ordinary nested calls retain places and scalar values while later helpers mutate shared data. */
const SOURCE = `module Game;
struct Record { prefix: byte[10]; rows: byte[8]; }
const CIA1_PA: word = $DC00;
const INPUT: word = $3000;
const COLUMN: word = $3002;
const CALL_INPUT: word = $3005;
place(at: $3003) let selector: word;
place(at: $3400) let objects: Record[2];
place(at: $3300) let output: byte[4];
function armed(): void { asm_nop(); }
function query(record: const Record, column: byte): byte { return record.rows[column & 7]; }
function choose(): word { poke(CIA1_PA, $F0); return selector; }
function mutate(): byte {
  poke(CIA1_PA, $E0);
  let previous: word = selector;
  selector = 1 - selector;
  objects[previous].rows[2] = $5A;
  return $17;
}
function combine(record: const Record, token: byte): byte {
  poke(CIA1_PA, $C0);
  return record.rows[2] ^ token;
}
function disturb(): word { poke(CIA1_PA, $A0); return peekw(CALL_INPUT); }
function consume(record: Record, value: byte): void {
  poke(CIA1_PA, $90);
  record.rows[4] = value;
  output[3] = record.rows[4];
}
function main(): void {
  asm_sei(); armed();
  output[0] = query(objects[peekw(INPUT)], peek(COLUMN));
  output[1] = combine(objects[choose()], mutate());
  let saved: byte = query(objects[peekw(INPUT)], peek(COLUMN));
  let changed: word = disturb();
  output[2] = saved;
  consume(objects[selector], saved);
}`;

/** Distinct row data makes a false fixed object identity or omitted ten-byte field offset visible. */
const ROWS = [
  [0x12, 0x23, 0x34, 0x45, 0x56, 0x67, 0x78, 0x89],
  [0x9a, 0xab, 0xbc, 0xcd, 0xde, 0xef, 0xf1, 0xf2],
] as const;

describe.sequential("ordinary aggregate and scalar call guards", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const selected of [0, 1]) {
      // Earlier arguments capture an address; later alias writes change the contents at that place.
      it(`should retain dynamic places, aliased effects and saved call bytes for object ${selected} on ${profile}`, async () => {
        await withLibraryBuild(SOURCE, "module Extra;", profile, async (artifacts, built) => {
          await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.main"));
            const stack = (await monitor.readCpuRegisters()).sp;
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.armed"));
            const input = Uint8Array.of(selected, 0, 6, selected, 0, 0xde, 0xbc);
            await monitor.writeMemory(0x3000, input);
            const original = Uint8Array.from([
              ...new Uint8Array(10).fill(0x11),
              ...ROWS[0],
              ...new Uint8Array(10).fill(0x22),
              ...ROWS[1],
            ]);
            await monitor.writeMemory(0x3400, original);
            await monitor.writeMemory(0x3300, new Uint8Array(4).fill(0xcc));
            await monitor.writeIo(0xdc02, Uint8Array.of(0xff));
            const rowBase = 0x3400 + selected * 18 + 10;
            const otherRowBase = 0x3400 + (1 - selected) * 18 + 10;
            const queryRead = await monitor.setAccessTracepoint(rowBase + 6, "load");
            const otherQueryRead = await monitor.setAccessTracepoint(otherRowBase + 6, "load");
            const paWrite = await monitor.setAccessTracepoint(0xdc00, "store");
            const sourceWrites: number[] = [];
            for (let address = 0x3400; address < 0x3424; address += 1) {
              sourceWrites.push(await monitor.setAccessTracepoint(address, "store"));
            }
            await monitor.takeCheckpointHits();
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.mutate"));
            expect(
              (await monitor.readIo(0xdc00, 0xdc00))[0],
              "first argument helper ran first",
            ).toBe(0xf0);
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.combine"));
            expect((await monitor.readIo(0xdc00, 0xdc00))[0]).toBe(0xe0);
            expect((await monitor.readMemory(rowBase + 2, rowBase + 2))[0]).toBe(0x5a);
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.disturb"));
            expect((await monitor.readIo(0xdc00, 0xdc00))[0]).toBe(0xc0);
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.consume"));
            expect((await monitor.readIo(0xdc00, 0xdc00))[0]).toBe(0xa0);
            await stopAt(libraryStartup(artifacts, "startup.restore"));
            const saved = ROWS[selected]![6];
            expect(Array.from(await monitor.readMemory(0x3300, 0x3303))).toEqual([
              saved,
              0x4d,
              saved,
              saved,
            ]);
            const expected = original.slice();
            expected[selected * 18 + 12] = 0x5a;
            expected[(1 - selected) * 18 + 14] = saved;
            expect(await monitor.readMemory(0x3400, 0x3423)).toEqual(expected);
            const expectedInput = input.slice();
            expectedInput[3] = 1 - selected;
            expect(await monitor.readMemory(0x3000, 0x3006)).toEqual(expectedInput);
            const hits = await monitor.takeCheckpointHits();
            const effects = [queryRead, otherQueryRead, paWrite, ...sourceWrites];
            expect(hits.filter((id) => effects.includes(id))).toEqual([
              queryRead,
              paWrite,
              paWrite,
              sourceWrites[selected * 18 + 12],
              paWrite,
              queryRead,
              paWrite,
              paWrite,
              sourceWrites[(1 - selected) * 18 + 14],
            ]);
            expect((await monitor.readIo(0xdc00, 0xdc00))[0]).toBe(0x90);
            expect((await monitor.readCpuRegisters()).sp).toBe(stack);
            expect((await monitor.readCpuRegisters()).p & 0x04).toBe(0x04);
          });
        });
      }, 120_000);
    }
  }
});
