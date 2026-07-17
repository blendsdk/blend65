/**
 * In-place char-literal conversion: `'A'` becomes the numeric literal of its
 * encoded byte, at the node it already occupies.
 *
 * A character literal is a byte constant everywhere a byte is expected, so
 * instead of teaching every downstream consumer (const folding, case-label
 * folding, const images, IL lowering) a char arm, the node itself is
 * rewritten into a `NumericLitExpr` the first time typing or const
 * evaluation reaches it. Conversion preserves object identity and the
 * original span, so identity-keyed maps (`typeMap`, `symbolMap`) and
 * span-based diagnostics stay correct, and every later re-walk of the AST
 * sees a plain numeric literal. A second visit is a no-op (the node is no
 * longer a `CharLitExpr`).
 *
 * An unmappable character is a loud diagnostic and NO conversion — the node
 * stays a `CharLitExpr` and poisons through the normal untyped-node path,
 * never baking a wrong byte.
 */

import { decodeLiteral, DiagCode } from "@blend65/core";
import type { CharLitExprNode, DiagnosticBag, ExprNode } from "@blend65/core";
import type { CharEncoder } from "@blend65/core/platform";

/** Formats a code point as `U+XXXX` (four or more uppercase hex digits). */
function formatCodePoint(cp: number): string {
  return `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
}

/**
 * Converts one char literal in place to the numeric literal of its encoded
 * byte. Returns the byte value, or `null` without converting when:
 *
 * - the literal is malformed (empty/multi-character) — the lexer has already
 *   diagnosed it, so this stays silent; or
 * - the character has no representation in `encoder` — diagnosed here,
 *   naming the code point and the encoding.
 *
 * @param expr The char literal to convert (mutated on success).
 * @param encoder The target platform's character encoder.
 * @param bag The diagnostic accumulator.
 * @returns The encoded byte value, or `null` when no conversion happened.
 */
export function convertCharLiteral(
  expr: CharLitExprNode,
  encoder: CharEncoder,
  bag: DiagnosticBag,
): number | null {
  const segments = decodeLiteral(expr.raw);
  if (segments.length !== 1) return null; // lexer-diagnosed malformed literal
  const segment = segments[0];

  let value: number;
  if (segment.kind === "rawByte") {
    value = segment.value; // `'\xNN'`, `'\0'`, `'\\'` — exact bytes, no encoding
  } else {
    const encoded = encoder.encodeCodePoint(segment.cp);
    if (encoded === null) {
      bag.addError(
        DiagCode.UnencodableCharacter,
        expr.span,
        `Character ${formatCodePoint(segment.cp)} is not representable in the ` +
          `${encoder.name} encoding (a raw byte can be written as \\xNN)`,
      );
      return null;
    }
    value = encoded;
  }

  // The in-place rewrite is the one deliberate exception to the no-unsafe-
  // casts rule, verified safe: the AST is never frozen, the literal node
  // interfaces declare `kind`/`value`/`raw` mutable, the parser never
  // structurally shares literal nodes, and nothing downstream reads the
  // rewritten `raw` text. The `span` is untouched — it is already the
  // original literal's span.
  const node = expr as unknown as { kind: string; value: number; raw: string };
  node.kind = "NumericLitExpr";
  node.value = value;
  node.raw = String(value);
  return value;
}

/**
 * Converts every char literal reachable in the const-foldable operand
 * positions of `expr`, in place. Positions outside the constant-expression
 * grammar (calls, indexing, …) are left alone — they cannot fold anyway and
 * are typed (and converted) through the expression-typing walk instead.
 *
 * @param expr The expression whose char literals to convert.
 * @param encoder The target platform's character encoder.
 * @param bag The diagnostic accumulator.
 * @returns `false` when any reachable char literal failed to convert.
 */
export function convertCharLiteralsIn(
  expr: ExprNode,
  encoder: CharEncoder,
  bag: DiagnosticBag,
): boolean {
  switch (expr.kind) {
    case "CharLitExpr":
      return convertCharLiteral(expr, encoder, bag) !== null;
    case "UnaryExpr":
      return convertCharLiteralsIn(expr.operand, encoder, bag);
    case "BinaryExpr": {
      const left = convertCharLiteralsIn(expr.left, encoder, bag);
      const right = convertCharLiteralsIn(expr.right, encoder, bag);
      return left && right;
    }
    case "CastExpr":
      return convertCharLiteralsIn(expr.operand, encoder, bag);
    case "ConditionalExpr": {
      const condition = convertCharLiteralsIn(expr.condition, encoder, bag);
      const whenTrue = convertCharLiteralsIn(expr.whenTrue, encoder, bag);
      const whenFalse = convertCharLiteralsIn(expr.whenFalse, encoder, bag);
      return condition && whenTrue && whenFalse;
    }
    case "IntrinsicCallExpr": {
      let ok = true;
      for (const arg of expr.args) {
        ok = convertCharLiteralsIn(arg, encoder, bag) && ok;
      }
      return ok;
    }
    default:
      return true;
  }
}
