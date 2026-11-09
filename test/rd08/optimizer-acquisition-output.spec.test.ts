import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildProfileSource, profileRecord, profileRecords } from "../rd05/profile-fixture.js";
import {
  expectLibraryAccounting,
  libraryFunctionBytes,
  libraryGlobalAddress,
  libraryGlobalIntervals,
  libraryStartup,
  sourceLibraryProfiles,
} from "../rd05/source-library-fixture.js";
import type { LibraryArtifacts } from "../rd05/source-library-fixture.js";

const savedDeclaration = "let saved: InputSnapshot;";
const keyDeclaration = "let keyResult: InputState;";
const joystickDeclaration = "let joystickResult: InputState;";
const acquisitionFunction = "@blend65/stdlib/c64/input.blend::c64.input.readInputSnapshot";
const callbackFunction = "@blend65/stdlib/c64/input.blend::c64.input.interruptScan";
const inputLibraryId = "@blend65/stdlib/c64/input.blend";
const flagDeclaration = "let scanInterrupted: byte;";

/** Read the complete ordinary caller used by the acquisition behavior oracles. */
async function acquisitionCallerSource(): Promise<string> {
  return await readFile(new URL("../rd05/fixtures/input-caller.blend", import.meta.url), "utf8");
}

/** Read the installed input library so its public global declaration can be located. */
async function inputLibrarySource(): Promise<string> {
  return await readFile(
    new URL("../../packages/compiler/stdlib/c64/input.blend", import.meta.url),
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
 * The caller reserves $C100-$C104 for raw inputs and observable answers, so no
 * allocated byte may overlap that range.
 */
function physicalIntervals(artifacts: LibraryArtifacts): {
  intervals: Record<string, unknown>[];
  allocated: PhysicalRange[];
} {
  const imageEnd = 0x0801 + artifacts.prg.length - 2;
  const intervals = profileRecords(artifacts.memory.intervals).filter(
    (interval) => interval.addressSpaceId === "cpu16" && interval.kind !== "reservation",
  );
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
    expect(end <= 0xc100 || start >= 0xc105).toBe(true);
    if (interval.resourceClass === "zeroPage") {
      expect(start).toBeGreaterThanOrEqual(0x02);
      expect(end).toBeLessThanOrEqual(0x90);
      allocated.push({ start, end, resource: "zeroPage" });
    } else {
      expect(interval.resourceClass).toBe("general");
      expect(start).toBeGreaterThanOrEqual(0x0801);
      expect(end).toBeLessThanOrEqual(0xd000);
      if (["bss", "global", "sfa", "scratch"].includes(String(interval.kind)))
        expect(start).toBeGreaterThanOrEqual(imageEnd);
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

/** One ordered CIA1 bus access emitted inside the acquisition routine. */
interface CiaAccess {
  readonly operation: "read" | "write";
  readonly address: number;
}

/** Every ordinary read or write mnemonic that names a CIA1 port or control register. */
const ciaRead = "(?:lda|ldx|ldy|ora|and|eor|adc|sbc|cmp|cpx|cpy|bit)";
const ciaWrite = "(?:sta|stx|sty)";
const ciaRegister = "\\$(dc0[0-3]|dc0e|dc0f)\\b";

/**
 * Read the acquisition routine's CIA1 accesses in emitted order.
 *
 * The acquisition samples the keyboard matrix through CIA1 ports A and B and
 * reads both timer control registers before changing any port direction.
 * Counting the emitted instructions keeps the device count and order
 * independent of instruction-byte offsets.
 */
function cia1Accesses(routine: string): CiaAccess[] {
  const pattern = new RegExp(
    `^\\s+(?:(?<read>${ciaRead})|(?<write>${ciaWrite}))(?:\\+\\d+|-\\d+)?\\s+${ciaRegister}`,
    "gimu",
  );
  return [...routine.matchAll(pattern)].map((match) => ({
    operation: match.groups?.read === undefined ? "write" : "read",
    address: Number.parseInt(match[3]!, 16),
  }));
}

/** One emitted fixed loop whose body performs CIA1 accesses. */
interface Cia1Loop {
  readonly start: number;
  readonly headerEnd: number;
  readonly bodyStart: number;
  readonly end: number;
  readonly trips: number;
}

/** Locate the fixed eight-iteration row scan when it is emitted as a loop. */
function cia1Loops(lines: readonly string[]): Cia1Loop[] {
  const loops: Cia1Loop[] = [];
  const definition = (label: string) =>
    lines.findIndex((line) => new RegExp(`^\\s*${escapeRegExp(label)}:`).test(line));
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^\s*(?:b\w+|jmp)(?:\+\d+|-\d+)?\s+(\S+)\s*$/u.exec(lines[index]!);
    if (match === null) continue;
    const start = definition(match[1]!);
    if (start < 0 || start >= index) continue;
    const body = lines.slice(start, index + 1).join("\n");
    if (cia1Accesses(body).length === 0) continue;
    // The keyboard matrix always scans exactly eight rows.
    if (!/#\$0?8\b/iu.test(body)) continue;
    // A top-tested loop places its exit block between the guard and the body.
    // Repeat only the condition header and the guarded body, not the exit.
    let headerEnd = start - 1;
    let bodyStart = start;
    for (let branch = start; branch < index; branch += 1) {
      const guard = /^\s*(?:b\w+)(?:\+\d+|-\d+)?\s+(\S+)\s*$/u.exec(lines[branch]!);
      if (guard === null) continue;
      const target = definition(guard[1]!);
      if (target > branch && target <= index) {
        headerEnd = branch;
        bodyStart = target;
        break;
      }
    }
    loops.push({ start, headerEnd, bodyStart, end: index, trips: 8 });
  }
  return loops;
}

/**
 * Count CIA1 accesses on the normal transaction, expanding the row loop once.
 *
 * The eight-row scan may be unrolled, in which case every drive/read pair is
 * emitted separately, or written as one loop bounded by eight. Both forms must
 * produce the same normal-path device traffic and bus order.
 */
function normalPathCia1Accesses(routine: string): CiaAccess[] {
  const lines = routine.split("\n");
  const loops = cia1Loops(lines);
  const accesses: CiaAccess[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const loop = loops.find((candidate) => candidate.start === index);
    if (loop !== undefined) {
      const header = cia1Accesses(lines.slice(loop.start, loop.headerEnd + 1).join("\n"));
      const body = cia1Accesses(lines.slice(loop.bodyStart, loop.end + 1).join("\n"));
      const exit = cia1Accesses(lines.slice(loop.headerEnd + 1, loop.bodyStart).join("\n"));
      // A top-tested loop runs header and body per iteration, then its exit
      // block once. Assembly order alone would place the exit before the body.
      for (let trip = 0; trip < loop.trips; trip += 1) accesses.push(...header, ...body);
      accesses.push(...exit);
      index = loop.end;
      continue;
    }
    accesses.push(...cia1Accesses(lines[index]!));
  }
  return accesses;
}

/** List any read-modify-write instruction applied directly to a CIA1 port. */
function cia1ReadModifyWrites(routine: string): string[] {
  return [
    ...routine.matchAll(/^\s+(inc|dec|asl|lsr|rol|ror)(?:\+\d+|-\d+)?\s+\$dc0[0-3]\b/gimu),
  ].map((match) => match[1]!);
}

/** Index of the first conditional branch, or -1 when the routine has none. */
function conditionalBranchIndex(routine: string): number {
  return routine.search(/^\s+(?:beq|bne|bcc|bcs|bmi|bpl|bvc|bvs)\b/imu);
}

/** Store opcodes whose final operand is one absolute home or indexed base. */
const directStoreOpcodes = new Set([0x8c, 0x8d, 0x8e, 0x99, 0x9d]);

/** Locate direct stores whose absolute operand falls in one half-open byte range. */
function directStoresWithin(bytes: readonly number[], start: number, end: number): number[] {
  const targets: number[] = [];
  for (let index = 0; index + 2 < bytes.length; index += 1) {
    if (!directStoreOpcodes.has(bytes[index]!)) continue;
    const address = bytes[index + 1]! | (bytes[index + 2]! << 8);
    if (address >= start && address < end) targets.push(address);
  }
  return targets;
}

/**
 * Detect an aggregate copy through an indirect destination pointer.
 *
 * `STA (zeroPage),Y` inside a counted loop is the machine form that copies a
 * finished result into a caller-owned destination. An in-place return writes
 * the snapshot home directly and never needs that pointer.
 */
function indirectDestinationCopy(bytes: readonly number[]): boolean {
  for (let index = 0; index + 1 < bytes.length; index += 1) {
    if (bytes[index] !== 0x91) continue; // STA (zeroPage),Y
    const operand = bytes[index + 1]!;
    if (operand >= 0x90) continue;
    const from = Math.max(0, index - 6);
    const window = bytes.slice(from, Math.min(bytes.length, index + 10));
    const indexedLoad = window.some(
      (opcode) => opcode === 0xb1 || opcode === 0xb9 || opcode === 0xbd,
    );
    const counterStep = window.some(
      (opcode) => opcode === 0xc8 || opcode === 0xe8 || opcode === 0x88 || opcode === 0xca,
    );
    const backwardBranch = window.some(
      (opcode) =>
        opcode === 0xd0 || opcode === 0x10 || opcode === 0x30 || opcode === 0x90 || opcode === 0xb0,
    );
    if (indexedLoad && counterStep && backwardBranch) return true;
  }
  return false;
}

describe.each(sourceLibraryProfiles)("acquisition optimizer output on %s", (profile) => {
  it("fits the complete caller within the unchanged acquisition ceilings", async () => {
    const source = await acquisitionCallerSource();
    const artifacts = await buildProfileSource(source, profile, "size");
    expectLibraryAccounting(artifacts);
    expect.soft(artifacts.prg.length - 2, "PRG payload").toBeLessThanOrEqual(963);
    expect(artifacts.prg.readUInt16LE(0)).toBe(0x0801);
    expect([...artifacts.prg.subarray(2, 14)]).toEqual([
      0x0b, 0x08, 0x0a, 0, 0x9e, 0x32, 0x30, 0x36, 0x31, 0, 0, 0,
    ]);

    const { allocated } = physicalIntervals(artifacts);
    const owned = uniqueResourceBytes(allocated);
    expect.soft(owned.general, "general RAM").toBeLessThanOrEqual(984);
    expect.soft(owned.zeroPage, "zero page RAM").toBeLessThanOrEqual(14);
    expect.soft(owned.general + owned.zeroPage, "combined RAM").toBeLessThanOrEqual(998);

    const routes = profileRecords(artifacts.memory.stackDomains);
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(integer(route.headroomBytes, "stack headroom")).toBeGreaterThanOrEqual(0);
      expect.soft(integer(route.peakBytes, "stack peak"), String(route.id)).toBeLessThanOrEqual(10);
    }
    expect(artifacts.debug).toMatchObject({ profileId: profile, optimization: "size" });
    expect(artifacts.costs.mode).toBe("size");
  }, 120_000);

  it("keeps the raw acquisition, in-place snapshot and scoped NMI obligations", async () => {
    const source = await acquisitionCallerSource();
    const library = await inputLibrarySource();
    const artifacts = await buildProfileSource(source, profile, "size");
    expectLibraryAccounting(artifacts);

    const acquisition = routineAssembly(artifacts, "c64.input.readInputSnapshot");
    const bytes = libraryFunctionBytes(artifacts, acquisitionFunction);

    // One complete normal transaction reads CIA1 fourteen times and writes it
    // fifteen times. The timer guard leaves both control registers unchanged.
    const accesses = normalPathCia1Accesses(acquisition);
    const reads = accesses.filter((access) => access.operation === "read").map((a) => a.address);
    const writes = accesses.filter((access) => access.operation === "write").map((a) => a.address);
    expect(reads).toEqual([
      0xdc0e,
      0xdc0f,
      0xdc02,
      0xdc03,
      0xdc01,
      0xdc00,
      ...Array.from({ length: 8 }, () => 0xdc01),
    ]);
    expect(writes).toHaveLength(15);
    expect(writes.filter((address) => address === 0xdc00)).toHaveLength(11);
    expect(writes.filter((address) => address === 0xdc02)).toHaveLength(2);
    expect(writes.filter((address) => address === 0xdc03)).toHaveLength(2);
    expect(writes[0]).toBe(0xdc00);
    expect(writes.slice(-2)).toEqual([0xdc02, 0xdc03]);
    expect(cia1ReadModifyWrites(acquisition)).toEqual([]);

    const branch = conditionalBranchIndex(acquisition);
    expect(branch).toBeGreaterThanOrEqual(0);
    expect(cia1Accesses(acquisition.slice(0, branch))).toEqual([
      { operation: "read", address: 0xdc0e },
      { operation: "read", address: 0xdc0f },
    ]);
    // Acquisition never reaches CIA2; bank selection belongs to startup.
    expect(acquisition).not.toMatch(/^\s+(?:lda|sta)(?:\+\d+)?\s+\$dd0[0-9a-f]\b/imu);

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
        ["bss", "global", "sfa", "scratch"].includes(String(interval.kind)),
    );
    expect(copied, "copied snapshot homes").toEqual([]);

    // The snapshot is constructed in the caller's global home. A destination
    // pointer copy is not part of the in-place return.
    expect(
      directStoresWithin(bytes, saved, saved + 11),
      "direct snapshot construction",
    ).not.toEqual([]);
    expect(directStoresWithin(bytes, saved + 10, saved + 11), "quality byte store").not.toEqual([]);
    expect(indirectDestinationCopy(bytes), "indirect destination copy").toBe(false);

    const flag = libraryGlobalAddress(artifacts, library, flagDeclaration, 1, inputLibraryId);
    const flagLabels = labelsAtAddress(artifacts, flag);
    expect(flagLabels.length).toBeGreaterThan(0);
    expect(flag < saved || flag >= saved + 11).toBe(true);

    const callback = profileRecords(artifacts.debug.functions).filter(
      (fn) => fn.qualifiedName === callbackFunction,
    );
    expect(callback).toHaveLength(1);
    expect(callback[0]!.kind).toBe("interrupt");
    expect(profileRecords(callback[0]!.entryVariants)).toHaveLength(1);

    const callbackBytes = libraryFunctionBytes(artifacts, callbackFunction);
    // The scoped NMI sets the shared interruption flag and restores idle columns
    // without touching the stored snapshot.
    expect(directStoresWithin(callbackBytes, flag, flag + 1), "interruption flag").not.toEqual([]);
    expect(directStoresWithin(callbackBytes, saved, saved + 11), "NMI snapshot writes").toEqual([]);
    expect(
      [...callbackBytes.keys()].some((index) =>
        [0xa9, 0x7f, 0x8d, 0x00, 0xdc].every(
          (value, offset) => callbackBytes[index + offset] === value,
        ),
      ),
      "idle column restore",
    ).toBe(true);

    const flagRead = new RegExp(
      `^\\s+lda(?:\\+\\d+|-\\d+)?\\s+(?:${flagLabels
        .map(escapeRegExp)
        .join("|")}|\\$${flag.toString(16)})\\b`,
      "mu",
    );
    expect(acquisition).toMatch(flagRead);
    const flagReadIndex = acquisition.search(flagRead);
    const restoreIndex = [...acquisition.matchAll(/^\s+sta(?:\+\d+|-\d+)?\s+\$0319\b/gimu)].at(
      -1,
    )?.index;
    expect(restoreIndex).toBeDefined();
    // The flag is sampled only after the prior NMI owner is released, so a late
    // interrupt cannot be lost between the read and the link restoration.
    expect(flagReadIndex).toBeGreaterThan(restoreIndex!);

    const linkStores = [
      ...artifacts.assembly.matchAll(/^\s+sta(?:\+\d+|-\d+)?\s+\$(0318|0319)\b/gimu),
    ].map((match) => match[1]!);
    // The scoped callback shares the KERNAL NMI low byte, so the install and
    // restore rewrite only the high link byte.
    expect(linkStores).toEqual(["0319", "0319"]);
    expect(artifacts.assembly).toMatch(/^\s+lda(?:\+\d+|-\d+)?\s+\$0318\b/imu);
    expect(artifacts.assembly).toMatch(/^\s+lda(?:\+\d+|-\d+)?\s+\$0319\b/imu);
    expect(artifacts.assembly).not.toMatch(/^\s+sta(?:\+\d+|-\d+)?\s+\$fffa\b/imu);
    expect(artifacts.assembly).not.toMatch(/^\s+sta(?:\+\d+|-\d+)?\s+\$fffb\b/imu);

    const nmiRoutes = profileRecords(artifacts.memory.stackDomains).filter((route) => {
      const id = String(route.id).toLowerCase();
      const components = Array.isArray(route.route) ? route.route.map(String) : [];
      return id.includes("nmi") || components.some((part) => part.toLowerCase().includes("nmi"));
    });
    expect(nmiRoutes.length).toBeGreaterThan(0);
    for (const route of nmiRoutes)
      expect(integer(route.peakBytes, "NMI stack peak"), String(route.id)).toBeLessThanOrEqual(10);

    const main = routineAssembly(artifacts, "Game.main");
    for (const address of [0xc100, 0xc101, 0xc102])
      expect(main, `input $${address.toString(16)}`).toMatch(
        new RegExp(`^\\s+lda(?:\\+\\d+|-\\d+)?\\s+\\$${address.toString(16)}\\b`, "mu"),
      );
    for (const address of [0xc103, 0xc104]) {
      const stores = [
        ...artifacts.assembly.matchAll(
          new RegExp(`^\\s+sta(?:\\+\\d+|-\\d+)?\\s+\\$${address.toString(16)}\\b`, "gimu"),
        ),
      ];
      expect(stores, `answer $${address.toString(16)}`).toHaveLength(1);
    }
    // Raw inputs stay read-only; only the two answer endpoints are written.
    expect(artifacts.assembly).not.toMatch(/^\s+sta(?:\+\d+|-\d+)?\s+\$c10[0-2]\b/imu);
  }, 120_000);

  it("closes every interval, view, stack route and resource charge exactly", async () => {
    const source = await acquisitionCallerSource();
    const artifacts = await buildProfileSource(source, profile, "size");
    expectLibraryAccounting(artifacts);

    const { intervals, allocated } = physicalIntervals(artifacts);
    const owned = uniqueResourceBytes(allocated);
    // The ceiling counts each physical byte once, so it cannot exceed the charge.
    expect(owned.zeroPage).toBeLessThanOrEqual(standardResource(artifacts, "zeroPage"));
    expect(owned.general).toBeLessThanOrEqual(standardResource(artifacts, "residentRam"));
    const totals = profileRecord(artifacts.costs.totals);
    expect(integer(totals.programBytes, "program bytes")).toBe(artifacts.prg.length - 2);

    const resources = profileRecords(totals.resources);
    expect(resources.map((resource) => resource.id).sort()).toEqual(
      ["zeroPage", "residentRam", "hardwareStack", "scratch"].sort(),
    );
    for (const resource of resources) {
      const value = integer(resource.value, String(resource.id));
      expect(resource.kind, String(resource.id)).toBe("standard");
      if (resource.id === "zeroPage") expect(value, "zero page charge").toBeLessThanOrEqual(14);
      if (resource.id === "hardwareStack")
        expect(value, "generated stack charge").toBeLessThanOrEqual(10);
    }

    expect(artifacts.memory).toMatchObject({ profileId: profile, acmeReconciled: true });
    expect(artifacts.memory.sfaClosureSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(profileRecords(artifacts.memory.unboundedEffects).length).toBeGreaterThan(0);
    expect(artifacts.memory.runtimeMemorySafety).toBe("unproven");

    const viewIntervals = artifacts.memory.intervals as Record<string, unknown>[];
    for (const view of profileRecords(artifacts.memory.views)) {
      const residencyIds = view.activeResidencyIds;
      if (!Array.isArray(residencyIds)) throw new TypeError("Missing active residencies");
      const active = viewIntervals
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
      expect(peak, String(route.id)).toBeLessThanOrEqual(10);
    }

    const entries = profileRecords(artifacts.costs.entries);
    const byteCosts = entries.filter((entry) => entry.kind === "bytes");
    expect(byteCosts.length).toBeGreaterThan(0);
    for (const entry of byteCosts) {
      expect(integer(entry.bytes, "byte cost")).toBeGreaterThanOrEqual(0);
      expect(entry.accounting).toBeOneOf([
        "program",
        "residentRam",
        "zeroPage",
        "sfa",
        "scratch",
        "existingRom",
      ]);
      expect(profileRecords(entry.sourceSites)).toBeInstanceOf(Array);
      expect(Array.isArray(entry.dependencyIds)).toBe(true);
    }
    const cycles = entries.filter((entry) => entry.kind === "cycles");
    expect(cycles.length).toBeGreaterThan(0);
    for (const entry of cycles) {
      expect(typeof entry.pathId).toBe("string");
      expect(profileRecords(entry.traffic)).toBeInstanceOf(Array);
      expect(profileRecords(entry.sourceSites)).toBeInstanceOf(Array);
      expect(Array.isArray(entry.dependencyIds)).toBe(true);
      const measured = entry.cycles;
      if (measured === null || typeof measured !== "object" || Array.isArray(measured))
        throw new TypeError("Missing measured CPU cycle evidence");
      const measurement = measured as Record<string, unknown>;
      expect(measurement.kind).toBeOneOf(["unknown", "exact", "range", "symbolic"]);
      // An external or firmware path stays honestly unknown instead of becoming
      // a zero-cycle or zero-byte win.
      if (measurement.kind === "unknown") {
        expect(measurement.value).toBeUndefined();
        expect(measurement.minimum).toBeUndefined();
        expect(measurement.maximum).toBeUndefined();
      }
    }
  }, 120_000);
});
