import { describe, expect, it } from "vitest";
import { buildProfileSource, profileRecord, profileRecords } from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;

type Artifacts = Awaited<ReturnType<typeof buildProfileSource>>;

/** Check public evidence and locate a real, source-qualified ordinary function. */
function sampleInterval(artifacts: Artifacts, profile: string, source: string) {
  expect(artifacts.memory).toMatchObject({
    kind: "blend65.memory",
    schemaVersion: 1,
    profileId: profile,
    acmeReconciled: true,
  });
  expect(artifacts.memory).toHaveProperty("stackDomains");
  const intervals = profileRecords(artifacts.memory.intervals).map((interval) => {
    const { start, end } = interval;
    if (
      typeof start !== "number" ||
      typeof end !== "number" ||
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end <= start ||
      end > 0x10000
    )
      throw new Error("Expected a nonempty half-open physical byte interval");
    expect(interval.size).toBe(end - start);
    return { ...interval, start, end };
  });
  expect(intervals.length).toBeGreaterThan(0);

  const qualifiedName = "src/game.blend::Game.sample";
  const code = intervals.filter((interval) => {
    const owner = profileRecord(interval.owner);
    return interval.kind === "code" && owner.kind === "function" && owner.id === qualifiedName;
  });
  expect(code).toHaveLength(1);
  const sample = code[0];
  if (sample === undefined) throw new Error("Missing ordinary sample code interval");

  // An empty local owns no byte, including an initializer buffer or expression scratch.
  expect(
    intervals.filter((interval) => {
      const owner = profileRecord(interval.owner);
      return (
        ["sfa", "zeroPage", "scratch"].includes(String(interval.kind)) ||
        (interval.kind !== "code" && ["function", "helper"].includes(String(owner.kind)))
      );
    }),
  ).toEqual([]);

  expect(artifacts.debug).toMatchObject({
    kind: "blend65.debug",
    schemaVersion: 1,
    profileId: profile,
    optimization: "none",
  });
  const sources = profileRecords(artifacts.debug.sources);
  const sourceIndex = sources.findIndex(({ path }) => path === "src/game.blend");
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  expect(sources[sourceIndex]?.byteLength).toBe(Buffer.byteLength(source, "utf8"));
  const functions = profileRecords(artifacts.debug.functions);
  const functionIndex = functions.findIndex((entry) => entry.qualifiedName === qualifiedName);
  expect(functionIndex).toBeGreaterThanOrEqual(0);
  const variants = profileRecords(functions[functionIndex]?.entryVariants);
  expect(variants.length).toBeGreaterThan(0);
  const contexts = profileRecords(artifacts.debug.contexts);
  expect(
    contexts.filter(
      (context) => context.kind === "entry" && context.functionIndex === functionIndex,
    ).length,
  ).toBeGreaterThan(0);
  for (const field of ["symbols", "locations", "ranges"]) {
    expect(profileRecords(artifacts.debug[field]).length, field).toBeGreaterThan(0);
  }

  expect(artifacts.costs).toMatchObject({
    kind: "blend65.costs",
    schemaVersion: 1,
    mode: "none",
  });
  const totals = profileRecord(artifacts.costs.totals);
  for (const field of ["programBytes", "pathCycles", "resources"]) {
    expect(totals).toHaveProperty(field);
  }
  profileRecords(artifacts.costs.decisions);
  const programBytes = profileRecords(artifacts.costs.entries).filter(
    (entry) => entry.kind === "bytes" && entry.accounting === "program",
  );
  expect(programBytes.length).toBeGreaterThan(0);
  const measuredBytes = programBytes.reduce((sum, entry) => {
    if (typeof entry.bytes !== "number" || !Number.isInteger(entry.bytes) || entry.bytes < 0)
      throw new Error("Expected a nonnegative integral program byte cost");
    return sum + entry.bytes;
  }, 0);
  expect(measuredBytes).toBe(artifacts.prg.length - 2);
  return sample;
}

/** Read the complete measured function directly from its returned PRG artifact. */
function sampleBytes(artifacts: Artifacts, interval: { start: number; end: number }) {
  expect(artifacts.prg.length).toBeGreaterThanOrEqual(2);
  const loadAddress = artifacts.prg.readUInt16LE(0);
  const start = 2 + interval.start - loadAddress;
  const end = 2 + interval.end - loadAddress;
  expect(start).toBeGreaterThanOrEqual(2);
  expect(end).toBeLessThanOrEqual(artifacts.prg.length);
  return [...artifacts.prg.subarray(start, end)];
}

describe.sequential.each(profiles)("ordinary zero-sized locals on %s", (profile) => {
  it.each([
    ["uninitialized", "let empty: byte[0];"],
    ["initialized", "let empty: byte[0] = [];"],
  ])(
    "builds a valid ordinary function with an %s empty local and no owned bytes",
    async (_, declaration) => {
      // Zero-length arrays are valid objects; empty initialization has no bytes to write.
      // The separate ordinary sample returns with RTS while main retains its platform cleanup.
      const source = `module Game;
function sample(): void {
  ${declaration}
  poke($0400, 7);
}
function main(): void { sample(); }`;
      const artifacts = await buildProfileSource(source, profile);
      const interval = sampleInterval(artifacts, profile, source);
      // LDA #7 (2 bytes/2 cycles), STA $0400 (3/4), RTS (1/6): 6 bytes, 12 nominal cycles.
      expect(sampleBytes(artifacts, interval)).toEqual([0xa9, 7, 0x8d, 0x00, 0x04, 0x60]);
    },
  );
});
