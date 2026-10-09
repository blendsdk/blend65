import { describe, expect, it } from "vitest";
import { profileRecord, profileRecords } from "./profile-fixture.js";
import {
  expectLibraryAccounting,
  libraryBytes,
  libraryEntry,
  libraryStartup,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

describe.sequential.each(sourceLibraryProfiles)(
  "source-library execution roots on %s",
  (profile) => {
    // Private explicit initializers run once in name order before main, even without binding reads.
    it("should retain private initializer helpers and write the border twice in startup order", async () => {
      const source = `module Game;
import { VALUE } from Library;
function main(): void { poke($c000, VALUE); }`;
      const library = `module Library;
const BORDER: word = $d020;
export const VALUE: byte = 37;
let alpha: byte = emitFirst();
let beta: byte = emitSecond();
place(at: $9000) function emitFirst(): byte { poke(BORDER, 17); return 1; }
place(at: $9020) function emitSecond(): byte { poke(BORDER, 34); return 2; }`;
      await withLibraryBuild(source, library, profile, async (artifacts, built) => {
        const first = libraryEntry(artifacts, "src/library.blend::Library.emitFirst");
        const second = libraryEntry(artifacts, "src/library.blend::Library.emitSecond");
        expect([first, second]).toEqual([0x9000, 0x9020]);
        // Independent immediate-write bytes also identify the instruction boundary before each store.
        expect(libraryBytes(artifacts, first, 5)).toEqual([0xa9, 17, 0x8d, 0x20, 0xd0]);
        expect(libraryBytes(artifacts, second, 5)).toEqual([0xa9, 34, 0x8d, 0x20, 0xd0]);
        expectLibraryAccounting(artifacts);
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          // Bound the source-effect trace to the initializer entries, after host startup activity.
          await stopAt(first);
          const writes = await monitor.setAccessTracepoint(0xd020, "store");
          monitor.takeCheckpointHits();
          await stopAt(first + 2);
          expect((await monitor.readCpuRegisters()).a).toBe(17);
          await stopAt(second);
          expect(monitor.takeCheckpointHits().filter((id) => id === writes)).toHaveLength(1);
          expect((await monitor.readIo(0xd020, 0xd020))[0]! & 0x0f).toBe(1);
          await stopAt(second + 2);
          expect((await monitor.readCpuRegisters()).a).toBe(34);
          await stopAt(libraryEntry(artifacts, "src/game.blend::Game.main"));
          expect(monitor.takeCheckpointHits().filter((id) => id === writes)).toHaveLength(1);
          // VIC-II stores the low color nibble; observing A above proves the complete bus write values.
          expect((await monitor.readIo(0xd020, 0xd020))[0]! & 0x0f).toBe(2);
          await monitor.deleteCheckpoint(writes);
          await stopAt(libraryStartup(artifacts, "startup.restore"));
          expect([...(await monitor.readMemory(0xc000, 0xc000))]).toEqual([37]);
        });
      });
    }, 180_000);

    // A typed IRQ sink retains its selected chained entry, private byte state, helper, and saved link.
    it("should retain the installed IRQ route and private dependency through its matching restore", async () => {
      const source = `module Game;
import { setIRQ, restoreIRQ } from c64.system;
import { onTick } from Library;
function main(): void {
  asm_php(); asm_sei(); poke($c040, 0);
  setIRQ(&onTick); asm_cli();
  while (peek($c040) == 0) { asm_nop(); }
  asm_sei(); restoreIRQ(); asm_plp();
}`;
      const library = `module Library;
place(at: $c041) let privateByte: byte = 42;
function dependency(): byte { return privateByte; }
export interrupt function onTick(): void {
  poke($c042, dependency()); poke($c040, 1);
}`;
      await withLibraryBuild(source, library, profile, async (artifacts, built) => {
        const handler = libraryEntry(artifacts, "src/library.blend::Library.onTick");
        libraryEntry(artifacts, "src/library.blend::Library.dependency");
        expect(libraryBytes(artifacts, handler, 2)).toEqual([0x08, 0xd8]);
        const fn = profileRecords(artifacts.debug.functions).find(
          (entry) => entry.qualifiedName === "src/library.blend::Library.onTick",
        );
        const variant = profileRecords(fn!.entryVariants)[0]!;
        const lines = artifacts.assembly.split(/\r?\n/u);
        const begin = lines.findIndex((line) => line.trim() === `${variant.label}:`);
        expect(begin).toBeGreaterThanOrEqual(0);
        const tailOffset = lines.slice(begin + 1).findIndex((line) => /^\s*jmp\s+\(/iu.test(line));
        expect(tailOffset).toBeGreaterThanOrEqual(0);
        const tail = lines[begin + 1 + tailOffset]!;
        expect(lines[begin + tailOffset]!.trim()).toMatch(/^plp(?:\s*;.*)?$/iu);
        const linkLabel = /^\s*jmp\s+\(([^)]+)\)/iu.exec(tail)?.[1]?.trim();
        expect(linkLabel).toBeDefined();
        const labels = new Map(
          [...artifacts.labels.matchAll(/^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu)].map((match) => [
            match[1]!,
            Number.parseInt(match[2]!, 16),
          ]),
        );
        const link = linkLabel?.startsWith("$")
          ? Number.parseInt(linkLabel.slice(1), 16)
          : labels.get(linkLabel!);
        if (link === undefined)
          throw new Error("Expected the selected route's physical saved link");
        expect(link & 0xff).toBeLessThanOrEqual(0xfe);
        const intervals = profileRecords(artifacts.memory.intervals);
        expect(intervals.some((entry) => entry.start === 0xc041 && entry.end === 0xc042)).toBe(
          true,
        );
        expect(
          intervals.some(
            (entry) =>
              typeof entry.start === "number" &&
              typeof entry.end === "number" &&
              entry.start <= link &&
              entry.end >= link + 2,
          ),
        ).toBe(true);
        expectLibraryAccounting(artifacts);
        expect(
          profileRecords(profileRecord(artifacts.costs.totals).resources).length,
        ).toBeGreaterThan(0);
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          const original = [...(await monitor.readMemory(0x0314, 0x0315))];
          await monitor.writeMemory(0xc042, Uint8Array.of(0xee));
          await stopAt(handler);
          expect([...(await monitor.readMemory(0x0314, 0x0315))]).toEqual([
            handler & 0xff,
            handler >>> 8,
          ]);
          expect([...(await monitor.readMemory(link, link + 1))]).toEqual(original);
          await stopAt(libraryStartup(artifacts, "startup.restore"));
          expect([...(await monitor.readMemory(0xc040, 0xc042))]).toEqual([1, 42, 42]);
          expect([...(await monitor.readMemory(0x0314, 0x0315))]).toEqual(original);
        });
      });
    }, 180_000);
  },
);
