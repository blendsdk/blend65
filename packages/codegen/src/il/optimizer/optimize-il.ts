/**
 * The IL optimizer pipeline runner (RD-06 §4.11, R57/R61).
 *
 * `optimizeIL` folds a sequence of {@link ILPass}es over an {@link ILProgram},
 * threading each pass's output into the next. **v1 callers pass `[]`** — the
 * loop body never runs and the original program reference is returned unchanged
 * (identity passthrough, R57), so `printIL(optimizeIL(p, [], bag)) === printIL(p)`.
 *
 * The runner is generic over any `ILPass[]`, so the real optimizers (constant
 * folding, DCE, strength reduction) and tests' identity/tagging passes slot in
 * without restructuring (AR-38). Determinism (R61): the result depends only on
 * `(program, passes)` — there is no hidden ordering, clock, or randomness.
 */

import type { DiagnosticBag } from "@blend65/core";
import type { ILProgram } from "../cfg.js";
import type { ILPass } from "./pass.js";

/**
 * Run the IL optimizer pipeline (§4.11).
 *
 * @param program The IL program to optimize.
 * @param passes The ordered passes to apply; `[]` is an identity passthrough.
 * @param bag The diagnostic sink threaded into every pass.
 * @returns The program after all passes (the same reference when `passes` is empty).
 */
export function optimizeIL(
  program: ILProgram,
  passes: readonly ILPass[],
  bag: DiagnosticBag,
): ILProgram {
  let current = program;
  for (const pass of passes) {
    current = pass.run(current, bag);
  }
  return current;
}
