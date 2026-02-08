/**
 * Flag Patterns Optimization Pass
 *
 * Removes redundant CPU flag operations that are common in compiler-generated
 * 6502 code. This is an O1-level pass (enabled at all optimization levels ≥ O1).
 *
 * **Patterns handled:**
 * 1. **Redundant CMP #0** — Remove CMP #0 after LDA/LDX/LDY (load already sets Z/N)
 * 2. **Dead CLC/SEC** — Remove carry set/clear when carry is not read before next modification
 * 3. **Duplicate flag ops** — Remove consecutive identical CLC/CLC or SEC/SEC
 * 4. **Opposite flag ops** — Remove CLC before SEC (or vice versa) when carry isn't read between
 *
 * **Performance impact:**
 * - CMP #0 removal: saves 2 cycles and 2 bytes per occurrence (very common)
 * - Dead CLC/SEC removal: saves 2 cycles and 1 byte per occurrence (common)
 * - Duplicate/opposite: saves 2 cycles and 1 byte per occurrence (rare)
 *
 * @module codegen/asm-il/optimizer/passes/flag-patterns
 */

import type { AsmInstruction } from '../../types.js';
import type {
  AsmOptimizationPass,
  AsmOptimizationPassResult,
  AsmPassTransformStats,
} from '../types.js';
import { createEmptyTransformStats, createUnchangedPassResult } from '../types.js';
import { AsmAddressingMode } from '../../types.js';
import type { AsmILProgram, AsmILSection, AsmILElement } from '../../types.js';
import { isInstructionElement } from '../../types.js';
import { FlagStateAnalyzer } from '../analysis/flag-state.js';

// ============================================================================
// Constants — Instruction Categories
// ============================================================================

/**
 * Instructions that modify the Zero (Z) flag.
 * Used to determine if a CMP #0 is redundant after a load instruction,
 * since loads already set Z/N from the loaded value.
 */
const MODIFIES_ZERO_FLAG = new Set([
  'LDA', 'LDX', 'LDY',
  'TAX', 'TAY', 'TXA', 'TYA', 'TSX',
  'AND', 'ORA', 'EOR',
  'ADC', 'SBC',
  'INC', 'INX', 'INY',
  'DEC', 'DEX', 'DEY',
  'ASL', 'LSR', 'ROL', 'ROR',
  'CMP', 'CPX', 'CPY',
  'BIT', 'PLA',
]);

/**
 * Instructions that modify the Carry (C) flag.
 * Used to detect when a CLC/SEC becomes dead because another instruction
 * overwrites carry before it's read.
 */
const MODIFIES_CARRY = new Set([
  'ADC', 'SBC',
  'ASL', 'LSR', 'ROL', 'ROR',
  'CMP', 'CPX', 'CPY',
  'CLC', 'SEC',
]);

/**
 * Load instructions that set Z/N from loaded value.
 * CMP #0 after any of these is redundant for equality testing.
 */
const LOAD_INSTRUCTIONS = new Set(['LDA', 'LDX', 'LDY']);

/**
 * Explicit carry set/clear instructions (the targets for dead-flag removal).
 */
const CARRY_FLAG_OPS = new Set(['CLC', 'SEC']);

/**
 * Control flow instructions that terminate linear analysis.
 * When we encounter one of these, we must stop looking ahead because
 * execution may continue from a different path.
 */
const CONTROL_FLOW = new Set([
  'JMP', 'JSR', 'RTS', 'RTI', 'BRK',
  'BCC', 'BCS', 'BEQ', 'BNE',
  'BMI', 'BPL', 'BVC', 'BVS',
]);

// ============================================================================
// FlagPatternsPass
// ============================================================================

/**
 * Removes redundant 6502 flag operations from ASM-IL programs.
 *
 * Operates on each section independently. Within a section, it performs
 * a single forward pass over instruction elements, checking each instruction
 * against the known patterns. Non-instruction elements (labels, directives,
 * comments, blanks, data) are preserved unchanged.
 *
 * **Important safety constraints:**
 * - Labels break linear analysis (could be branch targets)
 * - Control flow instructions stop lookahead
 * - CMP #0 is only removed when it follows a load (not ADC/SBC which
 *   produce a different result in the accumulator)
 *
 * @example
 * ```typescript
 * const pass = new FlagPatternsPass();
 * const result = pass.run(program);
 * if (result.changed) {
 *   console.log(`Removed ${result.stats.instructionsRemoved} instructions`);
 * }
 * ```
 */
export class FlagPatternsPass implements AsmOptimizationPass {
  /** @inheritdoc */
  readonly name = 'flag-patterns';

  /** @inheritdoc */
  readonly isTransform = true;

  /** Flag analyzer used for carry-read detection */
  protected readonly flagAnalyzer = new FlagStateAnalyzer();

  /**
   * Run the flag patterns pass on an ASM-IL program.
   *
   * Processes each section independently. Returns the same reference
   * if no changes were made (enables cheap convergence detection).
   *
   * @param program - The program to optimize
   * @returns Result with optimized program and statistics
   */
  run(program: AsmILProgram): AsmOptimizationPassResult {
    const stats = createEmptyTransformStats();
    let anyChanged = false;
    const newSections: AsmILSection[] = [];

    // Process each section independently — labels within a section
    // provide analysis boundaries, but sections are fully independent
    for (const section of program.sections) {
      const result = this.optimizeSection(section, stats);
      newSections.push(result.section);
      if (result.changed) {
        anyChanged = true;
      }
    }

    // Return same reference if nothing changed (immutable pattern)
    if (!anyChanged) {
      return createUnchangedPassResult(program);
    }

    return {
      program: {
        ...program,
        sections: newSections,
      },
      changed: true,
      stats,
    };
  }

  // ==========================================================================
  // Section Processing
  // ==========================================================================

  /**
   * Optimize a single section by scanning elements for flag patterns.
   *
   * Builds a new elements array by copying elements and skipping those
   * identified as redundant. Non-instruction elements are always preserved.
   *
   * @param section - The section to optimize
   * @param stats - Mutable stats object to accumulate into
   * @returns Object with the (possibly new) section and whether it changed
   */
  protected optimizeSection(
    section: AsmILSection,
    stats: AsmPassTransformStats
  ): { section: AsmILSection; changed: boolean } {
    const elements = section.elements;
    const newElements: AsmILElement[] = [];
    let changed = false;

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];

      // Non-instruction elements are always kept
      if (!isInstructionElement(element)) {
        newElements.push(element);
        continue;
      }

      const instr = element.instruction;

      // Pattern 1: Redundant CMP #0 after a load instruction
      if (this.isRedundantCmpZero(instr, elements, i)) {
        changed = true;
        stats.patternsMatched++;
        stats.instructionsRemoved++;
        // CMP #0 is 2 bytes (opcode + operand) and 2 cycles
        stats.estimatedBytesSaved += 2;
        stats.estimatedCyclesSaved += 2;
        continue; // Skip this element
      }

      // Pattern 2: Duplicate or opposite flag instruction (CLC/CLC, CLC/SEC)
      if (this.isDuplicateOrOppositeFlag(instr, elements, i)) {
        changed = true;
        stats.patternsMatched++;
        stats.instructionsRemoved++;
        // CLC/SEC are 1 byte each and 2 cycles
        stats.estimatedBytesSaved += 1;
        stats.estimatedCyclesSaved += 2;
        continue; // Skip this element
      }

      // Pattern 3: Dead CLC/SEC (carry not read before modification)
      if (this.isDeadCarryOp(instr, elements, i)) {
        changed = true;
        stats.patternsMatched++;
        stats.instructionsRemoved++;
        // CLC/SEC are 1 byte and 2 cycles
        stats.estimatedBytesSaved += 1;
        stats.estimatedCyclesSaved += 2;
        continue; // Skip this element
      }

      // No pattern matched — keep the element
      newElements.push(element);
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
  // Pattern 1: Redundant CMP #0
  // ==========================================================================

  /**
   * Check if a CMP #0 instruction is redundant.
   *
   * CMP #0 is redundant when it immediately follows a load instruction
   * (LDA, LDX, LDY) because load instructions already set the Z and N
   * flags from the loaded value. The CMP #0 would produce the same Z/N
   * result since subtracting 0 from the loaded value doesn't change it.
   *
   * **Safety:** Only removes CMP #0 (not CMP #n for n>0), and only when
   * a load instruction is the most recent Z-flag-setting instruction.
   * Labels break the analysis because they could be branch targets.
   *
   * @param instr - The current instruction to check
   * @param elements - All elements in the section
   * @param index - Index of the current element
   * @returns true if this CMP #0 is redundant and can be removed
   */
  protected isRedundantCmpZero(
    instr: AsmInstruction,
    elements: readonly AsmILElement[],
    index: number
  ): boolean {
    // Must be CMP #0 specifically (immediate mode with operand 0).
    // CMP $00 (zero-page mode) compares against memory at address 0,
    // which is semantically different from CMP #0.
    if (instr.mnemonic !== 'CMP') return false;
    if (instr.mode !== AsmAddressingMode.Immediate) return false;
    if (instr.operand !== 0) return false;

    // Scan backwards to find the previous Z-flag-affecting instruction.
    // If it's a load instruction, this CMP #0 is redundant.
    for (let i = index - 1; i >= 0; i--) {
      const prev = elements[i];

      // Labels break the analysis — could be a branch target where
      // flags have different state
      if (prev.kind === 'label') {
        return false;
      }

      // Skip non-instruction elements (comments, blanks, directives, data)
      if (!isInstructionElement(prev)) {
        continue;
      }

      const prevInstr = prev.instruction;

      // If previous instruction is a load, CMP #0 is redundant
      // because loads set Z/N from the loaded value
      if (LOAD_INSTRUCTIONS.has(prevInstr.mnemonic)) {
        return true;
      }

      // If previous instruction modifies Z flag but isn't a load,
      // CMP #0 might produce a different result (e.g., after ADC the
      // accumulator value is different from what CMP #0 would test)
      if (MODIFIES_ZERO_FLAG.has(prevInstr.mnemonic)) {
        return false;
      }

      // Instructions that don't modify Z (STA, STX, STY, PHA, NOP, etc.)
      // are transparent — continue scanning backwards
    }

    // Reached beginning of section without finding a Z-modifier
    return false;
  }

  // ==========================================================================
  // Pattern 2: Duplicate / Opposite Flag Operations
  // ==========================================================================

  /**
   * Check if this is a duplicate or opposite flag instruction.
   *
   * Detects two sub-patterns:
   * - **Duplicate:** CLC followed by CLC (or SEC/SEC) — first is dead
   * - **Opposite:** CLC followed by SEC (or SEC/CLC) — first is dead
   *
   * In both cases, the first instruction's effect is overwritten before
   * the carry flag is read by any instruction. Scans forward from the
   * current position looking for carry readers, control flow, or carry
   * modifiers.
   *
   * @param instr - The current instruction to check
   * @param elements - All elements in the section
   * @param index - Index of the current element
   * @returns true if this flag instruction is dead due to a later override
   */
  protected isDuplicateOrOppositeFlag(
    instr: AsmInstruction,
    elements: readonly AsmILElement[],
    index: number
  ): boolean {
    // Only applies to explicit carry flag instructions
    if (!CARRY_FLAG_OPS.has(instr.mnemonic)) {
      return false;
    }

    // Scan forward to see if carry is read before being overwritten
    for (let i = index + 1; i < elements.length; i++) {
      const next = elements[i];

      // Labels break the analysis — the label could be a branch target
      // where this carry state is needed
      if (next.kind === 'label') {
        return false;
      }

      // Skip non-instruction elements
      if (!isInstructionElement(next)) {
        continue;
      }

      const nextInstr = next.instruction;

      // Same instruction = duplicate (CLC/CLC or SEC/SEC) — first is dead
      if (nextInstr.mnemonic === instr.mnemonic) {
        return true;
      }

      // Opposite instruction = first is dead (CLC/SEC or SEC/CLC)
      if (
        (instr.mnemonic === 'CLC' && nextInstr.mnemonic === 'SEC') ||
        (instr.mnemonic === 'SEC' && nextInstr.mnemonic === 'CLC')
      ) {
        return true;
      }

      // If carry is read by this instruction, the first CLC/SEC is needed
      if (this.flagAnalyzer.isCarryRead(nextInstr)) {
        return false;
      }

      // Control flow breaks the analysis — be conservative and keep it
      if (CONTROL_FLOW.has(nextInstr.mnemonic)) {
        return false;
      }

      // If another instruction modifies carry (e.g., ASL, CMP), first is dead
      if (MODIFIES_CARRY.has(nextInstr.mnemonic)) {
        return true;
      }
    }

    // Reached end of section without carry use — first CLC/SEC is dead
    // (carry state is lost at section boundary)
    return true;
  }

  // ==========================================================================
  // Pattern 3: Dead CLC/SEC
  // ==========================================================================

  /**
   * Check if a CLC/SEC instruction is dead (carry not read before modification).
   *
   * A CLC or SEC is dead when the carry flag is overwritten by another
   * instruction before any instruction reads the carry. This covers cases
   * beyond Pattern 2 (duplicate/opposite), such as CLC followed by ASL
   * (which sets carry from the shifted-out bit).
   *
   * **Note:** This pattern overlaps with isDuplicateOrOppositeFlag but catches
   * additional cases where carry is overwritten by non-CLC/SEC instructions.
   * The check order in optimizeSection ensures Pattern 2 catches the simple
   * cases first, and this catches the remaining dead-carry scenarios.
   *
   * @param instr - The current instruction to check
   * @param elements - All elements in the section
   * @param index - Index of the current element
   * @returns true if this CLC/SEC is dead and can be removed
   */
  protected isDeadCarryOp(
    instr: AsmInstruction,
    elements: readonly AsmILElement[],
    index: number
  ): boolean {
    // Only applies to CLC and SEC
    if (!CARRY_FLAG_OPS.has(instr.mnemonic)) {
      return false;
    }

    // Scan forward for carry usage
    for (let i = index + 1; i < elements.length; i++) {
      const next = elements[i];

      // Labels break the analysis — could be branch target
      if (next.kind === 'label') {
        return false;
      }

      // Skip non-instruction elements
      if (!isInstructionElement(next)) {
        continue;
      }

      const nextInstr = next.instruction;

      // If carry is read, this CLC/SEC is alive (needed)
      if (this.flagAnalyzer.isCarryRead(nextInstr)) {
        return false;
      }

      // If carry is modified by another instruction, this CLC/SEC is dead
      if (MODIFIES_CARRY.has(nextInstr.mnemonic)) {
        return true;
      }

      // Control flow = stop analysis, be conservative (keep the instruction)
      if (CONTROL_FLOW.has(nextInstr.mnemonic)) {
        return false;
      }
    }

    // Reached end of section without carry use = dead
    // (carry state is meaningless at section end)
    return true;
  }
}
