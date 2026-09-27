import { projectDiagnostic as error } from "../project/diagnostics.js";
import {
  applyExpectedScalar,
  createScalarTypedExpression,
  defaultIntegerType,
  evaluateUnaryInteger,
  fitsInteger,
  integerFacts,
  integerRangeMessage,
  isIntegerType,
  isScalarType,
  SCALAR_TYPES,
  wrapInteger,
} from "./constants.js";
import { semanticTypeName } from "./semantic-type-relations.js";
import { localAddressOrigins } from "./address-provenance.js";
import { qualifiedCallName, resolveDirectCallTarget } from "./direct-calls.js";
import { isTrigonometryIntrinsic } from "./trigonometry.js";
import type { ScalarExpressionAnalyzer } from "./scalar-expressions.js";
import type {
  ScalarExpressionContext,
  ScalarExpressionResult,
  SemanticType,
} from "./semantic-types.js";
import type { Expr } from "./syntax.js";

/** Check prefix operations, including contextual negative literal adaptation. */
export function analyzeScalarUnary(
  analyzer: ScalarExpressionAnalyzer,
  expression: Extract<Expr, { readonly kind: "unary" }>,
  expected: SemanticType | null,
  context: ScalarExpressionContext,
  resolveName: (
    expression: Extract<Expr, { readonly kind: "name" }>,
    context: ScalarExpressionContext,
    callTarget: boolean,
  ) => ScalarExpressionResult,
  analyzeNumber: (expression: Extract<Expr, { readonly kind: "number" }>) => ScalarExpressionResult,
): ScalarExpressionResult {
  if (expression.operator === "&") {
    if (expression.operand.kind === "name" && isTrigonometryIntrinsic(expression.operand.name)) {
      analyzer.host.diagnose(
        error(
          "E10043",
          `Address-of requires an addressable storage place or target function — '${expression.operand.name}' has no target address`,
          expression.span,
        ),
      );
      return { node: null, exact: null };
    }
    const functionName =
      expression.operand.kind === "name"
        ? analyzer.host.resolveName(expression.operand.name, context)?.binding.storage ===
          "function"
          ? resolveName(expression.operand, context, true)
          : null
        : expression.operand.kind === "member"
          ? resolveDirectCallTarget(
              expression.operand,
              context,
              analyzer.host,
              (name, nameContext) => resolveName(name, nameContext, true),
            )
          : null;
    if (functionName?.node?.binding !== null && functionName?.node?.binding !== undefined) {
      if (analyzer.host.isFunction(functionName.node.binding)) {
        if (analyzer.host.functionMode?.(functionName.node.binding) === "comptime") {
          analyzer.host.diagnose(
            error(
              "E10043",
              `Address-of requires an addressable storage place or target function — '${analyzer.host.sourceText(expression.operand.span)}' has no target address`,
              expression.span,
              null,
              [
                {
                  span:
                    analyzer.host.resolveName(
                      analyzer.host.sourceText(expression.operand.span),
                      context,
                    )?.nameSpan ?? functionName.node.binding.span,
                  message: "Compile-time function is declared here",
                },
              ],
            ),
          );
          return { node: null, exact: null };
        }
        const signature = analyzer.host.signature(functionName.node.binding);
        if (signature === null) {
          analyzer.host.defer(expression.span, "Function address requires a complete signature");
          return { node: null, exact: null };
        }
        const functionType =
          analyzer.host.functionMode?.(functionName.node.binding) === "interrupt"
            ? Object.freeze({ kind: "interrupt-handler" as const })
            : Object.freeze({
                kind: "function" as const,
                parameters: signature.parameters,
                returnType: signature.returnType,
              });
        return {
          node: createScalarTypedExpression(expression, functionType, null, {
            operator: expression.operator,
            operand: functionName.node,
          }),
          exact: null,
        };
      }
    }
    const operand = analyzer.analyze(expression.operand, null, {
      ...context,
      placeContext: true,
    });
    if (operand.node === null) return { node: null, exact: null };
    const operandName = qualifiedCallName(expression.operand);
    const named = operandName === null ? null : analyzer.host.resolveName(operandName, context);
    if (
      named?.binding.storage === "constant" &&
      operand.node.binding === named.binding.id &&
      operand.node.type.kind === "scalar" &&
      !named.binding.materialized
    ) {
      analyzer.host.diagnose(
        error(
          "E10040",
          `Cannot take address of constant '${analyzer.host.sourceText(expression.operand.span)}' — an inlined scalar constant has no storage address`,
          expression.span,
          null,
          [{ span: named.nameSpan, message: "Constant declared here" }],
        ),
      );
      return { node: null, exact: null };
    }
    if (operand.node.place === null) {
      analyzer.host.diagnose(
        error(
          "E10043",
          `Address-of requires an addressable storage place or target function — '${analyzer.host.sourceText(expression.operand.span)}' has no target address`,
          expression.span,
        ),
      );
      return { node: null, exact: null };
    }
    return {
      node: createScalarTypedExpression(expression, SCALAR_TYPES.word, null, {
        operator: expression.operator,
        operand: operand.node,
        addressOrigins: localAddressOrigins(operand.node.place, context.scope),
        addressPlaces: Object.freeze([operand.node.place]),
        integer: integerFacts(SCALAR_TYPES.word, true),
      }),
      exact: null,
    };
  }
  if (expression.operator === "!") {
    const operand = analyzer.analyze(expression.operand, null, context);
    if (operand.node === null) return { node: null, exact: null };
    if (!isScalarType(operand.node.type) || operand.node.type.name !== "boolean") {
      analyzer.host.diagnose(
        error(
          "E10280",
          `Logical operator '!' requires Boolean operands — found '${semanticTypeName(operand.node.type)}'`,
          expression.operand.span,
        ),
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
      analyzer.host.diagnose(
        error("E10084", integerRangeMessage(expected, exact), expression.span),
      );
      return { node: null, exact };
    }
    const target =
      expected !== null && isIntegerType(expected) && fitsInteger(expected, exact)
        ? expected
        : context.ordinalContext
          ? SCALAR_TYPES.sword
          : defaultIntegerType(exact);
    if (target !== null && integerFacts(target, false)?.signed) {
      const operand = analyzeNumber(expression.operand).node;
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
  let operand = analyzer.analyze(expression.operand, null, context);
  if (operand.node === null) return { node: null, exact: null };
  if (isScalarType(operand.node.type) && operand.node.type.name === "void") {
    analyzer.host.diagnose(
      error("SEMANTIC_ERROR", "Void expression cannot be used as a value", expression.span),
    );
    return { node: null, exact: null };
  }
  if (operand.node.type.kind === "enum") {
    operand = applyExpectedScalar(
      operand,
      SCALAR_TYPES.byte,
      expression.operand,
      context,
      analyzer.host,
    );
    if (operand.node === null) return { node: null, exact: null };
  }
  if (!isIntegerType(operand.node.type)) {
    analyzer.host.diagnose(
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
    operand = applyExpectedScalar(operand, promoted, expression.operand, context, analyzer.host);
    if (operand.node === null) return { node: null, exact: null };
  }
  const facts = integerFacts(operand.node.type, !context.constantContext)!;
  if (expression.operator === "-" && !facts.signed) {
    analyzer.host.diagnose(
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
