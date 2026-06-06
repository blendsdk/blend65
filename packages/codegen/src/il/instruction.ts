/**
 * IL instructions and terminators — the flat three-address-code vocabulary
 * (RD-06 §4.3, R17–R28).
 *
 * Each {@link ILInstruction} is a single TAC operation reading operands and (for
 * most) writing one destination. Instructions live in a {@link
 * "./cfg.js".BasicBlock}; control flow is expressed only by the block's trailing
 * {@link ILTerminator} (no fall-through, no implicit branches). The full set is
 * defined **up front** (D1) even though v1 lowering only emits a subset — the
 * optimizer (RD-06/RD-08) and codegen (RD-07) consume the complete vocabulary.
 *
 * Opcode names are also exported as runtime tuples (mirroring core's
 * `NODE_KINDS`) so the printer and future passes can enumerate them and the
 * string union can never drift from the value set.
 *
 * Pure data — no behavior lives here.
 */

import type { SourceSpan } from "@blend65/core";
import type { ILOperand } from "./operand.js";
import type { ILType } from "./il-type.js";
import type { IntrinsicDescriptor } from "./intrinsic-descriptor.js";

/** Binary arithmetic opcodes (R18). */
export const ARITHMETIC_BINARY_OPS = ["add", "sub", "mul", "div", "mod"] as const;
/** Binary bitwise/shift opcodes (R19). */
export const BITWISE_BINARY_OPS = ["and", "or", "xor", "shl", "shr"] as const;
/** Comparison opcodes — each produces an `IL_BYTE` 0/1 result (R20). */
export const COMPARISON_OPS = ["eq", "ne", "lt", "le", "gt", "ge"] as const;
/** Width-conversion opcodes (R21). */
export const CONVERSION_OPS = ["zext", "sext", "trunc"] as const;

/**
 * Every IL instruction opcode, in a fixed order. Used by the printer and any
 * pass that needs to enumerate the opcode space exhaustively.
 */
export const IL_OPS = [
  ...ARITHMETIC_BINARY_OPS,
  "neg",
  ...BITWISE_BINARY_OPS,
  "not",
  ...COMPARISON_OPS,
  ...CONVERSION_OPS,
  "load",
  "store",
  "load_indexed",
  "store_indexed",
  "load_indirect",
  "store_indirect",
  "copy",
  "const",
  "call",
  "intrinsic",
  "source_span",
] as const;

/** The string-literal union of all IL opcodes. */
export type ILOp = (typeof IL_OPS)[number];

/**
 * A single three-address IL operation (§4.3). A discriminated union keyed on
 * `op`.
 *
 * Operand-position conventions worth noting:
 * - **arithmetic/bitwise/comparison** binary forms carry `dest`, `left`,
 *   `right`, and the operation `type`; the `neg`/`not` unary forms carry `dest`,
 *   `src`, `type`.
 * - **conversion** (`zext`/`sext`/`trunc`) carries `dest`+`src`; the widths are
 *   read from the operands' own `ILType`s.
 * - **`load`/`store`** use neutral `a`/`b` positions to avoid a `dest`/`src`
 *   footgun (the roles swap between load and store). Convention: `load` —
 *   `a` = destination temp, `b` = source location; `store` — `a` = source value,
 *   `b` = destination location. (Naming refinement of §4.3; behavior-neutral.)
 * - **indexed/indirect** memory forms name their `value`/`base`/`index` or
 *   `value`/`ptr`/`offset` operands explicitly.
 * - **`call`/`intrinsic`** have an optional `dest` (absent for void calls).
 * - **`source_span`** carries no value — it threads a {@link SourceSpan} for
 *   diagnostics provenance.
 */
export type ILInstruction =
  // Arithmetic (R18)
  | {
      readonly op: (typeof ARITHMETIC_BINARY_OPS)[number];
      readonly dest: ILOperand;
      readonly left: ILOperand;
      readonly right: ILOperand;
      readonly type: ILType;
    }
  | { readonly op: "neg"; readonly dest: ILOperand; readonly src: ILOperand; readonly type: ILType }
  // Bitwise (R19)
  | {
      readonly op: (typeof BITWISE_BINARY_OPS)[number];
      readonly dest: ILOperand;
      readonly left: ILOperand;
      readonly right: ILOperand;
      readonly type: ILType;
    }
  | { readonly op: "not"; readonly dest: ILOperand; readonly src: ILOperand; readonly type: ILType }
  // Comparison — result is IL_BYTE (R20)
  | {
      readonly op: (typeof COMPARISON_OPS)[number];
      readonly dest: ILOperand;
      readonly left: ILOperand;
      readonly right: ILOperand;
      readonly type: ILType;
    }
  // Conversion (R21)
  | { readonly op: (typeof CONVERSION_OPS)[number]; readonly dest: ILOperand; readonly src: ILOperand }
  // Memory — direct (R22–R24); neutral a/b positions (see doc above)
  | { readonly op: "load" | "store"; readonly a: ILOperand; readonly b: ILOperand }
  // Memory — indexed (R23)
  | {
      readonly op: "load_indexed" | "store_indexed";
      readonly value: ILOperand;
      readonly base: ILOperand;
      readonly index: ILOperand;
    }
  // Memory — indirect (R24)
  | {
      readonly op: "load_indirect" | "store_indirect";
      readonly value: ILOperand;
      readonly ptr: ILOperand;
      readonly offset: ILOperand;
    }
  // Copy / const (R27/R28)
  | { readonly op: "copy" | "const"; readonly dest: ILOperand; readonly src: ILOperand }
  // Call (R25)
  | {
      readonly op: "call";
      readonly dest?: ILOperand;
      readonly target: string;
      readonly args: readonly ILOperand[];
    }
  // Intrinsic call (R26) — descriptor is the RD-17 placeholder
  | {
      readonly op: "intrinsic";
      readonly dest?: ILOperand;
      readonly name: string;
      readonly args: readonly ILOperand[];
      readonly descriptor: IntrinsicDescriptor;
    }
  // Debug span — diagnostics provenance carried inline (AR-54 analog)
  | { readonly op: "source_span"; readonly span: SourceSpan };

/**
 * The trailing control-flow operation of a {@link "./cfg.js".BasicBlock} (§4.3).
 * Exactly one terminates every block — there is no fall-through.
 *
 * - **`br`** — unconditional branch to `target` (R13)
 * - **`brcond`** — branch to `trueTarget` when `cond` is non-zero, else
 *   `falseTarget`
 * - **`ret`** — return, optionally yielding `value`
 * - **`unreachable`** — a block that can never be reached (e.g. after a
 *   diverging call); a defined terminator, never undefined behavior (H5)
 */
export type ILTerminator =
  | { readonly kind: "br"; readonly target: string }
  | {
      readonly kind: "brcond";
      readonly cond: ILOperand;
      readonly trueTarget: string;
      readonly falseTarget: string;
    }
  | { readonly kind: "ret"; readonly value?: ILOperand }
  | { readonly kind: "unreachable" };
