/**
 * ASM-IL Optimizer (Pass Manager)
 *
 * Concrete optimizer implementation that runs configured optimization passes
 * in sequential order with fixed-point iteration support.
 *
 * **Fixed-Point Iteration:**
 * The optimizer runs all passes in order, then checks if any pass made changes.
 * If changes occurred AND we haven't exceeded maxIterations, it runs all passes
 * again. This continues until either no changes are made (fixed-point reached)
 * or the iteration limit is hit.
 *
 * This is important because one pass's output can create new optimization
 * opportunities for another pass. For example, store-load elimination might
 * expose new dead flag patterns.
 *
 * @module codegen/asm-il/optimizer/asm-optimizer
 */

import type { AsmILProgram } from '../types.js';
import type {
  AsmOptimizerConfig,
  AsmOptimizationPass,
  AsmOptimizationResult,
  AsmPassStatistics,
} from './types.js';
import {
  createEmptyPassStatistics,
  accumulatePassStats,
} from './types.js';
import { BaseAsmOptimizer } from './base-optimizer.js';

/**
 * Concrete ASM-IL optimizer with sequential pass manager.
 *
 * Runs configured optimization passes in order, tracking per-pass statistics
 * and supporting fixed-point iteration for aggressive optimization levels.
 *
 * **Usage:**
 * - Create with a config specifying passes and iteration limits
 * - Call `optimize()` with an AsmILProgram
 * - Inspect the result for statistics and the optimized program
 *
 * **Fluent API:**
 * Supports chaining for programmatic configuration:
 * ```typescript
 * const optimizer = createAsmOptimizer()
 *   .setEnabled(true)
 *   .addPass(new FlagPatternsPass())
 *   .addPass(new StoreLoadPass())
 *   .setMaxIterations(3);
 * ```
 *
 * @example
 * ```typescript
 * const optimizer = createAsmOptimizer({
 *   enabled: true,
 *   passes: [flagPass, storeLoadPass],
 *   maxIterations: 3,
 * });
 *
 * const result = optimizer.optimize(asmProgram);
 * console.log(`Changed: ${result.changed}, Iterations: ${result.iterations}`);
 * ```
 */
export class AsmOptimizer extends BaseAsmOptimizer {
  /**
   * Create a new optimizer with the given configuration.
   *
   * @param config - Partial configuration (merged with defaults)
   */
  constructor(config: Partial<AsmOptimizerConfig> = {}) {
    super(config);
  }

  /**
   * Run all optimization passes on the program.
   *
   * **Behavior:**
   * - If optimization is disabled → returns pass-through result
   * - If no passes are configured → returns pass-through result
   * - Otherwise → runs passes in order with fixed-point iteration
   *
   * **Fixed-Point Convergence:**
   * Each iteration runs all passes sequentially. If any pass reports
   * `changed: true`, another iteration is attempted (up to maxIterations).
   * When no pass reports changes, the optimizer has reached a fixed point.
   *
   * @param program - The ASM-IL program to optimize
   * @returns Optimization result with the optimized program and statistics
   */
  optimize(program: AsmILProgram): AsmOptimizationResult {
    // Pass-through if disabled
    if (!this.isEnabled()) {
      this.debug('Optimization disabled, returning pass-through result');
      return this.createPassThroughResult(program);
    }

    // No passes configured — nothing to do
    if (this.config.passes.length === 0) {
      this.debug('No passes configured, returning pass-through result');
      return this.createPassThroughResult(program);
    }

    // Initialize aggregate stats for each pass
    const passStats = new Map<string, AsmPassStatistics>();
    for (const pass of this.config.passes) {
      passStats.set(pass.name, createEmptyPassStatistics(pass.name));
    }

    let currentProgram = program;
    let changed = false;
    let iterations = 0;

    this.debug(
      `Starting optimization with ${this.config.passes.length} passes, ` +
      `max ${this.config.maxIterations} iteration(s)`
    );

    // Fixed-point iteration loop
    for (let i = 0; i < this.config.maxIterations; i++) {
      iterations++;
      let iterationChanged = false;

      this.debug(`--- Iteration ${iterations}/${this.config.maxIterations} ---`);

      // Run each pass in sequence
      for (const pass of this.config.passes) {
        const startTime = performance.now();
        const result = pass.run(currentProgram);
        const endTime = performance.now();
        const durationMs = endTime - startTime;

        // Accumulate statistics for this pass
        const aggregate = passStats.get(pass.name)!;
        accumulatePassStats(aggregate, result, durationMs);

        this.debug(
          `  Pass "${pass.name}": ${result.changed ? 'CHANGED' : 'unchanged'} ` +
          `(${result.stats.patternsMatched} patterns, ${durationMs.toFixed(2)}ms)`
        );

        // Update program if pass made changes
        if (result.changed) {
          currentProgram = result.program;
          iterationChanged = true;
          changed = true;
        }
      }

      // Fixed-point: stop if no pass made changes this iteration
      if (!iterationChanged) {
        this.debug(`Fixed-point reached after ${iterations} iteration(s)`);
        break;
      }
    }

    // Log summary if we hit the iteration limit
    if (iterations === this.config.maxIterations && changed) {
      this.debug(
        `Iteration limit reached (${this.config.maxIterations}). ` +
        `May not have reached fixed-point.`
      );
    }

    this.debug(
      `Optimization complete: changed=${changed}, iterations=${iterations}`
    );

    return {
      program: currentProgram,
      changed,
      iterations,
      passStats,
    };
  }

  /**
   * Add an optimization pass to the end of the pass list.
   *
   * Passes are executed in the order they are added. Order matters because
   * earlier passes can create opportunities for later passes.
   *
   * @param pass - The pass to add
   * @returns this for chaining
   */
  addPass(pass: AsmOptimizationPass): this {
    this.config.passes.push(pass);
    return this;
  }

  /**
   * Remove an optimization pass by name.
   *
   * No-op if the pass doesn't exist.
   *
   * @param name - Name of the pass to remove
   * @returns this for chaining
   */
  removePass(name: string): this {
    const index = this.config.passes.findIndex((p) => p.name === name);
    if (index !== -1) {
      this.config.passes.splice(index, 1);
    }
    return this;
  }

  /**
   * Enable or disable the optimizer.
   *
   * When disabled, `optimize()` returns the input program unchanged.
   *
   * @param enabled - Whether to enable optimization
   * @returns this for chaining
   */
  setEnabled(enabled: boolean): this {
    (this.config as { enabled: boolean }).enabled = enabled;
    return this;
  }

  /**
   * Set the maximum number of fixed-point iterations.
   *
   * Higher values allow more aggressive optimization at the cost of
   * compile time. Typical values: 1 (O1/O2), 3-5 (O3/Oz).
   *
   * @param maxIterations - Maximum iterations for fixed-point optimization
   * @returns this for chaining
   */
  setMaxIterations(maxIterations: number): this {
    (this.config as { maxIterations: number }).maxIterations = maxIterations;
    return this;
  }

  /**
   * Enable or disable debug logging.
   *
   * When enabled, detailed logs are printed for each pass execution.
   *
   * @param debug - Whether to enable debug logging
   * @returns this for chaining
   */
  setDebug(debug: boolean): this {
    (this.config as { debug: boolean }).debug = debug;
    return this;
  }
}

/**
 * Factory function to create an optimizer with default config.
 *
 * Convenience for creating an optimizer without manually constructing
 * the class. The config is merged with defaults.
 *
 * @param config - Optional partial configuration
 * @returns New AsmOptimizer instance
 *
 * @example
 * ```typescript
 * // Create with defaults (disabled, no passes)
 * const opt1 = createAsmOptimizer();
 *
 * // Create with specific config
 * const opt2 = createAsmOptimizer({
 *   enabled: true,
 *   passes: [new FlagPatternsPass()],
 *   maxIterations: 3,
 * });
 * ```
 */
export function createAsmOptimizer(
  config?: Partial<AsmOptimizerConfig>
): AsmOptimizer {
  return new AsmOptimizer(config);
}
