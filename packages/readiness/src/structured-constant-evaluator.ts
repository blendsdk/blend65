import type { GenStructuredExpression, GenStructuredModule, ScalarType } from "./generator-ir.js";
import {
  structuredDiagnostic,
  type StructuredGenerationDiagnosticV2,
} from "./structured-ir-diagnostics.js";
import {
  isStructuredTypeCompatible,
  structuredScalarRange,
} from "./structured-ir-semantic-types.js";

/** One exact compile-time scalar before target-width runtime normalization. */
export interface StructuredCompileTimeValue {
  readonly type: ScalarType;
  readonly value: bigint;
}

/** Result of attempting to fold an expression against the module constant environment. */
export type StructuredCompileTimeFold =
  | { readonly kind: "constant"; readonly result: StructuredCompileTimeValue }
  | { readonly kind: "dynamic" };

/** Complete, memoized module-constant evaluation used by validation and execution. */
export type StructuredModuleConstantEvaluation =
  | {
      readonly ok: true;
      readonly values: ReadonlyMap<string, StructuredCompileTimeValue>;
      readonly evaluationSteps: bigint;
    }
  | { readonly ok: false; readonly diagnostic: StructuredGenerationDiagnosticV2 };

function unary(operator: string, operand: bigint): bigint {
  if (operator === "-") return -operand;
  if (operator === "~") return ~operand;
  return operand === 0n ? 1n : 0n;
}

function binary(operator: string, left: bigint, right: bigint): bigint {
  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      return left / right;
    case "%":
      return left % right;
    case "&":
      return left & right;
    case "|":
      return left | right;
    case "^":
      return left ^ right;
    case "<<":
      return left << right;
    case ">>":
      return left >> right;
    case "==":
      return left === right ? 1n : 0n;
    case "!=":
      return left !== right ? 1n : 0n;
    case "<":
      return left < right ? 1n : 0n;
    case "<=":
      return left <= right ? 1n : 0n;
    case ">":
      return left > right ? 1n : 0n;
    case ">=":
      return left >= right ? 1n : 0n;
    default:
      return 0n;
  }
}

/**
 * Folds one pure expression when every referenced name is a known module constant.
 *
 * @param expression Validated structured expression.
 * @param constants Evaluated module constants.
 * @returns Exact mathematical value, or `dynamic` when runtime state is required.
 */
export function foldStructuredCompileTimeExpression(
  expression: GenStructuredExpression,
  constants: ReadonlyMap<string, StructuredCompileTimeValue>,
): StructuredCompileTimeFold {
  if (expression.kind === "literal") {
    return { kind: "constant", result: { type: expression.type, value: expression.value } };
  }
  if (expression.kind === "name") {
    const result = constants.get(expression.name);
    return result === undefined ? { kind: "dynamic" } : { kind: "constant", result };
  }
  if (
    expression.kind === "memory-read" ||
    expression.kind === "index" ||
    expression.kind === "call"
  ) {
    return { kind: "dynamic" };
  }
  if (expression.kind === "unary") {
    const operand = foldStructuredCompileTimeExpression(expression.operand, constants);
    return operand.kind === "dynamic"
      ? operand
      : {
          kind: "constant",
          result: {
            type: expression.type,
            value: unary(expression.operator, operand.result.value),
          },
        };
  }
  const left = foldStructuredCompileTimeExpression(expression.left, constants);
  const right = foldStructuredCompileTimeExpression(expression.right, constants);
  if (
    left.kind === "dynamic" ||
    right.kind === "dynamic" ||
    ((expression.operator === "/" || expression.operator === "%") && right.result.value === 0n)
  ) {
    return { kind: "dynamic" };
  }
  return {
    kind: "constant",
    result: {
      type: expression.type,
      value: binary(expression.operator, left.result.value, right.result.value),
    },
  };
}

/** Returns the compile-time zero-divisor diagnostic for one binary expression, when present. */
export function structuredConstantZeroDivisorFailure(
  expression: Extract<GenStructuredExpression, { readonly kind: "binary" }>,
  path: string,
  constants: ReadonlyMap<string, StructuredCompileTimeValue>,
): StructuredGenerationDiagnosticV2 | undefined {
  if (expression.operator !== "/" && expression.operator !== "%") return undefined;
  const divisor = foldStructuredCompileTimeExpression(expression.right, constants);
  return divisor.kind === "constant" && divisor.result.value === 0n
    ? structuredDiagnostic(
        "generation-type-invalid",
        "constant-zero-divisor",
        `${path}/right`,
        "Compile-time division and remainder require a nonzero divisor.",
      )
    : undefined;
}

/**
 * Evaluates all module constants once, including forward dependencies.
 *
 * @param module Structurally closed module.
 * @returns Exact values and cost, or the first deterministic constant diagnostic.
 */
export function evaluateStructuredModuleConstants(
  module: GenStructuredModule,
): StructuredModuleConstantEvaluation {
  const definitions = new Map(module.constants.map((constant, index) => [constant.name, index]));
  const values = new Map<string, StructuredCompileTimeValue>();
  const visiting = new Set<string>();
  let evaluationSteps = 0n;
  let failure: StructuredGenerationDiagnosticV2 | undefined;

  const evaluateExpression = (
    expression: GenStructuredExpression,
    path: string,
    ownerIndex: number,
  ): StructuredCompileTimeValue | undefined => {
    evaluationSteps += 1n;
    if (expression.kind === "literal") return { type: expression.type, value: expression.value };
    if (expression.kind === "name") {
      const dependencyIndex = definitions.get(expression.name);
      if (dependencyIndex === undefined) {
        failure = structuredDiagnostic(
          "generation-type-invalid",
          "constant-expression-not-constant",
          path,
          "Constant initializer references a runtime name.",
          { expectedCompilerDiagnosticCode: "E10193" },
        );
        return undefined;
      }
      if (visiting.has(expression.name)) {
        failure = structuredDiagnostic(
          "generation-type-invalid",
          "constant-dependency-cycle",
          `/constants/${ownerIndex}/value`,
          "Constant dependencies contain a cycle.",
          { expectedCompilerDiagnosticCode: "E10194" },
        );
        return undefined;
      }
      return evaluateConstant(dependencyIndex);
    }
    if (
      expression.kind === "memory-read" ||
      expression.kind === "index" ||
      expression.kind === "call"
    ) {
      failure = structuredDiagnostic(
        "generation-type-invalid",
        "constant-expression-not-constant",
        path,
        "Constant initializers must be pure compile-time expressions.",
        { expectedCompilerDiagnosticCode: "E10193" },
      );
      return undefined;
    }
    if (expression.kind === "unary") {
      const operand = evaluateExpression(expression.operand, `${path}/operand`, ownerIndex);
      return operand === undefined
        ? undefined
        : { type: expression.type, value: unary(expression.operator, operand.value) };
    }
    const left = evaluateExpression(expression.left, `${path}/left`, ownerIndex);
    if (left === undefined) return undefined;
    const rightPath = `${path}/right`;
    const right = evaluateExpression(expression.right, rightPath, ownerIndex);
    if (right === undefined) return undefined;
    if ((expression.operator === "/" || expression.operator === "%") && right.value === 0n) {
      failure = structuredDiagnostic(
        "generation-type-invalid",
        "constant-zero-divisor",
        rightPath,
        "Compile-time division and remainder require a nonzero divisor.",
      );
      return undefined;
    }
    return {
      type: expression.type,
      value: binary(expression.operator, left.value, right.value),
    };
  };

  const evaluateConstant = (index: number): StructuredCompileTimeValue | undefined => {
    const constant = module.constants[index];
    if (constant === undefined) return undefined;
    const existing = values.get(constant.name);
    if (existing !== undefined) return existing;
    evaluationSteps += 1n;
    visiting.add(constant.name);
    const computed = evaluateExpression(constant.value, `/constants/${index}/value`, index);
    visiting.delete(constant.name);
    if (computed === undefined) return undefined;
    if (!isStructuredTypeCompatible(constant.type, computed.type)) {
      failure = structuredDiagnostic(
        "generation-type-invalid",
        "expression-type-mismatch",
        `/constants/${index}/type`,
        "Constant value is incompatible with its declared type.",
      );
      return undefined;
    }
    const range = structuredScalarRange(constant.type);
    if (computed.value < range.minimum || computed.value > range.maximum) {
      failure = structuredDiagnostic(
        "generation-type-invalid",
        "constant-value-out-of-range",
        `/constants/${index}/value`,
        "Constant value lies outside its declared type.",
        { expectedCompilerDiagnosticCode: "E10084" },
      );
      return undefined;
    }
    const result = Object.freeze({ type: constant.type, value: computed.value });
    values.set(constant.name, result);
    return result;
  };

  for (let index = 0; index < module.constants.length; index += 1) {
    if (evaluateConstant(index) === undefined) {
      return { ok: false, diagnostic: failure! };
    }
  }
  return { ok: true, values, evaluationSteps };
}
