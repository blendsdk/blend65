/**
 * Transfer Optimization Pass
 *
 * Optimizes register transfer sequences (TAX, TXA, TAY, TYA, TSX, TXS)
 * in 6502 assembly. This is an O2-level pass that handles two key patterns:
 *
 * **Patterns handled:**
 * 1. **Redundant reverse transfer** — TAX followed by TXA (A→X then X→A is noop for A)
 * 2. **Transfer chain simplification** — TAX; TXA; TAY → TAX; TAY (skip redundant TXA)
 *
 * **Safety constraints:**
 * - Only removes reverse transfer when the source register is unmodified between the pair
 * - Labels between transfers break the pattern (could be jumped to with different state)
 * - Branch targets between transfers break the pattern
 *
 * **Performance impact:**
 * - Each removed transfer saves 2 cycles and 1 byte
 *
 * @module codegen/asm-il/optimizer/passes/transfer-opt
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
 * Mapping of transfer instructions to their reverse.
 * If we see TAX then TXA with no modification of A between, the TXA is redundant.
 */
const TRANSFER_REVERSE: Record<string, string> = {
  TAX: 'TXA', // A→X, reverse: X→A
  TAY: 'TYA', // A→Y, reverse: Y→A
  TXA: 'TAX', // X→A, reverse: A→X
  TYA: 'TAY', // Y→A, reverse: A→Y
};

/**
 * Mapping of transfer instructions to the source register they read from.
 * The source is the register whose value is copied (preserved).
 */
const TRANSFER_SOURCE: Record<string, string> = {
  TAX: 'A', // Copies A to X — source is A
  TAY: 'A', // Copies A to Y — source is A
  TXA: 'X', // Copies X to A — source is X
  TYA: 'Y', // Copies Y to A — source is Y
  TSX: 'S', // Copies S to X — source is S
  TXS: 'X', // Copies X to S — source is X
};

/** All recognized transfer mnemonics */
const TRANSFER_MNEMONICS = new Set(['TAX', 'TAY', 'TXA', 'TYA', 'TSX', 'TXS']);

/**
 * Instructions that modify register A.
 * Used to determine if the source register of a transfer pair is still valid.
 */
const MODIFIES_A = new Set([
  'LDA', 'TXA', 'TYA', 'PLA',
  'ADC', 'SBC', 'AND', 'ORA', 'EOR',
  'ASL', 'LSR', 'ROL', 'ROR', // Accumulator mode only, but conservatively include
]);

/** Instructions that modify register X */
const MODIFIES_X = new Set([
  'LDX', 'TAX', 'TSX', 'INX', 'DEX',
]);

/** Instructions that modify register Y */
const MODIFIES_Y = new Set([
  'LDY', 'TAY', 'INY', 'DEY',
]);

/** Instructions that are unconditional control flow (break analysis) */
const CONTROL_FLOW = new Set([
  'JMP', 'JSR', 'RTS', 'RTI', 'BRK',
  'BCC', 'BCS', 'BEQ', 'BNE', 'BMI', 'BPL', 'BVC', 'BVS',
]);

// ============================================================================
// TransferOptPass
// ============================================================================

/**
 * Optimizes register transfer sequences in 6502 assembly.
 *
 * Processes each section independently, scanning for transfer pairs
 * where the reverse transfer is redundant (source register unmodified).
 *
 * @example
 * ```typescript
 * const pass = new TransferOptPass();
 * const result = pass.run(program);
 * ```
 */
export class TransferOptPass implements AsmOptimizationPass {
  /** @inheritdoc */
  readonly name = 'transfer-opt';

  /** @inheritdoc */
  readonly isTransform = true;

  /**
   * Run the transfer optimization pass on an ASM-IL program.
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
   * Optimize a single section by removing redundant transfer instructions.
   *
   * Scans for transfer pairs (e.g., TAX...TXA) where the source register
   * is unmodified between them, making the reverse transfer redundant.
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
    if (elements.length === 0) {
      return { section, changed: false };
    }

    // Mark indices of elements to remove
    const removeSet = new Set<number>();

    // Scan for redundant reverse transfer patterns
    this.findRedundantReverseTransfers(elements, removeSet, stats);

    if (removeSet.size === 0) {
      return { section, changed: false };
    }

    // Build new elements array without removed indices
    const newElements = elements.filter((_, index) => !removeSet.has(index));

    return {
      section: { ...section, elements: newElements },
      changed: true,
    };
  }

  // ==========================================================================
  // Pattern 1: Redundant Reverse Transfer
  // ==========================================================================

  /**
   * Find redundant reverse transfers and mark them for removal.
   *
   * For each transfer instruction (e.g., TAX), looks ahead for its reverse
   * (TXA) without the source register (A) being modified in between.
   * If found, the reverse is redundant because the source still holds
   * the original value.
   *
   * @param elements - All elements in section
   * @param removeSet - Set of indices to remove (mutated)
   * @param stats - Stats accumulator (mutated)
   */
  protected findRedundantReverseTransfers(
    elements: readonly AsmILElement[],
    removeSet: Set<number>,
    stats: AsmPassTransformStats
  ): void {
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (!isInstructionElement(el)) continue;

      const mnemonic = el.instruction.mnemonic;
      if (!TRANSFER_MNEMONICS.has(mnemonic)) continue;

      // Get the reverse instruction for this transfer
      const reverse = TRANSFER_REVERSE[mnemonic];
      if (!reverse) continue; // TSX/TXS don't have simple reverses

      // Get the source register (the one that must be unmodified)
      const sourceReg = TRANSFER_SOURCE[mnemonic];
      if (!sourceReg) continue;

      // Look ahead for the reverse transfer
      this.scanForRedundantReverse(elements, i, reverse, sourceReg, removeSet, stats);
    }
  }

  /**
   * Scan forward from a transfer instruction looking for its redundant reverse.
   *
   * Starting after index `startIndex`, scan forward through instructions.
   * If we find the `reverse` instruction before the `sourceReg` is modified,
   * that reverse is redundant and can be removed.
   *
   * We stop scanning when:
   * - We find the reverse instruction (mark for removal)
   * - The source register is modified (reverse would be needed)
   * - We encounter a label (could be jumped to with different state)
   * - We encounter control flow (changes execution context)
   * - We reach the end of elements
   *
   * @param elements - All elements in section
   * @param startIndex - Index of the initial transfer instruction
   * @param reverse - The reverse mnemonic to look for (e.g., 'TXA' for 'TAX')
   * @param sourceReg - Register that must be unmodified (e.g., 'A' for 'TAX')
   * @param removeSet - Set of indices to remove (mutated)
   * @param stats - Stats accumulator (mutated)
   */
  protected scanForRedundantReverse(
    elements: readonly AsmILElement[],
    startIndex: number,
    reverse: string,
    sourceReg: string,
    removeSet: Set<number>,
    stats: AsmPassTransformStats
  ): void {
    for (let j = startIndex + 1; j < elements.length; j++) {
      const next = elements[j];

      // Labels break the pattern — could be jumped to with different register state
      if (next.kind === 'label') return;

      // Skip non-instruction elements (comments, blanks)
      if (!isInstructionElement(next)) continue;

      const nextMnemonic = next.instruction.mnemonic;

      // Found the reverse transfer — it's redundant if we got here
      if (nextMnemonic === reverse && !removeSet.has(j)) {
        removeSet.add(j);
        stats.patternsMatched++;
        stats.instructionsRemoved++;
        stats.estimatedBytesSaved += 1;  // Transfer = 1 byte (implied mode)
        stats.estimatedCyclesSaved += 2; // Transfer = 2 cycles
        return;
      }

      // Check if the source register is modified — pattern is broken
      if (this.modifiesRegister(nextMnemonic, sourceReg)) return;

      // Control flow instructions break the pattern
      if (CONTROL_FLOW.has(nextMnemonic)) return;
    }
  }

  // ==========================================================================
  // Register Modification Detection
  // ==========================================================================

  /**
   * Check if a mnemonic modifies a specific register.
   *
   * @param mnemonic - The instruction mnemonic
   * @param register - The register to check ('A', 'X', or 'Y')
   * @returns True if the mnemonic modifies the register
   */
  protected modifiesRegister(mnemonic: string, register: string): boolean {
    switch (register) {
      case 'A': return MODIFIES_A.has(mnemonic);
      case 'X': return MODIFIES_X.has(mnemonic);
      case 'Y': return MODIFIES_Y.has(mnemonic);
      default: return false;
    }
  }
}
