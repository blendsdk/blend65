import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

/**
 * A guard reads one module byte into a local and compares it immediately. The
 * local is read again after the branch, so its home must survive; only the
 * reload standing between the store and the comparison is redundant.
 */
const GUARDED_SHIFT = `module Game;
let data: byte[8] = [;0];
let seed: byte = 63;
let stop: byte = 0;
function main(): void {
  for (let i: word = 0; i < 8; i += 1) { data[i] = byte(i); }
  let ordinal: byte = seed;
  if (ordinal >= 64) { return; }
  let column: byte = ordinal >> 3;
  data[column] = 42;
}`;

/**
 * The same guard, with and without a live interrupt handler, differing in
 * nothing else. Declaring a handler is not enough for it to fire: it is
 * installed before the guard and restored on every path afterwards, which is
 * what ownership requires and what makes it genuinely live at the comparison.
 */
const guardWithHandler = (installed: boolean) => `module Game;
${installed ? "import { setIRQ, restoreIRQ } from c64.system;" : ""}
let seed: byte = 63;
let stop: byte = 0;
let ticks: byte = 0;
${installed ? "interrupt function tick(): void { ticks = ticks + 1; }" : ""}
function main(): void {
  ${installed ? "setIRQ(&tick);" : ""}
  let ordinal: byte = seed;
  if (ordinal >= 64) { stop = 1; } else { stop = ordinal >> 3; }
  ${installed ? "restoreIRQ();" : ""}
}`;

/** Instructions of one generated routine, without labels, origins or comments. */
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
    // Generated labels embed hex-encoded identities, and the assembler carries an
    // operand-width hint on the mnemonic. Only the bare opcode is asserted, never
    // a label, an allocated address or a chosen addressing width.
    body.push(text.split(/\s+/u)[0]!.replace(/\+\d+$/u, ""));
  }
  if (body.length === 0) throw new Error(`Missing generated routine Game.${name}`);
  return body;
}

/** Build one source on one profile at one goal and read the named routine. */
async function build(
  source: string,
  profile: string,
  optimization: "none" | "balanced",
  boundsCheck?: boolean,
): Promise<readonly string[]> {
  return withProfileProject(source, profile, async (project) => {
    const built = await buildProject({
      project,
      optimization,
      ...(boundsCheck === undefined ? {} : { boundsCheck }),
    });
    if (built.kind !== "success")
      throw new Error(`Build failed: ${JSON.stringify(built.diagnostics)}`);
    return routine(built.generation.directory, "main");
  });
}

/** Count how many times one opcode appears in a routine. */
const occurrences = (body: readonly string[], opcode: string): number =>
  body.filter((item) => item === opcode).length;

/**
 * The instruction that supplies the guard's comparison.
 *
 * The guard is located by its own conditional branch rather than by counting
 * stores, because the surrounding loop emits stores of its own. Whatever sits
 * two places before that branch is either the private store, meaning the reload
 * is gone, or the reload itself.
 */
function beforeGuardComparison(body: readonly string[]): string {
  const branch = body.indexOf("bcs");
  if (branch < 2 || body[branch - 1] !== "cmp")
    throw new Error(`Missing the guard comparison: ${body.join(" ")}`);
  return body[branch - 2]!;
}

const forEachProfile = (
  name: string,
  body: (profile: (typeof sourceLibraryProfiles)[number]) => Promise<void>,
) => {
  for (const profile of sourceLibraryProfiles)
    it(`${profile}: ${name}`, () => body(profile), 180_000);
};

describe("typed capture comparison reload", () => {
  // Storing to the home leaves the accumulator and every flag untouched, so the
  // comparison can use what the store already wrote. Two adjacent loads of the
  // same byte collapse to one.
  forEachProfile("should not reload a byte the adjacent store just wrote", async (profile) => {
    const optimized = await build(GUARDED_SHIFT, profile, "balanced");

    expect(beforeGuardComparison(optimized), optimized.join(" ")).toBe("sta");
  });

  // Bounds checking inserts guard blocks around indexed accesses. The guard
  // window here contains none, so the decision must not depend on it.
  forEachProfile("should omit the reload with bounds checking enabled", async (profile) => {
    const checked = await build(GUARDED_SHIFT, profile, "balanced", true);

    expect(beforeGuardComparison(checked), checked.join(" ")).toBe("sta");
  });

  // The home is still live: the shift after the branch reads it. Removing the
  // reload must not be mistaken for removing the variable.
  forEachProfile("should keep the home the later shift reads", async (profile) => {
    const optimized = await build(GUARDED_SHIFT, profile, "balanced");

    expect(occurrences(optimized, "lsr"), optimized.join(" ")).toBe(3);
    const afterBranch = optimized.slice(optimized.indexOf("bcs") + 1);
    expect(afterBranch.includes("lda"), afterBranch.join(" ")).toBe(true);
  });

  // The accumulator is not provably the byte once a branch has been taken, so a
  // cross-block read keeps its load. An overreaching omission would eat this one.
  forEachProfile("should retain the reload that follows the branch", async (profile) => {
    const optimized = await build(GUARDED_SHIFT, profile, "balanced");
    const shiftAt = optimized.indexOf("lsr");

    expect(shiftAt, "expected the guarded shift").toBeGreaterThan(0);
    expect(optimized[shiftAt - 1], optimized.join(" ")).toBe("lda");
  });

  // Canonical direct lowering is the reference a build is measured against.
  // Leaving it alone is the point, not an oversight.
  forEachProfile("should leave the canonical reference construction alone", async (profile) => {
    const reference = await build(GUARDED_SHIFT, profile, "none");

    expect(beforeGuardComparison(reference), reference.join(" ")).toBe("lda");
  });

  // An interrupt can fire between the store and the comparison, and its handler
  // could write the home. Without a proof that it cannot, the reload stays. The
  // control differs only by the handler, so the handler is what decides this.
  forEachProfile(
    "should retain the reload only because author code runs asynchronously",
    async (profile) => {
      const control = await build(guardWithHandler(false), profile, "balanced");
      const live = await build(guardWithHandler(true), profile, "balanced");

      expect(beforeGuardComparison(control), control.join(" ")).toBe("sta");
      expect(beforeGuardComparison(live), live.join(" ")).toBe("lda");
    },
  );
});
