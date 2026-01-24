/**
 * ASM-IL Optimizer
 *
 * Concrete optimizer implementation with pass manager.
 * Runs configured optimization passes in order.
 *
 * @module asm-il/optimizer/asm-optimizer
 */

import type { AsmModule } from '../types.js';
import type {
  AsmOptimizerConfig,
  AsmOptimizationPass,
  AsmOptimizationResult,
  AsmPassStatistics,
} from './types.js';
import { BaseAsmOptimizer } from './base-optimizer.js';

/**
 * Concrete ASM-IL optimizer with pass manager.
 *
 * Runs configured optimization passes in order, tracking statistics
 * and supporting fixed-point iteration.
 *
 * @example
 * ```typescript
 * const optimizer = createAsmOptimizer({
 *   enabled: true,
 *   passes: [myPass1, myPass2],
 *   maxIterations: 3
 * });
 *
 * const result = optimizer.optimize(asmModule);
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
   * Run all optimization passes on the module.
   *
   * If optimization is disabled, returns a pass-through result.
   * Otherwise, runs passes in order until no changes are made
   * or maxIterations is reached.
   *
   * @param module - The module to optimize
   * @returns Optimization result with statistics
   */
  optimize(module: AsmModule): AsmOptimizationResult {
    // Pass-through if disabled
    if (!this.isEnabled()) {
      this.debug('Optimization disabled, returning pass-through result');
      return this.createPassThroughResult(module);
    }

    // No passes configured
    if (this.config.passes.length === 0) {
      this.debug('No passes configured, returning pass-through result');
      return this.createPassThroughResult(module);
    }

    // Run passes
    const passStats = new Map<string, AsmPassStatistics>();
    let currentModule = module;
    let changed = false;
    let iterations = 0;

    this.debug(`Starting optimization with ${this.config.passes.length} passes`);

    for (let i = 0; i < this.config.maxIterations; i++) {
      iterations++;
      let iterationChanged = false;

      this.debug(`Iteration ${iterations}/${this.config.maxIterations}`);

      for (const pass of this.config.passes) {
        const startTime = performance.now();
        const result = pass.run(currentModule);
        const endTime = performance.now();
        const timeMs = endTime - startTime;

        // Track statistics
        const existing = passStats.get(pass.name);
        const passChanged = result !== currentModule;
        const stats: AsmPassStatistics = {
          name: pass.name,
          transformations: (existing?.transformations ?? 0) + (passChanged ? 1 : 0),
          timeMs: (existing?.timeMs ?? 0) + timeMs,
        };
        passStats.set(pass.name, stats);

        this.debug(`  Pass "${pass.name}": ${passChanged ? 'changed' : 'unchanged'} (${timeMs.toFixed(2)}ms)`);

        // Check if changed
        if (passChanged) {
          currentModule = result;
          iterationChanged = true;
          changed = true;
        }
      }

      // Fixed-point: stop if no changes this iteration
      if (!iterationChanged) {
        this.debug(`Fixed-point reached after ${iterations} iteration(s)`);
        break;
      }
    }

    this.debug(`Optimization complete: changed=${changed}, iterations=${iterations}`);

    return {
      module: currentModule,
      changed,
      iterations,
      passStats,
    };
  }

  /**
   * Add an optimization pass to the end of the pass list.
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
   * @param enabled - Whether to enable optimization
   * @returns this for chaining
   */
  setEnabled(enabled: boolean): this {
    (this.config as { enabled: boolean }).enabled = enabled;
    return this;
  }

  /**
   * Set the maximum number of iterations.
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
 * @param config - Optional partial configuration
 * @returns New AsmOptimizer instance
 */
export function createAsmOptimizer(
  config?: Partial<AsmOptimizerConfig>,
): AsmOptimizer {
  return new AsmOptimizer(config);
}