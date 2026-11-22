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

/** The chip fetches only inside its own 16K bank. */
const VIC_BANK_END = 0x3fff;

/** Inside this window the chip reads character ROM instead of the RAM underneath. */
const CHARACTER_ROM = { start: 0x1000, end: 0x1fff } as const;

/** Build one source on one profile and retain every public artifact under test. */
async function build(source: string, profile: string): Promise<ObservedBuild> {
  return withProfileProject(source, profile, async (project) => {
    const built = await buildProject({ project, optimization: "none" });
    if (built.kind !== "success") return built;
    return { kind: "success", artifacts: await readProfileArtifacts(built) };
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
  // Each project below declares exactly one 64-byte global, so a match cannot be
  // satisfied by an unrelated object.
  const matches = symbols.filter((raw) => {
    const symbol = record(raw);
    return symbol?.kind === "global" && symbol.byteWidth === 64;
  });
  if (matches.length !== 1) throw new Error("Expected exactly one 64-byte public global");
  const indexes = record(matches[0])?.locationIndexes;
  if (!Array.isArray(indexes) || indexes.length === 0)
    throw new Error("The 64-byte global has no location");
  const pieces = record(record(locations[indexes[0]])?.availability)?.pieces;
  if (!Array.isArray(pieces)) throw new Error("The 64-byte global has no available pieces");
  for (const piece of pieces) {
    const machine = record(record(piece)?.machine);
    if (typeof machine?.start === "number") return machine.start;
  }
  throw new Error("The 64-byte global has no machine start");
}

/**
 * Declare enough automatically placed storage ahead of the buffer that a layout
 * which ignores VIC visibility lands it inside the character-ROM window. Without
 * the padding the buffer fits below the window and every case passes trivially.
 */
const pushedIntoTheWindow = (use: string) => `module Game;
let pad: byte[2400];
let buffer: byte[64];
let slot: byte;
function main(): void { pad[0] = 1; ${use} }`;

const forEachProfile = (
  name: string,
  body: (profile: (typeof sourceLibraryProfiles)[number]) => Promise<void>,
) => {
  for (const profile of sourceLibraryProfiles)
    it(`${profile}: ${name}`, () => body(profile), 120_000);
};

describe("block-index VIC visibility", () => {
  // A sprite block the chip cannot fetch displays unrelated memory. The compiler
  // chooses this address itself, so a home outside the bank is its own mistake
  // rather than something the author asked for.
  forEachProfile(
    "should keep an automatic block-index buffer inside the VIC bank",
    async (profile) => {
      const built = await build(
        pushedIntoTheWindow("c64.vic.setSpritePointer(0, lo(&buffer / 64));"),
        profile,
      );

      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") return;
      expect(bufferAddress(built.artifacts) + 63).toBeLessThanOrEqual(VIC_BANK_END);
    },
  );

  // In this window the chip reads character ROM and never the RAM beneath it, so
  // a block placed here is fetched as character shapes whatever the RAM holds.
  // Holding the block number in a variable first is ordinary style and must not
  // decide whether the sprite can be seen.
  for (const [shape, body] of [
    ["published directly", "c64.vic.setSpritePointer(0, lo(&buffer / 64));"],
    [
      "held in a local first",
      "let block: byte = lo(&buffer / 64);\n  c64.vic.setSpritePointer(0, block);",
    ],
    [
      "held in a module variable first",
      "slot = lo(&buffer / 64);\n  c64.vic.setSpritePointer(0, slot);",
    ],
  ] as const) {
    forEachProfile(
      `should keep an automatic block-index buffer out of the character-ROM window, ${shape}`,
      async (profile) => {
        const built = await build(pushedIntoTheWindow(body), profile);

        expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
          "success",
        );
        if (built.kind !== "success") return;
        const start = bufferAddress(built.artifacts);
        const overlaps = start <= CHARACTER_ROM.end && start + 63 >= CHARACTER_ROM.start;
        expect(overlaps, `buffer at $${start.toString(16)} is invisible to the VIC`).toBe(false);
      },
    );
  }

  // The same arithmetic with no hardware consumer is ordinary address maths. It
  // must keep compiling and must not have its home narrowed, which is what makes
  // the two cases above a statement about the consumer and not about `/ 64`.
  forEachProfile(
    "should leave the same arithmetic alone when no VIC consumer receives it",
    async (profile) => {
      const consumed = await build(
        pushedIntoTheWindow("c64.vic.setSpritePointer(0, lo(&buffer / 64));"),
        profile,
      );
      const ordinary = await build(pushedIntoTheWindow("poke($C000, lo(&buffer / 64));"), profile);

      expect(
        ordinary.kind,
        ordinary.kind === "failure" ? JSON.stringify(ordinary.diagnostics) : "",
      ).toBe("success");
      if (ordinary.kind !== "success" || consumed.kind !== "success") return;
      expect(
        bufferAddress(ordinary.artifacts),
        "ordinary arithmetic must not be moved for the chip's benefit",
      ).not.toBe(bufferAddress(consumed.artifacts));
    },
  );

  // An explicit address is the author's contract. This one is 64-aligned and
  // still outside the bank, and it is accepted exactly as written: reporting it
  // would have to be a warning, and no contract for one exists yet.
  forEachProfile("should preserve an explicit address the chip cannot reach", async (profile) => {
    const built = await build(
      `module Game;
place(at: $C040) let buffer: byte[64];
function main(): void { c64.vic.setSpritePointer(0, lo(&buffer / 64)); }`,
      profile,
    );

    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") return;
    expect(bufferAddress(built.artifacts)).toBe(0xc040);
  });
});
