/**
 * Optimizer Module - IL optimization pipeline
 *
 * This module provides the optimizer infrastructure for transforming IL modules
 * to produce more efficient code.
 *
 * Required passes (run at ALL levels including O0):
 * - IntrinsicLoweringPass: Transforms peek/poke to hardware read/write
 *
 * Optional passes (O1+):
 * - (Future: DCE, constant folding, etc.)
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
 * // Optimize a module - intrinsic lowering is always run
 * const result = optimizer.optimize(ilModule);
 *
 * // Check results
 * console.log(`Modified: ${result.modified}`);
 * console.log(`Passes run: ${result.passesRun}`);
 * ```
 *
 * @example
 * ```typescript
 * // Use intrinsic lowering pass directly
 * import { lowerIntrinsics } from './optimizer/index.js';
 *
 * const result = lowerIntrinsics(ilModule);
 * console.log(`Transformed ${result.stats.peekToHardwareRead} peek instructions`);
 * ```
 */

// Options and configuration
export {
  OptimizationLevel,
  type OptimizationOptions,
  createDefaultOptions,
  createOptionsForLevel,
  isLevelImplemented,
} from './options.js';

// Optimizer class and result type
export {
  Optimizer,
  type OptimizationResult,
  createDefaultOptimizer,
  createOptimizerForLevel,
} from './optimizer.js';

// Constant tracker for analysis
export {
  ConstantTracker,
  createConstantTracker,
  type ConstantInfo,
  type ConstantTrackingResult,
} from './constant-tracker.js';

// Intrinsic lowering pass
export {
  IntrinsicLoweringPass,
  createIntrinsicLoweringPass,
  lowerIntrinsics,
  type IntrinsicLoweringStats,
  type IntrinsicLoweringResult,
} from './intrinsic-lowering-pass.js';