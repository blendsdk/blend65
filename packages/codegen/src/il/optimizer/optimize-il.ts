/**
 * The IL optimizer pipeline runner.
 *
 * `optimizeIL` folds a sequence of {@link ILPass}es over an {@link ILProgram},
 * threading each pass's output into the next. **v1 callers pass `[]`** — the
 * loop body never runs and the original program reference is returned unchanged
 * (identity passthrough), so `printIL(optimizeIL(p, [], bag)) === printIL(p)`.
 *
 * The runner is generic over any `ILPass[]`, so the real optimizers (constant
 * folding, DCE, strength reduction) and tests' identity/tagging passes slot in
 * without restructuring. It is deterministic: the result depends only on
 * `(program, passes)` — there is no hidden ordering, clock, or randomness.
 */

import type { DiagnosticBag } from "@blend65/core";
import type { ILProgram } from "../cfg.js";
import type { ILPass } from "./pass.js";

/**
 * Run the IL optimizer pipeline.
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
