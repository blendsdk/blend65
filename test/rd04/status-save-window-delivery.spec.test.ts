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
 * The delivery is followed by the interrupt-ownership restore, which saves the
 * whole status register and pulls it straight back. The save reads N and Z, but
 * the pull writes exactly those two values back, so nothing between the pair can
 * be said to have consumed them.
 */
const restoreFollowsDelivery = `module Game;
import { setIRQ, restoreIRQ } from c64.system;
let seed: byte = 7;
let answer: byte = 0;
let ticks: byte = 0;
interrupt function tick(): void { ticks = ticks + 1; }
function main(): void {
  setIRQ(&tick);
${DELIVERY}
  restoreIRQ();
}`;

/** The same window shape where the install prologue, not the restore, follows the delivery. */
const installFollowsDelivery = `module Game;
import { setIRQ, restoreIRQ } from c64.system;
let seed: byte = 7;
let answer: byte = 0;
let ticks: byte = 0;
interrupt function tick(): void { ticks = ticks + 1; }
function main(): void {
${DELIVERY}
  setIRQ(&tick);
  restoreIRQ();
}`;

/** One delivery on each side of the restore, so the window is crossed and then left behind. */
const deliveriesEitherSideOfRestore = `module Game;
import { setIRQ, restoreIRQ } from c64.system;
let seed: byte = 7;
let answer: byte = 0;
let other: byte = 0;
let ticks: byte = 0;
interrupt function tick(): void { ticks = ticks + 1; }
function main(): void {
  setIRQ(&tick);
${DELIVERY}
  restoreIRQ();
  other = 1 << count;
}`;

/** The delivery is in a callee, so the window is only reached through the caller's own return. */
const deliveryInCallee = `module Game;
import { setIRQ, restoreIRQ } from c64.system;
let seed: byte = 7;
let answer: byte = 0;
let ticks: byte = 0;
interrupt function tick(): void { ticks = ticks + 1; }
function apply(): void {
${DELIVERY}
}
function main(): void {
  setIRQ(&tick);
  apply();
  restoreIRQ();
}`;

/** The installed handler branches internally; the caller's window is unaffected by that. */
const handlerBodyBranches = `module Game;
import { setIRQ, restoreIRQ } from c64.system;
let seed: byte = 7;
let answer: byte = 0;
let ticks: byte = 0;
interrupt function tick(): void {
  if (ticks > 3) { ticks = 0; } else { ticks = ticks + 1; }
}
function main(): void {
  setIRQ(&tick);
${DELIVERY}
  restoreIRQ();
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

/** Each saved-and-restored status window in the routine, as the instructions it spans. */
function statusWindows(body: readonly string[]): readonly (readonly string[])[] {
  const windows: string[][] = [];
  for (let at = 0; at < body.length; at += 1) {
    if (body[at] !== "php") continue;
    const end = body.indexOf("plp", at + 1);
    if (end < 0) throw new Error("A status save with no restore");
    windows.push(body.slice(at, end + 1));
  }
  return windows;
}

describe.each(sourceLibraryProfiles)("a saved and restored status register on %s", (profile) => {
  it("should deliver directly where the restore follows the delivery", async () => {
    const body = await build(restoreFollowsDelivery, profile, "balanced");
    expect(delivery(body)).toBe("sta b65_Game_answer_");
    expect(stagedPairs(body)).toEqual([]);
  }, 120_000);

  it("should deliver directly where the install prologue follows the delivery", async () => {
    const body = await build(installFollowsDelivery, profile, "balanced");
    expect(delivery(body)).toBe("sta b65_Game_answer_");
    expect(stagedPairs(body)).toEqual([]);
  }, 120_000);

  it("should deliver both results either side of the restore", async () => {
    const body = await build(deliveriesEitherSideOfRestore, profile, "balanced");
    expect(delivery(body)).toBe("sta b65_Game_answer_");
    expect(body).toContain("sta b65_Game_other_");
    expect(stagedPairs(body)).toEqual([]);
  }, 120_000);

  it("should deliver directly where the window is reached through a return", async () => {
    const body = await build(deliveryInCallee, profile, "balanced", { routine: "apply" });
    expect(delivery(body)).toBe("sta b65_Game_answer_");
    expect(stagedPairs(body)).toEqual([]);
    expect(body.at(-1)).toBe("rts");
  }, 120_000);

  it("should deliver directly whatever the installed handler's own shape is", async () => {
    const body = await build(handlerBodyBranches, profile, "balanced");
    expect(delivery(body)).toBe("sta b65_Game_answer_");
    expect(stagedPairs(body)).toEqual([]);
  }, 120_000);

  it("should deliver the same way at every optimized goal", async () => {
    for (const goal of ["speed", "size"] as const) {
      const body = await build(restoreFollowsDelivery, profile, goal);
      expect(delivery(body)).toBe("sta b65_Game_answer_");
      expect(stagedPairs(body)).toEqual([]);
    }
  }, 120_000);

  it("should deliver directly with bounds checks on", async () => {
    const body = await build(restoreFollowsDelivery, profile, "balanced", { boundsCheck: true });
    expect(delivery(body)).toBe("sta b65_Game_answer_");
    expect(stagedPairs(body)).toEqual([]);
  }, 120_000);

  it("should keep the canonical reference staging the result", async () => {
    const body = await build(restoreFollowsDelivery, profile, "none");
    const delivered = delivery(body);
    expect(delivered).toMatch(/^sta \$[0-9a-f]+$/u);
    expect(stagedPairs(body)).toEqual([delivered.slice(4)]);
  }, 120_000);

  it("should leave the interrupt-ownership bookkeeping intact", async () => {
    const body = await build(restoreFollowsDelivery, profile, "balanced");
    const windows = statusWindows(body);
    expect(windows).toHaveLength(2);
    for (const window of windows) {
      expect(window.slice(0, 3)).toEqual(["php", "pha", "sei"]);
      expect(window.slice(-2)).toEqual(["pla", "plp"]);
      expect(window.filter((line) => line.startsWith("sta $03"))).toHaveLength(2);
    }
  }, 120_000);
});
