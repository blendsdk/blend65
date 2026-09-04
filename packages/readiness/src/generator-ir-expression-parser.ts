import type {
  BinaryOperator,
  GenArrayReferenceExpression,
  GenArrayType,
  GenStructuredExpression,
  UnaryOperator,
} from "./generator-ir.js";
import { isGenIdentifier, isScalarType } from "./generator-ir.js";
import {
  generatorNodeFailure,
  generatorNodeSuccess,
  generatorScalarRange,
  hasExactGeneratorKeys,
  isGeneratorRecord,
  type GeneratorNodeResult,
} from "./generator-ir-parser-common.js";

const MAX_EXPRESSION_DEPTH = 1_024;
const UNARY_OPERATORS: ReadonlySet<string> = new Set(["-", "~", "!"]);
const BINARY_OPERATORS: ReadonlySet<string> = new Set([
  "+",
  "-",
  "*",
  "/",
  "%",
  "&",
  "|",
  "^",
  "<<",
  ">>",
  "==",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
]);

function isUnaryOperator(value: unknown): value is UnaryOperator {
  return typeof value === "string" && UNARY_OPERATORS.has(value);
}

function isBinaryOperator(value: unknown): value is BinaryOperator {
  return typeof value === "string" && BINARY_OPERATORS.has(value);
}

/** Parses and snapshots a closed array type. */
export function parseGeneratorArrayType(
  value: unknown,
  path: string,
): GeneratorNodeResult<GenArrayType> {
  if (
    !isGeneratorRecord(value) ||
    !hasExactGeneratorKeys(value, ["kind", "elementType", "extent", "access"]) ||
    value.kind !== "array-type" ||
    !isScalarType(value.elementType) ||
    (value.extent !== null &&
      (typeof value.extent !== "number" || !Number.isSafeInteger(value.extent))) ||
    (value.access !== "const" && value.access !== "mutable")
  ) {
    return generatorNodeFailure("generation-input-invalid", path, "Array type shape is invalid.");
  }
  return generatorNodeSuccess(
    Object.freeze({
      kind: "array-type",
      elementType: value.elementType,
      extent: value.extent,
      access: value.access,
    }),
  );
}

function parseArrayReference(
  value: unknown,
  path: string,
): GeneratorNodeResult<GenArrayReferenceExpression> {
  if (
    !isGeneratorRecord(value) ||
    !hasExactGeneratorKeys(value, ["kind", "type", "name"]) ||
    value.kind !== "array-reference" ||
    !isGenIdentifier(value.name)
  ) {
    return generatorNodeFailure(
      "generation-input-invalid",
      path,
      "Array reference shape is invalid.",
    );
  }
  const type = parseGeneratorArrayType(value.type, `${path}/type`);
  if (!type.ok) return type;
  return generatorNodeSuccess(
    Object.freeze({ kind: "array-reference", type: type.node, name: value.name }),
  );
}

/** Parses one scalar expression or array-reference call argument. */
export function parseGeneratorCallArgument(
  value: unknown,
  path: string,
  depth: number,
): GeneratorNodeResult<GenStructuredExpression | GenArrayReferenceExpression> {
  return isGeneratorRecord(value) && value.kind === "array-reference"
    ? parseArrayReference(value, path)
    : parseGeneratorExpression(value, path, depth);
}

/**
 * Parses and snapshots one closed structured expression.
 *
 * @param value Unknown expression input.
 * @param path Canonical diagnostic path.
 * @param depth Current expression depth.
 * @returns Immutable expression or one stable diagnostic.
 */
export function parseGeneratorExpression(
  value: unknown,
  path: string,
  depth: number,
): GeneratorNodeResult<GenStructuredExpression> {
  if (depth > MAX_EXPRESSION_DEPTH) {
    return generatorNodeFailure(
      "generation-input-invalid",
      path,
      "Expression nesting exceeds the safe limit.",
    );
  }
  if (!isGeneratorRecord(value) || typeof value.kind !== "string") {
    return generatorNodeFailure(
      "generation-input-invalid",
      path,
      "Expression must be a closed record.",
    );
  }

  if (value.kind === "literal") {
    if (
      !hasExactGeneratorKeys(value, ["kind", "type", "value"]) ||
      !isScalarType(value.type) ||
      (value.type === "boolean"
        ? typeof value.value !== "boolean" && typeof value.value !== "bigint"
        : typeof value.value !== "bigint")
    ) {
      return generatorNodeFailure(
        "generation-input-invalid",
        path,
        "Literal expression shape is invalid.",
      );
    }
    if (typeof value.value === "boolean") {
      return generatorNodeSuccess<GenStructuredExpression>(
        Object.freeze({ kind: "literal", type: "boolean", value: value.value ? 1n : 0n }),
      );
    }
    if (typeof value.value !== "bigint") {
      return generatorNodeFailure(
        "generation-input-invalid",
        path,
        "Literal expression shape is invalid.",
      );
    }
    const literalValue = value.value;
    const range = generatorScalarRange(value.type);
    if (literalValue < range.minimum || literalValue > range.maximum) {
      return generatorNodeFailure(
        "generation-type-invalid",
        `${path}/value`,
        "Literal value lies outside its declared scalar type.",
      );
    }
    return generatorNodeSuccess<GenStructuredExpression>(
      Object.freeze({ kind: "literal", type: value.type, value: literalValue }),
    );
  }

  if (value.kind === "name") {
    if (
      !hasExactGeneratorKeys(value, ["kind", "type", "name"]) ||
      !isScalarType(value.type) ||
      !isGenIdentifier(value.name)
    ) {
      return generatorNodeFailure(
        "generation-input-invalid",
        path,
        "Name expression shape is invalid.",
      );
    }
    return generatorNodeSuccess<GenStructuredExpression>(
      Object.freeze({ kind: "name", type: value.type, name: value.name }),
    );
  }

  if (value.kind === "unary") {
    if (
      !hasExactGeneratorKeys(value, ["kind", "type", "operator", "operand"]) ||
      !isScalarType(value.type) ||
      !isUnaryOperator(value.operator)
    ) {
      return generatorNodeFailure(
        "generation-input-invalid",
        path,
        "Unary expression shape is invalid.",
      );
    }
    const operand = parseGeneratorExpression(value.operand, `${path}/operand`, depth + 1);
    if (!operand.ok) return operand;
    return generatorNodeSuccess<GenStructuredExpression>(
      Object.freeze({
        kind: "unary",
        type: value.type,
        operator: value.operator,
        operand: operand.node,
      }),
    );
  }

  if (value.kind === "binary") {
    if (
      !hasExactGeneratorKeys(value, ["kind", "type", "operator", "left", "right"]) ||
      !isScalarType(value.type) ||
      !isBinaryOperator(value.operator)
    ) {
      return generatorNodeFailure(
        "generation-input-invalid",
        path,
        "Binary expression shape is invalid.",
      );
    }
    const left = parseGeneratorExpression(value.left, `${path}/left`, depth + 1);
    if (!left.ok) return left;
    const right = parseGeneratorExpression(value.right, `${path}/right`, depth + 1);
    if (!right.ok) return right;
    return generatorNodeSuccess<GenStructuredExpression>(
      Object.freeze({
        kind: "binary",
        type: value.type,
        operator: value.operator,
        left: left.node,
        right: right.node,
      }),
    );
  }

  if (value.kind === "memory-read") {
    if (
      !hasExactGeneratorKeys(value, ["kind", "type", "width", "address"]) ||
      (value.width !== 1 && value.width !== 2) ||
      (value.type !== "byte" && value.type !== "word") ||
      (value.width === 1 && value.type !== "byte") ||
      (value.width === 2 && value.type !== "word")
    ) {
      return generatorNodeFailure(
        "generation-type-invalid",
        path,
        "Memory-read width and type do not agree.",
      );
    }
    const address = parseGeneratorExpression(value.address, `${path}/address`, depth + 1);
    if (!address.ok) return address;
    return generatorNodeSuccess<GenStructuredExpression>(
      Object.freeze({
        kind: "memory-read",
        type: value.type,
        width: value.width,
        address: address.node,
      }),
    );
  }

  if (value.kind === "index") {
    if (
      !hasExactGeneratorKeys(value, ["kind", "type", "target", "index"]) ||
      !isScalarType(value.type) ||
      !isGenIdentifier(value.target)
    ) {
      return generatorNodeFailure(
        "generation-input-invalid",
        path,
        "Index expression shape is invalid.",
      );
    }
    const index = parseGeneratorExpression(value.index, `${path}/index`, depth + 1);
    if (!index.ok) return index;
    return generatorNodeSuccess<GenStructuredExpression>(
      Object.freeze({ kind: "index", type: value.type, target: value.target, index: index.node }),
    );
  }

  if (value.kind === "call") {
    if (
      !hasExactGeneratorKeys(value, ["kind", "type", "callee", "arguments"]) ||
      !isScalarType(value.type) ||
      !isGenIdentifier(value.callee) ||
      !Array.isArray(value.arguments)
    ) {
      return generatorNodeFailure(
        "generation-input-invalid",
        path,
        "Call expression shape is invalid.",
      );
    }
    const argumentsValue: (GenStructuredExpression | GenArrayReferenceExpression)[] = [];
    for (let index = 0; index < value.arguments.length; index += 1) {
      const argument = parseGeneratorCallArgument(
        value.arguments[index],
        `${path}/arguments/${index}`,
        depth + 1,
      );
      if (!argument.ok) return argument;
      argumentsValue.push(argument.node);
    }
    return generatorNodeSuccess<GenStructuredExpression>(
      Object.freeze({
        kind: "call",
        type: value.type,
        callee: value.callee,
        arguments: Object.freeze(argumentsValue),
      }),
    );
  }

  return generatorNodeFailure(
    "generation-input-invalid",
    `${path}/kind`,
    "Expression kind is not supported.",
  );
}
