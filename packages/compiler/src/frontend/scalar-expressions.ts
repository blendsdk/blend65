import { projectDiagnostic as error } from "../project/diagnostics.js";
import { selectC64KernalFacts } from "../profile/c64-kernal.js";
import {
  applyExpectedScalar,
  createScalarTypedExpression,
  defaultIntegerType,
  fitsInteger,
  integerFacts,
  integerRangeMessage,
  isIntegerType,
  isScalarType,
  SCALAR_TYPES,
} from "./constants.js";
import {
  AggregateRegistry,
  analyzeAggregateExpression,
  applyExpectedAggregate,
} from "./aggregates.js";
import { analyzeScalarConditional } from "./conditional-expressions.js";
import { withDerivedAddressOrigins } from "./address-provenance.js";
import { analyzeDirectCall, qualifiedCallName, resolveDirectCallTarget } from "./direct-calls.js";
import { applyExpectedEnum } from "./enum-types.js";
import { analyzeScalarAssignment } from "./scalar-assignments.js";
import { semanticTypeSize } from "./semantic-type-relations.js";
import { analyzeTrigonometryCall } from "./trigonometry.js";
import { analyzeEnumCastCall, analyzeEnumMember, analyzeScalarCast } from "./scalar-conversions.js";
import type {
  Place,
  ScalarExpressionContext,
  ScalarExpressionHost,
  ScalarExpressionResult,
  SemanticType,
} from "./semantic-types.js";
import type { Expr } from "./syntax.js";

import { analyzeScalarUnary } from "./scalar-unary.js";
import { analyzeScalarBinary } from "./scalar-binary.js";

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
    reportMismatch?: (actual: SemanticType) => void,
  ): ScalarExpressionResult {
    const checked = this.analyzeNatural(expression, expected, context);
    const natural =
      checked.node === null
        ? checked
        : { ...checked, node: withDerivedAddressOrigins(checked.node) };
    if (natural.node === null || expected === null) return natural;
    if (isScalarType(natural.node.type) && natural.node.type.name === "void") {
      this.host.diagnose(
        error("SEMANTIC_ERROR", "Void expression cannot be used as a value", expression.span),
      );
      return { node: null, exact: null };
    }
    // A caller or fill initializer owns its conversion error. Inner expression errors
    // have already been reported normally, without re-evaluating any source effects.
    let specificError = false;
    const host =
      reportMismatch === undefined
        ? this.host
        : {
            ...this.host,
            diagnose: (diagnostic: Parameters<ScalarExpressionHost["diagnose"]>[0]) => {
              if (
                diagnostic.severity !== "error" ||
                !["E10080", "E10082", "E10086", "E10235"].includes(diagnostic.code)
              ) {
                specificError ||= diagnostic.severity === "error";
                this.host.diagnose(diagnostic);
              }
            },
          };
    const converted =
      expected.kind === "scalar"
        ? applyExpectedScalar(natural, expected, expression, context, host)
        : expected.kind === "enum"
          ? applyExpectedEnum(natural, expected, expression, host)
          : applyExpectedAggregate(natural, expected, expression, host, context);
    if (converted.node === null && !specificError) reportMismatch?.(natural.node.type);
    return converted;
  }
  /** Analyze the expression's own operator-defined type before outer conversion. */
  private analyzeNatural(
    expression: Expr,
    expected: SemanticType | null,
    context: ScalarExpressionContext,
  ): ScalarExpressionResult {
    if (
      context.caller !== null &&
      this.host.functionMode?.(context.caller) === "comptime" &&
      expression.kind === "call" &&
      expression.callee.kind === "name" &&
      (["peek", "peekw", "poke", "pokew", "embed"].includes(expression.callee.name) ||
        expression.callee.name.startsWith("asm_"))
    ) {
      this.host.diagnose(
        error(
          "E10191",
          "Expression must be compile-time evaluable — compile-time functions cannot access runtime or host state",
          expression.span,
        ),
      );
      return { node: null, exact: null };
    }
    // A module-qualified value uses the same readonly, initialization and constant
    // checks as an imported name. A real value at the root still owns field access.
    if (expression.kind === "member") {
      const name = qualifiedCallName(expression);
      const root = name?.split(".", 1)[0];
      if (
        name !== null &&
        root !== undefined &&
        this.host.resolveName(root, context) === null &&
        this.host.resolveName(name, context) !== null
      ) {
        return this.name({ kind: "name", name, span: expression.span }, context, false);
      }
    }
    const enumMember = analyzeEnumMember(expression, context, this.host, this.aggregates.enums);
    if (enumMember !== null) return enumMember;
    const aggregate = analyzeAggregateExpression(
      expression,
      expected,
      context,
      this.host,
      this.aggregates,
      (child, childType, childContext, reportMismatch) =>
        this.analyze(child, childType, childContext, reportMismatch),
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
        return analyzeScalarUnary(
          this,
          expression,
          expected,
          context,
          (name, active, target) => this.name(name, active, target),
          (number) => this.number(number, null),
        );
      case "binary":
        return analyzeScalarBinary(this, expression, expected, context);
      case "cast":
        return analyzeScalarCast(expression, context, this.host, (child, childType, childContext) =>
          this.analyze(child, childType, childContext),
        );
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
        {
          const trigonometry = analyzeTrigonometryCall(
            expression,
            context,
            this.host,
            (child, childType, childContext) => this.analyze(child, childType, childContext),
          );
          if (trigonometry !== null) return trigonometry;
        }
        if (
          qualifiedCallName(expression.callee) === "c64.loader.load" &&
          selectC64KernalFacts(this.host.profileId ?? "") !== null
        ) {
          const argument = expression.arguments[0];
          const declaration =
            argument?.kind === "name" ? this.host.resolveName(argument.name, context) : null;
          const residentUnit = declaration !== null && !declaration.binding.loadable;
          this.host.diagnose(
            error(
              "E10275",
              `Cannot load '${expression.arguments[0] === undefined ? "<missing>" : this.host.sourceText(expression.arguments[0].span)}' into '${expression.arguments[1] === undefined ? "<missing>" : this.host.sourceText(expression.arguments[1].span)}' — ${residentUnit ? "the supplied unit is resident data, not a loadable constant" : "the selected resident C64 profile has no load operation"} (profile '${this.host.profileId}')`,
              expression.span,
              null,
              residentUnit
                ? [{ span: declaration.nameSpan, message: "Resident data is declared here" }]
                : [],
            ),
          );
          return { node: null, exact: null };
        }
        {
          const enumCast = analyzeEnumCastCall(
            expression,
            context,
            this.aggregates.enums,
            this.host,
            (child, childType, childContext) => this.analyze(child, childType, childContext),
          );
          if (enumCast !== null) return enumCast;
        }
        return analyzeDirectCall(
          expression,
          context,
          this.host,
          (child, childType, childContext, reportMismatch) =>
            this.analyze(child, childType, childContext, reportMismatch),
          (callee, callContext) =>
            resolveDirectCallTarget(callee, callContext, this.host, (name, nameContext) =>
              this.name(name, nameContext, true),
            ),
        );
      default:
        this.host.defer(
          expression.span,
          "Expression is not implemented by the scalar frontend slice",
        );
        return { node: null, exact: null };
    }
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
    if (state === null) {
      const statementSpan = Object.freeze({ ...expression.span, end: expression.span.end + 1 });
      const provingSpan = this.host.sourceText(statementSpan).endsWith(";")
        ? statementSpan
        : expression.span;
      this.host.diagnose(
        error("E10239", `'${expression.name}' is not declared in this scope`, provingSpan),
      );
      return { node: null, exact: null };
    }
    // The name exists, but its declaration already owns a root error. Keep it
    // unusable without manufacturing an independent "not declared" diagnostic.
    if (state.binding.type === null) return { node: null, exact: null };
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
    if (
      context.caller !== null &&
      this.host.functionMode?.(context.caller) === "comptime" &&
      !callTarget &&
      state.binding.storage === "module"
    ) {
      this.host.diagnose(
        error(
          "E10191",
          "Expression must be compile-time evaluable — compile-time functions cannot read runtime storage",
          expression.span,
          null,
          [{ span: state.nameSpan, message: "Runtime storage is declared here" }],
        ),
      );
      return { node: null, exact: null };
    }
    if (state.binding.loadable && !context.compileTimeQuery) {
      this.host.diagnose(
        error(
          "E10274",
          `Loadable constant '${expression.name}' has no resident value or address — use compile-time metadata or pass it to a compatible selected-profile load operation`,
          expression.span,
          null,
          [{ span: state.nameSpan, message: "Loadable constant is declared here" }],
        ),
      );
      return { node: null, exact: null };
    }
    if (context.constantContext && !callTarget && state.binding.storage !== "constant") {
      this.host.diagnose(
        context.caseContext
          ? error(
              "E10071",
              `Case value must be a compile-time constant — '${this.host.sourceText(expression.span)}' cannot be evaluated at compile time`,
              expression.span,
            )
          : error(
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
            byteRange: Object.freeze({ start: 0, end: semanticTypeSize(state.binding.type) }),
          });
    if (!callTarget && !context.placeContext && place !== null) {
      this.host.read(place, expression.span);
    }
    // A shared module value can change between ordinary statements through an interrupt, even
    // immediately after assignment. Retain the read unless an interference proof is available;
    // readonly constants and assignment-expression results do not have this uncertainty.
    const known = !state.readonly && state.binding.storage === "module" ? null : state.known;
    return {
      node: createScalarTypedExpression(expression, state.binding.type, known, {
        name: expression.name,
        binding: state.binding.id,
        place,
        ...(state.binding.outerUnsized ? { outerUnsized: true } : {}),
        addressOrigins: state.addressOrigins,
        addressPlaces: state.addressPlaces,
        integer: integerFacts(state.binding.type, true),
      }),
      exact: known,
    };
  }
}
