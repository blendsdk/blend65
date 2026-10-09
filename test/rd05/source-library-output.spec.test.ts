import { describe, expect, it } from "vitest";
import { profileRecords } from "./profile-fixture.js";
import {
  expectSameLibraryCost,
  libraryBytes,
  libraryEntry,
  libraryGlobalIntervals,
  libraryStartup,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

const minimal = `module Library; export const VALUE: byte = 37;`;
const coldLibrary = `${minimal}
let coldByte: byte;
export function coldRoutine(): byte { return coldByte; }`;

describe.sequential.each(sourceLibraryProfiles)(
  "source-library complete output cost on %s",
  (profile) => {
    // A selected constant does not charge unused ordinary code, data, or startup work.
    it("should match a constant-only artifact when private uninitialized data is used only by a cold export", async () => {
      const source = `module Game;
import { VALUE } from Library;
function main(): void { poke($d020, VALUE); }`;
      const control = await withLibraryBuild(
        source,
        minimal,
        profile,
        async (artifacts) => artifacts,
      );
      await withLibraryBuild(source, coldLibrary, profile, async (artifacts, built) => {
        expect(libraryGlobalIntervals(artifacts, coldLibrary, "coldByte").intervals).toEqual([]);
        expect(
          profileRecords(artifacts.debug.functions).map((entry) => entry.qualifiedName),
        ).toEqual(["src/game.blend::Game.main"]);
        expectSameLibraryCost(artifacts, control);
        const main = libraryEntry(artifacts, "src/game.blend::Game.main");
        expect(libraryBytes(artifacts, main, 5)).toEqual([0xa9, 37, 0x8d, 0x20, 0xd0]);
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          await stopAt(main + 2);
          expect((await monitor.readCpuRegisters()).a).toBe(37);
          const store = await monitor.setAccessTracepoint(0xd020, "store");
          monitor.takeCheckpointHits();
          await stopAt(libraryStartup(artifacts, "startup.restore"));
          expect(monitor.takeCheckpointHits().filter((id) => id === store)).toEqual([store]);
          expect((await monitor.readIo(0xd020, 0xd020))[0]! & 15).toBe(5);
          await monitor.deleteCheckpoint(store);
        });
      });
    }, 180_000);

    for (const { name, address, joystick } of [
      { name: "readJoystick1", address: 0xdc01, joystick: 1 },
      { name: "readJoystick2", address: 0xdc00, joystick: 2 },
    ]) {
      // Raw joystick sampling is one whole-byte volatile read, without cold library machinery.
      it(`should preserve one whole-byte ${name} port read without cold data or code`, async () => {
        const source = `module Game;
import { VALUE } from Library;
import { ${name} } from c64.input;
function main(): void {
  asm_php(); asm_sei(); ${name}(); asm_nop(); asm_plp();
}`;
        const control = await withLibraryBuild(
          source,
          minimal,
          profile,
          async (artifacts) => artifacts,
        );
        await withLibraryBuild(source, coldLibrary, profile, async (artifacts, built) => {
          expect(libraryGlobalIntervals(artifacts, coldLibrary, "coldByte").intervals).toEqual([]);
          expect(
            profileRecords(artifacts.debug.functions).map((entry) => entry.qualifiedName),
          ).toEqual(["src/game.blend::Game.main"]);
          expectSameLibraryCost(artifacts, control);
          const main = libraryEntry(artifacts, "src/game.blend::Game.main");
          expect(libraryBytes(artifacts, main, 7)).toEqual([
            0x08,
            0x78,
            0xad,
            address & 0xff,
            address >>> 8,
            0xea,
            0x28,
          ]);
          await withLibraryVice(
            built,
            artifacts,
            profile,
            async (monitor, stopAt) => {
              await stopAt(main + 2);
              await monitor.writeIo(0xdc0e, Uint8Array.of(0, 0));
              await monitor.writeIo(0xdc02, Uint8Array.of(0, 0));
              await monitor.writeIo(0xdc00, Uint8Array.of(255, 255));
              await monitor.setJoystick1(joystick === 1 ? 0x12 : 0);
              await monitor.setJoystick2(joystick === 2 ? 0x09 : 0);
              const pins = (await monitor.readIo(address, address))[0]!;
              const read = await monitor.setAccessTracepoint(address, "load");
              monitor.takeCheckpointHits();
              await stopAt(main + 5);
              expect((await monitor.readCpuRegisters()).a).toBe(pins);
              // Let the existing NOP complete before collecting the preceding access event.
              await stopAt(main + 6);
              expect(monitor.takeCheckpointHits().filter((id) => id === read)).toEqual([read]);
              await monitor.deleteCheckpoint(read);
              await stopAt(libraryStartup(artifacts, "startup.restore"));
            },
            [true, true],
          );
        });
      }, 180_000);
    }
  },
);
