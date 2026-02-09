/**
 * LICM Invariance Analysis
 *
 * Middle layer of the LICM inheritance chain. Adds invariance
 * detection logic that determines which instructions can be
 * safely moved out of a loop.
 *
 * An instruction is loop-invariant when:
 * 1. All its explicit slot operands (uses) are NOT defined inside the loop
 * 2. It has no side effects
 * 3. It is not a control flow instruction
 *
 * For the accumulator-centric IL, we additionally track whether the
 * implicit accumulator value feeding an instruction is itself invariant.
 * This prevents hoisting an ADD_BYTE y when A was set by a loop-varying
 * instruction.
 *
 * Inheritance chain: LICMBase → LICMInvariance → LICMPass
 *
 * @module optimizer/passes/licm/invariance
 */

import { ILOpcode } from '../../../il/enums.js';
import type { ILInstruction } from '../../../il/instruction.js';
import type { ILFunction } from '../../../il/structures.js';
import { LICMBase } from './base.js';

// ============================================================================
// LICMInvariance — Invariance Detection
// ============================================================================

/**
 * Extends LICMBase with invariance analysis for loop instructions.
 *
 * The core insight for accumulator-centric IL: an instruction's
 * invariance depends on both its explicit operands AND the implicit
 * accumulator state. We track accumulator invariance by walking
 * instructions in order and noting when A is set by an invariant
 * vs non-invariant instruction.
 *
 * @see LICMBase — Foundation analysis helpers
 * @see LICMPass — Final layer with hoisting and run()
 */
export class LICMInvariance extends LICMBase {
  // ═══════════════════════════════════════════════════════════════════
  // Invariance Analysis
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Find all invariant instruction indices within a loop body.
   *
   * Uses iterative widening: marks instructions as invariant in waves
   * until no more can be marked. This handles chains where instruction
   * B depends on instruction A — once A is marked invariant, B may
   * become invariant too.
   *
   * **Algorithm:**
   * 1. Collect all slot defs inside the loop body
   * 2. Pass 1: mark instructions invariant based on explicit operands
   * 3. Pass 2+: re-check remaining instructions considering already-
   *    invariant defs (iterative widening)
   * 4. Return the final set of invariant indices
   *
   * @param func - IL function containing the instructions
   * @param bodyIndices - Indices forming the loop body
   * @returns Set of instruction indices that are loop-invariant
   */
  protected findInvariantIndices(
    func: ILFunction,
    bodyIndices: number[]
  ): Set<number> {
    const loopDefs = this.collectLoopDefs(func, bodyIndices);
    const bodySet = new Set(bodyIndices);
    const invariantIndices = new Set<number>();

    // Iterative widening: keep marking until stable
    // When an instruction's def is added to "invariant defs", other
    // instructions that use it may become invariant too
    const invariantDefs = new Set<string>();
    let changed = true;

    while (changed) {
      changed = false;

      for (const idx of bodyIndices) {
        // Skip already-marked indices
        if (invariantIndices.has(idx)) continue;

        const instr = func.instructions[idx];
        if (!instr) continue;

        if (this.isInvariant(instr, loopDefs, invariantDefs, bodySet, func)) {
          invariantIndices.add(idx);
          changed = true;

          // Add this instruction's defs to invariant defs
          // so dependent instructions can become invariant
          if (instr.defUse) {
            for (const def of instr.defUse.defs) {
              invariantDefs.add(def);
            }
          }
        }
      }
    }

    return invariantIndices;
  }

  /**
   * Check if a single instruction is loop-invariant.
   *
   * An instruction is invariant when ALL of:
   * 1. It is NOT a control flow instruction (labels, jumps, branches)
   * 2. It has NO side effects (stores, calls, poke)
   * 3. All its explicit slot uses are either:
   *    a. NOT defined inside the loop, OR
   *    b. Defined by an already-proven invariant instruction
   * 4. It is not a comparison (CMP) — comparisons affect flags used
   *    by branch instructions that must stay in the loop
   *
   * @param instr - Instruction to check
   * @param loopDefs - All slot names defined inside the loop
   * @param invariantDefs - Slot names defined by already-invariant instructions
   * @param bodySet - Set of instruction indices in the loop body
   * @param func - The containing IL function
   * @returns true if the instruction is invariant
   */
  protected isInvariant(
    instr: ILInstruction,
    loopDefs: Set<string>,
    invariantDefs: Set<string>,
    _bodySet: Set<number>,
    _func: ILFunction
  ): boolean {
    // Rule 1: Control flow must stay in the loop
    if (this.isControlFlow(instr)) return false;

    // Rule 2: Side effects must stay in the loop
    if (this.hasSideEffects(instr)) return false;

    // Rule 3: Comparisons set flags for branches — keep in loop
    if (this.isComparison(instr)) return false;

    // Rule 4: NOP is not worth hoisting
    if (instr.opcode === ILOpcode.NOP) return false;

    // Rule 5: Check all explicit slot uses
    // Each used slot must either NOT be loop-defined,
    // or be defined by an already-invariant instruction
    if (instr.defUse) {
      for (const use of instr.defUse.uses) {
        const isDefinedInLoop = loopDefs.has(use);
        const isInvariantDef = invariantDefs.has(use);

        // If the slot IS defined in the loop but NOT by an invariant
        // instruction, then this instruction depends on loop-varying data
        if (isDefinedInLoop && !isInvariantDef) {
          return false;
        }
      }
    }

    // All checks passed — instruction is invariant
    return true;
  }

  /**
   * Check if an instruction is a comparison operation.
   *
   * Comparisons set CPU flags that are consumed by subsequent
   * branch instructions. Hoisting them would break the branch logic.
   *
   * @param instr - Instruction to check
   * @returns true if the instruction is a comparison
   */
  protected isComparison(instr: ILInstruction): boolean {
    return (
      instr.opcode === ILOpcode.CMP_BYTE ||
      instr.opcode === ILOpcode.CMP_IMM
    );
  }
}
