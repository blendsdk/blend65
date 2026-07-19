/**
 * Implementation tests for CFG lowering: nested loops, `else if` chains,
 * `downto` (ge/sub), and the Pattern-B full-range guard (records an ICE for
 * `0 to 255`, never throws). Covers internals/edges the spec cases do not pin.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, IceCode } from "@blend65/core";
import type { ProgramNode } from "@blend65/core";
import { analyze, lex, modelToFunctionInfo, modelToModuleVars, parse, planAllocation } from "@blend65/frontend";
import { printIL } from "./print-il.js";
import { lowerToIL } from "./lower.js";

function lowerReal(source: string): { text: string; iceCount: number; threw: boolean } {
  const bag = createDiagnosticBag();
  let text = "";
  let threw = false;
  try {
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
    text = printIL(lowerToIL({ program: [ast], model, plan }, bag));
  } catch {
    threw = true;
  }
  const iceCount = bag.getAll().filter((d) => d.code === IceCode.Unexpected).length;
  return { text, iceCount, threw };
}

describe("RD-18 Slice 4a CFG lowering internals (P2)", () => {
  it("lowers nested loops without an ICE (each loop gets its own cond/body/end)", () => {
    const { text, iceCount, threw } = lowerReal(
      "module Main;\nfunction main(): void { let a: byte = 1; let b: byte = 1;" +
        " while (a > 0) { while (b > 0) { b = b - 1; } a = a - 1; } }\n",
    );
    expect(threw).toBe(false);
    expect(iceCount).toBe(0);
    // Two loops → at least two conditional terminators. Both conditions are
    // comparisons, so each fuses into the branch rather than materialising a flag.
    expect((text.match(/brcmp/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("lowers an else-if chain to multiple fused tests, no ICE", () => {
    const { text, iceCount } = lowerReal(
      "module Main;\nfunction main(): void { let n: byte = 1;" +
        " if (n > 2) { poke(0xC000, 1); } else if (n > 1) { poke(0xC000, 2); } else { poke(0xC000, 3); } }\n",
    );
    expect(iceCount).toBe(0);
    expect((text.match(/brcmp/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("lowers a downto for-loop with ge compare + sub increment", () => {
    const { text, iceCount } = lowerReal(
      "module Main;\nlet sum: byte;\nfunction main(): void {" +
        " for (let i: byte = 5 downto 1) { sum = sum + i; } }\n",
    );
    expect(iceCount).toBe(0);
    expect(text).toContain("ge i8u"); // downto → continue while counter >= bound
    expect(text).toContain("sub i8u"); // downto → decrement
  });

  it("records an ICE (never throws) for the Pattern-B full-range 'to 255' (AR-6)", () => {
    const { iceCount, threw } = lowerReal(
      "module Main;\nfunction main(): void { for (let i: byte = 0 to 255) {} }\n",
    );
    expect(threw).toBe(false);
    expect(iceCount).toBeGreaterThanOrEqual(1); // Pattern-B wrap deferred → ICE
  });
});

describe("Condition-position lowering internals", () => {
  // Double negation cancels: each `!` swaps the branch targets, so two of them
  // put the targets back where they started and cost nothing on the way.
  it("lowers if(!!b) to byte-identical IL with if(b)", () => {
    const program = (cond: string): string =>
      "module Main;\nfunction main(): void { let b: boolean = true;" +
      ` if (${cond}) { poke(0xC000, 1); } else { poke(0xC000, 2); } }\n`;
    const plain = lowerReal(program("b"));
    const doubled = lowerReal(program("!!b"));
    expect(plain.iceCount).toBe(0);
    expect(doubled.iceCount).toBe(0);
    expect(doubled.text).toBe(plain.text);
  });

  // `&&` binds tighter than `||`, so this is `a || (b < c && d < e)`: the left
  // clause decides on its own, and the right clause is a nested chain whose
  // first test must be reachable only from the `||`'s undecided edge.
  it("chains a && nested under a || into fused tests with no synthetic slot", () => {
    const { text, iceCount } = lowerReal(
      "module Main;\nfunction main(): void { let a: boolean = false;" +
        " let b: byte = 1; let c: byte = 2; let d: byte = 3; let e: byte = 4;" +
        " if (a || b < c && d < e) { poke(0xC000, 1); } }\n",
    );
    expect(iceCount).toBe(0);
    expect(text).toContain("brcmp lt i8u"); // both inner comparisons fuse
    expect((text.match(/brcmp/g) ?? []).length).toBe(2);
    expect((text.match(/brcond/g) ?? []).length).toBe(1); // the boolean read only
    expect(text).not.toContain("0sc"); // condition position claims nothing
  });

  // The mirror nesting: `(a < b || c < d) && e` — parentheses force the `||`
  // under the `&&`, and neither claims a slot.
  it("chains a || nested under a && into fused tests with no synthetic slot", () => {
    const { text, iceCount } = lowerReal(
      "module Main;\nfunction main(): void { let a: byte = 1; let b: byte = 2;" +
        " let c: byte = 3; let d: byte = 4; let e: boolean = true;" +
        " if ((a < b || c < d) && e) { poke(0xC000, 1); } }\n",
    );
    expect(iceCount).toBe(0);
    expect((text.match(/brcmp/g) ?? []).length).toBe(2);
    expect((text.match(/brcond/g) ?? []).length).toBe(1);
    expect(text).not.toContain("0sc");
  });

  // The slot counter is shared with the frame planner, which counts sites in
  // the same order from the AST. A `&&` one edge below a condition is back in
  // value position and must be claimed by BOTH — if either side disagreed, the
  // claim would land on a slot the frame does not have and ICE loudly here.
  it("agrees with the planner on a && buried under a condition's comparison", () => {
    const { text, iceCount, threw } = lowerReal(
      "module Main;\nfunction main(): void { let a: boolean = true; let b: boolean = true;" +
        " if ((a && b) == true) { poke(0xC000, 1); } }\n",
    );
    expect(threw).toBe(false);
    expect(iceCount).toBe(0); // no frame-miss / size-mismatch rejection
    expect(text).toContain("0sc0"); // the value-position short-circuit kept its slot
  });

  // A condition whose type never resolved must not reach the fused path with a
  // poisoned operand type — the program is already rejected, and lowering only
  // has to stay quiet and finish.
  it("does not throw on a condition referencing an undeclared name", () => {
    const { threw } = lowerReal(
      "module Main;\nfunction main(): void { if (nope > 1) { poke(0xC000, 1); } }\n",
    );
    expect(threw).toBe(false);
  });

  // A switch whose discriminant is a word compares at word width in every
  // dispatch test — a byte-stamped compare would match on the low byte alone.
  it("stamps word-discriminant dispatch tests with the word operand type", () => {
    const { text, iceCount } = lowerReal(
      "module Main;\nfunction main(): void { let w: word = 300;" +
        " switch (w) { case 300: poke(0xC000, 1); default: poke(0xC000, 2); } }\n",
    );
    expect(iceCount).toBe(0);
    expect(text).toContain("brcmp eq i16u");
  });
});
