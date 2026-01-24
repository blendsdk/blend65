/**
 * Diagnostic Formatter
 *
 * Formats compiler diagnostics for terminal output with colors.
 *
 * @module output/formatter
 */

import chalk from 'chalk';
import type { Diagnostic } from '@blend65/compiler/dist/ast/diagnostics.js';

/**
 * Format a single diagnostic for terminal output
 *
 * Produces output like:
 * ```
 * error: Type mismatch: expected 'byte', got 'word'
 *   --> src/game.blend:42:15
 * ```
 *
 * @param diagnostic - Compiler diagnostic to format
 * @returns Formatted string with ANSI colors
 */
export function formatDiagnostic(diagnostic: Diagnostic): string {
  const loc = diagnostic.location;
  const severityColor = getSeverityColor(diagnostic.severity);
  const prefix = severityColor(diagnostic.severity + ':');

  const lines = [
    `${prefix} ${diagnostic.message}`,
    `  ${chalk.gray('-->')} ${loc.source}:${loc.start.line}:${loc.start.column}`,
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
    const sourceA = a.location.source ?? '';
    const sourceB = b.location.source ?? '';
    if (sourceA !== sourceB) {
      return sourceA.localeCompare(sourceB);
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