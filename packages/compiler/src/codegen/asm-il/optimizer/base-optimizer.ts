/**
 * Base ASM-IL Optimizer
 *
 * Abstract base class for ASM-IL optimizers.
 * Provides common infrastructure for running optimization passes,
 * including configuration management, pass-through mode, and debug logging.
 *
 * Subclasses implement the actual optimization strategy (e.g., sequential
 * pass execution with fixed-point iteration).
 *
 * @module codegen/asm-il/optimizer/base-optimizer
 */

import type { AsmILProgram } from '../types.js';
import type {
  AsmOptimizerConfig,
  AsmOptimizationPass,
  AsmOptimizationResult,
} from './types.js';
import { DEFAULT_ASM_OPTIMIZER_CONFIG } from './types.js';

/**
 * Abstract base class for ASM-IL optimizers.
 *
 * Provides shared infrastructure that all optimizer implementations need:
 * - Configuration management with sensible defaults
 * - Pass-through result creation for disabled/empty optimizers
 * - Debug logging support
 * - Pass list and iteration limit accessors
 *
 * The base class does NOT define how passes are executed — that's the
 * responsibility of concrete subclasses like `AsmOptimizer`.
 *
 * @example
 * ```typescript
 * class MyOptimizer extends BaseAsmOptimizer {
 *   optimize(program: AsmILProgram): AsmOptimizationResult {
 *     if (!this.isEnabled()) {
 *       return this.createPassThroughResult(program);
 *     }
 *     // Custom optimization logic...
 *   }
 * }
 * ```
 */
export abstract class BaseAsmOptimizer {
  /** Optimizer configuration — controls passes, iterations, and debug mode */
  protected readonly config: AsmOptimizerConfig;

  /**
   * Create a new optimizer with the given configuration.
   *
   * Missing config fields are filled from DEFAULT_ASM_OPTIMIZER_CONFIG.
   *
   * @param config - Partial configuration (merged with defaults)
   */
  constructor(config: Partial<AsmOptimizerConfig> = {}) {
    // Merge with defaults, but clone the passes array to avoid
    // shared mutation of the DEFAULT_ASM_OPTIMIZER_CONFIG.passes reference
    const merged = { ...DEFAULT_ASM_OPTIMIZER_CONFIG, ...config };
    this.config = {
      ...merged,
      passes: [...merged.passes],
    };
  }

  /**
   * Run all configured optimization passes on the program.
   *
   * Concrete subclasses define the execution strategy (sequential,
   * parallel, fixed-point iteration, etc.).
   *
   * @param program - The ASM-IL program to optimize
   * @returns Optimization result with statistics
   */
  abstract optimize(program: AsmILProgram): AsmOptimizationResult;

  /**
   * Check if optimization is enabled.
   *
   * When disabled, the optimizer should return a pass-through result
   * without running any passes.
   *
   * @returns true if optimization is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get the list of configured optimization passes.
   *
   * @returns Readonly array of optimization passes
   */
  getPasses(): readonly AsmOptimizationPass[] {
    return this.config.passes;
  }

  /**
   * Get the maximum iterations setting.
   *
   * Controls how many times the optimizer will loop through all passes
   * before stopping, even if changes are still being made.
   *
   * @returns Maximum iterations for fixed-point optimization
   */
  getMaxIterations(): number {
    return this.config.maxIterations;
  }

  /**
   * Check if debug mode is enabled.
   *
   * When enabled, the optimizer logs detailed information about
   * each pass execution and transformation.
   *
   * @returns true if debug logging is enabled
   */
  isDebugEnabled(): boolean {
    return this.config.debug;
  }

  /**
   * Create a pass-through result (no optimization performed).
   *
   * Helper for when the optimizer is disabled or has no passes configured.
   * Returns the input program unchanged with zero statistics.
   *
   * @param program - The input program (returned unchanged)
   * @returns Pass-through optimization result
   */
  protected createPassThroughResult(program: AsmILProgram): AsmOptimizationResult {
    return {
      program,
      changed: false,
      iterations: 0,
      passStats: new Map(),
    };
  }

  /**
   * Log a debug message (if debug mode is enabled).
   *
   * All debug output is prefixed with `[AsmILOptimizer]` for easy
   * filtering in console output.
   *
   * @param message - Message to log
   */
  protected debug(message: string): void {
    if (this.config.debug) {
      console.log(`[AsmILOptimizer] ${message}`);
    }
  }
}
