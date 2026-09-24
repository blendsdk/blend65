import { projectDiagnostic } from "../project/diagnostics.js";
import {
  adaptableLiteralType,
  applyExpectedScalar,
  compoundOperationType,
  createScalarTypedExpression,
  evaluateBinaryInteger,
  integerFacts,
  isCompileTimeConstantExpression,
  scalarWarning,
  wrapInteger,
} from "./constants.js";
import { COMPOUND_ASSIGNMENT_EVALUATION, SIMPLE_ASSIGNMENT_EVALUATION } from "./semantic-types.js";
import { semanticTypeName } from "./aggregates.js";
import { initializedPlaceKey } from "./aggregate-initialization.js";
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

  const target = analyze(expression.target, null, {
    ...context,
    placeContext: true,
    ordinalContext: false,
  });
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
    const parameterRoot =
      target.node.place.path.length === 0 && target.node.place.readonlyOrigin === "parameter";
    host.diagnose(
      projectDiagnostic(
        parameterRoot || target.node.place.path.length > 0 ? "E10123" : "E10192",
        parameterRoot || target.node.place.path.length > 0
          ? "Cannot mutate through a const aggregate parameter or binding"
          : target.node.place.path.length === 0
            ? `Cannot assign to const '${target.node.name ?? "value"}'`
            : "Cannot mutate through a const aggregate parameter or binding",
        expression.target.span,
      ),
    );
    return { node: null, exact: null };
  }

  let value: ScalarExpressionResult;
  let resultConstant: bigint | boolean | null;
  if (expression.operator === "=") {
    value = analyze(expression.value, target.node.type, {
      ...context,
      ordinalContext: false,
    });
    if (target.node.type.kind !== "scalar" && target.node.type.kind !== "enum") {
      if (value.node !== null) {
        host.defer(expression.span, "Whole aggregate assignment and copy lowering remain pending");
      }
      return { node: null, exact: null };
    }
    resultConstant = value.node?.constant ?? null;
  } else {
    host.read(target.node.place, expression.target.span);
    const operator = expression.operator.slice(0, -1);
    const shift = operator === "<<" || operator === ">>";
    value = analyze(
      expression.value,
      shift ? null : adaptableLiteralType(expression.value, target.node.type),
      { ...context, ordinalContext: false },
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

    if (
      (operator === "/" || operator === "%") &&
      value.node.constant === 0n &&
      isCompileTimeConstantExpression(expression.value, context, host)
    ) {
      host.diagnose(
        projectDiagnostic("E10160", "Division by zero in constant expression", expression.span),
      );
      return { node: null, exact: null };
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
          `Signed runtime expression '${host.sourceText(expression.span)}' is known to overflow at '${semanticTypeName(target.node.type)}' width and wraps to ${resultConstant}`,
          expression.span,
        ),
      );
    }
  }

  if (value.node === null) return { node: null, exact: null };
  const state = stateForPlace(target.node.place, context.scope);
  if (state !== null) {
    state.known = target.node.place.path.length === 0 ? resultConstant : null;
    if (target.node.place.path.length === 0) state.conditionalEffect = null;
    markPlaceInitialized(state, target.node.place);
  }
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

/** Extend definite-initialization facts for the exact place written by an assignment. */
function markPlaceInitialized(state: ScalarValueState, place: Place): void {
  if (place.path.length === 0) {
    state.initialized = true;
    state.initializedRanges =
      state.binding.type?.kind === "array"
        ? Object.freeze([{ start: 0, end: state.binding.type.length }])
        : Object.freeze([]);
    state.initializedPaths = Object.freeze([]);
    return;
  }
  const key = initializedPlaceKey(place);
  if (key !== null && !state.initializedPaths.includes(key)) {
    state.initializedPaths = Object.freeze([...state.initializedPaths, key]);
  }
  const rootType = state.binding.type;
  if (rootType?.kind === "struct") {
    const complete = rootType.fields.every(({ name }) =>
      state.initializedPaths.includes(`.${name}`),
    );
    if (complete) state.initialized = true;
    return;
  }
  if (rootType?.kind !== "array") return;
  const first = place.path[0];
  const constant = typeof first === "string" ? null : first.constant;
  if (place.path.length === 1) {
    markArrayIndexInitialized(state, rootType, constant);
    return;
  }
  if (rootType.element.kind !== "struct" || typeof constant !== "bigint") return;
  const prefix = `[${constant}]`;
  const complete = rootType.element.fields.every(({ name }) =>
    state.initializedPaths.includes(`${prefix}.${name}`),
  );
  if (complete) markArrayIndexInitialized(state, rootType, constant);
}

/** Add one known array element to the normalized definite-initialization ranges. */
function markArrayIndexInitialized(
  state: ScalarValueState,
  arrayType: Extract<SemanticType, { readonly kind: "array" }>,
  constant: bigint | boolean | null,
): void {
  if (typeof constant !== "bigint" || constant < 0n || constant > BigInt(Number.MAX_SAFE_INTEGER)) {
    return;
  }
  const index = Number(constant);
  const covered = [...state.initializedRanges, { start: index, end: index + 1 }].sort(
    (left, right) => left.start - right.start,
  );
  const merged: { start: number; end: number }[] = [];
  for (const range of covered) {
    const last = merged.at(-1);
    if (last !== undefined && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  state.initializedRanges = Object.freeze(merged.map((range) => Object.freeze(range)));
  state.initialized = state.initializedRanges.some(
    ({ start, end }) => start === 0 && end >= arrayType.length,
  );
}
