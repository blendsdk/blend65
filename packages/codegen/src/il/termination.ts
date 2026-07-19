/**
 * The `main`-termination analysis behind automatic startup-shim selection.
 *
 * A program whose `main` can never return wants the non-terminating shim
 * (`JMP _main` — no return frame, no dead restore tail); one that returns
 * needs the terminating shim's `JSR`/restore/`RTS`. Misclassification is
 * asymmetric: wrongly choosing non-terminating makes the final `RTS` pop a
 * wild stack — a crash — while wrongly choosing terminating wastes a few
 * shim bytes. The analysis therefore claims "cannot return" ONLY when no
 * `ret` terminator is reachable from the entry block, and resolves every
 * uncertainty toward "can return".
 *
 * Reachability walks block successors with one constant-awareness rule: a
 * conditional branch whose condition is a literal constant follows only its
 * taken edge. That is exactly what makes the `while (true)` idiom — lowered
 * as a back-edge behind a constant-true branch — analyze as non-returning,
 * while any runtime-valued condition keeps both edges live.
 */

import type { ILFunction } from "./cfg.js";
import { terminatorTargets } from "./cfg.js";
import type { ILTerminator } from "./instruction.js";
import { reachableBlocks } from "./reachability.js";

/**
 * The edges this analysis follows: every outgoing edge, except that a
 * value-conditional branch on a literal follows only the edge it will actually
 * take.
 *
 * That one refinement is what makes the `while (true)` idiom — lowered as a
 * back-edge behind a constant-true branch — analyze as non-returning. A fused
 * compare-and-branch carries no such literal (its comparison is evaluated at
 * runtime), so both of its edges stay live, which can only over-approximate
 * reachability and therefore errs toward the harmless terminating shim.
 *
 * It belongs to this analysis alone. A pass that *removes* blocks must stay
 * conservative about what is live, so it walks the unrefined edge set.
 */
function takenEdges(t: ILTerminator): readonly string[] {
  if (t.kind === "brcond" && t.cond.kind === "immediate") {
    return [t.cond.value !== 0 ? t.trueTarget : t.falseTarget];
  }
  return terminatorTargets(t);
}

/**
 * Whether `fn` can reach a `ret` terminator from its entry block.
 *
 * @param fn The function to analyze (typically the program entry).
 * @returns `true` when some `ret` is reachable — or when the function has no
 *   blocks at all (the conservative direction).
 */
export function functionCanReturn(fn: ILFunction): boolean {
  // Nothing to analyze — stay safe. The walk below would report "no ret
  // reachable" for an empty function, which is the dangerous answer.
  if (fn.blocks[0] === undefined) return true;
  return reachableBlocks(fn.blocks, takenEdges).some((b) => b.terminator.kind === "ret");
}
