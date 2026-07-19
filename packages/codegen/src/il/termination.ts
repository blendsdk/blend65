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

/**
 * Whether `fn` can reach a `ret` terminator from its entry block.
 *
 * @param fn The function to analyze (typically the program entry).
 * @returns `true` when some `ret` is reachable — or when the function has no
 *   blocks at all (the conservative direction).
 */
export function functionCanReturn(fn: ILFunction): boolean {
  const entry = fn.blocks[0];
  if (entry === undefined) return true; // nothing to analyze — stay safe
  const byLabel = new Map(fn.blocks.map((b) => [b.label, b]));

  const seen = new Set<string>([entry.label]);
  const work = [entry];
  while (work.length > 0) {
    const block = work.pop();
    if (block === undefined) break;
    const t = block.terminator;
    if (t.kind === "ret") return true;

    // One special case sits on top of the shared edge set: a value-conditional
    // branch on a literal follows only the edge it will actually take. A fused
    // compare-and-branch carries no such literal — its comparison is evaluated
    // at runtime — so both of its edges stay live, which can only
    // over-approximate reachability and therefore errs toward the harmless
    // terminating shim.
    const next =
      t.kind === "brcond" && t.cond.kind === "immediate"
        ? [t.cond.value !== 0 ? t.trueTarget : t.falseTarget]
        : terminatorTargets(t);

    for (const target of next) {
      if (seen.has(target)) continue;
      const targetBlock = byLabel.get(target);
      // Dangling label — skipped so the analysis stays total. Translation
      // rejects these up front, so reaching one here means a malformed
      // function is already being reported elsewhere.
      if (targetBlock === undefined) continue;
      seen.add(target);
      work.push(targetBlock);
    }
  }
  return false;
}
