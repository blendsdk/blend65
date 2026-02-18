/**
 * Long-Branch Expansion Pass
 *
 * Detects conditional branches whose targets may exceed the 6502's
 * ±127 byte range and expands them into an inverted-branch + JMP pattern.
 *
 * **Transformation:**
 * ```
 *   BCS .far_label  →  BCC .skip_long_N
 *                       JMP .far_label
 *                       .skip_long_N:
 * ```
 *
 * This pass MUST run LAST in the ASM-IL optimizer pipeline. It runs after
 * branch-opt to avoid conflicts with branch-opt's Pattern 3 which performs
 * the inverse transformation (collapsing branch-over-JMP into a single branch).
 *
 * **Why this pass exists:**
 * Function inlining at O2/O3 can make loop bodies and conditional blocks
 * exceed the 6502's ±127 byte branch range. Without expansion, ACME reports
 * "Target out of range" errors. This pass ensures all branches are within
 * range by expanding those that may be too far into JMP-based equivalents.
 *
 * **Safety:**
 * - Uses per-addressing-mode byte estimation for accuracy (±1 byte)
 * - Conservative threshold (100 bytes) well below the 127-byte limit
 * - Over-expansion is harmless (adds 3 bytes + 1 label per case)
 * - Under-expansion would cause ACME assembly failure
 *
 * @module codegen/asm-il/optimizer/passes/long-branch-expansion
 */

import type {
  AsmOptimizationPass,
  AsmOptimizationPassResult,
  AsmPassTransformStats,
} from '../types.js';
import { createEmptyTransformStats, createUnchangedPassResult } from '../types.js';
import type {
  AsmILProgram,
  AsmILSection,
  AsmILElement,
  AsmInstruction,
} from '../../types.js';
import {
  AsmAddressingMode,
  isInstructionElement,
  isLabelElement,
} from '../../types.js';

// ============================================================================
// Constants
// ============================================================================

/** All conditional branch mnemonics on the 6502 */
const CONDITIONAL_BRANCHES = new Set([
  'BCC', 'BCS', 'BEQ', 'BNE', 'BMI', 'BPL', 'BVC', 'BVS',
]);

/**
 * Branch inversion mapping.
 *
 * Each conditional branch has an opposite condition. When expanding
 * a long branch, we invert the condition to skip over the JMP:
 * `BCS .far` → `BCC .skip; JMP .far; .skip:`
 */
const BRANCH_INVERSIONS: Record<string, string> = {
  BCC: 'BCS', BCS: 'BCC',
  BEQ: 'BNE', BNE: 'BEQ',
  BMI: 'BPL', BPL: 'BMI',
  BVC: 'BVS', BVS: 'BVC',
};

/**
 * Byte-distance threshold for expansion.
 *
 * Branches with estimated distance greater than this value are expanded.
 * Set to 100, well below the 6502's ±127 byte limit, to account for
 * minor estimation inaccuracy on label-operand instructions where
 * we can't distinguish ZP (2 bytes) from Absolute (3 bytes).
 *
 * Over-expansion is safe (adds 3 bytes per expansion); under-expansion
 * causes ACME "Target out of range" assembly failures.
 */
const LONG_BRANCH_THRESHOLD = 100;

// ============================================================================
// LongBranchExpansionPass
// ============================================================================

/**
 * Expands out-of-range conditional branches into inverted-branch + JMP.
 *
 * Scans each section for conditional branches (BCS, BCC, BEQ, BNE, etc.)
 * with label targets, estimates the byte distance to the target, and
 * expands any branch that exceeds the safety threshold.
 *
 * This pass is designed to run as the LAST pass in the optimizer pipeline
 * at all O1+ levels. It ensures ACME never encounters an out-of-range branch.
 *
 * @example
 * ```typescript
 * const pass = new LongBranchExpansionPass();
 * const result = pass.run(program);
 * // Any long branches are now expanded to JMP-based equivalents
 * ```
 */
export class LongBranchExpansionPass implements AsmOptimizationPass {
  /** @inheritdoc */
  readonly name = 'long-branch-expansion';

  /** @inheritdoc */
  readonly isTransform = true;

  /**
   * Counter for generating unique skip labels.
   * Reset at the start of each `run()` invocation.
   */
  protected labelCounter = 0;

  /**
   * Run the long-branch expansion pass on an ASM-IL program.
   *
   * Processes each section independently, scanning for conditional branches
   * that may exceed the 6502's ±127 byte range and expanding them.
   *
   * @param program - The program to scan and expand
   * @returns Result with expanded program and statistics
   */
  run(program: AsmILProgram): AsmOptimizationPassResult {
    // Reset label counter for this invocation to keep labels deterministic
    this.labelCounter = 0;

    const stats = createEmptyTransformStats();
    let anyChanged = false;
    const newSections: AsmILSection[] = [];

    for (const section of program.sections) {
      const result = this.expandSection(section, stats);
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
   * Scan a section for long branches and expand them.
   *
   * Algorithm:
   * 1. Build a label position map: label_name → element_index
   * 2. For each element, if it's a conditional branch with a label operand:
   *    a. Look up the target label's position in the map
   *    b. Estimate the byte distance between the branch and its target
   *    c. If the distance exceeds the threshold, replace the branch with:
   *       - An inverted branch to a new unique skip label
   *       - A JMP to the original target
   *       - The skip label definition
   *
   * The section is processed in a single forward pass. When a branch is
   * expanded, the label map is NOT rebuilt — the expanded instructions
   * shift positions, but because we only expand (never collapse) and
   * we process forward, already-checked branches are not affected.
   *
   * @param section - The section to process
   * @param stats - Mutable stats to accumulate
   * @returns The expanded section and whether it changed
   */
  protected expandSection(
    section: AsmILSection,
    stats: AsmPassTransformStats
  ): { section: AsmILSection; changed: boolean } {
    const elements = section.elements;

    // Step 1: Build label position map (label name → element index)
    const labelPositions = this.buildLabelPositionMap(elements);

    const newElements: AsmILElement[] = [];
    let changed = false;

    // Step 2: Scan for conditional branches and expand if needed
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];

      // Only process conditional branch instructions with label operands
      if (
        isInstructionElement(element) &&
        CONDITIONAL_BRANCHES.has(element.instruction.mnemonic) &&
        element.instruction.labelOperand !== undefined
      ) {
        const targetLabel = element.instruction.labelOperand;
        const targetIndex = labelPositions.get(targetLabel);

        // If target label not found in this section, skip expansion.
        // The target may be in another section (rare, but possible).
        if (targetIndex === undefined) {
          newElements.push(element);
          continue;
        }

        // Estimate byte distance between the branch and its target
        const distance = this.estimateByteDistance(elements, i, targetIndex);

        if (distance > LONG_BRANCH_THRESHOLD) {
          // Expand: replace BCS .far with BCC .skip; JMP .far; .skip:
          const skipLabel = this.uniqueSkipLabel();
          const invertedMnemonic = BRANCH_INVERSIONS[element.instruction.mnemonic];

          // 1. Inverted branch to skip label (jumps over the JMP if condition is now true)
          newElements.push({
            kind: 'instruction',
            instruction: {
              mnemonic: invertedMnemonic,
              mode: AsmAddressingMode.Relative,
              labelOperand: skipLabel,
              comment: `long-branch expansion (${element.instruction.mnemonic} ${targetLabel} → ${invertedMnemonic} + JMP)`,
            },
          });

          // 2. JMP to the original far target
          newElements.push({
            kind: 'instruction',
            instruction: {
              mnemonic: 'JMP',
              mode: AsmAddressingMode.Absolute,
              labelOperand: targetLabel,
            },
          });

          // 3. Skip label definition (the inverted branch lands here)
          newElements.push({
            kind: 'label',
            label: {
              name: skipLabel,
              isLocal: true,
            },
          });

          changed = true;
          stats.patternsMatched++;
          // We added 2 instructions (inverted branch + JMP) and 1 label,
          // replacing 1 instruction. Net: +1 instruction, +1 label.
          stats.instructionsAdded += 1;
          // Bytes added: original branch was 2 bytes, now we have
          // inverted branch (2 bytes) + JMP (3 bytes) = 5 bytes total.
          // Net cost: 3 bytes more per expansion. Report as negative savings.
          stats.estimatedBytesSaved -= 3;
          continue;
        }
      }

      // Not a long branch — keep the element as-is
      newElements.push(element);
    }

    if (!changed) {
      return { section, changed: false };
    }
    return { section: { ...section, elements: newElements }, changed: true };
  }

  // ==========================================================================
  // Byte Distance Estimation
  // ==========================================================================

  /**
   * Estimate the byte distance between two element indices in a section.
   *
   * Sums the estimated byte sizes of all instruction elements between
   * the two positions. Labels, comments, blanks, and directives contribute
   * 0 bytes to the instruction stream (labels are resolved at assembly time).
   *
   * Uses per-addressing-mode estimation for accuracy within ±1 byte.
   * The only uncertainty is label-operand instructions where we can't tell
   * if the assembler will resolve them as ZP (2 bytes) or Absolute (3 bytes).
   * We conservatively assume 3 bytes for these, which overestimates distance
   * and makes expansion more likely — the safe direction.
   *
   * @param elements - All elements in the section
   * @param fromIndex - Index of the branch instruction
   * @param toIndex - Index of the target label
   * @returns Estimated byte distance between the two positions
   */
  protected estimateByteDistance(
    elements: readonly AsmILElement[],
    fromIndex: number,
    toIndex: number
  ): number {
    // Always iterate from the lower to the higher index
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    let bytes = 0;

    for (let i = start; i < end; i++) {
      const el = elements[i];
      if (isInstructionElement(el)) {
        bytes += this.estimateInstructionBytes(el.instruction);
      }
      // Labels, comments, blanks, directives contribute 0 bytes
    }

    return bytes;
  }

  /**
   * Estimate the byte size of a single 6502 instruction based on its addressing mode.
   *
   * 6502 instructions are 1, 2, or 3 bytes:
   * - **1 byte**: Implied (NOP, RTS) and Accumulator (ASL A)
   * - **2 bytes**: Immediate (#$FF), ZeroPage ($00), ZP,X/Y, Relative (branches),
   *               Indexed Indirect (($00,X)), Indirect Indexed (($00),Y)
   * - **3 bytes**: Absolute ($1000), Abs,X/Y, Indirect (($1000))
   *
   * For unknown modes, conservatively returns 3 (overestimate is safe).
   *
   * @param instr - The instruction to estimate
   * @returns Estimated byte size (1, 2, or 3)
   */
  protected estimateInstructionBytes(instr: AsmInstruction): number {
    switch (instr.mode) {
      // 1-byte instructions: opcode only
      case AsmAddressingMode.Implied:
      case AsmAddressingMode.Accumulator:
        return 1;

      // 2-byte instructions: opcode + 1 byte operand
      case AsmAddressingMode.Immediate:
      case AsmAddressingMode.ZeroPage:
      case AsmAddressingMode.ZeroPageX:
      case AsmAddressingMode.ZeroPageY:
      case AsmAddressingMode.Relative:
      case AsmAddressingMode.IndexedIndirect:
      case AsmAddressingMode.IndirectIndexed:
        return 2;

      // 3-byte instructions: opcode + 2 byte operand
      case AsmAddressingMode.Absolute:
      case AsmAddressingMode.AbsoluteX:
      case AsmAddressingMode.AbsoluteY:
      case AsmAddressingMode.Indirect:
        return 3;

      // Unknown mode — conservatively assume 3 bytes (safe overestimate)
      default:
        return 3;
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Build a map of label names to their element indices in the section.
   *
   * Used to quickly look up the position of a branch target label
   * without scanning the entire element array each time.
   *
   * @param elements - All elements in the section
   * @returns Map from label name to element index
   */
  protected buildLabelPositionMap(
    elements: readonly AsmILElement[]
  ): Map<string, number> {
    const map = new Map<string, number>();
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (isLabelElement(el)) {
        map.set(el.label.name, i);
      }
    }
    return map;
  }

  /**
   * Generate a unique skip label for a long-branch expansion.
   *
   * Labels are section-local (prefixed with `.`) so there's no risk
   * of cross-section collision. The counter increments per expansion
   * within a single `run()` invocation, ensuring uniqueness.
   *
   * @returns A unique local label name like `.skip_long_0`, `.skip_long_1`, etc.
   */
  protected uniqueSkipLabel(): string {
    return `.skip_long_${this.labelCounter++}`;
  }
}
