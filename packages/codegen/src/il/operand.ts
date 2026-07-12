/**
 * IL operands — the three value sources every IL instruction reads or writes.
 *
 * An operand is one of:
 * - **immediate** — a compile-time constant value
 * - **temp** — a virtual register (`%N`); the unit of TAC dataflow
 * - **location** — a symbolic memory address from the `AllocationPlan`
 *   (`__frame_*` / `__var_* `/ `__zp_*`) or a function/code label, with an
 *   optional byte `offset` into a struct/array
 *
 * Addresses stay *symbolic* all the way through the IL: concrete numeric
 * placement is resolved later by the ACME emitter. Pure data + trivial
 * constructors/guards — no behavior beyond shaping records.
 */

import type { ILType } from "./il-type.js";
import { IL_WORD } from "./il-type.js";

/**
 * A value source for an IL instruction. A discriminated union keyed on
 * `kind`; every variant carries its erased {@link ILType}.
 *
 * The `addr` variant is the ADDRESS of a symbol (+optional byte offset) as a
 * 16-bit value — a link-time constant the assembler resolves (`#<sym`/`#>sym`
 * byte selects). It is legal in exactly two positions: a `store` source
 * (by-reference argument marshalling) and an ALU right operand (runtime
 * pointer formation adds a base address to a scaled index). Every other
 * consumer rejects it loudly — never a silent misread.
 */
export type ILOperand =
  | { readonly kind: "immediate"; readonly value: number; readonly type: ILType }
  | { readonly kind: "temp"; readonly id: number; readonly type: ILType }
  | {
      readonly kind: "location";
      readonly symbol: string;
      readonly offset?: number;
      readonly type: ILType;
    }
  | {
      readonly kind: "addr";
      readonly symbol: string;
      readonly offset?: number;
      readonly type: ILType;
    };

/**
 * Construct an immediate (compile-time constant) operand.
 *
 * @param value The constant numeric value.
 * @param type The operand's IL type.
 * @returns An `immediate` operand.
 */
export function imm(value: number, type: ILType): ILOperand {
  return { kind: "immediate", value, type };
}

/**
 * Construct a virtual-temp operand `%id`.
 *
 * @param id The temp's index, unique within its function.
 * @param type The operand's IL type.
 * @returns A `temp` operand.
 */
export function temp(id: number, type: ILType): ILOperand {
  return { kind: "temp", id, type };
}

/**
 * Construct a symbolic-location operand.
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
  // keeps `toEqual` comparisons and printed output stable.
  return offset === undefined
    ? { kind: "location", symbol, type }
    : { kind: "location", symbol, offset, type };
}

/**
 * Construct an address-of operand `&symbol+offset` (always word-typed — an
 * address is 16 bits by definition).
 *
 * @param symbol The symbolic address (plan symbol or data label).
 * @param offset Optional byte offset folded into the address.
 * @returns An `addr` operand.
 */
export function addrOf(symbol: string, offset?: number): ILOperand {
  return offset === undefined || offset === 0
    ? { kind: "addr", symbol, type: IL_WORD }
    : { kind: "addr", symbol, offset, type: IL_WORD };
}

/**
 * Type guard: is this operand an address-of?
 *
 * @param o The operand to classify.
 * @returns `true` and narrows to the `addr` variant when matched.
 */
export function isAddr(o: ILOperand): o is Extract<ILOperand, { kind: "addr" }> {
  return o.kind === "addr";
}

/**
 * Type guard: is this operand an immediate?
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
 * Type guard: is this operand a virtual temp?
 *
 * @param o The operand to classify.
 * @returns `true` and narrows to the `temp` variant when matched.
 */
export function isTemp(o: ILOperand): o is Extract<ILOperand, { kind: "temp" }> {
  return o.kind === "temp";
}

/**
 * Type guard: is this operand a symbolic location?
 *
 * @param o The operand to classify.
 * @returns `true` and narrows to the `location` variant when matched.
 */
export function isLocation(
  o: ILOperand,
): o is Extract<ILOperand, { kind: "location" }> {
  return o.kind === "location";
}
