import type { BinaryOperator, ScalarType, UnaryOperator } from "./generator-ir.js";
import type { OracleUnmodeledReason, OracleValueV1 } from "./oracle-model.js";
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
    return operand.kind === "boolean" && resultType === "boolean"
      ? booleanValue(!operand.value)
      : unsupported();
  }
  if (operand.kind !== "integer" || operand.type !== resultType) return unsupported();
  if (operator === "-") {
    if (resultType !== "sbyte" && resultType !== "sword") return unsupported();
    return integerValue(resultType, -operand.value);
  }
  return integerValue(operand.type, ~operand.value);
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
    return booleanValue(
      operator === "==" ? left.value === right.value : left.value !== right.value,
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
      return integerValue(left.type, 0n);
    }
    const shifted = operator === "<<" ? left.value << right.value : left.value >> right.value;
    return integerValue(left.type, shifted);
  }

  const promotedType = promoteOracleIntegerTypes(left.type, right.type);
  if (promotedType === undefined) return unsupported();
  const widenedLeft = widenOracleInteger(left, promotedType);
  const widenedRight = widenOracleInteger(right, promotedType);
  if (COMPARISON_OPERATORS.has(operator)) {
    return resultType === "boolean"
      ? booleanValue(compareIntegers(operator, widenedLeft.value, widenedRight.value))
      : unsupported();
  }
  return resultType === promotedType
    ? evaluateIntegerArithmetic(operator, promotedType, widenedLeft.value, widenedRight.value)
    : unsupported();
}
