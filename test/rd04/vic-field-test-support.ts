/**
 * Shared fixtures for the VIC field capability oracle.
 *
 * The cases need a real public build, a resolved address read from public debug
 * metadata, and one shared view of what an author is actually told — the message
 * and the help line together, because either alone misses half of it. They live
 * here so the cases stay in one readable file, the way the sibling root suites
 * keep their own fixtures.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { readProfileArtifacts, withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

/** Artifacts retained from one successful public build. */
export type BuildArtifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;

/** The chip fetches only inside its own 16 KiB bank. */
export const VIC_BANK_END = 0x3fff;

/** In this window the chip reads character ROM instead of the RAM underneath. */
export const CHARACTER_ROM = { start: 0x1000, end: 0x1fff } as const;

/** Expensive shapes need only one representative of the cooperative profile family. */
export const REFERENCE_PROFILE = "c64-pal-prg-kernal-6581";

/**
 * The refused wording that sends the author nowhere: `&buffer` already is a
 * constant, symbolic address, so demanding one names nothing they can change.
 */
export const UNACTIONABLE = /constant\s+or\s+symbolic/iu;

/**
 * An actionable refusal points at something in the author's own source: a
 * spelling they can type (`&object`, `embed()`), the declaration site to move
 * the data to (module level, a `zeropage` block, a `place(` clause), or the
 * explicit constraint they wrote. Naming a category instead leaves them
 * guessing, and no rewording of the superseded phrase can satisfy this, because
 * it points at neither a spelling nor a construct.
 */
export const NAMES_SOMETHING_THE_AUTHOR_CAN_CHANGE =
  /&[A-Za-z_]|embed\(|module[\s-]level|zeropage|place\(|explicit constraint/iu;

/**
 * Advice for addressing one frame of a sheet has to show the arithmetic moving
 * to the block number: an address-of form with an addition after it. Generic
 * advice to pass an address straight to the field has no addition, so it cannot
 * satisfy this.
 */
export const RECOMMENDS_ADDING_A_BLOCK_NUMBER = /&[A-Za-z_][^;\n]*\+/u;

/**
 * An element wider than one block spans several of them, so the step added to
 * the block number has to be multiplied by however many. Advice that adds a
 * bare index selects the wrong part of the element, and the two cannot both
 * satisfy this, which is what keeps the narrow and wide cases apart.
 */
export const RECOMMENDS_A_SCALED_STEP = /&[A-Za-z_][^;\n]*\+[^;\n]*\*/u;

/** Give an embedded asset file deterministic, recognisable contents. */
export function assetBytes(count: number): Buffer {
  return Buffer.from(Array.from({ length: count }, (_unused, index) => (index * 7 + 3) & 0xff));
}

/**
 * Build one program whose unconstrained objects land in the character-ROM
 * window. The uninitialised 2,400-byte pad is written once so it stays live:
 * initialising it would push later data past the window and hide the defect.
 */
export function windowProgram(declarations: string, body: string): string {
  return `module Game;
let pad: byte[2400];
${declarations}
function main(): void { pad[0] = 1; ${body} }`;
}

/**
 * Require a successful real build and retain its artifacts before temporary
 * cleanup. Asset files are written beside the module source, which is where an
 * `embed()` path is resolved from.
 */
export async function build(
  source: string,
  profile: string,
  assets: Readonly<Record<string, Buffer>> = {},
): Promise<BuildArtifacts> {
  return withProfileProject(source, profile, async (project, root) => {
    for (const [name, bytes] of Object.entries(assets))
      await writeFile(join(root, "src", name), bytes);
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") throw new Error("Expected a successful public build");
    return readProfileArtifacts(built);
  });
}

/**
 * Read everything the author actually sees for one diagnostic. The requirement
 * clause and the concrete action are separate fields, so judging the wording
 * from the message alone would miss the half that tells them what to do.
 */
export function authorText(diagnostic: { readonly message: string }): string {
  const help = record(diagnostic)?.help;
  return typeof help === "string" ? `${diagnostic.message}\n${help}` : diagnostic.message;
}

/**
 * Require a refused build and return the author-visible text of every placement
 * diagnostic, so a case can assert what they are told without depending on
 * diagnostic ordering.
 */
export async function refusalTexts(
  source: string,
  profile: string,
  assets: Readonly<Record<string, Buffer>> = {},
): Promise<string[]> {
  return withProfileProject(source, profile, async (project, root) => {
    for (const [name, bytes] of Object.entries(assets))
      await writeFile(join(root, "src", name), bytes);
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind).toBe("failure");
    if (built.kind !== "failure") throw new Error("Expected a refused placement");
    const texts = built.diagnostics
      .filter((diagnostic) => diagnostic.code === "E10273")
      .map(authorText);
    expect(texts.length, JSON.stringify(built.diagnostics)).toBeGreaterThan(0);
    return texts;
  });
}

/**
 * Require a refusal the author can act on: no restatement of what they already
 * wrote, and something in their own source to change instead. Every refusal is
 * held to this, because a predicate with exemptions stops meaning anything.
 */
export function expectActionable(texts: readonly string[]): void {
  for (const text of texts) expect(text).not.toMatch(UNACTIONABLE);
  expect(texts.join("\n")).toMatch(NAMES_SOMETHING_THE_AUTHOR_CAN_CHANGE);
}

/** Narrow untrusted debug JSON before resolving a public symbol. */
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Resolve one named global's final address without confusing it with other globals. */
export function globalAddress(artifacts: BuildArtifacts, name: string, byteWidth: number): number {
  const symbols = artifacts.debug.symbols;
  const locations = artifacts.debug.locations;
  if (!Array.isArray(symbols) || !Array.isArray(locations))
    throw new TypeError("Expected public debug symbols and locations");
  const labelPrefix = `b65_Game_${name}_`;
  const matches = symbols.filter((raw) => {
    const symbol = record(raw);
    return (
      symbol?.kind === "global" &&
      Array.isArray(symbol.labels) &&
      symbol.labels.some(
        (label: unknown) => typeof label === "string" && label.startsWith(labelPrefix),
      )
    );
  });
  expect(matches, `Expected exactly one public global named ${name}`).toHaveLength(1);
  const symbol = record(matches[0]);
  expect(symbol?.byteWidth, `${name} must remain completely allocated`).toBe(byteWidth);
  const indexes = symbol?.locationIndexes;
  if (!Array.isArray(indexes) || indexes.length === 0)
    throw new Error(`${name} has no public location`);
  const starts = new Set<number>();
  for (const index of indexes) {
    if (
      typeof index !== "number" ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= locations.length
    )
      throw new TypeError(`${name} has an invalid location index`);
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
  if (start === undefined) throw new Error(`${name} has no integral machine start`);
  return start;
}

/**
 * Require every byte the chip will fetch from this run to be readable: inside
 * the selected bank, and clear of the window where character ROM replaces RAM.
 * A run that fails either test assembles into data the chip cannot see.
 */
export function expectVisibleRun(start: number, bytes: number, what: string): void {
  const end = start + bytes - 1;
  const description = `${what} at $${start.toString(16)}-$${end.toString(16)}`;
  expect(start, description).toBeGreaterThanOrEqual(0);
  expect(end, `${description} must stay inside the VIC bank`).toBeLessThanOrEqual(VIC_BANK_END);
  expect(
    start <= CHARACTER_ROM.end && end >= CHARACTER_ROM.start,
    `${description} would read character ROM instead of the author's data`,
  ).toBe(false);
}

/** Give each cooperative profile an independent case with time for real assembly. */
export function forEachProfile(
  name: string,
  body: (profile: (typeof sourceLibraryProfiles)[number]) => Promise<void>,
): void {
  for (const profile of sourceLibraryProfiles)
    it(`${profile}: ${name}`, () => body(profile), 120_000);
}

/** Run one reference-profile case; the cheap core shapes carry the profile sweep. */
export function onReferenceProfile(name: string, body: () => Promise<void>): void {
  it(`${REFERENCE_PROFILE}: ${name}`, body, 120_000);
}
