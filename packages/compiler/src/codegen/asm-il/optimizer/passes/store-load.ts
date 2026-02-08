/**
 * Store-Load Elimination Pass
 *
 * Removes redundant load instructions when the value is already in a register.
 * This is one of the most impactful optimizations for compiler-generated code.
 *
 * **Patterns handled:**
 * 1. **STA/LDA same address** — Remove LDA after STA to same address (A still has value)
 * 2. **STX/LDX same address** — Remove LDX after STX to same address (X still has value)
 * 3. **STY/LDY same address** — Remove LDY after STY to same address (Y still has value)
 * 4. **Store-Other-Load** — Remove load even with non-aliasing instructions between
 *
 * **Safety constraints:**
 * - Only removes loads when the register hasn't been modified since the store
 * - Only removes loads when the memory address hasn't been written by another instruction
 * - Labels break analysis (could be branch targets with different register state)
 * - Control flow instructions stop backward scanning
 * - Cross-register store-load is NOT eliminated (STA $50; LDX $50 is kept)
 * - Immediate mode loads are never removed (they don't read memory)
 * - Indexed and indirect modes require exact mode+operand match
 *
 * **Performance impact:**
 * - STA/LDA ZP removal: saves 3 cycles and 2 bytes per occurrence (very common)
 * - STA/LDA Abs removal: saves 4 cycles and 3 bytes per occurrence (very common)
 * - STX/LDX, STY/LDY: saves 3-4 cycles and 2-3 bytes per occurrence (common)
 *
 * @module codegen/asm-il/optimizer/passes/store-load
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
import { AddressAnalyzer } from '../analysis/address-analyzer.js';

// ============================================================================
// Constants — Instruction Categories
// ============================================================================

/**
 * Load instructions that read a value from memory into a register.
 * These are the candidates for elimination when redundant.
 */
const LOAD_MNEMONICS = new Set(['LDA', 'LDX', 'LDY']);

/**
 * Mapping from load mnemonic to the register letter it targets.
 * Used to determine which register's modification breaks the pattern.
 */
const LOAD_TO_REGISTER: Record<string, string> = {
  LDA: 'A',
  LDX: 'X',
  LDY: 'Y',
};

/**
 * Instructions that modify the accumulator (A register).
 * If any of these appear between a STA and LDA, the load is NOT redundant.
 */
const MODIFIES_A = new Set([
  'LDA', 'TXA', 'TYA', 'PLA',
  'ADC', 'SBC', 'AND', 'ORA', 'EOR',
  'ASL', 'LSR', 'ROL', 'ROR',
]);

/**
 * Instructions that modify the X register.
 * If any of these appear between a STX and LDX, the load is NOT redundant.
 */
const MODIFIES_X = new Set(['LDX', 'TAX', 'TSX', 'INX', 'DEX']);

/**
 * Instructions that modify the Y register.
 * If any of these appear between a STY and LDY, the load is NOT redundant.
 */
const MODIFIES_Y = new Set(['LDY', 'TAY', 'INY', 'DEY']);

/**
 * Instructions that write to memory (could alias with the stored address).
 */
const MEMORY_WRITE_OPS = new Set([
  'STA', 'STX', 'STY',
  'INC', 'DEC',
  'ASL', 'LSR', 'ROL', 'ROR',
]);

/**
 * Control flow instructions that terminate backward scanning.
 * Cannot look past these because execution might come from elsewhere.
 */
const CONTROL_FLOW = new Set([
  'JMP', 'JSR', 'RTS', 'RTI', 'BRK',
  'BCC', 'BCS', 'BEQ', 'BNE',
  'BMI', 'BPL', 'BVC', 'BVS',
]);

// ============================================================================
// StoreLoadPass
// ============================================================================

/**
 * Eliminates redundant loads after stores to the same address.
 *
 * Operates on each section independently. For each load instruction,
 * scans backward to find a matching store to the same address by the
 * same register. If found with no intervening register modification,
 * memory aliasing, or control flow, the load is removed.
 *
 * **Important:** Only accumulator-mode ASL/LSR/ROL/ROR modify A.
 * Memory-mode shifts write to memory but don't change A. The
 * `modifiesRegister` check handles this distinction.
 *
 * @example
 * ```typescript
 * const pass = new StoreLoadPass();
 * const result = pass.run(program);
 * if (result.changed) {
 *   console.log(`Removed ${result.stats.instructionsRemoved} redundant loads`);
 * }
 * ```
 */
export class StoreLoadPass implements AsmOptimizationPass {
  /** @inheritdoc */
  readonly name = 'store-load';

  /** @inheritdoc */
  readonly isTransform = true;

  /** Address analyzer for alias detection */
  protected readonly addressAnalyzer = new AddressAnalyzer();

  /**
   * Run the store-load elimination pass on an ASM-IL program.
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
   * Optimize a single section by removing redundant loads.
   *
   * Iterates over all elements. For each load instruction, checks
   * if there's a matching store that makes it redundant. If so,
   * the load is removed and stats are updated.
   *
   * @param section - The section to optimize
   * @param stats - Mutable stats to accumulate into
   * @returns Object with the section and whether it changed
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

      // Check if this load is redundant (matching store found)
      if (this.isRedundantLoad(instr, elements, i)) {
        changed = true;
        stats.patternsMatched++;
        stats.instructionsRemoved++;
        // Byte savings depend on addressing mode:
        // ZP load = 2 bytes, 3 cycles; Absolute load = 3 bytes, 4 cycles
        const isZeroPage = this.isZeroPageMode(instr.mode);
        stats.estimatedBytesSaved += isZeroPage ? 2 : 3;
        stats.estimatedCyclesSaved += isZeroPage ? 3 : 4;
        continue; // Skip this element (remove the load)
      }

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
  // Redundant Load Detection
  // ==========================================================================

  /**
   * Check if a load instruction is redundant because a matching store
   * already put the value in the register.
   *
   * Scans backward from the load looking for a matching store (same
   * register, same address, same addressing mode). The load is redundant
   * only if no intervening instruction modifies the register or the
   * memory address.
   *
   * @param instr - The current instruction to check
   * @param elements - All elements in the section
   * @param index - Index of the current element
   * @returns true if this load is redundant and can be removed
   */
  protected isRedundantLoad(
    instr: AsmInstruction,
    elements: readonly AsmILElement[],
    index: number
  ): boolean {
    // Must be a load instruction
    if (!LOAD_MNEMONICS.has(instr.mnemonic)) {
      return false;
    }

    // Must NOT be immediate mode (immediate loads don't read memory —
    // the operand IS the value, not an address)
    if (instr.mode === AsmAddressingMode.Immediate) {
      return false;
    }

    // Determine which register this load targets and what store to match
    const register = LOAD_TO_REGISTER[instr.mnemonic];
    const storeMnemonic = 'ST' + register; // STA, STX, or STY

    // Scan backward to find a matching store
    for (let i = index - 1; i >= 0; i--) {
      const prev = elements[i];

      // Labels break backward analysis — could be a branch target
      // where register/memory state is unknown
      if (prev.kind === 'label') {
        return false;
      }

      // Skip non-instruction elements (comments, blanks, directives, data)
      if (!isInstructionElement(prev)) {
        continue;
      }

      const prevInstr = prev.instruction;

      // Found matching store to same address with same mode?
      if (
        prevInstr.mnemonic === storeMnemonic &&
        this.sameOperand(prevInstr, instr)
      ) {
        return true; // Redundant — register still has the stored value!
      }

      // Does this instruction modify the target register?
      if (this.modifiesRegister(prevInstr, register)) {
        return false; // Register changed — load is needed to restore
      }

      // Does this instruction potentially modify the memory address?
      if (this.couldModifyAddress(prevInstr, instr)) {
        return false; // Memory might have changed — load is needed
      }

      // Control flow breaks backward analysis
      if (CONTROL_FLOW.has(prevInstr.mnemonic)) {
        return false;
      }
    }

    // Reached start of section without finding a matching store
    return false;
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Check if two instructions reference the same operand.
   *
   * Both addressing mode and operand value must match for safety.
   * This prevents false matches like STA $50 / LDA $50,X where
   * the effective addresses could differ.
   *
   * @param store - The store instruction
   * @param load - The load instruction
   * @returns true if they reference the exact same operand
   */
  protected sameOperand(store: AsmInstruction, load: AsmInstruction): boolean {
    // Addressing mode must match exactly
    if (store.mode !== load.mode) {
      return false;
    }

    // Label operands must match (if present)
    if (store.labelOperand !== undefined || load.labelOperand !== undefined) {
      return store.labelOperand === load.labelOperand;
    }

    // Numeric operands must match
    return store.operand === load.operand;
  }

  /**
   * Check if an instruction modifies a specific register.
   *
   * For shift instructions (ASL, LSR, ROL, ROR), only accumulator mode
   * modifies the A register. Memory-mode shifts write to memory, not A.
   *
   * @param instr - The instruction to check
   * @param register - The register letter ('A', 'X', or 'Y')
   * @returns true if the instruction could modify the register
   */
  protected modifiesRegister(instr: AsmInstruction, register: string): boolean {
    switch (register) {
      case 'A': {
        // Shift instructions only modify A when in accumulator mode
        const shiftOps = new Set(['ASL', 'LSR', 'ROL', 'ROR']);
        if (shiftOps.has(instr.mnemonic)) {
          return instr.mode === AsmAddressingMode.Accumulator;
        }
        return MODIFIES_A.has(instr.mnemonic);
      }

      case 'X':
        return MODIFIES_X.has(instr.mnemonic);

      case 'Y':
        return MODIFIES_Y.has(instr.mnemonic);

      default:
        return false;
    }
  }

  /**
   * Check if an instruction could modify the memory address that
   * the load reads from.
   *
   * Uses the AddressAnalyzer for conservative alias detection.
   *
   * @param instr - The potentially aliasing instruction
   * @param load - The load instruction whose address to check
   * @returns true if the instruction could write to the load's address
   */
  protected couldModifyAddress(
    instr: AsmInstruction,
    load: AsmInstruction
  ): boolean {
    // Only memory-writing instructions can modify addresses
    if (!MEMORY_WRITE_OPS.has(instr.mnemonic)) {
      return false;
    }

    // Get the load's target address
    const loadAddr = this.addressAnalyzer.getInstructionAddress(load);
    if (loadAddr === undefined) {
      return false;
    }

    // Use address analyzer for alias detection
    return this.addressAnalyzer.couldModify(instr, loadAddr);
  }

  /**
   * Check if an addressing mode targets zero page.
   * Used for cycle/byte savings estimation.
   *
   * @param mode - The addressing mode to check
   * @returns true if this is a zero-page addressing mode
   */
  protected isZeroPageMode(mode: AsmAddressingMode): boolean {
    return (
      mode === AsmAddressingMode.ZeroPage ||
      mode === AsmAddressingMode.ZeroPageX ||
      mode === AsmAddressingMode.ZeroPageY
    );
  }
}
