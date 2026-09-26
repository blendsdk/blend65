import { projectDiagnostic as error } from "../project/diagnostics.js";
import {
  adaptableLiteralType,
  applyExpectedScalar,
  commonIntegerType,
  createScalarTypedExpression,
  evaluateBinaryInteger,
  integerFacts,
  isCompileTimeConstantExpression,
  isIntegerLiteralExpression,
  isScalarType,
  scalarWarning,
  SCALAR_TYPES,
  wrapInteger,
} from "./constants.js";
import { diagnoseAggregateBinary, semanticTypeName, semanticTypesEqual } from "./aggregates.js";
import {
  captureBranchFacts,
  mergeScalarFacts,
  restoreScalarFacts,
  snapshotScalarFacts,
} from "./flow-facts.js";
import type {
  ScalarExpressionContext,
  ScalarExpressionResult,
  SemanticType,
  TypedExpr,
} from "./semantic-types.js";
import type { Expr } from "./syntax.js";

import type { ScalarExpressionAnalyzer } from "./scalar-expressions.js";

/** Check scalar binary types, exact constants, runtime width, and evaluation mode. */
export function analyzeScalarBinary(
  analyzer: ScalarExpressionAnalyzer,
  expression: Extract<Expr, { readonly kind: "binary" }>,
  expected: SemanticType | null,
  context: ScalarExpressionContext,
): ScalarExpressionResult {
  const shift = expression.operator === "<<" || expression.operator === ">>";
  const logical = expression.operator === "&&" || expression.operator === "||";
  let left = analyzer.analyze(expression.left, null, context);
  const logicalBaseline = logical && left.node !== null ? snapshotScalarFacts(context.scope) : null;
  let right = analyzer.analyze(
    expression.right,
    shift ? null : adaptableLiteralType(expression.right, left.node?.type ?? null),
    context,
  );
  const logicalRightFacts = logicalBaseline === null ? null : captureBranchFacts(logicalBaseline);
  if (!shift && isIntegerLiteralExpression(expression.left) && right.node !== null) {
    left = analyzer.analyze(expression.left, right.node.type, context);
  }
  if (left.node === null || right.node === null) {
    if (logicalBaseline !== null) restoreScalarFacts(logicalBaseline);
    return { node: null, exact: null };
  }
  // Logical operands are checked before enum coercion or aggregate operator diagnostics.
  // Each rejected operand keeps its original source type and its own proving span.
  if (logical) {
    const result = logicalBinary(analyzer, expression, left, right);
    if (logicalBaseline !== null && logicalRightFacts !== null) {
      const rightExecutes = left.node.constant === (expression.operator === "&&");
      const rightSkipped = left.node.constant === (expression.operator === "||");
      if (rightExecutes) restoreScalarFacts(logicalRightFacts);
      else if (rightSkipped) restoreScalarFacts(logicalBaseline);
      else mergeScalarFacts(logicalBaseline, [logicalBaseline, logicalRightFacts]);
    }
    return result;
  }
  if (
    (isScalarType(left.node.type) && left.node.type.name === "void") ||
    (isScalarType(right.node.type) && right.node.type.name === "void")
  ) {
    if (logicalBaseline !== null) restoreScalarFacts(logicalBaseline);
    analyzer.host.diagnose(
      error("SEMANTIC_ERROR", "Void expression cannot be used as a value", expression.span),
    );
    return { node: null, exact: null };
  }
  const equality = expression.operator === "==" || expression.operator === "!=";
  const ordered = ["<", "<=", ">", ">="].includes(expression.operator);
  if (left.node.type.kind === "enum" && right.node.type.kind === "enum") {
    if ((equality || ordered) && !semanticTypesEqual(left.node.type, right.node.type)) {
      analyzer.host.diagnose(
        error(
          "E10236",
          `Cannot compare enum '${left.node.type.name}' with enum '${right.node.type.name}' — cast one to 'byte'`,
          expression.span,
        ),
      );
      return { node: null, exact: null };
    }
  }
  if (left.node.type.kind === "enum") {
    left = applyExpectedScalar(left, SCALAR_TYPES.byte, expression.left, context, analyzer.host);
  }
  if (right.node.type.kind === "enum") {
    right = applyExpectedScalar(right, SCALAR_TYPES.byte, expression.right, context, analyzer.host);
  }
  if (left.node === null || right.node === null) return { node: null, exact: null };
  if (diagnoseAggregateBinary(expression, left.node, right.node, analyzer.host)) {
    if (logicalBaseline !== null) restoreScalarFacts(logicalBaseline);
    return { node: null, exact: null };
  }
  if (!isScalarType(left.node.type) || !isScalarType(right.node.type)) {
    return { node: null, exact: null };
  }
  if (left.node.type.name === "boolean" || right.node.type.name === "boolean") {
    if (ordered && left.node.type.name === "boolean" && right.node.type.name === "boolean") {
      analyzer.host.diagnose(
        error(
          "E10154",
          `Cannot apply '${expression.operator}' to 'boolean' — ordered comparisons are not valid for boolean operands`,
          expression.span,
        ),
      );
    } else if (!equality || left.node.type.name !== right.node.type.name) {
      analyzer.host.diagnose(
        error(
          "E10151",
          "Cannot use 'boolean' in an arithmetic or bitwise expression",
          expression.span,
        ),
      );
    } else {
      const constant =
        typeof left.exact === "boolean" && typeof right.exact === "boolean"
          ? expression.operator === "=="
            ? left.exact === right.exact
            : left.exact !== right.exact
          : null;
      return binaryNode(
        expression,
        left.node,
        right.node,
        SCALAR_TYPES.boolean,
        constant,
        constant,
        false,
      );
    }
    return { node: null, exact: null };
  }
  const leftFacts = integerFacts(left.node.type, false)!;
  const rightFacts = integerFacts(right.node.type, false)!;
  if (shift && rightFacts.signed) {
    analyzer.host.diagnose(
      error(
        "E10161",
        `Shift amount must have unsigned type 'byte' or 'word' — found '${right.node.type.name}'`,
        expression.right.span,
      ),
    );
    return { node: null, exact: null };
  }
  if (!shift && leftFacts.signed !== rightFacts.signed) {
    const signed = leftFacts.signed ? left.node.type.name : right.node.type.name;
    const unsigned = leftFacts.signed ? right.node.type.name : left.node.type.name;
    analyzer.host.diagnose(
      error(
        "E10081",
        `Cannot mix signed type '${signed}' with unsigned type '${unsigned}' — cast one operand`,
        expression.span,
      ),
    );
    return { node: null, exact: null };
  }
  const naturalResultType = commonIntegerType(left.node.type, right.node.type)!;
  const ordinalType = context.ordinalContext
    ? integerFacts(naturalResultType, false)?.signed
      ? SCALAR_TYPES.sword
      : SCALAR_TYPES.word
    : null;
  const operationType = ordinalType ?? (shift ? left.node.type : naturalResultType);
  if (ordinalType !== null) {
    left = applyExpectedScalar(left, ordinalType, expression.left, context, analyzer.host);
    if (!shift) {
      right = applyExpectedScalar(right, ordinalType, expression.right, context, analyzer.host);
    }
    if (left.node === null || right.node === null) return { node: null, exact: null };
  } else if (!shift) {
    const resultType = naturalResultType;
    left = applyExpectedScalar(left, resultType, expression.left, context, analyzer.host);
    right = applyExpectedScalar(right, resultType, expression.right, context, analyzer.host);
    if (left.node === null || right.node === null) return { node: null, exact: null };
  }
  if (
    (expression.operator === "/" || expression.operator === "%") &&
    right.node.constant === 0n &&
    isCompileTimeConstantExpression(expression.right, context, analyzer.host)
  ) {
    analyzer.host.diagnose(
      error("E10160", "Division by zero in constant expression", expression.span),
    );
    return { node: null, exact: null };
  }
  const leftValue = context.constantContext ? left.exact : left.node.constant;
  const rightValue = context.constantContext ? right.exact : right.node.constant;
  const exact =
    typeof leftValue === "bigint" && typeof rightValue === "bigint"
      ? evaluateBinaryInteger(expression.operator, leftValue, rightValue, operationType)
      : null;
  const resultIsBoolean = equality || ordered;
  const type = resultIsBoolean ? SCALAR_TYPES.boolean : operationType;
  const operationFacts = integerFacts(operationType, false)!;
  const constant =
    typeof exact !== "bigint" || context.constantContext || resultIsBoolean
      ? exact
      : wrapInteger(exact, type);
  if (
    shift &&
    typeof right.node.constant === "bigint" &&
    right.node.constant >= BigInt(operationFacts.width)
  ) {
    analyzer.host.diagnose(
      scalarWarning(
        "W10174",
        `Shift amount ${right.node.constant} is at least the ${operationFacts.width}-bit width — '<<' yields 0; signed negative '>>' yields -1, otherwise '>>' yields 0`,
        expression.right.span,
      ),
    );
  }
  const expectedFacts = expected === null ? null : integerFacts(expected, false);
  if (
    !context.constantContext &&
    !resultIsBoolean &&
    integerFacts(type, false)?.signed &&
    typeof exact === "bigint" &&
    typeof constant === "bigint" &&
    exact !== constant &&
    (expectedFacts === null || expectedFacts.width <= integerFacts(type, false)!.width)
  ) {
    analyzer.host.diagnose(
      scalarWarning(
        "W10100",
        `Signed runtime expression '${analyzer.host.sourceText(expression.span)}' is known to overflow at '${semanticTypeName(type)}' width and wraps to ${constant}`,
        expression.span,
      ),
    );
  }
  return binaryNode(
    expression,
    left.node,
    right.node,
    type,
    constant,
    exact,
    !context.constantContext,
  );
}
/** Build a typed ordinary binary expression. */
function binaryNode(
  expression: Extract<Expr, { readonly kind: "binary" }>,
  left: TypedExpr,
  right: TypedExpr,
  type: SemanticType,
  constant: bigint | boolean | null,
  exact: bigint | boolean | null,
  wraps: boolean,
): ScalarExpressionResult {
  return {
    node: createScalarTypedExpression(expression, type, constant, {
      operator: expression.operator,
      left,
      right,
      evaluation: "left-to-right",
      integer: integerFacts(type, wraps),
    }),
    exact,
  };
}
/** Check Boolean logical operands and expose short-circuit structure. */
function logicalBinary(
  analyzer: ScalarExpressionAnalyzer,
  expression: Extract<Expr, { readonly kind: "binary" }>,
  left: ScalarExpressionResult,
  right: ScalarExpressionResult,
): ScalarExpressionResult {
  if (left.node === null || right.node === null) return { node: null, exact: null };
  let valid = true;
  for (const operand of [left.node, right.node]) {
    if (isScalarType(operand.type) && operand.type.name === "boolean") continue;
    valid = false;
    analyzer.host.diagnose(
      error(
        "E10280",
        `Logical operator '${expression.operator}' requires Boolean operands — found '${semanticTypeName(operand.type)}'`,
        operand.span,
      ),
    );
  }
  if (!valid) return { node: null, exact: null };
  const constant =
    typeof left.exact === "boolean" && typeof right.exact === "boolean"
      ? expression.operator === "&&"
        ? left.exact && right.exact
        : left.exact || right.exact
      : null;
  return {
    node: createScalarTypedExpression(expression, SCALAR_TYPES.boolean, constant, {
      operator: expression.operator,
      left: left.node,
      right: right.node,
      evaluation: "short-circuit",
    }),
    exact: constant,
  };
}
