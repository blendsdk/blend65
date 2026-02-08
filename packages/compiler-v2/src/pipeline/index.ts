/**
 * Blend65 v2 Compilation Pipeline
 *
 * This module exports all compilation pipeline components.
 * The v2 pipeline has 8 phases (vs v1's 5):
 *
 * ```
 * Source → Parse → Semantic → Frame → IL → Optimize → Codegen → AsmOpt → Emit → Output
 * ```
 *
 * **Pipeline Phases:**
 * - {@link ParsePhase} - Lexer + Parser (source → AST)
 * - {@link SemanticPhase} - Type checking, symbol resolution (AST → analyzed AST)
 * - {@link FramePhase} - Static Frame Allocation (analyzed AST → frame map)
 * - {@link ILPhase} - IL generation (AST + frames → IL)
 * - {@link OptimizePhase} - IL optimization passes (IL → optimized IL)
 * - {@link CodegenPhase} - Code generation (IL → ASM-IL)
 * - {@link AsmOptPhase} - ASM-IL peephole optimization (ASM-IL → optimized ASM-IL)
 * - {@link EmitPhase} - Emission (ASM-IL → assembly text)
 *
 * @module pipeline
 */

// Type definitions
export type {
  PhaseResult,
  CompilationResult,
  CompileOptions,
  CompilationPhase,
} from './types.js';

// Type guards
export { hasPhaseData, hasOutput } from './types.js';

// Pipeline phases
export { ParsePhase } from './parse-phase.js';
export { SemanticPhase } from './semantic-phase.js';
export { FramePhase } from './frame-phase.js';
export { ILPhase } from './il-phase.js';
export { OptimizePhase } from './optimize-phase.js';
export { CodegenPhase } from './codegen-phase.js';
export { AsmOptPhase } from './asm-opt-phase.js';
export { EmitPhase } from './emit-phase.js';
