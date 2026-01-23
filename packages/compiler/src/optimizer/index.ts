/**
 * Optimizer Module - IL optimization pipeline
 *
 * This module provides the optimizer infrastructure for transforming IL modules
 * to produce more efficient code. Currently implements O0 (no optimization) as
 * a pass-through stub.
 *
 * @module optimizer
 *
 * @example
 * ```typescript
 * import {
 *   Optimizer,
 *   OptimizationLevel,
 *   createDefaultOptimizer,
 * } from './optimizer/index.js';
 *
 * // Create optimizer with default O0 level
 * const optimizer = createDefaultOptimizer();
 *
 * // Optimize a module (currently pass-through)
 * const result = optimizer.optimize(ilModule);
 *
 * // Check results
 * console.log(`Modified: ${result.modified}`);
 * console.log(`Level: ${OptimizationLevel[result.level]}`);
 * ```
 */

// Options and configuration
export {
  OptimizationLevel,
  OptimizationOptions,
  createDefaultOptions,
  createOptionsForLevel,
  isLevelImplemented,
} from './options.js';

// Optimizer class and result type
export {
  Optimizer,
  OptimizationResult,
  createDefaultOptimizer,
  createOptimizerForLevel,
} from './optimizer.js';