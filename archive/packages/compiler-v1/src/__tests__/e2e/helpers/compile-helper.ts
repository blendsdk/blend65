/**
 * E2E Test Compilation Helpers
 *
 * Provides utilities for compiling Blend source code in tests
 * and accessing the generated assembly output.
 *
 * @module e2e/helpers/compile-helper
 */

import { Compiler } from '../../../compiler.js';
import { getDefaultConfig } from '../../../config/defaults.js';
import type { Blend65Config } from '../../../config/types.js';
import type { CompilationResult } from '../../../pipeline/types.js';
import type { Diagnostic } from '../../../ast/diagnostics.js';

/**
 * Options for compilation in tests
 */
export interface TestCompileOptions {
  /** Additional source files (filename → source) */
  additionalFiles?: Map<string, string>;

  /** Config overrides */
  config?: Partial<Blend65Config>;

  /** Stop after a specific phase */
  stopAfter?: 'parse' | 'semantic' | 'il' | 'optimize' | 'codegen';

  /** Include standard library (default: true) */
  includeStdLib?: boolean;
}

/**
 * Result of a test compilation
 */
export interface TestCompileResult {
  /** Whether compilation succeeded without errors */
  success: boolean;

  /** Generated assembly code (if compilation succeeded past codegen) */
  assembly: string | undefined;

  /** All diagnostics (errors, warnings, info) */
  diagnostics: Diagnostic[];

  /** Just the errors */
  errors: Diagnostic[];

  /** Just the warnings */
  warnings: Diagnostic[];

  /** The full compilation result from the compiler */
  raw: CompilationResult;
}

/**
 * Creates a test configuration with sensible defaults
 *
 * @param overrides - Optional configuration overrides
 * @returns A complete Blend65Config
 */
export function createTestConfig(overrides: Partial<Blend65Config> = {}): Blend65Config {
  const base = getDefaultConfig();
  return {
    ...base,
    ...overrides,
    compilerOptions: {
      ...base.compilerOptions,
      ...(overrides.compilerOptions || {}),
    },
  };
}

/**
 * Compiles Blend source code and returns a structured result
 *
 * This is the primary helper for E2E tests. It wraps the Compiler class
 * and provides convenient access to assembly output and diagnostics.
 *
 * @param source - Blend source code to compile
 * @param options - Optional compilation options
 * @returns TestCompileResult with assembly and diagnostics
 *
 * @example
 * ```typescript
 * // Simple usage
 * const result = compile('let x: byte = 10;');
 * expect(result.success).toBe(true);
 *
 * // Check for errors
 * const result = compile('let x: byte = "wrong";');
 * expect(result.errors.length).toBeGreaterThan(0);
 * ```
 */
export function compile(source: string, options: TestCompileOptions = {}): TestCompileResult {
  const compiler = new Compiler();
  const config = createTestConfig(options.config);

  // Build source map
  const sources = new Map<string, string>();
  sources.set('main.blend', source);

  // Add any additional files
  if (options.additionalFiles) {
    for (const [name, content] of options.additionalFiles) {
      sources.set(name, content);
    }
  }

  // Compile with library loading (default behavior)
  const raw = compiler.compileSource(sources, config, options.stopAfter);

  // Extract diagnostics by severity
  const errors = raw.diagnostics.filter((d) => d.severity === 'error');
  const warnings = raw.diagnostics.filter((d) => d.severity === 'warning');

  return {
    success: raw.success,
    assembly: raw.output?.assembly,
    diagnostics: raw.diagnostics,
    errors,
    warnings,
    raw,
  };
}

/**
 * Compiles Blend source code and returns just the assembly output
 *
 * This is a convenience wrapper around compile() for tests that
 * only care about the generated assembly.
 *
 * @param source - Blend source code to compile
 * @param options - Optional compilation options
 * @returns Generated assembly string
 * @throws Error if compilation fails
 *
 * @example
 * ```typescript
 * const asm = compileToAsm('let x: byte = 10;');
 * expect(asm).toContain('!byte');
 * ```
 */
export function compileToAsm(source: string, options: TestCompileOptions = {}): string {
  const result = compile(source, options);

  if (!result.success) {
    const errorMessages = result.errors.map((e) => `  - ${e.message}`).join('\n');
    throw new Error(`Compilation failed:\n${errorMessages}`);
  }

  if (!result.assembly) {
    throw new Error('Compilation succeeded but no assembly was generated');
  }

  return result.assembly;
}

/**
 * Compiles Blend source code and expects it to succeed
 *
 * @param source - Blend source code to compile
 * @param options - Optional compilation options
 * @returns TestCompileResult (throws if compilation fails)
 * @throws Error if compilation fails
 *
 * @example
 * ```typescript
 * const result = compileExpectSuccess('let x: byte = 10;');
 * // If we get here, compilation succeeded
 * ```
 */
export function compileExpectSuccess(source: string, options: TestCompileOptions = {}): TestCompileResult {
  const result = compile(source, options);

  if (!result.success) {
    const errorMessages = result.errors.map((e) => `  - ${e.message}`).join('\n');
    throw new Error(`Expected compilation to succeed but got errors:\n${errorMessages}`);
  }

  return result;
}

/**
 * Compiles Blend source code and expects it to fail
 *
 * @param source - Blend source code to compile
 * @param options - Optional compilation options
 * @returns TestCompileResult (throws if compilation succeeds)
 * @throws Error if compilation succeeds
 *
 * @example
 * ```typescript
 * const result = compileExpectFailure('let x: byte = "wrong";');
 * // If we get here, compilation failed as expected
 * expect(result.errors.some(e => e.message.includes('type'))).toBe(true);
 * ```
 */
export function compileExpectFailure(source: string, options: TestCompileOptions = {}): TestCompileResult {
  const result = compile(source, options);

  if (result.success) {
    throw new Error('Expected compilation to fail but it succeeded');
  }

  return result;
}

/**
 * Checks if compilation produces a specific error code
 *
 * @param result - Compilation result to check
 * @param code - Error code to look for
 * @returns True if the error code is present
 *
 * @example
 * ```typescript
 * const result = compile('let x = undefined_var;');
 * expect(hasErrorCode(result, 'UNDEFINED_IDENTIFIER')).toBe(true);
 * ```
 */
export function hasErrorCode(result: TestCompileResult, code: string): boolean {
  return result.errors.some((e) => e.code === code);
}

/**
 * Checks if compilation produces an error containing a message substring
 *
 * @param result - Compilation result to check
 * @param substring - Message substring to look for (case-insensitive)
 * @returns True if an error with the substring is present
 *
 * @example
 * ```typescript
 * const result = compile('let x: byte = "wrong";');
 * expect(hasErrorMessage(result, 'type')).toBe(true);
 * ```
 */
export function hasErrorMessage(result: TestCompileResult, substring: string): boolean {
  const lower = substring.toLowerCase();
  return result.errors.some((e) => e.message.toLowerCase().includes(lower));
}