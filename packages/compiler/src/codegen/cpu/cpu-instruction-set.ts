/**
 * CPU Instruction Set Abstract Class
 *
 * Defines the interface for CPU-specific instruction emission.
 * Each CPU variant (6502, 65C02) provides its own implementation
 * using the Strategy Pattern.
 *
 * The abstract methods represent operations where the 6502 and 65C02
 * differ in their instruction set. The 6502 requires multi-instruction
 * sequences where the 65C02 has dedicated single instructions.
 *
 * @module codegen/cpu/cpu-instruction-set
 */

import type { AsmILBuilder } from '../asm-il/builder.js';
import type { CpuTarget } from './types.js';

// ============================================================================
// CpuInstructionSet Abstract Class
// ============================================================================

/**
 * Abstract base class for CPU-specific instruction emission.
 *
 * Encapsulates the instruction-level differences between CPU variants.
 * Code generator layers call these methods instead of directly emitting
 * multi-instruction sequences, allowing the correct instruction pattern
 * to be selected based on the target CPU.
 *
 * **6502 vs 65C02 instruction savings:**
 *
 * | Operation        | 6502 (multi-instruction) | 65C02 (single)  | Savings  |
 * |------------------|--------------------------|------------------|----------|
 * | Store zero       | LDA #0 + STA addr (4-5B) | STZ addr (2-3B)  | 2 bytes  |
 * | Branch always    | JMP addr (3B)            | BRA rel (2B)      | 1 byte   |
 * | Increment A      | CLC + ADC #1 (3B)        | INC A (1B)        | 2 bytes  |
 * | Decrement A      | SEC + SBC #1 (3B)        | DEC A (1B)        | 2 bytes  |
 * | Push X           | TXA + PHA (2B)           | PHX (1B)          | 1 byte   |
 * | Pull X           | PLA + TAX (2B)           | PLX (1B)          | 1 byte   |
 * | Push Y           | TYA + PHA (2B)           | PHY (1B)          | 1 byte   |
 * | Pull Y           | PLA + TAY (2B)           | PLY (1B)          | 1 byte   |
 *
 * @example
 * ```typescript
 * // In codegen layer:
 * this.cpu.emitStoreZero(this.asm, address, isZp, 'clear counter');
 * // On 6502: emits LDA #0 + STA addr
 * // On 65C02: emits STZ addr
 * ```
 */
export abstract class CpuInstructionSet {
  /**
   * The CPU target this instruction set implements.
   */
  abstract readonly target: CpuTarget;

  // ==========================================================================
  // Memory Operations
  // ==========================================================================

  /**
   * Emits a "store zero to memory" operation.
   *
   * - **6502:** LDA #0 + STA addr (4-5 bytes, clobbers A)
   * - **65C02:** STZ addr (2-3 bytes, preserves A)
   *
   * @param asm - The ASM-IL builder to emit into
   * @param address - The memory address to store zero at
   * @param isZp - Whether the address is in the zero page
   * @param comment - Optional comment for the first instruction
   */
  abstract emitStoreZero(asm: AsmILBuilder, address: number, isZp: boolean, comment?: string): void;

  // ==========================================================================
  // Branch Operations
  // ==========================================================================

  /**
   * Emits an unconditional branch/jump.
   *
   * - **6502:** JMP addr (3 bytes absolute)
   * - **65C02:** BRA rel (2 bytes relative, ±127 range)
   *
   * Note: BRA has a limited range of ±127 bytes. The assembler (ACME)
   * will report an error if the branch target is out of range. For very
   * long jumps, JMP may still be needed even on 65C02 — but in practice,
   * most unconditional branches within a function fit within range.
   *
   * @param asm - The ASM-IL builder to emit into
   * @param label - The target label to branch to
   * @param comment - Optional comment
   */
  abstract emitBranchAlways(asm: AsmILBuilder, label: string, comment?: string): void;

  // ==========================================================================
  // Accumulator Arithmetic
  // ==========================================================================

  /**
   * Emits an "increment accumulator" operation.
   *
   * - **6502:** CLC + ADC #1 (3 bytes, modifies carry flag)
   * - **65C02:** INC A (1 byte, preserves carry flag)
   *
   * @param asm - The ASM-IL builder to emit into
   * @param comment - Optional comment
   */
  abstract emitIncrementA(asm: AsmILBuilder, comment?: string): void;

  /**
   * Emits a "decrement accumulator" operation.
   *
   * - **6502:** SEC + SBC #1 (3 bytes, modifies carry flag)
   * - **65C02:** DEC A (1 byte, preserves carry flag)
   *
   * @param asm - The ASM-IL builder to emit into
   * @param comment - Optional comment
   */
  abstract emitDecrementA(asm: AsmILBuilder, comment?: string): void;

  // ==========================================================================
  // Stack Operations for Index Registers
  // ==========================================================================

  /**
   * Emits a "push X register to stack" operation.
   *
   * - **6502:** TXA + PHA (2 bytes, clobbers A)
   * - **65C02:** PHX (1 byte, preserves A)
   *
   * @param asm - The ASM-IL builder to emit into
   * @param comment - Optional comment
   */
  abstract emitPushX(asm: AsmILBuilder, comment?: string): void;

  /**
   * Emits a "pull X register from stack" operation.
   *
   * - **6502:** PLA + TAX (2 bytes, clobbers A)
   * - **65C02:** PLX (1 byte, preserves A)
   *
   * @param asm - The ASM-IL builder to emit into
   * @param comment - Optional comment
   */
  abstract emitPullX(asm: AsmILBuilder, comment?: string): void;

  /**
   * Emits a "push Y register to stack" operation.
   *
   * - **6502:** TYA + PHA (2 bytes, clobbers A)
   * - **65C02:** PHY (1 byte, preserves A)
   *
   * @param asm - The ASM-IL builder to emit into
   * @param comment - Optional comment
   */
  abstract emitPushY(asm: AsmILBuilder, comment?: string): void;

  /**
   * Emits a "pull Y register from stack" operation.
   *
   * - **6502:** PLA + TAY (2 bytes, clobbers A)
   * - **65C02:** PLY (1 byte, preserves A)
   *
   * @param asm - The ASM-IL builder to emit into
   * @param comment - Optional comment
   */
  abstract emitPullY(asm: AsmILBuilder, comment?: string): void;
}
