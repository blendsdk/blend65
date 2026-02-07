/**
 * ASM-IL Optimizer Module
 *
 * Second stage of the two-stage optimization pipeline.
 * Operates on generated 6502 assembly (AsmILProgram) and applies
 * machine-level peephole patterns and 6502-specific optimizations.
 *
 * **Architecture:**
 * ```
 * IL Optimizer (stage 1) → Code Generator → ASM-IL Optimizer (stage 2) → Emitter
 * ```
 *
 * @module codegen/asm-il/optimizer
 */

// Types and interfaces
export type {
  AsmOptimizationPass,
  AsmOptimizationPassResult,
  AsmPassTransformStats,
  AsmOptimizerConfig,
  AsmOptimizationResult,
  AsmPassStatistics,
} from './types.js';

// Type helper functions
export {
  DEFAULT_ASM_OPTIMIZER_CONFIG,
  createEmptyTransformStats,
  createUnchangedPassResult,
  createEmptyPassStatistics,
  accumulatePassStats,
} from './types.js';

// Base optimizer class
export { BaseAsmOptimizer } from './base-optimizer.js';

// Concrete optimizer (pass manager)
export { AsmOptimizer, createAsmOptimizer } from './asm-optimizer.js';

// Built-in passes
export { PassThroughPass } from './pass-through.js';
