/**
 * 6502 Strength Reduction Pass
 *
 * Replaces expensive operations (multiply, divide, modulo) with cheaper
 * 6502-specific instruction sequences using shifts and masks.
 *
 * **Patterns handled:**
 * 1. Multiply by power of 2 → ASL chain
 * 2. Divide by power of 2 → LSR chain
 * 3. Modulo by power of 2 → AND mask
 *
 * **How it works:**
 * The code generator may emit JSR calls to runtime multiplication/division
 * routines. This pass detects these patterns (specifically, sequences like
 * `LDA value; LDX #constant; JSR __mul` or direct `ASL` chains that can
 * be simplified) and replaces them with inline shift/mask instructions.
 *
 * For this initial implementation, we focus on the simpler in-place patterns:
 * - Sequences of `LDA operand; ASL A; ...` (already inline)
 * - The pass identifies multiply-by-constant sequences and optimizes them
 *
 * **Enabled at:** O3 only (may change code size)
 *
 * @module codegen/asm-il/optimizer/passes/strength-6502
 */

import type {
  AsmOptimizationPass,
  AsmOptimizationPassResult,
  AsmPassTransformStats,
} from '../types.js';
import { createEmptyTransformStats, createUnchangedPassResult } from '../types.js';
import type { AsmILProgram, AsmILSection, AsmILElement } from '../../types.js';
import { AsmAddressingMode, isInstructionElement, createInstructionElement } from '../../types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Runtime multiplication subroutine names that can be replaced with shifts.
 * The code generator may emit `JSR __mul_byte` for byte multiplications.
 */
const MUL_ROUTINES = new Set(['__mul_byte', '__mul8', '_mul']);

/**
 * Runtime division subroutine names.
 */
const DIV_ROUTINES = new Set(['__div_byte', '__div8', '_div']);

/**
 * Runtime modulo subroutine names.
 */
const MOD_ROUTINES = new Set(['__mod_byte', '__mod8', '_mod']);

// ============================================================================
// Strength6502Pass
// ============================================================================

/**
 * Replaces expensive multiply/divide/modulo operations with cheaper
 * 6502-specific shift and mask sequences.
 *
 * @example
 * ```typescript
 * const pass = new Strength6502Pass();
 * const result = pass.run(program);
 * ```
 */
export class Strength6502Pass implements AsmOptimizationPass {
  /** @inheritdoc */
  readonly name = '6502-strength';

  /** @inheritdoc */
  readonly isTransform = true;

  /**
   * Run the strength reduction pass on an ASM-IL program.
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
   * Optimize a single section by replacing expensive operations with shifts/masks.
   *
   * Scans for patterns like:
   * - `LDA operand; LDX #N; JSR __mul_byte` → inline shift sequence
   * - `LDA operand; LDX #N; JSR __div_byte` → inline LSR sequence
   * - `LDA operand; LDX #N; JSR __mod_byte` → inline AND mask
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
    if (elements.length < 3) {
      return { section, changed: false };
    }

    const newElements: AsmILElement[] = [];
    let changed = false;
    let i = 0;

    while (i < elements.length) {
      // Try to match a 3-instruction pattern: LDA + LDX #const + JSR routine
      const replacement = this.tryMatchRuntimeCall(elements, i, stats);
      if (replacement) {
        newElements.push(...replacement.instructions);
        changed = true;
        i += 3; // Skip the 3 matched instructions
        continue;
      }

      // No pattern matched — keep the original instruction
      newElements.push(elements[i]);
      i++;
    }

    if (!changed) {
      return { section, changed: false };
    }

    return {
      section: { ...section, elements: newElements },
      changed: true,
    };
  }

  // ==========================================================================
  // Pattern Matching
  // ==========================================================================

  /**
   * Try to match a runtime subroutine call pattern and return its replacement.
   *
   * Matches: LDA operand; LDX #constant; JSR __mul/__div/__mod
   *
   * @param elements - All elements in the section
   * @param index - Current index to check
   * @param stats - Stats accumulator (mutated on match)
   * @returns Replacement instructions if pattern matched, null otherwise
   */
  protected tryMatchRuntimeCall(
    elements: readonly AsmILElement[],
    index: number,
    stats: AsmPassTransformStats
  ): { instructions: AsmILElement[] } | null {
    // Need at least 3 elements remaining
    if (index + 2 >= elements.length) return null;

    const el0 = elements[index];
    const el1 = elements[index + 1];
    const el2 = elements[index + 2];

    // Element 0: LDA (any mode — loads the value to operate on)
    if (!isInstructionElement(el0)) return null;
    if (el0.instruction.mnemonic !== 'LDA') return null;

    // Element 1: LDX #constant (the multiplier/divisor)
    if (!isInstructionElement(el1)) return null;
    if (el1.instruction.mnemonic !== 'LDX') return null;
    if (el1.instruction.mode !== AsmAddressingMode.Immediate) return null;
    if (el1.instruction.operand === undefined) return null;

    const constant = el1.instruction.operand;

    // Element 2: JSR routine_name
    if (!isInstructionElement(el2)) return null;
    if (el2.instruction.mnemonic !== 'JSR') return null;

    const routineName = el2.instruction.labelOperand;
    if (!routineName) return null;

    // Try multiplication replacement
    if (MUL_ROUTINES.has(routineName)) {
      return this.tryMulReplacement(el0, constant, stats);
    }

    // Try division replacement
    if (DIV_ROUTINES.has(routineName)) {
      return this.tryDivReplacement(el0, constant, stats);
    }

    // Try modulo replacement
    if (MOD_ROUTINES.has(routineName)) {
      return this.tryModReplacement(el0, constant, stats);
    }

    return null;
  }

  // ==========================================================================
  // Multiply Replacement
  // ==========================================================================

  /**
   * Replace multiplication by a constant with ASL shifts.
   *
   * Only handles powers of 2: ×2, ×4, ×8, ×16, ×32, ×64, ×128.
   *
   * @param ldaElement - The original LDA instruction element
   * @param multiplier - The constant multiplier
   * @param stats - Stats accumulator
   * @returns Replacement instructions or null if not a power of 2
   */
  protected tryMulReplacement(
    ldaElement: AsmILElement,
    multiplier: number,
    stats: AsmPassTransformStats
  ): { instructions: AsmILElement[] } | null {
    const shiftCount = this.log2(multiplier);
    if (shiftCount === null || shiftCount === 0) return null;

    // Limit to reasonable shift counts (more than 7 is pointless for bytes)
    if (shiftCount > 7) return null;

    const instructions: AsmILElement[] = [ldaElement]; // Keep the LDA

    // Add ASL A instructions for each shift
    for (let s = 0; s < shiftCount; s++) {
      instructions.push(createInstructionElement('ASL', AsmAddressingMode.Accumulator));
    }

    // Each ASL is 2 cycles; JSR __mul is ~80+ cycles
    // LDX #n = 2 cycles, JSR = 6 cycles + routine overhead
    const originalCycles = 2 + 6 + 70; // Approximate: LDX + JSR + routine body
    const newCycles = shiftCount * 2;   // Each ASL = 2 cycles
    const originalBytes = 2 + 3;        // LDX #n (2) + JSR addr (3) = 5
    const newBytes = shiftCount;        // Each ASL = 1 byte

    stats.patternsMatched++;
    stats.instructionsRemoved += 2;     // LDX + JSR removed
    stats.instructionsAdded += shiftCount; // ASL × N added
    stats.estimatedCyclesSaved += Math.max(0, originalCycles - newCycles);
    stats.estimatedBytesSaved += Math.max(0, originalBytes - newBytes);

    return { instructions };
  }

  // ==========================================================================
  // Division Replacement
  // ==========================================================================

  /**
   * Replace division by a constant with LSR shifts.
   *
   * Only handles powers of 2 for unsigned division.
   *
   * @param ldaElement - The original LDA instruction element
   * @param divisor - The constant divisor
   * @param stats - Stats accumulator
   * @returns Replacement instructions or null if not a power of 2
   */
  protected tryDivReplacement(
    ldaElement: AsmILElement,
    divisor: number,
    stats: AsmPassTransformStats
  ): { instructions: AsmILElement[] } | null {
    const shiftCount = this.log2(divisor);
    if (shiftCount === null || shiftCount === 0) return null;
    if (shiftCount > 7) return null;

    const instructions: AsmILElement[] = [ldaElement]; // Keep the LDA

    // Add LSR A instructions for each shift
    for (let s = 0; s < shiftCount; s++) {
      instructions.push(createInstructionElement('LSR', AsmAddressingMode.Accumulator));
    }

    const originalCycles = 2 + 6 + 70;
    const newCycles = shiftCount * 2;
    const originalBytes = 2 + 3;
    const newBytes = shiftCount;

    stats.patternsMatched++;
    stats.instructionsRemoved += 2;
    stats.instructionsAdded += shiftCount;
    stats.estimatedCyclesSaved += Math.max(0, originalCycles - newCycles);
    stats.estimatedBytesSaved += Math.max(0, originalBytes - newBytes);

    return { instructions };
  }

  // ==========================================================================
  // Modulo Replacement
  // ==========================================================================

  /**
   * Replace modulo by a constant with AND mask.
   *
   * x % N (where N is power of 2) = x AND (N-1)
   *
   * @param ldaElement - The original LDA instruction element
   * @param modulus - The constant modulus
   * @param stats - Stats accumulator
   * @returns Replacement instructions or null if not a power of 2
   */
  protected tryModReplacement(
    ldaElement: AsmILElement,
    modulus: number,
    stats: AsmPassTransformStats
  ): { instructions: AsmILElement[] } | null {
    const shiftCount = this.log2(modulus);
    if (shiftCount === null || shiftCount === 0) return null;

    const mask = modulus - 1; // e.g., %8 → AND #$07

    const instructions: AsmILElement[] = [
      ldaElement, // Keep the LDA
      createInstructionElement('AND', AsmAddressingMode.Immediate, mask),
    ];

    const originalCycles = 2 + 6 + 60;
    const newCycles = 2; // AND #imm = 2 cycles
    const originalBytes = 2 + 3;
    const newBytes = 2; // AND #imm = 2 bytes

    stats.patternsMatched++;
    stats.instructionsRemoved += 2;     // LDX + JSR removed
    stats.instructionsAdded += 1;       // AND added
    stats.estimatedCyclesSaved += Math.max(0, originalCycles - newCycles);
    stats.estimatedBytesSaved += Math.max(0, originalBytes - newBytes);

    return { instructions };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Calculate log base 2 of a number if it is an exact power of 2.
   *
   * @param n - The number to check
   * @returns The exponent if n is a power of 2, null otherwise
   */
  protected log2(n: number): number | null {
    if (n <= 0) return null;
    if ((n & (n - 1)) !== 0) return null; // Not a power of 2

    let exp = 0;
    let val = n;
    while (val > 1) {
      val >>= 1;
      exp++;
    }
    return exp;
  }
}
