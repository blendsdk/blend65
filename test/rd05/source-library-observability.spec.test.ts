import { describe, expect, it } from "vitest";
import { profileRecords } from "./profile-fixture.js";
import {
  expectLibraryAccounting,
  libraryBytes,
  libraryEntry,
  libraryGlobalAddress,
  libraryGlobalIntervals,
  libraryStartup,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

describe.sequential.each(sourceLibraryProfiles)(
  "source-library data observability on %s",
  (profile) => {
    // Direct writes and helper reads both make private module storage observable.
    it("should retain private globals written in main and read directly or through a helper", async () => {
      const source = `module Game;
import { VALUE } from Library;
let directByte: byte;
let helperByte: byte;
function helper(): byte { return helperByte; }
function main(): void {
  directByte = 42; helperByte = 19;
  poke($d020, directByte); poke($d021, helper());
}`;
      const library = `module Library; export const VALUE: byte = 37;`;
      await withLibraryBuild(source, library, profile, async (artifacts, built) => {
        const direct = libraryGlobalAddress(artifacts, source, "directByte", 1, "src/game.blend");
        const helper = libraryGlobalAddress(artifacts, source, "helperByte", 1, "src/game.blend");
        expect(direct).not.toBe(helper);
        const entry = libraryEntry(artifacts, "src/game.blend::Game.helper");
        expect(libraryBytes(artifacts, entry, 4)).toEqual([
          0xad,
          helper & 0xff,
          helper >>> 8,
          0x60,
        ]);
        expectLibraryAccounting(artifacts);
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          await stopAt(entry + 3);
          expect((await monitor.readCpuRegisters()).a).toBe(19);
          await stopAt(libraryStartup(artifacts, "startup.restore"));
          expect([...(await monitor.readMemory(direct, direct))]).toEqual([42]);
          expect([...(await monitor.readMemory(helper, helper))]).toEqual([19]);
          expect([...(await monitor.readIo(0xd020, 0xd021))].map((value) => value & 15)).toEqual([
            10, 3,
          ]);
        });
      });
    }, 180_000);

    // Aggregate destinations count as writes even when all construction happens inside the callee.
    it("should retain complete private array and struct destinations for direct and indirect returns", async () => {
      const source = `module Game;
import { Packet, makeArray, makePacket } from Library;
let directArray: byte[3];
let indirectArray: byte[3];
let directPacket: Packet;
let indirectPacket: Packet;
function main(): void {
  directArray = makeArray();
  let arrayMaker: fn(): byte[3] = &makeArray;
  indirectArray = arrayMaker();
  directPacket = makePacket();
  let packetMaker: fn(): Packet = &makePacket;
  indirectPacket = packetMaker();
}`;
      const library = `module Library;
export struct Packet { tag: byte; value: word; }
export function makeArray(): byte[3] { return [17, 34, 51]; }
export function makePacket(): Packet { return { tag: 68, value: $1234 }; }`;
      await withLibraryBuild(source, library, profile, async (artifacts, built) => {
        const destinations = ["directArray", "indirectArray", "directPacket", "indirectPacket"].map(
          (name) => libraryGlobalAddress(artifacts, source, name, 3, "src/game.blend"),
        );
        for (let left = 0; left < destinations.length; left += 1)
          for (let right = left + 1; right < destinations.length; right += 1)
            expect(Math.abs(destinations[left]! - destinations[right]!)).toBeGreaterThanOrEqual(3);
        for (const name of ["makeArray", "makePacket"])
          libraryEntry(artifacts, `src/library.blend::Library.${name}`);
        expectLibraryAccounting(artifacts);
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          await stopAt(libraryStartup(artifacts, "startup.restore"));
          for (let index = 0; index < destinations.length; index += 1) {
            const address = destinations[index]!;
            expect([...(await monitor.readMemory(address, address + 2))]).toEqual(
              index < 2 ? [17, 34, 51] : [68, 0x34, 0x12],
            );
          }
        });
      });
    }, 180_000);

    // Visibility, explicit initialization, placement, constants, and requested ZP are retention rules.
    it("should retain unused public initialized placed constant and requested zero-page data", async () => {
      const source = `module Game;
import { VALUE } from Library;
function main(): void { poke($d020, VALUE); }`;
      const library = `module Library;
export const VALUE: byte = 37;
export let publicByte: byte;
let explicitZero: byte = 0;
place(at: $3000) let placedByte: byte;
zeropage { requestedByte: byte; }
const TABLE: byte[2] = [13, 29];`;
      await withLibraryBuild(source, library, profile, async (artifacts, built) => {
        libraryGlobalAddress(artifacts, library, "publicByte", 1);
        const zero = libraryGlobalAddress(artifacts, library, "explicitZero", 1);
        expect(libraryGlobalAddress(artifacts, library, "placedByte", 1)).toBe(0x3000);
        const requested = libraryGlobalAddress(artifacts, library, "requestedByte", 1);
        expect(requested).toBeGreaterThanOrEqual(2);
        expect(requested).toBeLessThanOrEqual(0x8f);
        expect(
          libraryGlobalIntervals(artifacts, library, "requestedByte").intervals[0],
        ).toMatchObject({
          resourceClass: "zeroPage",
          size: 1,
        });
        const table = libraryGlobalAddress(artifacts, library, "TABLE", 2);
        expect(libraryBytes(artifacts, table, 2)).toEqual([13, 29]);
        expectLibraryAccounting(artifacts);
        const main = libraryEntry(artifacts, "src/game.blend::Game.main");
        expect(libraryBytes(artifacts, main, 2)).toEqual([0xa9, 37]);
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          // An explicit initializer's final store must establish its value before main.
          await monitor.writeMemory(zero, Uint8Array.of(0xee));
          const store = await monitor.setAccessTracepoint(zero, "store");
          monitor.takeCheckpointHits();
          await stopAt(main);
          expect([...(await monitor.readMemory(zero, zero))]).toEqual([0]);
          // The verified immediate load cannot write the global; let it complete
          // before collecting the preceding initializer's access event.
          await stopAt(main + 2);
          expect((await monitor.readCpuRegisters()).a).toBe(37);
          expect(monitor.takeCheckpointHits().filter((id) => id === store)).toEqual([store]);
          await monitor.deleteCheckpoint(store);
        });
      });
    }, 180_000);

    // An address taken in an otherwise cold body preserves the object's independent identity.
    it("should keep cold addressed data while omitting the address-taking function body", async () => {
      const source = `module Game;
import { VALUE } from Library;
function main(): void { poke($d020, VALUE); }`;
      const library = `module Library;
export const VALUE: byte = 37;
let addressedByte: byte;
export function coldAddress(): word { return &addressedByte; }`;
      await withLibraryBuild(source, library, profile, async (artifacts) => {
        libraryGlobalAddress(artifacts, library, "addressedByte", 1);
        expect(
          profileRecords(artifacts.debug.functions).map((entry) => entry.qualifiedName),
        ).not.toContain("src/library.blend::Library.coldAddress");
        expectLibraryAccounting(artifacts);
      });
    });

    // A reached helper's address aliases the same retained global, including raw effects through it.
    it("should preserve writes and reads through a private global address returned by a helper", async () => {
      const source = `module Game;
import { address } from Library;
function main(): void {
  let pointer: word = address();
  poke(pointer, 55); poke($d020, peek(pointer));
}`;
      const library = `module Library;
let aliasedByte: byte;
export function address(): word { return &aliasedByte; }`;
      await withLibraryBuild(source, library, profile, async (artifacts, built) => {
        const address = libraryGlobalAddress(artifacts, library, "aliasedByte", 1);
        libraryEntry(artifacts, "src/library.blend::Library.address");
        expectLibraryAccounting(artifacts);
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          const store = await monitor.setAccessTracepoint(address, "store");
          const load = await monitor.setAccessTracepoint(address, "load");
          monitor.takeCheckpointHits();
          await stopAt(libraryStartup(artifacts, "startup.restore"));
          expect(monitor.takeCheckpointHits().filter((id) => id === store || id === load)).toEqual([
            store,
            load,
          ]);
          expect([...(await monitor.readMemory(address, address))]).toEqual([55]);
          expect((await monitor.readIo(0xd020, 0xd020))[0]! & 15).toBe(7);
          await monitor.deleteCheckpoint(store);
          await monitor.deleteCheckpoint(load);
        });
      });
    }, 180_000);
  },
);
