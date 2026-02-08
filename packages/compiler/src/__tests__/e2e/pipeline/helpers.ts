/**
 * E2E Pipeline Test Helpers
 *
 * Shared utilities for end-to-end pipeline tests that exercise
 * the complete compilation pipeline from Blend65 source code
 * through to assembly output.
 *
 * **Key Utilities:**
 * - {@link E2ECompiler} - TestCompiler subclass that skips library loading
 * - {@link compileBlend} - Compile source string to assembly
 * - {@link compileBlendSources} - Compile multiple source files
 * - {@link expectSuccess} - Assert compilation succeeded
 * - {@link expectFailure} - Assert compilation failed with errors
 * - {@link expectAssemblyContains} - Assert assembly output contains patterns
 * - {@link expectAssemblyNotContains} - Assert assembly output does NOT contain patterns
 * - {@link expectDiagnosticContains} - Assert diagnostics contain a message
 *
 * **Note on Library Loading:**
 * E2E tests use a TestCompiler that skips library loading to avoid
 * semantic conflicts from library files. The library auto-loading
 * is tested separately in the compiler unit tests.
 *
 * @module __tests__/e2e/pipeline/helpers
 */

import { expect } from 'vitest';
import { Compiler } from '../../../compiler.js';
import type { Blend65Config } from '../../../config/types.js';
import type { CompilationResult, CompilationPhase } from '../../../pipeline/types.js';
import { DiagnosticSeverity } from '../../../ast/diagnostics.js';

/**
 * E2E Test Compiler that skips library loading.
 *
 * Used for testing the full pipeline in isolation without
 * library semantic conflicts. The library auto-loading is tested
 * separately at the parse level in compiler.test.ts.
 */
class E2ECompiler extends Compiler {
  /**
   * Override library loading to return empty sources.
   * This avoids semantic conflicts from library files
   * that are not yet properly multi-module scoped.
   */
  protected override loadLibrarySources(): {
    success: boolean;
    sources: Map<string, string>;
  } {
    return { success: true, sources: new Map() };
  }
}

/**
 * Default C64 configuration for E2E tests.
 *
 * Uses C64 target with no optimization (O0) for predictable output.
 */
const DEFAULT_CONFIG: Blend65Config = {
  compilerOptions: {
    target: 'c64',
    optimization: 'O0',
  },
};

/**
 * Compile a single Blend65 source string through the full pipeline.
 *
 * Creates a single-file source map and runs all 8 pipeline phases.
 * Skips library loading to avoid semantic conflicts.
 *
 * @param source - Blend65 source code
 * @param config - Optional config override (defaults to C64/O0)
 * @param stopAfterPhase - Optional phase to stop after
 * @returns Complete compilation result
 */
export function compileBlend(
  source: string,
  config?: Blend65Config,
  stopAfterPhase?: CompilationPhase
): CompilationResult {
  const compiler = new E2ECompiler();
  const sources = new Map([['test.blend', source]]);
  return compiler.compileSource(sources, config ?? DEFAULT_CONFIG, stopAfterPhase);
}

/**
 * Compile multiple Blend65 source files through the full pipeline.
 *
 * Accepts a map of filename → source code pairs.
 *
 * @param sources - Map of filename → source code
 * @param config - Optional config override (defaults to C64/O0)
 * @param stopAfterPhase - Optional phase to stop after
 * @returns Complete compilation result
 */
export function compileBlendSources(
  sources: Map<string, string>,
  config?: Blend65Config,
  stopAfterPhase?: CompilationPhase
): CompilationResult {
  const compiler = new E2ECompiler();
  return compiler.compileSource(sources, config ?? DEFAULT_CONFIG, stopAfterPhase);
}

/**
 * Assert that a compilation result succeeded.
 *
 * Checks that success is true, output exists, and assembly is non-empty.
 * If compilation failed, dumps diagnostics for debugging.
 *
 * @param result - Compilation result to check
 * @param message - Optional failure message context
 */
export function expectSuccess(result: CompilationResult, message?: string): void {
  if (!result.success) {
    // Dump diagnostics for debugging failed compilations
    const diags = result.diagnostics
      .filter(d => d.severity === DiagnosticSeverity.ERROR)
      .map(d => `  ${d.severity}: ${d.message} @ ${d.location.source}:${d.location.start.line}:${d.location.start.column}`)
      .join('\n');
    const ctx = message ? ` (${message})` : '';
    throw new Error(`Expected compilation to succeed${ctx}, but got errors:\n${diags}`);
  }

  expect(result.output).toBeDefined();
  expect(result.output?.assembly).toBeDefined();
  expect(typeof result.output?.assembly).toBe('string');
  expect(result.output!.assembly!.length).toBeGreaterThan(0);
}

/**
 * Assert that a compilation result failed with errors.
 *
 * Checks that success is false and at least one error diagnostic exists.
 *
 * @param result - Compilation result to check
 * @param message - Optional failure message context
 */
export function expectFailure(result: CompilationResult, message?: string): void {
  const ctx = message ? ` (${message})` : '';
  expect(result.success, `Expected compilation to fail${ctx}`).toBe(false);

  const errorCount = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR).length;
  expect(errorCount, `Expected at least one error diagnostic${ctx}`).toBeGreaterThan(0);
}

/**
 * Assert that the assembly output contains all given patterns.
 *
 * First asserts compilation succeeded, then checks each pattern.
 * Patterns are matched as substrings (case-sensitive).
 *
 * @param result - Compilation result to check
 * @param patterns - One or more string patterns that must appear in assembly
 */
export function expectAssemblyContains(result: CompilationResult, ...patterns: string[]): void {
  expectSuccess(result);
  const asm = result.output!.assembly!;

  for (const pattern of patterns) {
    expect(asm, `Expected assembly to contain "${pattern}"`).toContain(pattern);
  }
}

/**
 * Assert that the assembly output does NOT contain any of the given patterns.
 *
 * First asserts compilation succeeded, then checks each pattern is absent.
 *
 * @param result - Compilation result to check
 * @param patterns - One or more string patterns that must NOT appear in assembly
 */
export function expectAssemblyNotContains(result: CompilationResult, ...patterns: string[]): void {
  expectSuccess(result);
  const asm = result.output!.assembly!;

  for (const pattern of patterns) {
    expect(asm, `Expected assembly NOT to contain "${pattern}"`).not.toContain(pattern);
  }
}

/**
 * Assert that at least one diagnostic message contains the given text.
 *
 * Useful for verifying specific error messages are produced.
 *
 * @param result - Compilation result to check
 * @param text - Text that must appear in at least one diagnostic message
 */
export function expectDiagnosticContains(result: CompilationResult, text: string): void {
  const hasMatch = result.diagnostics.some(d =>
    d.message.toLowerCase().includes(text.toLowerCase())
  );

  if (!hasMatch) {
    const allMessages = result.diagnostics.map(d => `  [${d.severity}] ${d.message}`).join('\n');
    throw new Error(
      `Expected a diagnostic containing "${text}", but none found.\nDiagnostics:\n${allMessages || '  (none)'}`
    );
  }
}

/**
 * Get the generated assembly text from a successful compilation.
 *
 * @param result - Compilation result (must be successful)
 * @returns The assembly text string
 */
export function getAssembly(result: CompilationResult): string {
  expectSuccess(result);
  return result.output!.assembly!;
}

/**
 * Count error-severity diagnostics in a compilation result.
 *
 * @param result - Compilation result to inspect
 * @returns Number of error-severity diagnostics
 */
export function countErrors(result: CompilationResult): number {
  return result.diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR).length;
}
