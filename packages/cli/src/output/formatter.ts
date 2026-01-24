/**
 * Diagnostic Formatter
 *
 * Formats compiler diagnostics for terminal output with colors.
 * Supports rich output with source code snippets and caret markers.
 *
 * @module output/formatter
 */

import chalk from 'chalk';
import type { Diagnostic } from '@blend65/compiler/dist/ast/diagnostics.js';
import { SourceRegistry } from '@blend65/compiler';

/**
 * Maximum line length before truncation for display
 */
const MAX_LINE_LENGTH = 120;

/**
 * Context lines to show before/after the error line
 */
const CONTEXT_LINES = 0;

/**
 * Extracts a specific line from source text
 *
 * Uses the SourceRegistry to retrieve source lines for snippet display.
 *
 * @param filePath - Path to the source file
 * @param lineNumber - Line number (1-indexed)
 * @returns The line text or undefined if not available
 */
function extractSourceLine(filePath: string, lineNumber: number): string | undefined {
  const registry = SourceRegistry.getInstance();
  return registry.getLine(filePath, lineNumber);
}

/**
 * Generates a caret marker string pointing to the error location
 *
 * Creates a string of spaces and carets (^) that aligns with the
 * error location in the source line.
 *
 * @param column - Starting column (1-indexed)
 * @param length - Length of the span to mark (minimum 1)
 * @param lineText - The actual line text (for tab expansion)
 * @returns String with spaces and carets
 *
 * @example
 * ```
 * // For column 5, length 3:
 * "    ^^^"
 * ```
 */
function generateCaretMarker(column: number, length: number, lineText: string): string {
  // Convert tabs to spaces to align carets correctly
  let spaces = '';
  const col = Math.max(1, column);

  // Build spaces accounting for tabs in the source line
  for (let i = 0; i < col - 1 && i < lineText.length; i++) {
    if (lineText[i] === '\t') {
      // Tabs expand to 4 spaces
      spaces += '    ';
    } else {
      spaces += ' ';
    }
  }

  // Handle remaining spaces if column > line length
  if (col - 1 > lineText.length) {
    spaces += ' '.repeat(col - 1 - lineText.length);
  }

  // Build caret string
  const caretLength = Math.max(1, length);
  const carets = '^'.repeat(caretLength);

  return spaces + carets;
}

/**
 * Expands tabs to spaces for consistent display
 *
 * @param text - Text that may contain tabs
 * @returns Text with tabs expanded to 4 spaces
 */
function expandTabs(text: string): string {
  return text.replace(/\t/g, '    ');
}

/**
 * Truncates a line if it exceeds maximum length
 *
 * @param text - Line text
 * @param column - Column of interest (keeps this area visible)
 * @returns Potentially truncated line with ellipsis
 */
function truncateLine(text: string, column: number): string {
  if (text.length <= MAX_LINE_LENGTH) {
    return text;
  }

  // Keep the area around the column visible
  const halfWindow = Math.floor(MAX_LINE_LENGTH / 2);
  const start = Math.max(0, column - halfWindow);
  const end = Math.min(text.length, start + MAX_LINE_LENGTH);

  let result = text.substring(start, end);

  // Add ellipsis indicators
  if (start > 0) {
    result = '...' + result.substring(3);
  }
  if (end < text.length) {
    result = result.substring(0, result.length - 3) + '...';
  }

  return result;
}

/**
 * Formats the line number gutter
 *
 * @param lineNumber - Line number to display
 * @param gutterWidth - Width of the gutter (for padding)
 * @returns Formatted line number with padding
 */
function formatLineNumber(lineNumber: number, gutterWidth: number): string {
  return lineNumber.toString().padStart(gutterWidth, ' ');
}

/**
 * Format a single diagnostic with rich source snippet
 *
 * Produces output like:
 * ```
 * error[P001]: Unexpected token 'functino'
 *   --> examples/main.blend:5:24
 *    |
 *  5 | functino main(): void {
 *    |          ^^^^
 * ```
 *
 * Falls back to simple format if source is not available.
 *
 * @param diagnostic - Compiler diagnostic to format
 * @returns Formatted string with ANSI colors and snippet
 */
export function formatDiagnosticWithSnippet(diagnostic: Diagnostic): string {
  const loc = diagnostic.location;
  const severityColor = getSeverityColor(diagnostic.severity);
  const filePath = loc.file ?? 'unknown';
  const line = loc.start.line;
  const column = loc.start.column;

  // Calculate span length
  const spanLength =
    loc.end.line === loc.start.line
      ? Math.max(1, loc.end.column - loc.start.column)
      : 1;

  // Build the header: "error[P001]: message"
  const prefix = severityColor(`${diagnostic.severity}[${diagnostic.code}]:`);
  const header = `${prefix} ${diagnostic.message}`;

  // Build location line: "  --> file:line:column"
  const locationLine = `  ${chalk.cyan('-->')} ${filePath}:${line}:${column}`;

  const lines: string[] = [header, locationLine];

  // Try to get source line for snippet
  const sourceLine = extractSourceLine(filePath, line);

  if (sourceLine !== undefined) {
    // Calculate gutter width based on line numbers
    const maxLineNum = line + CONTEXT_LINES;
    const gutterWidth = Math.max(3, maxLineNum.toString().length);
    const gutter = ' '.repeat(gutterWidth);

    // Add empty line with gutter
    lines.push(`${gutter} ${chalk.cyan('|')}`);

    // Add context lines before (if CONTEXT_LINES > 0)
    for (let i = line - CONTEXT_LINES; i < line; i++) {
      if (i > 0) {
        const ctxLine = extractSourceLine(filePath, i);
        if (ctxLine !== undefined) {
          const lineNum = formatLineNumber(i, gutterWidth);
          const displayLine = expandTabs(truncateLine(ctxLine, 1));
          lines.push(`${chalk.cyan(lineNum)} ${chalk.cyan('|')} ${displayLine}`);
        }
      }
    }

    // Add the error line with highlighting
    const lineNum = formatLineNumber(line, gutterWidth);
    const expandedLine = expandTabs(sourceLine);
    const displayLine = truncateLine(expandedLine, column);
    lines.push(`${chalk.cyan(lineNum)} ${chalk.cyan('|')} ${displayLine}`);

    // Add caret marker line
    const caretMarker = generateCaretMarker(column, spanLength, sourceLine);
    const expandedMarker = expandTabs(caretMarker);
    lines.push(`${gutter} ${chalk.cyan('|')} ${severityColor(expandedMarker)}`);

    // Add context lines after (if CONTEXT_LINES > 0)
    for (let i = line + 1; i <= line + CONTEXT_LINES; i++) {
      const ctxLine = extractSourceLine(filePath, i);
      if (ctxLine !== undefined) {
        const ctxLineNum = formatLineNumber(i, gutterWidth);
        const displayCtxLine = expandTabs(truncateLine(ctxLine, 1));
        lines.push(`${chalk.cyan(ctxLineNum)} ${chalk.cyan('|')} ${displayCtxLine}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Format a single diagnostic for terminal output
 *
 * Automatically uses rich snippet format when source is available,
 * falls back to simple format otherwise.
 *
 * @param diagnostic - Compiler diagnostic to format
 * @returns Formatted string with ANSI colors
 */
export function formatDiagnostic(diagnostic: Diagnostic): string {
  const loc = diagnostic.location;
  const filePath = loc.file ?? 'unknown';

  // Check if source is available for rich output
  const registry = SourceRegistry.getInstance();
  if (registry.has(filePath)) {
    return formatDiagnosticWithSnippet(diagnostic);
  }

  // Fallback to simple format
  const severityColor = getSeverityColor(diagnostic.severity);
  const prefix = severityColor(diagnostic.severity + ':');

  const lines = [
    `${prefix} ${diagnostic.message}`,
    `  ${chalk.gray('-->')} ${filePath}:${loc.start.line}:${loc.start.column}`,
  ];

  return lines.join('\n');
}

/**
 * Format multiple diagnostics for terminal output
 *
 * Sorts diagnostics by file, then line number, then severity.
 *
 * @param diagnostics - Array of compiler diagnostics
 * @returns Formatted string with all diagnostics
 */
export function formatDiagnostics(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) {
    return '';
  }

  // Sort diagnostics
  const sorted = [...diagnostics].sort((a, b) => {
    // Sort by file
    const fileA = a.location.file ?? '';
    const fileB = b.location.file ?? '';
    if (fileA !== fileB) {
      return fileA.localeCompare(fileB);
    }
    // Then by line
    if (a.location.start.line !== b.location.start.line) {
      return a.location.start.line - b.location.start.line;
    }
    // Then by severity (errors first)
    const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2, hint: 3 };
    return (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
  });

  return sorted.map((d) => formatDiagnostic(d)).join('\n\n');
}

/**
 * Get chalk color function for severity level
 *
 * @param severity - Diagnostic severity
 * @returns Chalk color function
 */
function getSeverityColor(severity: string): (text: string) => string {
  switch (severity) {
    case 'error':
      return chalk.red;
    case 'warning':
      return chalk.yellow;
    case 'info':
      return chalk.blue;
    case 'hint':
      return chalk.gray;
    default:
      return chalk.white;
  }
}

/**
 * Format a success message
 *
 * @param message - Message to format
 * @returns Formatted success message with checkmark
 */
export function formatSuccess(message: string): string {
  return `${chalk.green('✓')} ${message}`;
}

/**
 * Format an error message
 *
 * @param message - Message to format
 * @returns Formatted error message with X
 */
export function formatError(message: string): string {
  return `${chalk.red('✗')} ${message}`;
}

/**
 * Format a warning message
 *
 * @param message - Message to format
 * @returns Formatted warning message
 */
export function formatWarning(message: string): string {
  return `${chalk.yellow('⚠')} ${message}`;
}

/**
 * Format an info message
 *
 * @param message - Message to format
 * @returns Formatted info message
 */
export function formatInfo(message: string): string {
  return `${chalk.blue('ℹ')} ${message}`;
}