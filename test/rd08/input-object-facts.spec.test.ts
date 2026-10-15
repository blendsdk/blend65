import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import {
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "../rd05/profile-fixture.js";
import {
  expectLibraryAccounting,
  libraryEntry,
  libraryFunctionBytes,
  libraryStartup,
  sourceLibraryProfiles,
  withLibraryVice,
} from "../rd05/source-library-fixture.js";
import type { LibraryArtifacts } from "../rd05/source-library-fixture.js";
import type { ViceMonitor } from "../m1/vice-monitor.js";

const modes = ["none", "size"] as const;
const declarations = `module Game;
struct Pair { a: byte; b: byte; }
place(at: $3200) let item: Pair;
place(at: $3400) let answers: byte[8] = [; 0];
`;

/** Read one charged standard resource without accepting missing or duplicate evidence. */
function resourceValue(artifacts: LibraryArtifacts, id: string): number {
  const resources = profileRecords(profileRecord(artifacts.costs.totals).resources).filter(
    (resource) => resource.kind === "standard" && resource.id === id,
  );
  expect(resources, id).toHaveLength(1);
  const value = resources[0]!.value;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0)
    throw new TypeError("Charged resources must be nonnegative integers");
  return value;
}

/** Build legal source and keep its exact generation alive for sequential runtime observations. */
async function inspectObject(
  source: string,
  profile: (typeof sourceLibraryProfiles)[number],
  mode: (typeof modes)[number],
  inspect: (
    artifacts: LibraryArtifacts,
    monitor: ViceMonitor,
    finish: () => Promise<void>,
  ) => Promise<void>,
  prepare?: (monitor: ViceMonitor) => Promise<void>,
): Promise<void> {
  await withProfileProject(source, profile, async (project) => {
    const checked = await checkProject({ project });
    expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
    if (checked.kind !== "success") throw new Error("Expected legal fixed-object source");
    const built = await buildProject({ project, optimization: mode });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error("Expected a complete fixed-object build");
    const artifacts = await readProfileArtifacts(built);
    expectLibraryAccounting(artifacts);
    for (const id of ["zeroPage", "residentRam", "hardwareStack", "scratch"])
      resourceValue(artifacts, id);
    // These records cover bounded generated routes; they do not prove external NMI behavior.
    for (const domain of profileRecords(artifacts.memory.stackDomains)) {
      const { peakBytes, headroomBytes, capacityBytes } = domain;
      for (const value of [peakBytes, headroomBytes, capacityBytes])
        expect(Number.isInteger(value) && typeof value === "number" && value >= 0).toBe(true);
      if (
        typeof peakBytes !== "number" ||
        typeof headroomBytes !== "number" ||
        typeof capacityBytes !== "number"
      )
        throw new TypeError("Stack domains require numeric capacity evidence");
      expect(peakBytes + headroomBytes).toBe(capacityBytes);
      expect(peakBytes).toBeLessThanOrEqual(capacityBytes);
    }
    await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
      await monitor.writeMemory(0x3200, Uint8Array.of(7, 9));
      await prepare?.(monitor);
      await stopAt(libraryEntry(artifacts, "src/game.blend::Game.main"));
      await inspect(artifacts, monitor, () => stopAt(libraryStartup(artifacts, "startup.restore")));
    });
  });
}

describe.each(sourceLibraryProfiles)("fixed object facts on %s", (profile) => {
  it.each(modes)(
    "should read runtime fields through two ordinary forwarding parameters in %s mode",
    async (mode) => {
      // A readonly borrow preserves the actual object identity without copying its bytes.
      const source = `${declarations}
function first(p: const Pair): byte { return p.a; }
function second(p: const Pair): byte { return p.b; }
function forward(p: const Pair): byte { return first(p); }
function outer(p: const Pair): byte { return forward(p); }
function effect(value: byte): byte {
  answers[2] = answers[2] * 10 + value;
  return value;
}
function combine(left: byte, right: byte): byte { return left * 10 + right; }
function main(): void {
  answers[0] = outer(item);
  answers[1] = second(item);
  answers[3] = combine(effect(1), effect(2));
}`;
      await inspectObject(source, profile, mode, async (artifacts, monitor, finish) => {
        const loads = [
          await monitor.setAccessTracepoint(0x3200, "load"),
          await monitor.setAccessTracepoint(0x3201, "load"),
        ];
        const stores = [
          await monitor.setAccessTracepoint(0x3200, "store"),
          await monitor.setAccessTracepoint(0x3201, "store"),
        ];
        monitor.takeCheckpointHits();
        await finish();
        expect([...(await monitor.readMemory(0x3400, 0x3403))]).toEqual([7, 9, 12, 12]);
        const hits = monitor.takeCheckpointHits();
        expect(hits.filter((hit) => loads.includes(hit))).toEqual(loads);
        expect(hits.filter((hit) => stores.includes(hit))).toEqual([]);
        if (mode === "size") {
          // LDA absolute followed by RTS is four bytes and ten nominal NMOS cycles.
          expect(libraryFunctionBytes(artifacts, "src/game.blend::Game.first")).toEqual([
            0xad, 0, 0x32, 0x60,
          ]);
          expect(libraryFunctionBytes(artifacts, "src/game.blend::Game.second")).toEqual([
            0xad, 1, 0x32, 0x60,
          ]);
        }
      });
    },
    300_000,
  );

  it.each(modes)(
    "should keep differing objects and an address-taken entry callable in %s mode",
    async (mode) => {
      // Neither a shared callee nor its callable entry may assume one caller's root.
      const source = `${declarations}
place(at: $3300) let other: Pair;
let read: fn(const Pair): byte = &first;
function first(p: const Pair): byte { return p.a; }
function main(): void {
  answers[0] = first(item);
  answers[1] = first(other);
  answers[2] = read(item);
  answers[3] = read(other);
}`;
      await inspectObject(
        source,
        profile,
        mode,
        async (artifacts, monitor, finish) => {
          await finish();
          expect([...(await monitor.readMemory(0x3400, 0x3403))]).toEqual([7, 31, 7, 31]);
          const bytes = libraryFunctionBytes(artifacts, "src/game.blend::Game.first");
          expect(bytes).not.toEqual([0xad, 0, 0x32, 0x60]);
          expect(bytes).not.toEqual([0xad, 0, 0x33, 0x60]);
          expect(resourceValue(artifacts, "zeroPage")).toBeGreaterThanOrEqual(2);
        },
        async (monitor) => {
          await monitor.writeMemory(0x3300, Uint8Array.of(31, 47));
        },
      );
    },
    300_000,
  );

  it.each(modes)(
    "should preserve a crossing field and member or unsized borrows in %s mode",
    async (mode) => {
      // These are legal borrowed actuals even when fixed whole-object selection is unavailable.
      const source = `${declarations}
place(at: $32FF) let rows: Pair[2];
function first(p: const Pair): byte { return p.a; }
function unsized(p: const Pair[]): byte { return p[1].b; }
function main(): void {
  answers[7] = peek($C110);
  answers[0] = rows[answers[7]].b;
  answers[1] = first(rows[1]);
  answers[2] = unsized(rows);
}`;
      await inspectObject(
        source,
        profile,
        mode,
        async (artifacts, monitor, finish) => {
          await finish();
          expect([...(await monitor.readMemory(0x3400, 0x3402))]).toEqual([9, 7, 9]);
          expect([...(await monitor.readMemory(0x32ff, 0x3302))]).toEqual([3, 5, 7, 9]);
          expect(libraryFunctionBytes(artifacts, "src/game.blend::Game.first")).not.toEqual([
            0xad, 1, 0x33, 0x60,
          ]);
        },
        async (monitor) => {
          await monitor.writeMemory(0x32ff, Uint8Array.of(3, 5, 7, 9));
          await monitor.writeMemory(0xc110, Uint8Array.of(1));
        },
      );
    },
    300_000,
  );

  it.each(modes)(
    "should retain a captured readonly field across mutation of its actual in %s mode",
    async (mode) => {
      // The qualifier limits writes through the parameter, not writes through another alias.
      const source = `${declarations}
function capture(p: const Pair): byte {
  let before: byte = p.a;
  item.a = 42;
  return before;
}
function main(): void { answers[0] = capture(item); answers[1] = item.a; }`;
      await inspectObject(source, profile, mode, async (_artifacts, monitor, finish) => {
        await finish();
        expect([...(await monitor.readMemory(0x3400, 0x3401))]).toEqual([7, 42]);
        expect([...(await monitor.readMemory(0x3200, 0x3201))]).toEqual([42, 9]);
      });
    },
    300_000,
  );

  it.each(modes)(
    "should retain a captured field across an unknown-address write in %s mode",
    async (mode) => {
      // A runtime raw address can alias the borrowed object, so the captured byte must survive.
      const source = `${declarations}
function capture(p: const Pair): byte {
  let before: byte = p.a;
  poke(peekw($C110), 42);
  return before;
}
function main(): void { answers[0] = capture(item); answers[1] = item.a; }`;
      await inspectObject(source, profile, mode, async (_artifacts, monitor, finish) => {
        await monitor.writeMemory(0xc110, Uint8Array.of(0, 0x32));
        await finish();
        expect([...(await monitor.readMemory(0x3400, 0x3401))]).toEqual([7, 42]);
        expect([...(await monitor.readMemory(0x3200, 0x3201))]).toEqual([42, 9]);
      });
    },
    300_000,
  );

  it.each(modes)(
    "should construct a returned pair through the same outer destination in %s mode",
    async (mode) => {
      // Ordinary result forwarding can encode the unique caller-owned destination.
      const source = `${declarations}
function make(): Pair { return { a: 7, b: 9 }; }
function outer(): Pair { return make(); }
function main(): void { item = outer(); }`;
      await inspectObject(
        source,
        profile,
        mode,
        async (artifacts, monitor, finish) => {
          await finish();
          expect([...(await monitor.readMemory(0x3200, 0x3201))]).toEqual([7, 9]);
          if (mode === "size") {
            // Two immediate/absolute store pairs plus RTS cost eleven bytes and eighteen cycles.
            expect(libraryFunctionBytes(artifacts, "src/game.blend::Game.make")).toEqual([
              0xa9, 7, 0x8d, 0, 0x32, 0xa9, 9, 0x8d, 1, 0x32, 0x60,
            ]);
            const privateStorage = profileRecords(artifacts.memory.intervals).filter((interval) => {
              if (!["sfa", "zeroPage", "scratch"].includes(String(interval.kind))) return false;
              const owner = profileRecord(interval.owner);
              return owner.kind === "function" || owner.kind === "helper";
            });
            expect(privateStorage).toEqual([]);
            expect(resourceValue(artifacts, "zeroPage")).toBe(0);
          }
        },
        async (monitor) => {
          await monitor.writeMemory(0x3200, Uint8Array.of(5, 6));
        },
      );
    },
    300_000,
  );

  it.each(modes)(
    "should preserve old destination observations until the outer return publishes in %s mode",
    async (mode) => {
      // An inner return cannot publish early when the outer caller observes the old object.
      const source = `${declarations}
function make(): Pair { return { a: 7, b: 9 }; }
function outer(): Pair {
  let value: Pair = make();
  answers[0] = peek(&item.a);
  answers[1] = item.b;
  poke($C100, 21);
  poke($C110, 34);
  return value;
}
function main(): void { item = outer(); }`;
      await inspectObject(
        source,
        profile,
        mode,
        async (_artifacts, monitor, finish) => {
          const rawStores = [
            await monitor.setAccessTracepoint(0xc100, "store"),
            await monitor.setAccessTracepoint(0xc110, "store"),
          ];
          monitor.takeCheckpointHits();
          await finish();
          expect([...(await monitor.readMemory(0x3400, 0x3401))]).toEqual([5, 6]);
          expect([...(await monitor.readMemory(0x3200, 0x3201))]).toEqual([7, 9]);
          expect([...(await monitor.readMemory(0xc100, 0xc100))]).toEqual([21]);
          expect([...(await monitor.readMemory(0xc110, 0xc110))]).toEqual([34]);
          expect(monitor.takeCheckpointHits().filter((hit) => rawStores.includes(hit))).toEqual(
            rawStores,
          );
        },
        async (monitor) => {
          await monitor.writeMemory(0x3200, Uint8Array.of(5, 6));
        },
      );
    },
    300_000,
  );

  it.each(modes)(
    "should preserve overlapping return values and distinct nested results in %s mode",
    async (mode) => {
      // Returning into the borrowed object must snapshot values before overwriting them.
      const source = `${declarations}
function swap(p: const Pair): Pair { return { a: p.b, b: p.a }; }
function make(early: boolean): Pair {
  if (early) { return { a: 11, b: 13 }; }
  return { a: 17, b: 19 };
}
function combine(left: const Pair, right: const Pair): byte { return left.a + right.b; }
function main(): void {
  item = swap(item);
  answers[0] = item.a;
  answers[1] = item.b;
  answers[2] = combine(make(true), make(false));
}`;
      await inspectObject(source, profile, mode, async (_artifacts, monitor, finish) => {
        await finish();
        expect([...(await monitor.readMemory(0x3400, 0x3402))]).toEqual([9, 7, 30]);
        expect([...(await monitor.readMemory(0x3200, 0x3201))]).toEqual([9, 7]);
      });
    },
    300_000,
  );
});
