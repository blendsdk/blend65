import { loadProjectWithControls } from "./project/snapshot.js";
import type { ProjectLoadOptions, ProjectLoadResult } from "./project/types.js";

/** Project input APIs; no Blend65 compilation pipeline is exported. */
export { BUILD_INFO } from "./build-info.js";
export { byteOffsetToPosition } from "./project/positions.js";
export { parseManifest } from "./project/manifest.js";
export { validateProjectName } from "./project/basename.js";
export type {
  SourceId,
  SourceSpan,
  OptimizationGoal,
  ProjectManifest,
  ProjectDiagnostic,
  SourceRecord,
  ProjectSnapshot,
  ProjectLoadOptions,
  ProjectLoadResult,
  ManifestParseResult,
  NameValidationResult,
} from "./project/types.js";

/**
 * Discover and read a contained, immutable project input snapshot.
 * Expected input/host failures return diagnostics, never a usable partial snapshot.
 * An observed change retries the complete load at most three times. No output is
 * created, no assets are decoded, and no Blend65 compilation occurs.
 * @param options Optional discovery directory, manifest selector and invocation selections.
 * @returns A complete revalidated snapshot or structured proving diagnostics.
 * @example const result = await loadProject({ cwd: "/projects/game" });
 */
export async function loadProject(options: ProjectLoadOptions = {}): Promise<ProjectLoadResult> {
  return loadProjectWithControls(options);
}
