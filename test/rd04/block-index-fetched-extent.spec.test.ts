import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { profileSpan, readProfileArtifacts, withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

/** Artifacts retained from one successful public build. */
type BuildArtifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;

/** These profiles expose one 16 KiB VIC bank, with character ROM hiding part of RAM. */
const VIC_BANK_END = 0x3fff;
const CHARACTER_ROM = { start: 0x1000, end: 0x1fff } as const;

/** This exceeds both the largest visible interval and the complete VIC bank. */
const LARGE_BUFFER_BYTES = 18000;

/** This element cannot be inside the VIC bank at any resident buffer address. */
const FAR_OFFSET = 17024;

/** Narrow public JSON before following symbol or location metadata. */
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Resolve a named global, rejecting missing or ambiguous public machine locations. */
function globalAddress(artifacts: BuildArtifacts, name: string, byteWidth: number): number {
  const symbols = artifacts.debug.symbols;
  const locations = artifacts.debug.locations;
  if (!Array.isArray(symbols) || !Array.isArray(locations))
    throw new TypeError("Expected public debug symbols and locations");
  const labelPrefix = `b65_Game_${name}_`;
  const matches = symbols.filter((raw) => {
    const symbol = record(raw);
    if (symbol?.kind !== "global" || !Array.isArray(symbol.labels)) return false;
    return symbol.labels.some(
      (label: unknown) => typeof label === "string" && label.startsWith(labelPrefix),
    );
  });
  expect(
    matches,
    `Expected exactly one public global with label prefix ${labelPrefix}`,
  ).toHaveLength(1);
  const symbol = record(matches[0]);
  expect(symbol?.byteWidth, `${name} must retain its complete storage`).toBe(byteWidth);
  const indexes = symbol?.locationIndexes;
  if (!Array.isArray(indexes) || indexes.length === 0)
    throw new Error(`${name} has no public location`);
  const starts = new Set<number>();
  for (const index of indexes) {
    if (!Number.isInteger(index) || index < 0 || index >= locations.length)
      throw new Error(`${name} has an invalid location index`);
    const pieces = record(record(locations[index])?.availability)?.pieces;
    if (!Array.isArray(pieces)) throw new Error(`${name} has no available pieces`);
    for (const piece of pieces) {
      const machine = record(record(piece)?.machine);
      if (typeof machine?.start === "number" && Number.isInteger(machine.start))
        starts.add(machine.start);
    }
  }
  if (starts.size !== 1) throw new Error(`${name} needs one unambiguous machine start`);
  const start = [...starts][0];
  if (start === undefined) throw new Error(`${name} has no machine start`);
  return start;
}

/** Read alignment from the same public CPU interval used by the existing runtime-index oracle. */
function alignmentAt(artifacts: BuildArtifacts, start: number): number {
  const intervals = artifacts.memory.intervals;
  if (!Array.isArray(intervals)) throw new TypeError("Expected public memory intervals");
  const interval = intervals.find(
    (item: unknown): item is Record<string, unknown> =>
      record(item)?.addressSpaceId === "cpu16" && record(item)?.start === start,
  );
  if (interval === undefined) throw new Error(`Missing CPU interval at $${start.toString(16)}`);
  const alignment = record(interval)?.alignmentBytes;
  if (typeof alignment !== "number") throw new TypeError("Expected numeric interval alignment");
  return alignment;
}

/** Retain public artifacts while the real build's temporary project is alive. */
async function build(source: string, profile: string): Promise<BuildArtifacts> {
  return withProfileProject(source, profile, async (project) => {
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") throw new Error("Expected a successful public build");
    return readProfileArtifacts(built);
  });
}

/** Check the actual fetched block, rather than accepting a build with invisible sprite bytes. */
function expectVisibleFetch(start: number): void {
  const end = start + 63;
  const description = `fetched bytes $${start.toString(16)}-$${end.toString(16)}`;
  expect(start % 64, `${description} must start on a sprite block boundary`).toBe(0);
  expect(start, description).toBeGreaterThanOrEqual(0);
  expect(end, `${description} must stay inside the VIC bank`).toBeLessThanOrEqual(VIC_BANK_END);
  expect(
    start <= CHARACTER_ROM.end && end >= CHARACTER_ROM.start,
    `${description} must not be hidden by character ROM`,
  ).toBe(false);
}

/** Ordinary CPU storage may extend past the VIC bank but must remain resident writable RAM. */
function expectResidentBuffer(start: number, bytes: number): void {
  expect(start).toBeGreaterThanOrEqual(0x0801);
  expect(start + bytes - 1).toBeLessThanOrEqual(0xcfff);
}

describe.each(sourceLibraryProfiles)("sprite fetched extents on %s", (profile) => {
  // Only the addressed block needs visibility; a large unused tail is ordinary CPU storage.
  for (const offset of [0, 64, 4096]) {
    it(`should keep only the fetched block visible when a large buffer is addressed at offset ${offset}`, async () => {
      const place = offset === 0 ? "buffer" : `buffer[${offset}]`;
      const artifacts = await build(
        `module Game;
let pad: byte[2400];
let buffer: byte[${LARGE_BUFFER_BYTES}];
function main(): void {
  pad[0] = 1;
  c64.vic.setSpritePointer(0, lo(&${place} / 64));
}`,
        profile,
      );
      const start = globalAddress(artifacts, "buffer", LARGE_BUFFER_BYTES);
      expectResidentBuffer(start, LARGE_BUFFER_BYTES);
      expectVisibleFetch(start + offset);
      expect(start + LARGE_BUFFER_BYTES - 1).toBeGreaterThan(VIC_BANK_END);
    }, 120_000);
  }

  // Each helper publishes its own object's block; satisfying one demand cannot replace the other.
  it("should keep both fetched blocks visible when two large objects are published by separate helpers", async () => {
    const artifacts = await build(
      `module Game;
let first: byte[5000];
let second: byte[5000];
function publishFirst(): void { c64.vic.setSpritePointer(0, lo(&first / 64)); }
function publishSecond(): void { c64.vic.setSpritePointer(1, lo(&second / 64)); }
function main(): void { publishFirst(); publishSecond(); }`,
      profile,
    );
    const first = globalAddress(artifacts, "first", 5000);
    const second = globalAddress(artifacts, "second", 5000);
    expectResidentBuffer(first, 5000);
    expectResidentBuffer(second, 5000);
    expectVisibleFetch(first);
    expectVisibleFetch(second);
    expect(first + 5000 <= second || second + 5000 <= first).toBe(true);
  }, 120_000);

  // A CPU-only publication does not ask the VIC to fetch the address that produced the number.
  // The far-offset variant cannot acquire a visible home, even for just one block.
  for (const offset of [0, FAR_OFFSET]) {
    for (const held of [false, true]) {
      it(`should leave CPU-only block arithmetic unconstrained when offset ${offset} is ${held ? "overwritten before the chip receives the variable" : "published only by poke"}`, async () => {
        const place = offset === 0 ? "buffer" : `buffer[${offset}]`;
        const use = held
          ? `let block: byte = lo(&${place} / 64);
  poke($C000, block);
  block = $80;
  c64.vic.setSpritePointer(0, block);`
          : `poke($C000, lo(&${place} / 64));`;
        const artifacts = await build(
          `module Game;
let buffer: byte[${LARGE_BUFFER_BYTES}];
function main(): void {
  ${use}
}`,
          profile,
        );
        const start = globalAddress(artifacts, "buffer", LARGE_BUFFER_BYTES);
        expectResidentBuffer(start, LARGE_BUFFER_BYTES);
        expect(start + LARGE_BUFFER_BYTES - 1).toBeGreaterThan(VIC_BANK_END);
        expect(start + offset + 63).toBeLessThanOrEqual(0xcfff);
        if (offset === FAR_OFFSET) expect(start + offset).toBeGreaterThan(VIC_BANK_END);
        if (held) expectVisibleFetch(0x80 * 64);
      }, 120_000);
    }
  }

  // Taking the high byte changes the selected block: it points into the first 256 bytes,
  // not back into the object whose address supplied the arithmetic.
  for (const offset of [0, FAR_OFFSET]) {
    it(`should drop object visibility provenance when hi changes the block number at offset ${offset}`, async () => {
      const place = offset === 0 ? "buffer" : `buffer[${offset}]`;
      const artifacts = await build(
        `module Game;
let buffer: byte[${LARGE_BUFFER_BYTES}];
function main(): void { c64.vic.setSpritePointer(0, hi(&${place} / 64)); }`,
        profile,
      );
      const start = globalAddress(artifacts, "buffer", LARGE_BUFFER_BYTES);
      expectResidentBuffer(start, LARGE_BUFFER_BYTES);
      const block = Math.floor(Math.floor((start + offset) / 64) / 256);
      expect(block).toBeGreaterThanOrEqual(0);
      expect(block).toBeLessThanOrEqual(3);
      expectVisibleFetch(block * 64);
      expect(start + LARGE_BUFFER_BYTES - 1).toBeGreaterThan(VIC_BANK_END);
    }, 120_000);
  }

  // Either runtime-selected element can reach the chip, so both complete blocks need visibility.
  it("should preserve visibility of the entire indexed span when the index is read at runtime", async () => {
    const artifacts = await build(
      `module Game;
let pad: byte[2400];
let blocks: byte[2][64];
function main(): void {
  pad[0] = 1;
  let index: byte = peek($0400);
  c64.vic.setSpritePointer(0, lo(&blocks[index] / 64));
}`,
      profile,
    );
    const start = globalAddress(artifacts, "blocks", 128);
    expectResidentBuffer(start, 128);
    expect(alignmentAt(artifacts, start)).toBe(64);
    expectVisibleFetch(start);
    expectVisibleFetch(start + 64);
  }, 120_000);

  // A byte index can select every element of this contiguous 16 KiB array. No home
  // can expose that entire span in a bank containing an inaccessible ROM window.
  it("should identify the inferred sprite-block expression when no visible indexed home exists", async () => {
    const expression = "lo(&blocks[index] / 64)";
    const source = `module Game;
let blocks: byte[256][64];
function main(): void {
  let index: byte = peek($0400);
  c64.vic.setSpritePointer(0, ${expression});
}`;
    await withProfileProject(source, profile, async (project) => {
      const built = await buildProject({ project, optimization: "none" });
      expect(built.kind).toBe("failure");
      if (built.kind !== "failure") throw new Error("Expected an unsatisfiable inferred demand");
      const diagnostics = built.diagnostics.filter((diagnostic) => diagnostic.code === "E10273");
      expect(diagnostics, JSON.stringify(built.diagnostics)).toHaveLength(1);
      const diagnostic = diagnostics[0];
      if (diagnostic === undefined) throw new Error("Missing placement diagnostic");
      const rendered = JSON.stringify(diagnostic);
      expect.soft(rendered).toMatch(/infer/iu);
      expect.soft(rendered).toMatch(/sprite[ -]block/iu);
      expect.soft(rendered).toMatch(/expression/iu);
      expect.soft(rendered).not.toMatch(/change or remove the explicit constraint/iu);
      const expected = profileSpan(source, expression);
      expect(diagnostic.primarySpan?.sourceId).toBe(expected.sourceId);
      expect(diagnostic.primarySpan?.start).toBeGreaterThanOrEqual(expected.start);
      expect(diagnostic.primarySpan?.end).toBeLessThanOrEqual(expected.end);
      expect(diagnostic.primarySpan?.end).toBeGreaterThan(
        diagnostic.primarySpan?.start ?? expected.end,
      );
    });
  }, 120_000);

  // An explicit address stays the author's choice, even though its block number wraps
  // within the VIC bank and therefore fetches different bytes from the object's own RAM.
  it("should retain an explicit unreachable object address when its block number is published", async () => {
    const artifacts = await build(
      `module Game;
place(at: $C040) let buffer: byte[64];
function main(): void { c64.vic.setSpritePointer(0, lo(&buffer / 64)); }`,
      profile,
    );
    const start = globalAddress(artifacts, "buffer", 64);
    expect(start).toBe(0xc040);
    expectVisibleFetch((Math.floor(start / 64) % 256) * 64);
  }, 120_000);
});
