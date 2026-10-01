import { createHash } from "node:crypto";
import type { ProjectSnapshot, SourceRecord } from "./types.js";

/**
 * Hash the established portable input tuple without including native host paths.
 * Sources must already be sorted by their logical identities' UTF-8 bytes.
 * @example projectInputSha256(manifestSource, sources, snapshot.overrides)
 */
export function projectInputSha256(
  manifestSource: SourceRecord,
  sources: readonly SourceRecord[],
  overrides: ProjectSnapshot["overrides"],
): string {
  const encoding = JSON.stringify([
    "blend65-project-input-v1",
    [manifestSource.sourceId, manifestSource.sha256],
    sources.map((source) => [source.sourceId, source.sha256]),
    overrides.target,
    overrides.entry,
  ]);
  return createHash("sha256").update(encoding, "utf8").digest("hex");
}
