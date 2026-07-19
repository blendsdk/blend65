/**
 * Jump threading — branching straight to where control actually ends up.
 *
 * Lowering routinely produces blocks that do nothing but jump somewhere else:
 * a loop's exit edge lands on a block whose only content is a jump to the code
 * after the loop, a short-circuit's arms converge through an empty join. Left
 * alone, each of those costs a real 6502 jump — three bytes and three cycles
 * to arrive somewhere that immediately sends you on again. A hand-coder would
 * simply have branched to the final destination.
 *
 * This pass rewrites every terminator target that names such a block to the
 * end of its chain. It does not remove anything: the now-unreferenced blocks
 * are dropped by the reachability pass that follows, which keeps each pass
 * with a single job and lets either be scheduled on its own.
 *
 * Lives in `@blend65/codegen` (never imported by the frontend/
 * language-server).
 */

import type { DiagnosticBag } from "@blend65/core";
import type { BasicBlock, ILFunction, ILProgram } from "../cfg.js";
import { terminatorTargets } from "../cfg.js";
import type { ILTerminator } from "../instruction.js";
import type { ILPass } from "./pass.js";

/**
 * Whether a block does nothing but jump — an empty instruction list closed by
 * an unconditional branch.
 *
 * "Empty" is exact rather than approximate. The only IL instruction with no
 * runtime effect is `source_span`, and nothing in this package emits one. If a
 * producer for it ever appears, this predicate must treat a provenance-only
 * body as empty *and* deal with the span it is discarding — re-attach it to the
 * destination or drop it deliberately. Quietly under-firing instead would leave
 * the jump in the output with no sign of why.
 */
function isTrampoline(block: BasicBlock): boolean {
  return block.instructions.length === 0 && block.terminator.kind === "br";
}

/**
 * Where a branch to `target` really ends up: follow the chain of trampolines
 * to the first block that does something.
 *
 * Returns `target` unchanged whenever the chain cannot be resolved — because it
 * is cyclic, or because it runs off into a label no block defines.
 *
 * Rings of jump-only blocks are legal programs (`while (true) {}` lowers to a
 * one-block ring) and there is no correct destination to pick, so the rewrite is
 * abandoned rather than resolved to an arbitrary member. Naming "the label where
 * the cycle was detected" would be worse than arbitrary: it reads two ways, and
 * two implementations reading it differently would emit different bytes.
 *
 * A chain that ends at a missing label is abandoned for a different reason.
 * Following it would propagate one broken edge onto every branch that reached
 * it, and then the reachability pass would drop the block that actually carried
 * the mistake — moving the eventual error report off the block that caused it.
 * The malformed function is the translator's to reject; this pass only has to
 * avoid making it harder to describe.
 */
function resolveTarget(target: string, byLabel: ReadonlyMap<string, BasicBlock>): string {
  const visited = new Set<string>([target]);
  let current = target;
  for (;;) {
    const block = byLabel.get(current);
    if (block === undefined || !isTrampoline(block)) {
      return current;
    }
    const next = terminatorTargets(block.terminator)[0];
    if (next === undefined || visited.has(next) || !byLabel.has(next)) {
      return target;
    }
    visited.add(next);
    current = next;
  }
}

/** Rewrite every outgoing edge of a terminator through {@link resolveTarget}. */
function threadTerminator(t: ILTerminator, byLabel: ReadonlyMap<string, BasicBlock>): ILTerminator {
  switch (t.kind) {
    case "br":
      return { ...t, target: resolveTarget(t.target, byLabel) };
    case "brcond":
    case "brcmp":
      return {
        ...t,
        trueTarget: resolveTarget(t.trueTarget, byLabel),
        falseTarget: resolveTarget(t.falseTarget, byLabel),
      };
    case "ret":
    case "unreachable":
      return t;
    default: {
      // Exhaustiveness guard: a new terminator kind without a case here is a
      // compile error naming the kind, never a silently un-threaded edge.
      const _exhaustive: never = t;
      return _exhaustive;
    }
  }
}

/**
 * Thread every terminator in one block list. Block identity, count and order
 * are preserved — only terminator targets change.
 */
function threadBlocks(blocks: readonly BasicBlock[]): BasicBlock[] {
  const byLabel = new Map(blocks.map((block) => [block.label, block]));
  return blocks.map((block) => ({
    ...block,
    terminator: threadTerminator(block.terminator, byLabel),
  }));
}

/** Thread one function's blocks. */
function threadFunction(fn: ILFunction): ILFunction {
  return { ...fn, blocks: threadBlocks(fn.blocks) };
}

/**
 * Retarget branches that land on jump-only blocks to those blocks' own
 * destinations.
 *
 * One run resolves chains of any length, and the pass cannot create new
 * trampolines — it never empties a block's instruction list — so scheduling it
 * once is enough and scheduling it twice changes nothing.
 *
 * @example
 * ```ts
 * optimizeIL(il, [threadJumps, removeUnreachableBlocks], bag);
 * ```
 */
export const threadJumps: ILPass = {
  name: "thread-jumps",
  run(program: ILProgram, _bag: DiagnosticBag): ILProgram {
    return {
      ...program,
      functions: program.functions.map(threadFunction),
      initCode: threadBlocks(program.initCode),
    };
  },
};
