/**
 * The entry function continues into its sole void leaf.
 *
 * The program entry has no caller to return to: its continuation is the
 * startup restoration. When the entry function ends by calling a void function
 * that nothing else calls, an optimized build may drop both the call and the
 * entry function's own jump to the restoration. Control then continues into the
 * function and leaves it into the restoration. Every exit of that function must
 * reach the restoration, never a return that would skip it.
 *
 * A function called more than once must return after each call, so its calls
 * stay ordinary. The leaf's stores are unchanged either way, and the
 * unoptimized reference keeps the ordinary call followed by the jump to the
 * restoration.
 *
 * These checks read the published assembly and labels. That the restoration
 * actually runs, and leaves the stack balanced, is left to emulator execution.
 */
import { describe, expect, it } from "vitest";
import { buildProfileSource } from "../rd05/profile-fixture.js";
import { globalAddress, routineBytes } from "./emitted-routine-support.js";
import { evaluate } from "./word-update-support.js";
import {
  calls,
  exitBytes,
  exits,
  expectContinuation,
  labelAddress,
  linkedRoutine,
  restorationLabel,
} from "./call-linkage-support.js";

/** Selected NMOS C64 target. */
const target = "c64-pal-prg-kernal-6581";

/** Optimizing goals that may continue into the sole leaf. */
const optimizing = ["balanced", "size"] as const;

/** Build one witness for the selected target. */
function build(source: string, mode: "none" | "balanced" | "size") {
  return buildProfileSource(source, target, mode);
}

/** Show a routine's emitted lines in a failure message. */
function shown(routine: { readonly lines: readonly string[] }): string {
  return routine.lines.join("\n");
}

/**
 * The entry function's last act calls a void leaf, once or twice.
 *
 * Called once, the leaf has a single call site and control may continue into
 * it. Called twice, the leaf must return to the entry function after the first
 * call, so both calls stay ordinary.
 */
function soleLeafSource(callsFromMain: 1 | 2): string {
  return `module Game;
struct Saved { padding: byte[1]; rows: byte[8]; }
let saved: Saved = { padding: [;2], rows: [;0] };
function work(): void {
  for (let i: word = 0; i < 4; i += 1) { saved.rows[i] = 7; }
}
function main(): void { ${callsFromMain === 1 ? "work();" : "work(); work();"} }
`;
}

describe("the entry function continues into its sole void leaf", () => {
  it.each(optimizing)(
    "continues into the leaf and leaves it into the restoration in %s mode",
    async (mode) => {
      const restore = restorationLabel(await build(soleLeafSource(1), "none"));
      const artifacts = await build(soleLeafSource(1), mode);
      const main = linkedRoutine(artifacts, "main");
      const work = linkedRoutine(artifacts, "work");
      const restoration = labelAddress(main, restore);
      expect(
        calls(main, work.entry).map(({ instruction }) => instruction.text),
        `no call to the leaf:\n${shown(main)}`,
      ).toEqual([]);
      expect(
        [...expectContinuation(main, restoration, [work])],
        "control continues from the entry function into the leaf",
      ).toContain("work");
      expect(
        routineBytes(main.decoded) + exitBytes(work),
        `entry function plus leaf exits cost at most one jump:\n${shown(main)}\n${shown(work)}`,
      ).toBeLessThanOrEqual(3);
    },
    180_000,
  );

  it.each(optimizing)(
    "stores the leaf's four rows once each and in order in %s mode",
    async (mode) => {
      const artifacts = await build(soleLeafSource(1), mode);
      const work = linkedRoutine(artifacts, "work");
      const saved = globalAddress(work.labels, "saved");
      const { writes } = evaluate(work, new Map(), { start: 0, end: work.decoded.length - 1 });
      expect(
        writes
          .filter(({ address }) => address >= saved && address < saved + 9)
          .map(({ address, value }) => ({ address, value })),
        `stores into the saved object:\n${shown(work)}`,
      ).toEqual([1, 2, 3, 4].map((offset) => ({ address: saved + offset, value: 7 })));
    },
    180_000,
  );

  it.each(optimizing)(
    "keeps ordinary calls to a leaf called twice in %s mode",
    async (mode) => {
      const restore = restorationLabel(await build(soleLeafSource(2), "none"));
      const artifacts = await build(soleLeafSource(2), mode);
      const main = linkedRoutine(artifacts, "main");
      const work = linkedRoutine(artifacts, "work");
      const restoration = labelAddress(main, restore);
      expect(calls(main, work.entry), `both calls remain:\n${shown(main)}`).toHaveLength(2);
      expect(
        exits(work).map((exit) => exit.kind),
        `the leaf returns to the entry function:\n${shown(work)}`,
      ).toSatisfy(
        (kinds: string[]) => kinds.length > 0 && kinds.every((kind) => kind === "return"),
      );
      expectContinuation(main, restoration, []);
    },
    180_000,
  );
});

describe("reference lowering keeps the ordinary call form", () => {
  it("keeps the entry function's call and its jump to the restoration", async () => {
    const artifacts = await build(soleLeafSource(1), "none");
    expect(artifacts.costs.mode).toBe("none");
    const main = linkedRoutine(artifacts, "main");
    const work = linkedRoutine(artifacts, "work");
    expect(
      calls(main, work.entry),
      `the entry function calls the leaf:\n${shown(main)}`,
    ).toHaveLength(1);
    restorationLabel(artifacts);
    expect(
      exits(work).some((exit) => exit.kind === "return"),
      `the leaf returns:\n${shown(work)}`,
    ).toBe(true);
  }, 180_000);
});
