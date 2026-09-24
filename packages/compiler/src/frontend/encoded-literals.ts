import { projectDiagnostic } from "../project/diagnostics.js";
import { createScalarTypedExpression, SCALAR_TYPES } from "./constants.js";
import { encodeC64Literal } from "./profile.js";
import type { C64CharacterMap, C64Encoding } from "./profile.js";
import type { AggregateRegistry } from "./aggregate-types.js";
import type {
  ArrayType,
  ScalarExpressionContext,
  ScalarExpressionHost,
  ScalarExpressionResult,
  SemanticType,
} from "./semantic-types.js";
import type { Expr } from "./syntax.js";
import type { AnalyzeExpression } from "./aggregates.js";

/** Resolve one source literal to exact selected-profile bytes without a target runtime. */
export function analyzeEncodedLiteral(
  expression: Extract<Expr, { readonly kind: "literal" }>,
  expected: SemanticType | null,
  encoding: C64Encoding,
  map: C64CharacterMap,
  host: ScalarExpressionHost,
  registry: AggregateRegistry,
  resultExpression: Expr = expression,
): ScalarExpressionResult {
  const encoded = encodeC64Literal(expression.items, encoding, map);
  if (encoded.kind === "error") {
    host.diagnose(encoded.diagnostic);
    return { node: null, exact: null };
  }
  if (expression.literalKind === "character") {
    const value = BigInt(encoded.bytes[0]!);
    return {
      node: createScalarTypedExpression(resultExpression, SCALAR_TYPES.byte, value, {
        encodedBytes: encoded.bytes,
      }),
      exact: value,
    };
  }
  if (
    expected?.kind === "array" &&
    expected.element.kind === "scalar" &&
    expected.element.name === "byte" &&
    encoded.bytes.length > expected.length
  ) {
    host.diagnose(
      projectDiagnostic(
        "E10124",
        `Encoded string has ${encoded.bytes.length} bytes but the destination has extent ${expected.length}`,
        resultExpression.span,
      ),
    );
    return { node: null, exact: null };
  }
  const type =
    expected?.kind === "array" &&
    expected.element.kind === "scalar" &&
    expected.element.name === "byte" &&
    expected.length >= encoded.bytes.length
      ? expected
      : registry.fixedArray(SCALAR_TYPES.byte, encoded.bytes.length);
  return {
    node: createScalarTypedExpression(resultExpression, type, null, {
      encodedBytes: encoded.bytes,
      initialized: Object.freeze(
        encoded.bytes.length === 0 ? [] : [{ start: 0, end: encoded.bytes.length }],
      ),
    }),
    exact: null,
  };
}

/** Check a named C64 encoding call whose arguments must remain compile-time literals. */
export function analyzeEncodingCall(
  expression: Extract<Expr, { readonly kind: "call" }>,
  expected: SemanticType | null,
  encoding: C64Encoding,
  host: ScalarExpressionHost,
  registry: AggregateRegistry,
): ScalarExpressionResult {
  if (expression.arguments.length < 1 || expression.arguments.length > 2) {
    host.diagnose(
      projectDiagnostic(
        "E10171",
        `Wrong argument count — '${encoding}()' expects one literal and an optional map key`,
        expression.span,
      ),
    );
    return { node: null, exact: null };
  }
  const literal = expression.arguments[0];
  if (literal?.kind !== "literal") {
    host.diagnose(
      projectDiagnostic(
        "E10125",
        `Encoding '${encoding}' requires a string or character literal`,
        literal?.span ?? expression.span,
      ),
    );
    return { node: null, exact: null };
  }
  let map: C64CharacterMap = "upper_graphics";
  const mapArg = expression.arguments[1];
  if (mapArg !== undefined) {
    if (mapArg.kind !== "literal" || mapArg.literalKind !== "string") {
      host.diagnose(
        projectDiagnostic("E10251", "Character-map key must be a string literal", mapArg.span),
      );
      return { node: null, exact: null };
    }
    const key = mapArg.items.every((item) => item.kind === "scalar")
      ? mapArg.items.map((item) => item.value).join("")
      : "";
    if (key !== "upper_graphics" && key !== "lower_upper") {
      host.diagnose(
        projectDiagnostic(
          "E10125",
          `Character map '${key}' is unavailable for '${encoding}' on the selected C64 profile`,
          mapArg.span,
        ),
      );
      return { node: null, exact: null };
    }
    map = key;
  }
  return analyzeEncodedLiteral(literal, expected, encoding, map, host, registry, expression);
}

/** Identify a byte-sequence source literal, including a named compile-time encoding call. */
function isEncodedStringSyntax(expression: Expr): boolean {
  if (expression.kind === "literal") return expression.literalKind === "string";
  return (
    expression.kind === "call" &&
    expression.callee.kind === "name" &&
    (expression.callee.name === "screen_codes" || expression.callee.name === "petscii") &&
    expression.arguments[0]?.kind === "literal" &&
    expression.arguments[0].literalKind === "string"
  );
}

/** Expand one string-and-fill initializer into the exact array bytes it denotes. */
export function analyzeStringArrayLiteral(
  expression: Extract<Expr, { readonly kind: "array-literal" }>,
  expected: ArrayType,
  context: ScalarExpressionContext,
  host: ScalarExpressionHost,
  analyze: AnalyzeExpression,
): ScalarExpressionResult | null {
  const stringElement = expression.elements.find(isEncodedStringSyntax);
  if (stringElement !== undefined) {
    if (expression.elements.length !== 1 || expression.fill === null) {
      host.diagnose(
        projectDiagnostic(
          "E10116",
          "A string cannot be mixed with value elements or concatenated inside an array literal",
          expression.span,
        ),
      );
      return { node: null, exact: null };
    }
    const string = analyze(stringElement, null, context).node;
    if (string === null) return { node: null, exact: null };
    const bytes = string.encodedBytes;
    if (
      bytes === undefined ||
      expected.element.kind !== "scalar" ||
      expected.element.name !== "byte"
    ) {
      host.diagnose(
        projectDiagnostic("E10080", "String fill requires a byte array", expression.span),
      );
      return { node: null, exact: null };
    }
    if (bytes.length > expected.length) {
      host.diagnose(
        projectDiagnostic(
          "E10124",
          `Encoded string has ${bytes.length} bytes but the destination has extent ${expected.length}`,
          stringElement.span,
        ),
      );
      return { node: null, exact: null };
    }
    const fill = analyze(expression.fill, expected.element, {
      ...context,
      constantContext: true,
    }).node;
    if (fill === null || typeof fill.constant !== "bigint") return { node: null, exact: null };
    const encodedBytes = Object.freeze([
      ...bytes,
      ...new Array<number>(expected.length - bytes.length).fill(Number(fill.constant)),
    ]);
    return {
      node: createScalarTypedExpression(expression, expected, null, {
        elements: Object.freeze([string]),
        fill,
        encodedBytes,
        initialized: Object.freeze(
          expected.length === 0 ? [] : [{ start: 0, end: expected.length }],
        ),
      }),
      exact: null,
    };
  }
  if (expression.fill !== null && isEncodedStringSyntax(expression.fill)) {
    host.diagnose(
      projectDiagnostic(
        "E10115",
        "Array fill must be one element, not a string",
        expression.fill.span,
      ),
    );
    return { node: null, exact: null };
  }
  return null;
}
