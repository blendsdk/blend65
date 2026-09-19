import { sortDiagnostics } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type { AggregateRegistry } from "./aggregate-types.js";
import { SCALAR_TYPES } from "./constants.js";
import type {
  AnalysisObligation,
  AnalyzedDeclaration,
  CallEdge,
  ModuleAnalysisResult,
  ModuleGraph,
  SemanticBinding,
} from "./semantic-types.js";

/** Compare exact source facts without locale-sensitive ordering. */
function compareSpans(left: SourceSpan, right: SourceSpan): number {
  return (
    Buffer.compare(Buffer.from(left.sourceId), Buffer.from(right.sourceId)) ||
    left.start - right.start ||
    left.end - right.end
  );
}

/** Sort and freeze the mutable facts accumulated during module analysis. */
export function assembleModuleAnalysis(
  graph: ModuleGraph,
  aggregates: AggregateRegistry,
  bindingsInput: readonly SemanticBinding[],
  declarationsInput: readonly AnalyzedDeclaration[],
  callsInput: readonly CallEdge[],
  diagnosticsInput: readonly ProjectDiagnostic[],
  obligationsInput: readonly AnalysisObligation[],
): ModuleAnalysisResult {
  const diagnostics = sortDiagnostics(diagnosticsInput);
  const bindings = Object.freeze(
    [...bindingsInput].sort((left, right) => compareSpans(left.declaration, right.declaration)),
  );
  const declarations = Object.freeze(
    [...declarationsInput].sort((left, right) => {
      const leftSpan = left.kind === "typed" ? left.binding.span : left.span;
      const rightSpan = right.kind === "typed" ? right.binding.span : right.span;
      return compareSpans(leftSpan, rightSpan);
    }),
  );
  const calls = Object.freeze(
    [...callsInput].sort((left, right) => compareSpans(left.span, right.span)),
  );
  const obligations = Object.freeze(
    [...obligationsInput].sort((left, right) => {
      if (left.span === null) return right.span === null ? 0 : 1;
      if (right.span === null) return -1;
      return compareSpans(left.span, right.span);
    }),
  );
  return Object.freeze({
    modules: graph.modules,
    bindings,
    types: Object.freeze([...Object.values(SCALAR_TYPES), ...aggregates.types()]),
    declarations,
    calls,
    diagnostics,
    obligations,
    complete: obligations.length === 0 && diagnostics.every(({ severity }) => severity !== "error"),
  });
}
