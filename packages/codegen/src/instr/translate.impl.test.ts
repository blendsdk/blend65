/**
 * Implementation tests for the IL→Instr translator (edge cases & internals).
 *
 * Written after the implementation: these exercise behaviour that the
 * specification oracles do not pin — the 16-bit `sub` borrow chain, the swapped-operand
 * comparison forms (`gt`/`le`), determinism, generated-label uniqueness across two
 * comparisons, constant-fold edge values, terminator target validation, and the
 * fused compare-and-branch internals (label economy, block-boundary residency,
 * one read per polled register). They complement `translate.spec.test.ts`.
 */

import { describe, expect, it } from "vitest";
import {
  createDiagnosticBag,
  type AllocationPlan,
  type ZpAllocation,
} from "@blend65/core";
import { imm, loc, temp } from "../il/operand.js";
import { IL_BYTE, IL_SBYTE, IL_WORD } from "../il/il-type.js";
import type { ILType } from "../il/il-type.js";

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
    dataBase: 0,
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

describe("translator — terminator target validation internals", () => {
  /** Two blocks, both terminators supplied by the caller. */
  function twoBlockFn(entry: ILTerminator, second: ILTerminator): ILFunction {
    return {
      name: "M.f",
      params: [],
      returnType: "void",
      blocks: [
        { label: "_entry", instructions: [], terminator: entry },
        { label: "_real", instructions: [], terminator: second },
      ],
      tempCount: 8,
      isInterrupt: false,
    };
  }

  it("reports the first dangling target it meets, in block then declaration order", () => {
    // Span-less ICEs share one dedup key, so a compile surfaces one of them;
    // the pass walks blocks in order and targets true-before-false, which makes
    // which one deterministic.
    const bag = createDiagnosticBag();
    translateFunction(
      twoBlockFn(
        { kind: "brcond", cond: temp(0, IL_BYTE), trueTarget: "_gone_a", falseTarget: "_gone_b" },
        { kind: "br", target: "_gone_c" },
      ),
      makePlan(),
      "nmos6502",
      bag,
    );
    const messages = bag.getErrors().map((d) => d.message);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("'_gone_a'");
  });

  it("names the function, the originating block, and the terminator kind", () => {
    const bag = createDiagnosticBag();
    translateFunction(
      twoBlockFn({ kind: "br", target: "_real" }, { kind: "br", target: "_gone" }),
      makePlan(),
      "nmos6502",
      bag,
    );
    const message = bag.getErrors()[0].message;
    expect(message).toContain("'M.f'");
    expect(message).toContain("'_real'");
    expect(message).toContain("br");
  });

  it("surfaces the dangling target ahead of an unsupported op in the same function", () => {
    // Validation runs before any instruction is translated, so the
    // control-flow defect — the more fundamental of the two — is the one that
    // wins the shared dedup key.
    const bag = createDiagnosticBag();
    translateFunction(
      {
        name: "M.f",
        params: [],
        returnType: "void",
        blocks: [
          {
            label: "_entry",
            instructions: [
              {
                op: "load_indirect",
                value: temp(0, IL_BYTE),
                ptr: loc("__zp_p", IL_WORD),
                offset: temp(1, IL_BYTE),
              },
            ],
            terminator: { kind: "br", target: "_gone" },
          },
        ],
        tempCount: 8,
        isInterrupt: false,
      },
      makePlan(),
      "nmos6502",
      bag,
    );
    expect(bag.getErrors()[0].message).toContain("resolves to no block");
  });
});

describe("translator — fused compare-and-branch internals", () => {
  /** A function whose blocks are supplied verbatim, entry first. */
  function blocksFn(blocks: ILFunction["blocks"]): ILFunction {
    return {
      name: "M.f",
      params: [],
      returnType: "void",
      blocks,
      tempCount: 8,
      isInterrupt: false,
    };
  }

  /** A `brcmp` from the current block to `_L1` (true) and `_L2` (false). */
  function fused(
    op: "eq" | "ne" | "lt" | "le" | "gt" | "ge",
    left: string,
    right: number,
    type: ILType,
    targets: [string, string] = ["_L1", "_L2"],
  ): ILTerminator {
    return {
      kind: "brcmp",
      op,
      left: loc(left, type),
      right: imm(right, type),
      type,
      trueTarget: targets[0],
      falseTarget: targets[1],
    };
  }

  it("allocates no generated label for the fused 16-bit unsigned framing", () => {
    // The framing's internal joins become block labels in branch form, so the
    // shared `_cmp` counter must not advance — a later value comparison in the
    // same function still starts at zero.
    const stream = translateFunction(
      blocksFn([
        {
          label: "_entry",
          instructions: [],
          terminator: {
            kind: "brcmp",
            op: "lt",
            left: loc("L", IL_WORD),
            right: loc("R", IL_WORD),
            type: IL_WORD,
            trueTarget: "_L1",
            falseTarget: "_L2",
          },
        },
        {
          label: "_L1",
          instructions: [
            {
              op: "lt",
              dest: temp(0, IL_BYTE),
              left: loc("A", IL_BYTE),
              right: loc("B", IL_BYTE),
              type: IL_BYTE,
            },
          ],
          terminator: { kind: "ret" },
        },
        { label: "_L2", instructions: [], terminator: { kind: "ret" } },
      ]),
      makePlan(),
      "nmos6502",
      createDiagnosticBag(),
    );
    expect(printInstr(stream)).toContain("BCC _cmp0");
    expect(printInstr(stream)).not.toContain("_cmp1");
  });

  it("gives each fused signed framing its own overflow-correction label", () => {
    const stream = translateFunction(
      blocksFn([
        {
          label: "_entry",
          instructions: [],
          terminator: fused("lt", "L", 0x10, IL_SBYTE, ["_L1", "_L2"]),
        },
        {
          label: "_L1",
          instructions: [],
          terminator: fused("ge", "L", 0x20, IL_SBYTE, ["_L2", "_L3"]),
        },
        { label: "_L2", instructions: [], terminator: { kind: "ret" } },
        { label: "_L3", instructions: [], terminator: { kind: "ret" } },
      ]),
      makePlan(),
      "nmos6502",
      createDiagnosticBag(),
    );
    const text = printInstr(stream);
    expect(text).toContain("BVC _cmp0");
    expect(text).toContain("BVC _cmp1");
  });

  it("carries no register residency across a fused block boundary", () => {
    // The branch tail binds nothing — there is no result to bind — and a block
    // label is a branch target, so the target block re-reads what it needs even
    // though the compare left that very byte in A.
    // The filler block belongs to the scaffold, not to the subject: with `_L1`
    // sitting directly after `_entry` the translator would reach it by falling
    // through and invert the branch, which is correct output but a different
    // question from the one asked here. A block neither edge names keeps the
    // branch pair intact so the residency claim is what the assertion tests.
    const stream = translateFunction(
      blocksFn([
        { label: "_entry", instructions: [], terminator: fused("lt", "L", 0x10, IL_BYTE) },
        { label: "_filler", instructions: [], terminator: { kind: "ret" } },
        {
          label: "_L1",
          instructions: [
            { op: "load", a: temp(0, IL_BYTE), b: loc("L", IL_BYTE) },
            { op: "store", a: temp(0, IL_BYTE), b: loc("V", IL_BYTE) },
          ],
          terminator: { kind: "ret" },
        },
        { label: "_L2", instructions: [], terminator: { kind: "ret" } },
      ]),
      makePlan(),
      "nmos6502",
      createDiagnosticBag(),
    );
    expect(printInstr(stream)).toBe(
      [
        "M_f:",
        "    LDA L",
        "    CMP #$10",
        "    BCC M_f_L1",
        "    JMP M_f_L2",
        "M_f_filler:",
        "    RTS",
        "M_f_L1:",
        "    LDA L",
        "    STA V",
        "    RTS",
        "M_f_L2:",
        "    RTS",
      ].join("\n"),
    );
  });

  it("reads a polled register once even when the value is also stored", () => {
    // Two consumers — a store and the fused compare — but one load: the
    // compare reads the byte already resident in A rather than polling again.
    const stream = translateFunction(
      blocksFn([
        {
          label: "_entry",
          instructions: [
            { op: "load", a: temp(0, IL_BYTE), b: loc("VIC_RASTER", IL_BYTE) },
            { op: "store", a: temp(0, IL_BYTE), b: loc("LAST", IL_BYTE) },
          ],
          terminator: {
            kind: "brcmp",
            op: "lt",
            left: temp(0, IL_BYTE),
            right: imm(0xfb, IL_BYTE),
            type: IL_BYTE,
            trueTarget: "_L1",
            falseTarget: "_L2",
          },
        },
        { label: "_L1", instructions: [], terminator: { kind: "ret" } },
        { label: "_L2", instructions: [], terminator: { kind: "ret" } },
      ]),
      makePlan(),
      "nmos6502",
      createDiagnosticBag(),
    );
    const text = printInstr(stream);
    expect(text.match(/LDA VIC_RASTER/g)).toHaveLength(1);
    expect(text).toContain("    STA LAST\n    CMP #$FB");
  });

  it("translates a fused compare of two immediates without an ICE", () => {
    // Degenerate but representable: the translator stays total rather than
    // assuming the folder removed every constant comparison upstream.
    const bag = createDiagnosticBag();
    const stream = translateFunction(
      blocksFn([
        {
          label: "_entry",
          instructions: [],
          terminator: {
            kind: "brcmp",
            op: "lt",
            left: imm(0x05, IL_BYTE),
            right: imm(0x0a, IL_BYTE),
            type: IL_BYTE,
            trueTarget: "_L1",
            falseTarget: "_L2",
          },
        },
        // Filler, for the same reason as above: keep `_L1` off the fall-through
        // so the branch pair stays the shape this case is about.
        { label: "_filler", instructions: [], terminator: { kind: "ret" } },
        { label: "_L1", instructions: [], terminator: { kind: "ret" } },
        { label: "_L2", instructions: [], terminator: { kind: "ret" } },
      ]),
      makePlan(),
      "nmos6502",
      bag,
    );
    expect(bag.hasErrors()).toBe(false);
    expect(printInstr(stream)).toContain("    LDA #$05\n    CMP #$0A\n    BCC M_f_L1");
  });
});
