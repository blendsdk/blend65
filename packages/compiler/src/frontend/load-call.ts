import { projectDiagnostic as error } from "../project/diagnostics.js";
import { SCALAR_TYPES } from "./constants.js";
import { semanticTypesEqual } from "./semantic-type-relations.js";
import type { ScalarExpressionAnalyzer } from "./scalar-expressions.js";
import type {
  ScalarExpressionContext,
  ScalarExpressionHost,
  ScalarExpressionResult,
} from "./semantic-types.js";
import type { Expr } from "./syntax.js";

/** Format one source argument for a load diagnostic without inventing a value. */
function display(host: ScalarExpressionHost, expression: Expr): string {
  return host.sourceText(expression.span);
}

/**
 * Analyze the D64-only `c64.loader.load(unit, destination)` special form.
 *
 * The unit name is checked as compile-time metadata, so it is not a resident read. The
 * destination is checked once as an ordinary mutable place. The semantic lowerer receives
 * both identities in `TypedExpr.loadUnit`.
 */
export function analyzeLoadUnitCall(
  analyzer: ScalarExpressionAnalyzer,
  expression: Extract<Expr, { kind: "call" }>,
  context: ScalarExpressionContext,
  host: ScalarExpressionHost,
): ScalarExpressionResult {
  if (expression.arguments.length !== 2) {
    host.diagnose(
      error(
        "E10275",
        `Cannot load — 'c64.loader.load' requires exactly a loadable unit and a mutable destination; found ${expression.arguments.length} argument(s)`,
        expression.span,
      ),
    );
    return { node: null, exact: null };
  }
  const unitArg = expression.arguments[0]!;
  const destinationArg = expression.arguments[1]!;
  const declaration =
    unitArg.kind === "name" ? host.resolveName(unitArg.name, context) : null;
  if (declaration === null || declaration.binding.loadable !== true) {
    host.diagnose(
      error(
        "E10275",
        `Cannot load '${display(host, unitArg)}' into '${display(host, destinationArg)}' — the first argument must be a loadable constant (profile '${host.profileId ?? "unknown"}')`,
        expression.span,
        null,
        declaration === null || declaration.binding.loadable
          ? []
          : [{ span: declaration.nameSpan, message: "Resident data is declared here" }],
      ),
    );
    return { node: null, exact: null };
  }
  const unit = analyzer.analyze(unitArg, null, { ...context, compileTimeQuery: true });
  const destination = analyzer.analyze(destinationArg, null, context);
  if (unit.node === null || destination.node === null) return { node: null, exact: null };
  const place = destination.node.place;
  if (place === null || place.readonly) {
    host.diagnose(
      error(
        "E10275",
        `Cannot load '${display(host, unitArg)}' into '${display(host, destinationArg)}' — the destination must be a mutable fixed place with stable storage`,
        expression.span,
      ),
    );
    return { node: null, exact: null };
  }
  if (!semanticTypesEqual(unit.node.type, destination.node.type)) {
    host.diagnose(
      error(
        "E10275",
        `Cannot load '${display(host, unitArg)}' into '${display(host, destinationArg)}' — the destination type '${destination.node.type.kind}' is not exactly '${unit.node.type.kind}'`,
        expression.span,
        null,
        [{ span: unitArg.span, message: "Load unit type is declared here" }],
      ),
    );
    return { node: null, exact: null };
  }
  return {
    node: Object.freeze({
      kind: "call",
      span: expression.span,
      type: SCALAR_TYPES.boolean,
      constant: null,
      binding: null,
      place: null,
      conversion: null,
      integer: null,
      calleeDisplay: "c64.loader.load",
      arguments: Object.freeze([unit.node, destination.node]),
      loadUnit: Object.freeze({ unit: declaration.binding.id, destination: destination.node }),
    }),
    exact: false,
  };
}
