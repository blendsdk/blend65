/**
 * IL Optimizer Entry Point
 *
 * High-level API for IL optimization. Provides a simple interface
 * for optimizing IL functions and programs.
 *
 * **Usage:**
 * ```typescript
 * const optimizer = new ILOptimizer({ level: 'O2' });
 * const optimizedProgram = optimizer.optimizeProgram(ilProgram);
 * ```
 *
 * **Architecture:**
 * ```
 * ILProgram (from IL Generator)
 *          ↓
 *    ILOptimizer
 *          ↓
 *    PassManager → [DCE] → [ConstFold] → [ConstProp] → ...
 *          ↓
 * Optimized ILProgram (to CodeGen)
 * ```
 *
 * @module optimizer/il-optimizer
 */

import type { ILFunction, ILProgram } from '../il/structures.js';
import type { OptimizationOptions } from './options.js';
import { getDefaultOptions } from './options.js';
import { PassManager } from './pass-manager.js';
import type { OptimizationResult } from './pass.js';

// ============================================================================
// IL Optimizer
// ============================================================================

/**
 * High-level IL optimizer.
 *
 * Provides a simple interface for optimizing IL code. Internally uses
 * PassManager to run optimization passes in the correct order.
 *
 * **Optimization Flow:**
 * 1. User creates ILOptimizer with desired options
 * 2. Passes are automatically registered based on level
 * 3. User calls optimizeProgram() or optimizeFunction()
 * 4. PassManager runs passes in dependency order
 * 5. Optimized IL is returned (same object, modified in place)
 *
 * @example
 * ```typescript
 * // Basic usage
 * const optimizer = new ILOptimizer({ level: 'O2' });
 * const optimized = optimizer.optimizeProgram(ilProgram);
 *
 * // Check what was optimized
 * const result = optimizer.getLastResult();
 * console.log(`Removed ${result.totalInstructionsRemoved} instructions`);
 * ```
 */
export class ILOptimizer {
  // ═══════════════════════════════════════════════════════════════════
  // Protected Properties
  // ═══════════════════════════════════════════════════════════════════

  /**
   * The pass manager that handles pass execution.
   */
  protected passManager: PassManager;

  /**
   * Result from the last optimization run.
   */
  protected lastResult?: OptimizationResult;

  /**
   * Aggregated result across all functions in a program optimization.
   */
  protected programResult?: ProgramOptimizationResult;

  // ═══════════════════════════════════════════════════════════════════
  // Constructor
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a new ILOptimizer.
   *
   * @param options - Optimization options (defaults to O2)
   *
   * @example
   * ```typescript
   * // Default O2 optimization
   * const optimizer = new ILOptimizer();
   *
   * // Aggressive optimization
   * const optimizer = new ILOptimizer({ level: 'O3' });
   *
   * // No optimization (useful for debugging)
   * const optimizer = new ILOptimizer({ level: 'O0' });
   *
   * // Size optimization
   * const optimizer = new ILOptimizer({ level: 'Os' });
   * ```
   */
  constructor(options?: OptimizationOptions) {
    this.passManager = new PassManager(options ?? getDefaultOptions());
    this.registerDefaultPasses();
  }

  // ═══════════════════════════════════════════════════════════════════
  // Pass Registration
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Register default optimization passes.
   *
   * Called automatically during construction.
   * Override in subclass to customize pass registration.
   *
   * @remarks
   * Currently empty - passes are registered when implemented.
   * Will register: DCE, ConstantFold, ConstantProp, CopyProp, ILPeephole
   */
  protected registerDefaultPasses(): void {
    // Passes will be registered here as they are implemented:
    // this.passManager.registerPass(new DCEPass());
    // this.passManager.registerPass(new ConstantFoldPass());
    // this.passManager.registerPass(new ConstantPropPass());
    // this.passManager.registerPass(new CopyPropPass());
    // this.passManager.registerPass(new ILPeepholePass());
  }

  /**
   * Get the pass manager for advanced configuration.
   *
   * Allows direct access to register custom passes or modify settings.
   *
   * @returns The PassManager instance
   *
   * @example
   * ```typescript
   * const optimizer = new ILOptimizer();
   * const manager = optimizer.getPassManager();
   * manager.registerPass(new CustomPass());
   * ```
   */
  getPassManager(): PassManager {
    return this.passManager;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Function Optimization
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Optimize a single IL function.
   *
   * Runs all enabled optimization passes on the function.
   * The function is modified in place.
   *
   * @param func - IL function to optimize
   * @returns The same function (for chaining)
   *
   * @example
   * ```typescript
   * const optimizedFunc = optimizer.optimizeFunction(mainFunc);
   * ```
   */
  optimizeFunction(func: ILFunction): ILFunction {
    this.lastResult = this.passManager.optimize(func);
    return func;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Program Optimization
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Optimize all functions in an IL program.
   *
   * Runs optimization passes on each function in the program.
   * The program and its functions are modified in place.
   *
   * @param program - IL program to optimize
   * @returns The same program (for chaining)
   *
   * @example
   * ```typescript
   * // In compiler pipeline:
   * const ilProgram = ilGenerator.generate(ast, frames);
   * const optimizedProgram = optimizer.optimizeProgram(ilProgram);
   * const asm = codeGenerator.generate(optimizedProgram);
   * ```
   */
  optimizeProgram(program: ILProgram): ILProgram {
    const startTime = performance.now();
    const functionResults: FunctionOptimizationResult[] = [];
    let totalModified = false;
    let totalRemoved = 0;
    let totalAdded = 0;

    // Optimize each function
    for (const func of program.functions) {
      const result = this.passManager.optimize(func);

      functionResults.push({
        functionName: func.name,
        result,
      });

      if (result.modified) {
        totalModified = true;
      }
      totalRemoved += result.totalInstructionsRemoved;
      totalAdded += result.totalInstructionsAdded;
    }

    // Store aggregate result
    this.programResult = {
      modified: totalModified,
      functionResults,
      totalInstructionsRemoved: totalRemoved,
      totalInstructionsAdded: totalAdded,
      totalDurationMs: performance.now() - startTime,
    };

    // Update program statistics
    this.updateProgramStats(program);

    return program;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Results Access
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get the result from the last function optimization.
   *
   * @returns OptimizationResult or undefined if no optimization was run
   *
   * @example
   * ```typescript
   * optimizer.optimizeFunction(func);
   * const result = optimizer.getLastResult();
   * if (result?.modified) {
   *   console.log('Function was optimized');
   * }
   * ```
   */
  getLastResult(): OptimizationResult | undefined {
    return this.lastResult;
  }

  /**
   * Get the result from the last program optimization.
   *
   * @returns ProgramOptimizationResult or undefined
   *
   * @example
   * ```typescript
   * optimizer.optimizeProgram(program);
   * const result = optimizer.getProgramResult();
   * console.log(`Total removed: ${result?.totalInstructionsRemoved}`);
   * ```
   */
  getProgramResult(): ProgramOptimizationResult | undefined {
    return this.programResult;
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
    return this.passManager.getOptions();
  }

  /**
   * Update optimization options.
   *
   * @param options - New options to use
   */
  setOptions(options: OptimizationOptions): void {
    this.passManager.setOptions(options);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Helper Methods
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Update program-level statistics after optimization.
   *
   * @param program - Program to update statistics for
   */
  protected updateProgramStats(program: ILProgram): void {
    // Recalculate instruction count
    let totalInstructions = 0;
    let totalCycles = 0;

    for (const func of program.functions) {
      totalInstructions += func.instructions.length;

      // Sum up estimated cycles if available
      for (const instr of func.instructions) {
        if (instr.cost) {
          totalCycles += instr.cost.cycles;
        }
      }
    }

    // Update program (cast to mutable for update)
    // Note: ILProgram has mutable instructionCount/totalEstimatedCycles
    (program as { instructionCount: number }).instructionCount = totalInstructions;
    (program as { totalEstimatedCycles: number }).totalEstimatedCycles = totalCycles;
  }
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Optimization result for a single function within a program.
 */
export interface FunctionOptimizationResult {
  /** Function name */
  functionName: string;

  /** Optimization result for this function */
  result: OptimizationResult;
}

/**
 * Aggregated result from optimizing an entire program.
 */
export interface ProgramOptimizationResult {
  /** Whether any function was modified */
  modified: boolean;

  /** Results for each function */
  functionResults: FunctionOptimizationResult[];

  /** Total instructions removed across all functions */
  totalInstructionsRemoved: number;

  /** Total instructions added across all functions */
  totalInstructionsAdded: number;

  /** Total optimization time in milliseconds */
  totalDurationMs: number;
}