import type { BinaryOperator, ScalarType, UnaryOperator } from "./generator-ir.js";
import type { OracleUnmodeledReason, OracleValueV1 } from "./oracle-model.js";
import {
  oracleMutationDispatchMarker,
  selectedOracleMutationVariant,
  type OracleMutationDispatchMarkerV1,
} from "./oracle-conformance-v1.js";
import {
  normalizeOracleInteger,
  oracleIntegerTypeInfo,
  promoteOracleIntegerTypes,
  widenOracleInteger,
  type OracleIntegerTypeV1,
} from "./oracle-values.js";

/** Successful scalar operation result. */
export interface OracleOperationValueResultV1 {
  /** Modeled-value discriminator. */
  readonly kind: "value";
  /** Immediately normalized typed result. */
  readonly value: OracleValueV1;
}

/** Structurally valid operation that cannot produce oracle authority. */
export interface OracleOperationUnmodeledResultV1 {
  /** Unsupported-operation discriminator. */
  readonly kind: "unmodeled";
  /** Closed reason returned by the evaluator. */
  readonly reason: OracleUnmodeledReason;
}

/** Closed internal result of one scalar operation. */
export type OracleOperationResultV1 =
  | OracleOperationValueResultV1
  | OracleOperationUnmodeledResultV1;

const COMPARISON_OPERATORS: ReadonlySet<BinaryOperator> = new Set([
  "==",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
]);

const BOOLEAN_BINARY_MUTATIONS: Readonly<Record<"==" | "!=", OracleMutationDispatchMarkerV1>> =
  Object.freeze({
    "==": oracleMutationDispatchMarker(
      "evaluator.binary",
      "evaluator.binary.boolean.equal",
      "boolean-negate-v1",
    ),
    "!=": oracleMutationDispatchMarker(
      "evaluator.binary",
      "evaluator.binary.boolean.not-equal",
      "boolean-negate-v1",
    ),
  });

const INTEGER_BINARY_MUTATIONS: Readonly<Record<BinaryOperator, OracleMutationDispatchMarkerV1>> =
  Object.freeze({
    "+": oracleMutationDispatchMarker(
      "evaluator.binary",
      "evaluator.binary.integer.add",
      "integer-xor-one-v1",
    ),
    "&": oracleMutationDispatchMarker(
      "evaluator.binary",
      "evaluator.binary.integer.bitwise-and",
      "integer-xor-one-v1",
    ),
    "|": oracleMutationDispatchMarker(
      "evaluator.binary",
      "evaluator.binary.integer.bitwise-or",
      "integer-xor-one-v1",
    ),
    "^": oracleMutationDispatchMarker(
      "evaluator.binary",
      "evaluator.binary.integer.bitwise-xor",
      "integer-xor-one-v1",
    ),
    "/": oracleMutationDispatchMarker(
      "evaluator.binary",
      "evaluator.binary.integer.divide",
      "integer-xor-one-v1",
    ),
    "==": oracleMutationDispatchMarker(
      "evaluator.binary",
      "evaluator.binary.integer.equal",
      "boolean-negate-v1",
    ),
    ">": oracleMutationDispatchMarker(
      "evaluator.binary",
      "evaluator.binary.integer.greater",
      "boolean-negate-v1",
    ),
    ">=": oracleMutationDispatchMarker(
      "evaluator.binary",
      "evaluator.binary.integer.greater-equal",
      "boolean-negate-v1",
    ),
    "<": oracleMutationDispatchMarker(
      "evaluator.binary",
      "evaluator.binary.integer.less",
      "boolean-negate-v1",
    ),
    "<=": oracleMutationDispatchMarker(
      "evaluator.binary",
      "evaluator.binary.integer.less-equal",
      "boolean-negate-v1",
    ),
    "*": oracleMutationDispatchMarker(
      "evaluator.binary",
      "evaluator.binary.integer.multiply",
      "integer-xor-one-v1",
    ),
    "!=": oracleMutationDispatchMarker(
      "evaluator.binary",
      "evaluator.binary.integer.not-equal",
      "boolean-negate-v1",
    ),
    "%": oracleMutationDispatchMarker(
      "evaluator.binary",
      "evaluator.binary.integer.remainder",
      "integer-xor-one-v1",
    ),
    "-": oracleMutationDispatchMarker(
      "evaluator.binary",
      "evaluator.binary.integer.subtract",
      "integer-xor-one-v1",
    ),
    "<<": oracleMutationDispatchMarker(
      "evaluator.binary",
      "evaluator.binary.shift-left",
      "integer-xor-one-v1",
    ),
    ">>": oracleMutationDispatchMarker(
      "evaluator.binary",
      "evaluator.binary.shift-right",
      "integer-xor-one-v1",
    ),
  });

const UNARY_MUTATIONS: Readonly<Record<UnaryOperator, OracleMutationDispatchMarkerV1>> =
  Object.freeze({
    "~": oracleMutationDispatchMarker(
      "evaluator.unary",
      "evaluator.unary.bitwise-not",
      "integer-xor-one-v1",
    ),
    "!": oracleMutationDispatchMarker(
      "evaluator.unary",
      "evaluator.unary.logical-not",
      "boolean-negate-v1",
    ),
    "-": oracleMutationDispatchMarker(
      "evaluator.unary",
      "evaluator.unary.negate",
      "integer-xor-one-v1",
    ),
  });

/** Closed scalar-operation branches required by mutation conformance. */
export const ORACLE_SCALAR_MUTATION_PATHS = Object.freeze([
  ...Object.values(BOOLEAN_BINARY_MUTATIONS),
  ...Object.values(INTEGER_BINARY_MUTATIONS),
  ...Object.values(UNARY_MUTATIONS),
]);

/*
  The complete operator maps above are both executable routing and registry
  metadata. Adding an operator branch therefore requires adding its marker.
*/

function unsupported(): OracleOperationUnmodeledResultV1 {
  return Object.freeze({ kind: "unmodeled", reason: "unsupported-semantics" });
}

function integerValue(type: OracleIntegerTypeV1, value: bigint): OracleOperationValueResultV1 {
  return Object.freeze({
    kind: "value",
    value: Object.freeze({
      kind: "integer",
      type,
      value: normalizeOracleInteger(type, value),
    }),
  });
}

function booleanValue(value: boolean): OracleOperationValueResultV1 {
  return Object.freeze({
    kind: "value",
    value: Object.freeze({ kind: "boolean", type: "boolean", value }),
  });
}

function mutateValue(
  marker: OracleMutationDispatchMarkerV1,
  result: OracleOperationResultV1,
): OracleOperationResultV1 {
  if (result.kind !== "value") return result;
  const variant = selectedOracleMutationVariant(marker);
  if (variant === "boolean-negate-v1" && result.value.kind === "boolean") {
    return booleanValue(!result.value.value);
  }
  if (variant === "integer-xor-one-v1" && result.value.kind === "integer") {
    return integerValue(result.value.type, result.value.value ^ 1n);
  }
  return result;
}

function compareIntegers(operator: BinaryOperator, left: bigint, right: bigint): boolean {
  switch (operator) {
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
      return false;
  }
}

function evaluateIntegerArithmetic(
  operator: BinaryOperator,
  type: OracleIntegerTypeV1,
  left: bigint,
  right: bigint,
): OracleOperationResultV1 {
  switch (operator) {
    case "+":
      return integerValue(type, left + right);
    case "-":
      return integerValue(type, left - right);
    case "*":
      return integerValue(type, left * right);
    case "/":
      return right === 0n
        ? Object.freeze({
            kind: "unmodeled",
            reason: "blocked-errata-division-by-zero",
          })
        : integerValue(type, left / right);
    case "%":
      return right === 0n
        ? Object.freeze({
            kind: "unmodeled",
            reason: "blocked-errata-division-by-zero",
          })
        : integerValue(type, left % right);
    case "&":
      return integerValue(type, left & right);
    case "|":
      return integerValue(type, left | right);
    case "^":
      return integerValue(type, left ^ right);
    default:
      return unsupported();
  }
}

/**
 * Evaluates one closed unary operation over an already evaluated operand.
 *
 * @param operator Unary operator.
 * @param resultType Declared expression result type.
 * @param operand Typed operand value.
 * @returns Normalized value or explicit unsupported result.
 */
export function evaluateOracleUnaryOperation(
  operator: UnaryOperator,
  resultType: ScalarType,
  operand: OracleValueV1,
): OracleOperationResultV1 {
  if (operator === "!") {
    return mutateValue(
      UNARY_MUTATIONS[operator],
      operand.kind === "boolean" && resultType === "boolean"
        ? booleanValue(!operand.value)
        : unsupported(),
    );
  }
  if (operand.kind !== "integer" || operand.type !== resultType) return unsupported();
  if (operator === "-") {
    if (resultType !== "sbyte" && resultType !== "sword") return unsupported();
    return mutateValue(UNARY_MUTATIONS[operator], integerValue(resultType, -operand.value));
  }
  return mutateValue(UNARY_MUTATIONS[operator], integerValue(operand.type, ~operand.value));
}

/**
 * Evaluates one closed binary operation after left-to-right operand evaluation.
 *
 * Same-signed mixed-width arithmetic, bitwise operations and comparisons are
 * widened before dispatch. Shift operations retain the left operand's width.
 *
 * @param operator Binary operator.
 * @param resultType Declared expression result type.
 * @param left Evaluated left operand.
 * @param right Evaluated right operand.
 * @returns Normalized value or an explicit unsupported/blocked result.
 */
export function evaluateOracleBinaryOperation(
  operator: BinaryOperator,
  resultType: ScalarType,
  left: OracleValueV1,
  right: OracleValueV1,
): OracleOperationResultV1 {
  if (left.kind === "boolean" || right.kind === "boolean") {
    if (
      left.kind !== "boolean" ||
      right.kind !== "boolean" ||
      resultType !== "boolean" ||
      (operator !== "==" && operator !== "!=")
    ) {
      return unsupported();
    }
    return mutateValue(
      BOOLEAN_BINARY_MUTATIONS[operator],
      booleanValue(operator === "==" ? left.value === right.value : left.value !== right.value),
    );
  }

  if (operator === "<<" || operator === ">>") {
    if (
      resultType !== left.type ||
      (right.type !== "byte" && right.type !== "word") ||
      right.value < 0n
    ) {
      return unsupported();
    }
    if (right.value >= BigInt(oracleIntegerTypeInfo(left.type).bits)) {
      return mutateValue(INTEGER_BINARY_MUTATIONS[operator], integerValue(left.type, 0n));
    }
    const shifted = operator === "<<" ? left.value << right.value : left.value >> right.value;
    return mutateValue(INTEGER_BINARY_MUTATIONS[operator], integerValue(left.type, shifted));
  }

  const promotedType = promoteOracleIntegerTypes(left.type, right.type);
  if (promotedType === undefined) return unsupported();
  const widenedLeft = widenOracleInteger(left, promotedType);
  const widenedRight = widenOracleInteger(right, promotedType);
  if (COMPARISON_OPERATORS.has(operator)) {
    return mutateValue(
      INTEGER_BINARY_MUTATIONS[operator],
      resultType === "boolean"
        ? booleanValue(compareIntegers(operator, widenedLeft.value, widenedRight.value))
        : unsupported(),
    );
  }
  return mutateValue(
    INTEGER_BINARY_MUTATIONS[operator],
    resultType === promotedType
      ? evaluateIntegerArithmetic(operator, promotedType, widenedLeft.value, widenedRight.value)
      : unsupported(),
  );
}
