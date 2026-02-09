/**
 * Dead Function Elimination Pass
 *
 * Removes functions that are unreachable from the program's entry point.
 * This is a program-level optimization pass that operates on the entire
 * ILProgram, removing functions that can never be called.
 *
 * **Algorithm:**
 * 1. Build a call graph from the ILProgram
 * 2. BFS from entry point to find all reachable functions
 * 3. Additionally preserve exported and callback functions
 *    (they are externally reachable — called from interrupts, other modules, etc.)
 * 4. Remove all functions NOT in the combined reachable set
 * 5. Report removed function names in debug output
 *
 * **Why this matters for 6502:**
 * Every byte counts on 6502 systems. Removing dead functions directly
 * reduces the final binary size and eliminates code that would waste
 * precious ROM/RAM space on the C64.
 *
 * **Enabled at:** O1+ (all optimization levels except O0)
 *
 * @module optimizer/passes/dead-function-elim
 */

import type { ILProgram } from '../../il/structures.js';
import type { OptimizationOptions } from '../options.js';
import type { ProgramOptimizationPass, ProgramPassResult } from '../pass.js';
import { createEmptyProgramResult, createProgramResult } from '../pass.js';
import { CallGraph } from '../analysis/call-graph.js';

// ============================================================================
// Dead Function Elimination Pass
// ============================================================================

/**
 * Eliminates unreachable functions from the program.
 *
 * A function is considered "dead" (unreachable) if it cannot be reached
 * from the entry point through any chain of calls AND is not exported
 * or marked as a callback.
 *
 * **Preserved functions (never removed):**
 * - Entry point function (always reachable by definition)
 * - Functions reachable from the entry point via call graph BFS
 * - Exported functions (`isExported === true`) — may be called externally
 * - Callback functions (`isCallback === true`) — may be invoked by hardware
 *   interrupts or external code
 *
 * @example
 * ```typescript
 * const pass = new DeadFunctionElimPass();
 * const result = pass.run(program, { level: 'O1' });
 * if (result.modified) {
 *   console.log(`Removed ${result.functionsRemoved} dead functions`);
 * }
 * ```
 */
export class DeadFunctionElimPass implements ProgramOptimizationPass {
  /**
   * Unique pass name.
   *
   * Must match the name used in PROGRAM_LEVEL_PASSES config ('dead-function-elim').
   */
  readonly name = 'dead-function-elim';

  /**
   * This pass has no dependencies on other program passes.
   *
   * Dead function elimination is a foundational pass — other inter-procedural
   * passes (like function inlining) depend on it, not the other way around.
   */
  readonly dependencies: string[] = [];

  /**
   * Run dead function elimination on the entire program.
   *
   * Builds a call graph, determines reachability from the entry point,
   * and removes all functions that are unreachable AND not exported/callback.
   *
   * The program's `functions` array is modified in place (filtered).
   *
   * @param program - The IL program to optimize (modified in place)
   * @param options - Optimization options (used for debug logging)
   * @returns Result indicating how many functions were removed
   */
  run(program: ILProgram, options: OptimizationOptions): ProgramPassResult {
    // Nothing to do if program has 0 or 1 functions
    if (program.functions.length <= 1) {
      return createEmptyProgramResult();
    }

    // Step 1: Build call graph and compute reachability from entry point
    const callGraph = CallGraph.build(program);
    const reachableFromEntry = callGraph.getReachableFunctions();

    // Step 2: Build the complete "keep" set — functions that must be preserved
    const keepSet = this.buildKeepSet(program, reachableFromEntry);

    // Step 3: Identify dead functions (those NOT in keepSet)
    const deadFunctions = program.functions.filter((f) => !keepSet.has(f.name));

    // Nothing to remove — all functions are reachable or preserved
    if (deadFunctions.length === 0) {
      return createEmptyProgramResult();
    }

    // Step 4: Remove dead functions from the program
    const removedNames = deadFunctions.map((f) => f.name);
    program.functions = program.functions.filter((f) => keepSet.has(f.name));

    // Step 5: Build debug info if requested
    const debugInfo = options.debug
      ? removedNames.map((name) => `Removed unreachable function: ${name}`)
      : undefined;

    return createProgramResult(removedNames.length, 0, debugInfo);
  }

  /**
   * Build the set of function names that must be kept (not eliminated).
   *
   * Combines three categories of functions that cannot be removed:
   * 1. Functions reachable from the entry point via call graph BFS
   * 2. Exported functions (externally callable from other modules)
   * 3. Callback functions (invoked by hardware interrupts or runtime)
   *
   * @param program - The IL program
   * @param reachableFromEntry - Functions reachable via call graph BFS
   * @returns Set of function names to keep
   */
  protected buildKeepSet(program: ILProgram, reachableFromEntry: Set<string>): Set<string> {
    const keepSet = new Set(reachableFromEntry);

    // Exported and callback functions are always reachable
    // because they can be invoked externally (other modules, interrupts, etc.)
    for (const func of program.functions) {
      if (func.isExported || func.isCallback) {
        keepSet.add(func.name);
      }
    }

    return keepSet;
  }
}
