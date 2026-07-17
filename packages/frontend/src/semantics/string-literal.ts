/**
 * Declaration-site string-literal desugar: `= "S"` and `= ["S"; fill]`
 * become the array literal of the string's encoded bytes, in place, before
 * any consumer looks at the initialiser's shape.
 *
 * The synthetic element nodes are plain numeric literals carrying the
 * original string literal's span, so the shipped array-initialiser
 * machinery — coverage advisories, size inference, const images, initCode
 * lowering, per-element frame stores — works on them untouched, and every
 * diagnostic that mentions an element points at the string it came from.
 *
 * The desugar owns three diagnostics: an oversized string (checked against
 * the declared size BEFORE splicing, naming both counts), mixed
 * string/value element lists (a string initialises an array either bare or
 * as the single bracketed element), and a string used as a fill value. An
 * unmappable character is the encoder's diagnostic, emitted per literal. A
 * string literal outside these declaration positions is the expression
 * layer's invalid-operand case, not handled here.
 */

import { decodeLiteral, DiagCode } from "@blend65/core";
import type {
  ArrayLitExprNode,
  DiagnosticBag,
  ExprNode,
  NumericLitExprNode,
  SourceSpan,
  StringLitExprNode,
  Type,
} from "@blend65/core";
import type { CharEncoder } from "@blend65/core/platform";

/** A declaration whose initialiser the desugar may rewrite. */
export interface StringInitDecl {
  initialiser: ExprNode | null;
}

/** Formats a code point as `U+XXXX` (four or more uppercase hex digits). */
function formatCodePoint(cp: number): string {
  return `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
}

/**
 * Encodes a string literal to its byte values, or `null` after diagnosing
 * the first unmappable character. Raw-byte escapes (`\xNN`, `\0`, `\\`)
 * bypass the encoder.
 */
function encodeStringLiteral(
  lit: StringLitExprNode,
  encoder: CharEncoder,
  bag: DiagnosticBag,
): number[] | null {
  const bytes: number[] = [];
  for (const segment of decodeLiteral(lit.raw)) {
    if (segment.kind === "rawByte") {
      bytes.push(segment.value);
      continue;
    }
    const encoded = encoder.encodeCodePoint(segment.cp);
    if (encoded === null) {
      bag.addError(
        DiagCode.UnencodableCharacter,
        lit.span,
        `Character ${formatCodePoint(segment.cp)} is not representable in the ` +
          `${encoder.name} encoding (a raw byte can be written as \\xNN)`,
      );
      return null;
    }
    bytes.push(encoded);
  }
  return bytes;
}

/** Synthetic numeric-literal elements, all carrying the string's span. */
function syntheticElements(bytes: readonly number[], span: SourceSpan): ExprNode[] {
  return bytes.map((value): NumericLitExprNode => ({
    kind: "NumericLitExpr",
    value,
    raw: String(value),
    span,
  }));
}

/**
 * Emits the oversized-string rejection when the encoded byte count exceeds
 * a declared size. Returns `true` when rejected.
 */
function rejectOversized(
  byteCount: number,
  declaredSize: number | null,
  span: SourceSpan,
  bag: DiagnosticBag,
): boolean {
  if (declaredSize === null || byteCount <= declaredSize) return false;
  bag.addError(
    DiagCode.StringExceedsArraySize,
    span,
    `String literal (${byteCount} bytes) exceeds array size (${declaredSize})`,
  );
  return true;
}

/**
 * Desugars a string-bearing array initialiser in place. Call before any
 * shape-sensitive check (coverage advisories, size inference) at every
 * declaration position that accepts an array initialiser.
 *
 * @param decl The declaration whose initialiser to inspect (rewritten in
 *   place when it is a legal string form).
 * @param declaredType The declaration's resolved type; non-array types are
 *   left alone (a string there falls through to expression typing).
 * @param encoder The target platform's character encoder.
 * @param bag The diagnostic accumulator.
 * @returns `true` when the declaration is poisoned (diagnostic emitted) —
 *   the caller stops checking it; `false` to continue (desugared or not).
 */
export function desugarStringInit(
  decl: StringInitDecl,
  declaredType: Type,
  encoder: CharEncoder,
  bag: DiagnosticBag,
): boolean {
  const init = decl.initialiser;
  if (init === null || declaredType.kind !== "array") return false;

  // Bare form: `= "S"` — encode, size-check, splice the element list.
  if (init.kind === "StringLitExpr") {
    const bytes = encodeStringLiteral(init, encoder, bag);
    if (bytes === null) return true;
    if (rejectOversized(bytes.length, declaredType.size, init.span, bag)) return true;
    const spliced: ArrayLitExprNode = {
      kind: "ArrayLitExpr",
      elements: syntheticElements(bytes, init.span),
      fill: null,
      span: init.span,
    };
    decl.initialiser = spliced;
    return false;
  }

  if (init.kind !== "ArrayLitExpr") return false;

  // A string can never be the fill value — the fill is a single element.
  if (init.fill !== null && init.fill.kind === "StringLitExpr") {
    bag.addError(
      DiagCode.MixedStringValueInit,
      init.fill.span,
      "Cannot use a string literal as a fill value in an array initializer",
    );
    return true;
  }

  const stringElements = init.elements.filter((e) => e.kind === "StringLitExpr");
  if (stringElements.length === 0) return false;

  // Bracketed form: legal ONLY as `["S"]` / `["S"; fill]` — exactly one
  // element, which is the string. Anything else mixes layouts.
  if (init.elements.length !== 1) {
    bag.addError(
      DiagCode.MixedStringValueInit,
      init.span,
      "Cannot mix string literals with value elements in array initializer",
    );
    return true;
  }

  const lit = init.elements[0] as StringLitExprNode;
  const bytes = encodeStringLiteral(lit, encoder, bag);
  if (bytes === null) return true;
  // The fill may complete the remainder, but the expanded elements alone
  // must fit the declared size.
  if (rejectOversized(bytes.length, declaredType.size, lit.span, bag)) return true;
  init.elements = syntheticElements(bytes, lit.span);
  return false;
}
