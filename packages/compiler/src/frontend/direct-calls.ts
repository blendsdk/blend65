import { projectDiagnostic } from "../project/diagnostics.js";
import { integerFacts } from "./constants.js";
import { semanticTypeName, semanticTypesEqual } from "./aggregate-types.js";
import { clearCallVisibleScalarFacts } from "./flow-facts.js";
import type {
  ScalarExpressionContext,
  ScalarExpressionHost,
  ScalarExpressionResult,
  SemanticType,
  TypedExpr,
} from "./semantic-types.js";
import type { Expr } from "./syntax.js";
import { createScalarTypedExpression } from "./constants.js";

/** Recursive expression callback used while checking call arguments. */
export type AnalyzeCallExpression = (
  expression: Expr,
  expected: SemanticType | null,
  context: ScalarExpressionContext,
) => ScalarExpressionResult;

/** Name resolver which distinguishes a call target from an ordinary value read. */
export type ResolveCallName = (
  expression: Expr,
  context: ScalarExpressionContext,
) => ScalarExpressionResult | null;

/** Resolve one ordinary direct call and independently check every supplied argument. */
export function analyzeDirectCall(
  expression: Extract<Expr, { readonly kind: "call" }>,
  context: ScalarExpressionContext,
  host: ScalarExpressionHost,
  analyze: AnalyzeCallExpression,
  resolveName: ResolveCallName,
): ScalarExpressionResult {
  const callee =
    resolveName(expression.callee, context) ?? analyze(expression.callee, null, context);
  if (callee.node === null || callee.node.binding === null) {
    for (const argument of expression.arguments) analyze(argument, null, context);
    return { node: null, exact: null };
  }
  const calleeBinding = callee.node.binding;
  const signature = host.signature(calleeBinding);
  if (signature === null) {
    if (host.isFunction(calleeBinding)) {
      for (const argument of expression.arguments) analyze(argument, null, context);
      host.defer(expression.span, "Direct call signature or aggregate ABI remains pending");
      return { node: null, exact: null };
    }
    host.diagnose(
      projectDiagnostic(
        "E10175",
        `'${callee.node.name ?? callee.node.member ?? "value"}' is not a function — cannot call a '${semanticTypeName(callee.node.type)}' value`,
        expression.callee.span,
      ),
    );
    for (const argument of expression.arguments) analyze(argument, null, context);
    return { node: null, exact: null };
  }
  const name = callee.node.name ?? callee.node.member ?? "<function>";
  let valid = expression.arguments.length === signature.parameters.length;
  if (!valid) {
    host.diagnose(
      projectDiagnostic(
        "E10171",
        `Wrong argument count — '${name}()' expects ${signature.parameters.length} parameters, got ${expression.arguments.length}`,
        expression.span,
      ),
    );
  }
  const arguments_: TypedExpr[] = [];
  expression.arguments.forEach((argument, index) => {
    const parameter = signature.parameters[index];
    const result = analyze(argument, parameter?.type ?? null, {
      ...context,
      ordinalContext: false,
    });
    if (result.node === null) {
      valid = false;
      return;
    }
    if (
      parameter !== undefined &&
      parameter.type.kind !== "scalar" &&
      !parameter.readonly &&
      result.node.place?.readonly
    ) {
      host.diagnose(
        projectDiagnostic(
          parameter.type.kind === "struct" ? "E10094" : "E10122",
          `Cannot pass const aggregate to mutable parameter ${index + 1} of '${name}()'`,
          argument.span,
        ),
      );
      valid = false;
    }
    if (parameter !== undefined && parameter.type.kind !== "scalar" && result.node.place === null) {
      host.defer(argument.span, "Aggregate temporary argument and copy ABI remain pending");
      valid = false;
    }
    if (parameter !== undefined && !semanticTypesEqual(result.node.type, parameter.type)) {
      valid = false;
    }
    arguments_.push(result.node);
  });
  if (context.constantContext) {
    host.diagnose(
      projectDiagnostic(
        "E10191",
        "Expression must be compile-time evaluable — ordinary function call is not constant",
        expression.span,
      ),
    );
    valid = false;
  }
  if (!valid) return { node: null, exact: null };
  if (signature.returnType.kind !== "scalar") {
    host.defer(expression.span, "Aggregate return call ABI remains pending");
    return { node: null, exact: null };
  }
  if (context.caller !== null) {
    host.call(
      Object.freeze({ caller: context.caller, callee: calleeBinding, span: expression.span }),
    );
  }
  clearCallVisibleScalarFacts(context.scope);
  return {
    node: createScalarTypedExpression(expression, signature.returnType, null, {
      callee: callee.node,
      arguments: Object.freeze(arguments_),
      signature,
      evaluation: "left-to-right",
      integer: integerFacts(signature.returnType, true),
    }),
    exact: null,
  };
}
