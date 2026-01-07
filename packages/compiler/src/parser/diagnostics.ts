/**
 * Diagnostic primitives shared by parser, analyzer, and future tooling.
 * Using enums keeps codes and severity names DRY per coding guidelines.
 */

import type { SourceSpan } from './source.js';

/**
 * Classification of diagnostic severity. Additional levels can be added later
 * (for example, `Suggestion`) without rewriting existing switch statements.
 */
export enum ParserDiagnosticSeverity {
  Error = 'Error',
  Warning = 'Warning',
  Info = 'Info',
}

/**
 * Unique identifiers for diagnostics. Prefixing with `PAR` leaves room for
 * analyzer (`ANA0001`), optimizer, or codegen codes later.
 */
export enum ParserDiagnosticCode {
  UnexpectedToken = 'PAR0001',
  UnterminatedBlock = 'PAR0002',
  DuplicateDeclaration = 'PAR0003',
  InvalidDecoratorPlacement = 'PAR0004',
  InternalParserError = 'PAR9999',
}

/** Related location information for richer error messages. */
export interface RelatedInformation {
  /** Source span associated with the related note. */
  span: SourceSpan;
  /** Brief explanation presented alongside the note. */
  message: string;
}

/**
 * Canonical diagnostic payload.
 */
export interface ParserDiagnostic {
  /** Stable identifier that maps to documentation and tests. */
  code: ParserDiagnosticCode;
  /** Severity category consumers can filter on. */
  severity: ParserDiagnosticSeverity;
  /** Human-readable description of the problem. */
  message: string;
  /** Primary source span where the issue occurs. */
  span: SourceSpan;
  /** Optional supplemental notes (e.g., previous definition locations). */
  relatedInformation?: RelatedInformation[];
}

/**
 * Factory helper to keep diagnostic creation consistent.
 *
 * @param code - Identifier for the diagnostic template.
 * @param severity - Severity level of the diagnostic instance.
 * @param message - Human-readable description of the problem.
 * @param span - Primary source location tied to the diagnostic.
 * @param relatedInformation - Optional supplemental notes.
 */
export function createParserDiagnostic(
  code: ParserDiagnosticCode,
  severity: ParserDiagnosticSeverity,
  message: string,
  span: SourceSpan,
  relatedInformation?: RelatedInformation[]
): ParserDiagnostic {
  return {
    code,
    severity,
    message,
    span,
    relatedInformation,
  };
}
