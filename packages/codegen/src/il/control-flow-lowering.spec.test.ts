/**
 * Specification tests for multi-block CFG lowering (`lower.ts`).
 *
 * Expectations derive exclusively from the documented shapes for if/else,
 * while, do-while, for, and break/continue lowering — never from reading the
 * implementation (immutable oracle). Each program is lowered end-to-end through
 * the real frontend (`lowerRealSource`) so conditions/counters carry real types +
 * frames; the printed IL is inspected structurally (a separate byte-exact golden
 * covers the exact output). Spec-tests-first: authored before `lower.ts`'s
 * control-flow cases exist (they ICE today) — red first, then green.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { ProgramNode } from "@blend65/core";
import { analyze, lex, modelToFunctionInfo, modelToModuleVars, parse, planAllocation } from "@blend65/frontend";
import { printIL } from "./print-il.js";
import { lowerToIL } from "./lower.js";

/** Lowers `source` end-to-end through the REAL frontend; returns printed IL + bag state. */
function lowerRealSource(source: string): { text: string; hasErrors: boolean } {
  const bag = createDiagnosticBag();
  const { tokens } = lex(1, source, bag);
  const { ast }: { ast: ProgramNode } = parse({ tokens, source, sourceId: 1, bag });
  const model = analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  const plan = planAllocation(
    {
      functions: modelToFunctionInfo(model),
      moduleVars: modelToModuleVars(model),
      zpUserVars: [],
      upstreamErrors: bag.hasErrors(),
    },
    DEFAULT_PROFILE,
    bag,
  );
  const il = lowerToIL({ program: [ast], model, plan }, bag);
  return { text: printIL(il), hasErrors: bag.hasErrors() };
}

/** Count the branch-to-label terminators (`br _Ln`) in printed IL. */
function countBrToLabel(text: string): number {
  return (text.match(/\bbr _L\d+/g) ?? []).length;
}

describe("Specification: RD-18 Slice 4a CFG lowering (FR-7/FR-8)", () => {
  // if/else lowers to ≥3 blocks, a brcond, and two br to the join label.
  it("should lower if/else to blocks + brcond + two joins (ST-11, §2.1)", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void { let n: byte = 1;" +
        " if (n > 0) { poke(0xC000, 1); } else { poke(0xC000, 2); } }\n",
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("brcond");
    // then-arm and else-arm each branch to the shared join label.
    expect(countBrToLabel(text)).toBeGreaterThanOrEqual(2);
    // ≥3 non-entry blocks (then, else, join).
    expect((text.match(/^_L\d+:/gm) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  // while lowers a cond block with a brcond and a body back-edge to cond.
  it("should lower while to a cond brcond + a body back-edge (ST-12, §2.2)", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void { let n: byte = 1;" +
        " while (n > 0) { n = n - 1; } }\n",
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("brcond");
    // The entry unconditionally branches to the cond block; the body ends with a
    // back-edge br to that same cond label (≥2 `br _Ln`).
    expect(countBrToLabel(text)).toBeGreaterThanOrEqual(2);
  });

  // do-while lowers the body block before the cond block; cond ends brcond.
  it("should lower do-while with the body preceding the cond (ST-13, §2.3)", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void { let n: byte = 1;" +
        " do { n = n - 1; } while (n > 0); }\n",
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("brcond");
    // The body block (first _L) is emitted before the cond block that owns brcond.
    const bodyIdx = text.search(/^_L\d+:/m);
    const brcondIdx = text.indexOf("brcond");
    expect(bodyIdx).toBeGreaterThanOrEqual(0);
    expect(brcondIdx).toBeGreaterThan(bodyIdx);
  });

  // for (Pattern A): init store, cond compare (le) via brcond, incr add, br to cond.
  it("should lower for(to) with Pattern-A compare + increment (ST-14, §2.4)", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nlet sum: byte;\nfunction main(): void {" +
        " for (let i: byte = 1 to 5) { sum = sum + i; } }\n",
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("brcond");
    // Pattern A: the continue predicate compares the counter with `le` (i <= bound).
    expect(text).toContain("le i8u");
    // The increment adds the step into the counter slot.
    expect(text).toContain("add i8u");
    // init store to the counter slot + a br back to the cond block.
    expect(text).toContain("__frame_Main_main_i");
    expect(countBrToLabel(text)).toBeGreaterThanOrEqual(2);
  });

  // break branches to the loop-end; continue branches to the cond/incr label.
  it("should lower break/continue to loop-target branches (ST-15, §2.5)", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void { let n: byte = 1;" +
        " while (n > 0) { if (n > 5) { break; } else { continue; } } }\n",
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("brcond");
    // break + continue are both unconditional br to loop labels; combined with the
    // cond back-edge and the if join there are several `br _Ln`.
    expect(countBrToLabel(text)).toBeGreaterThanOrEqual(3);
  });
});
