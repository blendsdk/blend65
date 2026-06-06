/**
 * IL operands — the three value sources every IL instruction reads or writes
 * (RD-06 §4.2, R7–R11).
 *
 * An operand is one of:
 * - **immediate** — a compile-time constant value (R8)
 * - **temp** — a virtual register (`%N`); the unit of TAC dataflow (R9)
 * - **location** — a symbolic memory address from the `AllocationPlan`
 *   (`__frame_*` / `__var_* `/ `__zp_*`) or a function/code label, with an
 *   optional byte `offset` into a struct/array (R10/R11)
 *
 * Addresses stay *symbolic* all the way through the IL (AR-52): concrete numeric
 * placement is resolved later by the ACME emitter (RD-09). Pure data + trivial
 * constructors/guards — no behavior beyond shaping records.
 */

import type { ILType } from "./il-type.js";

/**
 * A value source for an IL instruction (§4.2). A discriminated union keyed on
 * `kind`; every variant carries its erased {@link ILType}.
 */
export type ILOperand =
  | { readonly kind: "immediate"; readonly value: number; readonly type: ILType }
  | { readonly kind: "temp"; readonly id: number; readonly type: ILType }
  | {
      readonly kind: "location";
      readonly symbol: string;
      readonly offset?: number;
      readonly type: ILType;
    };

/**
 * Construct an immediate (compile-time constant) operand (R8).
 *
 * @param value The constant numeric value.
 * @param type The operand's IL type.
 * @returns An `immediate` operand.
 */
export function imm(value: number, type: ILType): ILOperand {
  return { kind: "immediate", value, type };
}

/**
 * Construct a virtual-temp operand `%id` (R9).
 *
 * @param id The temp's index, unique within its function.
 * @param type The operand's IL type.
 * @returns A `temp` operand.
 */
export function temp(id: number, type: ILType): ILOperand {
  return { kind: "temp", id, type };
}

/**
 * Construct a symbolic-location operand (R10/R11).
 *
 * `symbol` references an `AllocationPlan` name or a code label; `offset`, when
 * present, is a byte displacement into an aggregate. The `offset` is only added
 * to the record when defined so two locations without offsets compare equal.
 *
 * @param symbol The symbolic address (plan symbol or code label).
 * @param type The operand's IL type.
 * @param offset Optional byte offset into a struct/array aggregate.
 * @returns A `location` operand.
 */
export function loc(symbol: string, type: ILType, offset?: number): ILOperand {
  // Only attach `offset` when supplied so the bare form has no `offset` key —
  // keeps `toEqual` comparisons and printed output stable (§4.6).
  return offset === undefined
    ? { kind: "location", symbol, type }
    : { kind: "location", symbol, offset, type };
}

/**
 * Type guard: is this operand an immediate? (R7)
 *
 * @param o The operand to classify.
 * @returns `true` and narrows to the `immediate` variant when matched.
 */
export function isImmediate(
  o: ILOperand,
): o is Extract<ILOperand, { kind: "immediate" }> {
  return o.kind === "immediate";
}

/**
 * Type guard: is this operand a virtual temp? (R7)
 *
 * @param o The operand to classify.
 * @returns `true` and narrows to the `temp` variant when matched.
 */
export function isTemp(o: ILOperand): o is Extract<ILOperand, { kind: "temp" }> {
  return o.kind === "temp";
}

/**
 * Type guard: is this operand a symbolic location? (R7)
 *
 * @param o The operand to classify.
 * @returns `true` and narrows to the `location` variant when matched.
 */
export function isLocation(
  o: ILOperand,
): o is Extract<ILOperand, { kind: "location" }> {
  return o.kind === "location";
}
