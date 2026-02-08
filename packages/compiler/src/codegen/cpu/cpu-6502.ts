/**
 * MOS 6502 Instruction Set Implementation
 *
 * Implements the CpuInstructionSet for the standard MOS 6502 CPU.
 * Used by platforms like the Commodore 64, Atari, NES, etc.
 *
 * The 6502 lacks several convenience instructions that the 65C02 provides,
 * so operations like "store zero" require multi-instruction sequences
 * (e.g., LDA #0 + STA addr instead of a single STZ addr).
 *
 * @module codegen/cpu/cpu-6502
 */

import type { AsmILBuilder } from '../asm-il/builder.js';
import { CpuInstructionSet } from './cpu-instruction-set.js';
import type { CpuTarget } from './types.js';

// ============================================================================
// Cpu6502InstructionSet
// ============================================================================

/**
 * MOS 6502 instruction set implementation.
 *
 * All operations use multi-instruction sequences to emulate
 * capabilities that the 65C02 provides as single instructions.
 *
 * **Key limitations of the 6502:**
 * - No STZ (store zero) — must load zero into A first
 * - No BRA (branch always) — must use JMP (absolute, not relative)
 * - No INC A / DEC A — must use CLC+ADC #1 or SEC+SBC #1
 * - No PHX/PLX/PHY/PLY — must transfer through A (clobbers A)
 */
export class Cpu6502InstructionSet extends CpuInstructionSet {
  /** Identifies this as the MOS 6502 target */
  readonly target: CpuTarget = '6502';

  // ==========================================================================
  // Memory Operations
  // ==========================================================================

  /**
   * Stores zero to memory using LDA #0 + STA addr.
   *
   * Requires 2 instructions (4-5 bytes). Clobbers the accumulator.
   *
   * @param asm - The ASM-IL builder
   * @param address - Memory address to store zero at
   * @param isZp - Whether the address is in zero page ($00-$FF)
   * @param comment - Optional comment for the LDA instruction
   */
  public emitStoreZero(asm: AsmILBuilder, address: number, isZp: boolean, comment?: string): void {
    // 6502 has no STZ instruction, so we must load zero first
    asm.lda(0, 'immediate', comment);
    const mode = isZp ? 'zeroPage' as const : 'absolute' as const;
    asm.sta(address, mode);
  }

  // ==========================================================================
  // Branch Operations
  // ==========================================================================

  /**
   * Emits an unconditional jump using JMP (absolute).
   *
   * The 6502 has no relative BRA instruction, so we must use the
   * 3-byte absolute JMP. This works for any distance but is 1 byte
   * larger than the 65C02's BRA.
   *
   * @param asm - The ASM-IL builder
   * @param label - Target label to jump to
   * @param comment - Optional comment
   */
  public emitBranchAlways(asm: AsmILBuilder, label: string, comment?: string): void {
    // 6502 has no BRA, use absolute JMP instead
    asm.jmp(label, false, comment);
  }

  // ==========================================================================
  // Accumulator Arithmetic
  // ==========================================================================

  /**
   * Increments the accumulator using CLC + ADC #1.
   *
   * Requires 2 instructions (3 bytes). Modifies the carry flag.
   * The CLC is necessary to prevent carry from a previous operation
   * from affecting the addition.
   *
   * @param asm - The ASM-IL builder
   * @param comment - Optional comment for the ADC instruction
   */
  public emitIncrementA(asm: AsmILBuilder, comment?: string): void {
    // 6502 has no INC A, use CLC + ADC #1
    asm.clc();
    asm.adc(1, 'immediate', comment);
  }

  /**
   * Decrements the accumulator using SEC + SBC #1.
   *
   * Requires 2 instructions (3 bytes). Modifies the carry flag.
   * The SEC is necessary because SBC subtracts the complement of carry.
   *
   * @param asm - The ASM-IL builder
   * @param comment - Optional comment for the SBC instruction
   */
  public emitDecrementA(asm: AsmILBuilder, comment?: string): void {
    // 6502 has no DEC A, use SEC + SBC #1
    asm.sec();
    asm.sbc(1, 'immediate', comment);
  }

  // ==========================================================================
  // Stack Operations for Index Registers
  // ==========================================================================

  /**
   * Pushes X register via TXA + PHA.
   *
   * The 6502 can only push/pull A, so we must transfer X to A first.
   * This clobbers the accumulator value.
   *
   * @param asm - The ASM-IL builder
   * @param comment - Optional comment for the TXA instruction
   */
  public emitPushX(asm: AsmILBuilder, comment?: string): void {
    // 6502 has no PHX, transfer through A
    asm.txa(comment);
    asm.pha();
  }

  /**
   * Pulls X register via PLA + TAX.
   *
   * The 6502 can only push/pull A, so we must pull into A then transfer.
   * This clobbers the accumulator value.
   *
   * @param asm - The ASM-IL builder
   * @param comment - Optional comment for the TAX instruction
   */
  public emitPullX(asm: AsmILBuilder, comment?: string): void {
    // 6502 has no PLX, transfer through A
    asm.pla();
    asm.tax(comment);
  }

  /**
   * Pushes Y register via TYA + PHA.
   *
   * The 6502 can only push/pull A, so we must transfer Y to A first.
   * This clobbers the accumulator value.
   *
   * @param asm - The ASM-IL builder
   * @param comment - Optional comment for the TYA instruction
   */
  public emitPushY(asm: AsmILBuilder, comment?: string): void {
    // 6502 has no PHY, transfer through A
    asm.tya(comment);
    asm.pha();
  }

  /**
   * Pulls Y register via PLA + TAY.
   *
   * The 6502 can only push/pull A, so we must pull into A then transfer.
   * This clobbers the accumulator value.
   *
   * @param asm - The ASM-IL builder
   * @param comment - Optional comment for the TAY instruction
   */
  public emitPullY(asm: AsmILBuilder, comment?: string): void {
    // 6502 has no PLY, transfer through A
    asm.pla();
    asm.tay(comment);
  }
}
