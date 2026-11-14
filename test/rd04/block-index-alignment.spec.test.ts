import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import type { BuildResult } from "@blend65/compiler";
import { readProfileArtifacts, withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

/** Artifacts retained from one successful public build. */
type BuildArtifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;

/** Public build plus retained artifacts, read while the project directory is alive. */
type ObservedBuild =
  | { readonly kind: "success"; readonly artifacts: BuildArtifacts }
  | Extract<BuildResult, { readonly kind: "failure" }>;

/** Build one source on one profile and retain every public artifact under test. */
async function build(source: string, profile: string): Promise<ObservedBuild> {
  return withProfileProject(source, profile, async (project) => {
    const built = await buildProject({ project, optimization: "none" });
    if (built.kind !== "success") return built;
    return { kind: "success", artifacts: await readProfileArtifacts(built) };
  });
}

/** Read the public memory interval for one exact object start. */
function intervalAt(artifacts: BuildArtifacts, start: number) {
  const intervals = artifacts.memory.intervals;
  if (!Array.isArray(intervals)) throw new TypeError("Expected public memory intervals");
  const interval = intervals.find(
    (item: unknown): item is Record<string, unknown> =>
      item !== null &&
      typeof item === "object" &&
      (item as Record<string, unknown>).addressSpaceId === "cpu16" &&
      (item as Record<string, unknown>).start === start,
  );
  if (interval === undefined)
    throw new Error(`Expected a public interval at $${start.toString(16)}`);
  const alignmentBytes = interval.alignmentBytes;
  if (typeof alignmentBytes !== "number")
    throw new TypeError("Expected a numeric public alignment fact");
  return { start, alignmentBytes };
}

/** Narrow untrusted debug JSON before resolving a public symbol. */
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Resolve one source global's final address from unique public symbol metadata. */
function symbolAddress(artifacts: BuildArtifacts, byteWidth: number): number {
  const symbols = artifacts.debug.symbols;
  const locations = artifacts.debug.locations;
  if (!Array.isArray(symbols) || !Array.isArray(locations))
    throw new TypeError("Expected public debug symbols and locations");
  // Each oracle project contains exactly one source global of the width under
  // test. Uniqueness is required so an unrelated object cannot satisfy it.
  const matches = symbols.filter((raw) => {
    const symbol = record(raw);
    return symbol?.kind === "global" && symbol.byteWidth === byteWidth;
  });
  if (matches.length !== 1)
    throw new Error(`Expected exactly one public global with ${byteWidth} bytes`);
  const symbol = record(matches[0]);
  const indexes = symbol?.locationIndexes;
  if (!Array.isArray(indexes) || indexes.length === 0)
    throw new Error(`Public global with ${byteWidth} bytes has no location`);
  const location = record(locations[indexes[0]]);
  const availability = record(location?.availability);
  const pieces = availability?.pieces;
  if (!Array.isArray(pieces))
    throw new Error(`Public global with ${byteWidth} bytes has no available pieces`);
  for (const rawPiece of pieces) {
    const machine = record(record(rawPiece)?.machine);
    if (typeof machine?.start === "number") return machine.start;
  }
  throw new Error(`Public global with ${byteWidth} bytes has no machine start`);
}

const mutableSource = (expression: string) => `module Game;
let buffer: byte[64];
function main(): void { c64.vic.setSpritePointer(0, ${expression}); }`;

const forEachProfile = (
  name: string,
  body: (profile: (typeof sourceLibraryProfiles)[number]) => Promise<void>,
) => {
  for (const profile of sourceLibraryProfiles)
    it(`${profile}: ${name}`, () => body(profile), 120_000);
};

describe("block-index storage alignment", () => {
  // A block index is only meaningful when the buffer starts on the 64-byte
  // boundary the VIC fetches from.
  forEachProfile("should align a buffer used as a 64-byte block index", async (profile) => {
    const built = await build(mutableSource("lo(&buffer / 64)"), profile);
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") return;
    const start = symbolAddress(built.artifacts, 64);
    expect(start % 64).toBe(0);
    expect(intervalAt(built.artifacts, start).alignmentBytes).toBeGreaterThanOrEqual(64);
  });

  // The shift form must demand the same alignment as the division form.
  forEachProfile("should align a buffer used as a shifted block index", async (profile) => {
    const built = await build(mutableSource("lo(&buffer >> 6)"), profile);
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") return;
    const start = symbolAddress(built.artifacts, 64);
    expect(start % 64).toBe(0);
    expect(intervalAt(built.artifacts, start).alignmentBytes).toBeGreaterThanOrEqual(64);
  });

  // `hi() * 4` discards the low address byte, so it needs a 256-byte start.
  forEachProfile("should align a buffer used through hi times four", async (profile) => {
    const built = await build(mutableSource("hi(&buffer) * 4"), profile);
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") return;
    const start = symbolAddress(built.artifacts, 64);
    expect(start % 256).toBe(0);
    expect(intervalAt(built.artifacts, start).alignmentBytes).toBeGreaterThanOrEqual(256);
  });

  // Source order is free: the constant may be on either side of `*`.
  forEachProfile("should align a commuted hi times four expression", async (profile) => {
    const built = await build(mutableSource("4 * hi(&buffer)"), profile);
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") return;
    const start = symbolAddress(built.artifacts, 64);
    expect(start % 256).toBe(0);
    expect(intervalAt(built.artifacts, start).alignmentBytes).toBeGreaterThanOrEqual(256);
  });

  // A plain low-byte read is not a block computation and adds no padding.
  forEachProfile("should not align a buffer used only through lo", async (profile) => {
    const built = await build(mutableSource("lo(&buffer)"), profile);
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") return;
    const start = symbolAddress(built.artifacts, 64);
    expect(intervalAt(built.artifacts, start).alignmentBytes).toBeLessThan(64);
  });

  // Constant images take the same source shape and must receive the same
  // inferred placement; their address is visible in the public label file.
  forEachProfile("should align a constant image used as a block index", async (profile) => {
    const built = await build(
      `module Game;
const IMAGE: byte[64] = [1; 0];
function main(): void { c64.vic.setSpritePointer(0, lo(&IMAGE / 64)); }`,
      profile,
    );
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") return;
    expect(symbolAddress(built.artifacts, 64) % 64).toBe(0);
  });

  // An explicit address is the user's contract. A misaligned one is preserved
  // unchanged; this pass does not invent a new rejection for ordinary math.
  forEachProfile("should preserve an explicitly misaligned block buffer", async (profile) => {
    const built = await build(
      `module Game;
place(at: $0B50) let buffer: byte[64];
function main(): void { c64.vic.setSpritePointer(0, lo(&buffer / 64)); }`,
      profile,
    );
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") return;
    const start = symbolAddress(built.artifacts, 64);
    expect(start).toBe(0x0b50);
    expect(intervalAt(built.artifacts, start).alignmentBytes).toBeLessThan(64);
  });

  // A field does not need the root itself to be aligned when the explicit
  // root address makes the field's effective address aligned.
  forEachProfile("should accept a field aligned by its explicit root address", async (profile) => {
    const built = await build(
      `module Game;
struct Frame { pad: byte; image: byte[64]; }
place(at: $0B3F) let frame: Frame;
function main(): void { c64.vic.setSpritePointer(0, lo(&frame.image / 64)); }`,
      profile,
    );
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") return;
    expect(symbolAddress(built.artifacts, 65)).toBe(0x0b3f);
  });

  // Automatic placement cannot express an unaligned field offset with only a
  // root alignment; the pass leaves it unchanged rather than rejecting it.
  forEachProfile("should preserve an unalignable automatic field offset", async (profile) => {
    const built = await build(
      `module Game;
struct Frame { pad: byte; image: byte[64]; }
let frame: Frame;
function main(): void { c64.vic.setSpritePointer(0, lo(&frame.image / 64)); }`,
      profile,
    );
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") return;
    const start = symbolAddress(built.artifacts, 65);
    expect(intervalAt(built.artifacts, start).alignmentBytes).toBeLessThan(64);
  });

  // A runtime index is ordinary arithmetic; it must not be rejected or
  // speculative padding must not be added on its behalf.
  forEachProfile("should preserve a runtime-index element address", async (profile) => {
    const built = await build(
      `module Game;
let blocks: byte[2][64];
function main(): void {
  let index: byte = peek($0400);
  c64.vic.setSpritePointer(0, lo(&blocks[index] / 64));
}`,
      profile,
    );
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") return;
    const start = symbolAddress(built.artifacts, 128);
    expect(intervalAt(built.artifacts, start).alignmentBytes).toBeLessThan(64);
  });

  // The complete selector restores the low block bits, so it needs only
  // 64-byte alignment; a 256-byte demand would reject this valid address.
  forEachProfile(
    "should accept a complete hi/lo selector at a 64-byte address",
    async (profile) => {
      const built = await build(
        `module Game;
place(at: $30C0) let buffer: byte[64];
function main(): void {
  c64.vic.setSpritePointer(0, hi(&buffer) * 4 + (lo(&buffer) >> 6));
}`,
        profile,
      );
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") return;
      expect(symbolAddress(built.artifacts, 64)).toBe(0x30c0);
    },
  );

  // Widening conversions inside each half must not turn the complete selector
  // back into a standalone 256-byte demand.
  forEachProfile("should align a widening-wrapped complete selector", async (profile) => {
    const built = await build(
      `module Game;
let buffer: byte[64];
function main(): void {
  c64.vic.setSpritePointer(0, lo(word(hi(&buffer)) * 4 + (word(lo(&buffer)) >> 6)));
}`,
      profile,
    );
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") return;
    const start = symbolAddress(built.artifacts, 64);
    expect(start % 64).toBe(0);
    expect(intervalAt(built.artifacts, start).alignmentBytes).toBeGreaterThanOrEqual(64);
  });

  // The automatic complete selector must receive 64, not 256; the explicit
  // case alone cannot distinguish those demands because it is preserved.
  forEachProfile("should align an automatic complete selector to 64 only", async (profile) => {
    for (const expression of [
      "hi(&buffer) * 4 + (lo(&buffer) >> 6)",
      "4 * hi(&buffer) + (lo(&buffer) >> 6)",
      "(lo(&buffer) >> 6) + hi(&buffer) * 4",
      "(lo(&buffer) >> 6) + 4 * hi(&buffer)",
      "lo(word(hi(&buffer) * 4 + (lo(&buffer) >> 6)))",
      "lo(word(hi(&buffer)) * 4 + (word(lo(&buffer)) >> 6))",
    ]) {
      const built = await build(mutableSource(expression), profile);
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") continue;
      const start = symbolAddress(built.artifacts, 64);
      expect(start % 64).toBe(0);
      const { alignmentBytes } = intervalAt(built.artifacts, start);
      expect(alignmentBytes).toBeGreaterThanOrEqual(64);
      expect(alignmentBytes).toBeLessThan(256);
    }
  });

  // A constant index is part of the static effective address.
  forEachProfile("should align a constant-index block element", async (profile) => {
    const built = await build(
      `module Game;
let blocks: byte[2][64];
function main(): void { c64.vic.setSpritePointer(0, lo(&blocks[1] / 64)); }`,
      profile,
    );
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") return;
    const start = symbolAddress(built.artifacts, 128);
    expect(start % 64).toBe(0);
    expect(intervalAt(built.artifacts, start).alignmentBytes).toBeGreaterThanOrEqual(64);
  });

  // Zero-page storage keeps its declared allocation; the pass never forces a
  // 64-byte alignment into the zero-page window.
  forEachProfile("should preserve zero-page block storage", async (profile) => {
    const built = await build(
      `module Game;
zeropage { buffer: byte[64]; }
function main(): void { c64.vic.setSpritePointer(0, lo(&buffer / 64)); }`,
      profile,
    );
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") return;
    const start = symbolAddress(built.artifacts, 64);
    expect(intervalAt(built.artifacts, start).alignmentBytes).toBeLessThan(64);
  });

  // An explicit address that already satisfies the demand is preserved.
  forEachProfile("should keep an explicitly aligned block buffer", async (profile) => {
    const built = await build(
      `module Game;
place(at: $0B80) let buffer: byte[64];
function main(): void { c64.vic.setSpritePointer(0, lo(&buffer / 64)); }`,
      profile,
    );
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") return;
    expect(symbolAddress(built.artifacts, 64)).toBe(0x0b80);
  });
});
