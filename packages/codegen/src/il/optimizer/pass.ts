/**
 * The IL optimizer pass contract.
 *
 * An {@link ILPass} is one transform in the optimizer pipeline: it takes an
 * {@link ILProgram}, may report diagnostics into the {@link DiagnosticBag}, and
 * returns a (possibly new) `ILProgram`. v1 ships **no** passes — the pipeline is
 * an architectural seam so the real passes (constant folding, DCE,
 * strength reduction) slot in later without restructuring the runner.
 *
 * Contracts on future passes (no v1 pass exists to violate them):
 * - **Determinism:** output depends only on the input program.
 * - **Correctness:** observable semantics are preserved; a pass must be total.
 * - **Intrinsic barrier:** CPU-control `intrinsic` instructions must not be
 *   reordered, removed, or merged.
 */

import type { DiagnosticBag } from "@blend65/core";
import type { ILProgram } from "../cfg.js";

/** One transform in the {@link "./optimize-il.js".optimizeIL} pipeline. */
export interface ILPass {
  /** A stable, human-readable name (for `--emit-il` stage labels and logs). */
  readonly name: string;
  /**
   * Transform `program`, optionally reporting diagnostics, and return the result.
   *
   * @param program The IL program to transform.
   * @param bag The diagnostic sink.
   * @returns The transformed program (may be the same reference if unchanged).
   */
  run(program: ILProgram, bag: DiagnosticBag): ILProgram;
}
