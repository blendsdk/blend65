/**
 * The compile-time constant value record (RD-04 §4.7, R94).
 *
 * A {@link ConstValue} pairs a resolved {@link Type} with the literal value the
 * const-evaluator computed for a `const` declaration or other constant
 * expression. The skeleton never *computes* these (const-eval is
 * DEFERRED(RD-04-checker)); the shape exists so the model and the future checker
 * share one representation.
 */

import type { Type } from "./type.js";

/** A resolved compile-time constant: its type plus its evaluated value. */
export interface ConstValue {
  readonly type: Type;
  /** The evaluated value — an integer for numeric/enum types, or a boolean. */
  readonly value: number | boolean;
}
