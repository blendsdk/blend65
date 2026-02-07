/**
 * Flag State Analyzer
 *
 * Tracks 6502 CPU flag state (Carry, Zero, Negative, Overflow) through
 * instruction sequences. Used by optimization passes to determine whether
 * flag-setting instructions are redundant or dead.
 *
 * The analyzer models how each 6502 instruction affects the processor status
 * register (P), enabling safe removal of redundant flag operations like:
 * - CMP #0 after LDA (which already sets Z/N)
 * - CLC before ADC when carry is already known to be clear
 * - SEC before SBC when carry is already known to be set
 *
 * Flag states use three-valued logic:
 * - `true`  → flag is definitely set (1)
 * - `false` → flag is definitely clear (0)
 * - `undefined` → flag state is unknown (could be either)
 *
 * @module codegen/asm-il/optimizer/analysis/flag-state
 */

import type { AsmInstruction } from '../../types.js';

// ============================================================================
// Flag State Types
// ============================================================================

/**
 * Represents the known state of the 6502 processor status flags.
 *
 * Each flag is modeled as three-valued: true (set), false (clear),
 * or undefined (unknown). This conservative approach ensures optimization
 * passes only remove instructions when flag effects are provably redundant.
 *
 * The Decimal (D) and Interrupt (I) flags are not tracked because:
 * - D flag is rarely used in game/demo code and changes behavior of ADC/SBC
 * - I flag is managed by the hardware interrupt system
 */
export interface FlagState {
  /** Carry flag: true=set, false=clear, undefined=unknown */
  carry?: boolean;

  /** Zero flag: true=set, false=clear, undefined=unknown */
  zero?: boolean;

  /** Negative flag: true=set, false=clear, undefined=unknown */
  negative?: boolean;

  /** Overflow flag: true=set, false=clear, undefined=unknown */
  overflow?: boolean;
}

// ============================================================================
// Constants — Mnemonic Sets
// ============================================================================

/**
 * Instructions that explicitly set or clear a single flag.
 * Handled individually in the analyze() switch.
 */
const FLAG_CLEAR_SET_MNEMONICS = new Set(['CLC', 'SEC', 'CLV']);

/**
 * Instructions that set Zero (Z) and Negative (N) flags
 * based on their result, but do NOT affect Carry (C) or Overflow (V).
 *
 * Per 6502 architecture:
 * - Load instructions (LDA/LDX/LDY) set Z/N from loaded value
 * - Logic instructions (AND/ORA/EOR) set Z/N from result
 * - Increment/Decrement (INC/INX/INY/DEC/DEX/DEY) set Z/N from result
 * - Transfer instructions (TAX/TAY/TXA/TYA/TSX) set Z/N from transferred value
 * - PLA sets Z/N from pulled value
 */
const SETS_ZN_ONLY = new Set([
  'LDA', 'LDX', 'LDY',
  'AND', 'ORA', 'EOR',
  'INC', 'INX', 'INY',
  'DEC', 'DEX', 'DEY',
  'TAX', 'TAY', 'TXA', 'TYA', 'TSX',
  'PLA',
]);

/**
 * Instructions that set Carry (C), Zero (Z), and Negative (N) flags.
 *
 * Per 6502 architecture:
 * - Arithmetic (ADC/SBC) sets C from carry-out, Z/N from result
 * - Compare (CMP/CPX/CPY) sets C from comparison, Z/N from result
 * - Shift/Rotate (ASL/LSR/ROL/ROR) sets C from shifted-out bit, Z/N from result
 *
 * Note: ADC/SBC also affect the Overflow (V) flag, which is handled separately.
 */
const SETS_CZN = new Set([
  'ADC', 'SBC',
  'CMP', 'CPX', 'CPY',
  'ASL', 'LSR', 'ROL', 'ROR',
]);

/**
 * Instructions that also set the Overflow (V) flag in addition to C/Z/N.
 * Only ADC and SBC affect V.
 */
const SETS_OVERFLOW_TOO = new Set(['ADC', 'SBC']);

/**
 * Instructions that read the Carry flag as input.
 * - ADC: adds carry into result
 * - SBC: subtracts inverse of carry
 * - ROL/ROR: rotates through carry
 * - BCC/BCS: branches based on carry
 */
const CARRY_READERS = new Set(['ADC', 'SBC', 'ROL', 'ROR', 'BCC', 'BCS']);

/**
 * Instructions that read the Zero flag as input.
 * - BEQ: branch if zero set
 * - BNE: branch if zero clear
 */
const ZERO_READERS = new Set(['BEQ', 'BNE']);

/**
 * Instructions that read the Negative flag as input.
 * - BMI: branch if negative set
 * - BPL: branch if negative clear
 */
const NEGATIVE_READERS = new Set(['BMI', 'BPL']);

/**
 * Instructions that read the Overflow flag as input.
 * - BVC: branch if overflow clear
 * - BVS: branch if overflow set
 */
const OVERFLOW_READERS = new Set(['BVC', 'BVS']);

// ============================================================================
// FlagStateAnalyzer
// ============================================================================

/**
 * Analyzes how 6502 instructions affect processor status flags.
 *
 * This analyzer tracks the known state of CPU flags (C, Z, N, V) through
 * instruction sequences. It uses conservative three-valued logic where
 * `undefined` means the flag state is unknown.
 *
 * **Usage by optimization passes:**
 * - **FlagPatternsPass**: Uses this to detect redundant CMP #0 after LDA
 *   (since LDA already sets Z/N), and dead CLC/SEC before non-carry instructions.
 * - **StoreLoadPass**: Uses flag queries to ensure removing a load won't
 *   lose required flag-setting side effects.
 *
 * @example
 * ```typescript
 * const analyzer = new FlagStateAnalyzer();
 * let state: FlagState = {};
 *
 * // CLC sets carry = false
 * state = analyzer.analyze({ mnemonic: 'CLC', mode: AsmAddressingMode.Implied }, state);
 * // state.carry === false
 *
 * // LDA #$00 sets Z=true, N=false, but carry unchanged
 * state = analyzer.analyze({ mnemonic: 'LDA', mode: AsmAddressingMode.Immediate, operand: 0 }, state);
 * // state.carry === false (preserved from CLC)
 * // state.zero === undefined (we track conservatively)
 * // state.negative === undefined
 * ```
 */
export class FlagStateAnalyzer {
  /**
   * Compute the flag state after executing an instruction.
   *
   * Takes the current flag state and an instruction, and returns the
   * new flag state reflecting the instruction's effects. The input state
   * is not mutated — a new object is always returned.
   *
   * @param instruction - The 6502 instruction to analyze
   * @param stateBefore - Flag state before the instruction executes
   * @returns Flag state after the instruction executes
   */
  analyze(instruction: AsmInstruction, stateBefore: FlagState): FlagState {
    // Clone to avoid mutating the caller's state
    const state: FlagState = { ...stateBefore };
    const { mnemonic } = instruction;

    // Explicit flag set/clear instructions
    if (FLAG_CLEAR_SET_MNEMONICS.has(mnemonic)) {
      switch (mnemonic) {
        case 'CLC':
          state.carry = false;
          break;
        case 'SEC':
          state.carry = true;
          break;
        case 'CLV':
          state.overflow = false;
          break;
      }
      return state;
    }

    // Instructions that set Z, N only (no C, no V)
    if (SETS_ZN_ONLY.has(mnemonic)) {
      state.zero = undefined;
      state.negative = undefined;
      return state;
    }

    // Instructions that set C, Z, N (and possibly V)
    if (SETS_CZN.has(mnemonic)) {
      state.carry = undefined;
      state.zero = undefined;
      state.negative = undefined;

      // ADC and SBC also affect overflow
      if (SETS_OVERFLOW_TOO.has(mnemonic)) {
        state.overflow = undefined;
      }
      return state;
    }

    // BIT instruction: sets Z, N, V (but NOT carry)
    if (mnemonic === 'BIT') {
      state.zero = undefined;
      state.negative = undefined;
      state.overflow = undefined;
      return state;
    }

    // PLP restores all flags from stack — everything becomes unknown
    if (mnemonic === 'PLP') {
      return {
        carry: undefined,
        zero: undefined,
        negative: undefined,
        overflow: undefined,
      };
    }

    // RTI restores flags from stack — same as PLP
    if (mnemonic === 'RTI') {
      return {
        carry: undefined,
        zero: undefined,
        negative: undefined,
        overflow: undefined,
      };
    }

    // All other instructions (STA, STX, STY, PHA, PHP, JMP, JSR, RTS,
    // NOP, BRK, branches, etc.) do not modify flags
    return state;
  }

  /**
   * Check if an instruction reads the Carry flag.
   *
   * @param instruction - The instruction to check
   * @returns true if the instruction uses the carry flag as input
   */
  isCarryRead(instruction: AsmInstruction): boolean {
    return CARRY_READERS.has(instruction.mnemonic);
  }

  /**
   * Check if an instruction reads the Zero flag.
   *
   * @param instruction - The instruction to check
   * @returns true if the instruction branches on the zero flag
   */
  isZeroRead(instruction: AsmInstruction): boolean {
    return ZERO_READERS.has(instruction.mnemonic);
  }

  /**
   * Check if an instruction reads the Negative flag.
   *
   * @param instruction - The instruction to check
   * @returns true if the instruction branches on the negative flag
   */
  isNegativeRead(instruction: AsmInstruction): boolean {
    return NEGATIVE_READERS.has(instruction.mnemonic);
  }

  /**
   * Check if an instruction reads the Overflow flag.
   *
   * @param instruction - The instruction to check
   * @returns true if the instruction branches on the overflow flag
   */
  isOverflowRead(instruction: AsmInstruction): boolean {
    return OVERFLOW_READERS.has(instruction.mnemonic);
  }

  /**
   * Check if an instruction reads ANY flag.
   *
   * Useful for determining if a flag-setting instruction's result is used.
   *
   * @param instruction - The instruction to check
   * @returns true if the instruction reads any processor flag
   */
  isAnyFlagRead(instruction: AsmInstruction): boolean {
    return (
      this.isCarryRead(instruction) ||
      this.isZeroRead(instruction) ||
      this.isNegativeRead(instruction) ||
      this.isOverflowRead(instruction)
    );
  }

  /**
   * Check if an instruction modifies ANY flag.
   *
   * @param instruction - The instruction to check
   * @returns true if the instruction changes any processor flag
   */
  isAnyFlagModified(instruction: AsmInstruction): boolean {
    const { mnemonic } = instruction;
    return (
      FLAG_CLEAR_SET_MNEMONICS.has(mnemonic) ||
      SETS_ZN_ONLY.has(mnemonic) ||
      SETS_CZN.has(mnemonic) ||
      mnemonic === 'BIT' ||
      mnemonic === 'PLP' ||
      mnemonic === 'RTI'
    );
  }

  /**
   * Create an initial flag state with all flags unknown.
   *
   * This is the correct starting state at the entry of any code block
   * because we cannot assume anything about flags on entry.
   *
   * @returns FlagState with all flags set to undefined
   */
  createInitialState(): FlagState {
    return {
      carry: undefined,
      zero: undefined,
      negative: undefined,
      overflow: undefined,
    };
  }
}
