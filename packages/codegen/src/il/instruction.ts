/**
 * IL instructions and terminators — the flat three-address-code vocabulary.
 *
 * Each {@link ILInstruction} is a single TAC operation reading operands and (for
 * most) writing one destination. Instructions live in a {@link
 * "./cfg.js".BasicBlock}; control flow is expressed only by the block's trailing
 * {@link ILTerminator} (no fall-through, no implicit branches). The full set is
 * defined **up front** even though v1 lowering only emits a subset — the
 * optimizer and codegen consume the complete vocabulary.
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

/** Binary arithmetic opcodes. */
export const ARITHMETIC_BINARY_OPS = ["add", "sub", "mul", "div", "mod"] as const;
/** Binary bitwise/shift opcodes. */
export const BITWISE_BINARY_OPS = ["and", "or", "xor", "shl", "shr"] as const;
/**
 * Comparison opcodes — each produces an `IL_BYTE` 0/1 result, while the
 * instruction's `type` field carries the (promoted) OPERAND type so the
 * translator can pick the byte/word × unsigned/signed comparison framing.
 */
export const COMPARISON_OPS = ["eq", "ne", "lt", "le", "gt", "ge"] as const;
/** Width-conversion opcodes. */
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
 * A single three-address IL operation. A discriminated union keyed on
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
 *   `b` = destination location. (A deliberate naming choice; behavior-neutral.)
 * - **indexed/indirect** memory forms name their `value`/`base`/`index` or
 *   `value`/`ptr`/`offset` operands explicitly.
 * - **`call`/`intrinsic`** have an optional `dest` (absent for void calls).
 * - **`source_span`** carries no value — it threads a {@link SourceSpan} for
 *   diagnostics provenance.
 */
export type ILInstruction =
  // Arithmetic
  | {
      readonly op: (typeof ARITHMETIC_BINARY_OPS)[number];
      readonly dest: ILOperand;
      readonly left: ILOperand;
      readonly right: ILOperand;
      readonly type: ILType;
    }
  | { readonly op: "neg"; readonly dest: ILOperand; readonly src: ILOperand; readonly type: ILType }
  // Bitwise
  | {
      readonly op: (typeof BITWISE_BINARY_OPS)[number];
      readonly dest: ILOperand;
      readonly left: ILOperand;
      readonly right: ILOperand;
      readonly type: ILType;
    }
  | { readonly op: "not"; readonly dest: ILOperand; readonly src: ILOperand; readonly type: ILType }
  // Comparison — the dest temp is an IL_BYTE 0/1 flag; `type` is the OPERAND type
  | {
      readonly op: (typeof COMPARISON_OPS)[number];
      readonly dest: ILOperand;
      readonly left: ILOperand;
      readonly right: ILOperand;
      readonly type: ILType;
    }
  // Conversion
  | { readonly op: (typeof CONVERSION_OPS)[number]; readonly dest: ILOperand; readonly src: ILOperand }
  // Memory — direct; neutral a/b positions (see doc above)
  | { readonly op: "load" | "store"; readonly a: ILOperand; readonly b: ILOperand }
  // Memory — indexed
  | {
      readonly op: "load_indexed" | "store_indexed";
      readonly value: ILOperand;
      readonly base: ILOperand;
      readonly index: ILOperand;
    }
  // Memory — indirect
  | {
      readonly op: "load_indirect" | "store_indirect";
      readonly value: ILOperand;
      readonly ptr: ILOperand;
      readonly offset: ILOperand;
    }
  // Copy / const
  | { readonly op: "copy" | "const"; readonly dest: ILOperand; readonly src: ILOperand }
  // Call
  | {
      readonly op: "call";
      readonly dest?: ILOperand;
      readonly target: string;
      readonly args: readonly ILOperand[];
    }
  // Intrinsic call — descriptor is the intrinsic-taxonomy placeholder
  | {
      readonly op: "intrinsic";
      readonly dest?: ILOperand;
      readonly name: string;
      readonly args: readonly ILOperand[];
      readonly descriptor: IntrinsicDescriptor;
    }
  // Debug span — diagnostics provenance carried inline
  | { readonly op: "source_span"; readonly span: SourceSpan };

/**
 * The trailing control-flow operation of a {@link "./cfg.js".BasicBlock}.
 * Exactly one terminates every block — there is no fall-through.
 *
 * - **`br`** — unconditional branch to `target`
 * - **`brcond`** — branch to `trueTarget` when `cond` is non-zero, else
 *   `falseTarget`
 * - **`brcmp`** — compare two operands and branch on the result directly
 * - **`ret`** — return, optionally yielding `value`
 * - **`unreachable`** — a block that can never be reached (e.g. after a
 *   diverging call); a defined terminator, never undefined behavior
 */
export type ILTerminator =
  | { readonly kind: "br"; readonly target: string }
  | {
      readonly kind: "brcond";
      readonly cond: ILOperand;
      readonly trueTarget: string;
      readonly falseTarget: string;
    }
  // Fused compare-and-branch — branches to `trueTarget` when
  // `left <op> right` holds, else to `falseTarget`. The comparison's flags
  // feed the branch directly: no 0/1 result is produced anywhere, so no temp,
  // no frame slot, and no reload stand between the compare and the branch.
  // `type` is the promoted OPERAND type (as on the comparison instruction) —
  // it selects the width/signedness framing the translator emits.
  // `brcond` remains the terminator for branching on a boolean *value*.
  | {
      readonly kind: "brcmp";
      readonly op: (typeof COMPARISON_OPS)[number];
      readonly left: ILOperand;
      readonly right: ILOperand;
      readonly type: ILType;
      readonly trueTarget: string;
      readonly falseTarget: string;
    }
  | { readonly kind: "ret"; readonly value?: ILOperand }
  | { readonly kind: "unreachable" };
