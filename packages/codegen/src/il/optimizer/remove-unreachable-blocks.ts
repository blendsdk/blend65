/**
 * Unreachable-block removal — dropping code control can never arrive at.
 *
 * Lowering leaves orphans behind: the epilogue of a function that never falls
 * out of its loop, the join block of a branch both of whose arms return, and —
 * once jump threading has retargeted everything that pointed at them — every
 * jump-only block it emptied of callers. Each one is bytes in the binary that
 * nothing can ever execute.
 *
 * Removal is kept separate from threading because it has more than one client:
 * folding a constant condition orphans blocks the same way, and that pass will
 * re-run this one afterwards rather than growing its own copy.
 *
 * The walk here is deliberately conservative — in particular it does **not**
 * narrow a branch on a literal condition to the edge it will take. That
 * refinement belongs to constant folding; doing it here as well would mean two
 * passes with two different opinions about what is live, and the pass that
 * deletes things is the wrong one to be clever.
 *
 * Lives in `@blend65/codegen` (never imported by the frontend/
 * language-server).
 */

import type { DiagnosticBag } from "@blend65/core";
import type { ILFunction, ILProgram } from "../cfg.js";
import { reachableBlocks } from "../reachability.js";
import type { ILPass } from "./pass.js";

/** Keep only the blocks reachable from this function's entry. */
function pruneFunction(fn: ILFunction): ILFunction {
  return { ...fn, blocks: reachableBlocks(fn.blocks) };
}

/**
 * Drop every block no control path can reach, rooted at each function's entry
 * block and at the module initializer's first block.
 *
 * Survivors keep their relative order — later stages read block adjacency off
 * that order, so reordering here would silently change the emitted code.
 *
 * Both roots may legitimately be absent: a function with no blocks is a
 * tolerated shape (an error-tolerant compile produces them), and an empty
 * module initializer is the normal case. The pass is the identity on both.
 *
 * A self-referential jump-only block is reachable and stays — that falls out of
 * asking about reachability rather than being carved out by hand.
 *
 * @example
 * ```ts
 * // Threading first: it is what orphans the blocks this pass then drops.
 * optimizeIL(il, [threadJumps, removeUnreachableBlocks], bag);
 * ```
 */
export const removeUnreachableBlocks: ILPass = {
  name: "remove-unreachable-blocks",
  run(program: ILProgram, _bag: DiagnosticBag): ILProgram {
    return {
      ...program,
      functions: program.functions.map(pruneFunction),
      initCode: reachableBlocks(program.initCode),
    };
  },
};
