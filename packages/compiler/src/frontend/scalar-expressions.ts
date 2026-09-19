import { projectDiagnostic as error } from "../project/diagnostics.js";
import {
  adaptableLiteralType,
  applyExpectedScalar,
  commonIntegerType,
  convertInteger,
  createScalarTypedExpression,
  defaultIntegerType,
  evaluateBinaryInteger,
  evaluateUnaryInteger,
  fitsInteger,
  integerFacts,
  integerRangeMessage,
  isIntegerLiteralExpression,
  isIntegerType,
  isScalarType,
  scalarWarning,
  SCALAR_TYPES,
  wrapInteger,
} from "./constants.js";
import {
  AggregateRegistry,
  analyzeAggregateExpression,
  applyExpectedAggregate,
  diagnoseAggregateBinary,
  semanticTypeName,
} from "./aggregates.js";
import { analyzeScalarConditional } from "./conditional-expressions.js";
import { analyzeDirectCall } from "./direct-calls.js";
import { analyzeScalarAssignment } from "./scalar-assignments.js";
import {
  captureBranchFacts,
  mergeScalarFacts,
  restoreScalarFacts,
  snapshotScalarFacts,
} from "./flow-facts.js";
import type {
  Place,
  ScalarExpressionContext,
  ScalarExpressionHost,
  ScalarExpressionResult,
  SemanticType,
  TypedExpr,
} from "./semantic-types.js";
import type { Expr } from "./syntax.js";

/** Flatten a member-only callee into its exact module-qualified spelling. */
function qualifiedCallName(expression: Expr): string | null {
  if (expression.kind === "name") return expression.name;
  if (expression.kind !== "member") return null;
  const object = qualifiedCallName(expression.object);
  return object === null ? null : `${object}.${expression.member}`;
}

/** Direct recursive scalar expression checker. */
export class ScalarExpressionAnalyzer {
  /** Preserve the small module-analysis callbacks used during recursion. */
  constructor(
    readonly host: ScalarExpressionHost,
    readonly aggregates: AggregateRegistry,
  ) {}
  /** Analyze one expression and apply its surrounding scalar value context. */
  analyze(
    expression: Expr,
    expected: SemanticType | null,
    context: ScalarExpressionContext,
  ): ScalarExpressionResult {
    const natural = this.analyzeNatural(expression, expected, context);
    if (natural.node === null || expected === null) return natural;
    if (isScalarType(natural.node.type) && natural.node.type.name === "void") {
      this.host.diagnose(
        error("SEMANTIC_ERROR", "Void expression cannot be used as a value", expression.span),
      );
      return { node: null, exact: null };
    }
    return expected.kind === "scalar"
      ? applyExpectedScalar(natural, expected, expression, context, this.host)
      : applyExpectedAggregate(natural, expected, expression, this.host);
  }
  /** Analyze the expression's own operator-defined type before outer conversion. */
  private analyzeNatural(
    expression: Expr,
    expected: SemanticType | null,
    context: ScalarExpressionContext,
  ): ScalarExpressionResult {
    const aggregate = analyzeAggregateExpression(
      expression,
      expected,
      context,
      this.host,
      this.aggregates,
      (child, childType, childContext) => this.analyze(child, childType, childContext),
    );
    if (aggregate !== null) return aggregate;
    switch (expression.kind) {
      case "number":
        return this.number(expression, expected);
      case "boolean":
        return {
          node: createScalarTypedExpression(expression, SCALAR_TYPES.boolean, expression.value, {
            value: expression.value,
          }),
          exact: expression.value,
        };
      case "name":
        return this.name(expression, context, false);
      case "unary":
        return this.unary(expression, expected, context);
      case "binary":
        return this.binary(expression, expected, context);
      case "cast":
        return this.cast(expression, context);
      case "conditional":
        return analyzeScalarConditional(
          expression,
          context,
          this.host,
          (child, childExpected, childContext) => this.analyze(child, childExpected, childContext),
        );
      case "assignment":
        return analyzeScalarAssignment(
          expression,
          context,
          this.host,
          (child, childType, childContext) => this.analyze(child, childType, childContext),
        );
      case "call":
        return analyzeDirectCall(
          expression,
          context,
          this.host,
          (child, childType, childContext) => this.analyze(child, childType, childContext),
          (callee, callContext) => this.callTarget(callee, callContext),
        );
      default:
        this.host.defer(
          expression.span,
          "Expression is not implemented by the scalar frontend slice",
        );
        return { node: null, exact: null };
    }
  }
  /** Resolve an unqualified or module-qualified direct-call target. */
  private callTarget(
    expression: Expr,
    context: ScalarExpressionContext,
  ): ScalarExpressionResult | null {
    if (expression.kind === "name") return this.name(expression, context, true);
    if (expression.kind !== "member") return null;
    const name = qualifiedCallName(expression);
    if (name === null) return null;
    const root = name.split(".", 1)[0];
    if (root !== undefined && this.host.resolveName(root, context) !== null) return null;
    const state = this.host.resolveName(name, context);
    if (state === null || state.binding.type === null) return null;
    const moduleName = name.slice(0, -(state.binding.name.length + 1));
    return {
      node: createScalarTypedExpression(expression, state.binding.type, state.known, {
        member: state.binding.name,
        qualifiedModule: Object.freeze({
          name: moduleName,
          span: Object.freeze({ ...expression.object.span }),
        }),
        binding: state.binding.id,
        integer: integerFacts(state.binding.type, true),
      }),
      exact: state.known,
    };
  }
  /** Type a nonnegative parser literal, adapting it only when the value fits. */
  private number(
    expression: Extract<Expr, { readonly kind: "number" }>,
    expected: SemanticType | null,
  ): ScalarExpressionResult {
    const adapted =
      expected !== null && isIntegerType(expected) && fitsInteger(expected, expression.value)
        ? expected
        : defaultIntegerType(expression.value);
    if (expected !== null && isIntegerType(expected) && !fitsInteger(expected, expression.value)) {
      this.host.diagnose(
        error("E10084", integerRangeMessage(expected, expression.value), expression.span),
      );
      return { node: null, exact: expression.value };
    }
    if (adapted === null) {
      this.host.diagnose(
        error(
          "E10084",
          `Value ${expression.value} is outside every scalar integer range`,
          expression.span,
        ),
      );
      return { node: null, exact: expression.value };
    }
    return {
      node: createScalarTypedExpression(expression, adapted, expression.value, {
        value: expression.value,
        integer: integerFacts(adapted, false),
      }),
      exact: expression.value,
    };
  }
  /** Resolve a source name to its binding, place, and reaching value. */
  private name(
    expression: Extract<Expr, { readonly kind: "name" }>,
    context: ScalarExpressionContext,
    callTarget: boolean,
  ): ScalarExpressionResult {
    const state = this.host.resolveName(expression.name, context);
    if (state === null || state.binding.type === null) {
      const statementSpan = Object.freeze({ ...expression.span, end: expression.span.end + 1 });
      const provingSpan = this.host.sourceText(statementSpan).endsWith(";")
        ? statementSpan
        : expression.span;
      this.host.diagnose(
        error("E10239", `'${expression.name}' is not declared in this scope`, provingSpan),
      );
      return { node: null, exact: null };
    }
    if (state.binding.storage === "function" && !callTarget) {
      this.host.diagnose(
        error(
          "SEMANTIC_ERROR",
          `Function '${expression.name}' must be called or addressed with '&${expression.name}'`,
          expression.span,
        ),
      );
      return { node: null, exact: null };
    }
    if (context.constantContext && !callTarget && state.binding.storage !== "constant") {
      this.host.diagnose(
        error(
          "E10191",
          "Expression must be compile-time evaluable — runtime value is not constant",
          expression.span,
        ),
      );
      return { node: null, exact: null };
    }
    const place: Place | null =
      state.binding.storage === "function"
        ? null
        : Object.freeze({
            binding: state.binding.id,
            path: Object.freeze([]),
            readonly: state.readonly,
            readonlyOrigin: state.readonly
              ? state.binding.storage === "parameter"
                ? "parameter"
                : "constant"
              : null,
          });
    if (!callTarget && !context.placeContext && place !== null) {
      this.host.read(place, expression.span);
    }
    return {
      node: createScalarTypedExpression(expression, state.binding.type, state.known, {
        name: expression.name,
        binding: state.binding.id,
        place,
        integer: integerFacts(state.binding.type, true),
      }),
      exact: state.known,
    };
  }
  /** Check prefix operations, including contextual negative literal adaptation. */
  private unary(
    expression: Extract<Expr, { readonly kind: "unary" }>,
    expected: SemanticType | null,
    context: ScalarExpressionContext,
  ): ScalarExpressionResult {
    if (expression.operator === "&") {
      this.host.defer(expression.span, "Address-of remains for later semantic analysis");
      return { node: null, exact: null };
    }
    if (expression.operator === "!") {
      const operand = this.analyze(expression.operand, null, context);
      if (operand.node === null) return { node: null, exact: null };
      if (!isScalarType(operand.node.type) || operand.node.type.name !== "boolean") {
        this.host.diagnose(
          error("E10151", "Cannot use an integer as a logical operand", expression.span),
        );
        return { node: null, exact: null };
      }
      const constant = typeof operand.node.constant === "boolean" ? !operand.node.constant : null;
      return {
        node: createScalarTypedExpression(expression, SCALAR_TYPES.boolean, constant, {
          operator: expression.operator,
          operand: operand.node,
        }),
        exact: constant,
      };
    }
    if (expression.operator === "-" && expression.operand.kind === "number") {
      const exact = -expression.operand.value;
      if (expected !== null && isIntegerType(expected) && !fitsInteger(expected, exact)) {
        this.host.diagnose(error("E10084", integerRangeMessage(expected, exact), expression.span));
        return { node: null, exact };
      }
      const target =
        expected !== null && isIntegerType(expected) && fitsInteger(expected, exact)
          ? expected
          : context.ordinalContext
            ? SCALAR_TYPES.sword
            : defaultIntegerType(exact);
      if (target !== null && integerFacts(target, false)?.signed) {
        const operand = this.number(expression.operand, null).node;
        return {
          node: createScalarTypedExpression(expression, target, exact, {
            operator: expression.operator,
            ...(operand === null ? {} : { operand }),
            integer: integerFacts(target, !context.constantContext),
          }),
          exact,
        };
      }
    }
    let operand = this.analyze(expression.operand, null, context);
    if (operand.node === null) return { node: null, exact: null };
    if (isScalarType(operand.node.type) && operand.node.type.name === "void") {
      this.host.diagnose(
        error("SEMANTIC_ERROR", "Void expression cannot be used as a value", expression.span),
      );
      return { node: null, exact: null };
    }
    if (!isIntegerType(operand.node.type)) {
      this.host.diagnose(
        error(
          "E10151",
          "Cannot use 'boolean' in an arithmetic or bitwise expression",
          expression.span,
        ),
      );
      return { node: null, exact: null };
    }
    const operandFacts = integerFacts(operand.node.type, false)!;
    if (context.ordinalContext && operandFacts.width === 8) {
      const promoted = operandFacts.signed ? SCALAR_TYPES.sword : SCALAR_TYPES.word;
      operand = applyExpectedScalar(operand, promoted, expression.operand, context, this.host);
      if (operand.node === null) return { node: null, exact: null };
    }
    const facts = integerFacts(operand.node.type, !context.constantContext)!;
    if (expression.operator === "-" && !facts.signed) {
      this.host.diagnose(
        error(
          "E10083",
          `Cannot negate unsigned type '${semanticTypeName(operand.node.type)}' — use 'sbyte' or 'sword' for signed arithmetic`,
          expression.span,
        ),
      );
      return { node: null, exact: null };
    }
    const operandValue = context.constantContext ? operand.exact : operand.node.constant;
    const exact =
      typeof operandValue === "bigint"
        ? evaluateUnaryInteger(expression.operator, operandValue)
        : null;
    const constant =
      exact === null || context.constantContext ? exact : wrapInteger(exact, operand.node.type);
    return {
      node: createScalarTypedExpression(expression, operand.node.type, constant, {
        operator: expression.operator,
        operand: operand.node,
        integer: facts,
      }),
      exact,
    };
  }
  /** Check scalar binary types, exact constants, runtime width, and evaluation mode. */
  private binary(
    expression: Extract<Expr, { readonly kind: "binary" }>,
    expected: SemanticType | null,
    context: ScalarExpressionContext,
  ): ScalarExpressionResult {
    const shift = expression.operator === "<<" || expression.operator === ">>";
    const logical = expression.operator === "&&" || expression.operator === "||";
    let left = this.analyze(expression.left, null, context);
    const logicalBaseline =
      logical && left.node !== null ? snapshotScalarFacts(context.scope) : null;
    let right = this.analyze(
      expression.right,
      shift ? null : adaptableLiteralType(expression.right, left.node?.type ?? null),
      context,
    );
    const logicalRightFacts = logicalBaseline === null ? null : captureBranchFacts(logicalBaseline);
    if (!shift && isIntegerLiteralExpression(expression.left) && right.node !== null) {
      left = this.analyze(expression.left, right.node.type, context);
    }
    if (left.node === null || right.node === null) {
      if (logicalBaseline !== null) restoreScalarFacts(logicalBaseline);
      return { node: null, exact: null };
    }
    if (
      (isScalarType(left.node.type) && left.node.type.name === "void") ||
      (isScalarType(right.node.type) && right.node.type.name === "void")
    ) {
      if (logicalBaseline !== null) restoreScalarFacts(logicalBaseline);
      this.host.diagnose(
        error("SEMANTIC_ERROR", "Void expression cannot be used as a value", expression.span),
      );
      return { node: null, exact: null };
    }
    const equality = expression.operator === "==" || expression.operator === "!=";
    const ordered = ["<", "<=", ">", ">="].includes(expression.operator);
    if (diagnoseAggregateBinary(expression, left.node, right.node, this.host)) {
      if (logicalBaseline !== null) restoreScalarFacts(logicalBaseline);
      return { node: null, exact: null };
    }
    if (!isScalarType(left.node.type) || !isScalarType(right.node.type)) {
      return { node: null, exact: null };
    }
    if (logical) {
      const result = this.logicalBinary(expression, left, right);
      if (logicalBaseline !== null && logicalRightFacts !== null) {
        const rightExecutes = left.node.constant === (expression.operator === "&&");
        const rightSkipped = left.node.constant === (expression.operator === "||");
        if (rightExecutes) restoreScalarFacts(logicalRightFacts);
        else if (rightSkipped) restoreScalarFacts(logicalBaseline);
        else mergeScalarFacts(logicalBaseline, [logicalBaseline, logicalRightFacts]);
      }
      return result;
    }
    if (left.node.type.name === "boolean" || right.node.type.name === "boolean") {
      if (ordered && left.node.type.name === "boolean" && right.node.type.name === "boolean") {
        this.host.diagnose(
          error(
            "E10154",
            `Cannot apply '${expression.operator}' to 'boolean' — ordered comparisons are not valid for boolean operands`,
            expression.span,
          ),
        );
      } else if (!equality || left.node.type.name !== right.node.type.name) {
        this.host.diagnose(
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
        return this.binaryNode(
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
      this.host.diagnose(
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
      this.host.diagnose(
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
      left = applyExpectedScalar(left, ordinalType, expression.left, context, this.host);
      if (!shift) {
        right = applyExpectedScalar(right, ordinalType, expression.right, context, this.host);
      }
      if (left.node === null || right.node === null) return { node: null, exact: null };
    } else if (!shift) {
      const resultType = naturalResultType;
      left = applyExpectedScalar(left, resultType, expression.left, context, this.host);
      right = applyExpectedScalar(right, resultType, expression.right, context, this.host);
      if (left.node === null || right.node === null) return { node: null, exact: null };
    }
    if (
      (expression.operator === "/" || expression.operator === "%") &&
      context.constantContext &&
      right.node.constant === 0n
    ) {
      this.host.diagnose(
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
      this.host.diagnose(
        scalarWarning(
          "W10174",
          `Shift amount ${right.node.constant} is at least the ${operationFacts.width}-bit width — '<<' yields 0; signed negative '>>' yields -1, otherwise '>>' yields 0`,
          expression.span,
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
      this.host.diagnose(
        scalarWarning(
          "W10100",
          `Signed runtime expression '${this.host.sourceText(expression.span)}' is known to overflow at '${semanticTypeName(type)}' width and wraps to ${constant}`,
          expression.span,
        ),
      );
    }
    return this.binaryNode(
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
  private binaryNode(
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
  private logicalBinary(
    expression: Extract<Expr, { readonly kind: "binary" }>,
    left: ScalarExpressionResult,
    right: ScalarExpressionResult,
  ): ScalarExpressionResult {
    if (
      left.node === null ||
      right.node === null ||
      !isScalarType(left.node.type) ||
      !isScalarType(right.node.type) ||
      left.node.type.name !== "boolean" ||
      right.node.type.name !== "boolean"
    ) {
      this.host.diagnose(
        error("E10151", "Cannot use an integer as a logical operand", expression.span),
      );
      return { node: null, exact: null };
    }
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
  /** Check an explicit integer cast and retain its exact conversion. */
  private cast(
    expression: Extract<Expr, { readonly kind: "cast" }>,
    context: ScalarExpressionContext,
  ): ScalarExpressionResult {
    const destination = this.host.resolveType(expression.type, context);
    const operand = this.analyze(expression.operand, null, { ...context, ordinalContext: false });
    if (destination === null || operand.node === null) return { node: null, exact: null };
    if (!isScalarType(destination) || !isScalarType(operand.node.type)) {
      this.host.diagnose(
        error(
          "E10086",
          `Cannot cast '${semanticTypeName(operand.node.type)}' to '${semanticTypeName(destination)}'`,
          expression.span,
        ),
      );
      return { node: null, exact: null };
    }
    if (destination.name === "void" || operand.node.type.name === "void") {
      this.host.diagnose(error("E10152", "Cannot cast to or from 'void'", expression.span));
      return { node: null, exact: null };
    }
    if (destination.name === "boolean" || operand.node.type.name === "boolean") {
      this.host.diagnose(
        error(
          "E10086",
          `Cannot cast '${operand.node.type.name}' to '${destination.name}' — boolean is not convertible to or from an integer`,
          expression.span,
        ),
      );
      return { node: null, exact: null };
    }
    const conversion =
      typeof operand.node.constant === "bigint"
        ? convertInteger(operand.node.constant, operand.node.type, destination)
        : convertInteger(0n, operand.node.type, destination);
    if (
      conversion.conversion === "truncate" &&
      conversion.losesValue &&
      typeof operand.node.constant === "bigint"
    ) {
      this.host.diagnose(
        scalarWarning(
          "W10101",
          `Narrowing cast from '${operand.node.type.name}' to '${destination.name}' truncates ${operand.node.constant} to ${conversion.value}`,
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
}
