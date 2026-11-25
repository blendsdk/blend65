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
 * character-ROM window. Without this padding, placement below the window would
 * hide a missing visibility demand across the helper's return.
 */
function pushedIntoTheWindow(use: string): string {
  return `module Game;
let pad: byte[2400];
let buffer: byte[64];
function blockOf(): byte { return lo(&buffer / 64); }
function main(): void { pad[0] = 1; ${use} }`;
}

/** Give each cooperative profile an independent case with time for real assembly. */
function forEachProfile(
  name: string,
  body: (profile: (typeof sourceLibraryProfiles)[number]) => Promise<void>,
): void {
  for (const profile of sourceLibraryProfiles)
    it(`${profile}: ${name}`, () => body(profile), 120_000);
}

describe("returned block-index VIC visibility", () => {
  // A function boundary must not hide the hardware consumer. The compiler chooses
  // this buffer's home, so it must choose RAM the chip can actually fetch.
  forEachProfile(
    "should place a helper-returned sprite block inside the bank and outside character ROM",
    async (profile) => {
      const artifacts = await build(
        pushedIntoTheWindow("c64.vic.setSpritePointer(0, blockOf());"),
        profile,
      );

      const start = bufferAddress(artifacts);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(start + 63).toBeLessThanOrEqual(VIC_BANK_END);
      const overlaps = start <= CHARACTER_ROM.end && start + 63 >= CHARACTER_ROM.start;
      expect(overlaps, `buffer at $${start.toString(16)} is invisible to the VIC`).toBe(false);
    },
  );

  // Ordinary address arithmetic does not acquire a hardware placement demand
  // merely because a helper divides an address by the sprite block size.
  forEachProfile(
    "should leave helper-returned arithmetic alone when no VIC consumer receives it",
    async (profile) => {
      const consumed = await build(
        pushedIntoTheWindow("c64.vic.setSpritePointer(0, blockOf());"),
        profile,
      );
      const ordinary = await build(pushedIntoTheWindow("poke($C000, blockOf());"), profile);

      expect(
        bufferAddress(ordinary),
        "ordinary arithmetic must not be moved for the chip's benefit",
      ).not.toBe(bufferAddress(consumed));
    },
  );

  // An explicit address belongs to the author, even outside the chip's bank.
  // Returning its block number through a helper must not relocate it or reject it.
  forEachProfile(
    "should preserve an explicit unreachable address published through a helper",
    async (profile) => {
      const artifacts = await build(
        `module Game;
place(at: $C040) let buffer: byte[64];
function blockOf(): byte { return lo(&buffer / 64); }
function main(): void { c64.vic.setSpritePointer(0, blockOf()); }`,
        profile,
      );

      expect(bufferAddress(artifacts)).toBe(0xc040);
    },
  );
});
