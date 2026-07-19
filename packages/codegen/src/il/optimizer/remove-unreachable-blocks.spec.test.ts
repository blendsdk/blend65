/**
 * Specification tests for the unreachable-block-removal IL pass.
 *
 * Every expectation below is derived exclusively from the specification,
 * never from reading the implementation. These are immutable oracles — if
 * the implementation disagrees, the implementation is wrong, not the test.
 *
 * Contract under test: reachability is walked from each function's own
 * `blocks[0]` (and from `initCode[0]` for the module initializer) via
 * `terminatorTargets`; every block the walk does not reach is dropped.
 * The walk is conservative — a `brcond` on a literal-constant condition
 * keeps BOTH arms reachable (constant folding is another pass's job).
 * Surviving blocks keep their relative order. A terminator target naming no
 * block is skipped rather than crashing — the translator's target validation
 * is the authority on malformed functions. A function with zero blocks
 * and an empty `initCode` are normal shapes: both this pass and the
 * jump-threading pass are the identity on them and neither may crash.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag } from "@blend65/core";
import type { AllocationPlan } from "@blend65/core";

import { IL_BYTE } from "../il-type.js";
import { imm, loc } from "../operand.js";
import type { ILInstruction, ILTerminator } from "../instruction.js";
import type { BasicBlock, ILFunction, ILProgram } from "../cfg.js";
import { optimizeIL } from "./optimize-il.js";

// The modules under test (do not exist yet — red phase).
import { removeUnreachableBlocks } from "./remove-unreachable-blocks.js";
import { threadJumps } from "./thread-jumps.js";

/** Minimal empty allocation plan — the passes never read it. */
function makePlan(): AllocationPlan {
  return {
    frames: new Map(),
    dataBase: 0,
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

/** Build an unconditional-branch terminator. */
function br(target: string): ILTerminator {
  return { kind: "br", target };
}

/** Build a basic block from its parts. */
function block(
  label: string,
  instructions: readonly ILInstruction[],
  terminator: ILTerminator,
): BasicBlock {
  return { label, instructions, terminator };
}

/** A representative single instruction (a byte store to a fixed location). */
function storeInstr(): ILInstruction {
  return { op: "store", a: imm(1, IL_BYTE), b: loc("$D020", IL_BYTE) };
}

/** Build a void, non-interrupt function from its blocks. */
function fn(name: string, blocks: readonly BasicBlock[]): ILFunction {
  return { name, params: [], returnType: "void", blocks, tempCount: 0, isInterrupt: false };
}

/** Build a program from functions plus an optional initializer stream. */
function programOf(
  functions: readonly ILFunction[],
  initCode: readonly BasicBlock[] = [],
): ILProgram {
  return { functions, initCode, initTempCount: 0, constData: [], allocationPlan: makePlan() };
}

/** Run the unreachable-block-removal pass through the real pipeline runner. */
function runRemoveUnreachable(program: ILProgram): ILProgram {
  return optimizeIL(program, [removeUnreachableBlocks], createDiagnosticBag());
}

/** Run the jump-threading pass through the real pipeline runner. */
function runThreadJumps(program: ILProgram): ILProgram {
  return optimizeIL(program, [threadJumps], createDiagnosticBag());
}

/** The block labels of a function-or-init block list, in order. */
function labelsOf(blocks: readonly BasicBlock[]): readonly string[] {
  return blocks.map((b) => b.label);
}

describe("Specification: remove-unreachable-blocks IL pass", () => {
  // A block no terminator ever targets cannot execute — it is dropped.
  it("should drop a block that no terminator targets (ST-B10)", () => {
    const input = programOf([
      fn("Main.main", [
        block("_entry", [storeInstr()], { kind: "ret" }),
        block("_orphan", [], br("_entry")),
      ]),
    ]);

    const out = runRemoveUnreachable(input);

    expect(labelsOf(out.functions[0].blocks)).toEqual(["_entry"]);
  });

  // A ret terminator does not make a block a root: a dead epilogue with real
  // instructions is still unreachable and is dropped.
  it("should drop a dead ret-terminated epilogue block (ST-B11)", () => {
    const input = programOf([
      fn("Main.main", [
        block("_entry", [storeInstr()], { kind: "ret" }),
        block("_epilogue", [storeInstr()], { kind: "ret" }),
      ]),
    ]);

    const out = runRemoveUnreachable(input);

    expect(labelsOf(out.functions[0].blocks)).toEqual(["_entry"]);
  });

  // A self-referential jump-only block reached from the entry is reachable —
  // plain reachability, no special-casing.
  it("should keep a reachable self-looping block (ST-B12)", () => {
    const input = programOf([
      fn("Main.main", [block("_entry", [storeInstr()], br("_L")), block("_L", [], br("_L"))]),
    ]);

    const out = runRemoveUnreachable(input);

    expect(labelsOf(out.functions[0].blocks)).toEqual(["_entry", "_L"]);
  });

  // The walk is conservative: it never refines a constant-condition brcond to
  // its taken edge, so both arms remain reachable even when cond is literal 0.
  it("should keep both arms of a brcond on a literal-constant condition (ST-B13)", () => {
    const input = programOf([
      fn("Main.main", [
        block("_entry", [storeInstr()], {
          kind: "brcond",
          cond: imm(0, IL_BYTE),
          trueTarget: "_T",
          falseTarget: "_F",
        }),
        block("_T", [storeInstr()], { kind: "ret" }),
        block("_F", [storeInstr()], { kind: "ret" }),
      ]),
    ]);

    const out = runRemoveUnreachable(input);

    expect(labelsOf(out.functions[0].blocks)).toEqual(["_entry", "_T", "_F"]);
  });

  // Dropping dead blocks never permutes the survivors.
  it("should preserve the relative order of surviving blocks (ST-B14)", () => {
    const input = programOf([
      fn("Main.main", [
        block("_entry", [storeInstr()], {
          kind: "brcmp",
          op: "eq",
          left: imm(1, IL_BYTE),
          right: imm(2, IL_BYTE),
          type: IL_BYTE,
          trueTarget: "_B",
          falseTarget: "_C",
        }),
        block("_dead1", [storeInstr()], { kind: "ret" }),
        block("_B", [storeInstr()], { kind: "ret" }),
        block("_dead2", [storeInstr()], { kind: "ret" }),
        block("_C", [storeInstr()], { kind: "ret" }),
      ]),
    ]);

    const out = runRemoveUnreachable(input);

    expect(labelsOf(out.functions[0].blocks)).toEqual(["_entry", "_B", "_C"]);
  });

  // The initializer stream is rooted at its own first block, exactly like a
  // function body.
  it("should drop an unreachable initCode block, rooted at initCode[0] (ST-B15)", () => {
    const input = programOf(
      [],
      [
        block("_entry", [storeInstr()], { kind: "ret" }),
        block("_dead", [storeInstr()], { kind: "ret" }),
      ],
    );

    const out = runRemoveUnreachable(input);

    expect(labelsOf(out.initCode)).toEqual(["_entry"]);
  });

  // A function with zero blocks is a normal, tolerated shape: both passes are
  // the identity on it and neither crashes.
  it("should treat a function with zero blocks as identity in both passes (ST-B41)", () => {
    const input = programOf([fn("Main.empty", [])]);

    const removed = runRemoveUnreachable(input);
    expect(removed).toEqual(input);

    const threaded = runThreadJumps(input);
    expect(threaded).toEqual(input);
  });

  // An empty initCode list is the normal case: both passes are the identity
  // on a fully-reachable program with no initializers and neither crashes.
  it("should treat an empty initCode as identity in both passes (ST-B42)", () => {
    const input = programOf(
      [fn("Main.main", [block("_entry", [storeInstr()], { kind: "ret" })])],
      [],
    );

    const removed = runRemoveUnreachable(input);
    expect(removed).toEqual(input);
    expect(removed.initCode).toEqual([]);

    const threaded = runThreadJumps(input);
    expect(threaded).toEqual(input);
    expect(threaded.initCode).toEqual([]);
  });

  // A terminator target naming no block is skipped, never a crash: the
  // translator's own target validation is the authority that reports the
  // malformed function, so both passes must stay total on this input. The
  // dangling edge must not disable the pass either — reachable blocks are
  // kept and untargeted blocks are still dropped.
  it("should skip a dangling terminator target without crashing, in both passes (ST-B46)", () => {
    const input = programOf([
      fn("Main.main", [
        block("_entry", [storeInstr()], {
          kind: "brcmp",
          op: "eq",
          left: imm(1, IL_BYTE),
          right: imm(2, IL_BYTE),
          type: IL_BYTE,
          trueTarget: "_live",
          falseTarget: "_ghost", // no block defines this label
        }),
        block("_live", [storeInstr()], { kind: "ret" }),
        block("_dead", [storeInstr()], { kind: "ret" }),
      ]),
    ]);

    // Removal stays total, keeps every genuinely reachable block, and still
    // drops the block nothing targets.
    expect(() => runRemoveUnreachable(input)).not.toThrow();
    const removed = runRemoveUnreachable(input);
    expect(labelsOf(removed.functions[0].blocks)).toEqual(["_entry", "_live"]);

    // Threading stays total and leaves the dangling target exactly as it is —
    // there is no trampoline to resolve it to. Nothing here is a trampoline,
    // so the whole program survives structurally unchanged.
    expect(() => runThreadJumps(input)).not.toThrow();
    const threaded = runThreadJumps(input);
    expect(threaded).toEqual(input);
  });
});
