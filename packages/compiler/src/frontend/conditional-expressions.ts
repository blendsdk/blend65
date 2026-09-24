import { projectDiagnostic } from "../project/diagnostics.js";
import {
  applyExpectedScalar,
  commonScalarType,
  createScalarTypedExpression,
  integerFacts,
  isScalarType,
} from "./constants.js";
import { semanticTypeName, semanticTypesEqual } from "./aggregates.js";
import {
  captureBranchFacts,
  mergeScalarFacts,
  restoreScalarFacts,
  snapshotScalarFacts,
} from "./flow-facts.js";
import type {
  ScalarExpressionContext,
  ScalarExpressionHost,
  ScalarExpressionResult,
  SemanticType,
} from "./semantic-types.js";
import type { Expr } from "./syntax.js";

/** Recursive expression callback used to analyze each selected arm exactly once. */
export type AnalyzeConditionalChild = (
  expression: Expr,
  expected: SemanticType | null,
  context: ScalarExpressionContext,
) => ScalarExpressionResult;

/** Check a selected-arm conditional and merge only facts common to both paths. */
export function analyzeScalarConditional(
  expression: Extract<Expr, { readonly kind: "conditional" }>,
  context: ScalarExpressionContext,
  host: ScalarExpressionHost,
  analyze: AnalyzeConditionalChild,
): ScalarExpressionResult {
  const condition = analyze(expression.condition, null, context);
  const baseline = snapshotScalarFacts(context.scope);
  let whenTrue = analyze(expression.whenTrue, null, context);
  const trueFacts = captureBranchFacts(baseline);
  restoreScalarFacts(baseline);
  let whenFalse = analyze(expression.whenFalse, null, context);
  const falseFacts = captureBranchFacts(baseline);
  if (condition.node?.constant === true) restoreScalarFacts(trueFacts);
  else if (condition.node?.constant === false) restoreScalarFacts(falseFacts);
  else mergeScalarFacts(baseline, [trueFacts, falseFacts]);
  if (condition.node === null || whenTrue.node === null || whenFalse.node === null) {
    return { node: null, exact: null };
  }
  if (
    (isScalarType(whenTrue.node.type) && whenTrue.node.type.name === "void") ||
    (isScalarType(whenFalse.node.type) && whenFalse.node.type.name === "void")
  ) {
    host.diagnose(
      projectDiagnostic(
        "SEMANTIC_ERROR",
        "Void expression cannot be used as a value",
        expression.span,
      ),
    );
    return { node: null, exact: null };
  }
  if (!isScalarType(condition.node.type) || condition.node.type.name !== "boolean") {
    host.diagnose(
      projectDiagnostic(
        "E10100",
        `Condition must have type 'boolean' — found '${semanticTypeName(condition.node.type)}'; use an explicit comparison`,
        expression.condition.span,
      ),
    );
  }
  const sameEnum =
    whenTrue.node.type.kind === "enum" &&
    whenFalse.node.type.kind === "enum" &&
    semanticTypesEqual(whenTrue.node.type, whenFalse.node.type);
  if (!sameEnum && (!isScalarType(whenTrue.node.type) || !isScalarType(whenFalse.node.type))) {
    if (semanticTypesEqual(whenTrue.node.type, whenFalse.node.type)) {
      host.defer(expression.span, "Aggregate conditional copy lowering remains pending");
      return { node: null, exact: null };
    }
    host.diagnose(
      projectDiagnostic(
        "E10162",
        `Conditional arms have incompatible types '${semanticTypeName(whenTrue.node.type)}' and '${semanticTypeName(whenFalse.node.type)}'`,
        expression.span,
      ),
    );
    return { node: null, exact: null };
  }
  const resultType = sameEnum
    ? whenTrue.node.type
    : commonScalarType(whenTrue.node.type, whenFalse.node.type);
  if (resultType === null) {
    host.diagnose(
      projectDiagnostic(
        "E10162",
        `Conditional arms have incompatible types '${semanticTypeName(whenTrue.node.type)}' and '${semanticTypeName(whenFalse.node.type)}'`,
        expression.span,
      ),
    );
    return { node: null, exact: null };
  }
  if (!sameEnum) {
    whenTrue = applyExpectedScalar(whenTrue, resultType, expression.whenTrue, context, host);
    whenFalse = applyExpectedScalar(whenFalse, resultType, expression.whenFalse, context, host);
  }
  if (whenTrue.node === null || whenFalse.node === null) return { node: null, exact: null };
  const constant =
    typeof condition.node.constant === "boolean"
      ? condition.node.constant
        ? whenTrue.node.constant
        : whenFalse.node.constant
      : null;
  return {
    node: createScalarTypedExpression(expression, resultType, constant, {
      condition: condition.node,
      whenTrue: whenTrue.node,
      whenFalse: whenFalse.node,
      evaluation: "selected-arm",
      integer: integerFacts(resultType, true),
    }),
    exact: constant,
  };
}
