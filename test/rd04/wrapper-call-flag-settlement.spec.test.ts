import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cachedBuildProject } from "../build-cache.js";
import { withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

/** The delivery under test, identical in every witness so only the context differs. */
const DELIVERY = `  let count: byte = seed & 7;
  answer = 1 << count;`;

/**
 * The caller's next call is a one-line wrapper, so the called body's own first
 * instruction is another call. A call encodes no flag of its own, which is why
 * asking only about that one instruction refuses: nothing has been settled by
 * the time the wrapper's own callee starts. Asking the same question one level
 * down answers it, because `inner` opens with a load.
 */
const nextCalleeIsWrapper = `module Game;
let seed: byte = 7;
let answer: byte = 0;
let other: byte = 0;
function apply(): void {
${DELIVERY}
}
function inner(): void { other = other + 1; }
function wrap(): void { inner(); }
function main(): void { apply(); wrap(); }`;

/** The same shape two wrappers deep, so the chain has to be followed twice. */
const nextCalleeIsWrapperChain = `module Game;
let seed: byte = 7;
let answer: byte = 0;
let other: byte = 0;
function apply(): void {
${DELIVERY}
}
function inner(): void { other = other + 1; }
function middle(): void { inner(); }
function wrap(): void { middle(); }
function main(): void { apply(); wrap(); }`;

/**
 * The body at the end of the chain opens by saving the whole status register,
 * which reads exactly the pair being proved dead. Following the chain reaches a
 * refusal rather than an answer, which is the point of following it at all.
 */
const wrapperInnerSavesStatus = `module Game;
import { setIRQ, restoreIRQ } from c64.system;
let seed: byte = 7;
let answer: byte = 0;
let ticks: byte = 0;
interrupt function tick(): void { ticks = ticks + 1; }
function apply(): void {
${DELIVERY}
}
function inner(): void { setIRQ(&tick); restoreIRQ(); }
function wrap(): void { inner(); }
function main(): void { apply(); wrap(); }`;

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
    return routine(built.generation.directory, options.routine ?? "apply");
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

describe.each(sourceLibraryProfiles)("a next call that delegates its opening on %s", (profile) => {
  it("should deliver directly where the next callee is a wrapper", async () => {
    const body = await build(nextCalleeIsWrapper, profile, "balanced");
    expect(delivery(body)).toBe("sta b65_Game_answer_");
    expect(stagedPairs(body)).toEqual([]);
  }, 120_000);

  it("should deliver directly through a chain of wrappers", async () => {
    const body = await build(nextCalleeIsWrapperChain, profile, "balanced");
    expect(delivery(body)).toBe("sta b65_Game_answer_");
    expect(stagedPairs(body)).toEqual([]);
  }, 120_000);

  it("should deliver directly at every optimized goal", async () => {
    for (const goal of ["speed", "size"] as const) {
      const body = await build(nextCalleeIsWrapper, profile, goal);
      expect(delivery(body)).toBe("sta b65_Game_answer_");
      expect(stagedPairs(body)).toEqual([]);
    }
  }, 120_000);

  it("should deliver directly with bounds checks enabled", async () => {
    const body = await build(nextCalleeIsWrapper, profile, "balanced", { boundsCheck: true });
    expect(delivery(body)).toBe("sta b65_Game_answer_");
    expect(stagedPairs(body)).toEqual([]);
  }, 120_000);

  it("should keep the canonical reference staging the result", async () => {
    const body = await build(nextCalleeIsWrapper, profile, "none");
    const delivered = delivery(body);
    expect(delivered).toMatch(/^sta \$[0-9a-f]+$/u);
    expect(stagedPairs(body)).toEqual([delivered.slice(4)]);
  }, 120_000);

  it("should keep the staging home where the chain reaches a status save", async () => {
    const body = await build(wrapperInnerSavesStatus, profile, "balanced");
    expect(delivery(body)).toMatch(/^sta \$[0-9a-f]+$/u);
    expect(stagedPairs(body)).toHaveLength(1);
  }, 120_000);

  it("should leave the wrapper itself as a plain call and return", async () => {
    const body = await build(nextCalleeIsWrapper, profile, "balanced", { routine: "wrap" });
    expect(body).toEqual([expect.stringMatching(/^jsr b65_Game_inner_$/u), "rts"]);
  }, 120_000);
});
