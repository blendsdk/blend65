/**
 * Implementation tests for the IL→Instr translator (edge cases & internals).
 *
 * Written after the implementation: these exercise behaviour that the
 * specification oracles do not pin — the 16-bit `sub` borrow chain, the swapped-operand
 * comparison forms (`gt`/`le`), determinism, generated-label uniqueness across two
 * comparisons, and constant-fold edge values. They complement
 * `translate.spec.test.ts`.
 */

import { describe, expect, it } from "vitest";
import {
  createDiagnosticBag,
  type AllocationPlan,
  type ZpAllocation,
} from "@blend65/core";
import { imm, loc, temp } from "../il/operand.js";
import { IL_BYTE, IL_WORD } from "../il/il-type.js";

import type { ILInstruction, ILTerminator } from "../il/instruction.js";
import type { ILFunction } from "../il/cfg.js";
import { printInstr } from "./print-instr.js";
import { isInstr } from "./stream.js";
import { translateFunction } from "./translate.js";

function makePlan(tempSlotNames: readonly string[] = []): AllocationPlan {
  const zpAllocations: ZpAllocation[] = tempSlotNames.map((name, i) => ({
    name,
    address: 0x10 + i,
    size: 1,
    category: "temp",
  }));
  return {
    frames: new Map(),
    frameRegionBase: 0,
    frameRegionSize: 0,
    peakSimultaneous: 0,
    sharingSaved: 0,
    zpAllocations,
    zpUsed: zpAllocations.length,
    zpBudget: 256,
    moduleVariables: [],
    moduleVariablesSize: 0,
    stackAnalysis: {
      maxMainDepth: 0,
      maxMainStackBytes: 0,
      maxIrqDepth: 0,
      maxIrqStackBytes: 0,
      irqOverhead: 0,
      totalWorstCase: 0,
      platformBudget: 256,
      exceedsWarningThreshold: false,
    },
    symbolDefinitions: [],
    resourceData: {
      frameRegionBytes: 0,
      frameRegionPeak: 0,
      frameSharingSaved: 0,
      zpUsed: zpAllocations.length,
      zpBudget: 256,
      ramUsed: 0,
      ramBudget: 0,
      stackWorstCase: 0,
      stackBudget: 256,
    },
    hasErrors: false,
  };
}

function makeFn(
  instructions: readonly ILInstruction[],
  terminator: ILTerminator,
): ILFunction {
  return {
    name: "M.f",
    params: [],
    returnType: "void",
    blocks: [{ label: "_entry", instructions, terminator }],
    tempCount: 8,
    isInterrupt: false,
  };
}

function render(instructions: readonly ILInstruction[], terminator: ILTerminator): string {
  const bag = createDiagnosticBag();
  return printInstr(translateFunction(makeFn(instructions, terminator), makePlan(["__zp_tmp_0"]), "nmos6502", bag));
}

describe("translator — 16-bit sub borrow chain", () => {
  it("emits SEC once then SBC on each byte (lo then hi) into the store target", () => {
    const text = render(
      [
        { op: "load", a: temp(0, IL_WORD), b: loc("a", IL_WORD) },
        { op: "load", a: temp(1, IL_WORD), b: loc("b", IL_WORD) },
        { op: "sub", dest: temp(2, IL_WORD), left: temp(0, IL_WORD), right: temp(1, IL_WORD), type: IL_WORD },
        { op: "store", a: temp(2, IL_WORD), b: loc("r", IL_WORD) },
      ],
      { kind: "ret" },
    );
    expect(text).toBe(
      [
        "M_f:",
        "    LDA a",
        "    SEC",
        "    SBC b",
        "    STA r",
        "    LDA a+1",
        "    SBC b+1",
        "    STA r+1",
        "    RTS",
      ].join("\n"),
    );
  });
});


describe("translator — swapped-operand comparison forms (gt/le)", () => {
  it("translates gt by swapping operands into a BCC form on the swapped CMP", () => {
    const bag = createDiagnosticBag();
    const stream = translateFunction(
      makeFn(
        [
          { op: "load", a: temp(0, IL_BYTE), b: loc("a", IL_BYTE) },
          { op: "load", a: temp(1, IL_BYTE), b: loc("b", IL_BYTE) },
          { op: "gt", dest: temp(2, IL_BYTE), left: temp(0, IL_BYTE), right: temp(1, IL_BYTE), type: IL_BYTE },
          { op: "store", a: temp(2, IL_BYTE), b: loc("r", IL_BYTE) },
        ],
        { kind: "ret" },
      ),
      makePlan(),
      "nmos6502",
      bag,
    );
    const instrs = stream.entries.filter(isInstr);
    // a > b ≡ b < a → LDA b ; CMP a ; ... BCC
    expect(instrs[0] && isInstr(instrs[0]) ? instrs[0].operand : undefined).toMatchObject({ name: "b" });
    const cmp = instrs.find((e) => isInstr(e) && e.opcode === "CMP");
    expect(cmp && isInstr(cmp) ? cmp.operand : undefined).toMatchObject({ name: "a" });
    expect(instrs.some((e) => isInstr(e) && e.opcode === "BCC")).toBe(true);
  });

  it("uses distinct generated labels for two comparisons in one function", () => {
    const text = render(
      [
        { op: "load", a: temp(0, IL_BYTE), b: loc("a", IL_BYTE) },
        { op: "load", a: temp(1, IL_BYTE), b: loc("b", IL_BYTE) },
        { op: "eq", dest: temp(2, IL_BYTE), left: temp(0, IL_BYTE), right: temp(1, IL_BYTE), type: IL_BYTE },
        { op: "store", a: temp(2, IL_BYTE), b: loc("r", IL_BYTE) },
        { op: "load", a: temp(3, IL_BYTE), b: loc("c", IL_BYTE) },
        { op: "load", a: temp(4, IL_BYTE), b: loc("d", IL_BYTE) },
        { op: "ne", dest: temp(5, IL_BYTE), left: temp(3, IL_BYTE), right: temp(4, IL_BYTE), type: IL_BYTE },
        { op: "store", a: temp(5, IL_BYTE), b: loc("s", IL_BYTE) },
      ],
      { kind: "ret" },
    );
    expect(text).toContain("_cmp0:");
    expect(text).toContain("_cmp1:");
  });

  // Regression guard: a Z-based comparison MUST branch directly after CMP —
  // no flag-clobbering LDA between CMP and BEQ/BNE (the earlier form always
  // evaluated to 0, proven wrong on real VICE). Guards both eq and ne.
  it("emits the Z-branch directly after CMP for eq/ne (no LDA clobbering Z)", () => {
    for (const op of ["eq", "ne"] as const) {
      const bag = createDiagnosticBag();
      const stream = translateFunction(
        makeFn(
          [
            { op: "load", a: temp(0, IL_BYTE), b: loc("a", IL_BYTE) },
            { op: "load", a: temp(1, IL_BYTE), b: loc("b", IL_BYTE) },
            { op, dest: temp(2, IL_BYTE), left: temp(0, IL_BYTE), right: temp(1, IL_BYTE), type: IL_BYTE },
            { op: "store", a: temp(2, IL_BYTE), b: loc("r", IL_BYTE) },
          ],
          { kind: "ret" },
        ),
        makePlan(),
        "nmos6502",
        bag,
      );
      const ops = stream.entries.filter(isInstr).map((e) => (isInstr(e) ? e.opcode : ""));
      const cmpIdx = ops.indexOf("CMP");
      const branch = op === "eq" ? "BEQ" : "BNE";
      // The very next opcode after CMP is the Z-branch — nothing clobbers Z.
      expect(ops[cmpIdx + 1]).toBe(branch);
    }
  });
});

describe("translator — determinism", () => {
  it("produces byte-identical output for the same IL on two runs", () => {
    const build = (): string =>
      render(
        [
          { op: "load", a: temp(0, IL_BYTE), b: loc("a", IL_BYTE) },
          { op: "load", a: temp(1, IL_BYTE), b: loc("b", IL_BYTE) },
          { op: "add", dest: temp(2, IL_BYTE), left: temp(0, IL_BYTE), right: temp(1, IL_BYTE), type: IL_BYTE },
          { op: "store", a: temp(2, IL_BYTE), b: loc("r", IL_BYTE) },
        ],
        { kind: "ret" },
      );
    expect(build()).toBe(build());
  });
});

describe("translator — constant-fold multiply edge values", () => {
  it("folds 0 * n to LDA #$00 with no warning", () => {
    const bag = createDiagnosticBag();
    const stream = translateFunction(
      makeFn(
        [
          { op: "mul", dest: temp(0, IL_BYTE), left: imm(0, IL_BYTE), right: imm(200, IL_BYTE), type: IL_BYTE },
          { op: "store", a: temp(0, IL_BYTE), b: loc("r", IL_BYTE) },
        ],
        { kind: "ret" },
      ),
      makePlan(),
      "nmos6502",
      bag,
    );
    expect(printInstr(stream)).toBe(["M_f:", "    LDA #$00", "    STA r", "    RTS"].join("\n"));
    expect(bag.getWarnings()).toHaveLength(0);
  });

  it("wraps a constant-folded product to 8 bits (200 * 2 = 400 → $90)", () => {
    const bag = createDiagnosticBag();
    const stream = translateFunction(
      makeFn(
        [
          { op: "mul", dest: temp(0, IL_BYTE), left: imm(200, IL_BYTE), right: imm(2, IL_BYTE), type: IL_BYTE },
          { op: "store", a: temp(0, IL_BYTE), b: loc("r", IL_BYTE) },
        ],
        { kind: "ret" },
      ),
      makePlan(),
      "nmos6502",
      bag,
    );
    expect(printInstr(stream)).toBe(["M_f:", "    LDA #$90", "    STA r", "    RTS"].join("\n"));
  });
});
