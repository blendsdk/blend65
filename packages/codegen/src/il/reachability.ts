/**
 * The CFG reachability walk — which blocks control can actually arrive at.
 *
 * Two consumers ask this question and would otherwise each answer it: the
 * startup-shim analysis, which needs to know whether any `ret` is reachable
 * from a function's entry, and the optimizer pass that drops blocks nothing can
 * reach. Two hand-rolled walks over the same graph is exactly the kind of pair
 * that drifts — one learns about a new terminator kind and the other does not —
 * so the walk lives here once and both call it.
 *
 * What each consumer decides for itself is the *successor* relation. The
 * default follows every outgoing edge; the shim analysis narrows a branch on a
 * literal condition to the edge it will actually take. That refinement is
 * deliberately not the default: a pass that removes blocks must be conservative
 * about what is live, and the two consumers disagreeing about reachability is
 * far worse than either being imprecise.
 *
 * Lives in `@blend65/codegen` (never imported by the frontend/
 * language-server).
 */

import type { BasicBlock } from "./cfg.js";
import { terminatorTargets } from "./cfg.js";
import type { ILTerminator } from "./instruction.js";

/**
 * The outgoing edges a walk should follow from one terminator.
 *
 * Callers that treat some edge specially supply their own; the default is
 * {@link terminatorTargets}, which follows all of them.
 */
export type SuccessorTargets = (terminator: ILTerminator) => readonly string[];

/**
 * The blocks reachable from `blocks[0]`, **in their original relative order**.
 *
 * Order is part of the contract, not an accident of the traversal: a caller
 * that removes unreachable blocks must not reorder the survivors, because block
 * order is what later stages read adjacency off.
 *
 * The walk is total. An empty block list yields an empty result, and a
 * terminator target naming no block is skipped rather than throwing — such a
 * program is malformed, but reporting that is the translator's job, and
 * crashing here would destroy the diagnostic instead of producing it.
 *
 * @param blocks The function's (or module initializer's) blocks; `blocks[0]` is
 *   the root.
 * @param successors Which edges to follow; defaults to every outgoing edge.
 * @returns The reachable blocks, in input order.
 *
 * @example
 * ```ts
 * // Every block control can arrive at, conservatively:
 * const live = reachableBlocks(fn.blocks);
 *
 * // Narrowing a literal-conditioned branch to its taken edge:
 * const live = reachableBlocks(fn.blocks, takenEdgesOnly);
 * ```
 */
export function reachableBlocks(
  blocks: readonly BasicBlock[],
  successors: SuccessorTargets = terminatorTargets,
): BasicBlock[] {
  const root = blocks[0];
  if (root === undefined) {
    return [];
  }
  const byLabel = new Map(blocks.map((block) => [block.label, block]));

  const seen = new Set<string>([root.label]);
  const work: BasicBlock[] = [root];
  while (work.length > 0) {
    const block = work.pop();
    if (block === undefined) {
      break;
    }
    for (const target of successors(block.terminator)) {
      if (seen.has(target)) {
        continue;
      }
      const targetBlock = byLabel.get(target);
      if (targetBlock === undefined) {
        continue;
      }
      seen.add(target);
      work.push(targetBlock);
    }
  }
  return blocks.filter((block) => seen.has(block.label));
}
