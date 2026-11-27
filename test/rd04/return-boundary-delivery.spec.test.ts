import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { routineBody } from "./routine-reader.js";
import { cachedBuildProject } from "../build-cache.js";
import { withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

/** The delivery under test, identical in every witness so only the context differs. */
const DELIVERY = `  let count: byte = seed & 7;
  answer = 1 << count;`;

/** An ordinary callee delivers its result and returns; one caller, which ignores the flags. */
const calledOnce = `module Game;
let seed: byte = 7;
let answer: byte = 0;
function apply(): void {
${DELIVERY}
}
function main(): void { apply(); }`;

/** Two callers, where the first call is immediately followed by the second. */
const calledTwice = `module Game;
let seed: byte = 7;
let answer: byte = 0;
function apply(): void {
${DELIVERY}
}
function main(): void { apply(); apply(); }`;

/** The caller does ordinary work of its own after the call. */
const callerContinues = `module Game;
let seed: byte = 7;
let answer: byte = 0;
let flag: byte = 0;
function apply(): void {
${DELIVERY}
}
function main(): void {
  apply();
  if (flag == 1) { answer = 0; }
}`;

/** The delivery sits two frames deep, so the fact has to cross two returns. */
const calledIndirectlyThroughOuter = `module Game;
let seed: byte = 7;
let answer: byte = 0;
function apply(): void {
${DELIVERY}
}
function outer(): void { apply(); }
function main(): void { outer(); }`;

/** The caller saves and restores the whole status register after the call. */
const callerPushesStatus = `module Game;
import { setIRQ, restoreIRQ } from c64.system;
let seed: byte = 7;
let answer: byte = 0;
let ticks: byte = 0;
interrupt function tick(): void { ticks = ticks + 1; }
function apply(): void {
${DELIVERY}
}
function main(): void {
  apply();
  setIRQ(&tick);
  restoreIRQ();
}`;

/** The body is one of two run-time dispatch candidates, so a caller is chosen at run time. */
const dispatchCandidate = `module Game;
let seed: byte = 7;
let answer: byte = 0;
let pick: byte = 0;
function apply(): void {
${DELIVERY}
}
function other(): void { answer = 1; }
function main(): void {
  let target: fn(): void = &apply;
  if (pick == 1) { target = &other; }
  target();
}`;

/**
 * The caller's next instruction is a call whose own first instruction is a call.
 * Asking only about that one instruction settles nothing, since a call encodes no
 * flag; asking the same question one level down reaches the load `inner` opens
 * with.
 */
const nextCalleeOpensWithCall = `module Game;
let seed: byte = 7;
let answer: byte = 0;
let other: byte = 0;
function apply(): void {
${DELIVERY}
}
function inner(): void { other = other + 1; }
function wrap(): void { inner(); }
function main(): void {
  apply();
  wrap();
}`;

/** The body's address is taken even though the only call made is direct. */
const addressTaken = `module Game;
let seed: byte = 7;
let answer: byte = 0;
function apply(): void {
${DELIVERY}
}
function main(): void {
  let target: fn(): void = &apply;
  apply();
}`;

/** Instructions of one generated routine, read by the shared reader. */
async function routine(directory: string, name: string): Promise<readonly string[]> {
  return routineBody(await readFile(join(directory, ".asm"), "utf8"), name);
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

describe.each(sourceLibraryProfiles)("delivery across a callee's return on %s", (profile) => {
  it("should store the result straight into its destination before returning", async () => {
    const body = await build(calledOnce, profile, "balanced");
    expect(delivery(body)).toBe("sta b65_Game_answer_");
    expect(stagedPairs(body)).toEqual([]);
    // It returns, or — called last by the entry function — continues into the
    // startup restoration by a jump or by falling into it.
    expect(body.at(-1)).toMatch(
      /^(rts|jmp b65_startup_block_1_|falls into b65_startup_block_1_)$/u,
    );
  }, 120_000);

  it("should deliver directly when the next instruction is another call", async () => {
    const body = await build(calledTwice, profile, "balanced");
    expect(delivery(body)).toBe("sta b65_Game_answer_");
    expect(stagedPairs(body)).toEqual([]);
  }, 120_000);

  it("should deliver directly when the caller carries on with its own work", async () => {
    const body = await build(callerContinues, profile, "balanced");
    expect(delivery(body)).toBe("sta b65_Game_answer_");
    expect(stagedPairs(body)).toEqual([]);
  }, 120_000);

  it("should deliver directly across two returns", async () => {
    const body = await build(calledIndirectlyThroughOuter, profile, "balanced");
    expect(delivery(body)).toBe("sta b65_Game_answer_");
    expect(stagedPairs(body)).toEqual([]);
  }, 120_000);

  it("should deliver the same way at every optimized goal", async () => {
    const [speed, size] = await Promise.all([
      build(calledOnce, profile, "speed"),
      build(calledOnce, profile, "size"),
    ]);
    expect(delivery(speed)).toBe("sta b65_Game_answer_");
    expect(delivery(size)).toBe("sta b65_Game_answer_");
  }, 120_000);

  it("should deliver the same way with bounds checks enabled", async () => {
    const body = await build(calledOnce, profile, "balanced", { boundsCheck: true });
    expect(delivery(body)).toBe("sta b65_Game_answer_");
    expect(stagedPairs(body)).toEqual([]);
  }, 120_000);

  it("should keep the canonical reference staging the result", async () => {
    const body = await build(calledOnce, profile, "none");
    const delivered = delivery(body);
    expect(delivered).toMatch(/^sta \$[0-9a-f]+$/u);
    expect(stagedPairs(body)).toEqual([delivered.slice(4)]);
  }, 120_000);

  it("should deliver directly where the caller saves and restores the status register", async () => {
    const body = await build(callerPushesStatus, profile, "balanced");
    expect(delivery(body)).toBe("sta b65_Game_answer_");
    expect(stagedPairs(body)).toEqual([]);
  }, 120_000);

  it("should keep the staging home where a run-time dispatch may reach the body", async () => {
    const body = await build(dispatchCandidate, profile, "balanced");
    expect(delivery(body)).toMatch(/^sta \$[0-9a-f]+$/u);
    expect(stagedPairs(body)).toHaveLength(1);
  }, 120_000);

  it("should deliver directly where the next call delegates its own opening", async () => {
    const body = await build(nextCalleeOpensWithCall, profile, "balanced");
    expect(delivery(body)).toBe("sta b65_Game_answer_");
    expect(stagedPairs(body)).toEqual([]);
  }, 120_000);

  it("should keep the staging home where the body's address is taken", async () => {
    const body = await build(addressTaken, profile, "balanced");
    expect(delivery(body)).toMatch(/^sta \$[0-9a-f]+$/u);
    expect(stagedPairs(body)).toHaveLength(1);
  }, 120_000);
});
