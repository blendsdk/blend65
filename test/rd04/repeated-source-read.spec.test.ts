import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cachedBuildProject } from "../build-cache.js";
import { withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

/**
 * One module byte is read, stored somewhere else, and read again. A store writes
 * neither the accumulator nor any flag, so the second read fetches a byte the
 * processor already holds, with N and Z already describing it.
 */
const twoPlainReads = `module Game;
let seed: byte = 7;
let first: byte = 0;
let second: byte = 0;
function main(): void {
  first = seed;
  second = seed;
}`;

/** The repeated read feeds arithmetic rather than another bare store. */
const maskedSecondRead = `module Game;
let seed: byte = 7;
let value: byte = 0;
let masked: byte = 0;
function main(): void {
  value = seed;
  masked = seed & 7;
}`;

/** The shape as reported: a shifted operand and its masked count share one source. */
const shiftedOperand = `module Game;
let seed: byte = 7;
let answer: byte = 0;
function main(): void {
  let value: byte = seed;
  let count: byte = seed & 7;
  answer = value << count;
}`;

/** The intervening store writes the very byte the second read names. */
const storeToSource = `module Game;
let seed: byte = 7;
let answer: byte = 0;
function main(): void {
  let value: byte = seed;
  seed = 3;
  answer = seed & 7;
  answer = answer + value;
}`;

/** A callee stands between the reads and may write anything it can reach. */
const callBetween = `module Game;
let seed: byte = 7;
let answer: byte = 0;
let other: byte = 0;
function bump(): void { other = other + 1; }
function main(): void {
  let value: byte = seed;
  bump();
  let count: byte = seed & 7;
  answer = value << count;
}`;

/** A live handler can run between the two reads and write the source. */
const installedHandler = `module Game;
import { setIRQ, restoreIRQ } from c64.system;
let seed: byte = 7;
let answer: byte = 0;
let ticks: byte = 0;
interrupt function tick(): void { ticks = ticks + 1; }
function main(): void {
  setIRQ(&tick);
  let value: byte = seed;
  let count: byte = seed & 7;
  answer = value << count;
  restoreIRQ();
}`;

/** A hardware register read is two bus accesses by contract, not one value twice. */
const volatileSource = `module Game;
let first: byte = 0;
let second: byte = 0;
function main(): void {
  first = peek($d012);
  second = peek($d012);
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

/** Build one source on one profile at one goal and read the named routine. */
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

/** How many times one operand is loaded into the accumulator in a routine. */
function reads(body: readonly string[], operand: string): number {
  return body.filter((line) => line === `lda ${operand}`).length;
}

const SEED = "b65_Game_seed_";

describe.each(sourceLibraryProfiles)("repeated source read on %s", (profile) => {
  it("should read a source once and store it to both destinations", async () => {
    const body = await build(twoPlainReads, profile, "balanced");
    expect(reads(body, SEED)).toBe(1);
    expect(body.slice(0, 3)).toEqual([
      `lda ${SEED}`,
      "sta b65_Game_first_",
      "sta b65_Game_second_",
    ]);
  }, 120_000);

  it("should mask the byte it already holds instead of fetching it again", async () => {
    const body = await build(maskedSecondRead, profile, "balanced");
    expect(reads(body, SEED)).toBe(1);
    expect(body.slice(0, 4)).toEqual([
      `lda ${SEED}`,
      "sta b65_Game_value_",
      "and #$07",
      "sta b65_Game_masked_",
    ]);
  }, 120_000);

  it("should read one source once when an operand and its count share it", async () => {
    const body = await build(shiftedOperand, profile, "balanced");
    expect(reads(body, SEED)).toBe(1);
  }, 120_000);

  it("should read the source once at every optimized goal", async () => {
    const [speed, size] = await Promise.all([
      build(twoPlainReads, profile, "speed"),
      build(twoPlainReads, profile, "size"),
    ]);
    expect(reads(speed, SEED)).toBe(1);
    expect(reads(size, SEED)).toBe(1);
  }, 120_000);

  it("should read the source once with bounds checks enabled", async () => {
    const body = await build(twoPlainReads, profile, "balanced", { boundsCheck: true });
    expect(reads(body, SEED)).toBe(1);
  }, 120_000);

  it("should keep the canonical reference reading the source twice", async () => {
    const body = await build(twoPlainReads, profile, "none");
    expect(reads(body, SEED)).toBe(2);
  }, 120_000);

  it("should read the source again after a store to that same source", async () => {
    const body = await build(storeToSource, profile, "balanced");
    expect(reads(body, SEED)).toBe(2);
  }, 120_000);

  it("should read the source again after a call", async () => {
    const body = await build(callBetween, profile, "balanced");
    expect(reads(body, SEED)).toBe(2);
  }, 120_000);

  it("should read the source again when a handler is installed", async () => {
    const body = await build(installedHandler, profile, "balanced");
    expect(reads(body, SEED)).toBe(2);
  }, 120_000);

  it("should keep both accesses to a volatile hardware source", async () => {
    const body = await build(volatileSource, profile, "balanced");
    expect(reads(body, "$d012")).toBe(2);
  }, 120_000);
});
