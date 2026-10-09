import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject, checkProject } from "@blend65/compiler";
import type { BuildSuccess } from "@blend65/compiler";
import { expect } from "vitest";
import type { ViceMonitor } from "../m1/vice-monitor.js";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import {
  profileRecord,
  profileRecords,
  profileSpan,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

/** The four cooperative PRG profiles covered by ordinary source-library builds. */
export const sourceLibraryProfiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;

/** Detached public evidence read from one successful generation. */
export type LibraryArtifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;

/** Build two ordinary source modules and keep their generation alive during inspection. */
export async function withLibraryBuild<T>(
  source: string,
  library: string,
  profile: string,
  inspect: (artifacts: LibraryArtifacts, built: BuildSuccess) => Promise<T>,
  extraSources: Readonly<Record<string, string>> = {},
): Promise<T> {
  return withProfileProject(source, profile, async (project, root) => {
    await writeFile(join(root, "src/library.blend"), library);
    for (const [filename, content] of Object.entries(extraSources))
      await writeFile(join(root, "src", filename), content);
    const checked = await checkProject({ project });
    expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
    if (checked.kind !== "success") throw new Error("Expected legal source-library input");
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error("Expected a complete source-library build");
    const artifacts = await readProfileArtifacts(built);
    expect(artifacts.memory).toMatchObject({ profileId: profile, acmeReconciled: true });
    return inspect(artifacts, built);
  });
}

/** Resolve an emitted function through public debug variants and assembled labels. */
export function libraryEntry(artifacts: LibraryArtifacts, qualifiedName: string): number {
  const functions = profileRecords(artifacts.debug.functions).filter(
    (entry) => entry.qualifiedName === qualifiedName,
  );
  expect(functions, qualifiedName).toHaveLength(1);
  const variants = profileRecords(functions[0]!.entryVariants);
  expect(variants, qualifiedName).toHaveLength(1);
  const label = variants[0]!.label;
  if (typeof label !== "string") throw new Error("Missing published function label");
  const labels = new Map(
    [...artifacts.labels.matchAll(/^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu)].map((match) => [
      match[1]!,
      Number.parseInt(match[2]!, 16),
    ]),
  );
  const address = labels.get(label);
  if (address === undefined) throw new Error(`Missing assembled entry for ${qualifiedName}`);
  expect(address).toBeGreaterThanOrEqual(artifacts.prg.readUInt16LE(0));
  expect(address).toBeLessThan(artifacts.prg.readUInt16LE(0) + artifacts.prg.length - 2);
  return address;
}

/** Read exact artifact bytes at a CPU address; the PRG load word is not payload. */
export function libraryBytes(artifacts: LibraryArtifacts, address: number, count: number) {
  const offset = 2 + address - artifacts.prg.readUInt16LE(0);
  expect(offset).toBeGreaterThanOrEqual(2);
  expect(offset + count).toBeLessThanOrEqual(artifacts.prg.length);
  return [...artifacts.prg.subarray(offset, offset + count)];
}

/** Reconcile charged program bytes against the actual artifact independently of source selection. */
export function expectLibraryAccounting(artifacts: LibraryArtifacts): void {
  const totals = profileRecord(artifacts.costs.totals);
  expect(totals.programBytes).toBe(artifacts.prg.length - 2);
  const entries = profileRecords(artifacts.costs.entries).filter(
    (entry) => entry.kind === "bytes" && entry.accounting === "program",
  );
  expect(entries.length).toBeGreaterThan(0);
  const bytes = entries.reduce((sum, entry) => {
    if (typeof entry.bytes !== "number" || !Number.isInteger(entry.bytes) || entry.bytes < 0)
      throw new Error("Expected a nonnegative integral program byte cost");
    return sum + entry.bytes;
  }, 0);
  expect(bytes).toBe(artifacts.prg.length - 2);
}

/** Resolve the public logical startup names using the existing emitted-label convention. */
export function libraryStartup(
  artifacts: LibraryArtifacts,
  name: "startup.entry" | "startup.restore",
) {
  const suffix = Buffer.from(name).toString("hex");
  const matches = [...artifacts.labels.matchAll(/^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu)].filter(
    (match) => match[1]!.endsWith(`_${suffix}`),
  );
  expect(matches, name).toHaveLength(1);
  return Number.parseInt(matches[0]![2]!, 16);
}

/** Observe a real program from startup with bounded, sequential VICE checkpoints. */
export async function withLibraryVice(
  built: BuildSuccess,
  artifacts: LibraryArtifacts,
  profile: (typeof sourceLibraryProfiles)[number],
  inspect: (monitor: ViceMonitor, stopAt: (address: number) => Promise<void>) => Promise<void>,
  joysticks: readonly [boolean, boolean] = [false, false],
): Promise<void> {
  const runtime = await startVice(
    join(built.generation.directory, built.generation.primaryArtifact),
    100_000_000,
    profile,
    joysticks[0],
    joysticks[1],
  );
  if ("kind" in runtime) throw new Error(`VICE observation is Unknown: ${runtime.reason}`);
  const monitor = runtime.monitor;
  const stopAt = async (address: number) => {
    const checkpoint = await monitor.setExecuteCheckpoint(address);
    try {
      const stopped = monitor.waitForStop(20_000);
      await monitor.resume();
      expect(await stopped).toBe(address);
    } finally {
      await monitor.deleteCheckpoint(checkpoint);
    }
  };
  try {
    await stopAt(libraryStartup(artifacts, "startup.entry"));
    await inspect(monitor, stopAt);
  } finally {
    await stopVice(runtime);
  }
}

/** Locate module storage through source provenance and its complete published symbol identity. */
export function libraryGlobalIntervals(
  artifacts: LibraryArtifacts,
  source: string,
  declaration: string,
  sourceId = "src/library.blend",
) {
  const wanted = profileSpan(source, declaration, 0, sourceId);
  const sources = profileRecords(artifacts.debug.sources);
  const sourceIndex = sources.findIndex((entry) => entry.path === sourceId);
  expect(sourceIndex, sourceId).toBeGreaterThanOrEqual(0);
  const symbols = profileRecords(artifacts.debug.symbols).filter((symbol) => {
    if (symbol.kind !== "global") return false;
    const origin = profileRecord(symbol.origin);
    if (origin.kind !== "source") return false;
    const span = profileRecord(origin.span);
    const { sourceIndex: originIndex, startByte: start, endByte: end } = span;
    if (
      typeof originIndex !== "number" ||
      !Number.isInteger(originIndex) ||
      originIndex < 0 ||
      originIndex >= sources.length ||
      typeof start !== "number" ||
      !Number.isInteger(start) ||
      typeof end !== "number" ||
      !Number.isInteger(end)
    )
      throw new TypeError("Source globals require complete integer declaration spans");
    const byteLength = sources[originIndex]!.byteLength;
    if (
      typeof byteLength !== "number" ||
      !Number.isInteger(byteLength) ||
      start < 0 ||
      end <= start ||
      end > byteLength
    )
      throw new TypeError("Global declaration spans must fit their source bytes");
    return originIndex === sourceIndex && start <= wanted.start && end >= wanted.end;
  });
  const identities = new Set(
    symbols.map((symbol) => {
      if (typeof symbol.qualifiedName !== "string")
        throw new TypeError("Global source symbols require a complete identity");
      return symbol.qualifiedName;
    }),
  );
  const intervals = profileRecords(artifacts.memory.intervals).filter((interval) => {
    const owner = profileRecord(interval.owner);
    if (owner.kind !== "symbol") return false;
    if (typeof owner.id !== "string")
      throw new TypeError("Symbol-owned intervals require a complete string identity");
    return identities.has(owner.id);
  });
  return { symbols, intervals };
}

/** Require one complete stored object and resolve its physical label independently of its spelling. */
export function libraryGlobalAddress(
  artifacts: LibraryArtifacts,
  source: string,
  declaration: string,
  size: number,
  sourceId = "src/library.blend",
): number {
  const { symbols, intervals } = libraryGlobalIntervals(artifacts, source, declaration, sourceId);
  expect(symbols, declaration).toHaveLength(1);
  expect(symbols[0]!.byteWidth, declaration).toBe(size);
  expect(intervals, declaration).toHaveLength(1);
  const interval = intervals[0]!;
  expect(interval.size).toBe(size);
  if (typeof interval.start !== "number" || typeof interval.end !== "number")
    throw new TypeError("Stored objects require a physical interval");
  expect(interval.end - interval.start).toBe(size);
  const labels = new Map(
    [...artifacts.labels.matchAll(/^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu)].map((match) => [
      match[1]!,
      Number.parseInt(match[2]!, 16),
    ]),
  );
  const published = symbols[0]!.labels;
  if (!Array.isArray(published) || published.length === 0)
    throw new TypeError("Stored globals require assembled source labels");
  for (const label of published) {
    if (typeof label !== "string") throw new TypeError("Source labels must be strings");
    expect(labels.get(label), label).toBe(interval.start);
  }
  return interval.start;
}

/** Compare all charged executable resources against an independently authored source control. */
export function expectSameLibraryCost(actual: LibraryArtifacts, control: LibraryArtifacts): void {
  expectLibraryAccounting(actual);
  expectLibraryAccounting(control);
  expect(actual.prg).toEqual(control.prg);
  expect(profileRecord(actual.costs.totals)).toEqual(profileRecord(control.costs.totals));
  const allocations = (value: unknown) =>
    profileRecords(value).map(
      ({ kind, resourceClass, start, end, size, payloadBytes, paddingBytes, reservedBytes }) => ({
        kind,
        resourceClass,
        start,
        end,
        size,
        payloadBytes,
        paddingBytes,
        reservedBytes,
      }),
    );
  expect(allocations(actual.memory.intervals)).toEqual(allocations(control.memory.intervals));
  expect(actual.memory.stackDomains).toEqual(control.memory.stackDomains);
}

/** Read a complete emitted function from its public range inventory, without decoding instructions. */
export function libraryFunctionBytes(artifacts: LibraryArtifacts, qualifiedName: string): number[] {
  const functions = profileRecords(artifacts.debug.functions).filter(
    (entry) => entry.qualifiedName === qualifiedName,
  );
  expect(functions, qualifiedName).toHaveLength(1);
  const indexes = functions[0]!.rangeIndexes;
  if (!Array.isArray(indexes) || indexes.length === 0)
    throw new TypeError("Emitted functions require public machine ranges");
  const ranges = profileRecords(artifacts.debug.ranges);
  const machines = indexes.map((index) => {
    if (typeof index !== "number" || !Number.isInteger(index) || ranges[index] === undefined)
      throw new TypeError("Function range indexes must resolve");
    const machine = profileRecord(ranges[index]!.machine);
    if (typeof machine.start !== "number" || typeof machine.end !== "number")
      throw new TypeError("Function ranges require physical endpoints");
    return { start: machine.start, end: machine.end };
  });
  const start = Math.min(...machines.map((machine) => machine.start));
  const end = Math.max(...machines.map((machine) => machine.end));
  expect(end).toBeGreaterThan(start);
  return libraryBytes(artifacts, start, end - start);
}
