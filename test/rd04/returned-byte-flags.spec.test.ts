import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cachedBuildProject } from "../build-cache.js";
import { withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

/**
 * A byte handed back through the accumulator is tested by its caller. The call
 * convention promises no flags and the call itself encodes none, so the caller
 * stores the byte and reads it straight back only to learn whether it was zero.
 *
 * Whether that reload is needed is a fact about the callee's exits. Here the
 * body's last act is an `and`, which writes the accumulator and both flags from
 * the same byte, so the reload would only restate what the callee settled.
 */
const maskedReturned = `module Game;
let seed: byte = 7;
let answer: byte = 0;
function masked(): byte {
  return seed & 7;
}
function main(): void {
  if (masked() == 0) { answer = 9; }
}`;

/** The plainest producing exit: a load, which also settles both flags. */
const loadReturned = `module Game;
let seed: byte = 7;
let answer: byte = 0;
function fetch(): byte {
  return seed;
}
function main(): void {
  if (fetch() == 0) { answer = 9; }
}`;

/** Two exits which both settle the pair, so the weakest one still qualifies. */
const twoExitsAgree = `module Game;
let seed: byte = 7;
let answer: byte = 0;
function pick(): byte {
  if (seed > 3) { return 0; }
  return seed & 7;
}
function main(): void {
  if (pick() == 0) { answer = 9; }
}`;

/**
 * A runtime-count shift returned. Its value leaves the loop at a merge block
 * holding nothing but the return, reached either by falling out of `dex`/`bne`
 * or by the zero-count branch — so at the return the flags describe the loop
 * counter and say nothing about the byte in the accumulator. The caller's
 * reload is doing real work and has to stay.
 */
const shiftReturned = `module Game;
let seed: byte = 7;
let answer: byte = 0;
function shifted(): byte {
  let count: byte = seed & 7;
  return 1 << count;
}
function main(): void {
  if (shifted() == 0) { answer = 9; }
}`;

/** Two exits where one is that same shift merge, so the weakest one refuses. */
const twoExitsDisagree = `module Game;
let seed: byte = 7;
let answer: byte = 0;
function pick(): byte {
  if (seed > 3) { return 1 << (seed & 7); }
  return seed & 7;
}
function main(): void {
  if (pick() == 0) { answer = 9; }
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

/** The instructions the caller runs between its call and its branch on the result. */
function afterTheCall(body: readonly string[]): readonly string[] {
  const call = body.findIndex((line) => line.startsWith("jsr "));
  if (call < 0) throw new Error("Missing the call to the returning body");
  const branch = body.findIndex((line, at) => at > call && /^b(ne|eq) /u.test(line));
  if (branch < 0) throw new Error("Missing the caller's branch on the returned byte");
  return body.slice(call + 1, branch);
}

describe.each(sourceLibraryProfiles)("a returned byte tested by its caller on %s", (profile) => {
  it("should branch straight on the flags the callee settled", async () => {
    const body = await build(maskedReturned, profile, "balanced");
    expect(afterTheCall(body)).toEqual([]);
  }, 120_000);

  it("should branch straight where the callee returns a plain load", async () => {
    const body = await build(loadReturned, profile, "balanced");
    expect(afterTheCall(body)).toEqual([]);
  }, 120_000);

  it("should branch straight where every exit settles the flags", async () => {
    const body = await build(twoExitsAgree, profile, "balanced");
    expect(afterTheCall(body)).toEqual([]);
  }, 120_000);

  it("should branch straight at every optimized goal", async () => {
    for (const goal of ["speed", "size"] as const) {
      const body = await build(maskedReturned, profile, goal);
      expect(afterTheCall(body)).toEqual([]);
    }
  }, 120_000);

  it("should branch straight with bounds checks enabled", async () => {
    const body = await build(maskedReturned, profile, "balanced", { boundsCheck: true });
    expect(afterTheCall(body)).toEqual([]);
  }, 120_000);

  it("should keep the canonical reference staging the returned byte", async () => {
    const body = await build(maskedReturned, profile, "none");
    expect(afterTheCall(body)).toEqual([
      expect.stringMatching(/^sta \$[0-9a-f]+$/u),
      expect.stringMatching(/^lda \$[0-9a-f]+$/u),
    ]);
  }, 120_000);

  it("should keep the reload where the returned byte leaves a loop", async () => {
    const body = await build(shiftReturned, profile, "balanced");
    expect(afterTheCall(body)).toEqual([
      expect.stringMatching(/^sta \$[0-9a-f]+$/u),
      expect.stringMatching(/^lda \$[0-9a-f]+$/u),
    ]);
  }, 120_000);

  it("should keep the reload where one exit settles nothing", async () => {
    const body = await build(twoExitsDisagree, profile, "balanced");
    expect(afterTheCall(body)).toEqual([
      expect.stringMatching(/^sta \$[0-9a-f]+$/u),
      expect.stringMatching(/^lda \$[0-9a-f]+$/u),
    ]);
  }, 120_000);
});
