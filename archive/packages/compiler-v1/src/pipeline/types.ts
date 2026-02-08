/**
 * Pipeline Type Definitions
 *
 * Defines TypeScript interfaces for the compilation pipeline.
 * These types support the unified Compiler class that orchestrates
 * all compilation phases.
 *
 * **Key Interfaces:**
 * - {@link PhaseResult} - Result of a single compilation phase
 * - {@link CompilationResult} - Complete compilation result
 * - {@link CompileOptions} - Options for compilation
 * - {@link CodegenResult} - Code generation output (stub)
 *
 * @module pipeline/types
 */

import type { Diagnostic } from '../ast/diagnostics.js';
import type { Program } from '../ast/nodes.js';
import type { MultiModuleAnalysisResult } from '../semantic/analyzer.js';
import type { ILModule } from '../il/module.js';
import type { TargetConfig } from '../target/config.js';
import type { Blend65Config } from '../config/types.js';
import type { OptimizationResult } from '../optimizer/optimizer.js';

/**
 * Result of a single compilation phase
 *
 * Each phase in the pipeline produces a PhaseResult containing:
 * - The output data from that phase
 * - Any diagnostics (errors, warnings) generated
 * - Success/failure status
 * - Timing information for performance analysis
 *
 * @typeParam T - The type of data produced by this phase
 *
 * @example
 * ```typescript
 * const parseResult: PhaseResult<Program[]> = {
 *   data: [program1, program2],
 *   diagnostics: [],
 *   success: true,
 *   timeMs: 42.5,
 * };
 * ```
 */
export interface PhaseResult<T> {
  /**
   * Output data from this phase
   *
   * The type depends on the phase:
   * - Parse: Program[] (AST per file)
   * - Semantic: MultiModuleAnalysisResult
   * - IL: ILModule
   * - Optimize: OptimizationResult
   * - Codegen: CodegenResult
   */
  data: T;

  /**
   * Diagnostics generated during this phase
   *
   * Includes errors, warnings, info, and hints.
   * Check for errors to determine if phase succeeded.
   */
  diagnostics: Diagnostic[];

  /**
   * Whether this phase completed successfully
   *
   * True if no error-severity diagnostics were generated.
   * Warnings and hints don't cause failure.
   */
  success: boolean;

  /**
   * Phase execution time in milliseconds
   *
   * Useful for performance profiling and optimization.
   */
  timeMs: number;
}

/**
 * Result of code generation phase
 *
 * Contains all output artifacts from the code generator.
 * This is a stub implementation for Phase 1 - real code
 * generation will be implemented in Phase 2.
 */
export interface CodegenResult {
  /**
   * Generated assembly source code
   *
   * Human-readable 6502 assembly that can be:
   * - Assembled with ACME or other assemblers
   * - Inspected for debugging
   * - Modified manually if needed
   */
  assembly: string;

  /**
   * Compiled binary data (PRG format) - optional
   *
   * Ready-to-load binary including:
   * - 2-byte load address header
   * - BASIC stub (if applicable)
   * - Machine code
   *
   * Only present when ACME assembler is available and assembly succeeds.
   * If undefined, only the .asm file should be written.
   */
  binary?: Uint8Array;

  /**
   * Source map for debugging (optional)
   *
   * Maps generated assembly/binary locations back to
   * original Blend65 source code.
   *
   * Phase 3 implementation - undefined in stub.
   */
  sourceMap?: SourceMap;

  /**
   * VICE label file content (optional)
   *
   * Label file for VICE debugger integration.
   * Generated when debug mode includes 'vice'.
   */
  viceLabels?: string;
}

/**
 * Source map for debugging
 *
 * Maps generated code positions back to original source.
 * Enables:
 * - Breakpoints in original source
 * - Stack traces with source locations
 * - Step-through debugging
 *
 * @note Future implementation - Phase 3
 */
export interface SourceMap {
  /**
   * Source map version (always 3)
   */
  version: 3;

  /**
   * Generated file name
   */
  file: string;

  /**
   * Original source file names
   */
  sources: string[];

  /**
   * Original source content (optional)
   */
  sourcesContent?: (string | null)[];

  /**
   * VLQ-encoded mappings
   */
  mappings: string;

  /**
   * Symbol names used in mappings
   */
  names: string[];
}

/**
 * Complete compilation result
 *
 * Contains results from all pipeline phases plus
 * final output artifacts. Used by CLI and programmatic API.
 *
 * @example
 * ```typescript
 * const result = compiler.compile({ files, config });
 *
 * if (result.success) {
 *   writeFileSync('game.prg', result.output!.binary);
 * } else {
 *   console.error(formatDiagnostics(result.diagnostics));
 * }
 * ```
 */
export interface CompilationResult {
  /**
   * True if compilation succeeded with no errors
   *
   * When true, result.output contains valid output.
   * When false, check result.diagnostics for errors.
   */
  success: boolean;

  /**
   * All diagnostics from all phases
   *
   * Aggregated in order of occurrence.
   * Includes errors, warnings, info, and hints.
   */
  diagnostics: Diagnostic[];

  /**
   * Phase-specific results for debugging
   *
   * Contains intermediate results from each phase.
   * Useful for debugging compilation issues.
   * May be undefined if phase wasn't reached.
   */
  phases: {
    /** Parse phase result */
    parse?: PhaseResult<Program[]>;

    /** Semantic analysis phase result */
    semantic?: PhaseResult<MultiModuleAnalysisResult>;

    /** IL generation phase result */
    il?: PhaseResult<ILModule>;

    /** Optimization phase result */
    optimize?: PhaseResult<OptimizationResult>;

    /** Code generation phase result */
    codegen?: PhaseResult<CodegenResult>;
  };

  /**
   * Final output artifacts (if successful)
   *
   * Contains generated assembly, binary, source maps, etc.
   * Only present when success is true.
   */
  output?: {
    /** Generated assembly text */
    assembly?: string;

    /** Binary .prg data */
    binary?: Uint8Array;

    /** Source map data */
    sourceMap?: SourceMap;

    /** VICE label file content */
    viceLabels?: string;
  };

  /**
   * Total compilation time in milliseconds
   *
   * Sum of all phase times plus overhead.
   */
  totalTimeMs: number;

  /**
   * Target configuration used for compilation
   *
   * Contains target-specific settings like memory layout,
   * hardware register addresses, etc.
   */
  target: TargetConfig;
}

/**
 * Options for compilation
 *
 * Specifies what to compile and how.
 * Passed to Compiler.compile().
 */
export interface CompileOptions {
  /**
   * Source files to compile
   *
   * Array of file paths relative to project root.
   * Files are parsed and analyzed as a multi-module project.
   *
   * @example ['src/main.blend', 'src/game.blend']
   */
  files: string[];

  /**
   * Configuration for compilation
   *
   * Merged configuration from blend65.json and CLI overrides.
   * Controls target platform, optimization level, output format, etc.
   */
  config: Blend65Config;

  /**
   * Stop compilation after specific phase (optional)
   *
   * Useful for:
   * - IDE integration (parse/check only)
   * - Debugging (inspect intermediate results)
   * - Performance testing (measure specific phases)
   *
   * @example 'semantic' - Stop after type checking
   */
  stopAfterPhase?: 'parse' | 'semantic' | 'il' | 'optimize' | 'codegen';
}

/**
 * Options for code generation phase
 *
 * Configuration passed to the code generator.
 */
export interface CodegenOptions {
  /**
   * Target platform configuration
   */
  target: TargetConfig;

  /**
   * Output format ('asm', 'prg', 'both')
   */
  format: string;

  /**
   * Generate source maps
   */
  sourceMap: boolean;

  /**
   * Debug mode ('none', 'inline', 'vice', 'both')
   */
  debug?: string;
}

/**
 * Compilation phase names
 *
 * Used for stopAfterPhase and phase identification.
 */
export type CompilationPhase = 'parse' | 'semantic' | 'il' | 'optimize' | 'codegen';

/**
 * Type guard for checking if a phase result has data
 *
 * @param result - Phase result to check
 * @returns True if result has valid data
 */
export function hasPhaseData<T>(result: PhaseResult<T> | undefined): result is PhaseResult<T> {
  return result !== undefined && result.data !== undefined;
}

/**
 * Type guard for checking if compilation succeeded with output
 *
 * @param result - Compilation result to check
 * @returns True if result has output data
 */
export function hasOutput(result: CompilationResult): result is CompilationResult & { output: NonNullable<CompilationResult['output']> } {
  return result.success && result.output !== undefined;
}