import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic } from "../project/types.js";

/** Stage name, spelled once so the message and its help line cannot drift apart. */
const STAGE = "artifact evidence preparation";

/** One unexpected throw out of evidence preparation, and what became of the staging directory. */
export interface ArtifactEvidenceFailure {
  /** Exact value that was thrown; any value is possible, so none is assumed. */
  readonly error: unknown;
  /** True when staging could not be removed and the caller needs recovery rather than a retry. */
  readonly stagingRetained: boolean;
}

/**
 * Render an arbitrary thrown value as one line of reportable detail.
 *
 * Anything can be thrown, including a value that refuses to become a string at all, so each step
 * is guarded rather than trusted. An `Error` contributes its message because that is the part a
 * reader can act on; a stack trace is deliberately left out, since it belongs in a bug report
 * rather than in a build's console output.
 *
 * A nullish throw is treated as carrying nothing, even though it would render perfectly well. The
 * words `null` and `undefined` name a host-language value, and printing one as the cause of a
 * failed build tells its reader strictly less than admitting there was no detail to give.
 *
 * @param error Exact thrown value.
 * @returns A single-line detail, or null when the value carries nothing worth printing.
 */
function thrownDetail(error: unknown): string | null {
  if (error === null || error === undefined) return null;
  const text =
    error instanceof Error
      ? error.message
      : ((): string | null => {
          try {
            return String(error);
          } catch {
            return null;
          }
        })();
  if (text === null) return null;
  const line = text.replaceAll(/\s+/gu, " ").trim();
  return line === "" ? null : line;
}

/**
 * Explain an unexpected failure of artifact evidence preparation without discarding its cause.
 *
 * Evidence preparation can fail for two very different reasons, and only one of them is the
 * author's business. A missing tool or an unwritable directory is an ordinary packaging failure. An
 * internal invariant breaking - a generated block whose label family nothing recognizes, say - is a
 * defect in the compiler, and the author's program may be perfectly correct. Neither is
 * distinguishable from the thrown value alone, so the stage is named and the thrown detail is
 * carried through instead of being replaced by a fixed sentence that fits every cause equally
 * badly.
 *
 * The canonical messages are unchanged, because they are what callers and operators already match
 * on. The detail travels in the help line, which is where this codebase already puts the part of a
 * compiler-stage refusal that means something to whoever receives a bug report.
 *
 * @param failure The thrown value and whether staging survived the cleanup attempt.
 * @returns The service diagnostic for this failure, carrying the cause when there is one.
 * @example artifactEvidenceDiagnostic({ error, stagingRetained: false })
 */
export function artifactEvidenceDiagnostic(failure: ArtifactEvidenceFailure): ProjectDiagnostic {
  const detail = thrownDetail(failure.error);
  const help =
    detail === null
      ? `Compiler limitation in ${STAGE}, which threw no reportable detail; please report it`
      : `Compiler limitation in ${STAGE}: ${detail}; please report it with the project shown`;
  return failure.stagingRetained
    ? projectDiagnostic(
        "ARTIFACT_EVIDENCE_CLEANUP",
        "Failed evidence left compiler-owned staging that requires recovery",
        null,
        null,
        [],
        help,
      )
    : projectDiagnostic(
        "ARTIFACT_EVIDENCE",
        "Artifact evidence preparation failed",
        null,
        null,
        [],
        help,
      );
}
