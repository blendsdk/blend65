/**
 * Dead Code Elimination (DCE) Pass
 *
 * Removes instructions that have no effect on program output:
 * - Dead stores: Stores to variables that are never read
 * - Unreachable code: Instructions after unconditional jumps/returns
 * - Dead computations: Results that are never used
 *
 * This is typically the first optimization pass to run, as it removes
 * unnecessary code early, making subsequent passes more effective.
 *
 * @module optimizer/passes/dce
 */

import type { ILFunction } from '../../il/structures.js';
import type { ILInstruction } from '../../il/instruction.js';
import { ILOpcode } from '../../il/enums.js';
import { computeLiveRanges, isDeadStore } from '../../il/analysis.js';
import type { OptimizationOptions } from '../options.js';
import type { OptimizationPass, PassResult } from '../pass.js';
import { createResult } from '../pass.js';

// ============================================================================
// DCE Pass
// ============================================================================

/**
 * Dead Code Elimination optimization pass.
 *
 * Leverages the existing liveness analysis infrastructure to identify
 * and remove dead code. This pass has no dependencies and should run
 * first in the optimization pipeline.
 *
 * **What DCE Removes:**
 * - Dead stores (variables assigned but never read)
 * - Code after unconditional jumps (JMP, RETURN)
 * - Redundant computations (results never used)
 *
 * **What DCE Preserves:**
 * - Stores with side effects (memory-mapped I/O)
 * - Code reachable via labels
 * - All live variables
 *
 * @example
 * ```typescript
 * const dce = new DCEPass();
 * const manager = new PassManager({ level: 'O1' });
 * manager.registerPass(dce);
 * ```
 */
export class DCEPass implements OptimizationPass {
  // ═══════════════════════════════════════════════════════════════════
  // OptimizationPass Interface
  // ═══════════════════════════════════════════════════════════════════

  /** Pass name - used for configuration and logging */
  readonly name = 'dce';

  /** No dependencies - DCE runs first */
  readonly dependencies: string[] = [];

  // ═══════════════════════════════════════════════════════════════════
  // Pass Execution
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Run dead code elimination on a function.
   *
   * @param func - IL function to optimize (modified in place)
   * @param options - Optimization options
   * @returns Pass result with modification statistics
   */
  run(func: ILFunction, options: OptimizationOptions): PassResult {
    // Step 1: Run liveness analysis to populate liveIn/liveOut
    computeLiveRanges(func);

    const toRemove = new Set<number>();
    const instructions = func.instructions;
    const debugInfo: string[] = [];

    // Step 2: Find dead stores using existing isDeadStore()
    for (let i = 0; i < instructions.length; i++) {
      if (isDeadStore(instructions[i])) {
        toRemove.add(i);
        if (options.debug) {
          debugInfo.push(`Dead store at index ${i}: ${this.describeInstruction(instructions[i])}`);
        }
      }
    }

    // Step 3: Find unreachable code
    const unreachable = this.findUnreachableCode(instructions);
    for (const idx of unreachable) {
      toRemove.add(idx);
      if (options.debug) {
        debugInfo.push(`Unreachable at index ${idx}: ${this.describeInstruction(instructions[idx])}`);
      }
    }

    // Step 4: Remove marked instructions
    if (toRemove.size > 0) {
      func.instructions = instructions.filter((_, i) => !toRemove.has(i));
    }

    return createResult(toRemove.size, 0, debugInfo.length > 0 ? debugInfo : undefined);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Unreachable Code Detection
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Find instructions that are unreachable.
   *
   * Code is unreachable if it comes after an unconditional control flow
   * instruction (JUMP, RETURN) and before a label that could be jumped to.
   *
   * @param instructions - Array of IL instructions
   * @returns Array of indices of unreachable instructions
   */
  protected findUnreachableCode(instructions: ILInstruction[]): number[] {
    const unreachable: number[] = [];
    let isUnreachable = false;

    for (let i = 0; i < instructions.length; i++) {
      const instr = instructions[i];

      // Labels make code reachable again (someone might jump here)
      if (instr.opcode === ILOpcode.LABEL) {
        isUnreachable = false;
        continue;
      }

      // If we're in unreachable region, mark this instruction
      if (isUnreachable) {
        unreachable.push(i);
        continue;
      }

      // Unconditional control flow makes following code unreachable
      if (this.isUnconditionalControlFlow(instr)) {
        isUnreachable = true;
      }
    }

    return unreachable;
  }

  /**
   * Check if an instruction is unconditional control flow.
   *
   * @param instr - Instruction to check
   * @returns true if instruction unconditionally transfers control
   */
  protected isUnconditionalControlFlow(instr: ILInstruction): boolean {
    return instr.opcode === ILOpcode.JUMP || instr.opcode === ILOpcode.RETURN;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Debug Helpers
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a human-readable description of an instruction for debugging.
   *
   * @param instr - Instruction to describe
   * @returns String description
   */
  protected describeInstruction(instr: ILInstruction): string {
    const opcodeName = ILOpcode[instr.opcode] ?? `OPCODE_${instr.opcode}`;
    return opcodeName;
  }
}