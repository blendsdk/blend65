/**
 * The compile-time constant value record.
 *
 * A {@link ConstValue} pairs a resolved {@link Type} with the literal value the
 * const-evaluator computed for a `const` declaration or other constant
 * expression. Const-eval is not implemented yet, so these values are never
 * computed; the shape exists so the model and the future checker share one
 * representation.
 */

import type { Type } from "./type.js";

/** A resolved compile-time constant: its type plus its evaluated value. */
export interface ConstValue {
  readonly type: Type;
  /**
   * The evaluated value — an integer for numeric/enum types, or a boolean.
   * Aggregate constants carry their data in {@link bytes} instead and set
   * this to 0 (arrays/structs are memory, not scalar values).
   */
  readonly value: number | boolean;
  /**
   * The fully-evaluated memory image of an aggregate constant (array/struct):
   * every element/field folded at its offset, words encoded little-endian.
   * Absent for scalar constants.
   */
  readonly bytes?: Uint8Array;
}
