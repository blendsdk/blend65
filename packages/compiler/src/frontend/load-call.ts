import { projectDiagnostic as error } from "../project/diagnostics.js";
import { SCALAR_TYPES } from "./constants.js";
import {
  semanticTypesEqual,
  semanticTypeName,
  semanticTypeSize,
} from "./semantic-type-relations.js";
import { placeAliasKey } from "./load-units.js";
import type { ScalarExpressionAnalyzer } from "./scalar-expressions.js";
import type {
  ScalarExpressionContext,
  ScalarExpressionHost,
  ScalarExpressionResult,
} from "./semantic-types.js";
import type { Expr } from "./syntax.js";

/** Compute one exact destination range when every runtime index has a proved value. */
function knownPlaceRange(
  place: import("./semantic-types.js").Place,
  host: ScalarExpressionHost,
  unitSize: number,
): { readonly start: number; readonly end: number } | null {
  let type = host.stateFor?.(place.binding)?.binding.type ?? null;
  let offset = 0;
  for (const item of place.path) {
    if (type === null) return null;
    if (typeof item === "string") {
      if (type.kind !== "struct") return null;
      const field = type.fields.find(({ name }) => name === item);
      if (field === undefined) return null;
      offset += field.offset;
      type = field.type;
      continue;
    }
    if (type.kind !== "array") return null;
    const constant =
      typeof item.constant === "bigint"
        ? item.constant
        : item.binding === null
          ? null
          : (host.stateFor?.(item.binding)?.known ?? null);
    if (typeof constant !== "bigint") return null;
    const index = Number(constant);
    if (!Number.isSafeInteger(index) || index < 0 || index >= type.length) return null;
    offset += index * semanticTypeSize(type.element);
    type = type.element;
  }
  return { start: offset, end: offset + unitSize };
}

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
  const declaration = unitArg.kind === "name" ? host.resolveName(unitArg.name, context) : null;
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
  const destination = analyzer.analyze(destinationArg, null, {
    ...context,
    placeContext: true,
  });
  if (unit.node === null || destination.node === null) return { node: null, exact: null };
  const place = destination.node.place;
  if (place === null || place.readonly) {
    const reason =
      place?.readonlyOrigin === "constant"
        ? "a constant has no mutable storage"
        : place?.readonlyOrigin === "parameter"
          ? "a read-only parameter has no writable storage"
          : "the destination must be a mutable fixed place with stable storage";
    host.diagnose(
      error(
        "E10275",
        `Cannot load '${display(host, unitArg)}' into '${display(host, destinationArg)}' — ${reason}`,
        expression.span,
      ),
    );
    return { node: null, exact: null };
  }
  if (!semanticTypesEqual(unit.node.type, destination.node.type)) {
    const unitSize = semanticTypeSize(unit.node.type);
    const destinationSize = semanticTypeSize(destination.node.type);
    const sameSize = unitSize === destinationSize;
    host.diagnose(
      error(
        "E10275",
        sameSize
          ? `Cannot load '${display(host, unitArg)}' into '${display(host, destinationArg)}' — the destination type '${semanticTypeName(destination.node.type)}' is not exactly '${semanticTypeName(unit.node.type)}' (both are ${unitSize} bytes)`
          : `Cannot load '${display(host, unitArg)}' into '${display(host, destinationArg)}' — the destination is ${destinationSize} byte(s) of '${semanticTypeName(destination.node.type)}', the unit is ${unitSize} byte(s) of '${semanticTypeName(unit.node.type)}'`,
        expression.span,
        null,
        [{ span: unitArg.span, message: "Load unit type is declared here" }],
      ),
    );
    return { node: null, exact: null };
  }
  const destinationState = host.stateFor?.(place.binding) ?? null;
  if (destinationState === null) {
    host.diagnose(
      error(
        "E10275",
        `Cannot load '${display(host, unitArg)}' into '${display(host, destinationArg)}' — the compiler cannot retain the destination's reaching state`,
        expression.span,
      ),
    );
    return { node: null, exact: null };
  }
  const rootType = host.stateFor?.(place.binding)?.binding.type ?? null;
  const rootSize =
    rootType === null ? semanticTypeSize(unit.node.type) : semanticTypeSize(rootType);
  // A runtime index with a proved value selects one candidate. Only a genuinely
  // unknown index has to treat every candidate as may-written on the failure edge.
  const knownRange =
    place.byteRange === null
      ? knownPlaceRange(place, host, semanticTypeSize(unit.node.type))
      : null;
  const range = knownRange ??
    place.byteRange ?? {
      start: 0,
      end: rootSize,
    };
  const dynamic = place.byteRange === null && knownRange === null;
  const aliasKey = placeAliasKey(place, (binding) => host.stateFor?.(binding) ?? null);
  if (dynamic && aliasKey === null) {
    host.diagnose(
      error(
        "E10275",
        `Cannot load '${display(host, unitArg)}' into '${display(host, destinationArg)}' — the runtime destination index is not a stable simple expression, so the compiler cannot prove which fixed candidate is selected`,
        expression.span,
      ),
    );
    return { node: null, exact: null };
  }
  const resultId = `load:${expression.span.sourceId}:${expression.span.start}:${expression.span.end}`;
  const capture = Object.freeze({
    resultId,
    unitId: declaration.binding.qualifiedName ?? declaration.binding.name,
    destination: destinationState,
    range: Object.freeze(
      dynamic
        ? {
            start: 0,
            end:
              destinationState.binding.type === null
                ? range.end
                : semanticTypeSize(destinationState.binding.type),
          }
        : { start: range.start, end: range.end },
    ),
    aliasKey: aliasKey ?? "",
    dynamic,
    callSpan: expression.span,
  });
  // Entering the call may overwrite part of the destination, so its captured range is no longer
  // definitely initialized until the true result edge publishes it.
  destinationState.initializedRanges = Object.freeze(
    destinationState.initializedRanges.filter(
      (initialized) => initialized.end <= range.start || initialized.start >= range.end,
    ),
  );
  const type = destinationState.binding.type;
  destinationState.initialized =
    type?.kind === "array"
      ? destinationState.initializedRanges.some(
          (initialized) => initialized.start === 0 && initialized.end >= type.length,
        )
      : false;
  host.recordLoadCapture?.(capture);
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
      loadCapture: capture,
    }),
    exact: false,
  };
}
