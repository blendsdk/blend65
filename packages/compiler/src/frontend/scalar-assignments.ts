import { projectDiagnostic } from "../project/diagnostics.js";
import {
  adaptableLiteralType,
  applyExpectedScalar,
  compoundOperationType,
  createScalarTypedExpression,
  evaluateBinaryInteger,
  integerFacts,
  scalarWarning,
  wrapInteger,
} from "./constants.js";
import { COMPOUND_ASSIGNMENT_EVALUATION, SIMPLE_ASSIGNMENT_EVALUATION } from "./semantic-types.js";
import type {
  Place,
  ScalarExpressionContext,
  ScalarExpressionHost,
  ScalarExpressionResult,
  ScalarScope,
  ScalarValueState,
  SemanticType,
} from "./semantic-types.js";
import type { Expr } from "./syntax.js";

/** Recursive expression callback supplied by the owning scalar analyzer. */
export type AnalyzeScalarExpression = (
  expression: Expr,
  expected: SemanticType | null,
  context: ScalarExpressionContext,
) => ScalarExpressionResult;

/** Find the mutable reaching state for a symbolic place root. */
function stateForPlace(place: Place, scope: ScalarScope): ScalarValueState | null {
  for (let current: ScalarScope | null = scope; current !== null; current = current.parent) {
    for (const state of current.values.values()) {
      if (
        state.binding.id.sourceId === place.binding.sourceId &&
        state.binding.id.span.start === place.binding.span.start &&
        state.binding.id.span.end === place.binding.span.end
      ) {
        return state;
      }
    }
  }
  return null;
}

/**
 * Check a simple or compound assignment while preserving one target evaluation,
 * one store, the written result, and conservative reaching-value facts.
 */
export function analyzeScalarAssignment(
  expression: Extract<Expr, { readonly kind: "assignment" }>,
  context: ScalarExpressionContext,
  host: ScalarExpressionHost,
  analyze: AnalyzeScalarExpression,
): ScalarExpressionResult {
  if (context.constantContext) {
    host.diagnose(
      projectDiagnostic(
        "E10191",
        "Expression must be compile-time evaluable — assignment is not allowed in a constant expression",
        expression.span,
      ),
    );
    return { node: null, exact: null };
  }

  const target = analyze(expression.target, null, context);
  if (target.node === null) return { node: null, exact: null };
  if (target.node.place === null) {
    host.diagnose(
      projectDiagnostic(
        "SEMANTIC_ERROR",
        "Assignment target is not writable storage",
        expression.target.span,
      ),
    );
    return { node: null, exact: null };
  }
  if (target.node.place.readonly) {
    host.diagnose(
      projectDiagnostic(
        "E10192",
        `Cannot assign to const '${target.node.name ?? "value"}'`,
        expression.target.span,
      ),
    );
    return { node: null, exact: null };
  }

  let value: ScalarExpressionResult;
  let resultConstant: bigint | boolean | null;
  if (expression.operator === "=") {
    value = analyze(expression.value, target.node.type, context);
    resultConstant = value.node?.constant ?? null;
  } else {
    const operator = expression.operator.slice(0, -1);
    const shift = operator === "<<" || operator === ">>";
    value = analyze(
      expression.value,
      shift ? null : adaptableLiteralType(expression.value, target.node.type),
      context,
    );
    if (value.node === null) return { node: null, exact: null };
    const operationType = compoundOperationType(
      target.node.type,
      value.node.type,
      operator,
      expression,
      host,
    );
    if (operationType === null) return { node: null, exact: null };
    if (!shift) {
      value = applyExpectedScalar(value, operationType, expression.value, context, host);
      if (value.node === null) return { node: null, exact: null };
    }

    const targetValue = target.node.constant;
    const operandValue = value.node.constant;
    const exact =
      typeof targetValue === "bigint" && typeof operandValue === "bigint"
        ? evaluateBinaryInteger(operator, targetValue, operandValue, operationType)
        : null;
    resultConstant = typeof exact === "bigint" ? wrapInteger(exact, target.node.type) : exact;
    const targetFacts = integerFacts(target.node.type, false)!;
    if (
      shift &&
      typeof value.node.constant === "bigint" &&
      value.node.constant >= BigInt(targetFacts.width)
    ) {
      host.diagnose(
        scalarWarning(
          "W10174",
          `Shift amount ${value.node.constant} is at least the ${targetFacts.width}-bit width — '<<' yields 0; signed negative '>>' yields -1, otherwise '>>' yields 0`,
          expression.span,
        ),
      );
    }
    if (
      targetFacts.signed &&
      typeof exact === "bigint" &&
      typeof resultConstant === "bigint" &&
      exact !== resultConstant
    ) {
      host.diagnose(
        scalarWarning(
          "W10100",
          `Signed runtime expression '${host.sourceText(expression.span)}' is known to overflow at '${target.node.type.name}' width and wraps to ${resultConstant}`,
          expression.span,
        ),
      );
    }
  }

  if (value.node === null) return { node: null, exact: null };
  const state = stateForPlace(target.node.place, context.scope);
  if (state !== null) state.known = resultConstant;
  const compound = expression.operator !== "=";
  return {
    node: createScalarTypedExpression(expression, target.node.type, resultConstant, {
      operator: expression.operator,
      target: target.node,
      value: value.node,
      place: target.node.place,
      evaluation: compound ? COMPOUND_ASSIGNMENT_EVALUATION : SIMPLE_ASSIGNMENT_EVALUATION,
      integer: integerFacts(target.node.type, true),
    }),
    exact: resultConstant,
  };
}
