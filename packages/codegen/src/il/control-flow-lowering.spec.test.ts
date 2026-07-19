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
  // if/else lowers to ≥3 blocks, a conditional terminator, and two br to the join label.
  it("should lower if/else to blocks + a conditional terminator + two joins (ST-11, §2.1)", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void { let n: byte = 1;" +
        " if (n > 0) { poke(0xC000, 1); } else { poke(0xC000, 2); } }\n",
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("brcmp"); // the comparison decides the branch directly
    // then-arm and else-arm each branch to the shared join label.
    expect(countBrToLabel(text)).toBeGreaterThanOrEqual(2);
    // ≥3 non-entry blocks (then, else, join).
    expect((text.match(/^_L\d+:/gm) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  // while lowers a cond block with a conditional terminator and a body back-edge to cond.
  it("should lower while to a cond test + a body back-edge (ST-12, §2.2)", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void { let n: byte = 1;" +
        " while (n > 0) { n = n - 1; } }\n",
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("brcmp"); // the comparison decides the branch directly
    // The entry unconditionally branches to the cond block; the body ends with a
    // back-edge br to that same cond label (≥2 `br _Ln`).
    expect(countBrToLabel(text)).toBeGreaterThanOrEqual(2);
  });

  // do-while lowers the body block before the cond block; cond ends in the test.
  it("should lower do-while with the body preceding the cond (ST-13, §2.3)", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void { let n: byte = 1;" +
        " do { n = n - 1; } while (n > 0); }\n",
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("brcmp"); // the comparison decides the branch directly
    // The body block (first _L) is emitted before the cond block that owns the test.
    const bodyIdx = text.search(/^_L\d+:/m);
    const testIdx = text.indexOf("brcmp");
    expect(bodyIdx).toBeGreaterThanOrEqual(0);
    expect(testIdx).toBeGreaterThan(bodyIdx);
  });

  // for (Pattern A): init store, fused cond compare (le), incr add, br to cond.
  it("should lower for(to) with Pattern-A compare + increment (ST-14, §2.4)", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nlet sum: byte;\nfunction main(): void {" +
        " for (let i: byte = 1 to 5) { sum = sum + i; } }\n",
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("brcmp"); // the continue predicate decides the branch directly
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
    expect(text).toContain("brcmp"); // the comparison decides the branch directly
    // break + continue are both unconditional br to loop labels; combined with the
    // cond back-edge and the if join there are several `br _Ln`.
    expect(countBrToLabel(text)).toBeGreaterThanOrEqual(3);
  });
});

/** Splits printed IL into the pre-label chunk plus each `_Ln` block's chunk. */
function splitBlocks(text: string): { pre: string; sections: Map<string, string> } {
  const parts = text.split(/^(_L\d+):/m);
  const sections = new Map<string, string>();
  for (let i = 1; i + 1 < parts.length; i += 2) {
    sections.set(parts[i], parts[i + 1]);
  }
  return { pre: parts[0], sections };
}

/** The label targeted by the chunk's final plain `br`, if any. */
function lastBrTarget(chunk: string): string | undefined {
  const targets = [...chunk.matchAll(/\bbr (_L\d+)/g)];
  return targets.length > 0 ? targets[targets.length - 1][1] : undefined;
}

/** True when some line materialises the comparison `op` as a value (outside a fused `brcmp`). */
function hasBareCompare(text: string, op: string): boolean {
  return text.split("\n").some((l) => l.includes(`${op} i8`) && !l.includes("brcmp"));
}

// Pins the fused-branch contract for condition position: a comparison that decides a
// branch lowers to a `brcmp` terminator branching on the comparison directly — no 0/1
// result is materialised, no `brcond`, no temp between compare and branch. Boolean
// literals become a plain `br`, `!` swaps the branch targets, and `&&`/`||` become CFG
// edges claiming no synthetic short-circuit slot. Value position keeps today's
// compare-plus-store shape, and `&&` reached as a call argument still claims its slot.
describe("Specification: condition-position compare-and-branch fusion", () => {
  // if (a < b) fuses the compare into the terminator; the 0/1 idiom is gone.
  it("should fuse if(a < b) into a brcmp lt terminator with no brcond (ST-8a)", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void { let a: byte = 3; let b: byte = 7;" +
        " if (a < b) { a = 111; } else { a = 222; } }\n",
    );
    expect(hasErrors).toBe(false);
    const m = text.match(/brcmp lt i8u [^,]+, [^,]+, (_L\d+), (_L\d+)/);
    expect(m).not.toBeNull();
    const { sections } = splitBlocks(text);
    // the true edge reaches the then-arm, the false edge the else-arm.
    expect(sections.get(m![1])).toMatch(/\b111\b/);
    expect(sections.get(m![2])).toMatch(/\b222\b/);
    // no comparison result exists anywhere: no branch-on-value, no bare compare.
    expect(text).not.toContain("brcond");
    expect(hasBareCompare(text, "lt")).toBe(false);
  });

  // while: the cond block ends in the fused test and the body back-edge returns to it.
  it("should end the while condition block in brcmp ne with a body back-edge (ST-8b)", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void { let x: byte = 0;" +
        " while (x != 5) { x = x + 1; } }\n",
    );
    expect(hasErrors).toBe(false);
    const { sections } = splitBlocks(text);
    const cond = [...sections.entries()].find(([, chunk]) => chunk.includes("brcmp ne i8u"));
    expect(cond).toBeDefined();
    const m = cond![1].match(/brcmp ne i8u [^,]+, [^,]+, (_L\d+), (_L\d+)/);
    expect(m).not.toBeNull();
    // the fused test's true edge is the body; the body loops back to the cond label.
    const body = sections.get(m![1]);
    expect(body).toContain("add i8u");
    expect(lastBrTarget(body!)).toBe(cond![0]);
    expect(text).not.toContain("brcond");
    expect(hasBareCompare(text, "ne")).toBe(false);
  });

  // do-while: the body still precedes the cond block; the cond block ends in the fused test.
  it("should end the do-while condition block in brcmp ne after the body (ST-8b)", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void { let x: byte = 0;" +
        " do { x = x + 1; } while (x != 5); }\n",
    );
    expect(hasErrors).toBe(false);
    const m = text.match(/brcmp ne i8u [^,]+, [^,]+, (_L\d+), (_L\d+)/);
    expect(m).not.toBeNull();
    const bodyIdx = text.search(/^_L\d+:/m);
    expect(bodyIdx).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("brcmp ne")).toBeGreaterThan(bodyIdx);
    // the fused test's true edge re-enters the body.
    const { sections } = splitBlocks(text);
    expect(sections.get(m![1])).toContain("add i8u");
    expect(text).not.toContain("brcond");
    expect(hasBareCompare(text, "ne")).toBe(false);
  });

  // for (to): the continue test i <= bound fuses; init store + increment are unchanged.
  it("should end the for(to) condition block in brcmp le, init unchanged (ST-8b)", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nlet sum: byte;\nfunction main(): void {" +
        " for (let i: byte = 0 to 9) { sum = sum + i; } }\n",
    );
    expect(hasErrors).toBe(false);
    expect(text).toMatch(/brcmp le i8u [^,]+, [^,]+, _L\d+, _L\d+/);
    // increment and counter-slot init keep their existing shape.
    expect(text).toContain("add i8u");
    expect(text).toContain("__frame_Main_main_i");
    expect(text).not.toContain("brcond");
    expect(hasBareCompare(text, "le")).toBe(false);
  });

  // `!` costs zero instructions: it only swaps the branch targets of its operand.
  it("should lower if(!b) exactly as if(b) with swapped branch targets (ST-8c)", () => {
    const program = (cond: string): string =>
      "module Main;\nfunction main(): void { let b: boolean = true;" +
      ` if (${cond}) { poke(0xC000, 1); } else { poke(0xC000, 2); } }\n`;
    const plain = lowerRealSource(program("b"));
    const negated = lowerRealSource(program("!b"));
    expect(plain.hasErrors).toBe(false);
    expect(negated.hasErrors).toBe(false);
    // a boolean identifier read is the fallback path: exactly one branch-on-value each.
    expect(plain.text.match(/brcond/g)).toHaveLength(1);
    expect(negated.text.match(/brcond/g)).toHaveLength(1);
    const swapped = plain.text.replace(/brcond ([^,]+), (_L\d+), (_L\d+)/, "brcond $1, $3, $2");
    expect(swapped).not.toBe(plain.text); // the swap is real, not a no-op
    expect(negated.text).toBe(swapped);
    // negation leaves no compare-with-zero residue behind.
    expect(negated.text).not.toMatch(/\beq\b/);
  });

  // && in condition position is pure CFG: two fused tests chained by the true edge.
  it("should chain && conditions through fused blocks with no synthetic slot (ST-8d)", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void { let x: byte = 10;" +
        " if (x >= 8 && x < 40) { x = 111; } else { x = 222; } }\n",
    );
    expect(hasErrors).toBe(false);
    const first = text.match(/brcmp ge i8u [^,]+, [^,]+, (_L\d+), (_L\d+)/);
    expect(first).not.toBeNull();
    const { sections } = splitBlocks(text);
    const mid = sections.get(first![1]);
    expect(mid).toBeDefined();
    const second = mid!.match(/brcmp lt i8u [^,]+, [^,]+, (_L\d+), (_L\d+)/);
    expect(second).not.toBeNull();
    // both false edges converge on the else arm; the second true edge is the then arm.
    expect(second![2]).toBe(first![2]);
    expect(sections.get(second![1])).toMatch(/\b111\b/);
    expect(sections.get(first![2])).toMatch(/\b222\b/);
    // the mid block is reachable ONLY via the first test's true edge:
    // its label appears once as that edge and once as the block definition.
    expect(text.match(new RegExp(`\\b${first![1]}\\b`, "g"))).toHaveLength(2);
    // the short-circuit is CFG only: no synthetic slot, no branch-on-value, no bare compares.
    expect(text).not.toContain("0sc");
    expect(text).not.toContain("brcond");
    expect(hasBareCompare(text, "ge")).toBe(false);
    expect(hasBareCompare(text, "lt")).toBe(false);
  });

  // || on boolean reads: each side falls back to brcond, still with no synthetic slot.
  it("should chain || boolean reads through brcond blocks without a slot (ST-8e)", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void { let n: byte = 0; let a: boolean = true;" +
        " let b: boolean = false; if (a || b) { n = 111; } else { n = 222; } }\n",
    );
    expect(hasErrors).toBe(false);
    const all = [...text.matchAll(/brcond [^,]+, (_L\d+), (_L\d+)/g)];
    expect(all).toHaveLength(2);
    const [left, right] = all;
    const { sections } = splitBlocks(text);
    // the left test's false edge is the mid block holding the right test …
    const mid = sections.get(left[2]);
    expect(mid).toBeDefined();
    expect(mid!).toContain(right[0]);
    // … and both tests share the then block as their true target.
    expect(right[1]).toBe(left[1]);
    expect(sections.get(left[1])).toMatch(/\b111\b/);
    expect(sections.get(right[2])).toMatch(/\b222\b/);
    // short-circuit via CFG only: no synthetic slot, no fused compare (booleans, not compares).
    expect(text).not.toContain("0sc");
    expect(text).not.toContain("brcmp");
  });

  // while (true): the literal condition costs nothing; the loop is unconditional CFG.
  it("should lower while(true) to an unconditional br loop (ST-8f)", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void { let n: byte = 0;" + " while (true) { n = n + 1; } }\n",
    );
    expect(hasErrors).toBe(false);
    // zero condition-evaluation instructions: no branch-on-value, no fused test.
    expect(text).not.toContain("brcond");
    expect(text).not.toContain("brcmp");
    // the loop still exists: some `br` targets a label defined earlier (a back-edge).
    const backEdge = [...text.matchAll(/\bbr (_L\d+)/g)].some((m) => {
      const def = text.search(new RegExp(`^${m[1]}:`, "m"));
      return def >= 0 && def < (m.index ?? -1);
    });
    expect(backEdge).toBe(true);
    expect(text).toContain("add i8u"); // the body is intact
  });

  // if (false): the condition site jumps straight to the else arm.
  it("should lower if(false) to an unconditional br to the else arm (ST-8f)", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void { let n: byte = 5;" +
        " if (false) { n = 111; } else { n = 222; } }\n",
    );
    expect(hasErrors).toBe(false);
    // zero condition-evaluation instructions at the site.
    expect(text).not.toContain("brcond");
    expect(text).not.toContain("brcmp");
    // the entry (which holds the condition site) branches unconditionally to the else arm.
    const { pre, sections } = splitBlocks(text);
    const target = lastBrTarget(pre);
    expect(target).toBeDefined();
    expect(sections.get(target!)).toMatch(/\b222\b/);
  });

  // Value position is untouched: a comparison assigned to a variable still
  // materialises its result with a compare instruction plus a store.
  it("should keep value-position comparisons as compare + store (ST-8g)", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void { let x: byte = 9; let y: byte = 4;" +
        " let c: boolean = x > y; }\n",
    );
    expect(hasErrors).toBe(false);
    expect(hasBareCompare(text, "gt")).toBe(true); // the compare instruction survives
    expect(text).toContain("__frame_Main_main_c"); // … and is stored into c's slot
    expect(text).not.toContain("brcmp");
  });

  // && as a call argument is value position: it still claims synthetic slot 0sc0,
  // and the call-result condition falls back to a branch-on-value.
  it("should keep && in a call argument on the synthetic-slot path (ST-14)", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction f(v: boolean): boolean { return v; }\n" +
        "function main(): void { let a: boolean = true; let b: boolean = false;" +
        " if (f(a && b)) { poke(0xC000, 1); } else { poke(0xC000, 2); } }\n",
    );
    expect(hasErrors).toBe(false);
    // the slot is claimed and carries real store/load traffic.
    expect((text.match(/0sc0/g) ?? []).length).toBeGreaterThanOrEqual(2);
    // a call result is not a comparison: the outer condition uses brcond, never brcmp.
    expect(text).toContain("brcond");
    expect(text).not.toContain("brcmp");
  });
});
