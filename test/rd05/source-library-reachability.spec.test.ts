import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { profileRecord, profileRecords, withProfileProject } from "./profile-fixture.js";
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
  "ordinary source-library reachability on %s",
  (profile) => {
    // Export grants visibility; an unused body and its private homes add no executable cost.
    it("should emit the minimal constant-only artifact when an imported module exports an unused routine", async () => {
      const source = `module Game;
import { VALUE } from Library;
function main(): void { poke($c000, VALUE); }`;
      const minimal = `module Library; export const VALUE: byte = 37;`;
      const library = `${minimal}
export function unused(): byte {
  let privateLocal: word = peekw($c010);
  return byte(privateLocal);
}`;
      const control = await withLibraryBuild(
        source,
        minimal,
        profile,
        async (artifacts) => artifacts,
      );
      await withLibraryBuild(source, library, profile, async (artifacts, built) => {
        const names = profileRecords(artifacts.debug.functions).map((entry) => entry.qualifiedName);
        expect(names).toEqual(["src/game.blend::Game.main"]);
        const intervals = profileRecords(artifacts.memory.intervals);
        expect(JSON.stringify(intervals)).not.toMatch(/unused|privateLocal/u);
        expect(
          intervals.filter((entry) => ["sfa", "zeroPage", "scratch"].includes(String(entry.kind))),
        ).toEqual([]);
        expectLibraryAccounting(artifacts);
        // This independent source-value oracle rules out two identically incorrect artifacts.
        expect(
          libraryBytes(artifacts, libraryEntry(artifacts, "src/game.blend::Game.main"), 5),
        ).toEqual([0xa9, 37, 0x8d, 0x00, 0xc0]);
        expect(artifacts.prg).toEqual(control.prg);
        expect(profileRecord(artifacts.costs.totals)).toEqual(profileRecord(control.costs.totals));
        const allocations = (value: unknown) =>
          profileRecords(value).map(
            ({ kind, start, end, size, payloadBytes, paddingBytes, reservedBytes }) => ({
              kind,
              start,
              end,
              size,
              payloadBytes,
              paddingBytes,
              reservedBytes,
            }),
          );
        expect(allocations(artifacts.memory.intervals)).toEqual(
          allocations(control.memory.intervals),
        );
        expect(artifacts.memory.stackDomains).toEqual(control.memory.stackDomains);
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          await monitor.writeMemory(0xc000, Uint8Array.of(0xee));
          await stopAt(libraryStartup(artifacts, "startup.restore"));
          expect([...(await monitor.readMemory(0xc000, 0xc000))]).toEqual([37]);
        });
      });
    }, 180_000);

    // Direct and transitive ordinary calls preserve values and effects without name-based treatment.
    it("should retain a selected routine called directly and through an ordinary helper", async () => {
      const source = `module Game;
import { sample } from Library;
function helper(value: byte): byte { return sample(value); }
function main(): void {
  poke($c010, 5); poke($c000, sample(7));
  poke($c010, 9); poke($c001, helper(11));
}`;
      const library = `module Library;
export function sample(value: byte): byte {
  let privateLocal: byte = peek($c010);
  poke($c011, value);
  return privateLocal + value;
}`;
      await withLibraryBuild(source, library, profile, async (artifacts, built) => {
        for (const name of ["src/library.blend::Library.sample", "src/game.blend::Game.helper"])
          libraryEntry(artifacts, name);
        expectLibraryAccounting(artifacts);
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          const writes = await monitor.setAccessTracepoint(0xc011, "store");
          monitor.takeCheckpointHits();
          await stopAt(libraryEntry(artifacts, "src/game.blend::Game.helper"));
          expect([...(await monitor.readMemory(0xc000, 0xc000))]).toEqual([12]);
          expect([...(await monitor.readMemory(0xc011, 0xc011))]).toEqual([7]);
          const firstWrites = monitor.takeCheckpointHits().filter((id) => id === writes);
          expect(firstWrites).toHaveLength(1);
          await stopAt(libraryStartup(artifacts, "startup.restore"));
          expect([...(await monitor.readMemory(0xc000, 0xc001))]).toEqual([12, 20]);
          expect([...(await monitor.readMemory(0xc011, 0xc011))]).toEqual([11]);
          expect(monitor.takeCheckpointHits().filter((id) => id === writes)).toHaveLength(1);
          await monitor.deleteCheckpoint(writes);
        });
      });
    }, 180_000);

    // A private global callback assigned in main is proved through the reached exported invocation.
    it("should retain and execute the chosen target of a private global callback", async () => {
      const source = `module Game;
import { chosen } from Library;
let callback: fn(): byte;
export function invoke(): byte { return callback(); }
function main(): void { callback = &chosen; poke($c000, invoke()); }`;
      const library = `module Library;
export function chosen(): byte { return 37; }`;
      await withLibraryBuild(source, library, profile, async (artifacts, built) => {
        libraryEntry(artifacts, "src/library.blend::Library.chosen");
        libraryEntry(artifacts, "src/game.blend::Game.invoke");
        expectLibraryAccounting(artifacts);
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          await monitor.writeMemory(0xc000, Uint8Array.of(0xee));
          await stopAt(libraryStartup(artifacts, "startup.restore"));
          expect([...(await monitor.readMemory(0xc000, 0xc000))]).toEqual([37]);
        });
      });
    }, 180_000);

    // Taking an ordinary address retains its identity even when the source owner is otherwise cold.
    it("should retain an addressed ordinary dependency from a cold source function", async () => {
      const source = `module Game;
import { VALUE } from Library;
function main(): void { poke($c000, VALUE); }`;
      const library = `module Library;
export const VALUE: byte = 37;
place(at: $9000) function addressed(): byte { return 55; }
export function cold(): void { pokew($c020, word(&addressed)); }`;
      await withLibraryBuild(source, library, profile, async (artifacts, built) => {
        const address = libraryEntry(artifacts, "src/library.blend::Library.addressed");
        expect(address).toBe(0x9000);
        expect(libraryBytes(artifacts, address, 3)).toEqual([0xa9, 55, 0x60]);
        expect(
          profileRecords(artifacts.debug.functions).map((entry) => entry.qualifiedName),
        ).not.toContain("src/library.blend::Library.cold");
        expectLibraryAccounting(artifacts);
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          await monitor.writeMemory(0xc000, Uint8Array.of(0xee));
          await monitor.writeMemory(0xc020, Uint8Array.of(0xee, 0xee));
          await stopAt(libraryStartup(artifacts, "startup.restore"));
          expect([...(await monitor.readMemory(0xc000, 0xc000))]).toEqual([37]);
          expect([...(await monitor.readMemory(0xc020, 0xc021))]).toEqual([0xee, 0xee]);
        });
      });
    }, 180_000);

    // Removing export roots cannot manufacture a finite target for an unassigned callback.
    it("should reject a reached callback with no assigned finite source target", async () => {
      await withProfileProject(
        `module Game;
let callback: fn(): byte;
export function invoke(): byte { return callback(); }
function main(): void { poke($c000, invoke()); }`,
        profile,
        async (project, root) => {
          await writeFile(
            join(root, "src/library.blend"),
            `module Library;
export function chosen(): byte { return 37; }`,
          );
          const checked = await checkProject({ project });
          expect(checked.kind).toBe("failure");
          expect(checked.diagnostics.map((diagnostic) => diagnostic.code)).toContain("E10277");
          const built = await buildProject({ project, optimization: "none" });
          expect(built.kind).toBe("failure");
          expect(built.diagnostics.map((diagnostic) => diagnostic.code)).toContain("E10277");
          expect(built).not.toHaveProperty("generation");
        },
      );
    });
  },
);
