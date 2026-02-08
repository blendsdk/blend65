/**
 * WDC 65C02 Instruction Set Implementation
 *
 * Implements the CpuInstructionSet for the WDC 65C02 CPU.
 * Used by platforms like the Commander X16, Apple IIe enhanced, etc.
 *
 * The 65C02 extends the MOS 6502 with 27 additional instructions.
 * This implementation leverages the new single-instruction opcodes
 * that replace multi-instruction sequences on the base 6502:
 *
 * - **STZ** (Store Zero) — replaces LDA #0 + STA
 * - **BRA** (Branch Always) — replaces JMP for short-range branches
 * - **INC A / DEC A** — replaces CLC+ADC #1 / SEC+SBC #1
 * - **PHX/PLX/PHY/PLY** — replaces TXA+PHA / PLA+TAX / TYA+PHA / PLA+TAY
 *
 * @module codegen/cpu/cpu-65c02
 */

import { AsmAddressingMode } from '../asm-il/types.js';
import type { AsmILBuilder } from '../asm-il/builder.js';
import { CpuInstructionSet } from './cpu-instruction-set.js';
import type { CpuTarget } from './types.js';

// ============================================================================
// Cpu65C02InstructionSet
// ============================================================================

/**
 * WDC 65C02 instruction set implementation.
 *
 * All operations use single dedicated 65C02 instructions, producing
 * shorter and faster code than the equivalent 6502 multi-instruction
 * sequences.
 *
 * **Key 65C02 advantages used here:**
 * - STZ: Store zero without loading A first (preserves A)
 * - BRA: Relative branch for short-range unconditional jumps (saves 1 byte)
 * - INC A / DEC A: Accumulator increment/decrement (saves 2 bytes each)
 * - PHX/PLX/PHY/PLY: Direct index register push/pull (preserves A)
 */
export class Cpu65C02InstructionSet extends CpuInstructionSet {
  /** Identifies this as the WDC 65C02 target */
  readonly target: CpuTarget = '65c02';

  // ==========================================================================
  // Memory Operations
  // ==========================================================================

  /**
   * Stores zero to memory using STZ (65C02 native instruction).
   *
   * Single instruction (2-3 bytes). Does NOT clobber the accumulator,
   * unlike the 6502 equivalent which requires loading zero into A.
   *
   * @param asm - The ASM-IL builder
   * @param address - Memory address to store zero at
   * @param isZp - Whether the address is in zero page ($00-$FF)
   * @param comment - Optional comment
   */
  public emitStoreZero(asm: AsmILBuilder, address: number, isZp: boolean, comment?: string): void {
    // 65C02 STZ: single instruction, preserves accumulator
    const mode = isZp ? AsmAddressingMode.ZeroPage : AsmAddressingMode.Absolute;
    asm.instruction('STZ', mode, address, undefined, comment);
  }

  // ==========================================================================
  // Branch Operations
  // ==========================================================================

  /**
   * Emits an unconditional branch using BRA (65C02 native instruction).
   *
   * Single instruction (2 bytes). Uses relative addressing (±127 bytes).
   * Saves 1 byte compared to the 6502's JMP (3 bytes absolute).
   *
   * Note: BRA has a limited range of ±127 bytes from the instruction.
   * The assembler (ACME) will report an error if the branch target is
   * out of range. In practice, most unconditional branches within a
   * function body fit within this range.
   *
   * @param asm - The ASM-IL builder
   * @param label - Target label to branch to
   * @param comment - Optional comment
   */
  public emitBranchAlways(asm: AsmILBuilder, label: string, comment?: string): void {
    // 65C02 BRA: relative branch, saves 1 byte over JMP
    asm.instruction('BRA', AsmAddressingMode.Relative, undefined, label, comment);
  }

  // ==========================================================================
  // Accumulator Arithmetic
  // ==========================================================================

  /**
   * Increments the accumulator using INC A (65C02 native instruction).
   *
   * Single instruction (1 byte). Does NOT modify the carry flag,
   * unlike the 6502 equivalent (CLC + ADC #1) which clobbers carry.
   *
   * On 65C02, INC with accumulator addressing mode performs A = A + 1.
   * This is sometimes written as INA in documentation.
   *
   * @param asm - The ASM-IL builder
   * @param comment - Optional comment
   */
  public emitIncrementA(asm: AsmILBuilder, comment?: string): void {
    // 65C02 INC A (also known as INA): single byte, preserves carry
    asm.instruction('INC', AsmAddressingMode.Accumulator, undefined, undefined, comment);
  }

  /**
   * Decrements the accumulator using DEC A (65C02 native instruction).
   *
   * Single instruction (1 byte). Does NOT modify the carry flag,
   * unlike the 6502 equivalent (SEC + SBC #1) which clobbers carry.
   *
   * On 65C02, DEC with accumulator addressing mode performs A = A - 1.
   * This is sometimes written as DEA in documentation.
   *
   * @param asm - The ASM-IL builder
   * @param comment - Optional comment
   */
  public emitDecrementA(asm: AsmILBuilder, comment?: string): void {
    // 65C02 DEC A (also known as DEA): single byte, preserves carry
    asm.instruction('DEC', AsmAddressingMode.Accumulator, undefined, undefined, comment);
  }

  // ==========================================================================
  // Stack Operations for Index Registers
  // ==========================================================================

  /**
   * Pushes X register using PHX (65C02 native instruction).
   *
   * Single instruction (1 byte). Does NOT clobber the accumulator,
   * unlike the 6502 equivalent (TXA + PHA) which destroys A.
   *
   * @param asm - The ASM-IL builder
   * @param comment - Optional comment
   */
  public emitPushX(asm: AsmILBuilder, comment?: string): void {
    // 65C02 PHX: direct push, preserves accumulator
    asm.instruction('PHX', AsmAddressingMode.Implied, undefined, undefined, comment);
  }

  /**
   * Pulls X register using PLX (65C02 native instruction).
   *
   * Single instruction (1 byte). Does NOT clobber the accumulator,
   * unlike the 6502 equivalent (PLA + TAX) which destroys A.
   *
   * @param asm - The ASM-IL builder
   * @param comment - Optional comment
   */
  public emitPullX(asm: AsmILBuilder, comment?: string): void {
    // 65C02 PLX: direct pull, preserves accumulator
    asm.instruction('PLX', AsmAddressingMode.Implied, undefined, undefined, comment);
  }

  /**
   * Pushes Y register using PHY (65C02 native instruction).
   *
   * Single instruction (1 byte). Does NOT clobber the accumulator,
   * unlike the 6502 equivalent (TYA + PHA) which destroys A.
   *
   * @param asm - The ASM-IL builder
   * @param comment - Optional comment
   */
  public emitPushY(asm: AsmILBuilder, comment?: string): void {
    // 65C02 PHY: direct push, preserves accumulator
    asm.instruction('PHY', AsmAddressingMode.Implied, undefined, undefined, comment);
  }

  /**
   * Pulls Y register using PLY (65C02 native instruction).
   *
   * Single instruction (1 byte). Does NOT clobber the accumulator,
   * unlike the 6502 equivalent (PLA + TAY) which destroys A.
   *
   * @param asm - The ASM-IL builder
   * @param comment - Optional comment
   */
  public emitPullY(asm: AsmILBuilder, comment?: string): void {
    // 65C02 PLY: direct pull, preserves accumulator
    asm.instruction('PLY', AsmAddressingMode.Implied, undefined, undefined, comment);
  }
}
