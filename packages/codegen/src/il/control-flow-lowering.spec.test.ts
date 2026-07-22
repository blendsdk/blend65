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

/** Lowers `source` like `lowerRealSource` but returns only the emitted diagnostic codes. */
function lowerCodes(source: string): string[] {
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
  lowerToIL({ program: [ast], model, plan }, bag);
  return bag.getAll().map((d) => d.code);
}

/**
 * Wraps a for-loop header in the standard test program. `modulePrelude` lands at
 * module scope (const declarations); `fnPrelude` lands as the first statement of main.
 */
function forProgram(header: string, modulePrelude = "", fnPrelude = ""): string {
  return (
    `module Main;\nlet sum: byte;\n${modulePrelude}` +
    `function main(): void { ${fnPrelude}${header} { sum = sum + 1; } }\n`
  );
}

// A for-loop counter that can only pass its bound by WRAPPING (not by reaching it)
// would spin forever. The increment block therefore gains a wrap guard: after the
// step is stored, the counter is freshly reloaded and compared against a
// compile-time immediate — ascending guards use `lt` against typeMin + step,
// descending guards use `gt` against typeMax − step — exiting the loop on wrap.
// The guard supplements the retained bound compare in the condition block; it is
// omitted only when the bound is statically known AND stepping past it stays in
// range (ascending: bound + step ≤ typeMax; descending: bound − step ≥ typeMin).
// A runtime bound is never wrap-safe.
describe("Specification: for-loop wrap guard at type extremes", () => {
  it("should emit a gt-254 wrap guard alongside the retained ge compare when a byte loop counts down to 0", () => {
    const { text, hasErrors } = lowerRealSource(forProgram("for (let i: byte = 9 downto 0)"));
    expect(hasErrors).toBe(false);
    // the descending bound compare in the condition block is retained …
    expect(text).toMatch(/brcmp ge i8u/);
    // … and the increment block adds the wrap guard: gt against 255 − 1.
    expect(text).toMatch(/brcmp gt i8u %\d+, 254,/);
  });

  it("should compile without errors and emit a lt-1 wrap guard when a byte loop counts up to 255", () => {
    const { text, hasErrors } = lowerRealSource(forProgram("for (let i: byte = 0 to 255)"));
    // the full-range loop compiles cleanly (no internal error) …
    expect(hasErrors).toBe(false);
    // … and gets the ascending wrap guard: lt against 0 + 1.
    expect(text).toMatch(/brcmp lt i8u %\d+, 1,/);
  });

  it("should emit the lt-1 wrap guard when the 255 bound arrives through a named constant", () => {
    const { text, hasErrors } = lowerRealSource(
      forProgram("for (let i: byte = 0 to MAX)", "const MAX: byte = 255;\n"),
    );
    expect(hasErrors).toBe(false);
    expect(text).toMatch(/brcmp lt i8u %\d+, 1,/);
  });

  it("should emit a gt-65534 wrap guard when a word loop counts down to 0", () => {
    const { text, hasErrors } = lowerRealSource(forProgram("for (let i: word = 500 downto 0)"));
    expect(hasErrors).toBe(false);
    // descending word guard: gt against 65535 − 1.
    expect(text).toMatch(/brcmp gt i16u %\d+, 65534,/);
  });

  it("should emit a lt-1 wrap guard when a word loop counts up to a 0xFFFF named constant", () => {
    const { text, hasErrors } = lowerRealSource(
      forProgram("for (let i: word = 0 to M)", "const M: word = 0xFFFF;\n"),
    );
    expect(hasErrors).toBe(false);
    expect(text).toMatch(/brcmp lt i16u %\d+, 1,/);
  });

  it("should emit a signed gt-126 wrap guard when an sbyte loop counts down to -128", () => {
    const { text, hasErrors } = lowerRealSource(forProgram("for (let i: sbyte = 5 downto -128)"));
    expect(hasErrors).toBe(false);
    // descending sbyte guard: gt against 127 − 1, on the signed tag.
    expect(text).toMatch(/brcmp gt i8s %\d+, 126,/);
  });

  it("should emit a signed gt-32766 wrap guard when an sword loop counts down to -32768", () => {
    const { text, hasErrors } = lowerRealSource(
      forProgram("for (let i: sword = 100 downto -32768)"),
    );
    expect(hasErrors).toBe(false);
    // descending sword guard: gt against 32767 − 1.
    expect(text).toMatch(/brcmp gt i16s %\d+, 32766,/);
  });

  it("should anchor the signed ascending guard at typeMin + step, never at the bare step, when an sbyte loop climbs a runtime bound", () => {
    const { text, hasErrors } = lowerRealSource(
      forProgram("for (let i: sbyte = -5 to lim)", "", "let lim: sbyte = 100; "),
    );
    expect(hasErrors).toBe(false);
    // ascending sbyte guard: lt against −128 + 1 = −127.
    expect(text).toMatch(/brcmp lt i8s %\d+, -127,/);
    // a bare-step immediate (lt 1) would exit at the first negative counter value.
    expect(text).not.toMatch(/brcmp lt i8s %\d+, 1,/);
  });

  it("should fold the step into the guard immediate (gt 253) when a byte loop counts down by 2", () => {
    const { text, hasErrors } = lowerRealSource(
      forProgram("for (let i: byte = 9 downto 1 step 2)"),
    );
    expect(hasErrors).toBe(false);
    // descending byte guard with step 2: gt against 255 − 2.
    expect(text).toMatch(/brcmp gt i8u %\d+, 253,/);
  });

  it("should reject a step of at least 2^width with the step-validity diagnostic", () => {
    const codes = lowerCodes(forProgram("for (let i: byte = 0 to 10 step 256)"));
    // a step no counter value can survive is a compile-time error, not silent wrap.
    expect(codes).toContain("E10061");
  });

  it("should fold the step into the guard immediate (lt 2) when a byte loop climbs to 254 by 2", () => {
    const { text, hasErrors } = lowerRealSource(forProgram("for (let i: byte = 0 to 254 step 2)"));
    expect(hasErrors).toBe(false);
    // ascending byte guard with step 2: lt against 0 + 2.
    expect(text).toMatch(/brcmp lt i8u %\d+, 2,/);
  });

  it("should anchor the signed ascending stepped guard at typeMin + step (lt -125) when an sbyte loop climbs to 126 by 3", () => {
    const { text, hasErrors } = lowerRealSource(forProgram("for (let i: sbyte = 0 to 126 step 3)"));
    expect(hasErrors).toBe(false);
    // ascending sbyte guard with step 3: lt against −128 + 3 = −125, signed tag.
    expect(text).toMatch(/brcmp lt i8s %\d+, -125,/);
  });

  it("should emit no wrap guard when a byte loop stays in the interior of its range", () => {
    const { text, hasErrors } = lowerRealSource(forProgram("for (let i: byte = 0 to 9)"));
    expect(hasErrors).toBe(false);
    // wrap-safe: stepping past bound 9 stays in range, so no guard appears —
    // the only comparison branch is the retained bound compare.
    expect(text).not.toMatch(/brcmp lt i8u/);
    expect(text).toMatch(/brcmp le i8u/);
    expect((text.match(/brcmp/g) ?? []).length).toBe(1);
  });

  it("should emit no wrap guard when an interior bound arrives through a named constant", () => {
    const { text, hasErrors } = lowerRealSource(
      forProgram("for (let i: byte = 0 to N)", "const N: byte = 10;\n"),
    );
    expect(hasErrors).toBe(false);
    // a named constant folding to an interior bound is just as wrap-safe.
    expect(text).not.toMatch(/brcmp lt i8u/);
    expect(text).toMatch(/brcmp le i8u/);
    expect((text.match(/brcmp/g) ?? []).length).toBe(1);
  });

  it("should keep the zero-trip bound compare and emit no guard when the init already exceeds a wrap-safe bound", () => {
    const { text, hasErrors } = lowerRealSource(forProgram("for (let i: byte = 9 to 0)"));
    expect(hasErrors).toBe(false);
    // the retained bound compare makes the loop fall straight through …
    expect(text).toMatch(/brcmp le i8u/);
    // … and bound 0 is wrap-safe, so no ascending guard is added.
    expect(text).not.toMatch(/brcmp lt i8u/);
  });

  it("should emit the lt-1 wrap guard when a constant expression folds the bound to 255", () => {
    const { text, hasErrors } = lowerRealSource(forProgram("for (let i: byte = 0 to 254 + 1)"));
    expect(hasErrors).toBe(false);
    expect(text).toMatch(/brcmp lt i8u %\d+, 1,/);
  });

  it("should emit the wrap guard when the bound is a runtime variable", () => {
    const { text, hasErrors } = lowerRealSource(
      forProgram("for (let i: byte = 0 to limit)", "", "let limit: byte = 255; "),
    );
    expect(hasErrors).toBe(false);
    // a bound unknown at compile time can never be proven wrap-safe.
    expect(text).toMatch(/brcmp lt i8u %\d+, 1,/);
  });

  it("should guard on a fresh post-store reload of the counter, not the add's destination temp", () => {
    const { text, hasErrors } = lowerRealSource(forProgram("for (let i: byte = 0 to 255)"));
    expect(hasErrors).toBe(false);
    const { sections } = splitBlocks(text);
    // the increment block both steps the counter and stores it back to its slot.
    const incr = [...sections.values()].find(
      (chunk) => chunk.includes("add i8u") && /store [^\n]*__frame_Main_main_i/.test(chunk),
    );
    expect(incr).toBeDefined();
    // the counter slot is loaded twice in that block: once feeding the add,
    // once as the fresh reload the guard compares.
    const loads = [...incr!.matchAll(/%(\d+) = load i8u __frame_Main_main_i/g)];
    expect(loads).toHaveLength(2);
    // the fresh reload happens after the store, so it observes the stepped value.
    const storeIdx = incr!.search(/store [^\n]*__frame_Main_main_i/);
    expect(loads[1].index).toBeGreaterThan(storeIdx);
    // the guard branches on the reload's temp, not on the add's destination temp.
    const addDest = incr!.match(/%(\d+) = add i8u/);
    expect(addDest).not.toBeNull();
    const guard = incr!.match(/brcmp lt i8u %(\d+),/);
    expect(guard).not.toBeNull();
    expect(guard![1]).toBe(loads[1][1]);
    expect(guard![1]).not.toBe(addDest![1]);
  });

  it("should compare one counter temp against a bare numeric immediate, never two temps", () => {
    const { text, hasErrors } = lowerRealSource(forProgram("for (let i: byte = 0 to 255)"));
    expect(hasErrors).toBe(false);
    // exact operand shape: %temp on the left, a literal number on the right.
    expect(text).toMatch(/brcmp lt i8u %\d+, \d+, _L\d+, _L\d+/);
    // comparing against another temp would test the pre-step value, not wrap.
    expect(text).not.toMatch(/brcmp lt i8u %\d+, %\d+/);
  });
});
