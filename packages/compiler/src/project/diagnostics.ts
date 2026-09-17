import type { ProjectDiagnostic, SourceSpan } from "./types.js";

/** Host diagnostic identifiers used by pure project validation. */
export const PROJECT_CODES = Object.freeze({
  /** Malformed JSONC, including contained parser exhaustion. */
  syntax: "PROJECT_MANIFEST_SYNTAX",
  /** Invalid root, key, required field or field value. */
  field: "PROJECT_MANIFEST_FIELD",
  /** Repeated key with the first occurrence as related proof. */
  duplicate: "PROJECT_DUPLICATE_KEY",
  /** A project basename failed the shared lexical safety floor. */
  name: "PROJECT_INVALID_NAME",
  /** Text cannot represent exact UTF-8 scalar values. */
  utf8: "PROJECT_INVALID_UTF8",
  /** A bounded host-service input exceeded its admitted bytes. */
  limit: "PROJECT_HOST_LIMIT",
  /** Normative compiler identity for an unqualified platform profile. */
  profile: "E10279",
  /** Discovery found no authoritative manifest. */
  notFound: "PROJECT_NOT_FOUND",
  /** A required native read or directory operation failed. */
  read: "PROJECT_READ_FAILED",
  /** A path violates containment, type or output ownership. */
  path: "PROJECT_PATH_INVALID",
  /** Distinct logical input names identify one regular file. */
  alias: "PROJECT_SOURCE_ALIAS",
  /** A followed directory resolves to an active ancestor. */
  cycle: "PROJECT_PATH_CYCLE",
  /** No exact .blend input was admitted. */
  empty: "PROJECT_EMPTY_SOURCES",
  /** Every bounded attempt observed changing inputs. */
  changed: "PROJECT_CHANGED",
  /** Runtime or architecture is unsupported. */
  unsupported: "PROJECT_HOST_UNSUPPORTED",
  /** A supported 64-bit host lacks production qualification. */
  bestEffort: "PROJECT_HOST_BEST_EFFORT",
});

/** Internal control flow carrying safe project diagnostics, never native error objects. */
export class ProjectFailure extends Error {
  /** Immutable proving failures returned by the public loader. */
  readonly diagnostics: readonly ProjectDiagnostic[];
  /** Preserve only sanitized structured failures. */
  constructor(diagnostics: readonly ProjectDiagnostic[]) {
    super("Project validation failed");
    this.diagnostics = sortDiagnostics(diagnostics);
  }
}

/** An observed identity/content change discards the entire current attempt. */
export class ProjectChanged extends Error {
  /** Carry no private source content or absolute host path. */
  constructor() {
    super("Project inputs changed");
  }
}

/** Extract only a stable native error identifier, without its path or stack. */
export function hostErrorCode(error: unknown): string | null {
  if (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    /^E[A-Z0-9_]+$/.test(error.code)
  )
    return error.code;
  return null;
}

/** Convert an expected native failure; disappearance of an observed input is retryable. */
export function throwReadFailure(error: unknown, input: string, observed = false): never {
  const code = hostErrorCode(error);
  if (code === null) throw error;
  if (observed && (code === "ENOENT" || code === "ENOTDIR")) throw new ProjectChanged();
  throw new ProjectFailure([
    projectDiagnostic(
      PROJECT_CODES.read,
      "Cannot read '" + escapeDiagnosticText(input) + "': " + code,
      null,
      input.startsWith("/") || input.startsWith("--") ? input : null,
    ),
  ]);
}

/** Fail a bounded operation with its actual configured and observed counts. */
export function checkLimit(name: string, maximum: number, observed: number): void {
  if (observed > maximum)
    throw new ProjectFailure([
      projectDiagnostic(
        PROJECT_CODES.limit,
        "Project host limit '" + name + "' exceeded: maximum " + maximum + ", observed " + observed,
      ),
    ]);
}

/** Escape control/terminal characters while preserving ordinary human-readable spelling. */
export function escapeDiagnosticText(text: string): string {
  return text.replace(
    /[\u0000-\u001f\u007f-\u009f]/gu,
    (character) => "U+" + character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0"),
  );
}

/** Build immutable proving records so consumers cannot alter a diagnostic's locations. */
export function projectDiagnostic(
  code: string,
  message: string,
  primarySpan: SourceSpan | null = null,
  pointer: string | null = null,
  related: ProjectDiagnostic["related"] = [],
  help: string | null = null,
): ProjectDiagnostic {
  return Object.freeze({
    code,
    severity: "error",
    message,
    primarySpan: primarySpan === null ? null : Object.freeze({ ...primarySpan }),
    pointer,
    related: Object.freeze(
      related.map((location) =>
        Object.freeze({ span: Object.freeze({ ...location.span }), message: location.message }),
      ),
    ),
    help,
  });
}

/** Compare exact UTF-8 spelling, without locale, Unicode normalization or case folding. */
function compareText(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

/** Sort a copy of diagnostics by identity, byte start, severity, code and message. */
export function sortDiagnostics(
  diagnostics: readonly ProjectDiagnostic[],
): readonly ProjectDiagnostic[] {
  return Object.freeze(
    [...diagnostics].sort(
      (left, right) =>
        compareText(left.primarySpan?.sourceId ?? "", right.primarySpan?.sourceId ?? "") ||
        (left.primarySpan?.start ?? 0) - (right.primarySpan?.start ?? 0) ||
        (left.severity === "error" ? 0 : 1) - (right.severity === "error" ? 0 : 1) ||
        compareText(left.code, right.code) ||
        compareText(left.message, right.message),
    ),
  );
}
