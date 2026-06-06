/**
 * IL types — the width/signedness lattice the IL operates over (RD-06 §4.1,
 * R3/R5/R6).
 *
 * Blend65's rich semantic `Type` (RD-04) is erased at the IL boundary to one of
 * exactly four machine-meaningful shapes: an 8- or 16-bit value that is either
 * signed or unsigned. boolean collapses to `IL_BYTE` (values 0/1), enum identity
 * collapses to `IL_BYTE`, and struct/array values are passed *by reference* as a
 * 16-bit base address (`IL_WORD`). This erasure is what lets the optimizer and
 * 6502 codegen reason about machine widths without re-deriving the source types.
 *
 * Pure data + pure functions — part of `@blend65/codegen`'s back-end IL model
 * (R15/AR-20: the frontend/language-server never import this).
 */

import type { Type } from "@blend65/core";

/**
 * The IL's erased value type: a machine width plus a signedness flag (§4.1).
 *
 * There is no distinct boolean or enum IL type — both erase to {@link IL_BYTE}.
 */
export interface ILType {
  /** Machine width in bits: 8 (byte-sized) or 16 (word-sized). */
  readonly width: 8 | 16;
  /** Whether the value is interpreted as signed two's-complement. */
  readonly signed: boolean;
}

/** Unsigned 8-bit — maps `byte`, `boolean`, and every `enum` (§4.1). */
export const IL_BYTE: ILType = { width: 8, signed: false };
/** Signed 8-bit — maps `sbyte` (§4.1). */
export const IL_SBYTE: ILType = { width: 8, signed: true };
/** Unsigned 16-bit — maps `word` and struct/array by-ref pointers (§4.1). */
export const IL_WORD: ILType = { width: 16, signed: false };
/** Signed 16-bit — maps `sword` (§4.1). */
export const IL_SWORD: ILType = { width: 16, signed: true };

/**
 * Structural equality on two {@link ILType}s.
 *
 * The four canonical constants above are shared instances, but a caller may also
 * hand-build an `ILType` object literal (tests do), so equality is compared by
 * value (`width` + `signed`), never by reference.
 *
 * @param a First IL type.
 * @param b Second IL type.
 * @returns `true` when both width and signedness match.
 */
export function ilTypeEquals(a: ILType, b: ILType): boolean {
  return a.width === b.width && a.signed === b.signed;
}

/**
 * Map a resolved Blend65 semantic {@link Type} (RD-04) to its erased IL type
 * (R3, §4.1 mapping table).
 *
 * Mapping:
 * - `byte`/`boolean` → {@link IL_BYTE}; `sbyte` → {@link IL_SBYTE}
 * - `word` → {@link IL_WORD}; `sword` → {@link IL_SWORD}
 * - `enum` → {@link IL_BYTE} (identity erased, R6)
 * - `struct`/`array` → {@link IL_WORD} (passed by-ref as a 16-bit base address)
 *
 * `ErrorType` and the `void` primitive are not value types that reach lowering
 * (functions carrying `ErrorType` are skipped before lowering, R68; `void` is a
 * return-type marker, not an operand type). They return {@link IL_BYTE} as a
 * documented, safe-but-unreached default — never `undefined` (H5: no undefined
 * behavior).
 *
 * @param t The resolved semantic type.
 * @returns The corresponding IL type.
 */
export function ilTypeOfType(t: Type): ILType {
  switch (t.kind) {
    case "primitive":
      switch (t.name) {
        case "byte":
        case "boolean":
          return IL_BYTE;
        case "sbyte":
          return IL_SBYTE;
        case "word":
          return IL_WORD;
        case "sword":
          return IL_SWORD;
        // `void` is a return-type marker, never an operand value type. Safe
        // default keeps the function total (H5); lowering never asks for it.
        case "void":
          return IL_BYTE;
      }
      // Unreachable: `name` is exhaustively handled above. Kept total for H5.
      return IL_BYTE;
    // enum identity is erased to a raw byte backing value (R6).
    case "enum":
      return IL_BYTE;
    // struct/array values travel by reference as a 16-bit base address.
    case "struct":
    case "array":
      return IL_WORD;
    // ErrorType functions are skipped before lowering (R68); documented default.
    case "error":
      return IL_BYTE;
  }
}
