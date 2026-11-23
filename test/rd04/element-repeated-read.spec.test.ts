import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cachedBuildProject } from "../build-cache.js";
import { withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

/**
 * One fixed array element is read, stored somewhere else, and read again. A
 * store writes neither the accumulator nor any flag, so the repeat fetches a
 * byte the processor already holds with N and Z already describing it.
 *
 * An element differs from a whole binding in where its load lives: a whole
 * binding's byte arrives at the head of the consuming operation, while an
 * element emits its own load, so omitting the repeat means that operation
 * contributes no generated code at all.
 */
const twoBareStores = `module Game;
let data: byte[4] = [;0];
let first: byte = 0;
let second: byte = 0;
function main(): void {
  first = data[2];
  second = data[2];
}`;

/** The repeat feeds arithmetic rather than another bare store. */
const maskedSecondRead = `module Game;
let data: byte[4] = [;0];
let value: byte = 0;
let masked: byte = 0;
function main(): void {
  value = data[2];
  masked = data[2] & 7;
}`;

/** Three readers of one element, so the window has to carry on past the first repeat. */
const threeReads = `module Game;
let data: byte[4] = [;0];
let first: byte = 0;
let second: byte = 0;
let third: byte = 0;
function main(): void {
  first = data[2];
  second = data[2];
  third = data[2];
}`;

/** Element zero, whose address carries no offset of its own. */
const elementZero = `module Game;
let data: byte[4] = [;0];
let first: byte = 0;
let second: byte = 0;
function main(): void {
  first = data[0];
  second = data[0];
}`;

/** A run-time ordinal: the two reads are not proved to address one element. */
const runtimeIndex = `module Game;
let data: byte[4] = [;0];
let pick: byte = 1;
let first: byte = 0;
let second: byte = 0;
function main(): void {
  let i: byte = pick & 3;
  first = data[i];
  second = data[i];
}`;

/** The intervening store writes the array being read, which ends the window. */
const storeIntoArray = `module Game;
let data: byte[4] = [;0];
let first: byte = 0;
function main(): void {
  first = data[2];
  data[1] = 9;
  first = data[2];
}`;

/** A live handler can run between the two reads and write the element. */
const installedHandler = `module Game;
import { setIRQ, restoreIRQ } from c64.system;
let data: byte[4] = [;0];
let first: byte = 0;
let second: byte = 0;
let ticks: byte = 0;
interrupt function tick(): void { ticks = ticks + 1; }
function main(): void {
  setIRQ(&tick);
  first = data[2];
  second = data[2];
  restoreIRQ();
}`;

/** A callee stands between the reads and may write anything it can reach. */
const callBetweenReads = `module Game;
let data: byte[4] = [;0];
let first: byte = 0;
let second: byte = 0;
let other: byte = 0;
function bump(): void { other = other + 1; }
function main(): void {
  first = data[2];
  bump();
  second = data[2];
}`;

/**
 * Instructions of one generated routine, without labels, origins or comments.
 * The assembler's operand-width hint is dropped and generated label identities
 * are collapsed, so nothing here depends on a chosen address or encoding.
 */
async function routine(directory: string, name: string): Promise<readonly string[]> {
  const lines = (await readFile(join(directory, ".asm"), "utf8")).split("\n");
  const body: string[] = [];
  let inside = false;
  for (const line of lines) {
    if (new RegExp(`^b65_Game_${name}_`, "u").test(line)) {
      inside = true;
      continue;
    }
    if (inside && /^b65_/u.test(line) && !line.includes(`_${name}_`)) break;
    const text = line.trim();
    if (!inside || text.length === 0 || text.startsWith(";") || text.startsWith("*")) continue;
    body.push(text.replace(/^(\w+)\+\d+/u, "$1").replace(/_[0-9a-f]{8}[0-9a-f]*/gu, "_"));
  }
  if (body.length === 0) throw new Error(`Missing generated routine Game.${name}`);
  return body;
}

/** Build one source on one profile at one goal and read `Game.main`. */
async function build(
  source: string,
  profile: string,
  optimization: "none" | "balanced" | "speed" | "size",
  options: { readonly boundsCheck?: boolean } = {},
): Promise<readonly string[]> {
  return withProfileProject(source, profile, async (project) => {
    const built = await cachedBuildProject({
      project,
      optimization,
      ...(options.boundsCheck === undefined ? {} : { boundsCheck: options.boundsCheck }),
    });
    if (built.kind !== "success")
      throw new Error(`Build failed: ${JSON.stringify(built.diagnostics)}`);
    return routine(built.generation.directory, "main");
  });
}

/** How many times the array is loaded into the accumulator, at any element. */
function elementReads(body: readonly string[]): number {
  return body.filter((line) => /^lda b65_Game_data_/u.test(line)).length;
}

const ELEMENT_TWO = "lda b65_Game_data_ + $0002";

describe.each(sourceLibraryProfiles)("a fixed element read twice on %s", (profile) => {
  it("should read the element once and store it to both destinations", async () => {
    const body = await build(twoBareStores, profile, "balanced");
    expect(body.slice(0, 3)).toEqual([ELEMENT_TWO, "sta b65_Game_first_", "sta b65_Game_second_"]);
    expect(elementReads(body)).toBe(1);
  }, 120_000);

  it("should mask the byte it already holds instead of fetching it again", async () => {
    const body = await build(maskedSecondRead, profile, "balanced");
    expect(body.slice(0, 4)).toEqual([
      ELEMENT_TWO,
      "sta b65_Game_value_",
      "and #$07",
      "sta b65_Game_masked_",
    ]);
    expect(elementReads(body)).toBe(1);
  }, 120_000);

  it("should read the element once for three readers", async () => {
    const body = await build(threeReads, profile, "balanced");
    expect(body.slice(0, 4)).toEqual([
      ELEMENT_TWO,
      "sta b65_Game_first_",
      "sta b65_Game_second_",
      "sta b65_Game_third_",
    ]);
    expect(elementReads(body)).toBe(1);
  }, 120_000);

  it("should read element zero once, where the address carries no offset", async () => {
    const body = await build(elementZero, profile, "balanced");
    expect(elementReads(body)).toBe(1);
  }, 120_000);

  it("should read the element once at every optimized goal", async () => {
    for (const goal of ["speed", "size"] as const) {
      const body = await build(twoBareStores, profile, goal);
      expect(elementReads(body)).toBe(1);
    }
  }, 120_000);

  it("should read the element once with bounds checks enabled", async () => {
    const body = await build(twoBareStores, profile, "balanced", { boundsCheck: true });
    expect(elementReads(body)).toBe(1);
  }, 120_000);

  it("should keep the canonical reference reading the element twice", async () => {
    const body = await build(twoBareStores, profile, "none");
    expect(elementReads(body)).toBe(2);
  }, 120_000);

  it("should keep both reads where the element is chosen at run time", async () => {
    const body = await build(runtimeIndex, profile, "balanced");
    expect(elementReads(body)).toBeGreaterThanOrEqual(2);
  }, 120_000);

  it("should keep both reads where the store writes the array itself", async () => {
    const body = await build(storeIntoArray, profile, "balanced");
    expect(elementReads(body)).toBe(2);
  }, 120_000);

  it("should keep both reads under an installed handler", async () => {
    const body = await build(installedHandler, profile, "balanced");
    expect(elementReads(body)).toBe(2);
  }, 120_000);

  it("should keep both reads where a call stands between them", async () => {
    const body = await build(callBetweenReads, profile, "balanced");
    expect(elementReads(body)).toBe(2);
  }, 120_000);
});
