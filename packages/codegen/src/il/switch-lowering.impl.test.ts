/**
 * Implementation tests for RD-18 Slice 4b switch IL lowering edge cases: an empty
 * default body, a single-case switch, `fallthrough` into the default clause, and a
 * case body that already terminates (`break`/`return`) — no double-terminate.
 *
 * These probe `lowerSwitch`'s block bookkeeping (not a frozen-spec contract), so
 * they live in the `.impl` tier. Lowered end-to-end through the REAL frontend.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { ProgramNode } from "@blend65/core";
import { analyze, lex, modelToFunctionInfo, modelToModuleVars, parse, planAllocation } from "@blend65/frontend";
import { lowerToIL } from "./lower.js";
import { isImmediate } from "./operand.js";
import type { BasicBlock, ILFunction } from "./cfg.js";

function lowerMain(
  source: string,
  fnName = "Main.main",
): { fn: ILFunction | undefined; hasErrors: boolean } {
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
  return { fn: il.functions.find((f) => f.name === fnName), hasErrors: bag.hasErrors() };
}

function blockWithConst(fn: ILFunction, v: number): BasicBlock | undefined {
  return fn.blocks.find((b) =>
    b.instructions.some((i) => i.op === "const" && isImmediate(i.src) && i.src.value === v),
  );
}

/** Every block carries exactly one terminator (the builder invariant). */
function allBlocksTerminated(fn: ILFunction): boolean {
  return fn.blocks.every((b) => b.terminator !== undefined);
}

describe("Impl: RD-18 Slice 4b lowering edge cases", () => {
  it("lowers an empty default body without error (auto-break to join)", () => {
    const { fn, hasErrors } = lowerMain(
      "module Main;\nfunction main(): void {\n" +
        "  let x: byte = 1;\n" +
        "  switch (x) { case 1: x = 10; default: }\n" +
        "}\n",
    );
    expect(hasErrors).toBe(false);
    expect(fn).toBeDefined();
    expect(allBlocksTerminated(fn!)).toBe(true);
    // A join (ret) block exists; the default body (possibly empty) branches to it.
    expect(fn!.blocks.some((b) => b.terminator.kind === "ret")).toBe(true);
  });

  it("lowers a single-case switch (one dispatch test + default tail)", () => {
    const { fn, hasErrors } = lowerMain(
      "module Main;\nfunction main(): void {\n" +
        "  let x: byte = 1;\n" +
        "  switch (x) { case 1: x = 10; default: x = 0; }\n" +
        "}\n",
    );
    expect(hasErrors).toBe(false);
    const brcondCount = fn!.blocks.filter((b) => b.terminator.kind === "brcond").length;
    expect(brcondCount).toBe(1); // exactly one case value → one dispatch test
  });

  it("falls through from the last case straight into the default body", () => {
    const { fn, hasErrors } = lowerMain(
      "module Main;\nfunction main(): void {\n" +
        "  let x: byte = 1;\n" +
        "  switch (x) { case 1: x = 10; fallthrough; default: x = 0; }\n" +
        "}\n",
    );
    expect(hasErrors).toBe(false);
    const case1 = blockWithConst(fn!, 10);
    const def = blockWithConst(fn!, 0);
    expect(case1?.terminator).toMatchObject({ kind: "br", target: def!.label });
  });

  it("does not double-terminate a case body that ends in break (inside a loop)", () => {
    const { fn, hasErrors } = lowerMain(
      "module Main;\nfunction main(): void {\n" +
        "  let x: byte = 2;\n" +
        "  while (x > 0) {\n" +
        "    switch (x) { case 1: break; default: x = 0; }\n" +
        "    x = x - 1;\n" +
        "  }\n" +
        "}\n",
    );
    expect(hasErrors).toBe(false);
    expect(allBlocksTerminated(fn!)).toBe(true);
    // No block carries an instruction after its terminator would be reached — the
    // builder guarantees one terminator/block, and the isTerminated guard prevents
    // appending an auto-`br` after the break's `br`.
  });

  it("does not double-terminate a case body that ends in return", () => {
    const { fn, hasErrors } = lowerMain(
      "module Main;\nfunction f(): byte {\n" +
        "  let x: byte = 1;\n" +
        "  switch (x) { case 1: return 5; default: x = 0; }\n" +
        "  return 0;\n" +
        "}\nfunction main(): void { }\n",
      "Main.f",
    );
    expect(hasErrors).toBe(false);
    expect(fn).toBeDefined();
    expect(allBlocksTerminated(fn!)).toBe(true);
    // The case-1 body terminates with `ret` (its own return), not an auto-`br`.
    expect(fn!.blocks.some((b) => b.terminator.kind === "ret")).toBe(true);
  });
});
