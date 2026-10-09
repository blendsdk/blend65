import { describe, expect, it } from "vitest";
import {
  expectLibraryAccounting,
  libraryEntry,
  libraryGlobalAddress,
  libraryGlobalIntervals,
  libraryStartup,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

const library = `module Library;
export const VALUE: byte = 37;
let coldSprite: byte[64];`;

/** Keep a source library selected while exercising one reached hardware operation. */
function program(operation: string): string {
  return `module Game;
import { VALUE } from Library;
function main(): void { ${operation} }`;
}

const observers = [
  ["typed numeric sprite pointer", "c64.vic.setSpritePointer(0, $80);"],
  ["typed sprite enable without a pointer write", "c64.vic.setSpriteEnabled(0, true);"],
  [
    "typed numeric pointer followed by enable",
    "c64.vic.setSpritePointer(0, $80); c64.vic.setSpriteEnabled(0, true);",
  ],
  ...Array.from({ length: 8 }, (_, sprite) => [
    `raw sprite ${sprite} pointer-table write`,
    `poke($${(0x07f8 + sprite).toString(16)}, $80);`,
  ]),
  ["raw display control", "poke($d011, $1b);"],
  ["raw sprite enable", "poke($d015, 3);"],
  ["raw screen and graphics selector", "poke($d018, $14);"],
  ["raw CIA2 bank latch", "poke($dd00, $a2);"],
  ["raw CIA2 bank direction", "poke($dd02, 3);"],
  ["display-control mirror", "poke($d351, $1b);"],
  ["sprite-enable mirror", "poke($d055, 3);"],
  ["screen-selector mirror", "poke($d398, $14);"],
  ["CIA2 bank-latch mirror", "poke($ddf0, $a2);"],
  ["CIA2 bank-direction mirror", "poke($ddf2, 3);"],
  ["word high byte reaching sprite enable", "pokew($d014, $0300);"],
  ["word high byte reaching mirrored sprite enable", "pokew($d054, $0300);"],
  ["word high byte reaching bank direction", "pokew($dd01, $0300);"],
  ["word high byte reaching mirrored bank direction", "pokew($ddf1, $0300);"],
  ["word high byte reaching the sprite pointer table", "pokew($07f7, $8000);"],
  ["wrapped word-width address reaching sprite enable", "poke($d015 + $8000 + $8000, 3);"],
  [
    "wrapped word-width address whose high byte reaches sprite enable",
    "pokew($d014 + $8000 + $8000, $0300);",
  ],
] as const;

describe.sequential.each(sourceLibraryProfiles)(
  "source-library VIC memory observers on %s",
  (profile) => {
    // Numeric selectors cannot prove that private uninitialized RAM is invisible to the VIC.
    for (const [name, operation] of observers) {
      it(`should retain cold private sprite data for ${name}`, async () => {
        await withLibraryBuild(program(operation), library, profile, async (artifacts) => {
          libraryGlobalAddress(artifacts, library, "coldSprite", 64);
          expectLibraryAccounting(artifacts);
        });
      });
    }

    for (const [name, operation] of [
      ["typed border color", "c64.vic.setBorderColor(6);"],
      ["raw border and background colors", "pokew($d020, $0306);"],
      ["isolated raw sprite position", "poke($d000, 24);"],
      ["isolated mirrored sprite position", "poke($d340, 24);"],
    ]) {
      // Color and position accesses alone do not select ordinary RAM for a device consumer.
      it(`should omit cold private sprite data for ${name}`, async () => {
        await withLibraryBuild(program(operation!), library, profile, async (artifacts) => {
          expect(libraryGlobalIntervals(artifacts, library, "coldSprite").intervals).toEqual([]);
          expectLibraryAccounting(artifacts);
        });
      });
    }

    it("should preserve transparent numeric-selected RAM through two frames and one collision result", async () => {
      const source = `module Game;
import { VALUE } from Library;
place(at: $1ffe) function fence(): void { asm_nop(); }
function oneFrame(): void { asm_nop(); }
function done(): void { asm_nop(); }
function main(): void {
  asm_php(); asm_sei();
  fence();
  c64.vic.setSpriteEnabled(0, false);
  c64.vic.setSpriteEnabled(1, false);
  c64.vic.setSpritePointer(0, $80);
  c64.vic.setSpritePointer(1, $80);
  c64.vic.setSpritePosition(0, 24, 60);
  c64.vic.setSpritePosition(1, 24, 60);
  c64.vic.readAndClearSpriteSpriteCollisions();
  c64.vic.setSpriteEnabled(0, true);
  c64.vic.setSpriteEnabled(1, true);
  c64.video.waitNextFrame();
  oneFrame();
  c64.video.waitNextFrame();
  poke($0700, c64.vic.readAndClearSpriteSpriteCollisions());
  c64.vic.setBorderColor(0);
  done();
  asm_plp();
}`;
      const imageLibrary = `${library}\nlet solidImage: byte[63] = [; $ff];`;
      await withLibraryBuild(source, imageLibrary, profile, async (artifacts, built) => {
        const cold = libraryGlobalAddress(artifacts, imageLibrary, "coldSprite", 64);
        const solid = libraryGlobalAddress(artifacts, imageLibrary, "solidImage", 63);
        expect(solid + 63 <= cold || cold + 64 <= solid).toBe(true);
        expect(libraryEntry(artifacts, "src/game.blend::Game.fence")).toBe(0x1ffe);
        const loadStart = artifacts.prg.readUInt16LE(0);
        const loadEnd = loadStart + artifacts.prg.length - 2;
        // The numeric pointer selects $2000..$203f in bank zero, outside the loaded prefix.
        expect(loadEnd).toBeLessThanOrEqual(0x2000);
        expect(cold).toBeGreaterThanOrEqual(loadEnd);
        expect(solid).toBeGreaterThanOrEqual(loadEnd);
        expect(solid + 63 <= 0x2000 || solid >= 0x2040).toBe(true);
        expectLibraryAccounting(artifacts);
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          const transparent = new Uint8Array(64);
          await monitor.writeMemory(0x2000, transparent);
          await monitor.writeMemory(0x0700, Uint8Array.of(0xee));
          await stopAt(libraryEntry(artifacts, "src/game.blend::Game.main"));
          expect([...(await monitor.readMemory(0x2000, 0x203f))]).toEqual([...transparent]);
          expect([...(await monitor.readMemory(solid, solid + 62))]).toEqual(
            new Array(63).fill(0xff),
          );
          expect((await monitor.readIo(0xdd02, 0xdd02))[0]! & 3).toBe(0);
          expect((await monitor.readIo(0xdd00, 0xdd00))[0]! & 3).toBe(3);
          await monitor.writeIo(0xd015, Uint8Array.of(0));
          await monitor.writeIo(0xd018, Uint8Array.of(0x14));
          await monitor.writeIo(0xd011, Uint8Array.of(0x1b));
          for (const address of [0xd017, 0xd01b, 0xd01c, 0xd01d])
            await monitor.writeIo(address, Uint8Array.of(0));
          const collisionRead = await monitor.setAccessTracepoint(0xd01e, "load");
          const resultWrite = await monitor.setAccessTracepoint(0x0700, "store");
          monitor.takeCheckpointHits();
          await stopAt(libraryEntry(artifacts, "src/game.blend::Game.oneFrame"));
          expect((await monitor.readIo(0xd015, 0xd015))[0]! & 3).toBe(3);
          expect([...(await monitor.readMemory(0x07f8, 0x07f9))]).toEqual([0x80, 0x80]);
          expect([...(await monitor.readIo(0xd000, 0xd003))]).toEqual([24, 60, 24, 60]);
          expect(monitor.takeCheckpointHits().filter((id) => id === collisionRead)).toEqual([
            collisionRead,
          ]);
          expect((await monitor.readIo(0xd01e, 0xd01e))[0]).toBe(0);
          await stopAt(libraryEntry(artifacts, "src/game.blend::Game.done"));
          expect(
            monitor.takeCheckpointHits().filter((id) => id === collisionRead || id === resultWrite),
          ).toEqual([collisionRead, resultWrite]);
          expect([...(await monitor.readMemory(0x0700, 0x0700))]).toEqual([0]);
          expect([...(await monitor.readMemory(0x2000, 0x203f))]).toEqual([...transparent]);
          expect((await monitor.readIo(0xd020, 0xd020))[0]! & 15).toBe(0);
          await monitor.deleteCheckpoint(collisionRead);
          await monitor.deleteCheckpoint(resultWrite);
          await stopAt(libraryStartup(artifacts, "startup.restore"));
        });
      });
    }, 180_000);
  },
);
