/**
 * ASM-IL Optimizer Module
 *
 * Exports the optimizer infrastructure for ASM-IL modules.
 *
 * @module asm-il/optimizer
 */

// Re-export types
export type {
  AsmOptimizationPass,
  AsmOptimizerConfig,
  AsmOptimizationResult,
  AsmPassStatistics,
} from './types.js';
export { DEFAULT_ASM_OPTIMIZER_CONFIG } from './types.js';

// Re-export optimizer classes
export { BaseAsmOptimizer } from './base-optimizer.js';
export { PassThroughOptimizer, createPassThroughOptimizer } from './pass-through.js';
export { AsmOptimizer, createAsmOptimizer } from './asm-optimizer.js';