/**
 * Blend65 Compiler
 *
 * A compiler for the Blend65 language targeting 6502-based systems
 * like the Commodore 64.
 *
 * **Main Entry Points:**
 * - {@link Compiler} - Unified compiler class for all compilation scenarios
 * - {@link formatDiagnostics} - Format diagnostics for display
 *
 * **Pipeline Phases:**
 * - {@link ParsePhase} - Lexer + Parser (source ’ AST)
 * - {@link SemanticPhase} - Type checking, symbol resolution
 * - {@link ILPhase} - Intermediate language generation
 * - {@link OptimizePhase} - Optimization passes
 * - {@link CodegenPhase} - Code generation (stub)
 *
 * @packageDocumentation
 * @module @blend65/compiler
 */

// Main Compiler class
export { Compiler, formatDiagnostics, formatDiagnostic } from './compiler.js';

// Pipeline phases and types
export {
  // Types
  type PhaseResult,
  type CompilationResult,
  type CompileOptions,
  type CodegenResult,
  type CodegenOptions,
  type SourceMap,
  type CompilationPhase,
  // Type guards
  hasPhaseData,
  hasOutput,
  // Phase classes
  ParsePhase,
  SemanticPhase,
  ILPhase,
  OptimizePhase,
  CodegenPhase,
} from './pipeline/index.js';

// Re-export config types for convenience
export type {
  Blend65Config,
  CompilerOptions,
  EmulatorConfig,
  TargetPlatform,
  OptimizationLevelId,
  DebugMode,
  OutputFormat,
} from './config/types.js';