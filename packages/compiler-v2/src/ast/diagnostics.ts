/**
 * Diagnostic System for Blend65 Compiler v2
 *
 * Provides structured error reporting with severity levels,
 * error codes, and source locations for IDE integration.
 */

import { SourceLocation } from './base.js';

/**
 * Diagnostic severity levels
 */
export enum DiagnosticSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  HINT = 'hint',
}

/**
 * Diagnostic code enumeration
 *
 * Naming convention: [Category][Number]
 * - P = Parser errors (P001, P002, ...)
 * - S = Semantic errors (S001, S002, ...)
 * - W = Warnings (W001, W002, ...)
 */
export enum DiagnosticCode {
  // Parser errors (P001-P099)
  UNEXPECTED_TOKEN = 'P001',
  EXPECTED_TOKEN = 'P002',
  DUPLICATE_MODULE = 'P003',
  INVALID_MODULE_SCOPE = 'P004',
  UNTERMINATED_BLOCK = 'P005',
  MISSING_END_KEYWORD = 'P006',
  INVALID_NUMBER_LITERAL = 'P007',
  UNTERMINATED_STRING = 'P008',

  // Import/Export errors (P100-P199)
  WILDCARD_IN_PATH = 'P101',
  REEXPORT_NOT_SUPPORTED = 'P102',
  INVALID_IMPORT_SYNTAX = 'P103',
  EXPORT_REQUIRES_DECLARATION = 'P104',
  MODULE_NOT_FOUND = 'P105',
  CIRCULAR_IMPORT = 'P106',
  IMPORT_NOT_EXPORTED = 'P107',
  IMPORT_SYMBOL_NOT_FOUND = 'P108',

  // Ordering errors (P200-P299)
  MODULE_AFTER_IMPLICIT = 'P201',
  EXECUTABLE_AT_MODULE_SCOPE = 'P202',
  DECLARATION_AFTER_CODE = 'P203',

  // Warnings (W001-W099)
  IMPLICIT_MAIN_EXPORT = 'W001',
  UNUSED_VARIABLE = 'W002',
  UNUSED_FUNCTION = 'W003',
  UNREACHABLE_CODE = 'W004',

  // Hints (H001-H099)
  UNUSED_IMPORT = 'H001',

  // Semantic errors (S001-S099)
  UNDEFINED_VARIABLE = 'S001',
  TYPE_MISMATCH = 'S002',
  MISSING_CONST_INITIALIZER = 'S003',
  DUPLICATE_DECLARATION = 'S004',
  DUPLICATE_EXPORTED_MAIN = 'S005',
  UNKNOWN_TYPE = 'S006',
  INVALID_TYPE = 'S007',
  INVALID_ARRAY_SIZE = 'S008',

  // Memory layout errors (S100-S199)
  ZERO_PAGE_OVERFLOW = 'S100',
  MEMORY_MAP_OVERLAP = 'S101',
  ZERO_PAGE_MAP_OVERLAP = 'S102',
  RESERVED_ZERO_PAGE = 'S103',
  ZERO_PAGE_ALLOCATION_INTO_RESERVED = 'S104',

  // v2-specific: Recursion detection
  RECURSION_DETECTED = 'S110',
  INDIRECT_RECURSION_DETECTED = 'S111',
}

/**
 * Structured diagnostic with rich context
 */
export interface Diagnostic {
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  message: string;
  location: SourceLocation;
  relatedLocations?: Array<{
    location: SourceLocation;
    message: string;
  }>;
  fixes?: Array<{
    message: string;
    edits: Array<{
      location: SourceLocation;
      newText: string;
    }>;
  }>;
}

/**
 * Collects diagnostics during compilation
 */
export class DiagnosticCollector {
  protected diagnostics: Diagnostic[] = [];

  public error(code: DiagnosticCode, message: string, location: SourceLocation): void {
    this.add({
      code,
      severity: DiagnosticSeverity.ERROR,
      message,
      location,
    });
  }

  public warning(code: DiagnosticCode, message: string, location: SourceLocation): void {
    this.add({
      code,
      severity: DiagnosticSeverity.WARNING,
      message,
      location,
    });
  }

  public info(code: DiagnosticCode, message: string, location: SourceLocation): void {
    this.add({
      code,
      severity: DiagnosticSeverity.INFO,
      message,
      location,
    });
  }

  public hint(code: DiagnosticCode, message: string, location: SourceLocation): void {
    this.add({
      code,
      severity: DiagnosticSeverity.HINT,
      message,
      location,
    });
  }

  public add(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  public getAll(): Diagnostic[] {
    return [...this.diagnostics];
  }

  public getErrors(): Diagnostic[] {
    return this.diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);
  }

  public hasErrors(): boolean {
    return this.getErrors().length > 0;
  }

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

  public clear(): void {
    this.diagnostics = [];
  }
}