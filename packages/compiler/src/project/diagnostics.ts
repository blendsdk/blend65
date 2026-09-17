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
});

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
