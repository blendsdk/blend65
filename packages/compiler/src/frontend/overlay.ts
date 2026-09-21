import { createHash } from "node:crypto";
import { projectDiagnostic, PROJECT_CODES } from "../project/diagnostics.js";
import { firstUnpairedSurrogate } from "../project/positions.js";
import { DEFAULT_LIMITS } from "../project/reads.js";
import type {
  ProjectDiagnostic,
  ProjectSnapshot,
  SourceId,
  SourceRecord,
} from "../project/types.js";

/** One in-memory source replacement used only for a single frontend analysis. */
export interface SourceOverlay {
  /** Exact canonical source identity already present in the project snapshot. */
  readonly sourceId: SourceId;
  /** Complete replacement text from the editor, preserved without normalization. */
  readonly text: string;
}

/** A validated effective snapshot or the one host-safety diagnostic that rejected it. */
export type OverlaySnapshotResult =
  | { readonly kind: "success"; readonly snapshot: ProjectSnapshot }
  | { readonly kind: "failure"; readonly diagnostics: readonly ProjectDiagnostic[] };

/** Return one immutable overlay failure in the same shape as frontend analysis errors. */
function failure(code: string, message: string): OverlaySnapshotResult {
  return Object.freeze({
    kind: "failure",
    diagnostics: Object.freeze([projectDiagnostic(code, message)]),
  });
}

/**
 * Validate bounded editor text and create an immutable effective snapshot.
 * The original snapshot identity and host paths remain unchanged.
 */
export function applySourceOverlays(
  snapshot: ProjectSnapshot,
  overlays: readonly SourceOverlay[],
): OverlaySnapshotResult {
  if (snapshot.sources.length > DEFAULT_LIMITS.sourceFiles) {
    return failure(
      PROJECT_CODES.limit,
      `Project host limit 'sourceFiles' exceeded: maximum ${DEFAULT_LIMITS.sourceFiles}, observed ${snapshot.sources.length}`,
    );
  }

  const knownSources = new Map(snapshot.sources.map((source) => [source.sourceId, source]));
  const replacements = new Map<SourceId, { readonly text: string; readonly byteLength: number }>();
  for (const overlay of overlays) {
    if (!knownSources.has(overlay.sourceId)) {
      return failure(PROJECT_CODES.path, "Overlay source is not part of the project snapshot");
    }
    if (replacements.has(overlay.sourceId)) {
      return failure(PROJECT_CODES.path, "Overlay source is repeated");
    }
    if (firstUnpairedSurrogate(overlay.text) !== null) {
      return failure(PROJECT_CODES.utf8, "Overlay text contains ill-formed Unicode");
    }
    const byteLength = Buffer.byteLength(overlay.text, "utf8");
    if (byteLength > DEFAULT_LIMITS.sourceBytes) {
      return failure(
        PROJECT_CODES.limit,
        `Project host limit 'sourceBytes' exceeded: maximum ${DEFAULT_LIMITS.sourceBytes}, observed ${byteLength}`,
      );
    }
    replacements.set(overlay.sourceId, Object.freeze({ text: overlay.text, byteLength }));
  }

  let totalBytes = snapshot.manifestSource.byteLength;
  for (const source of snapshot.sources) {
    totalBytes += replacements.get(source.sourceId)?.byteLength ?? source.byteLength;
    if (totalBytes > DEFAULT_LIMITS.totalBytes) {
      return failure(
        PROJECT_CODES.limit,
        `Project host limit 'totalBytes' exceeded: maximum ${DEFAULT_LIMITS.totalBytes}, observed ${totalBytes}`,
      );
    }
  }

  const sources: SourceRecord[] = snapshot.sources.map((source) => {
    const replacement = replacements.get(source.sourceId);
    if (replacement === undefined) return source;
    return Object.freeze({
      ...source,
      text: replacement.text,
      sha256: createHash("sha256").update(replacement.text, "utf8").digest("hex"),
      byteLength: replacement.byteLength,
    });
  });
  return Object.freeze({
    kind: "success",
    snapshot: Object.freeze({ ...snapshot, sources: Object.freeze(sources) }),
  });
}
