import { describe, expect, it } from "vitest";
import {
  expectLibraryAccounting,
  libraryEntry,
  libraryFunctionBytes,
  libraryStartup,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

const emptyLibrary = "module Library;";
const packedSource = `module Game;
enum Mode { FIRST = 71, SECOND }
struct Item { octet: byte; pair: word; delta: sbyte; distance: sword; flag: boolean; mode: Mode; }
struct Bundle { prefix: byte; items: Item[2]; tail: byte[3]; }
struct Wide { prefix: byte[256]; rows: byte[8]; end: word; }
struct Filled { zero: byte[8]; mixed: byte[8]; }
struct Saved { rows: byte[8]; raw1: byte; raw2: byte; quality: byte; }
function emit(address: word, size: word, destination: word): void {
  for (let index: word = 0; index < size; index += 1) {
    poke(destination + index, peek(address + index));
  }
}
function alter(value: Saved): void {
  value.rows[3] = 91;
  value.raw1 = 17;
}
function nestedValue(): byte[8] {
  let saved: Saved = { rows: [0,0,0,0,0,0,0,0], raw1: 0, raw2: 0, quality: 2 };
  alter(saved);
  poke($c030, saved.raw1);
  return saved.rows;
}
function main(): void {
  asm_php(); asm_sei();
  let bundle: Bundle = { prefix: 9, items: [
    { octet: byte($1234), pair: $abcd, delta: -37, distance: -4660, flag: true, mode: Mode.FIRST },
    { octet: 87, pair: $4567, delta: sbyte($fe), distance: sword($8001), flag: false, mode: Mode.SECOND }
  ], tail: [19,23,29] };
  emit(&bundle, sizeof(Bundle), $c000);
  let filled: Filled = { zero: [;0], mixed: [1,2;7] };
  emit(&filled, sizeof(Filled), $c040);
  let result: byte[8] = nestedValue();
  let unrelated: byte[8] = [3,5,7,11,13,17,19,23];
  emit(&result, 8, $c020);
  emit(&unrelated, 8, $c028);
  let wide: Wide = { prefix: [${Array.from({ length: 256 }, (_, index) => index).join(",")}],
    rows: [31,37,41,43,47,53,59,61], end: $a1b2 };
  emit(&wide, sizeof(Wide), $c100);
  asm_plp();
}`;

// Declaration-order widths and two's-complement bits define these bytes, independently of lowering.
const bundleBytes = [
  9, 0x34, 0xcd, 0xab, 0xdb, 0xcc, 0xed, 1, 71, 87, 0x67, 0x45, 0xfe, 0x01, 0x80, 0, 72, 19, 23, 29,
];
const wideBytes = [
  ...Array.from({ length: 256 }, (_, index) => index),
  31,
  37,
  41,
  43,
  47,
  53,
  59,
  61,
  0xb2,
  0xa1,
];

const flagsSource = `module Game;
struct Saved { rows: byte[8]; raw1: byte; raw2: byte; quality: byte; }
function construct(): void {
  asm_php();
  let saved: Saved = { rows: [0,0,0,0,0,0,0,0], raw1: 0, raw2: 0, quality: 2 };
  poke($c000, saved.rows[0]); poke($c001, saved.rows[1]);
  poke($c002, saved.rows[2]); poke($c003, saved.rows[3]);
  poke($c004, saved.rows[4]); poke($c005, saved.rows[5]);
  poke($c006, saved.rows[6]); poke($c007, saved.rows[7]);
  poke($c008, saved.raw1); poke($c009, saved.raw2); poke($c00a, saved.quality);
  asm_plp();
  asm_nop();
}
function main(): void {
  asm_php();
  construct(); construct(); construct(); construct();
  asm_plp();
}`;

describe.sequential.each(sourceLibraryProfiles)("constant nested values on %s", (profile) => {
  // Distinct packed values, complete scalar fills, large offsets and borrowed mutations survive.
  it("should preserve packed typed bytes, full-width offsets, fills and caller-owned nested returns", async () => {
    await withLibraryBuild(packedSource, emptyLibrary, profile, async (artifacts, built) => {
      expectLibraryAccounting(artifacts);
      await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
        // Sentinel bytes on both sides catch writes outside the large final interval.
        await monitor.writeMemory(0xc000, new Uint8Array(0x300).fill(0xa5));
        await stopAt(libraryStartup(artifacts, "startup.restore"));
        expect([...(await monitor.readMemory(0xc000, 0xc013))]).toEqual(bundleBytes);
        expect([...(await monitor.readMemory(0xc020, 0xc02f))]).toEqual([
          0, 0, 0, 91, 0, 0, 0, 0, 3, 5, 7, 11, 13, 17, 19, 23,
        ]);
        expect([...(await monitor.readMemory(0xc030, 0xc030))]).toEqual([17]);
        expect([...(await monitor.readMemory(0xc040, 0xc04f))]).toEqual([
          0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 7, 7, 7, 7, 7, 7,
        ]);
        expect([...(await monitor.readMemory(0xc100, 0xc209))]).toEqual(wideBytes);
        expect([...(await monitor.readMemory(0xc0ff, 0xc0ff))]).toEqual([0xa5]);
        expect([...(await monitor.readMemory(0xc20a, 0xc20a))]).toEqual([0xa5]);
      });
    });
  }, 180_000);

  // Explicit status ownership must restore D/I and the hardware stack through every entry state.
  it("should preserve saved processor and stack state across all decimal and IRQ entry combinations", async () => {
    await withLibraryBuild(flagsSource, emptyLibrary, profile, async (artifacts, built) => {
      expectLibraryAccounting(artifacts);
      const entry = libraryEntry(artifacts, "src/game.blend::Game.construct");
      const bytes = libraryFunctionBytes(artifacts, "src/game.blend::Game.construct");
      // Published function ranges can also include outlined copy code after the return.
      // This unique source-owned PLP/NOP/RTS sequence identifies the observation point.
      const sequence = Buffer.from([0x28, 0xea, 0x60]);
      const restoredIndex = Buffer.from(bytes).indexOf(sequence);
      expect(restoredIndex).toBeGreaterThanOrEqual(0);
      expect(Buffer.from(bytes).indexOf(sequence, restoredIndex + 1)).toBe(-1);
      const restored = entry + restoredIndex + 1;
      await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
        for (const flags of [0x04, 0x0c, 0x00, 0x08]) {
          await stopAt(entry);
          // The language has no decimal-setting intrinsic. A host trampoline seeds CPU flags,
          // then restores the exact emitted entry bytes before running the ordinary function.
          const entryBytes = await monitor.readMemory(entry, entry + 2);
          await monitor.writeMemory(
            0xc300,
            Uint8Array.of(
              (flags & 0x08) === 0 ? 0xd8 : 0xf8,
              (flags & 0x04) === 0 ? 0x58 : 0x78,
              0x4c,
              entry & 0xff,
              entry >>> 8,
            ),
          );
          await monitor.writeMemory(entry, Uint8Array.of(0x4c, 0, 0xc3));
          await stopAt(0xc300);
          await monitor.writeMemory(entry, entryBytes);
          await stopAt(entry);
          const before = await monitor.readCpuRegisters();
          expect(before.p & 0x0c).toBe(flags);
          await monitor.writeMemory(0xc000, new Uint8Array(11).fill(0xa5));
          await stopAt(restored);
          const after = await monitor.readCpuRegisters();
          expect(after.p & 0x0c).toBe(before.p & 0x0c);
          expect(after.sp).toBe(before.sp);
          expect([...(await monitor.readMemory(0xc000, 0xc00a))]).toEqual([
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2,
          ]);
        }
        await stopAt(libraryStartup(artifacts, "startup.restore"));
      });
    });
  }, 180_000);
});
