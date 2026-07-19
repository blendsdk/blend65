/**
 * Specification tests for the jump-threading IL pass.
 *
 * Every expectation below is derived exclusively from the specification,
 * never from reading the implementation. These are immutable oracles — if
 * the implementation disagrees, the implementation is wrong, not the test.
 *
 * Contract under test: a block is a *trampoline* when its instruction list is
 * empty AND its terminator is an unconditional `br`. For every terminator
 * target in every block of every function (and of `initCode`), the pass
 * follows the trampoline chain to its final destination and rewrites the
 * target to that destination — every target of every terminator kind (`br`'s
 * single target, both edges of `brcond`/`brcmp`). Chain-following carries a
 * per-resolution visited set; whenever the chain cannot be resolved — a
 * revisited label (cyclic), or a label no block defines (dead end) — the
 * rewrite is abandoned, leaving the target exactly as it was. The pass
 * never removes a block, never reorders `blocks`, never moves `blocks[0]`,
 * and is idempotent.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag } from "@blend65/core";
import type { AllocationPlan } from "@blend65/core";

import { IL_BYTE } from "../il-type.js";
import { imm, loc } from "../operand.js";
import type { ILInstruction, ILTerminator } from "../instruction.js";
import type { BasicBlock, ILFunction, ILProgram } from "../cfg.js";
import { optimizeIL } from "./optimize-il.js";

// The module under test (does not exist yet — red phase).
import { threadJumps } from "./thread-jumps.js";

/** Minimal empty allocation plan — the pass never reads it. */
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

/** An empty jump-only block — a trampoline by definition. */
function trampoline(label: string, target: string): BasicBlock {
  return block(label, [], br(target));
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

/** Run the jump-threading pass through the real pipeline runner. */
function runThreadJumps(program: ILProgram): ILProgram {
  return optimizeIL(program, [threadJumps], createDiagnosticBag());
}

/** Look up a block by label, failing loudly when it is missing. */
function blockByLabel(blocks: readonly BasicBlock[], label: string): BasicBlock {
  const found = blocks.find((b) => b.label === label);
  if (found === undefined) {
    throw new Error(`expected a block labelled ${label}`);
  }
  return found;
}

/** The block labels of a function-or-init block list, in order. */
function labelsOf(blocks: readonly BasicBlock[]): readonly string[] {
  return blocks.map((b) => b.label);
}

describe("Specification: thread-jumps IL pass", () => {
  // A single empty jump-only block between A and M is bypassed: A's br is
  // rewritten to point at M directly.
  it("should rewrite a branch through one trampoline to the final destination (ST-B1)", () => {
    const input = programOf([
      fn("Main.main", [
        block("_entry", [storeInstr()], br("_T")),
        trampoline("_T", "_M"),
        block("_M", [storeInstr()], { kind: "ret" }),
      ]),
    ]);

    const out = runThreadJumps(input);
    const blocks = out.functions[0].blocks;

    expect(blockByLabel(blocks, "_entry").terminator).toEqual(br("_M"));
    // No block is removed and order is preserved.
    expect(labelsOf(blocks)).toEqual(["_entry", "_T", "_M"]);
  });

  // A whole chain of trampolines resolves to the final destination in a
  // single run of the pass — no fixpoint iteration needed by the caller.
  it("should resolve a multi-hop trampoline chain in one run (ST-B2)", () => {
    const input = programOf([
      fn("Main.main", [
        block("_entry", [storeInstr()], br("_T1")),
        trampoline("_T1", "_T2"),
        trampoline("_T2", "_T3"),
        trampoline("_T3", "_M"),
        block("_M", [storeInstr()], { kind: "ret" }),
      ]),
    ]);

    const out = runThreadJumps(input);
    const blocks = out.functions[0].blocks;

    expect(blockByLabel(blocks, "_entry").terminator).toEqual(br("_M"));
    // Every terminator target is rewritten to its final destination, so the
    // intermediate trampolines now point at the end of the chain too.
    expect(blockByLabel(blocks, "_T1").terminator).toEqual(br("_M"));
    expect(blockByLabel(blocks, "_T2").terminator).toEqual(br("_M"));
    expect(blockByLabel(blocks, "_T3").terminator).toEqual(br("_M"));
    expect(labelsOf(blocks)).toEqual(["_entry", "_T1", "_T2", "_T3", "_M"]);
  });

  // Both edges of a two-target terminator are rewritten independently.
  it("should retarget both edges of a brcmp whose targets are trampolines (ST-B3)", () => {
    const input = programOf([
      fn("Main.main", [
        block("_entry", [storeInstr()], {
          kind: "brcmp",
          op: "eq",
          left: imm(1, IL_BYTE),
          right: imm(2, IL_BYTE),
          type: IL_BYTE,
          trueTarget: "_T",
          falseTarget: "_F",
        }),
        trampoline("_T", "_M1"),
        trampoline("_F", "_M2"),
        block("_M1", [storeInstr()], { kind: "ret" }),
        block("_M2", [storeInstr()], { kind: "ret" }),
      ]),
    ]);

    const out = runThreadJumps(input);
    const blocks = out.functions[0].blocks;

    expect(blockByLabel(blocks, "_entry").terminator).toEqual({
      kind: "brcmp",
      op: "eq",
      left: imm(1, IL_BYTE),
      right: imm(2, IL_BYTE),
      type: IL_BYTE,
      trueTarget: "_M1",
      falseTarget: "_M2",
    });
  });

  // A trampoline ring has no final destination: resolution detects the
  // revisited label, terminates, and leaves every target exactly as it was.
  it("should terminate on a cyclic trampoline ring and leave targets unchanged (ST-B4)", () => {
    const entry = block("_entry", [storeInstr()], br("_T1"));
    const t1 = trampoline("_T1", "_T2");
    const t2 = trampoline("_T2", "_T1");
    const input = programOf([fn("Main.main", [entry, t1, t2])]);

    const out = runThreadJumps(input);
    const blocks = out.functions[0].blocks;

    expect(blockByLabel(blocks, "_entry").terminator).toEqual(br("_T1"));
    // Every resolution inside the ring is also cyclic, so the whole block
    // list survives structurally untouched.
    expect(blocks).toEqual([entry, t1, t2]);
  });

  // A self-looping trampoline is the one-block cycle: the entry edge into it
  // is left alone and the loop block itself is untouched.
  it("should leave a self-looping trampoline and its incoming edge unchanged (ST-B5)", () => {
    const input = programOf([
      fn("Main.main", [block("_entry", [storeInstr()], br("_L")), trampoline("_L", "_L")]),
    ]);

    const out = runThreadJumps(input);
    const blocks = out.functions[0].blocks;

    expect(blockByLabel(blocks, "_entry").terminator).toEqual(br("_L"));
    expect(blockByLabel(blocks, "_L")).toEqual(trampoline("_L", "_L"));
  });

  // One instruction disqualifies a block from being a trampoline: skipping it
  // would skip real work, so the edge must stay.
  it("should not retarget through a jump block that contains an instruction (ST-B6)", () => {
    const input = programOf([
      fn("Main.main", [
        block("_entry", [storeInstr()], br("_B")),
        block("_B", [storeInstr()], br("_M")),
        block("_M", [storeInstr()], { kind: "ret" }),
      ]),
    ]);

    const out = runThreadJumps(input);
    const blocks = out.functions[0].blocks;

    expect(blockByLabel(blocks, "_entry").terminator).toEqual(br("_B"));
    expect(labelsOf(blocks)).toEqual(["_entry", "_B", "_M"]);
  });

  // The pass rewrites edges only — an entry block that happens to be a
  // trampoline is neither removed nor displaced from index 0.
  it("should keep a trampoline entry block in place at index 0 (ST-B7)", () => {
    const input = programOf([
      fn("Main.main", [trampoline("_entry", "_M"), block("_M", [storeInstr()], { kind: "ret" })]),
    ]);

    const out = runThreadJumps(input);
    const blocks = out.functions[0].blocks;

    expect(blocks).toHaveLength(2);
    expect(blocks[0].label).toBe("_entry");
    expect(labelsOf(blocks)).toEqual(["_entry", "_M"]);
  });

  // A second run over already-threaded output finds nothing left to rewrite.
  it("should be idempotent: a second run yields an equal program (ST-B8)", () => {
    const input = programOf([
      fn("Main.main", [
        block("_entry", [storeInstr()], br("_T1")),
        trampoline("_T1", "_T2"),
        trampoline("_T2", "_M"),
        block("_M", [storeInstr()], { kind: "ret" }),
      ]),
    ]);

    const once = runThreadJumps(input);
    const twice = runThreadJumps(once);

    expect(twice).toEqual(once);
  });

  // The module-initializer stream is threaded exactly like a function body.
  it("should thread trampolines inside initCode (ST-B9)", () => {
    const input = programOf(
      [],
      [
        block("_entry", [storeInstr()], br("_T")),
        trampoline("_T", "_M"),
        block("_M", [storeInstr()], { kind: "ret" }),
      ],
    );

    const out = runThreadJumps(input);

    expect(blockByLabel(out.initCode, "_entry").terminator).toEqual(br("_M"));
    expect(labelsOf(out.initCode)).toEqual(["_entry", "_T", "_M"]);
  });

  // A chain that runs off the end into a label no block defines cannot be
  // resolved, so the rewrite is abandoned and the target is left exactly as
  // it was. Following it instead would copy the broken edge onto every branch
  // that reached the chain — and unreachable-block removal would then delete
  // the trampoline that actually carried the mistake, moving the eventual
  // error report off the block that caused it. Repairing is the translator's
  // job, not this pass's. (Distinct from the direct-dangling case, where the
  // branch's OWN target names no block and resolution returns on the first
  // step; here the branch's target IS a real trampoline and the missing label
  // is only found one hop into the chain.)
  it("should abandon the rewrite when a trampoline chain dead-ends in a missing label (ST-B47)", () => {
    const entry = block("_entry", [storeInstr()], br("_T"));
    const t = trampoline("_T", "_ghost"); // no block defines _ghost
    const input = programOf([fn("Main.main", [entry, t])]);

    expect(() => runThreadJumps(input)).not.toThrow();
    const out = runThreadJumps(input);
    const blocks = out.functions[0].blocks;

    // _entry still branches to _T — NOT rewritten to the missing _ghost.
    expect(blockByLabel(blocks, "_entry").terminator).toEqual(br("_T"));
    // The trampoline is not repaired either: it still branches to _ghost.
    expect(blockByLabel(blocks, "_T")).toEqual(trampoline("_T", "_ghost"));
    // No block is added or removed.
    expect(labelsOf(blocks)).toEqual(["_entry", "_T"]);
  });
});
