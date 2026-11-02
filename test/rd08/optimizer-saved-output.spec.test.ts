import { readFile } from "node:fs/promises";
import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import {
  buildProfileSource,
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "../rd05/profile-fixture.js";
import {
  expectLibraryAccounting,
  libraryEntry,
  libraryFunctionBytes,
  libraryGlobalAddress,
  libraryGlobalIntervals,
  libraryStartup,
  sourceLibraryProfiles,
  withLibraryVice,
} from "../rd05/source-library-fixture.js";
import type { LibraryArtifacts } from "../rd05/source-library-fixture.js";

const savedDeclaration = "let saved: InputSnapshot;";
const keyDeclaration = "let keyResult: InputState;";
const joystickDeclaration = "let joystickResult: InputState;";

/** Read the complete saved-query caller used by the existing input behavior oracles. */
async function savedCallerSource(): Promise<string> {
  return await readFile(
    new URL("../rd05/fixtures/input-saved-caller.blend", import.meta.url),
    "utf8",
  );
}

/** Narrow one public evidence number before using it in arithmetic. */
function integer(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new TypeError(`Expected a nonnegative integral ${label}`);
  return value;
}

/** Escape literal text before using it inside a regular expression. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/** One physical allocation range counted once per resource class. */
interface PhysicalRange {
  readonly start: number;
  readonly end: number;
  readonly resource: "general" | "zeroPage";
}

/**
 * Read every physical interval and prove its internal arithmetic.
 *
 * Stable program globals use $C100-$C104 and $C110-$C11A in the saved caller,
 * so no allocated byte may overlap either reserved range.
 */
function physicalIntervals(artifacts: LibraryArtifacts): {
  intervals: Record<string, unknown>[];
  allocated: PhysicalRange[];
} {
  const intervals = profileRecords(artifacts.memory.intervals);
  expect(intervals.length).toBeGreaterThan(0);
  expect(new Set(intervals.map((interval) => interval.id)).size).toBe(intervals.length);
  const allocated: PhysicalRange[] = [];
  for (const interval of intervals) {
    const start = integer(interval.start, "interval start");
    const end = integer(interval.end, "interval end");
    const size = integer(interval.size, "interval size");
    expect(size).toBe(end - start);
    expect(size).toBe(
      integer(interval.payloadBytes, "payload bytes") +
        integer(interval.paddingBytes, "padding bytes") +
        integer(interval.reservedBytes, "reserved bytes"),
    );
    // The captured platform bytes and the caller's fixed inputs/results stay outside homes.
    expect(end <= 0xc100 || start >= 0xc105).toBe(true);
    expect(end <= 0xc110 || start >= 0xc11b).toBe(true);
    if (interval.resourceClass === "zeroPage") {
      expect(start).toBeGreaterThanOrEqual(0x02);
      expect(end).toBeLessThanOrEqual(0x90);
      allocated.push({ start, end, resource: "zeroPage" });
    } else {
      expect(interval.resourceClass).toBe("general");
      expect(start).toBeGreaterThanOrEqual(0x0801);
      expect(end).toBeLessThanOrEqual(0xd000);
      allocated.push({ start, end, resource: "general" });
    }
  }
  return { intervals, allocated };
}

/** Count each physical byte once, even when several logical aliases name the same home. */
function uniqueResourceBytes(ranges: readonly PhysicalRange[]): {
  general: number;
  zeroPage: number;
} {
  const owned = { general: 0, zeroPage: 0 };
  for (const resource of ["general", "zeroPage"] as const) {
    const sorted = ranges
      .filter((range) => range.resource === resource)
      .sort((left, right) => left.start - right.start);
    let coveredEnd = -1;
    for (const range of sorted) {
      owned[resource] += Math.max(0, range.end - Math.max(range.start, coveredEnd));
      coveredEnd = Math.max(coveredEnd, range.end);
    }
  }
  return owned;
}

/** Read one charged standard resource from the public cost totals. */
function standardResource(artifacts: LibraryArtifacts, id: string): number {
  const resources = profileRecords(profileRecord(artifacts.costs.totals).resources).filter(
    (resource) => resource.kind === "standard" && resource.id === id,
  );
  expect(resources, id).toHaveLength(1);
  return integer(resources[0]!.value, id);
}

/** List every emitted label that resolves to one final address. */
function labelsAtAddress(artifacts: LibraryArtifacts, address: number): string[] {
  return [...artifacts.labels.matchAll(/^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu)]
    .filter((match) => Number.parseInt(match[2]!, 16) === address)
    .map((match) => match[1]!);
}

/** Locate a named emitted routine by its public comment and stop at the next section. */
function routineAssembly(artifacts: LibraryArtifacts, displayName: string): string {
  const marker = `; routine "${displayName}"`;
  const start = artifacts.assembly.indexOf(marker);
  if (start < 0) throw new Error(`Missing emitted routine ${displayName}`);
  const restore = libraryStartup(artifacts, "startup.restore");
  const restoreDefinitions = labelsAtAddress(artifacts, restore).flatMap((label) => {
    const definition = new RegExp(`^\\s*${escapeRegExp(label)}:?\\s*(?:;[^\\n]*)?$`, "mu").exec(
      artifacts.assembly,
    );
    return definition === null ? [] : [definition.index];
  });
  const ends = [
    artifacts.assembly.indexOf("; routine ", start + marker.length),
    artifacts.assembly.indexOf("; bss ", start + marker.length),
    ...restoreDefinitions,
  ].filter((index) => index > start);
  const end = ends.length === 0 ? artifacts.assembly.length : Math.min(...ends);
  return artifacts.assembly.slice(start, end);
}

/** Any absolute reference to the VIC or either CIA in a snapshot query. */
const deviceAddress = /\$(?:d[0-9a-f]{3}|c10[0-2]|c11[0-9a])/iu;

/**
 * The selected register-served fixed-eight copy loop keeps its ordinal in an
 * X or Y register that also addresses the fixed input page and the saved rows.
 * Any canonical up or down counter form is accepted.
 */
function registerServedCopyForms(saved: number): { name: string; bytes: number[] }[] {
  const low = saved & 0xff;
  const high = saved >> 8;
  return [
    {
      name: "X up-counter",
      bytes: [0xa2, 0x00, 0xbd, 0x10, 0xc1, 0x9d, low, high, 0xe8, 0xe0, 0x08, 0xd0, 0xf5],
    },
    {
      name: "X down-counter",
      bytes: [0xa2, 0x08, 0xca, 0xbd, 0x10, 0xc1, 0x9d, low, high, 0xd0, 0xf8],
    },
    {
      name: "Y up-counter",
      bytes: [0xa0, 0x00, 0xb9, 0x10, 0xc1, 0x99, low, high, 0xc8, 0xc0, 0x08, 0xd0, 0xf5],
    },
    {
      name: "Y down-counter",
      bytes: [0xa0, 0x08, 0x88, 0xb9, 0x10, 0xc1, 0x99, low, high, 0xd0, 0xf8],
    },
  ];
}

/**
 * Locate the rejected pointer-driven copy form: an indirect indexed load through
 * a zero-page pointer pair, an index loaded from a zero-page counter, and a store
 * into the saved rows. The returned values are offsets in the function bytes.
 */
function pointerDrivenCopyLoops(bytes: readonly number[], saved: number): number[] {
  const low = saved & 0xff;
  const high = saved >> 8;
  const matches: number[] = [];
  for (let index = 0; index < bytes.length; index += 1) {
    // LDA (zp),Y consumes a two-byte zero-page pointer.
    if (bytes[index] !== 0xb1 || bytes[index + 1] === undefined) continue;
    const window = bytes.slice(index, index + 16);
    const indexFromZeroPage = window.some(
      (opcode, offset) => opcode === 0xa4 && window[offset + 1] !== undefined,
    );
    const storeSavedRow = window.some(
      (opcode, offset) =>
        opcode === 0x99 && window[offset + 1] === low && window[offset + 2] === high,
    );
    if (indexFromZeroPage && storeSavedRow) matches.push(index);
  }
  return matches;
}

/** Locate in-place zero-page counter updates in the same emitted function. */
function zeroPageCounterUpdates(bytes: readonly number[]): number[] {
  return bytes.flatMap((opcode, index) =>
    (opcode === 0xe6 || opcode === 0xc6) && bytes[index + 1] !== undefined ? [index] : [],
  );
}

describe.each(sourceLibraryProfiles)("saved optimizer output on %s", (profile) => {
  it("fits the saved caller within the unchanged payload and RAM ceilings", async () => {
    const source = await savedCallerSource();
    const artifacts = await buildProfileSource(source, profile, "size");
    expectLibraryAccounting(artifacts);
    expect.soft(artifacts.prg.length - 2, "PRG payload").toBeLessThanOrEqual(725);
    expect(artifacts.prg.readUInt16LE(0)).toBe(0x0801);

    const { allocated } = physicalIntervals(artifacts);
    const owned = uniqueResourceBytes(allocated);
    expect.soft(owned.general, "general RAM").toBeLessThanOrEqual(745);
    expect.soft(owned.zeroPage, "zero page RAM").toBeLessThanOrEqual(14);
    expect.soft(owned.general + owned.zeroPage, "combined RAM").toBeLessThanOrEqual(759);

    const routes = profileRecords(artifacts.memory.stackDomains);
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(integer(route.headroomBytes, "stack headroom")).toBeGreaterThanOrEqual(0);
      expect.soft(integer(route.peakBytes, "stack peak"), String(route.id)).toBeLessThanOrEqual(5);
    }
  }, 120_000);

  it("keeps saved bytes and both answers in place without fresh device access", async () => {
    const source = await savedCallerSource();
    const artifacts = await buildProfileSource(source, profile, "size");
    expectLibraryAccounting(artifacts);

    const saved = libraryGlobalAddress(artifacts, source, savedDeclaration, 11, "src/game.blend");
    const key = libraryGlobalAddress(artifacts, source, keyDeclaration, 1, "src/game.blend");
    const joystick = libraryGlobalAddress(
      artifacts,
      source,
      joystickDeclaration,
      1,
      "src/game.blend",
    );
    expect(key < saved || key >= saved + 11).toBe(true);
    expect(joystick < saved || joystick >= saved + 11).toBe(true);
    expect(joystick).not.toBe(key);

    // One stored snapshot object is referenced; no second eleven-byte home exists.
    const { intervals: savedIntervals } = libraryGlobalIntervals(
      artifacts,
      source,
      savedDeclaration,
      "src/game.blend",
    );
    expect(savedIntervals).toHaveLength(1);
    const copied = profileRecords(artifacts.memory.intervals).filter(
      (interval) =>
        interval.id !== savedIntervals[0]!.id &&
        integer(interval.payloadBytes, "payload bytes") === 11 &&
        (interval.kind === "sfa" || interval.kind === "bss"),
    );
    expect(copied, "copied snapshot homes").toEqual([]);

    // A retained snapshot is queried without reading the live VIC or CIA ports.
    for (const name of [
      "c64.input.keyState",
      "c64.input.joystickState",
      "c64.input.snapshotCompatible",
      "c64.input.soleGroundSource",
    ])
      expect(routineAssembly(artifacts, name), name).not.toMatch(deviceAddress);

    const main = routineAssembly(artifacts, "Game.main");
    const savedLabels = labelsAtAddress(artifacts, saved);
    expect(savedLabels.length).toBeGreaterThan(0);
    expect(
      savedLabels.some((label) =>
        new RegExp(`\\bsta[^\\n]*${escapeRegExp(label)}`, "iu").test(main),
      ),
      "in-place snapshot store",
    ).toBe(true);
    expect(main, "key answer store").toMatch(/^\s+sta\s+\$c103\b/imu);
    expect(main, "joystick answer store").toMatch(/^\s+sta\s+\$c104\b/imu);
    // The caller's fixed inputs are read-only and no interrupt or platform state changes.
    expect(main).not.toMatch(/\bsta[^\n]*\$(?:c10[0-2]|c11[0-9a])\b/iu);
    expect(main).not.toMatch(/^\s+(?:sei|cli|php|plp)\b/gimu);
    expect(main).not.toMatch(/\bsta[^\n]*b65_platform_startup_state_/iu);
  }, 120_000);

  it("closes every interval, resource charge, view and stack route exactly", async () => {
    const source = await savedCallerSource();
    const artifacts = await buildProfileSource(source, profile, "size");
    expectLibraryAccounting(artifacts);

    const { intervals, allocated } = physicalIntervals(artifacts);
    const owned = uniqueResourceBytes(allocated);
    // The ceiling counts each physical byte once, so it cannot exceed the charge.
    expect(owned.zeroPage).toBeLessThanOrEqual(standardResource(artifacts, "zeroPage"));
    expect(owned.general).toBeLessThanOrEqual(standardResource(artifacts, "residentRam"));
    expect(integer(profileRecord(artifacts.costs.totals).programBytes, "program bytes")).toBe(
      artifacts.prg.length - 2,
    );

    expect(artifacts.memory).toMatchObject({ profileId: profile, acmeReconciled: true });
    expect(artifacts.memory.sfaClosureSha256).toMatch(/^[0-9a-f]{64}$/);

    for (const view of profileRecords(artifacts.memory.views)) {
      const residencyIds = view.activeResidencyIds;
      if (!Array.isArray(residencyIds)) throw new TypeError("Missing active residencies");
      const active = intervals
        .filter(
          (interval) =>
            interval.addressSpaceId === view.addressSpaceId &&
            interval.bankId === view.bankId &&
            Array.isArray(interval.residencyIds) &&
            interval.residencyIds.some((id: unknown) => residencyIds.includes(id)),
        )
        .map((interval) => ({
          start: Math.max(integer(interval.start, "interval start"), integer(view.start, "view")),
          end: Math.min(integer(interval.end, "interval end"), integer(view.end, "view")),
        }))
        .filter((range) => range.end > range.start)
        .sort((left, right) => left.start - right.start);
      let end = integer(view.start, "view start");
      let occupied = 0;
      for (const range of active) {
        expect(range.start).toBeGreaterThanOrEqual(end);
        occupied += range.end - range.start;
        end = range.end;
      }
      expect(occupied).toBe(integer(view.occupiedBytes, "occupied bytes"));
      expect(occupied + integer(view.freeBytes, "free bytes")).toBe(
        integer(view.capacityBytes, "view capacity"),
      );
    }

    const routes = profileRecords(artifacts.memory.stackDomains);
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      const peak = integer(route.peakBytes, "stack peak");
      const headroom = integer(route.headroomBytes, "stack headroom");
      expect(peak + headroom).toBe(integer(route.capacityBytes, "stack capacity"));
      expect(peak).toBeLessThanOrEqual(5);
    }
  }, 120_000);

  it("emits the register-served fixed-eight copy at its expert machine cost", async () => {
    const source = await savedCallerSource();
    const artifacts = await buildProfileSource(source, profile, "size");
    expectLibraryAccounting(artifacts);
    const saved = libraryGlobalAddress(artifacts, source, savedDeclaration, 11, "src/game.blend");
    const bytes = libraryFunctionBytes(artifacts, "src/game.blend::Game.main");
    const matches = registerServedCopyForms(saved).flatMap((form) =>
      bytes.flatMap((_, index) =>
        form.bytes.every((value, offset) => bytes[index + offset] === value)
          ? [{ form, index }]
          : [],
      ),
    );

    // Negative control: the rejected pointer/counter-driven copy is a different
    // machine form, so one artifact must not present both forms at once.
    const rejected = pointerDrivenCopyLoops(bytes, saved).filter((copy) =>
      zeroPageCounterUpdates(bytes).some((counter) => Math.abs(counter - copy) <= 32),
    );
    expect(matches.length + rejected.length, "observable copy-loop form").toBeGreaterThan(0);
    expect(
      matches.length > 0 && rejected.length > 0,
      "pointer-driven copy is distinguishable from the register-served copy",
    ).toBe(false);

    expect(matches.length, "register-served fixed-eight copy loop").toBeGreaterThan(0);

    // The loop sequence is a real machine interval of the reported function.
    const intervals = profileRecords(artifacts.memory.intervals);
    const mainCode = intervals.filter(
      (interval) =>
        interval.kind === "code" &&
        profileRecord(interval.owner).id === "src/game.blend::Game.main",
    );
    expect(mainCode).toHaveLength(1);
    expect(integer(mainCode[0]!.payloadBytes, "main code bytes")).toBe(bytes.length);
    expect(
      integer(mainCode[0]!.end, "main code end") - integer(mainCode[0]!.start, "main code start"),
    ).toBe(bytes.length);

    // The unchanged zero-page ceiling still allows the ordinary by-reference ABI's
    // pointer pair; the register-served loop form is proved by the machine sequence.
    const codeBytes = intervals
      .filter((interval) => interval.kind === "code")
      .reduce((sum, interval) => sum + integer(interval.payloadBytes, "code bytes"), 0);
    expect(codeBytes).toBe(integer(profileRecord(artifacts.costs.totals).programBytes, "program"));
    const entries = profileRecords(artifacts.costs.entries);
    const programCode = entries.filter(
      (entry) =>
        entry.kind === "bytes" &&
        entry.accounting === "program" &&
        entry.id === "program:program.code",
    );
    const basicStub = entries.filter(
      (entry) =>
        entry.kind === "bytes" &&
        entry.accounting === "program" &&
        entry.id === "program:basic.stub",
    );
    expect(programCode).toHaveLength(1);
    expect(basicStub).toHaveLength(1);
    expect(
      integer(programCode[0]!.bytes, "program code cost") +
        integer(basicStub[0]!.bytes, "basic stub cost"),
    ).toBe(codeBytes);
  }, 120_000);
});

describe("saved optimizer behavior on c64-pal-prg-kernal-6581", () => {
  it("preserves saved bytes, both answers and the caller stack at the public endpoints", async () => {
    const source = await savedCallerSource();
    // One compatible saved observation: DELETE is low in row 0, no joystick switch is low.
    const rows = Uint8Array.of(0xfe, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff);
    const snapshot = Uint8Array.from([...rows, 0xff, 0xff, 0x00]);

    await withProfileProject(source, "c64-pal-prg-kernal-6581", async (project) => {
      const checked = await checkProject({ project });
      expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
      if (checked.kind !== "success") throw new Error("Expected legal saved caller source");
      const built = await buildProject({ project, optimization: "size" });
      expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
      if (built.kind !== "success") throw new Error("Expected a complete saved caller build");
      const artifacts = await readProfileArtifacts(built);
      expectLibraryAccounting(artifacts);

      const saved = libraryGlobalAddress(artifacts, source, savedDeclaration, 11, "src/game.blend");
      const main = libraryEntry(artifacts, "src/game.blend::Game.main");
      const keyState = libraryEntry(
        artifacts,
        "@blend65/stdlib/c64/input.blend::c64.input.keyState",
      );
      const restore = libraryStartup(artifacts, "startup.restore");

      await withLibraryVice(
        built,
        artifacts,
        "c64-pal-prg-kernal-6581",
        async (monitor, stopAt) => {
          // Legal caller inputs arrive before the caller copies them into its saved object.
          await monitor.writeMemory(0xc100, Uint8Array.of(0, 1, 0));
          await monitor.writeMemory(0xc110, rows);
          await monitor.writeMemory(0xc118, Uint8Array.of(0xff, 0xff, 0x00));
          await stopAt(main);
          const entry = await monitor.readCpuRegisters();

          // The saved caller fills its snapshot with peeks, not readInputSnapshot.
          // Disable external IRQ sources here so later tracepoints observe compiled code only.
          await monitor.writeIo(0xdc0d, Uint8Array.of(0x7f));
          await monitor.writeIo(0xdd0d, Uint8Array.of(0x7f));
          await monitor.writeIo(0xd01a, Uint8Array.of(0x00));

          const device: number[] = [];
          for (const base of [0xdc00, 0xdd00])
            for (let offset = 0; offset < 4; offset += 1) {
              device.push(await monitor.setAccessTracepoint(base + offset, "load"));
              device.push(await monitor.setAccessTracepoint(base + offset, "store"));
            }
          for (let address = 0xd000; address <= 0xd02e; address += 1) {
            device.push(await monitor.setAccessTracepoint(address, "load"));
            device.push(await monitor.setAccessTracepoint(address, "store"));
          }
          monitor.takeCheckpointHits();

          const savedStores: number[] = [];
          try {
            // The setup copy has completed; the two pure queries may only read the snapshot.
            await stopAt(keyState);
            expect(await monitor.readMemory(saved, saved + 10)).toEqual(snapshot);
            for (let offset = 0; offset < 11; offset += 1)
              savedStores.push(await monitor.setAccessTracepoint(saved + offset, "store"));
            monitor.takeCheckpointHits();

            await stopAt(restore);
            const after = await monitor.readCpuRegisters();
            const hits = monitor.takeCheckpointHits();
            expect(
              hits.filter((hit) => device.includes(hit)),
              "fresh device access",
            ).toEqual([]);
            expect(
              hits.filter((hit) => savedStores.includes(hit)),
              "snapshot rewrites",
            ).toEqual([]);
            expect(await monitor.readMemory(saved, saved + 10)).toEqual(snapshot);
            expect([...(await monitor.readMemory(0xc103, 0xc104))]).toEqual([0, 1]);
            expect(after.sp, "caller stack balance").toBe(entry.sp);
          } finally {
            for (const checkpoint of [...device, ...savedStores])
              await monitor.deleteCheckpoint(checkpoint);
          }
        },
      );
    });
  }, 300_000);
});
