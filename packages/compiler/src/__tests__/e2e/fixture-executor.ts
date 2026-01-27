/**
 * @file Fixture Executor
 * @description Compiles fixture files and validates results against expected outcomes.
 *
 * This module provides the core compilation execution logic for fixture testing.
 * It uses the real Compiler class to compile fixtures and validates:
 * - Success/error expectations
 * - Error codes and messages
 * - Output assembly patterns
 */

import { Compiler } from '../../compiler.js';
import type { CompilationResult } from '../../pipeline/index.js';
import type { Blend65Config, TargetPlatform, OptimizationLevelId } from '../../config/types.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import { DiagnosticSeverity } from '../../ast/diagnostics.js';
import {
  ExpectedOutcome,
  FixtureMetadata,
  FixtureTestResult,
  LoadedFixture,
  OutputCheck,
  OutputCheckType,
} from './fixture-types.js';

/**
 * Configuration for fixture execution.
 */
export interface ExecutorConfig {
  /** Optimization level to use (default: 0) */
  optimizationLevel?: number;
  /** Target platform (default: 'c64') */
  target?: string;
  /** Enable verbose output for debugging */
  verbose?: boolean;
}

/**
 * Result of a single fixture execution.
 */
export interface ExecutionResult {
  /** Whether the test passed (matched expectations) */
  passed: boolean;
  /** Why the test failed (if it failed) */
  failureReason?: string;
  /** The compilation result from the compiler */
  compilationResult: CompilationResult;
  /** Execution time in milliseconds */
  executionTimeMs: number;
}

/**
 * Fixture Executor - compiles and validates fixture files.
 *
 * Uses the real Blend65 Compiler to compile fixtures and validates
 * the results against the fixture's expected outcomes.
 */
export class FixtureExecutor {
  /** Compiler instance */
  protected compiler = new Compiler();

  /** Executor configuration */
  protected config: ExecutorConfig;

  /**
   * Creates a new fixture executor.
   *
   * @param config - Executor configuration
   */
  constructor(config: ExecutorConfig = {}) {
    this.config = config;
  }

  /**
   * Executes a single fixture test.
   *
   * Compiles the fixture and validates the result against expectations.
   *
   * @param fixture - The loaded fixture to execute
   * @returns Fixture test result
   */
  public execute(fixture: LoadedFixture): FixtureTestResult {
    const startTime = performance.now();

    // Skip if fixture has skip annotation
    if (fixture.metadata.skip) {
      return {
        fixture,
        passed: true, // Skipped tests are considered "passed" (not failures)
        failureReason: `Skipped: ${fixture.metadata.skip}`,
        diagnostics: [],
        executionTimeMs: 0,
      };
    }

    // Check optimization level constraints
    const optLevel = this.config.optimizationLevel ?? 0;
    if (fixture.metadata.minOptLevel !== undefined && optLevel < fixture.metadata.minOptLevel) {
      return {
        fixture,
        passed: true,
        failureReason: `Skipped: requires minimum optimization level ${fixture.metadata.minOptLevel}`,
        diagnostics: [],
        executionTimeMs: 0,
      };
    }
    if (fixture.metadata.maxOptLevel !== undefined && optLevel > fixture.metadata.maxOptLevel) {
      return {
        fixture,
        passed: true,
        failureReason: `Skipped: exceeds maximum optimization level ${fixture.metadata.maxOptLevel}`,
        diagnostics: [],
        executionTimeMs: 0,
      };
    }

    // Compile the fixture
    const compilationResult = this.compileFixture(fixture);
    const executionTimeMs = performance.now() - startTime;

    // Validate against expectations
    const validationResult = this.validateResult(fixture, compilationResult);

    // Format diagnostics for reporting
    const diagnosticMessages = compilationResult.diagnostics.map(d => this.formatDiagnostic(d));

    return {
      fixture,
      passed: validationResult.passed,
      failureReason: validationResult.failureReason,
      diagnostics: diagnosticMessages,
      assemblyOutput: compilationResult.output?.assembly,
      executionTimeMs,
    };
  }

  /**
   * Compiles a fixture using the Blend65 compiler.
   *
   * @param fixture - The fixture to compile
   * @returns Compilation result
   */
  protected compileFixture(fixture: LoadedFixture): CompilationResult {
    // Create source map with fixture content
    // Use a simple filename to avoid confusing the parser with path components
    const sources = new Map<string, string>();
    const simpleFilename = this.normalizeFilename(fixture.filePath);
    sources.set(simpleFilename, fixture.source);

    // Create compilation config
    const config = this.createConfig();

    // Compile using the compiler's compileSource method
    return this.compiler.compileSource(sources, config);
  }

  /**
   * Normalizes a fixture file path to a simple filename.
   *
   * Converts paths like "10-integration/real-programs/border-color.blend"
   * to "border-color.blend" to avoid confusing the parser.
   *
   * @param filePath - The fixture file path
   * @returns Normalized filename
   */
  protected normalizeFilename(filePath: string): string {
    // Extract just the filename from the path
    const parts = filePath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1];
  }

  /**
   * Creates the compilation configuration.
   *
   * @returns Blend65Config for compilation
   */
  protected createConfig(): Blend65Config {
    const optLevel = this.getOptimizationLevel();
    const target = (this.config.target || 'c64') as TargetPlatform;

    return {
      compilerOptions: {
        target,
        optimization: optLevel,
        outputFormat: 'prg',
        debug: 'none',
        libraries: [], // No additional libraries - common is auto-loaded
      },
    };
  }

  /**
   * Gets the optimization level string for config.
   *
   * @returns Optimization level string (O0, O1, O2, etc.)
   */
  protected getOptimizationLevel(): OptimizationLevelId {
    const level = this.config.optimizationLevel ?? 0;
    switch (level) {
      case 0: return 'O0';
      case 1: return 'O1';
      case 2: return 'O2';
      case 3: return 'O3';
      default: return 'O0';
    }
  }

  /**
   * Validates the compilation result against fixture expectations.
   *
   * @param fixture - The fixture with expected outcomes
   * @param result - The actual compilation result
   * @returns Validation result
   */
  protected validateResult(
    fixture: LoadedFixture,
    result: CompilationResult,
  ): { passed: boolean; failureReason?: string } {
    const { metadata } = fixture;

    // Check expected outcome
    switch (metadata.expect) {
      case ExpectedOutcome.Success:
        return this.validateSuccess(metadata, result);

      case ExpectedOutcome.Error:
        return this.validateError(metadata, result);

      case ExpectedOutcome.Warning:
        return this.validateWarning(metadata, result);

      default:
        return {
          passed: false,
          failureReason: `Unknown expected outcome: ${metadata.expect}`,
        };
    }
  }

  /**
   * Validates a fixture that expects successful compilation.
   *
   * @param metadata - Fixture metadata
   * @param result - Compilation result
   * @returns Validation result
   */
  protected validateSuccess(
    metadata: FixtureMetadata,
    result: CompilationResult,
  ): { passed: boolean; failureReason?: string } {
    // Check compilation succeeded
    if (!result.success) {
      const errors = result.diagnostics
        .filter(d => d.severity === DiagnosticSeverity.ERROR)
        .map(d => this.formatDiagnostic(d))
        .join('\n');
      return {
        passed: false,
        failureReason: `Expected success but compilation failed:\n${errors}`,
      };
    }

    // Validate output checks if specified
    if (metadata.outputChecks && metadata.outputChecks.length > 0) {
      const assembly = result.output?.assembly || '';
      const outputValidation = this.validateOutputChecks(metadata.outputChecks, assembly);
      if (!outputValidation.passed) {
        return outputValidation;
      }
    }

    return { passed: true };
  }

  /**
   * Validates a fixture that expects a compilation error.
   *
   * @param metadata - Fixture metadata
   * @param result - Compilation result
   * @returns Validation result
   */
  protected validateError(
    metadata: FixtureMetadata,
    result: CompilationResult,
  ): { passed: boolean; failureReason?: string } {
    // Check compilation failed
    if (result.success) {
      return {
        passed: false,
        failureReason: 'Expected error but compilation succeeded',
      };
    }

    // Get error diagnostics
    const errors = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);

    if (errors.length === 0) {
      return {
        passed: false,
        failureReason: 'Expected error but no error diagnostics produced',
      };
    }

    // Check error code if specified
    if (metadata.errorCode) {
      const hasMatchingCode = errors.some(e => this.matchesErrorCode(e, metadata.errorCode!));
      if (!hasMatchingCode) {
        const actualCodes = errors.map(e => e.code).join(', ');
        return {
          passed: false,
          failureReason: `Expected error code '${metadata.errorCode}' but got: ${actualCodes}`,
        };
      }
    }

    // Check error message if specified
    if (metadata.errorMessage) {
      const hasMatchingMessage = errors.some(e =>
        e.message.toLowerCase().includes(metadata.errorMessage!.toLowerCase())
      );
      if (!hasMatchingMessage) {
        const actualMessages = errors.map(e => e.message).join('\n');
        return {
          passed: false,
          failureReason: `Expected error message containing '${metadata.errorMessage}' but got:\n${actualMessages}`,
        };
      }
    }

    return { passed: true };
  }

  /**
   * Validates a fixture that expects warnings but successful compilation.
   *
   * @param metadata - Fixture metadata
   * @param result - Compilation result
   * @returns Validation result
   */
  protected validateWarning(
    metadata: FixtureMetadata,
    result: CompilationResult,
  ): { passed: boolean; failureReason?: string } {
    // Check compilation succeeded (warnings don't prevent success)
    if (!result.success) {
      const errors = result.diagnostics
        .filter(d => d.severity === DiagnosticSeverity.ERROR)
        .map(d => this.formatDiagnostic(d))
        .join('\n');
      return {
        passed: false,
        failureReason: `Expected warning but compilation failed:\n${errors}`,
      };
    }

    // Check there are warnings
    const warnings = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.WARNING);

    if (warnings.length === 0) {
      return {
        passed: false,
        failureReason: 'Expected warnings but none were produced',
      };
    }

    // Validate output checks if specified
    if (metadata.outputChecks && metadata.outputChecks.length > 0) {
      const assembly = result.output?.assembly || '';
      const outputValidation = this.validateOutputChecks(metadata.outputChecks, assembly);
      if (!outputValidation.passed) {
        return outputValidation;
      }
    }

    return { passed: true };
  }

  /**
   * Validates output checks against generated assembly.
   *
   * @param checks - Array of output checks to perform
   * @param assembly - Generated assembly code
   * @returns Validation result
   */
  protected validateOutputChecks(
    checks: OutputCheck[],
    assembly: string,
  ): { passed: boolean; failureReason?: string } {
    for (const check of checks) {
      const result = this.validateOutputCheck(check, assembly);
      if (!result.passed) {
        return result;
      }
    }
    return { passed: true };
  }

  /**
   * Validates a single output check.
   *
   * @param check - The output check to validate
   * @param assembly - Generated assembly code
   * @returns Validation result
   */
  protected validateOutputCheck(
    check: OutputCheck,
    assembly: string,
  ): { passed: boolean; failureReason?: string } {
    const description = check.description || check.pattern;

    switch (check.type) {
      case OutputCheckType.Contains:
        if (!assembly.includes(check.pattern)) {
          return {
            passed: false,
            failureReason: `Output should contain '${description}' but it doesn't.\nAssembly output:\n${this.truncateAssembly(assembly)}`,
          };
        }
        break;

      case OutputCheckType.NotContains:
        if (assembly.includes(check.pattern)) {
          return {
            passed: false,
            failureReason: `Output should NOT contain '${description}' but it does.`,
          };
        }
        break;

      case OutputCheckType.Matches:
        try {
          const regex = new RegExp(check.pattern);
          if (!regex.test(assembly)) {
            return {
              passed: false,
              failureReason: `Output should match regex '${description}' but it doesn't.`,
            };
          }
        } catch (error) {
          return {
            passed: false,
            failureReason: `Invalid regex pattern: ${check.pattern}`,
          };
        }
        break;

      case OutputCheckType.SizeConstraint:
        // Parse size constraint (e.g., "<100" or ">50")
        const sizeResult = this.validateSizeConstraint(check.pattern, assembly);
        if (!sizeResult.passed) {
          return sizeResult;
        }
        break;

      default:
        return {
          passed: false,
          failureReason: `Unknown output check type: ${check.type}`,
        };
    }

    return { passed: true };
  }

  /**
   * Validates a size constraint check.
   *
   * @param constraint - Size constraint (e.g., "<100", ">50", "=75")
   * @param assembly - Generated assembly
   * @returns Validation result
   */
  protected validateSizeConstraint(
    constraint: string,
    assembly: string,
  ): { passed: boolean; failureReason?: string } {
    const match = constraint.match(/^([<>=]+)(\d+)$/);
    if (!match) {
      return {
        passed: false,
        failureReason: `Invalid size constraint format: ${constraint}`,
      };
    }

    const operator = match[1];
    const expected = parseInt(match[2], 10);
    const actual = assembly.length;

    let passed = false;
    switch (operator) {
      case '<':
        passed = actual < expected;
        break;
      case '<=':
        passed = actual <= expected;
        break;
      case '>':
        passed = actual > expected;
        break;
      case '>=':
        passed = actual >= expected;
        break;
      case '=':
      case '==':
        passed = actual === expected;
        break;
      default:
        return {
          passed: false,
          failureReason: `Unknown size constraint operator: ${operator}`,
        };
    }

    if (!passed) {
      return {
        passed: false,
        failureReason: `Size constraint failed: expected ${constraint} but got ${actual} characters`,
      };
    }

    return { passed: true };
  }

  /**
   * Checks if a diagnostic matches an expected error code.
   *
   * Handles both string-based and enum-based error codes.
   *
   * @param diagnostic - The diagnostic to check
   * @param expectedCode - The expected error code string
   * @returns true if the codes match
   */
  protected matchesErrorCode(diagnostic: Diagnostic, expectedCode: string): boolean {
    // Direct string comparison
    if (diagnostic.code === expectedCode) {
      return true;
    }

    // Handle DiagnosticCode enum values
    // The expectedCode might be something like "PARSE_ERROR" and
    // diagnostic.code might be the enum value
    const codeString = String(diagnostic.code);
    if (codeString.toUpperCase() === expectedCode.toUpperCase()) {
      return true;
    }

    // Case-insensitive comparison of code values
    if (typeof diagnostic.code === 'string') {
      return diagnostic.code.toUpperCase() === expectedCode.toUpperCase();
    }

    return false;
  }

  /**
   * Formats a diagnostic for display.
   *
   * @param diagnostic - The diagnostic to format
   * @returns Formatted string
   */
  protected formatDiagnostic(diagnostic: Diagnostic): string {
    const loc = diagnostic.location;
    const source = loc.source || loc.file || '<unknown>';
    return `${diagnostic.severity}: ${diagnostic.message} (${source}:${loc.start.line}:${loc.start.column})`;
  }

  /**
   * Truncates assembly output for error messages.
   *
   * @param assembly - Full assembly output
   * @param maxLines - Maximum lines to include (default: 20)
   * @returns Truncated assembly
   */
  protected truncateAssembly(assembly: string, maxLines: number = 20): string {
    const lines = assembly.split('\n');
    if (lines.length <= maxLines) {
      return assembly;
    }
    return lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} more lines)`;
  }
}

/**
 * Creates a default fixture executor instance.
 *
 * @param config - Optional executor configuration
 * @returns Configured executor
 */
export function createExecutor(config?: ExecutorConfig): FixtureExecutor {
  return new FixtureExecutor(config);
}