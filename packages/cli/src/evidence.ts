import { lstat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadProject, readCurrentGenerationForEvidence } from "@blend65/compiler";
import type { FailureCategory, ProjectDiagnostic } from "@blend65/compiler";

/** One validated artifact available from the current generation. */
export interface EvidenceArtifact {
  /** Fixed evidence role. */
  readonly role: string;
  /** Generation-relative artifact filename. */
  readonly path: string;
  /** Lowercase SHA-256 recorded by `.build.json`. */
  readonly sha256: string;
}

/** Successful current-generation evidence lookup. */
export interface EvidenceSuccess {
  /** Success discriminator. */
  readonly kind: "success";
  /** Canonical generation identity. */
  readonly generationId: string;
  /** Immutable generation directory. */
  readonly directory: string;
  /** SHA-256 of the generation's `.build.json`. */
  readonly buildJsonSha256: string;
  /** Primary deployable artifact filename. */
  readonly primaryArtifact: string;
  /** Validated artifact records. */
  readonly artifacts: readonly EvidenceArtifact[];
}

/** Typed evidence failure without a partial artifact list. */
export interface EvidenceFailure {
  /** Failure discriminator. */
  readonly kind: "failure";
  /** Stable failure category. */
  readonly category: FailureCategory;
  /** Safe human-readable summary. */
  readonly message: string;
  /** Ordered proving diagnostics. */
  readonly diagnostics: readonly ProjectDiagnostic[];
}

/** Evidence lookup result. */
export type EvidenceResult = EvidenceSuccess | EvidenceFailure;

/** Narrow one untrusted build-record artifact record. */
function artifactRecord(value: unknown): value is { path: string; sha256: string; kind: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).path === "string" &&
    typeof (value as Record<string, unknown>).sha256 === "string" &&
    typeof (value as Record<string, unknown>).kind === "string"
  );
}

/**
 * Resolve and validate the current immutable build generation without publishing,
 * repairing, or deleting anything.
 * @param options Project selector and operation directory.
 * @returns The validated current generation and its artifact roles, or a typed failure.
 * @example await readCurrentEvidence({ cwd: "/projects/game" });
 */
export async function readCurrentEvidence(options: {
  readonly cwd: string;
  readonly project?: string;
  readonly signal?: AbortSignal;
}): Promise<EvidenceResult> {
  const loaded = await loadProject({
    cwd: options.cwd,
    ...(options.project === undefined ? {} : { project: options.project }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });
  if (loaded.kind !== "success") {
    return {
      kind: "failure",
      category: "packaging",
      message: "Project inputs could not be loaded",
      diagnostics: loaded.diagnostics,
    };
  }
  const current = await readCurrentGenerationForEvidence(loaded.snapshot);
  if (current.kind !== "complete") {
    return {
      kind: "failure",
      category: "packaging",
      message: current.diagnostic,
      diagnostics: [],
    };
  }
  const buildPath = join(current.generation.directory, ".build.json");
  let value: unknown;
  try {
    const metadata = await lstat(buildPath);
    if (!metadata.isFile() || metadata.size > 1_048_576) {
      return {
        kind: "failure",
        category: "packaging",
        message: "The current build record is too large or not a regular file",
        diagnostics: [],
      };
    }
    value = JSON.parse(await readFile(buildPath, "utf8"));
  } catch {
    return {
      kind: "failure",
      category: "packaging",
      message: "The current build record is unreadable",
      diagnostics: [],
    };
  }
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    (value as Record<string, unknown>).kind !== "blend65.build" ||
    (value as Record<string, unknown>).schemaVersion !== 1 ||
    !Array.isArray((value as Record<string, unknown>).artifacts)
  ) {
    return {
      kind: "failure",
      category: "packaging",
      message: "The current build record is malformed",
      diagnostics: [],
    };
  }
  const artifacts: EvidenceArtifact[] = [];
  for (const record of (value as Record<string, unknown>).artifacts as unknown[]) {
    if (!artifactRecord(record)) {
      return {
        kind: "failure",
        category: "packaging",
        message: "The current build record contains an invalid artifact",
        diagnostics: [],
      };
    }
    artifacts.push({ role: record.kind, path: record.path, sha256: record.sha256 });
  }
  artifacts.push({
    role: "build",
    path: ".build.json",
    sha256: current.generation.buildJsonSha256,
  });
  artifacts.sort((left, right) => left.role.localeCompare(right.role));
  return {
    kind: "success",
    generationId: current.generation.generationId,
    directory: current.generation.directory,
    buildJsonSha256: current.generation.buildJsonSha256,
    primaryArtifact: current.generation.primaryArtifact,
    artifacts,
  };
}
