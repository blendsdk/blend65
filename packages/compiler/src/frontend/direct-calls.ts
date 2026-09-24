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

/** Flatten a member-only callee into its module-qualified spelling. */
function qualifiedCallName(expression: Expr): string | null {
  if (expression.kind === "name") return expression.name;
  if (expression.kind !== "member") return null;
  const object = qualifiedCallName(expression.object);
  return object === null ? null : `${object}.${expression.member}`;
}

/** Resolve a simple or module-qualified name without treating it as a value read. */
export function resolveDirectCallTarget(
  expression: Expr,
  context: ScalarExpressionContext,
  host: ScalarExpressionHost,
  resolveSimpleName: (
    expression: Extract<Expr, { readonly kind: "name" }>,
    context: ScalarExpressionContext,
  ) => ScalarExpressionResult,
): ScalarExpressionResult | null {
  if (expression.kind === "name") return resolveSimpleName(expression, context);
  if (expression.kind !== "member") return null;
  const name = qualifiedCallName(expression);
  if (name === null) return null;
  const root = name.split(".", 1)[0];
  if (root !== undefined && host.resolveName(root, context) !== null) return null;
  const state = host.resolveName(name, context);
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
    const result = analyze(argument, parameter?.outerUnsized ? null : (parameter?.type ?? null), {
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
      parameter.type.kind !== "enum" &&
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
    if (parameter?.outerUnsized) {
      if (
        result.node.type.kind !== "array" ||
        parameter.type.kind !== "array" ||
        !semanticTypesEqual(result.node.type.element, parameter.type.element)
      ) {
        host.diagnose(
          projectDiagnostic(
            "E10080",
            `Argument ${index + 1} of '${name}()' has an incompatible array element type`,
            argument.span,
          ),
        );
        valid = false;
      }
    } else if (parameter !== undefined && !semanticTypesEqual(result.node.type, parameter.type)) {
      valid = false;
    }
    arguments_.push(result.node);
  });
  if (context.constantContext) {
    host.diagnose(
      projectDiagnostic(
        context.caseContext ? "E10071" : "E10191",
        context.caseContext
          ? `Case value must be a compile-time constant — '${host.sourceText(expression.span)}' cannot be evaluated at compile time`
          : "Expression must be compile-time evaluable — ordinary function call is not constant",
        expression.span,
      ),
    );
    valid = false;
  }
  if (!valid) return { node: null, exact: null };
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
