/**
 * Implementation tests for the IL textual printer.
 *
 * Cover internals and edge cases NOT pinned by the spec oracle
 * (print-il.spec.test.ts): the no-dest `store` form, the slice-2 `const i8u 5`
 * rendering, every terminator variant, multi-function blank-line separation,
 * `ilTypeTag` exhaustiveness, and the immediate-as-decimal convention.
 *
 * Written AFTER the implementation — they probe the printer as built.
 */

import { describe, expect, it } from "vitest";
import { makeSpan } from "@blend65/core";
import type { AllocationPlan } from "@blend65/core";

import { IL_BYTE, IL_SBYTE, IL_SWORD, IL_WORD } from "./il-type.js";
import { imm, loc, temp } from "./operand.js";
import type { ILFunction, ILProgram } from "./cfg.js";
import { ilTypeTag, printIL } from "./print-il.js";

const EMPTY_PLAN = {
  frames: new Map(),
  dataBase: 0,
  frameRegionBase: 0,
  frameRegionSize: 0,
  peakSimultaneous: 0,
  sharingSaved: 0,
  zpAllocations: [],
  zpUsed: 0,
  zpBudget: 0,
  moduleVariables: [],
  moduleVariablesSize: 0,
  stackAnalysis: {
    maxMainDepth: 0,
    maxMainStackBytes: 0,
    maxIrqDepth: 0,
    maxIrqStackBytes: 0,
    irqOverhead: 0,
    totalWorstCase: 0,
    platformBudget: 0,
    exceedsWarningThreshold: false,
  },
  symbolDefinitions: [],
  resourceData: {
    frameRegionBytes: 0,
    frameRegionPeak: 0,
    frameSharingSaved: 0,
    zpUsed: 0,
    zpBudget: 0,
    ramUsed: 0,
    ramBudget: 0,
    stackWorstCase: 0,
    stackBudget: 0,
  },
  hasErrors: false,
} satisfies AllocationPlan;

function prog(...functions: ILFunction[]): ILProgram {
  return { functions, initCode: [], constData: [], allocationPlan: EMPTY_PLAN };
}

function voidFn(name: string, instructions: ILFunction["blocks"][number]["instructions"]): ILFunction {
  return {
    name,
    params: [],
    returnType: "void",
    blocks: [{ label: "_entry", instructions, terminator: { kind: "ret" } }],
    tempCount: 0,
    isInterrupt: false,
  };
}

describe("ilTypeTag — exhaustive over the four IL types", () => {
  it("should produce the canonical tags", () => {
    expect(ilTypeTag(IL_BYTE)).toBe("i8u");
    expect(ilTypeTag(IL_SBYTE)).toBe("i8s");
    expect(ilTypeTag(IL_WORD)).toBe("i16u");
    expect(ilTypeTag(IL_SWORD)).toBe("i16s");
  });
});

describe("printIL — operand & instruction rendering", () => {
  it("should render the slice-2 const as `const i8u 5`", () => {
    const fn = voidFn("Main.main", [{ op: "const", dest: temp(0, IL_BYTE), src: imm(5, IL_BYTE) }]);
    expect(printIL(prog(fn))).toContain("%0 = const i8u 5");
  });

  it("should render store with no destination (just `store a, b`)", () => {
    const fn = voidFn("Main.main", [{ op: "store", a: imm(5, IL_BYTE), b: loc("__var_x", IL_BYTE) }]);
    expect(printIL(prog(fn))).toContain("  store 5, __var_x");
  });

  it("should render a location without an offset as the bare symbol", () => {
    const fn = voidFn("M.f", [{ op: "store", a: temp(0, IL_BYTE), b: loc("__var_x", IL_BYTE) }]);
    expect(printIL(prog(fn))).toContain("store %0, __var_x");
    expect(printIL(prog(fn))).not.toContain("+");
  });

  it("should render immediates as decimal regardless of magnitude", () => {
    const fn = voidFn("M.f", [{ op: "store", a: imm(53280, IL_WORD), b: loc("__var_x", IL_WORD) }]);
    // 53280 == 0xD020; v1 prints decimal (source radix is not carried on the operand).
    expect(printIL(prog(fn))).toContain("store 53280, __var_x");
  });

  it("should render a copy without a redundant type tag", () => {
    const fn = voidFn("M.f", [{ op: "copy", dest: temp(1, IL_BYTE), src: temp(0, IL_BYTE) }]);
    expect(printIL(prog(fn))).toContain("%1 = copy %0");
  });

  it("should render a source_span marker with its byte range", () => {
    const fn = voidFn("M.f", [{ op: "source_span", span: makeSpan(0, 4, 9) }]);
    expect(printIL(prog(fn))).toContain("source_span 4..9");
  });

  it("should render a void call and a value-returning call", () => {
    const voidCall = voidFn("M.f", [{ op: "call", target: "M.helper", args: [imm(1, IL_BYTE)] }]);
    expect(printIL(prog(voidCall))).toContain("  call M.helper(1)");

    const valCall = voidFn("M.g", [
      { op: "call", dest: temp(0, IL_BYTE), target: "M.helper", args: [imm(1, IL_BYTE), temp(2, IL_BYTE)] },
    ]);
    expect(printIL(prog(valCall))).toContain("%0 = call M.helper(1, %2)");
  });
});

describe("printIL — terminators", () => {
  function fnWithTerminator(term: ILFunction["blocks"][number]["terminator"]): ILFunction {
    return {
      name: "M.f",
      params: [],
      returnType: "void",
      blocks: [{ label: "_entry", instructions: [], terminator: term }],
      tempCount: 0,
      isInterrupt: false,
    };
  }

  it("should render `ret` with and without a value", () => {
    expect(printIL(prog(fnWithTerminator({ kind: "ret" })))).toContain("  ret");
    expect(printIL(prog(fnWithTerminator({ kind: "ret", value: temp(2, IL_BYTE) })))).toContain(
      "  ret %2",
    );
  });

  it("should render `br`, `brcond`, and `unreachable`", () => {
    expect(printIL(prog(fnWithTerminator({ kind: "br", target: "_L1" })))).toContain("  br _L1");
    expect(
      printIL(
        prog(
          fnWithTerminator({
            kind: "brcond",
            cond: temp(3, IL_BYTE),
            trueTarget: "_L1",
            falseTarget: "_L2",
          }),
        ),
      ),
    ).toContain("  brcond %3, _L1, _L2");
    expect(printIL(prog(fnWithTerminator({ kind: "unreachable" })))).toContain("  unreachable");
  });
});

describe("printIL — program structure", () => {
  it("should separate multiple functions with a blank line", () => {
    const a = voidFn("M.a", []);
    const b = voidFn("M.b", []);
    const text = printIL(prog(a, b));
    expect(text).toContain("}\n\nfunction M.b");
  });

  it("should print an empty program as the empty string", () => {
    expect(printIL(prog())).toBe("");
  });

  it("should use \\n line endings and no trailing newline", () => {
    const text = printIL(prog(voidFn("M.f", [])));
    expect(text.endsWith("}")).toBe(true);
    expect(text).not.toContain("\r");
  });
});
