/**
 * Compare+Branch Simplification Pass
 *
 * Optimizes CMP+BCC+BEQ patterns into simpler CMP+BCC sequences on the 6502.
 * This is an O2-level pass that detects when a compare is followed by two
 * branches (one for less-than and one for equal) to the same target, and
 * consolidates them into a single less-than-or-equal check.
 *
 * **Pattern handled:**
 * ```asm
 * ; Before:
 * CMP #$0F
 * BCC .target    ; branch if < $0F
 * BEQ .target    ; branch if = $0F
 *
 * ; After:
 * CMP #$10
 * BCC .target    ; branch if < $10 (equivalent to <= $0F)
 * ```
 *
 * **Why this works:**
 * On the 6502, `CMP #$0F` sets carry if A >= $0F and clears it if A < $0F.
 * BCC branches when carry is clear (A < $0F), and BEQ branches when zero
 * flag is set (A == $0F). Together, BCC+BEQ covers A <= $0F. By bumping
 * the compare value to $10, a single BCC covers the same range: A < $10
 * is equivalent to A <= $0F for unsigned byte values.
 *
 * **Safety constraints:**
 * - Both branches must target the same label
 * - CMP operand must be in range 0x00–0xFE (room to increment to 0xFF max)
 * - Only CMP with immediate addressing mode is eligible
 * - CMP #$FF cannot be incremented (would overflow to 0x00)
 *
 * **Performance impact:**
 * - Saves 2 bytes (one branch instruction removed)
 * - Saves 2-3 cycles (BEQ not taken = 2 cycles, taken = 3 cycles)
 *
 * @module codegen/asm-il/optimizer/passes/compare-branch
 */

import type {
  AsmOptimizationPass,
  AsmOptimizationPassResult,
  AsmPassTransformStats,
} from '../types.js';
import { createEmptyTransformStats, createUnchangedPassResult } from '../types.js';
import type { AsmILProgram, AsmILSection, AsmILElement } from '../../types.js';
import { AsmAddressingMode, isInstructionElement } from '../../types.js';

// ============================================================================
// CompareBranchPass
// ============================================================================

/**
 * Simplifies CMP+BCC+BEQ patterns into CMP+BCC with adjusted compare value.
 *
 * Scans each section for the three-instruction pattern where a CMP with
 * immediate operand is followed by BCC and BEQ to the same target label.
 * When found, increments the CMP value by 1 and removes the BEQ, achieving
 * equivalent behavior with fewer instructions.
 *
 * @example
 * ```typescript
 * const pass = new CompareBranchPass();
 * const result = pass.run(program);
 * ```
 */
export class CompareBranchPass implements AsmOptimizationPass {
  /** @inheritdoc */
  readonly name = 'compare-branch';

  /** @inheritdoc */
  readonly isTransform = true;

  /**
   * Run the compare+branch simplification pass on an ASM-IL program.
   *
   * @param program - The program to optimize
   * @returns Result with optimized program and statistics
   */
  run(program: AsmILProgram): AsmOptimizationPassResult {
    const stats = createEmptyTransformStats();
    let anyChanged = false;
    const newSections: AsmILSection[] = [];

    for (const section of program.sections) {
      const result = this.optimizeSection(section, stats);
      newSections.push(result.section);
      if (result.changed) {
        anyChanged = true;
      }
    }

    if (!anyChanged) {
      return createUnchangedPassResult(program);
    }

    return {
      program: { ...program, sections: newSections },
      changed: true,
      stats,
    };
  }

  // ==========================================================================
  // Section Processing
  // ==========================================================================

  /**
   * Optimize a single section by scanning for CMP+BCC+BEQ patterns.
   *
   * Walks through the section's elements looking for the three-instruction
   * sequence. Non-instruction elements (comments, blanks) between the CMP
   * and branches are skipped during pattern matching but preserved in output.
   *
   * @param section - The section to optimize
   * @param stats - Mutable stats to accumulate
   * @returns The optimized section and whether it changed
   */
  protected optimizeSection(
    section: AsmILSection,
    stats: AsmPassTransformStats
  ): { section: AsmILSection; changed: boolean } {
    const elements = section.elements;
    const newElements: AsmILElement[] = [];
    let changed = false;
    let i = 0;

    while (i < elements.length) {
      const match = this.matchPattern(elements, i);

      if (match) {
        // Emit the CMP with incremented operand value
        const cmpElement = elements[match.cmpIndex];
        if (isInstructionElement(cmpElement)) {
          newElements.push({
            kind: 'instruction',
            instruction: {
              ...cmpElement.instruction,
              operand: match.newCmpValue,
            },
          });
        }

        // Emit any non-instruction elements between CMP and BCC
        for (let j = match.cmpIndex + 1; j < match.bccIndex; j++) {
          newElements.push(elements[j]);
        }

        // Emit the BCC unchanged (it already targets the right label)
        newElements.push(elements[match.bccIndex]);

        // Emit any non-instruction elements between BCC and BEQ
        for (let j = match.bccIndex + 1; j < match.beqIndex; j++) {
          newElements.push(elements[j]);
        }

        // Skip the BEQ — it is removed by this optimization

        changed = true;
        stats.patternsMatched++;
        stats.instructionsRemoved++;
        // BEQ is a 2-byte instruction (branch relative)
        stats.estimatedBytesSaved += 2;
        // BEQ not-taken = 2 cycles, taken = 3 cycles (average ~2.5)
        stats.estimatedCyclesSaved += 2;

        // Continue past the BEQ
        i = match.beqIndex + 1;
      } else {
        newElements.push(elements[i]);
        i++;
      }
    }

    if (!changed) {
      return { section, changed: false };
    }
    return { section: { ...section, elements: newElements }, changed: true };
  }

  // ==========================================================================
  // Pattern Matching
  // ==========================================================================

  /**
   * Try to match the CMP+BCC+BEQ pattern starting at the given index.
   *
   * The pattern requires:
   * 1. CMP with Immediate addressing mode and operand 0x00–0xFE
   * 2. Next instruction is BCC with a label operand
   * 3. Next instruction after BCC is BEQ with the SAME label operand
   *
   * Non-instruction elements (comments, blanks) between instructions
   * are skipped during matching.
   *
   * @param elements - All elements in the section
   * @param startIndex - Index to start matching from
   * @returns Match info with indices and new CMP value, or null if no match
   */
  protected matchPattern(
    elements: readonly AsmILElement[],
    startIndex: number
  ): CompareBranchMatch | null {
    // Step 1: Check for CMP #imm at startIndex
    const cmpEl = elements[startIndex];
    if (!isInstructionElement(cmpEl)) return null;
    if (cmpEl.instruction.mnemonic !== 'CMP') return null;
    if (cmpEl.instruction.mode !== AsmAddressingMode.Immediate) return null;
    if (cmpEl.instruction.operand === undefined) return null;

    const cmpValue = cmpEl.instruction.operand;

    // CMP #$FF cannot be incremented (would overflow byte range)
    if (cmpValue >= 0xFF) return null;

    // Step 2: Find the next instruction after CMP (skip comments/blanks)
    const bccIndex = this.findNextInstruction(elements, startIndex + 1);
    if (bccIndex === null) return null;

    const bccEl = elements[bccIndex];
    if (!isInstructionElement(bccEl)) return null;
    if (bccEl.instruction.mnemonic !== 'BCC') return null;
    if (bccEl.instruction.labelOperand === undefined) return null;

    const targetLabel = bccEl.instruction.labelOperand;

    // Step 3: Find the next instruction after BCC (skip comments/blanks)
    const beqIndex = this.findNextInstruction(elements, bccIndex + 1);
    if (beqIndex === null) return null;

    const beqEl = elements[beqIndex];
    if (!isInstructionElement(beqEl)) return null;
    if (beqEl.instruction.mnemonic !== 'BEQ') return null;
    if (beqEl.instruction.labelOperand === undefined) return null;

    // Both branches must target the same label
    if (beqEl.instruction.labelOperand !== targetLabel) return null;

    return {
      cmpIndex: startIndex,
      bccIndex,
      beqIndex,
      newCmpValue: cmpValue + 1,
    };
  }

  /**
   * Find the next instruction element starting from a given index.
   *
   * Skips comments, blanks, and other non-instruction elements.
   * Stops at labels (labels break the instruction sequence).
   *
   * @param elements - All elements in the section
   * @param fromIndex - Index to start searching from
   * @returns Index of the next instruction, or null if not found
   */
  protected findNextInstruction(
    elements: readonly AsmILElement[],
    fromIndex: number
  ): number | null {
    for (let i = fromIndex; i < elements.length; i++) {
      const el = elements[i];
      // Labels break the sequence — pattern cannot span across labels
      if (el.kind === 'label') return null;
      if (isInstructionElement(el)) return i;
      // Skip comments and blanks
    }
    return null;
  }
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Information about a matched CMP+BCC+BEQ pattern.
 *
 * Contains the indices of the three instructions and the new CMP value
 * (original + 1) that makes a single BCC equivalent to BCC+BEQ.
 */
interface CompareBranchMatch {
  /** Index of the CMP instruction */
  cmpIndex: number;

  /** Index of the BCC instruction */
  bccIndex: number;

  /** Index of the BEQ instruction (to be removed) */
  beqIndex: number;

  /** New operand value for CMP (original + 1) */
  newCmpValue: number;
}
