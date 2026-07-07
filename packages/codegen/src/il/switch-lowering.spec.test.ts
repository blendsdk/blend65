/**
 * Specification tests for switch IL lowering (`lower.ts` `lowerSwitch`).
 *
 * Expectations derive exclusively from the documented block shapes for
 * dispatch chains, fallthrough, and the default clause — never from reading
 * the implementation (immutable oracle). Each program lowers end-to-end
 * through the real frontend so the discriminant/case values carry real types +
 * frames; the resulting `ILFunction` block graph is inspected structurally (a
 * separate byte-exact golden covers the exact output). Spec-tests-first:
 * authored while `lower.ts` still ICEs on `SwitchStmt` — red first, then green.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { ProgramNode } from "@blend65/core";
import { analyze, lex, modelToFunctionInfo, modelToModuleVars, parse, planAllocation } from "@blend65/frontend";
import { lowerToIL } from "./lower.js";
import { isImmediate } from "./operand.js";
import type { BasicBlock, ILFunction } from "./cfg.js";

/** Lowers `source` end-to-end through the REAL frontend; returns `Main.main`'s IL. */
function lowerMain(source: string): { fn: ILFunction | undefined; hasErrors: boolean } {
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
  return { fn: il.functions.find((f) => f.name === "Main.main"), hasErrors: bag.hasErrors() };
}

/** The block that materialises the immediate `v` via a `const` op (a case body marker). */
function blockWithConst(fn: ILFunction, v: number): BasicBlock | undefined {
  return fn.blocks.find((b) =>
    b.instructions.some((i) => i.op === "const" && isImmediate(i.src) && i.src.value === v),
  );
}

/** Every `brcond` terminator across the function, in block order. */
function brconds(fn: ILFunction): Array<Extract<BasicBlock["terminator"], { kind: "brcond" }>> {
  return fn.blocks
    .map((b) => b.terminator)
    .filter((t): t is Extract<BasicBlock["terminator"], { kind: "brcond" }> => t.kind === "brcond");
}

/** The join block: the (void main) fall-through block terminated with `ret`. */
function retBlock(fn: ILFunction): BasicBlock | undefined {
  return fn.blocks.find((b) => b.terminator.kind === "ret");
}

describe("Specification: RD-18 Slice 4b switch IL lowering (FR-10/FR-11)", () => {
  // A 2-case + default switch lowers to a multi-block CFG: ≥2 `brcond`
  // dispatch tests (one per case value), `eq` compares, and a join (`ret`) block.
  it("should lower a 2-case switch to a brcond dispatch chain + join (ST-12)", () => {
    const { fn, hasErrors } = lowerMain(
      "module Main;\nfunction main(): void {\n" +
        "  let x: byte = 1;\n" +
        "  switch (x) { case 1: x = 10; case 2: x = 20; default: x = 0; }\n" +
        "}\n",
    );
    expect(hasErrors).toBe(false);
    expect(fn).toBeDefined();
    expect(brconds(fn!).length).toBeGreaterThanOrEqual(2); // one dispatch test per case value
    expect(fn!.blocks.some((b) => b.instructions.some((i) => i.op === "eq"))).toBe(true);
    expect(retBlock(fn!)).toBeDefined(); // the join
  });

  // A multi-value `case 2, 3:` emits two `eq`+`brcond` tests whose true
  // edges point at the same shared body block.
  it("should point both multi-value tests at one shared body block (ST-13)", () => {
    const { fn, hasErrors } = lowerMain(
      "module Main;\nfunction main(): void {\n" +
        "  let x: byte = 2;\n" +
        "  switch (x) { case 2, 3: x = 20; default: x = 0; }\n" +
        "}\n",
    );
    expect(hasErrors).toBe(false);
    const bc = brconds(fn!);
    expect(bc.length).toBeGreaterThanOrEqual(2);
    expect(bc[0].trueTarget).toBe(bc[1].trueTarget); // value 2 and value 3 share one body
  });

  // A case body ending in `fallthrough` terminates with `br(<next clause
  // body>)`, not `br(join)`.
  it("should fall through to the next clause body, not the join (ST-14)", () => {
    const { fn, hasErrors } = lowerMain(
      "module Main;\nfunction main(): void {\n" +
        "  let x: byte = 1;\n" +
        "  switch (x) { case 1: x = 10; fallthrough; case 2: x = 20; default: x = 0; }\n" +
        "}\n",
    );
    expect(hasErrors).toBe(false);
    const case1 = blockWithConst(fn!, 10);
    const case2 = blockWithConst(fn!, 20);
    expect(case1?.terminator.kind).toBe("br");
    expect(case1?.terminator).toMatchObject({ target: case2!.label }); // → next body
    expect(case1?.terminator).not.toMatchObject({ target: retBlock(fn!)!.label }); // not join
  });

  // A case body without `fallthrough` terminates with `br(join)` (auto-break).
  it("should auto-break a fallthrough-less case body to the join (ST-15)", () => {
    const { fn, hasErrors } = lowerMain(
      "module Main;\nfunction main(): void {\n" +
        "  let x: byte = 1;\n" +
        "  switch (x) { case 1: x = 10; case 2: x = 20; default: x = 0; }\n" +
        "}\n",
    );
    expect(hasErrors).toBe(false);
    const case1 = blockWithConst(fn!, 10);
    expect(case1?.terminator).toMatchObject({ kind: "br", target: retBlock(fn!)!.label });
  });

  // The dispatch chain's final false edge is an unconditional `br(<default
  // body>)`: an empty tail block branching straight to the default body.
  it("should route the dispatch tail unconditionally to the default body (ST-16)", () => {
    const { fn, hasErrors } = lowerMain(
      "module Main;\nfunction main(): void {\n" +
        "  let x: byte = 9;\n" +
        "  switch (x) { case 1: x = 10; default: x = 0; }\n" +
        "}\n",
    );
    expect(hasErrors).toBe(false);
    const def = blockWithConst(fn!, 0); // default body writes 0
    expect(def).toBeDefined();
    // an instruction-free dispatch tail block branches unconditionally to it.
    expect(
      fn!.blocks.some(
        (b) =>
          b.instructions.length === 0 &&
          b.terminator.kind === "br" &&
          b.terminator.target === def!.label,
      ),
    ).toBe(true);
  });
});
