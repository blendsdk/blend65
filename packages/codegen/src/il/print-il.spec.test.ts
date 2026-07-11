/**
 * Specification tests for the IL textual form (`printIL`).
 *
 * Derived exclusively from the documented format rules and the add-function
 * golden (params render verbatim from their Location symbols) — not from
 * implementation logic.
 *
 * Spec-tests-first: authored before `print-il.ts` exists, expected to fail
 * first (red), then pass (green). Immutable oracle.
 */

import { describe, expect, it } from "vitest";
import type { AllocationPlan } from "@blend65/core";

import { IL_BYTE, IL_SBYTE, IL_SWORD, IL_WORD } from "./il-type.js";
import { loc, temp } from "./operand.js";
import type { BasicBlock, ILFunction, ILProgram } from "./cfg.js";
import { ilTypeTag, printIL } from "./print-il.js";

/** Minimal empty plan — printIL never reads it; only `ILProgram` requires it. */
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

/** Wrap one function as a whole `ILProgram` (empty init/const data). */
function program(fn: ILFunction): ILProgram {
  return { functions: [fn], initCode: [], initTempCount: 0, constData: [], allocationPlan: EMPTY_PLAN };
}

/**
 * The `add(a,b)` function, built by hand (params render verbatim from their
 * frame-slot Location symbols).
 */
const ADD_FN: ILFunction = {
  name: "Math.add",
  params: [loc("__frame_Math_add_a", IL_BYTE), loc("__frame_Math_add_b", IL_BYTE)],
  returnType: IL_BYTE,
  blocks: [
    {
      label: "_entry",
      instructions: [
        { op: "load", a: temp(0, IL_BYTE), b: loc("__frame_Math_add_a", IL_BYTE) },
        { op: "load", a: temp(1, IL_BYTE), b: loc("__frame_Math_add_b", IL_BYTE) },
        { op: "add", dest: temp(2, IL_BYTE), left: temp(0, IL_BYTE), right: temp(1, IL_BYTE), type: IL_BYTE },
      ],
      terminator: { kind: "ret", value: temp(2, IL_BYTE) },
    },
  ],
  tempCount: 3,
  isInterrupt: false,
};

/** The exact add-function golden text. */
const ADD_GOLDEN = [
  "function Math.add(__frame_Math_add_a: i8u, __frame_Math_add_b: i8u): i8u {",
  "_entry:",
  "  %0 = load i8u __frame_Math_add_a",
  "  %1 = load i8u __frame_Math_add_b",
  "  %2 = add i8u %0, %1",
  "  ret %2",
  "}",
].join("\n");

describe("Specification: RD-06 printIL (§4.6/§4.7)", () => {
  // printIL of the add-function program is byte-exact against the golden.
  it("should print the §4.7 add function byte-exactly (ST-P1, R53–R55)", () => {
    expect(printIL(program(ADD_FN))).toBe(ADD_GOLDEN);
  });

  // Determinism: two calls on the same program yield identical strings.
  it("should be deterministic across repeated calls (ST-P2, R53/H5)", () => {
    const p = program(ADD_FN);
    expect(printIL(p)).toBe(printIL(p));
  });

  // The four ILTypes map to their canonical type tags.
  it("should map the four ILTypes to i8u/i8s/i16u/i16s (ST-P3, §4.6)", () => {
    expect(ilTypeTag(IL_BYTE)).toBe("i8u");
    expect(ilTypeTag(IL_SBYTE)).toBe("i8s");
    expect(ilTypeTag(IL_WORD)).toBe("i16u");
    expect(ilTypeTag(IL_SWORD)).toBe("i16s");
  });

  // A Location with an offset renders `symbol+offset`.
  it("should render a location offset as sym+offset (ST-P4, §4.2/§4.6)", () => {
    const fn: ILFunction = {
      name: "M.f",
      params: [],
      returnType: "void",
      blocks: [
        {
          label: "_entry",
          // store %0, s+2  → source value %0, dest location s with offset 2
          instructions: [{ op: "store", a: temp(0, IL_WORD), b: loc("s", IL_WORD, 2) }],
          terminator: { kind: "ret" },
        },
      ],
      tempCount: 1,
      isInterrupt: false,
    };
    expect(printIL(program(fn))).toContain("store %0, s+2");
  });

  // A multi-block function prints its blocks entry-first, in array order.
  it("should print blocks entry-first in order (ST-P5, R16/§4.6)", () => {
    const entry: BasicBlock = {
      label: "_entry",
      instructions: [],
      terminator: { kind: "br", target: "_L0" },
    };
    const l0: BasicBlock = {
      label: "_L0",
      instructions: [],
      terminator: { kind: "ret" },
    };
    const fn: ILFunction = {
      name: "M.loop",
      params: [],
      returnType: "void",
      blocks: [entry, l0],
      tempCount: 0,
      isInterrupt: false,
    };
    const text = printIL(program(fn));
    const entryIdx = text.indexOf("_entry:");
    const l0Idx = text.indexOf("_L0:");
    expect(entryIdx).toBeGreaterThanOrEqual(0);
    expect(l0Idx).toBeGreaterThan(entryIdx);
    // The entry terminator branches to _L0 before the _L0 label appears.
    expect(text).toContain("  br _L0");
  });
});
