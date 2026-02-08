/**
 * Pipeline Type Definitions
 *
 * Defines TypeScript interfaces for the v2 compilation pipeline.
 * These types support the unified Compiler class that orchestrates
 * all compilation phases.
 *
 * **V2 Pipeline Phases:**
 * 1. Parse - Lexer + Parser (source → AST)
 * 2. Semantic - Type checking, symbol resolution
 * 3. Frame - Static Frame Allocation
 * 4. IL - Intermediate language generation
 * 5. Optimize - IL optimization passes
 * 6. Codegen - IL → ASM-IL (structured assembly)
 * 7. AsmOpt - ASM-IL peephole optimization
 * 8. Emit - ASM-IL → assembly text
 *
 * @module pipeline/types
 */

import type { Diagnostic } from '../ast/diagnostics.js';
import type { Program } from '../ast/index.js';
import type { MultiModuleAnalysisResult } from '../semantic/analyzer.js';
import type { FrameAllocationResult } from '../frame/allocator/frame-allocator.js';
import type { ILProgram } from '../il/structures.js';
import type { AsmILProgram } from '../codegen/asm-il/types.js';
import type { AsmOptimizationResult } from '../codegen/asm-il/optimizer/types.js';
import type { TargetConfig } from '../target/config.js';
import type { Blend65Config } from '../config/types.js';

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
 */
export interface PhaseResult<T> {
  /** Output data from this phase */
  data: T;

  /** Diagnostics generated during this phase */
  diagnostics: Diagnostic[];

  /** Whether this phase completed successfully (no error-severity diagnostics) */
  success: boolean;

  /** Phase execution time in milliseconds */
  timeMs: number;
}

/**
 * Complete compilation result
 *
 * Contains results from all pipeline phases plus
 * final output artifacts. Used by CLI and programmatic API.
 */
export interface CompilationResult {
  /** True if compilation succeeded with no errors */
  success: boolean;

  /** All diagnostics from all phases, aggregated in order */
  diagnostics: Diagnostic[];

  /**
   * Phase-specific results for debugging
   *
   * Contains intermediate results from each phase.
   * May be undefined if phase wasn't reached.
   */
  phases: {
    parse?: PhaseResult<Program[]>;
    semantic?: PhaseResult<MultiModuleAnalysisResult>;
    frame?: PhaseResult<FrameAllocationResult>;
    il?: PhaseResult<ILProgram>;
    optimize?: PhaseResult<ILProgram>;
    codegen?: PhaseResult<AsmILProgram>;
    asmOpt?: PhaseResult<AsmOptimizationResult>;
    emit?: PhaseResult<string>;
  };

  /**
   * Final output artifacts (if successful)
   *
   * Contains generated assembly text.
   * Only present when success is true.
   */
  output?: {
    /** Generated assembly text */
    assembly?: string;
  };

  /** Total compilation time in milliseconds */
  totalTimeMs: number;

  /** Target configuration used for compilation */
  target: TargetConfig;
}

/**
 * Options for compilation
 *
 * Specifies what to compile and how.
 * Passed to Compiler.compile().
 */
export interface CompileOptions {
  /** Source files to compile (file paths) */
  files: string[];

  /** Configuration for compilation */
  config: Blend65Config;

  /**
   * Stop compilation after specific phase (optional)
   *
   * Useful for IDE integration (parse/check only),
   * debugging (inspect intermediate results), etc.
   */
  stopAfterPhase?: CompilationPhase;
}

/**
 * Compilation phase names
 *
 * Used for stopAfterPhase and phase identification.
 * V2 has 8 phases vs v1's 5 phases.
 */
export type CompilationPhase =
  | 'parse'
  | 'semantic'
  | 'frame'
  | 'il'
  | 'optimize'
  | 'codegen'
  | 'asmOpt'
  | 'emit';

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
export function hasOutput(
  result: CompilationResult
): result is CompilationResult & { output: NonNullable<CompilationResult['output']> } {
  return result.success && result.output !== undefined;
}
