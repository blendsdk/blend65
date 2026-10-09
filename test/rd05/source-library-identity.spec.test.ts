import { describe, expect, it } from "vitest";
import { profileRecords } from "./profile-fixture.js";
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

const source = `module Game;
import { read, write } from Hot;
import { VALUE } from Cold;
function main(): void { write(42); poke($d020, read()); poke($d021, VALUE); }`;
const cold = `module Cold;
export const VALUE: byte = 19;
let state: byte;
export function read(): byte { return state; }`;

describe.sequential.each(sourceLibraryProfiles)(
  "source-library declaration identity on %s",
  (profile) => {
    // Both modules are selected, but equal private spellings do not create an executable dependency.
    it("should retain only the reached storage and routine when two selected modules share their spelling", async () => {
      const hot = `module Hot;
let state: byte;
export function write(value: byte): void { state = value; }
export function read(): byte { return state; }`;
      await withLibraryBuild(
        source,
        hot,
        profile,
        async (artifacts, built) => {
          const hotStorage = libraryGlobalIntervals(artifacts, hot, "state");
          const coldStorage = libraryGlobalIntervals(artifacts, cold, "state", "src/cold.blend");
          const hotAddress = libraryGlobalAddress(artifacts, hot, "state", 1);
          expect(coldStorage.intervals).toEqual([]);
          for (const hotSymbol of hotStorage.symbols)
            for (const coldSymbol of coldStorage.symbols)
              expect(hotSymbol.qualifiedName).not.toBe(coldSymbol.qualifiedName);
          libraryEntry(artifacts, "src/library.blend::Hot.read");
          libraryEntry(artifacts, "src/library.blend::Hot.write");
          expect(
            profileRecords(artifacts.debug.functions).map((entry) => entry.qualifiedName),
          ).not.toContain("src/cold.blend::Cold.read");
          expectLibraryAccounting(artifacts);
          await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
            await stopAt(libraryStartup(artifacts, "startup.restore"));
            expect([...(await monitor.readMemory(hotAddress, hotAddress))]).toEqual([42]);
            expect([...(await monitor.readIo(0xd020, 0xd021))].map((value) => value & 15)).toEqual([
              10, 3,
            ]);
          });
        },
        { "cold.blend": cold },
      );
    }, 180_000);

    // A contribution in another file keeps the actual declaration owner, not a guessed file-local name.
    it("should retain a private global reached through another contribution to its merged module", async () => {
      const hot = `module Hot; let state: byte;`;
      const contribution = `module Hot;
export function write(value: byte): void { state = value; }
export function read(): byte { return state; }`;
      await withLibraryBuild(
        source,
        hot,
        profile,
        async (artifacts, built) => {
          const hotAddress = libraryGlobalAddress(artifacts, hot, "state", 1);
          expect(
            libraryGlobalIntervals(artifacts, cold, "state", "src/cold.blend").intervals,
          ).toEqual([]);
          libraryEntry(artifacts, "src/contribution.blend::Hot.read");
          libraryEntry(artifacts, "src/contribution.blend::Hot.write");
          expect(
            profileRecords(artifacts.debug.functions).map((entry) => entry.qualifiedName),
          ).not.toContain("src/cold.blend::Cold.read");
          expectLibraryAccounting(artifacts);
          await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
            await stopAt(libraryStartup(artifacts, "startup.restore"));
            expect([...(await monitor.readMemory(hotAddress, hotAddress))]).toEqual([42]);
            expect([...(await monitor.readIo(0xd020, 0xd021))].map((value) => value & 15)).toEqual([
              10, 3,
            ]);
          });
        },
        { "contribution.blend": contribution, "cold.blend": cold },
      );
    }, 180_000);

    // Ordinary user declarations merged with installed masks retain the same source-origin rules.
    it("should preserve a reached user contribution alongside installed input constants", async () => {
      const source = `module Game;
import { read, write, joystickUpMask } from c64.input;
import { VALUE } from Cold;
function main(): void {
  write(42); poke($d020, read()); poke($d021, joystickUpMask); poke($d022, VALUE);
}`;
      const hot = `module c64.input;
let state: byte;
export function write(value: byte): void { state = value; }
export function read(): byte { return state; }`;
      await withLibraryBuild(
        source,
        hot,
        profile,
        async (artifacts, built) => {
          const hotAddress = libraryGlobalAddress(artifacts, hot, "state", 1);
          expect(
            libraryGlobalIntervals(artifacts, cold, "state", "src/cold.blend").intervals,
          ).toEqual([]);
          libraryEntry(artifacts, "src/library.blend::c64.input.read");
          libraryEntry(artifacts, "src/library.blend::c64.input.write");
          expect(profileRecords(artifacts.debug.sources).map((entry) => entry.path)).toContain(
            "@blend65/stdlib/c64/input.blend",
          );
          expectLibraryAccounting(artifacts);
          await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
            await stopAt(libraryStartup(artifacts, "startup.restore"));
            expect([...(await monitor.readMemory(hotAddress, hotAddress))]).toEqual([42]);
            expect([...(await monitor.readIo(0xd020, 0xd022))].map((value) => value & 15)).toEqual([
              10, 1, 3,
            ]);
          });
        },
        { "cold.blend": cold },
      );
    }, 180_000);
  },
);
