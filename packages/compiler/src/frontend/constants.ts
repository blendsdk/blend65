import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type {
  ConversionKind,
  FunctionSignature,
  IntegerFacts,
  ScalarExpressionContext,
  ScalarExpressionHost,
  ScalarExpressionResult,
  ScalarType,
  ScalarTypeName,
  SemanticType,
  TypedExpr,
} from "./semantic-types.js";
import type { Declaration, Expr, FunctionDeclaration, TypeSyntax } from "./syntax.js";

/** Immutable canonical scalar records shared by semantic facts. */
export const SCALAR_TYPES: Readonly<Record<ScalarTypeName, ScalarType>> = Object.freeze({
  byte: Object.freeze({ kind: "scalar", name: "byte" }),
  sbyte: Object.freeze({ kind: "scalar", name: "sbyte" }),
  word: Object.freeze({ kind: "scalar", name: "word" }),
  sword: Object.freeze({ kind: "scalar", name: "sword" }),
  boolean: Object.freeze({ kind: "scalar", name: "boolean" }),
  void: Object.freeze({ kind: "scalar", name: "void" }),
});

/** Names whose source meaning is fixed instead of introduced by declarations. */
export const RESERVED_BUILTIN_NAMES: ReadonlySet<string> = new Set([
  "peek",
  "peekw",
  "poke",
  "pokew",
  "lo",
  "hi",
  "sizeof",
  "offsetof",
  "length",
  "embed",
  "petscii",
  "screen_codes",
  "atascii",
  "internal_codes",
]);

/** Freeze the semantic fields shared by every scalar typed-expression node. */
export function createScalarTypedExpression(
  expression: Expr,
  type: SemanticType,
  constant: bigint | boolean | null,
  extras: Partial<TypedExpr> = {},
): TypedExpr {
  return Object.freeze({
    kind: expression.kind,
    span: Object.freeze({ ...expression.span }),
    type,
    constant,
    binding: null,
    place: null,
    conversion: null,
    integer: integerFacts(type, false),
    ...extras,
  });
}

/** Build an immutable scalar warning with the shared diagnostic fields. */
export function scalarWarning(code: string, message: string, span: SourceSpan): ProjectDiagnostic {
  return Object.freeze({ ...projectDiagnostic(code, message, span), severity: "warning" });
}

/** Resolve an exact primitive spelling without a type assertion. */
export function scalarType(name: string): ScalarType | null {
  switch (name) {
    case "byte":
    case "sbyte":
    case "word":
    case "sword":
    case "boolean":
    case "void":
      return SCALAR_TYPES[name];
    default:
      return null;
  }
}

/** Resolve an admitted named scalar syntax node. */
export function scalarSyntaxType(type: TypeSyntax | null): ScalarType | null {
  return type?.kind === "named-type" ? scalarType(type.name) : null;
}

/** Determine the scalar type attached to a module binding. */
export function scalarDeclarationType(declaration: Declaration): ScalarType | null {
  if (declaration.kind === "variable") return scalarSyntaxType(declaration.type);
  if (declaration.kind === "function") return scalarSyntaxType(declaration.returnType);
  return null;
}

/** Resolve an ordinary scalar function signature before body checking. */
export function scalarFunctionSignature(
  declaration: FunctionDeclaration,
): FunctionSignature | null {
  const returnType = scalarSyntaxType(declaration.returnType);
  if (returnType === null) return null;
  const parameters: FunctionSignature["parameters"][number][] = [];
  for (const parameter of declaration.parameters) {
    const type = scalarSyntaxType(parameter.type);
    if (type === null) return null;
    parameters.push(Object.freeze({ type, readonly: parameter.readonly }));
  }
  return Object.freeze({ parameters: Object.freeze(parameters), returnType });
}

/** Inclusive integer range for one scalar integer type. */
export interface IntegerRange {
  /** Smallest representable value. */
  readonly minimum: bigint;
  /** Largest representable value. */
  readonly maximum: bigint;
}

/** Result of an explicit fixed-width integer conversion. */
export interface IntegerConversion {
  /** Converted mathematical interpretation. */
  readonly value: bigint;
  /** Conversion retained for lowering. */
  readonly conversion: ConversionKind;
  /** Whether the conversion changed the mathematical value. */
  readonly losesValue: boolean;
}

/** Narrow a semantic type to a primitive scalar. */
export function isScalarType(type: SemanticType): type is ScalarType {
  return type.kind === "scalar";
}

/** Return whether a semantic type is one of the four integers. */
export function isIntegerType(type: SemanticType): type is ScalarType {
  return (
    type.kind === "scalar" &&
    (type.name === "byte" || type.name === "sbyte" || type.name === "word" || type.name === "sword")
  );
}

/** Return fixed-width facts for an integer type, or null for Boolean and void. */
export function integerFacts(type: SemanticType, wrap: boolean): IntegerFacts | null {
  if (!isIntegerType(type)) return null;
  return Object.freeze({
    width: type.name === "byte" || type.name === "sbyte" ? 8 : 16,
    signed: type.name === "sbyte" || type.name === "sword",
    wrap,
  });
}

/** Return the exact inclusive range for a scalar integer type. */
export function integerRange(type: SemanticType): IntegerRange | null {
  if (!isScalarType(type)) return null;
  switch (type.name) {
    case "byte":
      return Object.freeze({ minimum: 0n, maximum: 255n });
    case "sbyte":
      return Object.freeze({ minimum: -128n, maximum: 127n });
    case "word":
      return Object.freeze({ minimum: 0n, maximum: 65535n });
    case "sword":
      return Object.freeze({ minimum: -32768n, maximum: 32767n });
    default:
      return null;
  }
}

/** Render the canonical out-of-range message for an integer declaration context. */
export function integerRangeMessage(type: SemanticType, value: bigint): string {
  const range = integerRange(type);
  return range === null || !isScalarType(type)
    ? `Value ${value} is outside every scalar integer range`
    : `Value ${value} is out of range for type '${type.name}' (${range.minimum}–${range.maximum})`;
}

/** Test whether a mathematical integer fits one scalar type without conversion. */
export function fitsInteger(type: SemanticType, value: bigint): boolean {
  const range = integerRange(type);
  return range !== null && value >= range.minimum && value <= range.maximum;
}

/** Select the language's default type for a representable integer literal. */
export function defaultIntegerType(value: bigint): ScalarType | null {
  if (value >= 0n && value <= 255n) return SCALAR_TYPES.byte;
  if (value >= 256n && value <= 65535n) return SCALAR_TYPES.word;
  if (value >= -128n && value < 0n) return SCALAR_TYPES.sbyte;
  if (value >= -32768n && value < -128n) return SCALAR_TYPES.sword;
  return null;
}

/** Wrap one mathematical value to the exact bit interpretation of a scalar integer. */
export function wrapInteger(value: bigint, type: SemanticType): bigint {
  const facts = integerFacts(type, true);
  if (facts === null) return value;
  const modulus = 1n << BigInt(facts.width);
  const bits = ((value % modulus) + modulus) % modulus;
  return facts.signed && bits >= modulus / 2n ? bits - modulus : bits;
}

/** Convert between integer widths and signed interpretations using exact bits. */
export function convertInteger(
  value: bigint,
  from: SemanticType,
  to: SemanticType,
): IntegerConversion {
  const fromFacts = integerFacts(from, false);
  const toFacts = integerFacts(to, false);
  if (fromFacts === null || toFacts === null) {
    return Object.freeze({ value, conversion: "identity", losesValue: false });
  }
  let conversion: ConversionKind;
  if (fromFacts.width === toFacts.width) {
    conversion = fromFacts.signed === toFacts.signed ? "identity" : "reinterpret";
  } else if (fromFacts.width < toFacts.width) {
    conversion = fromFacts.signed ? "sign-extend" : "zero-extend";
  } else {
    conversion = "truncate";
  }
  const converted = wrapInteger(value, to);
  return Object.freeze({ value: converted, conversion, losesValue: converted !== value });
}

/** Resolve the same-signedness integer result type of a binary operation. */
export function commonIntegerType(left: SemanticType, right: SemanticType): ScalarType | null {
  const leftFacts = integerFacts(left, false);
  const rightFacts = integerFacts(right, false);
  if (leftFacts === null || rightFacts === null || leftFacts.signed !== rightFacts.signed) {
    return null;
  }
  if (leftFacts.width === 16 || rightFacts.width === 16) {
    return leftFacts.signed ? SCALAR_TYPES.sword : SCALAR_TYPES.word;
  }
  return leftFacts.signed ? SCALAR_TYPES.sbyte : SCALAR_TYPES.byte;
}

/** Resolve compatible scalar conditional arms. */
export function commonScalarType(left: SemanticType, right: SemanticType): ScalarType | null {
  if (!isScalarType(left) || !isScalarType(right)) return null;
  if (left.name === right.name) return left;
  return isIntegerType(left) && isIntegerType(right) ? commonIntegerType(left, right) : null;
}

/** Identify a positive or syntactically negative integer literal. */
export function isIntegerLiteralExpression(expression: Expr): boolean {
  return (
    expression.kind === "number" ||
    (expression.kind === "unary" &&
      expression.operator === "-" &&
      expression.operand.kind === "number")
  );
}

/** Use a peer's integer type only when a source literal fits it. */
export function adaptableLiteralType(
  expression: Expr,
  peer: SemanticType | null,
): SemanticType | null {
  if (peer === null || !isIntegerType(peer)) return null;
  if (expression.kind === "number") return fitsInteger(peer, expression.value) ? peer : null;
  if (
    expression.kind === "unary" &&
    expression.operator === "-" &&
    expression.operand.kind === "number"
  ) {
    return fitsInteger(peer, -expression.operand.value) ? peer : null;
  }
  return null;
}

/** Distinguish source constants from mutable values that merely have a known value here. */
export function isCompileTimeConstantExpression(
  expression: Expr,
  context: ScalarExpressionContext,
  host: ScalarExpressionHost,
): boolean {
  switch (expression.kind) {
    case "number":
    case "boolean":
    case "literal":
    case "sizeof":
    case "offsetof":
    case "length":
      return true;
    case "name":
      return host.resolveName(expression.name, context)?.binding.storage === "constant";
    case "unary":
    case "cast":
      return isCompileTimeConstantExpression(expression.operand, context, host);
    case "binary":
      return (
        isCompileTimeConstantExpression(expression.left, context, host) &&
        isCompileTimeConstantExpression(expression.right, context, host)
      );
    case "conditional":
      return (
        isCompileTimeConstantExpression(expression.condition, context, host) &&
        isCompileTimeConstantExpression(expression.whenTrue, context, host) &&
        isCompileTimeConstantExpression(expression.whenFalse, context, host)
      );
    case "member":
      if (expression.object.kind !== "name") return false;
      {
        const qualified = host.resolveName(
          `${expression.object.name}.${expression.member}`,
          context,
        );
        if (qualified !== null) return qualified.binding.storage === "constant";
        return (
          host.resolveType(
            {
              kind: "named-type",
              name: expression.object.name,
              span: expression.object.span,
            },
            context,
          )?.kind === "enum"
        );
      }
    case "call":
      return (
        expression.callee.kind === "name" &&
        host.resolveName(expression.callee.name, context) === null &&
        expression.arguments.every((argument) =>
          isCompileTimeConstantExpression(argument, context, host),
        )
      );
    default:
      return false;
  }
}

/** Validate a compound integer operation and return its pre-store result type. */
export function compoundOperationType(
  target: SemanticType,
  value: SemanticType,
  operator: string,
  expression: Extract<Expr, { readonly kind: "assignment" }>,
  host: ScalarExpressionHost,
): SemanticType | null {
  if (!isIntegerType(target) || !isIntegerType(value)) {
    host.diagnose(
      projectDiagnostic(
        "E10151",
        "Cannot use 'boolean' in an arithmetic or bitwise expression",
        expression.span,
      ),
    );
    return null;
  }
  const targetFacts = integerFacts(target, false)!;
  const valueFacts = integerFacts(value, false)!;
  const shift = operator === "<<" || operator === ">>";
  if (shift && valueFacts.signed) {
    host.diagnose(
      projectDiagnostic(
        "E10161",
        `Shift amount must have unsigned type 'byte' or 'word' — found '${value.name}'`,
        expression.value.span,
      ),
    );
    return null;
  }
  if (!shift && targetFacts.signed !== valueFacts.signed) {
    const signed = targetFacts.signed ? target.name : value.name;
    const unsigned = targetFacts.signed ? value.name : target.name;
    host.diagnose(
      projectDiagnostic(
        "E10081",
        `Cannot mix signed type '${signed}' with unsigned type '${unsigned}' — cast one operand`,
        expression.span,
      ),
    );
    return null;
  }
  const operationType = shift ? target : commonIntegerType(target, value)!;
  if (integerFacts(operationType, false)!.width > targetFacts.width) {
    host.diagnose(
      projectDiagnostic(
        "E10082",
        `Cannot implicitly narrow '${operationType.name}' to '${target.name}' — use '${target.name}(<expr>)'`,
        expression.span,
      ),
    );
    return null;
  }
  return operationType;
}

/** Apply a declaration, assignment, argument, or return scalar conversion. */
export function applyExpectedScalar(
  result: ScalarExpressionResult,
  expected: SemanticType,
  expression: Expr,
  context: ScalarExpressionContext,
  host: ScalarExpressionHost,
): ScalarExpressionResult {
  const node = result.node!;
  if (node.type.kind === "enum") {
    if (expected.kind !== "scalar" || expected.name !== "byte") {
      host.diagnose(
        conversionError(
          "E10080",
          `Cannot implicitly convert '${node.type.name}' to '${expected.kind === "scalar" ? expected.name : "aggregate"}' — cast to 'byte' first`,
          expression,
        ),
      );
      return { node: null, exact: result.exact };
    }
    return {
      node: Object.freeze({
        ...node,
        type: SCALAR_TYPES.byte,
        conversion: "identity",
        integer: integerFacts(SCALAR_TYPES.byte, false),
      }),
      exact: result.exact,
    };
  }
  if (!isScalarType(node.type) || !isScalarType(expected))
    return { node: null, exact: result.exact };
  if (node.type.name === expected.name) {
    if (
      context.constantContext &&
      typeof result.exact === "bigint" &&
      !fitsInteger(expected, result.exact)
    ) {
      host.diagnose(
        conversionError("E10084", integerRangeMessage(expected, result.exact), expression),
      );
      return { node: null, exact: result.exact };
    }
    return result;
  }
  if (node.type.name === "boolean" || expected.name === "boolean") {
    host.diagnose(
      conversionError(
        "E10086",
        `Cannot cast '${node.type.name}' to '${expected.name}' — boolean is not convertible to or from an integer`,
        expression,
      ),
    );
    return { node: null, exact: result.exact };
  }
  const fromFacts = integerFacts(node.type, false);
  const toFacts = integerFacts(expected, false);
  if (fromFacts === null || toFacts === null) return { node: null, exact: result.exact };
  if (context.constantContext && typeof result.exact === "bigint") {
    if (!fitsInteger(expected, result.exact)) {
      host.diagnose(
        conversionError("E10084", integerRangeMessage(expected, result.exact), expression),
      );
      return { node: null, exact: result.exact };
    }
    const conversion =
      fromFacts.width < toFacts.width
        ? fromFacts.signed
          ? "sign-extend"
          : "zero-extend"
        : "identity";
    return {
      node: Object.freeze({
        ...node,
        type: expected,
        constant: result.exact,
        conversion,
        integer: integerFacts(expected, false),
      }),
      exact: result.exact,
    };
  }
  if (fromFacts.signed !== toFacts.signed) {
    host.diagnose(
      conversionError(
        "E10080",
        `Cannot implicitly convert '${node.type.name}' to '${expected.name}' — signedness differs; use an explicit cast`,
        expression,
      ),
    );
    return { node: null, exact: result.exact };
  }
  if (fromFacts.width > toFacts.width) {
    host.diagnose(
      conversionError(
        "E10082",
        `Cannot implicitly narrow '${node.type.name}' to '${expected.name}' — use '${expected.name}(<expr>)'`,
        expression,
      ),
    );
    return { node: null, exact: result.exact };
  }
  const conversion = fromFacts.signed ? "sign-extend" : "zero-extend";
  warnNarrowArithmetic(result, expected, expression, fromFacts.width, toFacts.width, host);
  return {
    node: Object.freeze({ ...node, type: expected, conversion, integer: node.integer }),
    exact: result.exact,
  };
}

/** Build one immutable conversion diagnostic. */
function conversionError(code: string, message: string, expression: Expr): ProjectDiagnostic {
  return projectDiagnostic(code, message, expression.span);
}

/** Warn only when narrow arithmetic is widened after it has completed. */
function warnNarrowArithmetic(
  result: ScalarExpressionResult,
  expected: SemanticType,
  expression: Expr,
  fromWidth: 8 | 16,
  toWidth: 8 | 16,
  host: ScalarExpressionHost,
): void {
  const node = result.node!;
  if (!isScalarType(node.type) || !isScalarType(expected)) return;
  if (
    fromWidth !== 8 ||
    toWidth !== 16 ||
    node.kind !== "binary" ||
    !["+", "-", "*"].includes(node.operator ?? "")
  ) {
    return;
  }
  const expressionText = host.sourceText(expression.span);
  if (
    typeof result.exact === "bigint" &&
    typeof node.constant === "bigint" &&
    result.exact !== node.constant
  ) {
    host.diagnose(
      conversionWarning(
        "W10161",
        `Runtime expression '${expressionText}' is known to wrap to ${node.constant} at '${node.type.name}' width before widening to '${expected.name}'`,
        expression,
      ),
    );
  } else if (result.exact === null) {
    host.diagnose(
      conversionWarning(
        "W10160",
        `'${node.type.name}' arithmetic may overflow before widening to '${expected.name}'`,
        expression,
      ),
    );
  }
}

/** Build one immutable warning with the shared project diagnostic fields. */
function conversionWarning(code: string, message: string, expression: Expr): ProjectDiagnostic {
  return Object.freeze({
    ...projectDiagnostic(code, message, expression.span),
    severity: "warning",
  });
}

/** Evaluate an integer prefix operator with arbitrary-precision input. */
export function evaluateUnaryInteger(operator: string, operand: bigint): bigint | null {
  if (operator === "+") return operand;
  if (operator === "-") return -operand;
  if (operator === "~") return ~operand;
  return null;
}

/**
 * Evaluate an integer binary operator exactly.
 * Division uses BigInt's truncation toward zero, which also gives a remainder
 * with the dividend's sign as required by the language.
 */
export function evaluateBinaryInteger(
  operator: string,
  left: bigint,
  right: bigint,
  type: SemanticType,
): bigint | boolean | null {
  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      return right === 0n ? null : left / right;
    case "%":
      return right === 0n ? null : left % right;
    case "&":
      return left & right;
    case "|":
      return left | right;
    case "^":
      return left ^ right;
    case "<<":
      return evaluateShift(left, right, type, false);
    case ">>":
      return evaluateShift(left, right, type, true);
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    default:
      return null;
  }
}

/** Evaluate the language's saturating wide-count shift rule. */
function evaluateShift(
  left: bigint,
  right: bigint,
  type: SemanticType,
  shiftRight: boolean,
): bigint {
  const facts = integerFacts(type, false);
  if (facts === null || right < 0n) return left;
  if (right >= BigInt(facts.width)) return shiftRight && facts.signed && left < 0n ? -1n : 0n;
  return shiftRight ? left >> right : left << right;
}
