/**
 * Specification tests for RD-17 T3 call-site marshalling (ST-24..ST-27).
 *
 * Derived EXCLUSIVELY from RD-17 §4.5 (the runtime ABI), AR-33/AR-98/AR-P7, R35,
 * AC-10/AC-13, and the plan's ABI table (03-04) — never from reading the
 * implementation (IMMUTABLE ORACLE RULE).
 *
 * ABI oracle (AR-33/AR-P7):
 *   __rt_mul8 : a→A, b→X          → product lo→A, hi→X
 *   __rt_div16: a→A(lo)/X(hi), b→ZP arg-block (__zp_arg_0/1) → quotient A/X
 *   __rt_div8 : a→A, b→X          → quotient→A, remainder→X (mod binds remainder)
 *   E10044    : routine ZP requirement > profile zpArgBlockSize → poison (R35/AC-13)
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, createIntrinsicRegistry, DiagCode } from "@blend65/core";
import type { AllocationPlan, DiagnosticBag, IntrinsicDescriptor } from "@blend65/core";
import { IL_BYTE, IL_WORD } from "../il/il-type.js";
import { loc, temp } from "../il/operand.js";
import type { ILInstruction } from "../il/instruction.js";
import type { ILFunction } from "../il/cfg.js";
import { isInstr } from "./stream.js";
import type { StreamEntry } from "./stream.js";
import { translateFunction } from "./translate.js";

/** An instruction entry of the stream (the `isInstr`-narrowed member). */
type InstrEntry = Extract<StreamEntry, { type: "instr" }>;

/** A minimal empty allocation plan (the hand-built IL references symbols directly). */
function emptyPlan(): AllocationPlan {
  return {
    frames: new Map(),
    frameRegionBase: 0,
    frameRegionSize: 0,
    peakSimultaneous: 0,
    sharingSaved: 0,
    zpAllocations: [],
    zpUsed: 0,
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
      zpUsed: 0,
      zpBudget: 256,
      ramUsed: 0,
      ramBudget: 0,
      stackWorstCase: 0,
      stackBudget: 256,
    },
    hasErrors: false,
  };
}

/** Build a single-block function around the given instructions. */
function fnOf(instructions: readonly ILInstruction[]): ILFunction {
  return {
    name: "M.f",
    params: [],
    returnType: "void",
    blocks: [{ label: "_entry", instructions: [...instructions], terminator: { kind: "ret" } }],
    tempCount: 8,
    isInterrupt: false,
  };
}

/** Translate and return the emitted instructions (labels stripped). */
function instrsOf(fn: ILFunction, bag: DiagnosticBag): readonly InstrEntry[] {
  const stream = translateFunction(fn, emptyPlan(), "nmos6502", bag);
  return stream.entries.filter(isInstr);
}

/** The symbol name a `symbolRef`/`labelRef`/`zpSlot` operand references, or null. */
function symOf(i: InstrEntry): string | null {
  const op = i.operand;
  if (op.kind === "symbolRef" || op.kind === "zpSlot") {
    return op.name;
  }
  if (op.kind === "labelRef") {
    return op.label;
  }
  return null;
}

/** Index of the single JSR to `routine` (fails the test when absent/duplicated). */
function jsrIndex(instrs: readonly InstrEntry[], routine: string): number {
  const hits = instrs
    .map((i, idx) => ({ i, idx }))
    .filter(({ i }) => i.opcode === "JSR" && symOf(i) === routine);
  expect(hits, `expected exactly one JSR ${routine}`).toHaveLength(1);
  const hit = hits[0];
  return hit === undefined ? -1 : hit.idx;
}

describe("Specification: RD-17 byte multiply marshalling (ST-24, AC-10, AR-33)", () => {
  it("a * b (bytes): LDA <a>, LDX <b>, JSR __rt_mul8; word result consumed from A/X", () => {
    const bag = createDiagnosticBag();
    // let r: word = a * b  — a/b are byte homes, the product is a word store.
    const instrs = instrsOf(
      fnOf([
        { op: "mul", dest: temp(0, IL_WORD), left: loc("a", IL_BYTE), right: loc("b", IL_BYTE), type: IL_BYTE },
        { op: "store", a: temp(0, IL_WORD), b: loc("r", IL_WORD) },
      ]),
      bag,
    );
    const call = jsrIndex(instrs, "__rt_mul8");
    const before = instrs.slice(0, call);
    // Both operands are marshalled (the RD-07b left-only stub is gone — AC-10):
    // a → A and b → X, each reading its own home.
    expect(before.some((i) => i.opcode === "LDA" && symOf(i) === "a")).toBe(true);
    expect(before.some((i) => i.opcode === "LDX" && symOf(i) === "b")).toBe(true);
    // The word product lands in A(lo)/X(hi) and the consuming store writes both
    // bytes of `r` without re-loading from anywhere else.
    const after = instrs.slice(call + 1);
    expect(after.some((i) => i.opcode === "STA" && symOf(i) === "r")).toBe(true);
    expect(after.some((i) => i.opcode === "STX" && symOf(i) === "r")).toBe(true);
    // No mod/other runtime symbol appears.
    expect(instrs.every((i) => i.opcode !== "JSR" || symOf(i) === "__rt_mul8")).toBe(true);
    expect(bag.getAll().filter((d) => d.code.startsWith("E9"))).toHaveLength(0);
  });
});

describe("Specification: RD-17 word divide marshalling (ST-25, AR-P7, AR-98)", () => {
  it("a / b (words): b → __zp_arg_0/1, a → A/X, JSR __rt_div16", () => {
    const bag = createDiagnosticBag();
    const instrs = instrsOf(
      fnOf([
        { op: "div", dest: temp(0, IL_WORD), left: loc("a", IL_WORD), right: loc("b", IL_WORD), type: IL_WORD },
        { op: "store", a: temp(0, IL_WORD), b: loc("q", IL_WORD) },
      ]),
      bag,
    );
    const call = jsrIndex(instrs, "__rt_div16");
    const before = instrs.slice(0, call);
    // The second word operand travels through the allocator's existing ZP
    // arg-block symbols (PF-018) — one STA per byte.
    const argStores = before.filter((i) => i.opcode === "STA" && symOf(i)?.startsWith("__zp_arg_") === true);
    expect(argStores.map(symOf)).toEqual(["__zp_arg_0", "__zp_arg_1"]);
    // At the call, A/X hold the first operand: the LAST loads before JSR read `a`.
    const lastLda = [...before].reverse().find((i) => i.opcode === "LDA");
    const lastLdx = [...before].reverse().find((i) => i.opcode === "LDX");
    expect(lastLda !== undefined && symOf(lastLda)).toBe("a");
    expect(lastLdx !== undefined && symOf(lastLdx)).toBe("a");
    expect(bag.getAll().filter((d) => d.code.startsWith("E9"))).toHaveLength(0);
  });
});

describe("Specification: RD-17 byte modulo marshalling (ST-26, AR-98)", () => {
  it("a % b (bytes): JSR __rt_div8, remainder (X) bound as the result; no __rt_mod8", () => {
    const bag = createDiagnosticBag();
    const instrs = instrsOf(
      fnOf([
        { op: "mod", dest: temp(0, IL_BYTE), left: loc("a", IL_BYTE), right: loc("b", IL_BYTE), type: IL_BYTE },
        { op: "store", a: temp(0, IL_BYTE), b: loc("m", IL_BYTE) },
      ]),
      bag,
    );
    const call = jsrIndex(instrs, "__rt_div8");
    // NO __rt_mod8 symbol exists anywhere (mod shares the divide routine — AR-98).
    expect(instrs.some((i) => symOf(i) === "__rt_mod8")).toBe(false);
    // The remainder returns in X; binding it as the byte result requires a TXA
    // before the store reads A.
    const after = instrs.slice(call + 1);
    const txa = after.findIndex((i) => i.opcode === "TXA");
    const sta = after.findIndex((i) => i.opcode === "STA" && symOf(i) === "m");
    expect(txa, "expected TXA to bind the remainder").toBeGreaterThanOrEqual(0);
    expect(sta).toBeGreaterThan(txa);
    expect(bag.getAll().filter((d) => d.code.startsWith("E9"))).toHaveLength(0);
  });
});

describe("Specification: RD-17 ZP arg-block overflow (ST-27, R35, AC-13)", () => {
  /** A fixture T3 descriptor demanding more ZP bytes than the profile provides. */
  const HUNGRY: IntrinsicDescriptor = {
    name: "__rt_fix_hungry",
    tier: "T3",
    signature: {
      params: [
        { name: "a", type: "word" },
        { name: "b", type: "word" },
        { name: "c", type: "word" },
      ],
      returnType: "void",
    },
    availability: () => true,
    loweringStrategy: "call",
    costMetadata: { cycles: "varies", bytes: "varies", zpBytes: 6 },
    clobberList: ["A", "X", "Y", "status"],
    description: "fixture: needs 6 ZP arg bytes",
    asmModulePath: "runtime/fix-hungry.asm",
  };

  it("descriptor needing 6 ZP bytes on a 4-byte profile → E10044, statement poisoned", () => {
    const bag = createDiagnosticBag();
    const fn = fnOf([{ op: "intrinsic", name: "__rt_fix_hungry", args: [], descriptor: HUNGRY }]);
    const stream = translateFunction(fn, emptyPlan(), "nmos6502", bag, {
      zpArgBlockSize: 4,
      platformId: "fixture",
    });
    // E10044 with the AR-P11 message shape: routine, requirement, platform, actual.
    const err = bag.getAll().find((d) => d.code === DiagCode.ZpArgBlockExceeded);
    expect(err).toBeDefined();
    expect(err?.message).toContain("__rt_fix_hungry");
    expect(err?.message).toContain("6");
    expect(err?.message).toContain("fixture");
    expect(err?.message).toContain("4");
    // Poisoned: the call is NOT emitted; compilation continues (no ICE).
    const jsrs = stream.entries.filter(isInstr).filter((i) => i.opcode === "JSR");
    expect(jsrs).toHaveLength(0);
    expect(bag.getAll().filter((d) => d.code.startsWith("E9"))).toHaveLength(0);
  });

  it("the four catalog routines fit any valid profile (floor 4): no E10044 at size 4", () => {
    const bag = createDiagnosticBag();
    const registry = createIntrinsicRegistry();
    // mul16/div16 declare zpBytes 2 — within the validated floor of 4 (R35).
    for (const name of ["__rt_mul16", "__rt_div16"]) {
      expect(registry.get(name)?.costMetadata.zpBytes).toBeLessThanOrEqual(4);
    }
    const fn = fnOf([
      { op: "div", dest: temp(0, IL_WORD), left: loc("a", IL_WORD), right: loc("b", IL_WORD), type: IL_WORD },
      { op: "store", a: temp(0, IL_WORD), b: loc("q", IL_WORD) },
    ]);
    translateFunction(fn, emptyPlan(), "nmos6502", bag, { zpArgBlockSize: 4, platformId: "fixture" });
    expect(bag.getAll().some((d) => d.code === DiagCode.ZpArgBlockExceeded)).toBe(false);
  });
});
