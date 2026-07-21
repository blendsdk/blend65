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
import { IL_BYTE, IL_WORD } from "./il-type.js";

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
 *
 * The `addrByte` variant is ONE BYTE of such an address, already selected —
 * an 8-bit link-time constant, and so an ordinary byte value legal wherever a
 * byte immediate is. `shift`, when present, divides the address by `2^shift`
 * before the byte is taken, which is how a sprite block number (`address / 64`)
 * reaches the assembler as arithmetic it folds for free rather than as a
 * runtime division of a constant. It is a separate variant from `addr` rather
 * than a flag on it precisely because the two have different widths and
 * different legal positions: a consumer that quietly treated one as the other
 * would marshal two bytes into a one-byte slot, and would assemble cleanly.
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
    }
  | {
      readonly kind: "addrByte";
      readonly symbol: string;
      readonly select: "low" | "high";
      readonly shift?: number;
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
 * Construct a selected byte of a symbol's address (always byte-typed — one
 * byte is 8 bits by definition, mirroring how {@link addrOf} hardcodes a word).
 *
 * With `shift` the value is `(address / 2^shift)`'s selected byte, which the
 * assembler folds at link time. There is deliberately no offset parameter: an
 * addend inside the division would need its own parentheses to mean what it
 * reads like, and an unparenthesized one assembles silently to the wrong byte.
 *
 * @param symbol The symbolic address (plan symbol or data label).
 * @param select Which byte of the (optionally shifted) address to take.
 * @param shift Optional right shift, 1..15; absent is a plain byte select.
 * @returns An `addrByte` operand.
 * @example
 * // The sprite's 64-byte block number, resolved by the assembler:
 * addrByteOf("__data_Main_BALLOON", "low", 6);
 */
export function addrByteOf(symbol: string, select: "low" | "high", shift?: number): ILOperand {
  // Match `loc`/`addrOf`: omit the optional key entirely when unused, so the
  // bare form stays comparable by value and prints without it.
  return shift === undefined
    ? { kind: "addrByte", symbol, select, type: IL_BYTE }
    : { kind: "addrByte", symbol, select, shift, type: IL_BYTE };
}

/**
 * Type guard: is this operand a selected byte of an address?
 *
 * @param o The operand to classify.
 * @returns `true` and narrows to the `addrByte` variant when matched.
 */
export function isAddrByte(o: ILOperand): o is Extract<ILOperand, { kind: "addrByte" }> {
  return o.kind === "addrByte";
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
