import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cachedBuildProject } from "../build-cache.js";
import { withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

/**
 * A compiler-chosen home is read, stored into a second home, and read again. A
 * store writes neither the accumulator nor any flag, so the repeat fetches a
 * byte the processor already holds with N and Z already describing it. What
 * keeps the two homes apart is allocation rather than their names, which is the
 * only reason this needed a separate fact from a declared source.
 */
const localReadTwice = `module Game;
let seed: byte = 7;
let answer: byte = 0;
function main(): void {
  let base: byte = seed + 1;
  let value: byte = base;
  let count: byte = base & 7;
  answer = value << count;
}`;

/** An incoming parameter lives in a home too, and is the plainest form of the shape. */
const parameterReadTwice = `module Game;
let first: byte = 0;
let second: byte = 0;
function use(v: byte): void {
  first = v;
  second = v;
}
function main(): void { use(5); }`;

/** The home written between the reads is itself read later, so both stay live. */
const bothHomesReadAgain = `module Game;
let seed: byte = 7;
let answer: byte = 0;
let other: byte = 0;
function main(): void {
  let base: byte = seed + 1;
  let value: byte = base;
  let count: byte = base & 7;
  answer = value << count;
  other = value;
}`;

/** The intervening store writes the very home the repeat names, which ends the window. */
const storeToTheHome = `module Game;
let seed: byte = 7;
let answer: byte = 0;
function main(): void {
  let base: byte = seed + 1;
  base = 9;
  answer = base & 7;
}`;

/** A live handler can run between the two reads and write the home. */
const installedHandler = `module Game;
import { setIRQ, restoreIRQ } from c64.system;
let seed: byte = 7;
let answer: byte = 0;
let ticks: byte = 0;
interrupt function tick(): void { ticks = ticks + 1; }
function main(): void {
  setIRQ(&tick);
  let base: byte = seed + 1;
  let value: byte = base;
  let count: byte = base & 7;
  answer = value << count;
  restoreIRQ();
}`;

/** A callee stands between the reads and may write anything it can reach. */
const callBetweenReads = `module Game;
let seed: byte = 7;
let answer: byte = 0;
let other: byte = 0;
function bump(): void { other = other + 1; }
function main(): void {
  let base: byte = seed + 1;
  let value: byte = base;
  bump();
  let count: byte = base & 7;
  answer = value << count;
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
  options: { readonly routine?: string; readonly boundsCheck?: boolean } = {},
): Promise<readonly string[]> {
  return withProfileProject(source, profile, async (project) => {
    const built = await cachedBuildProject({
      project,
      optimization,
      ...(options.boundsCheck === undefined ? {} : { boundsCheck: options.boundsCheck }),
    });
    if (built.kind !== "success")
      throw new Error(`Build failed: ${JSON.stringify(built.diagnostics)}`);
    return routine(built.generation.directory, options.routine ?? "main");
  });
}

/**
 * Every home that is loaded more than once with only a store between the loads.
 * A home is addressed by number rather than by name, so the repeat is found from
 * the shape of the window instead of from a label the test would have to guess.
 */
function repeatedHomeReads(body: readonly string[]): readonly string[] {
  const repeats: string[] = [];
  for (let at = 0; at + 2 < body.length; at += 1) {
    const load = /^lda (\$[0-9a-f]+)$/u.exec(body[at]!);
    if (load === null || !/^sta /u.test(body[at + 1]!)) continue;
    if (body[at + 2] === body[at]) repeats.push(load[1]!);
  }
  return repeats;
}

describe.each(sourceLibraryProfiles)("a private home read twice on %s", (profile) => {
  it("should read a local once and keep using the byte it already holds", async () => {
    const body = await build(localReadTwice, profile, "balanced");
    expect(repeatedHomeReads(body)).toEqual([]);
  }, 120_000);

  it("should read an incoming parameter once and store it to both destinations", async () => {
    const body = await build(parameterReadTwice, profile, "balanced", { routine: "use" });
    expect(repeatedHomeReads(body)).toEqual([]);
    expect(body.slice(0, 4)).toEqual([
      expect.stringMatching(/^lda \$[0-9a-f]+$/u),
      "sta b65_Game_first_",
      "sta b65_Game_second_",
      "rts",
    ]);
  }, 120_000);

  it("should read the home once while both homes stay live", async () => {
    const body = await build(bothHomesReadAgain, profile, "balanced");
    expect(repeatedHomeReads(body)).toEqual([]);
    expect(body).toContain("sta b65_Game_other_");
  }, 120_000);

  it("should read the home once at every optimized goal", async () => {
    for (const goal of ["speed", "size"] as const) {
      const body = await build(localReadTwice, profile, goal);
      expect(repeatedHomeReads(body)).toEqual([]);
    }
  }, 120_000);

  it("should read the home once with bounds checks enabled", async () => {
    const body = await build(localReadTwice, profile, "balanced", { boundsCheck: true });
    expect(repeatedHomeReads(body)).toEqual([]);
  }, 120_000);

  it("should keep the canonical reference reading the home twice", async () => {
    const body = await build(localReadTwice, profile, "none");
    expect(repeatedHomeReads(body)).toHaveLength(1);
  }, 120_000);

  it("should keep both reads where the store writes the home itself", async () => {
    const plain = await build(storeToTheHome, profile, "balanced");
    const reference = await build(storeToTheHome, profile, "none");
    // Nothing is claimed about how this one is lowered, only that the optimized
    // build does not reach past a write to the very byte it would re-read.
    expect(repeatedHomeReads(plain)).toEqual(repeatedHomeReads(reference));
  }, 120_000);

  it("should keep both reads under an installed handler", async () => {
    const body = await build(installedHandler, profile, "balanced");
    expect(repeatedHomeReads(body)).toHaveLength(1);
  }, 120_000);

  it("should keep both reads where a call stands between them", async () => {
    const body = await build(callBetweenReads, profile, "balanced");
    const call = body.findIndex((line) => line.startsWith("jsr "));
    expect(call).toBeGreaterThan(1);
    // The callee can write anything it reaches, so the read after it stays. The
    // window is never even a candidate: it spans one load, one store and the
    // repeat, and a call does not fit between them.
    expect(body[call - 1]).toMatch(/^sta \$[0-9a-f]+$/u);
    expect(body[call + 1]).toBe(body[call - 2]);
    expect(body[call + 1]).toMatch(/^lda \$[0-9a-f]+$/u);
  }, 120_000);
});
