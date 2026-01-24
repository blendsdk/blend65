/**
 * Pass-Through ASM-IL Optimizer
 *
 * A no-op optimizer that returns input unchanged.
 * Used when optimization is disabled or as a baseline.
 *
 * @module asm-il/optimizer/pass-through
 */

import type { AsmModule } from '../types.js';
import type { AsmOptimizationResult } from './types.js';
import { BaseAsmOptimizer } from './base-optimizer.js';

/**
 * Pass-through optimizer that returns input unchanged.
 *
 * Used when:
 * - Optimization is disabled
 * - As a baseline for comparison
 * - During development before optimization passes are implemented
 */
export class PassThroughOptimizer extends BaseAsmOptimizer {
  /**
   * Create a new pass-through optimizer.
   *
   * Configuration is fixed: disabled, no passes, single iteration.
   */
  constructor() {
    super({ enabled: false, passes: [], maxIterations: 1, debug: false });
  }

  /**
   * Return the input module unchanged.
   *
   * @param module - The module (returned as-is)
   * @returns Pass-through result with changed = false
   */
  optimize(module: AsmModule): AsmOptimizationResult {
    return this.createPassThroughResult(module);
  }
}

/**
 * Factory function to create a pass-through optimizer.
 *
 * @returns New PassThroughOptimizer instance
 */
export function createPassThroughOptimizer(): PassThroughOptimizer {
  return new PassThroughOptimizer();
}