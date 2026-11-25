import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { readProfileArtifacts, withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

/** Artifacts retained from one successful public build. */
type BuildArtifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;

/** The chip fetches only inside its own 16K bank. */
const VIC_BANK_END = 0x3fff;

/** Inside this window the chip reads character ROM instead of the RAM underneath. */
const CHARACTER_ROM = { start: 0x1000, end: 0x1fff } as const;

/** A runtime choice keeps both the sprite block and the plain constant reachable. */
const SPRITE_BLOCK_CHOICE = "peek($0400) == 0 ? lo(&buffer / 64) : 0";

/** Require a successful real build and retain its artifacts before temporary cleanup. */
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

/** Narrow untrusted debug JSON before resolving a public symbol. */
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Resolve the one 64-byte source global's final address from public debug metadata. */
function bufferAddress(artifacts: BuildArtifacts): number {
  const symbols = artifacts.debug.symbols;
  const locations = artifacts.debug.locations;
  if (!Array.isArray(symbols) || !Array.isArray(locations))
    throw new TypeError("Expected public debug symbols and locations");
  // Each source declares exactly one 64-byte global, so another object cannot
  // accidentally satisfy the address checks.
  const matches = symbols.filter((raw) => {
    const symbol = record(raw);
    return symbol?.kind === "global" && symbol.byteWidth === 64;
  });
  if (matches.length !== 1) throw new Error("Expected exactly one 64-byte public global");
  const indexes = record(matches[0])?.locationIndexes;
  if (!Array.isArray(indexes) || indexes.length === 0)
    throw new Error("The 64-byte global has no location");
  const index: unknown = indexes[0];
  if (
    typeof index !== "number" ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= locations.length
  )
    throw new TypeError("The 64-byte global has an invalid location index");
  const pieces = record(record(locations[index])?.availability)?.pieces;
  if (!Array.isArray(pieces)) throw new Error("The 64-byte global has no available pieces");
  for (const piece of pieces) {
    const machine = record(record(piece)?.machine);
    if (typeof machine?.start === "number" && Number.isInteger(machine.start)) return machine.start;
  }
  throw new Error("The 64-byte global has no integral machine start");
}

/**
 * Keep enough live storage ahead of the buffer to expose placement inside the
 * character-ROM window. Without padding, a home below the window could hide a
 * missing visibility demand through the conditional.
 */
function pushedIntoTheWindow(use: string, helpers = ""): string {
  return `module Game;
let pad: byte[2400];
let buffer: byte[64];
${helpers}
function main(): void { pad[0] = 1; ${use} }`;
}

/** Require the complete sprite block to occupy RAM the chip can actually fetch. */
function expectVisibleBuffer(artifacts: BuildArtifacts): void {
  const start = bufferAddress(artifacts);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(start + 63).toBeLessThanOrEqual(VIC_BANK_END);
  const overlaps = start <= CHARACTER_ROM.end && start + 63 >= CHARACTER_ROM.start;
  expect(overlaps, `buffer at $${start.toString(16)} is invisible to the VIC`).toBe(false);
}

/** Give each cooperative profile an independent case with time for real assembly. */
function forEachProfile(
  name: string,
  body: (profile: (typeof sourceLibraryProfiles)[number]) => Promise<void>,
): void {
  for (const profile of sourceLibraryProfiles)
    it(`${profile}: ${name}`, () => body(profile), 120_000);
}

describe("conditional block-index VIC visibility", () => {
  // Selecting a sprite block on only one path still requires visible RAM on that
  // path. Inside the character-ROM window the chip displays character shapes
  // instead, regardless of the contents of the RAM underneath.
  forEachProfile(
    "should keep a directly published conditional sprite block visible",
    async (profile) => {
      const artifacts = await build(
        pushedIntoTheWindow(`c64.vic.setSpritePointer(0, ${SPRITE_BLOCK_CHOICE});`),
        profile,
      );

      expectVisibleBuffer(artifacts);
    },
  );

  // Holding the conditional result in an ordinary local must not lose the
  // placement demand from the hardware consumer.
  forEachProfile(
    "should keep a conditional sprite block visible when held in a local first",
    async (profile) => {
      const artifacts = await build(
        pushedIntoTheWindow(`let block: byte = ${SPRITE_BLOCK_CHOICE};
  c64.vic.setSpritePointer(0, block);`),
        profile,
      );

      expectVisibleBuffer(artifacts);
    },
  );

  // The helper's result reaches the chip through a second function's conditional.
  // Returning a constant on the other path cannot make an invisible home safe.
  forEachProfile(
    "should keep a sprite block visible through a helper and a conditional return",
    async (profile) => {
      const artifacts = await build(
        pushedIntoTheWindow(
          "c64.vic.setSpritePointer(0, chosenBlock());",
          `function blockOf(): byte { return lo(&buffer / 64); }
function chosenBlock(): byte { return peek($0400) == 0 ? blockOf() : 0; }`,
        ),
        profile,
      );

      expectVisibleBuffer(artifacts);
    },
  );

  // A non-hardware consumer does not require visibility to the video chip.
  // Comparing the same conditional with only its consumer changed keeps this
  // rule about the consumer, rather than about division by the sprite block size.
  forEachProfile(
    "should leave the same conditional arithmetic alone without a VIC consumer",
    async (profile) => {
      const consumed = await build(
        pushedIntoTheWindow(`c64.vic.setSpritePointer(0, ${SPRITE_BLOCK_CHOICE});`),
        profile,
      );
      const ordinary = await build(
        pushedIntoTheWindow(`poke($C000, ${SPRITE_BLOCK_CHOICE});`),
        profile,
      );

      expect(
        bufferAddress(ordinary),
        "ordinary arithmetic must not be moved for the chip's benefit",
      ).not.toBe(bufferAddress(consumed));
    },
  );

  // A colour is an ordinary number, not an address the chip fetches through.
  // The array is one byte larger than the largest contiguous visible interval,
  // so an accidental visibility demand would reject an otherwise legal program.
  forEachProfile(
    "should build when a helper-derived block number is used only as a border colour",
    async (profile) => {
      await build(
        `module Game;
let buffer: byte[8193];
function blockOf(): byte { return lo(&buffer / 64); }
function main(): void { c64.vic.setBorderColor(blockOf()); }`,
        profile,
      );
    },
  );

  // The first argument selects a sprite; only the second selects fetched data.
  // Computing the index from this oversized array must not constrain its home.
  forEachProfile(
    "should build when an oversized array's block number is used only as the sprite index",
    async (profile) => {
      await build(
        `module Game;
let buffer: byte[8193];
function main(): void { c64.vic.setSpritePointer(lo(&buffer / 64), 128); }`,
        profile,
      );
    },
  );
});
