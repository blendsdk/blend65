import { projectDiagnostic as error } from "../project/diagnostics.js";
import {
  convertInteger,
  createScalarTypedExpression,
  integerFacts,
  isScalarType,
  scalarWarning,
  SCALAR_TYPES,
} from "./constants.js";
import { semanticTypeName } from "./semantic-type-relations.js";
import type { EnumTable } from "./enum-types.js";
import type {
  ScalarExpressionContext,
  ScalarExpressionHost,
  ScalarExpressionResult,
  SemanticType,
} from "./semantic-types.js";
import type { Expr } from "./syntax.js";

/** Recursive expression callback retained by the scalar analyzer. */
export type AnalyzeConversionChild = (
  expression: Expr,
  expected: SemanticType | null,
  context: ScalarExpressionContext,
) => ScalarExpressionResult;

/** Resolve an enum member before ordinary field access is considered. */
export function analyzeEnumMember(
  expression: Expr,
  context: ScalarExpressionContext,
  host: ScalarExpressionHost,
  enums: EnumTable,
): ScalarExpressionResult | null {
  if (expression.kind !== "member" || expression.object.kind !== "name") return null;
  const enumName = expression.object.name;
  const member = enums.member(enumName, expression.member, context.module, context.sourceId);
  if (member !== null) {
    return {
      node: createScalarTypedExpression(expression, member.type, member.value, {
        member: expression.member,
        binding: member.type.binding,
      }),
      exact: member.value,
    };
  }
  if (enums.type(enumName, context.module, context.sourceId) !== null) return null;
  if (host.resolveName(enumName, context) !== null) return null;
  const suggestion = enums.suggestion(enumName, context.module, context.sourceId);
  if (suggestion === null) return null;
  host.diagnose(
    error(
      "E10231",
      `Enum member '${expression.member}' references unknown enum '${enumName}' — did you mean '${suggestion}'?`,
      expression.object.span,
    ),
  );
  return { node: null, exact: null };
}

/** Treat `EnumName(byteValue)` as the language's zero-cost nominal cast. */
export function analyzeEnumCastCall(
  expression: Extract<Expr, { readonly kind: "call" }>,
  context: ScalarExpressionContext,
  enums: EnumTable,
  host: ScalarExpressionHost,
  analyze: AnalyzeConversionChild,
): ScalarExpressionResult | null {
  if (expression.callee.kind !== "name") return null;
  const enumType = enums.type(expression.callee.name, context.module, context.sourceId);
  if (enumType === null) return null;
  if (expression.arguments.length !== 1) {
    host.diagnose(
      error(
        "E10171",
        `Wrong argument count — '${enumType.name}()' expects 1 parameters, got ${expression.arguments.length}`,
        expression.span,
      ),
    );
    for (const argument of expression.arguments) analyze(argument, null, context);
    return { node: null, exact: null };
  }
  const operand = analyze(expression.arguments[0]!, SCALAR_TYPES.byte, context);
  if (operand.node === null) return { node: null, exact: null };
  return {
    node: createScalarTypedExpression(expression, enumType, operand.node.constant, {
      kind: "cast",
      operand: operand.node,
      conversion: "identity",
    }),
    exact: operand.exact,
  };
}

/** Check an explicit cast and retain the exact fixed-width conversion. */
export function analyzeScalarCast(
  expression: Extract<Expr, { readonly kind: "cast" }>,
  context: ScalarExpressionContext,
  host: ScalarExpressionHost,
  analyze: AnalyzeConversionChild,
): ScalarExpressionResult {
  const destination = host.resolveType(expression.type, context);
  const operand = analyze(expression.operand, null, { ...context, ordinalContext: false });
  if (destination === null || operand.node === null) return { node: null, exact: null };
  if (destination.kind === "enum") {
    if (operand.node.type.kind !== "scalar" || operand.node.type.name !== "byte") {
      host.diagnose(
        error(
          "E10235",
          `Cannot assign '${semanticTypeName(operand.node.type)}' to enum '${destination.name}' — use '${destination.name}(byte(<expr>))'`,
          expression.span,
        ),
      );
      return { node: null, exact: null };
    }
    return {
      node: createScalarTypedExpression(expression, destination, operand.node.constant, {
        operand: operand.node,
        targetType: expression.type,
        conversion: "identity",
      }),
      exact: operand.exact,
    };
  }
  const operandType = operand.node.type.kind === "enum" ? SCALAR_TYPES.byte : operand.node.type;
  if (!isScalarType(destination) || !isScalarType(operandType)) {
    host.diagnose(
      error(
        "E10086",
        `Cannot cast '${semanticTypeName(operand.node.type)}' to '${semanticTypeName(destination)}'`,
        expression.span,
      ),
    );
    return { node: null, exact: null };
  }
  if (destination.name === "void" || operandType.name === "void") {
    host.diagnose(error("E10152", "Cannot cast to or from 'void'", expression.span));
    return { node: null, exact: null };
  }
  if (destination.name === "boolean" || operandType.name === "boolean") {
    host.diagnose(
      error(
        "E10086",
        `Cannot cast '${operandType.name}' to '${destination.name}' — boolean is not convertible to or from an integer`,
        expression.span,
      ),
    );
    return { node: null, exact: null };
  }
  const conversion =
    typeof operand.node.constant === "bigint"
      ? convertInteger(operand.node.constant, operandType, destination)
      : convertInteger(0n, operandType, destination);
  if (
    conversion.conversion === "truncate" &&
    conversion.losesValue &&
    typeof operand.node.constant === "bigint"
  ) {
    host.diagnose(
      scalarWarning(
        "W10101",
        `Narrowing cast from '${semanticTypeName(operand.node.type)}' to '${destination.name}' truncates ${operand.node.constant} to ${conversion.value}`,
        expression.span,
      ),
    );
  }
  const constant = typeof operand.node.constant === "bigint" ? conversion.value : null;
  return {
    node: createScalarTypedExpression(expression, destination, constant, {
      operand: operand.node,
      targetType: expression.type,
      conversion: conversion.conversion,
      integer: integerFacts(destination, false),
    }),
    exact: constant,
  };
}
