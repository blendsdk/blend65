/**
 * Centralized diagnostic helper functions for parser-specific ordering errors.
 *
 * Keeping message text and related-information wiring in a single module
 * ensures parser call sites stay junior-friendly while Phase 2 evolves.
 */

import {
  createParserDiagnostic,
  ParserDiagnosticCode,
  ParserDiagnosticSeverity,
  type ParserDiagnostic,
  type RelatedInformation,
} from './diagnostics.js';
import type { SourceSpan } from './source.js';

/** Shared alias for arrays that collect parser diagnostics. */
export type ParserDiagnosticSink = ParserDiagnostic[];

/**
 * Emits a duplicate-module diagnostic and threads the first declaration as
 * related information when available.
 *
 * @param sink - Mutable diagnostics array owned by the parser instance.
 * @param moduleSpan - Source span covering the duplicate `module` keyword.
 * @param firstModuleSpan - Optional span pointing at the first module.
 */
export function reportDuplicateModule(
  sink: ParserDiagnosticSink,
  moduleSpan: SourceSpan,
  firstModuleSpan?: SourceSpan
): void {
  const relatedInformation: RelatedInformation[] | undefined = firstModuleSpan
    ? [
        {
          span: firstModuleSpan,
          message: 'First module declaration appears here.',
        },
      ]
    : undefined;

  sink.push(
    createParserDiagnostic(
      ParserDiagnosticCode.DuplicateModuleDeclaration,
      ParserDiagnosticSeverity.Error,
      'Only one module declaration is permitted per file.',
      moduleSpan,
      relatedInformation
    )
  );
}

/**
 * Emits a diagnostic explaining that an import statement is missing its `from`
 * clause, which keeps dependency origins explicit.
 *
 * @param sink - Mutable diagnostics array owned by the parser instance.
 * @param importSpan - Span pointing at the `import` keyword.
 */
export function reportMissingFromClause(sink: ParserDiagnosticSink, importSpan: SourceSpan): void {
  sink.push(
    createParserDiagnostic(
      ParserDiagnosticCode.MissingFromClause,
      ParserDiagnosticSeverity.Error,
      "Import declarations must include a 'from' clause specifying the source module.",
      importSpan
    )
  );
}

/**
 * Emits a diagnostic when an import list is empty, e.g. `import from Foo`.
 *
 * @param sink - Mutable diagnostics array owned by the parser instance.
 * @param importSpan - Span pointing at the `import` keyword.
 */
export function reportEmptyImportList(sink: ParserDiagnosticSink, importSpan: SourceSpan): void {
  sink.push(
    createParserDiagnostic(
      ParserDiagnosticCode.EmptyImportList,
      ParserDiagnosticSeverity.Error,
      "Import declarations must list at least one binding before the 'from' clause.",
      importSpan
    )
  );
}

/**
 * Emits a warning diagnostic clarifying that `function main` has been
 * auto-exported because it lacked an explicit `export` keyword.
 *
 * @param sink - Mutable diagnostics array owned by the parser instance.
 * @param functionSpan - Span covering the `main` identifier.
 */
export function reportImplicitMainExport(
  sink: ParserDiagnosticSink,
  functionSpan: SourceSpan
): void {
  sink.push(
    createParserDiagnostic(
      ParserDiagnosticCode.ImplicitMainExport,
      ParserDiagnosticSeverity.Warning,
      "Function 'main' is automatically exported; add 'export' to acknowledge the behavior.",
      functionSpan
    )
  );
}

/**
 * Emits a diagnostic when a function block reaches EOF or an unexpected token
 * without the required `end function` terminator.
 *
 * Why: The parser needs clear block boundaries for recovery and to prevent
 * later declarations from being accidentally nested. This diagnostic fires when
 * we detect a function that wasn't properly closed.
 *
 * @param sink - Mutable diagnostics array owned by the parser instance.
 * @param functionSpan - Span covering the `function` keyword or function header.
 */
export function reportMissingEndFunction(
  sink: ParserDiagnosticSink,
  functionSpan: SourceSpan
): void {
  sink.push(
    createParserDiagnostic(
      ParserDiagnosticCode.MissingEndFunction,
      ParserDiagnosticSeverity.Error,
      "Function declaration must be terminated with 'end function'.",
      functionSpan
    )
  );
}

/**
 * Emits a diagnostic when an enum block reaches EOF or an unexpected token
 * without the required `end enum` terminator.
 *
 * Why: Similar to function blocks, enum declarations need explicit termination
 * so the parser can safely recover and avoid treating subsequent code as enum
 * members.
 *
 * @param sink - Mutable diagnostics array owned by the parser instance.
 * @param enumSpan - Span covering the `enum` keyword or enum header.
 */
export function reportMissingEndEnum(
  sink: ParserDiagnosticSink,
  enumSpan: SourceSpan
): void {
  sink.push(
    createParserDiagnostic(
      ParserDiagnosticCode.MissingEndEnum,
      ParserDiagnosticSeverity.Error,
      "Enum declaration must be terminated with 'end enum'.",
      enumSpan
    )
  );
}

/**
 * Emits a diagnostic when multiple exported `main` functions are detected,
 * preventing entry-point ambiguity.
 *
 * Why: The language specification requires exactly one exported main function
 * per program. This diagnostic threads the location of the first exported main
 * as related information to help developers understand the conflict.
 *
 * @param sink - Mutable diagnostics array owned by the parser instance.
 * @param duplicateMainSpan - Span covering the duplicate `main` function.
 * @param firstMainSpan - Optional span pointing at the first exported main.
 */
export function reportDuplicateExportedMain(
  sink: ParserDiagnosticSink,
  duplicateMainSpan: SourceSpan,
  firstMainSpan?: SourceSpan
): void {
  const relatedInformation: RelatedInformation[] | undefined = firstMainSpan
    ? [
        {
          span: firstMainSpan,
          message: 'First exported main function appears here.',
        },
      ]
    : undefined;

  sink.push(
    createParserDiagnostic(
      ParserDiagnosticCode.DuplicateExportedMain,
      ParserDiagnosticSeverity.Error,
      "Only one exported 'main' function is permitted per program.",
      duplicateMainSpan,
      relatedInformation
    )
  );
}
