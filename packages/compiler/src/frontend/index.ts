import { loadProjectWithControls } from "../project/snapshot.js";
import type { ProjectLoadOptions, ProjectLoadResult } from "../project/types.js";

/** Stable frontend result and analysis entry points. */
export { ANALYSIS_RESULT_KIND, analyzeProject, analyzeProjectOverlay } from "./service.js";
export type { AnalysisResult, TypedProgram } from "./service.js";
export type { SourceOverlay } from "./overlay.js";
export {
  collectLoadUnits,
  loadableHandoff,
  loadUnitDiskName,
  loadUnitIdentity,
} from "./load-units.js";
export type {
  LoadUnitRecord,
  LoadUnitProvenance,
  LoadableHandoff,
  LoadableInitializer,
} from "./load-units.js";

/** Shared read-only editor facts derived from one analysis result. */
export { buildToolingIndex, renderSemanticType, renderSymbol } from "./tooling.js";
export {
  codeActionsAt,
  completionAt,
  documentSymbols,
  hoverAt,
  referencesFor,
  renameEdits,
  semanticTokenFacts,
  signatureAt,
  symbolAt,
  visibleSymbols,
  workspaceSymbols,
} from "./tooling-queries.js";
export type {
  CodeActionFact,
  CompletionFact,
  DocumentSymbolFact,
  HoverFact,
  RenameResult,
  SemanticTokenFact,
  SignatureFact,
  ToolingCall,
  ToolingEdit,
  ToolingImport,
  ToolingIndex,
  ToolingModule,
  ToolingOccurrence,
  ToolingPosition,
  ToolingProfile,
  ToolingSymbol,
  WorkspaceSymbolFact,
} from "./tooling.js";

/** Project-input helpers which do not import compiler backend stages. */
export { byteOffsetToPosition } from "./positions.js";
export { parseManifest } from "../project/manifest.js";
export { validateProjectName } from "../project/basename.js";
export type {
  ManifestParseResult,
  NameValidationResult,
  OptimizationGoal,
  ProjectDiagnostic,
  ProjectLoadOptions,
  ProjectLoadResult,
  ProjectManifest,
  ProjectSnapshot,
  SourceId,
  SourceRecord,
  SourceSpan,
} from "../project/types.js";

/**
 * Discover and read one immutable project snapshot for frontend-only consumers.
 * @param options Optional discovery directory, manifest selector and invocation selections.
 * @returns A complete revalidated snapshot or structured proving diagnostics.
 * @example const result = await loadProject({ cwd: "/projects/game" });
 */
export async function loadProject(options: ProjectLoadOptions = {}): Promise<ProjectLoadResult> {
  return loadProjectWithControls(options);
}
