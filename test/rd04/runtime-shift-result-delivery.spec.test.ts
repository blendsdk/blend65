import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cachedBuildProject } from "../build-cache.js";
import { withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

/**
 * A runtime-count shift leaves its result in the accumulator on every path out
 * of its loop, and the only consumer is the next whole-byte store. Staging that
 * byte in a temporary and reading it straight back is pure traffic.
 */
const leftShift = `module Game;
let seed: byte = 7;
let answer: byte = 0;
function main(): void {
  let count: byte = seed & 7;
  answer = 1 << count;
}`;

/** The same delivery with the opposite direction. */
const rightShift = `module Game;
let seed: byte = 7;
let answer: byte = 0;
function main(): void {
  let count: byte = seed & 7;
  answer = byte(128) >> count;
}`;

/** An unproved count keeps its saturation arm, which reaches the same delivery. */
const unboundedShift = `module Game;
let seed: byte = 7;
let answer: byte = 0;
function main(): void {
  answer = 1 << seed;
}`;

/** A second reader needs the byte after the accumulator has moved on. */
const twoReaders = `module Game;
let seed: byte = 7;
let answer: byte = 0;
let other: byte = 0;
function main(): void {
  let count: byte = seed & 7;
  let shifted: byte = 1 << count;
  answer = shifted;
  other = shifted;
}`;

/**
 * A live handler is installed around the shift, so the restore sequence runs
 * next and pushes the whole status register. That read observes the flags the
 * delivered store would otherwise leave behind.
 */
const installedHandler = `module Game;
import { setIRQ, restoreIRQ } from c64.system;
let seed: byte = 7;
let answer: byte = 0;
let ticks: byte = 0;
interrupt function tick(): void { ticks = ticks + 1; }
function main(): void {
  setIRQ(&tick);
  let count: byte = seed & 7;
  answer = 1 << count;
  restoreIRQ();
}`;

/** An ordinary callee's delivery ends at a return, whose caller owns the flags. */
const calledFunction = `module Game;
let seed: byte = 7;
let answer: byte = 0;
function apply(): void {
  let count: byte = seed & 7;
  answer = 1 << count;
}
function main(): void { apply(); }`;

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
 * The instruction that receives the shifted byte: the shift loop is always one
 * shift, one `dex` and one backward branch, whatever follows it is the delivery.
 */
function delivery(body: readonly string[]): string {
  const shift = body.findIndex((line) => line === "asl" || line === "lsr");
  if (shift < 0) throw new Error("Missing the runtime-count shift loop");
  expect(body.slice(shift + 1, shift + 3)).toEqual(["dex", expect.stringMatching(/^bne /u)]);
  const delivered = body[shift + 3];
  if (delivered === undefined) throw new Error("Missing the instruction after the shift loop");
  return delivered;
}

/** Every adjacent store and reload of one identical operand still in the routine. */
function stagedPairs(body: readonly string[]): readonly string[] {
  const pairs: string[] = [];
  for (let at = 0; at + 1 < body.length; at += 1) {
    const [store, load] = [body[at]!, body[at + 1]!];
    const operand = /^sta (.+)$/u.exec(store)?.[1];
    if (operand !== undefined && load === `lda ${operand}`) pairs.push(operand);
  }
  return pairs;
}

describe.each(sourceLibraryProfiles)("runtime-count shift result delivery on %s", (profile) => {
  it("should store a left-shifted result straight into its destination", async () => {
    const body = await build(leftShift, profile, "balanced");
    expect(delivery(body)).toBe("sta b65_Game_answer_");
    expect(stagedPairs(body)).toEqual([]);
  }, 120_000);

  it("should store a right-shifted result straight into its destination", async () => {
    const body = await build(rightShift, profile, "balanced");
    expect(delivery(body)).toBe("sta b65_Game_answer_");
    expect(stagedPairs(body)).toEqual([]);
  }, 120_000);

  it("should deliver the same way at every optimized goal", async () => {
    const [speed, size] = await Promise.all([
      build(leftShift, profile, "speed"),
      build(leftShift, profile, "size"),
    ]);
    expect(delivery(speed)).toBe("sta b65_Game_answer_");
    expect(delivery(size)).toBe("sta b65_Game_answer_");
  }, 120_000);

  it("should deliver the same way with bounds checks enabled", async () => {
    const body = await build(leftShift, profile, "balanced", { boundsCheck: true });
    expect(delivery(body)).toBe("sta b65_Game_answer_");
    expect(stagedPairs(body)).toEqual([]);
  }, 120_000);

  it("should deliver an unproved count's result directly as well", async () => {
    const body = await build(unboundedShift, profile, "balanced");
    expect(delivery(body)).toBe("sta b65_Game_answer_");
    expect(stagedPairs(body)).toEqual([]);
  }, 120_000);

  it("should keep the canonical reference staging the result", async () => {
    const body = await build(leftShift, profile, "none");
    const delivered = delivery(body);
    expect(delivered).toMatch(/^sta \$[0-9a-f]+$/u);
    expect(stagedPairs(body)).toEqual([delivered.slice(4)]);
  }, 120_000);

  it("should keep the staging home a second reader needs", async () => {
    const body = await build(twoReaders, profile, "balanced");
    expect(delivery(body)).toMatch(/^sta \$[0-9a-f]+$/u);
    expect(stagedPairs(body)).toHaveLength(1);
  }, 120_000);

  it("should keep the staging home under an installed handler", async () => {
    const body = await build(installedHandler, profile, "balanced");
    expect(delivery(body)).toMatch(/^sta \$[0-9a-f]+$/u);
    expect(stagedPairs(body)).toHaveLength(1);
  }, 120_000);

  it("should keep the staging home where the delivery ends at a return", async () => {
    const body = await build(calledFunction, profile, "balanced", { routine: "apply" });
    expect(delivery(body)).toMatch(/^sta \$[0-9a-f]+$/u);
    expect(stagedPairs(body)).toHaveLength(1);
  }, 120_000);
});
