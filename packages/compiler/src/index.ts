/** Pure project validation APIs; no Blend65 compilation pipeline is exported. */
export { byteOffsetToPosition } from "./project/positions.js";
export { parseManifest } from "./project/manifest.js";
export { validateProjectName } from "./project/basename.js";
export type {
  SourceId,
  SourceSpan,
  OptimizationGoal,
  ProjectManifest,
  ProjectDiagnostic,
  ManifestParseResult,
  NameValidationResult,
} from "./project/types.js";
