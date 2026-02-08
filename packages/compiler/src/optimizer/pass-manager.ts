/**
 * Pass Manager for IL Optimizer
 *
 * Orchestrates the execution of optimization passes in the correct order.
 * Handles pass registration, dependency resolution, and iterative optimization.
 *
 * **Responsibilities:**
 * - Register optimization passes
 * - Order passes by dependencies (topological sort)
 * - Execute passes based on optimization level
 * - Track and report statistics
 * - Support iterative optimization (O3, Oz)
 *
 * @module optimizer/pass-manager
 */

import type { ILFunction } from '../il/structures.js';
import { runAnalysisPasses } from '../il/analysis.js';
import type {
  OptimizationOptions,
} from './options.js';
import {
  getDefaultOptions,
  resolveEnabledPasses,
  shouldIterate,
  getIterationCount,
} from './options.js';
import type {
  OptimizationPass,
  PassStats,
  OptimizationResult,
} from './pass.js';

// ============================================================================
// Pass Manager
// ============================================================================

/**
 * Manages and executes optimization passes.
 *
 * The PassManager is the core orchestrator for IL optimization.
 * It handles pass registration, dependency ordering, and execution
 * with support for iterative fixed-point optimization.
 *
 * **Usage:**
 * ```typescript
 * const manager = new PassManager({ level: 'O2' });
 * manager.registerPass(new DCEPass());
 * manager.registerPass(new ConstantFoldPass());
 *
 * const result = manager.optimize(func);
 * console.log(`Removed ${result.totalInstructionsRemoved} instructions`);
 * ```
 *
 * **Pass Ordering:**
 * Passes are automatically ordered by dependencies using topological sort.
 * If pass A depends on pass B, B runs before A.
 *
 * **Iterative Optimization:**
 * For O3 and Oz levels, passes run multiple times until no changes
 * are made or maxIterations is reached.
 */
export class PassManager {
  // ═══════════════════════════════════════════════════════════════════
  // Protected Properties
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Registered optimization passes.
   * Maps pass name to pass instance.
   */
  protected passes: Map<string, OptimizationPass> = new Map();

  /**
   * Optimization options.
   */
  protected options: OptimizationOptions;

  // ═══════════════════════════════════════════════════════════════════
  // Constructor
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a new PassManager.
   *
   * @param options - Optimization options (defaults to O2)
   *
   * @example
   * ```typescript
   * // Default O2 optimization
   * const manager = new PassManager();
   *
   * // Aggressive optimization
   * const manager = new PassManager({ level: 'O3' });
   *
   * // Debug mode
   * const manager = new PassManager({ level: 'O2', debug: true });
   * ```
   */
  constructor(options: OptimizationOptions = getDefaultOptions()) {
    this.options = options;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Pass Registration
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Register an optimization pass.
   *
   * Passes must be registered before optimization can use them.
   * Multiple passes can be registered; they'll be ordered by dependencies.
   *
   * @param pass - The optimization pass to register
   * @throws Error if a pass with the same name is already registered
   *
   * @example
   * ```typescript
   * manager.registerPass(new DCEPass());
   * manager.registerPass(new ConstantFoldPass());
   * ```
   */
  registerPass(pass: OptimizationPass): void {
    if (this.passes.has(pass.name)) {
      throw new Error(`Pass '${pass.name}' is already registered`);
    }
    this.passes.set(pass.name, pass);
  }

  /**
   * Check if a pass is registered.
   *
   * @param name - Pass name to check
   * @returns true if pass is registered
   */
  hasPass(name: string): boolean {
    return this.passes.has(name);
  }

  /**
   * Get a registered pass by name.
   *
   * @param name - Pass name
   * @returns The pass, or undefined if not registered
   */
  getPass(name: string): OptimizationPass | undefined {
    return this.passes.get(name);
  }

  /**
   * Get all registered pass names.
   *
   * @returns Array of registered pass names
   */
  getRegisteredPasses(): string[] {
    return [...this.passes.keys()];
  }

  // ═══════════════════════════════════════════════════════════════════
  // Pass Ordering
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get the names of passes enabled for the current options.
   *
   * Filters registered passes by what's enabled in options.
   *
   * @returns Array of enabled pass names
   */
  protected getEnabledPassNames(): string[] {
    const resolved = resolveEnabledPasses(this.options);
    // Only include passes that are actually registered
    return resolved.filter((name) => this.passes.has(name));
  }

  /**
   * Order passes by dependencies using topological sort.
   *
   * Ensures that if pass A depends on pass B, B runs before A.
   * Only returns passes that are enabled for the current options.
   *
   * @returns Array of passes in dependency order
   * @throws Error if circular dependencies are detected
   *
   * @example
   * ```typescript
   * // If copy-prop depends on constant-prop:
   * // getOrderedPasses() returns [constant-prop, copy-prop, ...]
   * ```
   */
  protected getOrderedPasses(): OptimizationPass[] {
    const enabledNames = this.getEnabledPassNames();
    const ordered: OptimizationPass[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>(); // For cycle detection

    /**
     * Depth-first visit for topological sort.
     * Visits dependencies before the pass itself.
     */
    const visit = (name: string): void => {
      // Skip if already processed
      if (visited.has(name)) {
        return;
      }

      // Cycle detection
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected involving pass '${name}'`);
      }

      // Get the pass
      const pass = this.passes.get(name);
      if (!pass) {
        // Pass not registered - skip silently
        // (dependencies might reference future passes)
        return;
      }

      // Mark as being visited (for cycle detection)
      visiting.add(name);

      // Visit dependencies first
      for (const dep of pass.dependencies) {
        // Only visit if dependency is enabled
        if (enabledNames.includes(dep) || this.passes.has(dep)) {
          visit(dep);
        }
      }

      // Done visiting this pass
      visiting.delete(name);
      visited.add(name);

      // Add to ordered list if enabled
      if (enabledNames.includes(name)) {
        ordered.push(pass);
      }
    };

    // Visit all enabled passes
    for (const name of enabledNames) {
      visit(name);
    }

    return ordered;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Optimization
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Run all enabled passes on a function.
   *
   * This is the main entry point for optimization.
   * Passes run in dependency order, with iterative optimization
   * for O3 and Oz levels.
   *
   * @param func - IL function to optimize (modified in place)
   * @returns Optimization result with statistics
   *
   * @example
   * ```typescript
   * const result = manager.optimize(func);
   *
   * if (result.modified) {
   *   console.log(`Optimized: ${result.totalInstructionsRemoved} removed`);
   * }
   * ```
   */
  optimize(func: ILFunction): OptimizationResult {
    const startTime = performance.now();

    // O0 = no optimization
    if (this.options.level === 'O0') {
      return this.createEmptyResult(startTime);
    }

    // Get ordered passes
    const passes = this.getOrderedPasses();
    if (passes.length === 0) {
      return this.createEmptyResult(startTime);
    }

    // Run optimization
    const stats: PassStats[] = [];
    let anyModified = false;
    let iterations = 0;
    const maxIter = getIterationCount(this.options);
    const iterate = shouldIterate(this.options.level);

    do {
      let iterModified = false;
      iterations++;

      for (const pass of passes) {
        // Re-run analysis before each pass to update liveIn/liveOut/hints
        runAnalysisPasses(func);

        // Record pre-pass state
        const instructionsBefore = func.instructions.length;
        const passStartTime = performance.now();

        // Run the pass
        const result = pass.run(func, this.options);
        const passEndTime = performance.now();

        // Track modifications
        if (result.modified) {
          iterModified = true;
          anyModified = true;
        }

        // Record statistics
        stats.push({
          pass: pass.name,
          iteration: iterations,
          instructionsBefore,
          instructionsAfter: func.instructions.length,
          modified: result.modified,
          durationMs: passEndTime - passStartTime,
        });

        // Debug output
        if (this.options.debug) {
          this.logPassResult(pass.name, iterations, result, instructionsBefore);
        }
      }

      // Stop if no changes this iteration (fixed point reached)
      if (!iterModified) {
        break;
      }

      // Only iterate for O3/Oz
      if (!iterate) {
        break;
      }
    } while (iterations < maxIter);

    return this.createResult(stats, anyModified, iterations, startTime);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Helper Methods
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create an empty optimization result (for O0 or no passes).
   *
   * @param startTime - Start time for duration calculation
   * @returns Empty OptimizationResult
   */
  protected createEmptyResult(startTime: number): OptimizationResult {
    return {
      modified: false,
      stats: [],
      totalIterations: 0,
      totalInstructionsRemoved: 0,
      totalInstructionsAdded: 0,
      totalDurationMs: performance.now() - startTime,
    };
  }

  /**
   * Create an optimization result from collected statistics.
   *
   * @param stats - Array of pass statistics
   * @param modified - Whether any modification was made
   * @param iterations - Number of iterations performed
   * @param startTime - Start time for duration calculation
   * @returns Aggregated OptimizationResult
   */
  protected createResult(
    stats: PassStats[],
    modified: boolean,
    iterations: number,
    startTime: number
  ): OptimizationResult {
    let totalRemoved = 0;
    let totalAdded = 0;

    for (const stat of stats) {
      const diff = stat.instructionsBefore - stat.instructionsAfter;
      if (diff > 0) {
        totalRemoved += diff;
      } else if (diff < 0) {
        totalAdded += -diff;
      }
    }

    return {
      modified,
      stats,
      totalIterations: iterations,
      totalInstructionsRemoved: totalRemoved,
      totalInstructionsAdded: totalAdded,
      totalDurationMs: performance.now() - startTime,
    };
  }

  /**
   * Log pass result for debugging.
   *
   * @param passName - Name of the pass
   * @param iteration - Current iteration number
   * @param result - Pass result
   * @param instructionsBefore - Instruction count before pass
   */
  protected logPassResult(
    passName: string,
    iteration: number,
    result: { modified: boolean; instructionsRemoved: number; instructionsAdded: number; debugInfo?: string[] },
    instructionsBefore: number
  ): void {
    const status = result.modified ? '✓ modified' : '- no change';
    console.log(
      `[${passName}] iter=${iteration} ${status} ` +
        `(${result.instructionsRemoved} removed, ${result.instructionsAdded} added, ` +
        `was ${instructionsBefore})`
    );

    if (result.debugInfo) {
      for (const info of result.debugInfo) {
        console.log(`  ${info}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Options Access
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get current optimization options.
   *
   * @returns Current OptimizationOptions
   */
  getOptions(): OptimizationOptions {
    return this.options;
  }

  /**
   * Update optimization options.
   *
   * @param options - New options to use
   */
  setOptions(options: OptimizationOptions): void {
    this.options = options;
  }
}