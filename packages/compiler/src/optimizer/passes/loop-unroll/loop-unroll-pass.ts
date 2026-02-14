/**
 * Loop Unroll Pass — Unroll Small Constant-Count Loops
 *
 * Final layer of the loop unrolling inheritance chain. Implements
 * the OptimizationPass interface with the run() method that:
 * 1. Builds a LoopTree from the function
 * 2. Finds eligible loops (counted, small body, known iteration count)
 * 3. Performs full or partial unrolling
 *
 * **Full unrolling** (iterationCount <= 8): Completely eliminates the
 * loop by duplicating the body N times and removing the loop structure.
 * This eliminates branch overhead entirely.
 *
 * **Partial unrolling** (larger loops): Duplicates the body `factor`
 * times within the loop, reducing iteration count by that factor.
 * For example, factor=2 means the body executes twice per loop
 * iteration, halving the number of branches.
 *
 * **Enabled at:** O2, O3 (NOT Os/Oz — unrolling increases code size)
 *
 * Inheritance chain: LoopUnrollBase → LoopUnrollAnalysis → LoopUnrollPass
 *
 * @module optimizer/passes/loop-unroll/loop-unroll-pass
 */

import { ILOpcode } from '../../../il/enums.js';
import type { ILFunction } from '../../../il/structures.js';
import type { ILInstruction } from '../../../il/instruction.js';
import type { OptimizationOptions } from '../../options.js';
import type { OptimizationPass, PassResult } from '../../pass.js';
import { createEmptyResult, createResult } from '../../pass.js';
import { LoopTree } from '../../analysis/loop-tree.js';
import type { LoopInfo } from '../../analysis/loop-tree.js';
import { LoopUnrollAnalysis } from './analysis.js';
import type { UnrollCandidate } from './analysis.js';

// ============================================================================
// LoopUnrollPass — The Concrete Pass
// ============================================================================

/**
 * Loop unrolling optimization pass.
 *
 * Identifies loops with known constant iteration counts and small
 * bodies, then duplicates the body to reduce loop overhead. This
 * is especially impactful on 6502 where branch instructions are
 * relatively expensive (2-3 cycles each).
 *
 * **What gets unrolled:**
 * - Counted for-loops with constant bounds (`for i = 0 to 4`)
 * - Loops with ≤8 instructions in the body (at O2) or ≤16 (at O3)
 * - Loops where the iteration count divides evenly by the factor
 *
 * **What does NOT get unrolled:**
 * - While loops (no known iteration count)
 * - Loops with dynamic bounds
 * - Loops with large bodies (exceeds size threshold)
 * - Any loop at Os/Oz (code size optimization)
 *
 * @example
 * ```typescript
 * const unroll = new LoopUnrollPass();
 * const result = unroll.run(func, { level: 'O2' });
 * ```
 */
export class LoopUnrollPass extends LoopUnrollAnalysis implements OptimizationPass {
  // ═══════════════════════════════════════════════════════════════════
  // OptimizationPass Interface
  // ═══════════════════════════════════════════════════════════════════

  /** Pass name — used for configuration and logging */
  readonly name = 'loop-unroll';

  /** Dependencies — unrolling benefits from running after LICM */
  readonly dependencies: string[] = ['licm'];

  // ═══════════════════════════════════════════════════════════════════
  // Pass Execution
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Run loop unrolling on a function.
   *
   * Algorithm:
   * 1. Check if unrolling is enabled at this optimization level
   * 2. Build LoopTree from function's loop metadata
   * 3. Analyze each loop for unroll eligibility
   * 4. Unroll eligible loops (innermost first to avoid index corruption)
   * 5. Return result with statistics
   *
   * @param func - IL function to optimize (modified in place)
   * @param options - Optimization options
   * @returns Pass result with modification statistics
   */
  run(func: ILFunction, options: OptimizationOptions): PassResult {
    // Quick check: is unrolling enabled at this level?
    const factor = this.getUnrollFactor(options);
    if (factor === 0) {
      return createEmptyResult();
    }

    // Build loop tree — if no loops, nothing to do
    const loopTree = LoopTree.build(func);
    if (!loopTree.hasLoops()) {
      return createEmptyResult();
    }

    // Sort loops innermost-first (highest depth first)
    // This ensures inner loops are unrolled before outer loops,
    // which avoids index corruption issues.
    const loops = [...loopTree.getLoops()].sort((a, b) => b.depth - a.depth);

    // Analyze all loops for unroll candidates
    const candidates: UnrollCandidate[] = [];
    for (const loop of loops) {
      const candidate = this.analyzeCandidate(func, loop, options);
      if (candidate !== null) {
        candidates.push(candidate);
      }
    }

    if (candidates.length === 0) {
      return createEmptyResult();
    }

    // Perform unrolling (innermost first — candidates are already sorted)
    let totalUnrolled = 0;
    let totalRemoved = 0;
    let totalAdded = 0;
    const debugInfo: string[] = [];

    for (const candidate of candidates) {
      const delta = candidate.isFullUnroll
        ? this.performFullUnroll(func, candidate, options, debugInfo)
        : this.performPartialUnroll(func, candidate, options, debugInfo);

      if (delta !== null) {
        totalUnrolled++;
        totalRemoved += delta.removed;
        totalAdded += delta.added;
      }
    }

    if (totalUnrolled === 0) {
      return createEmptyResult();
    }

    return createResult(totalRemoved, totalAdded, debugInfo.length > 0 ? debugInfo : undefined);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Full Unrolling — Eliminate loop entirely
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Fully unroll a loop by duplicating the body N times.
   *
   * Replaces the entire loop structure (header label, body,
   * back-edge, exit label) with N copies of the body instructions.
   * This completely eliminates loop overhead (branch, compare).
   *
   * Example: `for i = 0 to 3 { STORE x }` becomes:
   * ```
   *   STORE x   // iteration 0
   *   STORE x   // iteration 1
   *   STORE x   // iteration 2
   * ```
   *
   * @param func - IL function (modified in place)
   * @param candidate - The unroll candidate with iteration count
   * @param options - Optimization options
   * @param debugInfo - Mutable array for debug messages
   * @returns Instruction delta if unrolling succeeded, null if not
   */
  protected performFullUnroll(
    func: ILFunction,
    candidate: UnrollCandidate,
    options: OptimizationOptions,
    debugInfo: string[]
  ): { removed: number; added: number } | null {
    const loop = candidate.loop;

    // Re-resolve label indices (may have shifted from prior unrolling)
    const headerIdx = this.findLabelIndex(func, loop.headerLabel);
    const exitIdx = this.findLabelIndex(func, loop.exitLabel);
    if (headerIdx === -1 || exitIdx === -1 || headerIdx >= exitIdx) {
      return null;
    }

    // Extract the effective body (work instructions only)
    const bodyInstructions = this.extractBodyInstructions(func, headerIdx, exitIdx);
    if (bodyInstructions.length === 0) {
      return null;
    }

    // Build the unrolled sequence: N copies of the body
    const unrolledBody: ILInstruction[] = [];
    for (let i = 0; i < candidate.iterationCount; i++) {
      const cloned = this.cloneInstructions(bodyInstructions);
      unrolledBody.push(...cloned);
    }

    // Replace the loop region [headerIdx .. exitIdx] (inclusive of header,
    // exclusive of exit label) with the unrolled body
    // We keep the exit label in place since code after the loop may jump to it
    const removeCount = exitIdx - headerIdx;
    func.instructions.splice(headerIdx, removeCount, ...unrolledBody);

    // Remove this loop from the function's loop metadata
    this.removeLoopMetadata(func, loop);

    // Debug output
    if (options.debug) {
      debugInfo.push(
        `UNROLL: Fully unrolled loop ${loop.headerLabel} ` +
        `(${candidate.iterationCount} iterations × ${candidate.bodySize} instrs)`
      );
    }

    return { removed: removeCount, added: unrolledBody.length };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Partial Unrolling — Reduce iteration count by factor
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Partially unroll a loop by duplicating the body within the loop.
   *
   * Instead of eliminating the loop, duplicates the body N times
   * within the loop structure. This reduces the number of iterations
   * (and thus branch overhead) by the unroll factor.
   *
   * Example: `for i = 0 to 8 { STORE x }` with factor=2 becomes:
   * ```
   *   LABEL loop_header
   *   STORE x   // original body
   *   INC counter
   *   STORE x   // duplicated body
   *   INC counter
   *   CMP 8     // check (adjusted)
   *   JUMP_NE loop_header
   *   LABEL loop_exit
   * ```
   *
   * Note: This is a simplified implementation that inserts extra
   * copies of the body BEFORE the loop's termination check.
   *
   * @param func - IL function (modified in place)
   * @param candidate - The unroll candidate
   * @param options - Optimization options
   * @param debugInfo - Mutable array for debug messages
   * @returns Instruction delta if unrolling succeeded, null if not
   */
  protected performPartialUnroll(
    func: ILFunction,
    candidate: UnrollCandidate,
    options: OptimizationOptions,
    debugInfo: string[]
  ): { removed: number; added: number } | null {
    const loop = candidate.loop;

    // Re-resolve label indices
    const headerIdx = this.findLabelIndex(func, loop.headerLabel);
    const exitIdx = this.findLabelIndex(func, loop.exitLabel);
    if (headerIdx === -1 || exitIdx === -1 || headerIdx >= exitIdx) {
      return null;
    }

    // Extract the effective body (work instructions only)
    const bodyInstructions = this.extractBodyInstructions(func, headerIdx, exitIdx);
    if (bodyInstructions.length === 0) {
      return null;
    }

    // Find the insertion point: just before the back-edge JUMP
    // The back-edge JUMP is the last instruction before the exit label
    const backEdgeIdx = exitIdx - 1;
    if (backEdgeIdx <= headerIdx) {
      return null;
    }

    // Also find the counter increment if it exists (for counted loops)
    // We need to duplicate the counter update too
    const counterIncrements = this.findCounterIncrements(func, headerIdx, exitIdx, loop);

    // Build duplicated copies (factor - 1 additional copies)
    // because the original body already provides 1 copy
    const additionalCopies: ILInstruction[] = [];
    for (let i = 1; i < candidate.unrollFactor; i++) {
      // Clone the body instructions
      const cloned = this.cloneInstructions(bodyInstructions);
      additionalCopies.push(...cloned);

      // Clone counter increment instructions if they exist
      if (counterIncrements.length > 0) {
        const clonedInc = this.cloneInstructions(counterIncrements);
        additionalCopies.push(...clonedInc);
      }
    }

    if (additionalCopies.length === 0) {
      return null;
    }

    // Insert the additional copies just before the termination check
    // The termination check is typically: CMP + conditional_jump + back-edge JUMP
    // We insert before the CMP instruction (or before the back-edge if no CMP)
    const insertIdx = this.findTerminationCheckStart(func, headerIdx, exitIdx);
    func.instructions.splice(insertIdx, 0, ...additionalCopies);

    // Debug output
    if (options.debug) {
      debugInfo.push(
        `UNROLL: Partially unrolled loop ${loop.headerLabel} ` +
        `(factor ${candidate.unrollFactor}, ${candidate.iterationCount} iterations)`
      );
    }

    return { removed: 0, added: additionalCopies.length };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Helper Methods
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Find counter increment instructions within the loop body.
   *
   * For counted loops, the counter is typically incremented with
   * INC_BYTE or DEC_BYTE. We need to duplicate these along with
   * the body during partial unrolling.
   *
   * @param func - IL function
   * @param headerIdx - Header label index
   * @param exitIdx - Exit label index
   * @param loop - Loop info with counter metadata
   * @returns Array of counter increment instructions
   */
  protected findCounterIncrements(
    func: ILFunction,
    headerIdx: number,
    exitIdx: number,
    loop: LoopInfo
  ): ILInstruction[] {
    const counterSlot = loop.loop.counterSlot;
    if (!counterSlot) return [];

    const increments: ILInstruction[] = [];
    const counterName = counterSlot.name;

    for (let i = headerIdx + 1; i < exitIdx; i++) {
      const instr = func.instructions[i];
      // INC_BYTE/DEC_BYTE or INC_WORD/DEC_WORD on the counter slot
      if (
        (instr.opcode === ILOpcode.INC_BYTE || instr.opcode === ILOpcode.DEC_BYTE ||
         instr.opcode === ILOpcode.INC_WORD || instr.opcode === ILOpcode.DEC_WORD) &&
        instr.defUse &&
        instr.defUse.defs.includes(counterName)
      ) {
        increments.push(instr);
      }
    }

    return increments;
  }

  /**
   * Find the start of the loop's termination check.
   *
   * The termination check is the sequence of instructions at the end
   * of the loop body that tests the loop condition and branches.
   * Typically this is: LOAD counter + CMP bound + conditional_jump.
   *
   * We scan backwards from the exit to find the first CMP instruction,
   * which marks the start of the termination sequence.
   *
   * @param func - IL function
   * @param headerIdx - Header label index
   * @param exitIdx - Exit label index
   * @returns Index where the termination check starts
   */
  protected findTerminationCheckStart(
    func: ILFunction,
    headerIdx: number,
    exitIdx: number
  ): number {
    // Scan backwards from the back-edge to find CMP or LOAD before CMP
    for (let i = exitIdx - 1; i > headerIdx; i--) {
      const instr = func.instructions[i];

      // Found a comparison — the termination check starts here or earlier
      if (this.isComparison(instr)) {
        // Check if the instruction before this is a LOAD (loading counter)
        if (i > headerIdx + 1) {
          const prevInstr = func.instructions[i - 1];
          if (prevInstr.opcode === ILOpcode.LOAD_BYTE) {
            return i - 1;
          }
        }
        return i;
      }
    }

    // No CMP found — insert before the back-edge JUMP
    return exitIdx - 1;
  }

  /**
   * Remove a loop from the function's loop metadata after full unrolling.
   *
   * After full unrolling eliminates a loop, its ILLoop entry should
   * be removed so downstream passes don't try to process a non-existent loop.
   *
   * @param func - IL function (modified in place)
   * @param loop - The loop that was fully unrolled
   */
  protected removeLoopMetadata(func: ILFunction, loop: LoopInfo): void {
    const idx = func.loops.findIndex(
      l => l.headerLabel === loop.headerLabel && l.exitLabel === loop.exitLabel
    );
    if (idx !== -1) {
      func.loops.splice(idx, 1);
    }

    // Update maxLoopDepth if needed
    if (func.loops.length === 0) {
      func.maxLoopDepth = 0;
    } else {
      func.maxLoopDepth = Math.max(...func.loops.map(l => l.depth));
    }
  }
}
