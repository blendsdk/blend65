import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { readProfileArtifacts, withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

/** Artifacts retained from one successful public build. */
type BuildArtifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;

/** Narrow untrusted debug JSON before resolving a public symbol. */
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Resolve one source global's final address from unique public symbol metadata. */
function symbolAddress(artifacts: BuildArtifacts): number {
  const symbols = artifacts.debug.symbols;
  const locations = artifacts.debug.locations;
  if (!Array.isArray(symbols) || !Array.isArray(locations))
    throw new TypeError("Expected public debug symbols and locations");
  const matches = symbols.filter((raw) => record(raw)?.kind === "global");
  if (matches.length !== 1) throw new Error("Expected exactly one public global");
  const symbol = record(matches[0]);
  const indexes = symbol?.locationIndexes;
  if (!Array.isArray(indexes) || indexes.length === 0)
    throw new Error("Public global has no location");
  const location = record(locations[indexes[0]]);
  const availability = record(location?.availability);
  const pieces = availability?.pieces;
  if (!Array.isArray(pieces)) throw new Error("Public global has no available pieces");
  for (const rawPiece of pieces) {
    const machine = record(record(rawPiece)?.machine);
    if (typeof machine?.start === "number") return machine.start;
  }
  throw new Error("Public global has no machine start");
}

/** Read the declared alignment of the interval starting at one address. */
function alignmentAt(artifacts: BuildArtifacts, start: number): number {
  const intervals = artifacts.memory.intervals;
  if (!Array.isArray(intervals)) throw new TypeError("Expected memory intervals");
  const interval = intervals.find(
    (item: unknown): item is Record<string, unknown> =>
      record(item)?.addressSpaceId === "cpu16" && record(item)?.start === start,
  );
  if (interval === undefined) throw new Error(`Missing interval at $${start.toString(16)}`);
  const alignment = record(interval)?.alignmentBytes;
  if (typeof alignment !== "number") throw new TypeError("Expected numeric alignment");
  return alignment;
}

/** Build one runtime-element witness and return its root address and alignment. */
async function observe(source: string, profile: string) {
  return withProfileProject(source, profile, async (project) => {
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") return null;
    const artifacts = await readProfileArtifacts(built);
    const address = symbolAddress(artifacts);
    return { address, alignment: alignmentAt(artifacts, address), asm: artifacts.assembly };
  });
}

describe.each(sourceLibraryProfiles)("runtime element block indices on %s", (profile) => {
  it("should prove a 64-byte stride element aligned", async () => {
    const observed = await observe(
      `module Game;
let blocks: byte[2][64];
function main(): void {
  let index: byte = peek($0400);
  c64.vic.setSpritePointer(0, lo(&blocks[index] / 64));
}`,
      profile,
    );
    expect(observed).not.toBeNull();
    if (observed === null) return;
    expect(observed.alignment).toBe(64);
    expect(observed.address % 64).toBe(0);
    // The runtime index keeps the ordinary shift path; this is an alignment proof only.
    expect(observed.asm).toMatch(/\b(lsr|ror)\b/u);
  }, 120_000);

  it("should not falsely prove a byte-stride runtime element aligned", async () => {
    const observed = await observe(
      `module Game;
let buffer: byte[128];
function main(): void {
  let index: byte = peek($0400);
  c64.vic.setSpritePointer(0, lo(&buffer[index] / 64));
}`,
      profile,
    );
    expect(observed).not.toBeNull();
    if (observed === null) return;
    expect(observed.alignment).not.toBe(64);
  }, 120_000);
});
