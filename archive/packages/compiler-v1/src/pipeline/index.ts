/**
 * Blend65 Compilation Pipeline
 *
 * This module exports all compilation pipeline components.
 * The pipeline orchestrates the complete compilation process:
 *
 * ```
 * Source → Parse → Semantic → IL → Optimize → Codegen → Output
 * ```
 *
 * **Pipeline Phases:**
 * - {@link ParsePhase} - Lexer + Parser (source → AST)
 * - {@link SemanticPhase} - Type checking, symbol resolution (AST → analyzed AST)
 * - {@link ILPhase} - IL generation (AST → IL)
 * - {@link OptimizePhase} - Optimization passes (IL → optimized IL)
 * - {@link CodegenPhase} - Code generation (IL → assembly/binary)
 *
 * **Types:**
 * - {@link PhaseResult} - Result from any pipeline phase
 * - {@link CompilationResult} - Complete compilation result
 * - {@link CompileOptions} - Options for compilation
 * - {@link CodegenResult} - Code generation output
 * - {@link CodegenOptions} - Code generation options
 *
 * @module pipeline
 */

// Type definitions
export type {
  PhaseResult,
  CompilationResult,
  CompileOptions,
  CodegenResult,
  CodegenOptions,
  SourceMap,
  CompilationPhase,
} from './types.js';

// Type guards
export { hasPhaseData, hasOutput } from './types.js';

// Pipeline phases
export { ParsePhase } from './parse-phase.js';
export { SemanticPhase } from './semantic-phase.js';
export { ILPhase } from './il-phase.js';
export { OptimizePhase } from './optimize-phase.js';
export { CodegenPhase } from './codegen-phase.js';