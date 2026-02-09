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
import { getDefaultOptions, resolveProgramPasses } from './options.js';
import { PassManager } from './pass-manager.js';
import type { OptimizationResult, ProgramOptimizationPass, ProgramPassResult } from './pass.js';
import { DCEPass } from './passes/dce.js';
import { ConstantFoldPass } from './passes/constant-fold.js';
import { ConstantPropPass } from './passes/constant-prop.js';
import { CopyPropPass } from './passes/copy-prop.js';
import { ILPeepholePass } from './passes/il-peephole.js';
import { CSEPass } from './passes/cse/index.js';
import { DeadFunctionElimPass } from './passes/dead-function-elim.js';
import { DeadGlobalElimPass } from './passes/dead-global-elim.js';
import { FunctionInliningPass } from './passes/function-inlining.js';

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

  /**
   * Registered program-level optimization passes.
   *
   * Maps pass name to pass instance. Program passes operate on the
   * entire ILProgram rather than individual functions.
   */
  protected programPasses: Map<string, ProgramOptimizationPass> = new Map();

  /**
   * Results from program-level pass execution.
   *
   * Stores results from each program pass run during the last
   * optimizeProgram() call, for debugging and analysis.
   */
  protected programPassResults: ProgramPassResult[] = [];

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
    this.registerDefaultProgramPasses();
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
   * Registers passes in dependency order:
   * 1. DCE (no dependencies)
   * 2. ConstantFold
   * 3. ConstantProp
   * 4. CopyProp
   * 5. ILPeephole
   */
  protected registerDefaultPasses(): void {
    // Phase 2: DCE Pass
    this.passManager.registerPass(new DCEPass());

    // Phase 3: Constant Folding
    this.passManager.registerPass(new ConstantFoldPass());

    // Phase 4: Constant Propagation
    this.passManager.registerPass(new ConstantPropPass());

    // Phase 5: Copy Propagation
    this.passManager.registerPass(new CopyPropPass());

    // Phase 6: IL Peephole
    this.passManager.registerPass(new ILPeepholePass());

    // Phase 7: Common Subexpression Elimination (O2+)
    this.passManager.registerPass(new CSEPass());
  }

  /**
   * Register default program-level optimization passes.
   *
   * Called automatically during construction.
   * Override in subclass to customize program pass registration.
   *
   * Registers program passes:
   * 1. DeadFunctionElimPass (no dependencies) — removes unreachable functions
   */
  protected registerDefaultProgramPasses(): void {
    // Dead function elimination — removes functions unreachable from entry point
    this.registerProgramPass(new DeadFunctionElimPass());

    // Dead global elimination — removes unused global variable initializations
    // Depends on dead-function-elim (runs after it via dependency ordering)
    this.registerProgramPass(new DeadGlobalElimPass());

    // Function inlining — inlines callee bodies at call sites
    // Depends on dead-function-elim (no point inlining dead functions)
    this.registerProgramPass(new FunctionInliningPass());
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
  // Program Pass Registration
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Register a program-level optimization pass.
   *
   * Program passes operate on the entire ILProgram (adding, removing,
   * or modifying functions) and run before per-function passes.
   *
   * @param pass - The program optimization pass to register
   * @throws Error if a pass with the same name is already registered
   *
   * @example
   * ```typescript
   * optimizer.registerProgramPass(new DeadFunctionElimPass());
   * ```
   */
  registerProgramPass(pass: ProgramOptimizationPass): void {
    if (this.programPasses.has(pass.name)) {
      throw new Error(`Program pass '${pass.name}' is already registered`);
    }
    this.programPasses.set(pass.name, pass);
  }

  /**
   * Check if a program pass is registered.
   *
   * @param name - Pass name to check
   * @returns true if program pass is registered
   */
  hasProgramPass(name: string): boolean {
    return this.programPasses.has(name);
  }

  /**
   * Get all registered program pass names.
   *
   * @returns Array of registered program pass names
   */
  getRegisteredProgramPasses(): string[] {
    return [...this.programPasses.keys()];
  }

  /**
   * Get program passes ordered by dependencies for the current options.
   *
   * Resolves which program passes are enabled at the current optimization
   * level and orders them respecting dependency constraints. Only returns
   * passes that are both enabled and registered.
   *
   * @returns Array of program passes in dependency order
   */
  protected getOrderedProgramPasses(): ProgramOptimizationPass[] {
    const options = this.passManager.getOptions();
    const enabledNames = resolveProgramPasses(options);

    // Filter to only registered passes
    const available = enabledNames.filter((name) => this.programPasses.has(name));

    // Topological sort by dependencies
    const ordered: ProgramOptimizationPass[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (name: string): void => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected in program pass '${name}'`);
      }

      const pass = this.programPasses.get(name);
      if (!pass) return;

      visiting.add(name);

      // Visit dependencies first
      for (const dep of pass.dependencies) {
        if (available.includes(dep) || this.programPasses.has(dep)) {
          visit(dep);
        }
      }

      visiting.delete(name);
      visited.add(name);

      if (available.includes(name)) {
        ordered.push(pass);
      }
    };

    for (const name of available) {
      visit(name);
    }

    return ordered;
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
   * Runs optimization in two phases:
   * 1. **Program-level passes** — operate on the entire program
   *    (dead function elimination, function inlining, etc.)
   * 2. **Function-level passes** — optimize each function individually
   *    (DCE, constant folding, peephole, etc.)
   *
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

    // Reset program pass results from previous run
    this.programPassResults = [];

    // ──────────────────────────────────────────────────────────────
    // Phase 1: Program-level passes (dead function elim, inlining)
    // ──────────────────────────────────────────────────────────────
    const programPasses = this.getOrderedProgramPasses();
    const options = this.passManager.getOptions();

    for (const pass of programPasses) {
      const result = pass.run(program, options);
      this.programPassResults.push(result);

      if (result.modified) {
        totalModified = true;
      }

      // Debug output for program passes
      if (options.debug) {
        const status = result.modified ? '✓ modified' : '- no change';
        console.log(
          `[program:${pass.name}] ${status} ` +
            `(${result.functionsRemoved} removed, ${result.functionsModified} modified)`
        );
        if (result.debugInfo) {
          for (const info of result.debugInfo) {
            console.log(`  ${info}`);
          }
        }
      }
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 2: Function-level passes (DCE, const fold, etc.)
    // ──────────────────────────────────────────────────────────────
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
      programPassResults: this.programPassResults,
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

  /**
   * Results from program-level passes.
   *
   * Contains results from each program pass that ran (e.g., dead
   * function elimination, function inlining). Empty array if no
   * program passes were registered or enabled.
   */
  programPassResults: ProgramPassResult[];

  /** Total instructions removed across all functions */
  totalInstructionsRemoved: number;

  /** Total instructions added across all functions */
  totalInstructionsAdded: number;

  /** Total optimization time in milliseconds */
  totalDurationMs: number;
}
