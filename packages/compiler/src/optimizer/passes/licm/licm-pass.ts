/**
 * LICM Pass — Loop Invariant Code Motion
 *
 * Final layer of the LICM inheritance chain. Implements the
 * OptimizationPass interface with the run() method that:
 * 1. Builds a LoopTree from the function
 * 2. Processes loops innermost-first (highest depth first)
 * 3. Finds invariant instructions in each loop
 * 4. Hoists them to the loop's preheader
 *
 * Moving invariant loads/computations out of tight loops is one
 * of the highest-impact optimizations for 6502 — every cycle
 * saved is multiplied by the iteration count.
 *
 * Inheritance chain: LICMBase → LICMInvariance → LICMPass
 *
 * @module optimizer/passes/licm/licm-pass
 */

import { ILOpcode } from '../../../il/enums.js';
import { isLabelOperand } from '../../../il/guards.js';
import type { ILFunction } from '../../../il/structures.js';
import type { ILInstruction } from '../../../il/instruction.js';
import type { OptimizationOptions } from '../../options.js';
import type { OptimizationPass, PassResult } from '../../pass.js';
import { createEmptyResult, createResult } from '../../pass.js';
import { LoopTree } from '../../analysis/loop-tree.js';
import type { LoopInfo } from '../../analysis/loop-tree.js';
import { LICMInvariance } from './invariance.js';

// ============================================================================
// LICMPass — The Concrete Pass
// ============================================================================

/**
 * Loop Invariant Code Motion optimization pass.
 *
 * Identifies instructions within loop bodies whose results do not
 * change across iterations, and moves them to the loop's preheader
 * (just before the loop header label). This reduces per-iteration
 * work, which is especially impactful on the 6502 where every
 * cycle counts in tight loops.
 *
 * **What LICM hoists:**
 * - LOAD_IMM (constant loads that never change)
 * - LOAD_BYTE x where x is not modified in the loop
 * - Arithmetic/bitwise operations on loop-invariant operands
 *
 * **What LICM preserves:**
 * - Stores (side effects)
 * - Function calls (may have side effects)
 * - Control flow (labels, jumps, branches)
 * - Comparisons (set flags for branches)
 * - Instructions using loop-varying slots
 *
 * **Enabled at:** O2+ (standard and aggressive optimization)
 *
 * @example
 * ```typescript
 * const licm = new LICMPass();
 * const result = licm.run(func, { level: 'O2' });
 * ```
 */
export class LICMPass extends LICMInvariance implements OptimizationPass {
  // ═══════════════════════════════════════════════════════════════════
  // OptimizationPass Interface
  // ═══════════════════════════════════════════════════════════════════

  /** Pass name — used for configuration and logging */
  readonly name = 'licm';

  /** Dependencies — LICM benefits from running after DCE and constant-prop */
  readonly dependencies: string[] = ['dce', 'constant-prop'];

  // ═══════════════════════════════════════════════════════════════════
  // Pass Execution
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Run LICM on a function.
   *
   * Algorithm:
   * 1. Build LoopTree from function's loop metadata
   * 2. Sort loops by depth descending (innermost first)
   * 3. For each loop, find invariant instructions
   * 4. Hoist invariants to the preheader in original order
   * 5. Return result with statistics
   *
   * Processing innermost loops first ensures that inner invariants
   * are hoisted before outer loops are processed, potentially
   * enabling more hoisting at outer levels.
   *
   * @param func - IL function to optimize (modified in place)
   * @param options - Optimization options
   * @returns Pass result with modification statistics
   */
  run(func: ILFunction, options: OptimizationOptions): PassResult {
    // Build loop tree — if no loops, nothing to do
    const loopTree = LoopTree.build(func);
    if (!loopTree.hasLoops()) {
      return createEmptyResult();
    }

    // Sort loops innermost-first (highest depth first)
    const loops = [...loopTree.getLoops()].sort((a, b) => b.depth - a.depth);

    let totalHoisted = 0;
    const debugInfo: string[] = [];

    for (const loop of loops) {
      const hoisted = this.processLoop(func, loop, loopTree, options, debugInfo);
      totalHoisted += hoisted;
    }

    if (totalHoisted === 0) {
      return createEmptyResult();
    }

    return createResult(0, 0, debugInfo.length > 0 ? debugInfo : undefined);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Per-Loop Processing
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Process a single loop: find invariants and hoist them.
   *
   * @param func - IL function (modified in place)
   * @param loop - The loop to process
   * @param loopTree - The loop tree for preheader queries
   * @param options - Optimization options
   * @param debugInfo - Mutable array for debug messages
   * @returns Number of instructions hoisted
   */
  protected processLoop(
    func: ILFunction,
    loop: LoopInfo,
    _loopTree: LoopTree,
    options: OptimizationOptions,
    debugInfo: string[]
  ): number {
    // Get current body indices for this loop
    // We must recompute because prior hoisting may have shifted indices
    const bodyIndices = this.getCurrentBodyIndices(func, loop);
    if (bodyIndices.length === 0) return 0;

    // Find invariant instructions within the loop body
    const invariantIndices = this.findInvariantIndices(func, bodyIndices);
    if (invariantIndices.size === 0) return 0;

    // Sort invariant indices in ascending order to maintain
    // relative instruction order when hoisting
    const sortedInvariants = [...invariantIndices].sort((a, b) => a - b);

    // Hoist each invariant to the preheader
    const hoisted = this.hoistToPreheader(func, loop, sortedInvariants, options, debugInfo);

    return hoisted;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Hoisting Logic
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Hoist invariant instructions from the loop body to the preheader.
   *
   * The preheader is the position just before the loop header label.
   * Instructions are inserted in their original relative order to
   * preserve any data dependencies between them.
   *
   * **Implementation strategy:**
   * We collect the invariant instructions, remove them from their
   * original positions, then insert them all at the preheader.
   * Indices shift as we modify the array, so we process removals
   * from highest to lowest index to avoid invalidation.
   *
   * @param func - IL function (modified in place)
   * @param loop - Loop whose invariants are being hoisted
   * @param invariantIndices - Sorted ascending indices of invariant instructions
   * @param options - Optimization options
   * @param debugInfo - Mutable array for debug messages
   * @returns Number of instructions hoisted
   */
  protected hoistToPreheader(
    func: ILFunction,
    loop: LoopInfo,
    invariantIndices: number[],
    options: OptimizationOptions,
    debugInfo: string[]
  ): number {
    if (invariantIndices.length === 0) return 0;

    // Step 1: Collect the invariant instructions (in order)
    const hoistedInstructions: ILInstruction[] = [];
    for (const idx of invariantIndices) {
      hoistedInstructions.push(func.instructions[idx]);
    }

    // Step 2: Remove from original positions (highest index first
    // to avoid index invalidation)
    const descending = [...invariantIndices].sort((a, b) => b - a);
    for (const idx of descending) {
      func.instructions.splice(idx, 1);
    }

    // Step 3: Find the new preheader position
    // After removals, the header label may have shifted.
    // Search for the loop's header label in the updated instruction array.
    const preheaderIdx = this.findHeaderLabelIndex(func, loop.headerLabel);
    if (preheaderIdx === -1) {
      // Header label not found — should not happen, but defensive
      // Put instructions back (prepend to start as fallback)
      func.instructions.splice(0, 0, ...hoistedInstructions);
      return 0;
    }

    // Step 4: Insert all hoisted instructions just before the header label
    func.instructions.splice(preheaderIdx, 0, ...hoistedInstructions);

    // Debug output
    if (options.debug) {
      for (const instr of hoistedInstructions) {
        debugInfo.push(
          `LICM: Hoisted ${this.describeInstruction(instr)} before loop ${loop.headerLabel}`
        );
      }
    }

    return hoistedInstructions.length;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Index Helpers
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get current body indices for a loop by scanning for its labels.
   *
   * Because prior hoisting may have shifted instruction indices,
   * we cannot rely on the original LoopInfo indices. Instead, we
   * scan for the header and exit labels in the current instruction
   * array.
   *
   * @param func - IL function
   * @param loop - Loop to find body indices for
   * @returns Array of instruction indices in the loop body
   */
  protected getCurrentBodyIndices(func: ILFunction, loop: LoopInfo): number[] {
    const headerIdx = this.findHeaderLabelIndex(func, loop.headerLabel);
    const exitIdx = this.findHeaderLabelIndex(func, loop.exitLabel);

    if (headerIdx === -1 || exitIdx === -1 || headerIdx >= exitIdx) {
      return [];
    }

    // Body is header (inclusive) to exit (exclusive)
    const indices: number[] = [];
    for (let i = headerIdx; i < exitIdx; i++) {
      indices.push(i);
    }
    return indices;
  }

  /**
   * Find the instruction index of a label in the current instruction array.
   *
   * @param func - IL function
   * @param labelName - Label name to find
   * @returns Index of the LABEL instruction, or -1 if not found
   */
  protected findHeaderLabelIndex(func: ILFunction, labelName: string): number {
    for (let i = 0; i < func.instructions.length; i++) {
      const instr = func.instructions[i];
      if (
        instr.opcode === ILOpcode.LABEL &&
        instr.operands.length > 0 &&
        isLabelOperand(instr.operands[0]) &&
        instr.operands[0].name === labelName
      ) {
        return i;
      }
    }
    return -1;
  }
}
