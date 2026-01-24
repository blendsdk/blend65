/**
 * Base ASM-IL Optimizer
 *
 * Abstract base class for ASM-IL optimizers.
 * Provides common infrastructure for running optimization passes.
 *
 * @module asm-il/optimizer/base-optimizer
 */

import type { AsmModule } from '../types.js';
import type {
  AsmOptimizerConfig,
  AsmOptimizationPass,
  AsmOptimizationResult,
} from './types.js';
import { DEFAULT_ASM_OPTIMIZER_CONFIG } from './types.js';

/**
 * Abstract base class for ASM-IL optimizers.
 *
 * Provides common infrastructure for running optimization passes.
 * Subclasses implement the actual optimization strategy.
 */
export abstract class BaseAsmOptimizer {
  /** Optimizer configuration */
  protected readonly config: AsmOptimizerConfig;

  /**
   * Create a new optimizer with the given configuration.
   *
   * @param config - Partial configuration (merged with defaults)
   */
  constructor(config: Partial<AsmOptimizerConfig> = {}) {
    this.config = { ...DEFAULT_ASM_OPTIMIZER_CONFIG, ...config };
  }

  /**
   * Run all configured optimization passes on the module.
   *
   * @param module - The module to optimize
   * @returns Optimization result with statistics
   */
  abstract optimize(module: AsmModule): AsmOptimizationResult;

  /**
   * Check if optimization is enabled.
   *
   * @returns true if optimization is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get the list of configured passes.
   *
   * @returns Readonly array of optimization passes
   */
  getPasses(): readonly AsmOptimizationPass[] {
    return this.config.passes;
  }

  /**
   * Get the maximum iterations setting.
   *
   * @returns Maximum iterations for fixed-point optimization
   */
  getMaxIterations(): number {
    return this.config.maxIterations;
  }

  /**
   * Check if debug mode is enabled.
   *
   * @returns true if debug logging is enabled
   */
  isDebugEnabled(): boolean {
    return this.config.debug;
  }

  /**
   * Create a pass-through result (no changes).
   *
   * Helper method for creating a result when no optimization is performed.
   *
   * @param module - The input module (returned unchanged)
   * @returns Pass-through optimization result
   */
  protected createPassThroughResult(module: AsmModule): AsmOptimizationResult {
    return {
      module,
      changed: false,
      iterations: 0,
      passStats: new Map(),
    };
  }

  /**
   * Log a debug message (if debug is enabled).
   *
   * @param message - Message to log
   */
  protected debug(message: string): void {
    if (this.config.debug) {
      console.log(`[AsmOptimizer] ${message}`);
    }
  }
}