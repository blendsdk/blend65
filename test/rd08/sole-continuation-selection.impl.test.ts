/**
 * The entry continuing into its last callee keeps the construction size
 * selection would choose without it.
 *
 * The final observers prove a selected loop construction against the canonical
 * reference, and both now continue from the entry into the callee instead of
 * calling it. An observer that does not understand that shape refuses the
 * construction, and the build silently falls back to a larger canonical one.
 * These pins hold the selected construction and the resulting size for the two
 * shapes that exercise those observers: a loop in the continued callee, and a
 * loop in the entry function before its last call.
 */
import { describe, expect, it } from "vitest";
import { buildProfileSource } from "../rd05/profile-fixture.js";

const target = "c64-pal-prg-kernal-6581";

/** The loop lives in the body the entry continues into. */
const loopInCallee = `module Game;
struct Saved { padding: byte[1]; rows: byte[8]; }
let saved: Saved = { padding: [;2], rows: [;0] };
function work(): void {
  for (let i: word = 0; i < 4; i += 1) { saved.rows[i] = 7; }
}
function main(): void { work(); }
`;

/** The loop lives in the entry function, whose last call is a wrapper. */
const loopInEntry = `module Game;
let data: byte[8] = [;0];
let total: word = 0;
function child(): void { total += 1; }
function touch(): void { child(); }
function main(): void {
  for (let i: word = 0; i < 8; i += 1) { data[i] = byte(i); }
  touch();
}
`;

/** The selected candidate's construction, without its source and profile prefix. */
function selected(costs: unknown): string[] {
  const decisions = (costs as { decisions?: { selectedCandidateId: string }[] }).decisions ?? [];
  return decisions.map(({ selectedCandidateId }) =>
    selectedCandidateId.split(":").slice(2).join(":"),
  );
}

describe("the entry's continuation keeps the selected construction", () => {
  it.each(["balanced", "size"] as const)(
    "for a loop in the continued callee in %s mode",
    async (mode) => {
      const artifacts = await buildProfileSource(loopInCallee, target, mode);
      expect(selected(artifacts.costs)).toEqual(["closed:flat-eight-x-first:compact-unrolled"]);
      expect(artifacts.prg.length).toBe(126);
    },
    180_000,
  );

  it.each(["balanced", "size"] as const)(
    "for a loop in the entry before its last call in %s mode",
    async (mode) => {
      const artifacts = await buildProfileSource(loopInEntry, target, mode);
      expect(selected(artifacts.costs)).toEqual(["closed:original:compact-looped"]);
      expect(artifacts.prg.length).toBe(191);
    },
    180_000,
  );
});
