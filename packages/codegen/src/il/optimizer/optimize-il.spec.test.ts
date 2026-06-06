/**
 * Specification tests for the RD-06 IL optimizer pipeline (ST-O1..O5).
 *
 * Derived EXCLUSIVELY from plans/rd-06-il-optimizer/07-testing-strategy.md
 * (ST-O1..O5), 03-03-textual-and-optimizer.md Part B (the §4.11 pipeline
 * contract), and RD-06 R56/R57/R61 — NOT from implementation logic.
 *
 * v1 ships ZERO real passes (D1): the pipeline is an architectural seam. These
 * tests pin (a) the identity passthrough when `passes = []`, (b) that supplied
 * passes run in array order, and (c) that the passthrough emits no diagnostics
 * (D2 — no W10130 in v1).
 *
 * Spec-tests-first (testing.md Rule 10): authored before `optimize-il.ts`/
 * `pass.ts` exist, expected to FAIL first (red), then PASS (green). Immutable
 * oracle.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag } from "@blend65/core";
import type { AllocationPlan, DiagnosticBag } from "@blend65/core";

import { IL_BYTE } from "../il-type.js";
import { loc } from "../operand.js";
import type { ILFunction, ILProgram } from "../cfg.js";
import { printIL } from "../print-il.js";
import { optimizeIL } from "./optimize-il.js";
import type { ILPass } from "./pass.js";

/** Minimal empty plan — the optimizer never reads it. */
const EMPTY_PLAN = {
  frames: new Map(),
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

const FN: ILFunction = {
  name: "Main.main",
  params: [],
  returnType: "void",
  blocks: [
    {
      label: "_entry",
      instructions: [{ op: "store", a: { kind: "immediate", value: 5, type: IL_BYTE }, b: loc("$D020", IL_BYTE) }],
      terminator: { kind: "ret" },
    },
  ],
  tempCount: 0,
  isInterrupt: false,
};

const PROGRAM: ILProgram = {
  functions: [FN],
  initCode: [],
  constData: [],
  allocationPlan: EMPTY_PLAN,
};

const EMPTY_PROGRAM: ILProgram = {
  functions: [],
  initCode: [],
  constData: [],
  allocationPlan: EMPTY_PLAN,
};

/** An identity pass that records it ran. */
function identityPass(log: string[]): ILPass {
  return {
    name: "identity",
    run(program: ILProgram): ILProgram {
      log.push("identity");
      return program;
    },
  };
}

/** A pass that appends its tag to a shared log, returning the program unchanged. */
function tagPass(tag: string, log: string[]): ILPass {
  return {
    name: tag,
    run(program: ILProgram, _bag: DiagnosticBag): ILProgram {
      log.push(tag);
      return program;
    },
  };
}

describe("Specification: RD-06 optimizeIL (§4.11)", () => {
  // ST-O1 — empty pass list → input returned unchanged (identity passthrough).
  it("should return the program unchanged with no passes (ST-O1, R57/AC-14)", () => {
    const bag = createDiagnosticBag();
    const out = optimizeIL(PROGRAM, [], bag);
    expect(out).toBe(PROGRAM);
    expect(printIL(out)).toBe(printIL(PROGRAM));
  });

  // ST-O2 — a single identity pass runs and yields text-identical output.
  it("should invoke a single pass and preserve the text (ST-O2, R56/AC-14)", () => {
    const bag = createDiagnosticBag();
    const log: string[] = [];
    const out = optimizeIL(PROGRAM, [identityPass(log)], bag);
    expect(log).toEqual(["identity"]);
    expect(printIL(out)).toBe(printIL(PROGRAM));
  });

  // ST-O3 — multiple passes run in array order (tagA before tagB).
  it("should run passes in array order (ST-O3, R56/§4.11)", () => {
    const bag = createDiagnosticBag();
    const log: string[] = [];
    optimizeIL(PROGRAM, [tagPass("A", log), tagPass("B", log)], bag);
    expect(log).toEqual(["A", "B"]);
  });

  // ST-O4 — an empty program passes through unchanged.
  it("should pass an empty program through unchanged (ST-O4, R57)", () => {
    const bag = createDiagnosticBag();
    const out = optimizeIL(EMPTY_PROGRAM, [], bag);
    expect(out).toBe(EMPTY_PROGRAM);
  });

  // ST-O5 — the passthrough emits no diagnostics (no W10130 in v1).
  it("should emit no diagnostics on passthrough (ST-O5, D2/R57)", () => {
    const bag = createDiagnosticBag();
    optimizeIL(PROGRAM, [], bag);
    expect(bag.getAll()).toHaveLength(0);
  });
});
