/**
 * Stack Optimization Pass
 *
 * Eliminates redundant PHA/PLA pairs when the saved value is not needed
 * or the accumulator is not modified between push and pull.
 *
 * **Patterns handled:**
 * 1. **PHA/PLA with A unmodified** — Remove both (A still has same value)
 * 2. **PHA/PLA where A is immediately overwritten** — Remove both
 *    (restored value is discarded by the next instruction)
 *
 * **Safety constraints:**
 * - Labels between PHA/PLA break the pattern (could be jumped to)
 * - Control flow breaks the pattern (JSR, JMP, branches)
 * - Nested PHA/PLA pairs are tracked by stack depth
 * - JSR between PHA/PLA is conservative (assumes A modified)
 *
 * **Performance impact:**
 * - Each removed PHA/PLA pair saves 7 cycles and 2 bytes
 *   (PHA = 3 cycles/1 byte, PLA = 4 cycles/1 byte)
 *
 * **Enabled at:** O3, Os, Oz
 *
 * @module codegen/asm-il/optimizer/passes/stack-opt
 */

import type {
  AsmOptimizationPass,
  AsmOptimizationPassResult,
  AsmPassTransformStats,
} from '../types.js';
import { createEmptyTransformStats, createUnchangedPassResult } from '../types.js';
import type { AsmILProgram, AsmILSection, AsmILElement } from '../../types.js';
import { isInstructionElement } from '../../types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Instructions that modify register A (making PHA/PLA pair necessary
 * if A needs to be preserved).
 */
const MODIFIES_A = new Set([
  'LDA', 'TXA', 'TYA', 'PLA',
  'ADC', 'SBC', 'AND', 'ORA', 'EOR',
  'ASL', 'LSR', 'ROL', 'ROR', // Accumulator mode, conservatively included
]);

/**
 * Instructions that overwrite A (making a preceding PLA redundant
 * because the restored value is immediately discarded).
 */
const OVERWRITES_A = new Set([
  'LDA', 'TXA', 'TYA', 'PLA',
]);

/**
 * Instructions that are control flow and break PHA/PLA analysis.
 * JSR is included because the subroutine may modify A.
 */
const CONTROL_FLOW = new Set([
  'JMP', 'JSR', 'RTS', 'RTI', 'BRK',
  'BCC', 'BCS', 'BEQ', 'BNE', 'BMI', 'BPL', 'BVC', 'BVS',
]);

/**
 * Cycles saved when removing a PHA/PLA pair.
 * PHA = 3 cycles, PLA = 4 cycles → 7 total.
 */
const CYCLES_PER_PAIR = 7;

/**
 * Bytes saved when removing a PHA/PLA pair.
 * PHA = 1 byte, PLA = 1 byte → 2 total.
 */
const BYTES_PER_PAIR = 2;

// ============================================================================
// StackOptPass
// ============================================================================

/**
 * Eliminates redundant PHA/PLA pairs in 6502 assembly.
 *
 * @example
 * ```typescript
 * const pass = new StackOptPass();
 * const result = pass.run(program);
 * ```
 */
export class StackOptPass implements AsmOptimizationPass {
  /** @inheritdoc */
  readonly name = 'stack-opt';

  /** @inheritdoc */
  readonly isTransform = true;

  /**
   * Run the stack optimization pass on an ASM-IL program.
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
   * Optimize a single section by finding and removing redundant PHA/PLA pairs.
   *
   * @param section - The section to optimize
   * @param stats - Mutable stats accumulator
   * @returns Optimized section and whether it changed
   */
  protected optimizeSection(
    section: AsmILSection,
    stats: AsmPassTransformStats
  ): { section: AsmILSection; changed: boolean } {
    const elements = section.elements;
    if (elements.length < 2) {
      return { section, changed: false };
    }

    // Mark indices of elements to remove (both PHA and PLA of each pair)
    const removeSet = new Set<number>();

    this.findRedundantPairs(elements, removeSet, stats);

    if (removeSet.size === 0) {
      return { section, changed: false };
    }

    const newElements = elements.filter((_, index) => !removeSet.has(index));

    return {
      section: { ...section, elements: newElements },
      changed: true,
    };
  }

  // ==========================================================================
  // Pattern Detection
  // ==========================================================================

  /**
   * Find redundant PHA/PLA pairs and mark them for removal.
   *
   * Two patterns are checked:
   *
   * **Pattern 1: A unmodified between PHA and PLA**
   *   PHA; ... (no A modification) ...; PLA → remove both
   *
   * **Pattern 2: A immediately overwritten after PLA**
   *   PHA; ...; PLA; LDA #x → remove PHA and PLA (restored value is discarded)
   *
   * @param elements - All elements in the section
   * @param removeSet - Set of indices to remove (mutated)
   * @param stats - Stats accumulator (mutated)
   */
  protected findRedundantPairs(
    elements: readonly AsmILElement[],
    removeSet: Set<number>,
    stats: AsmPassTransformStats
  ): void {
    for (let i = 0; i < elements.length; i++) {
      // Skip already-removed elements
      if (removeSet.has(i)) continue;

      const el = elements[i];
      if (!isInstructionElement(el)) continue;
      if (el.instruction.mnemonic !== 'PHA') continue;

      // Found a PHA — scan forward for matching PLA
      this.scanForMatchingPLA(elements, i, removeSet, stats);
    }
  }

  /**
   * Scan forward from a PHA instruction to find its matching PLA.
   *
   * Tracks stack depth to handle nested PHA/PLA pairs correctly.
   * If the matching PLA is found and the pair is redundant, both are
   * marked for removal.
   *
   * @param elements - All elements in the section
   * @param phaIndex - Index of the PHA instruction
   * @param removeSet - Set of indices to remove (mutated)
   * @param stats - Stats accumulator (mutated)
   */
  protected scanForMatchingPLA(
    elements: readonly AsmILElement[],
    phaIndex: number,
    removeSet: Set<number>,
    stats: AsmPassTransformStats
  ): void {
    let stackDepth = 1; // We've seen one PHA
    let aModified = false; // Track if A was modified between PHA and PLA

    for (let j = phaIndex + 1; j < elements.length; j++) {
      const next = elements[j];

      // Labels break the pattern — could be jumped to with different state
      if (next.kind === 'label') return;

      // Skip non-instruction elements (comments, blanks)
      if (!isInstructionElement(next)) continue;

      const mnemonic = next.instruction.mnemonic;

      // Track nested PHA instructions
      if (mnemonic === 'PHA') {
        stackDepth++;
        continue;
      }

      // Track matching PLA
      if (mnemonic === 'PLA') {
        stackDepth--;

        // This PLA matches our original PHA (stack depth back to 0)
        if (stackDepth === 0) {
          // Check if pair is removable
          if (this.isPairRemovable(elements, phaIndex, j, aModified)) {
            removeSet.add(phaIndex);
            removeSet.add(j);
            stats.patternsMatched++;
            stats.instructionsRemoved += 2;
            stats.estimatedCyclesSaved += CYCLES_PER_PAIR;
            stats.estimatedBytesSaved += BYTES_PER_PAIR;
          }
          return; // Done with this PHA's search
        }
        continue;
      }

      // Control flow breaks the analysis (conservative)
      if (CONTROL_FLOW.has(mnemonic)) return;

      // Track A modifications (only at matching depth level)
      if (stackDepth === 1 && MODIFIES_A.has(mnemonic)) {
        aModified = true;
      }
    }

    // PLA not found — can't remove (unbalanced stack)
  }

  // ==========================================================================
  // Pair Removability Check
  // ==========================================================================

  /**
   * Determine if a matched PHA/PLA pair is safe to remove.
   *
   * A pair is removable in two cases:
   * 1. A was NOT modified between PHA and PLA (PLA restores A to same value)
   * 2. A IS immediately overwritten after PLA (restored value is discarded)
   *
   * @param elements - All elements in the section
   * @param phaIndex - Index of the PHA
   * @param plaIndex - Index of the matching PLA
   * @param aModified - Whether A was modified between PHA and PLA
   * @returns True if the pair can be safely removed
   */
  protected isPairRemovable(
    elements: readonly AsmILElement[],
    _phaIndex: number,
    plaIndex: number,
    aModified: boolean
  ): boolean {
    // Pattern 1: A was not modified — PLA restores to same value, unnecessary
    if (!aModified) {
      return true;
    }

    // Pattern 2: A IS modified, but the value restored by PLA is immediately
    // overwritten by the next instruction — so the restore was pointless
    return this.isAOverwrittenAfter(elements, plaIndex);
  }

  /**
   * Check if the accumulator is immediately overwritten after the given index.
   *
   * Looks at the next instruction element after `index` and checks if it
   * unconditionally overwrites A (e.g., LDA, TXA, TYA).
   *
   * @param elements - All elements in the section
   * @param index - Index to check after
   * @returns True if A is immediately overwritten
   */
  protected isAOverwrittenAfter(
    elements: readonly AsmILElement[],
    index: number
  ): boolean {
    // Look for the next instruction element after the given index
    for (let k = index + 1; k < elements.length; k++) {
      const next = elements[k];

      // Skip non-instruction elements (comments, blanks)
      if (next.kind === 'comment' || next.kind === 'blank') continue;

      // Labels mean code could jump here — can't assume overwrite
      if (next.kind === 'label') return false;

      // Check if it's an instruction that overwrites A
      if (isInstructionElement(next)) {
        return OVERWRITES_A.has(next.instruction.mnemonic);
      }

      return false;
    }

    return false;
  }
}
