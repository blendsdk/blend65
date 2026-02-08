/**
 * Optimizer - Main optimization pipeline for IL modules
 *
 * This module provides the optimization pipeline for transforming IL modules.
 * At all optimization levels, required lowering passes are run to transform
 * high-level intrinsics into code-generator-compatible instructions.
 *
 * Required passes (run at ALL levels including O0):
 * - IntrinsicLoweringPass: Transforms peek/poke to hardware read/write
 *
 * Optional optimization passes (O1+):
 * - (Future: DCE, constant folding, etc.)
 *
 * @module optimizer/optimizer
 */

import type { ILModule } from '../il/module.js';
import {
  OptimizationLevel,
  OptimizationOptions,
  createDefaultOptions,
  isLevelImplemented,
} from './options.js';
import { IntrinsicLoweringPass } from './intrinsic-lowering-pass.js';

/**
 * Result of an optimization run.
 *
 * Contains the optimized module and statistics about what was done.
 */
export interface OptimizationResult {
  /**
   * The optimized IL module.
   * At O0, this is the same module unchanged.
   */
  module: ILModule;

  /**
   * Whether any optimizations were applied.
   * At O0, this is always false.
   */
  modified: boolean;

  /**
   * Optimization level that was used.
   */
  level: OptimizationLevel;

  /**
   * List of passes that were run (empty at O0).
   */
  passesRun: string[];

  /**
   * Total optimization time in milliseconds.
   */
  timeMs: number;

  /**
   * Warnings generated during optimization.
   */
  warnings: string[];
}

/**
 * IL Module Optimizer.
 *
 * The optimizer transforms IL modules to produce more efficient code.
 * Currently only O0 (no optimization) is implemented as a pass-through.
 *
 * @remarks
 * This is a minimal stub implementation that allows the compiler chain
 * to be completed. Full optimization passes will be implemented later
 * according to the optimizer planning documents in `plans/optimizer/`.
 *
 * The optimization architecture follows a pass-based design:
 * - Analysis passes: Read-only passes that gather information
 * - Transform passes: Passes that modify the IL
 *
 * Future optimization levels will enable different sets of passes:
 * - O1: Basic optimizations (DCE, constant folding)
 * - O2: Standard optimizations (CSE, peephole patterns)
 * - O3: Aggressive optimizations (loop unrolling, inlining)
 * - Os/Oz: Size-focused optimizations
 *
 * @example
 * ```typescript
 * // Create optimizer with default options (O0)
 * const optimizer = new Optimizer();
 *
 * // Optimize a module (currently pass-through)
 * const result = optimizer.optimize(ilModule);
 *
 * // Use the result
 * console.log(`Modified: ${result.modified}`);
 * console.log(`Time: ${result.timeMs}ms`);
 * ```
 *
 * @example
 * ```typescript
 * // Create optimizer with verbose output
 * const optimizer = new Optimizer({
 *   level: OptimizationLevel.O0,
 *   verbose: true,
 * });
 *
 * const result = optimizer.optimize(ilModule);
 * ```
 */
export class Optimizer {
  /** Optimization options */
  protected readonly options: OptimizationOptions;

  /**
   * Creates a new Optimizer instance.
   *
   * @param options - Optimization options. Defaults to O0 if not provided.
   */
  constructor(options?: Partial<OptimizationOptions>) {
    this.options = {
      ...createDefaultOptions(),
      ...options,
    };

    // Warn if using an unimplemented optimization level
    if (!isLevelImplemented(this.options.level)) {
      if (this.options.verbose) {
        console.warn(
          `[Optimizer] Optimization level ${OptimizationLevel[this.options.level]} is not yet implemented. ` +
            `Falling back to O0 (no optimization).`,
        );
      }
    }
  }

  /**
   * Gets the current optimization level.
   *
   * @returns The optimization level
   */
  getLevel(): OptimizationLevel {
    return this.options.level;
  }

  /**
   * Gets the current optimization options.
   *
   * @returns A copy of the optimization options
   */
  getOptions(): OptimizationOptions {
    return { ...this.options };
  }

  /**
   * Optimizes an IL module.
   *
   * At ALL levels (including O0), required lowering passes are run:
   * - IntrinsicLoweringPass: Transforms peek/poke to hardware read/write
   *
   * At O1+, additional optimization passes will be applied.
   *
   * @param module - The IL module to optimize
   * @returns The optimization result containing the (possibly modified) module
   *
   * @example
   * ```typescript
   * const optimizer = new Optimizer();
   * const result = optimizer.optimize(ilModule);
   *
   * // Intrinsic lowering is always run
   * console.log(result.passesRun); // ['IntrinsicLoweringPass']
   * ```
   */
  optimize(module: ILModule): OptimizationResult {
    const startTime = performance.now();
    const warnings: string[] = [];
    const passesRun: string[] = [];
    let modified = false;

    if (this.options.verbose) {
      console.log(
        `[Optimizer] Starting optimization of module '${module.name}' at level ${OptimizationLevel[this.options.level]}`,
      );
    }

    // =========================================================================
    // Required Lowering Passes (run at ALL levels including O0)
    // =========================================================================

    // Run intrinsic lowering pass - transforms peek/poke to hardware read/write
    // This is REQUIRED for code generation to work correctly
    const intrinsicLoweringPass = new IntrinsicLoweringPass(this.options.verbose);
    const loweringResult = intrinsicLoweringPass.run(module);

    passesRun.push('IntrinsicLoweringPass');
    warnings.push(...loweringResult.warnings);

    if (loweringResult.modified) {
      modified = true;
      if (this.options.verbose) {
        console.log('[Optimizer] IntrinsicLoweringPass modified the module');
        console.log('[Optimizer] Stats:', loweringResult.stats);
      }
    }

    // =========================================================================
    // Optional Optimization Passes (O1+)
    // =========================================================================

    // At O0 or unimplemented levels, skip optional optimizations
    if (this.options.level === OptimizationLevel.O0 || !isLevelImplemented(this.options.level)) {
      if (this.options.verbose) {
        console.log('[Optimizer] O0 level: skipping optional optimizations');
      }

      const endTime = performance.now();

      return {
        module,
        modified,
        level: this.options.level,
        passesRun,
        timeMs: endTime - startTime,
        warnings,
      };
    }

    // Future: Run optional optimization passes based on level
    // This will be implemented later according to the optimizer architecture

    const endTime = performance.now();

    return {
      module,
      modified,
      level: this.options.level,
      passesRun,
      timeMs: endTime - startTime,
      warnings,
    };
  }

  /**
   * Validates that the optimizer can process the given module.
   *
   * Checks that the module is in a valid state for optimization.
   *
   * @param module - The IL module to validate
   * @returns Array of error messages (empty if valid)
   */
  validateModule(module: ILModule): string[] {
    const errors: string[] = [];

    // Delegate to the module's built-in validation
    const moduleErrors = module.validate();
    errors.push(...moduleErrors);

    return errors;
  }

  /**
   * Returns a string representation of the optimizer.
   *
   * @returns Description of the optimizer configuration
   */
  toString(): string {
    return `Optimizer(level=${OptimizationLevel[this.options.level]})`;
  }
}

/**
 * Creates an optimizer with default options (O0 - no optimization).
 *
 * Convenience function for creating a pass-through optimizer.
 *
 * @returns A new Optimizer instance with O0 level
 *
 * @example
 * ```typescript
 * const optimizer = createDefaultOptimizer();
 * const result = optimizer.optimize(module);
 * ```
 */
export function createDefaultOptimizer(): Optimizer {
  return new Optimizer(createDefaultOptions());
}

/**
 * Creates an optimizer for the specified optimization level.
 *
 * @param level - The optimization level
 * @returns A new Optimizer instance for that level
 *
 * @remarks
 * Currently all levels behave as O0 (pass-through) since
 * optimization passes are not yet implemented.
 *
 * @example
 * ```typescript
 * const optimizer = createOptimizerForLevel(OptimizationLevel.O2);
 * const result = optimizer.optimize(module);
 * ```
 */
export function createOptimizerForLevel(level: OptimizationLevel): Optimizer {
  return new Optimizer({ level });
}