/**
 * Diagnostic System for Blend65 Compiler
 *
 * Provides structured error reporting with severity levels,
 * error codes, and source locations for IDE integration.
 */

import { SourceLocation } from './base.js';

/**
 * Diagnostic severity levels
 *
 * Used to categorize issues by importance:
 * - ERROR: Compilation cannot proceed (syntax errors, type errors)
 * - WARNING: Suspicious code that might cause bugs
 * - INFO: Informational messages (deprecation notices, suggestions)
 * - HINT: Style suggestions, code improvements
 *
 * Similar to:
 * - TypeScript's DiagnosticCategory
 * - Rust's diagnostic levels
 * - VS Code's DiagnosticSeverity
 */
export enum DiagnosticSeverity {
  /**
   * Fatal error - compilation cannot proceed
   * Examples: syntax errors, type mismatches, undefined variables
   */
  ERROR = 'error',

  /**
   * Warning - code is valid but suspicious
   * Examples: unused variables, implicit type conversions
   */
  WARNING = 'warning',

  /**
   * Informational message
   * Examples: deprecation notices, performance tips
   */
  INFO = 'info',

  /**
   * Style or code improvement suggestion
   * Examples: formatting suggestions, simplifications
   */
  HINT = 'hint',
}

/**
 * Diagnostic code enumeration
 *
 * Unique identifier for each type of diagnostic.
 * Enables:
 * - Programmatic error handling (suppress specific warnings)
 * - Documentation links (error code → help page)
 * - IDE quick fixes (code → suggested fix)
 * - Analytics (which errors are most common)
 *
 * Naming convention: [Category][Number]
 * - P = Parser errors (P001, P002, ...)
 * - S = Semantic errors (S001, S002, ...)
 * - W = Warnings (W001, W002, ...)
 *
 * Per .clinerules: Use enums instead of magic strings
 */
export enum DiagnosticCode {
  // ============================================
  // PARSER ERRORS (P001-P099)
  // ============================================

  /** Unexpected token found */
  UNEXPECTED_TOKEN = 'P001',

  /** Expected specific token but found something else */
  EXPECTED_TOKEN = 'P002',

  /** Duplicate module declaration in same file */
  DUPLICATE_MODULE = 'P003',

  /** Invalid construct at module scope */
  INVALID_MODULE_SCOPE = 'P004',

  /** Block statement not properly terminated */
  UNTERMINATED_BLOCK = 'P005',

  /** Missing 'end' keyword for block */
  MISSING_END_KEYWORD = 'P006',

  /** Invalid number literal format */
  INVALID_NUMBER_LITERAL = 'P007',

  /** Unterminated string literal */
  UNTERMINATED_STRING = 'P008',

  // ============================================
  // IMPORT/EXPORT ERRORS (P100-P199)
  // ============================================

  /** Wildcard in module path (not supported) */
  WILDCARD_IN_PATH = 'P101',

  /** Re-export not supported */
  REEXPORT_NOT_SUPPORTED = 'P102',

  /** Import statement malformed */
  INVALID_IMPORT_SYNTAX = 'P103',

  /** Export without declaration */
  EXPORT_REQUIRES_DECLARATION = 'P104',

  /** Module not found (imported module doesn't exist) */
  MODULE_NOT_FOUND = 'P105',

  /** Circular import detected (A → B → A) */
  CIRCULAR_IMPORT = 'P106',

  /** Symbol exists but is not exported from module */
  IMPORT_NOT_EXPORTED = 'P107',

  /** Symbol does not exist in target module */
  IMPORT_SYMBOL_NOT_FOUND = 'P108',

  // ============================================
  // ORDERING ERRORS (P200-P299)
  // ============================================

  /** Module declaration after implicit global */
  MODULE_AFTER_IMPLICIT = 'P201',

  /** Executable statement at module scope */
  EXECUTABLE_AT_MODULE_SCOPE = 'P202',

  /** Declaration appears after executable code */
  DECLARATION_AFTER_CODE = 'P203',

  // ============================================
  // WARNINGS (W001-W099)
  // ============================================

  /** Main function not explicitly exported */
  IMPLICIT_MAIN_EXPORT = 'W001',

  /** Variable declared but never used */
  UNUSED_VARIABLE = 'W002',

  /** Function declared but never called */
  UNUSED_FUNCTION = 'W003',

  /** Unreachable code detected */
  UNREACHABLE_CODE = 'W004',

  // ============================================
  // HINTS (H001-H099)
  // ============================================

  /** Imported symbol is never used (Phase 7) */
  UNUSED_IMPORT = 'H001',

  // ============================================
  // SEMANTIC ERRORS (S001-S099)
  // ============================================
  // These will be used by semantic analyzer (future)

  /** Undefined variable referenced */
  UNDEFINED_VARIABLE = 'S001',

  /** Type mismatch in assignment or operation */
  TYPE_MISMATCH = 'S002',

  /** Constant declared without initializer */
  MISSING_CONST_INITIALIZER = 'S003',

  /** Duplicate declaration of same name */
  DUPLICATE_DECLARATION = 'S004',

  /** Multiple exported main functions */
  DUPLICATE_EXPORTED_MAIN = 'S005',

  // ============================================
  // MEMORY LAYOUT ERRORS (S100-S199)
  // ============================================

  /** Zero page overflow - exceeded 112 byte limit */
  ZERO_PAGE_OVERFLOW = 'S100',

  /** Memory-mapped regions overlap */
  MEMORY_MAP_OVERLAP = 'S101',

  /** Zero page allocation overlaps with @map declaration */
  ZERO_PAGE_MAP_OVERLAP = 'S102',

  /** Reserved zero-page address used ($00-$01 or $90-$FF) */
  RESERVED_ZERO_PAGE = 'S103',

  /** Zero-page allocation extends into reserved area */
  ZERO_PAGE_ALLOCATION_INTO_RESERVED = 'S104',
}

/**
 * Structured diagnostic with rich context
 *
 * Represents a single issue (error/warning/info/hint) with:
 * - Unique code for programmatic handling
 * - Severity level for filtering/display
 * - Human-readable message
 * - Source location for IDE highlighting
 * - Optional related locations (multi-part errors)
 * - Optional suggested fixes (IDE quick-fix support)
 *
 * Design matches IDE expectations:
 * - VS Code DiagnosticData
 * - Language Server Protocol Diagnostic
 */
export interface Diagnostic {
  /**
   * Diagnostic code for programmatic handling
   * Example: 'P001', 'S002', 'W003'
   */
  code: DiagnosticCode;

  /**
   * Severity level (error, warning, info, hint)
   */
  severity: DiagnosticSeverity;

  /**
   * Human-readable message
   *
   * Should be:
   * - Clear and actionable
   * - Include context (what went wrong, where, why)
   * - Suggest fixes when possible
   *
   * Example: "Expected ')' after function parameters, but found ']'"
   */
  message: string;

  /**
   * Primary source location of the issue
   * Used by IDE to highlight problematic code
   */
  location: SourceLocation;

  /**
   * Optional: Related locations for multi-part diagnostics
   *
   * Example: "Variable 'x' declared here but used as different type there"
   * - Primary location: where type mismatch occurred
   * - Related location: where variable was declared
   */
  relatedLocations?: Array<{
    /** Location of related code */
    location: SourceLocation;

    /** Explanation of relationship */
    message: string;
  }>;

  /**
   * Optional: Suggested fixes for IDE quick-fix feature
   *
   * Example: User wrote 'functino' → suggest 'function'
   * IDE can offer "Did you mean 'function'?" with auto-fix
   */
  fixes?: Array<{
    /** Description of what fix does */
    message: string;

    /** Code edits to apply */
    edits: Array<{
      /** Where to make the edit */
      location: SourceLocation;

      /** New text to insert */
      newText: string;
    }>;
  }>;
}

/**
 * Collects diagnostics during compilation
 *
 * Used throughout compiler stages:
 * - Lexer: Reports invalid tokens
 * - Parser: Reports syntax errors
 * - Semantic analyzer: Reports type errors, undefined variables
 * - Code generator: Reports generation issues
 *
 * Design:
 * - Accumulates issues (doesn't throw)
 * - Provides helper methods for common cases
 * - Can check if any errors occurred
 * - Returns all diagnostics at end
 */
export class DiagnosticCollector {
  /** Array of collected diagnostics */
  protected diagnostics: Diagnostic[] = [];

  /**
   * Adds an error diagnostic
   *
   * Helper method for the common case of reporting an error.
   *
   * @param code - The error code
   * @param message - Human-readable error message
   * @param location - Where the error occurred
   */
  public error(code: DiagnosticCode, message: string, location: SourceLocation): void {
    this.add({
      code,
      severity: DiagnosticSeverity.ERROR,
      message,
      location,
    });
  }

  /**
   * Adds a warning diagnostic
   *
   * @param code - The warning code
   * @param message - Human-readable warning message
   * @param location - Where the warning occurred
   */
  public warning(code: DiagnosticCode, message: string, location: SourceLocation): void {
    this.add({
      code,
      severity: DiagnosticSeverity.WARNING,
      message,
      location,
    });
  }

  /**
   * Adds an info diagnostic
   *
   * @param code - The info code
   * @param message - Informational message
   * @param location - Related location
   */
  public info(code: DiagnosticCode, message: string, location: SourceLocation): void {
    this.add({
      code,
      severity: DiagnosticSeverity.INFO,
      message,
      location,
    });
  }

  /**
   * Adds a hint diagnostic
   *
   * @param code - The hint code
   * @param message - Suggestion message
   * @param location - Related location
   */
  public hint(code: DiagnosticCode, message: string, location: SourceLocation): void {
    this.add({
      code,
      severity: DiagnosticSeverity.HINT,
      message,
      location,
    });
  }

  /**
   * Adds a complete diagnostic object
   *
   * Use this when you need to specify related locations or fixes.
   * For simple cases, use error(), warning(), etc.
   *
   * @param diagnostic - Complete diagnostic to add
   */
  public add(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  /**
   * Gets all collected diagnostics
   *
   * Returns a copy to prevent external modification.
   *
   * @returns Array of all diagnostics
   */
  public getAll(): Diagnostic[] {
    return [...this.diagnostics];
  }

  /**
   * Gets only error diagnostics
   *
   * Useful for checking if compilation can proceed.
   *
   * @returns Array of error diagnostics
   */
  public getErrors(): Diagnostic[] {
    return this.diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);
  }

  /**
   * Checks if any errors were collected
   *
   * Use this to determine if compilation failed.
   * Warnings/info/hints don't prevent compilation.
   *
   * @returns True if at least one error exists
   */
  public hasErrors(): boolean {
    return this.getErrors().length > 0;
  }

  /**
   * Gets count of diagnostics by severity
   *
   * @returns Object with counts for each severity level
   */
  public getCounts(): {
    errors: number;
    warnings: number;
    info: number;
    hints: number;
  } {
    return {
      errors: this.diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR).length,
      warnings: this.diagnostics.filter(d => d.severity === DiagnosticSeverity.WARNING).length,
      info: this.diagnostics.filter(d => d.severity === DiagnosticSeverity.INFO).length,
      hints: this.diagnostics.filter(d => d.severity === DiagnosticSeverity.HINT).length,
    };
  }

  /**
   * Clears all diagnostics
   *
   * Useful when reusing collector for multiple files.
   */
  public clear(): void {
    this.diagnostics = [];
  }
}