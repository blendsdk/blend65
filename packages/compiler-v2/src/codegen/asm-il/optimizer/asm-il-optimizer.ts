/**
 * ASM-IL Optimizer (Level-Based)
 *
 * High-level optimizer that wraps the pass manager (AsmOptimizer) with
 * optimization level support. This is the primary entry point for the
 * compilation pipeline — callers specify a level (O0-Oz) and the
 * optimizer automatically configures the appropriate passes and settings.
 *
 * **Architecture:**
 * ```
 * AsmILOptimizer (level-based config)
 *   └── AsmOptimizer (pass manager)
 *         └── AsmOptimizationPass[] (individual passes)
 * ```
 *
 * The AsmILOptimizer translates high-level options (optimization level,
 * ZP slots, debug mode) into concrete pass manager configuration via
 * the pass factory. This separation allows the pass manager to remain
 * level-agnostic while the AsmILOptimizer handles the level→passes mapping.
 *
 * @module codegen/asm-il/optimizer/asm-il-optimizer
 */

import type { AsmILProgram } from '../types.js';
import type { AsmOptimizationPass, AsmOptimizationResult } from './types.js';
import type { AsmOptimizerOptions } from './options.js';
import { OptimizationLevel, resolveOptions, isOptimizationEnabled } from './options.js';
import { createPassesForLevel } from './pass-factory.js';
import { createAsmOptimizer } from './asm-optimizer.js';
import type { AsmOptimizer } from './asm-optimizer.js';

/**
 * Level-based ASM-IL optimizer for compiler-v2.
 *
 * This is the recommended way to use the ASM-IL optimizer. Callers
 * provide an optimization level and optional overrides, and the
 * optimizer handles all configuration internally.
 *
 * **Usage:**
 * ```typescript
 * // Simple: use default O2 settings
 * const optimizer = new AsmILOptimizer();
 * const result = optimizer.optimize(program);
 *
 * // Custom: O3 with specific ZP slots
 * const optimizer = new AsmILOptimizer({
 *   level: OptimizationLevel.O3,
 *   zpSlots: [0x50, 0x51, 0x52, 0x53],
 * });
 * ```
 *
 * **Pipeline Integration:**
 * ```typescript
 * // In compilation pipeline
 * const asmOptimizer = createAsmILOptimizer(compilerOptions.optimizationLevel);
 * const optimizedAsm = asmOptimizer.optimize(generatedAsm);
 * ```
 */
export class AsmILOptimizer {
  /** Resolved options (merged from user overrides and level defaults) */
  protected readonly options: AsmOptimizerOptions;

  /** The underlying pass manager that executes optimization passes */
  protected readonly optimizer: AsmOptimizer;

  /**
   * Create a new level-based optimizer.
   *
   * Options are merged with the defaults for the specified level.
   * If no level is specified, O2 is used as the default.
   *
   * The pass factory is called to create the appropriate passes
   * for the resolved level, and the underlying AsmOptimizer is
   * configured accordingly.
   *
   * @param options - Partial options (merged with level defaults)
   */
  constructor(options: Partial<AsmOptimizerOptions> = {}) {
    // Resolve full options from partial overrides + level defaults
    this.options = resolveOptions(options);

    // Create passes for the resolved level
    const passes = createPassesForLevel(this.options);

    // Configure the underlying pass manager
    this.optimizer = createAsmOptimizer({
      enabled: isOptimizationEnabled(this.options.level),
      passes,
      maxIterations: this.options.maxIterations,
      debug: this.options.debug,
    });
  }

  /**
   * Optimize an ASM-IL program.
   *
   * Delegates to the underlying pass manager which runs all configured
   * passes with fixed-point iteration support.
   *
   * **Behavior by level:**
   * - O0: Returns program unchanged (pass-through)
   * - O1+: Runs level-appropriate passes, returns optimized program
   *
   * @param program - The ASM-IL program to optimize
   * @returns Optimization result with the optimized program and statistics
   */
  optimize(program: AsmILProgram): AsmOptimizationResult {
    return this.optimizer.optimize(program);
  }

  /**
   * Get the configured optimization level.
   *
   * @returns The optimization level this optimizer was created with
   */
  getLevel(): OptimizationLevel {
    return this.options.level;
  }

  /**
   * Get the resolved options (including level defaults).
   *
   * Returns a copy to prevent external mutation.
   *
   * @returns Copy of the resolved optimizer options
   */
  getOptions(): AsmOptimizerOptions {
    return {
      ...this.options,
      zpSlots: [...this.options.zpSlots],
    };
  }

  /**
   * Get the list of configured optimization passes.
   *
   * The passes are determined by the optimization level and
   * created by the pass factory during construction.
   *
   * @returns Readonly array of optimization passes
   */
  getPasses(): readonly AsmOptimizationPass[] {
    return this.optimizer.getPasses();
  }

  /**
   * Check if optimization is enabled.
   *
   * Returns false only for O0 level.
   *
   * @returns true if any optimization passes will run
   */
  isEnabled(): boolean {
    return this.optimizer.isEnabled();
  }

  /**
   * Check if debug mode is enabled.
   *
   * @returns true if debug logging is active
   */
  isDebugEnabled(): boolean {
    return this.optimizer.isDebugEnabled();
  }

  /**
   * Get the maximum iterations setting.
   *
   * @returns Maximum fixed-point iterations
   */
  getMaxIterations(): number {
    return this.optimizer.getMaxIterations();
  }

  /**
   * Get the available zero-page slots.
   *
   * Returns a copy to prevent external mutation.
   *
   * @returns Array of zero-page addresses available for promotion
   */
  getZpSlots(): number[] {
    return [...this.options.zpSlots];
  }
}

/**
 * Factory function to create a level-based optimizer.
 *
 * Convenience for creating an AsmILOptimizer with a specific level
 * and optional overrides. This is the recommended entry point for
 * the compilation pipeline.
 *
 * @param level - Optimization level (default: O2)
 * @param options - Additional option overrides
 * @returns New AsmILOptimizer instance
 *
 * @example
 * ```typescript
 * // Default O2
 * const opt1 = createAsmILOptimizer();
 *
 * // Specific level
 * const opt2 = createAsmILOptimizer(OptimizationLevel.O3);
 *
 * // Level with overrides
 * const opt3 = createAsmILOptimizer(OptimizationLevel.Os, {
 *   zpSlots: [0x60, 0x61],
 *   debug: true,
 * });
 * ```
 */
export function createAsmILOptimizer(
  level: OptimizationLevel = OptimizationLevel.O2,
  options: Partial<AsmOptimizerOptions> = {}
): AsmILOptimizer {
  return new AsmILOptimizer({ level, ...options });
}
