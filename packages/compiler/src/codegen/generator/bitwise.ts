/**
 * Bitwise Operations Generator
 *
 * Handles IL opcodes for bitwise operations:
 * - AND_BYTE, AND_IMM, OR_BYTE, OR_IMM, XOR_BYTE, XOR_IMM
 * - NOT_BYTE, SHL_BYTE, SHR_BYTE, SHR_WORD, SHR_WORD_LO
 *
 * @module codegen/generator/bitwise
 */

import { ILInstruction, ILOpcode } from '../../il/index.js';
import { ArithmeticOpsGenerator } from './arithmetic.js';

/**
 * Bitwise operations layer of the code generator.
 */
export class BitwiseOpsGenerator extends ArithmeticOpsGenerator {
  // ==========================================================================
  // AND_BYTE - Logical AND with slot
  // ==========================================================================

  protected genAndByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);
    this.asm.and(address, mode);
    this.invalidateA();
  }

  // ==========================================================================
  // AND_IMM - Logical AND with immediate
  // ==========================================================================

  protected genAndImm(instr: ILInstruction): void {
    this.emitComment(instr);
    const imm = this.getImmediateOperand(instr.operands);
    this.asm.and(imm.value, 'immediate');
    this.invalidateA();
  }

  // ==========================================================================
  // OR_BYTE - Logical OR with slot
  // ==========================================================================

  protected genOrByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);
    this.asm.ora(address, mode);
    this.invalidateA();
  }

  // ==========================================================================
  // OR_IMM - Logical OR with immediate
  // ==========================================================================

  protected genOrImm(instr: ILInstruction): void {
    this.emitComment(instr);
    const imm = this.getImmediateOperand(instr.operands);
    this.asm.ora(imm.value, 'immediate');
    this.invalidateA();
  }

  // ==========================================================================
  // XOR_BYTE - Exclusive OR with slot
  // ==========================================================================

  protected genXorByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);
    this.asm.eor(address, mode);
    this.invalidateA();
  }

  // ==========================================================================
  // XOR_IMM - Exclusive OR with immediate
  // ==========================================================================

  protected genXorImm(instr: ILInstruction): void {
    this.emitComment(instr);
    const imm = this.getImmediateOperand(instr.operands);
    this.asm.eor(imm.value, 'immediate');
    this.invalidateA();
  }

  // ==========================================================================
  // NOT_BYTE - Bitwise NOT (complement)
  // ==========================================================================

  /**
   * Generates code for NOT_BYTE.
   *
   * IL: NOT_BYTE
   * 6502: EOR #$FF
   */
  protected genNotByte(instr: ILInstruction): void {
    this.emitComment(instr);
    this.asm.eor(0xff, 'immediate');
    this.invalidateA();
  }

  // ==========================================================================
  // SHL_BYTE - Arithmetic shift left
  // ==========================================================================

  /**
   * Generates code for SHL_BYTE.
   *
   * IL: SHL_BYTE count
   * 6502: ASL (repeated count times)
   */
  protected genShlByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const imm = this.getImmediateOperand(instr.operands);
    const count = imm.value;

    for (let i = 0; i < count; i++) {
      this.asm.asl(undefined, 'accumulator');
    }
    this.invalidateA();
  }

  // ==========================================================================
  // SHR_BYTE - Logical shift right
  // ==========================================================================

  /**
   * Generates code for SHR_BYTE.
   *
   * IL: SHR_BYTE count
   * 6502: LSR (repeated count times)
   */
  protected genShrByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const imm = this.getImmediateOperand(instr.operands);
    const count = imm.value;

    for (let i = 0; i < count; i++) {
      this.asm.lsr(undefined, 'accumulator');
    }
    this.invalidateA();
  }

  // ==========================================================================
  // SHR_WORD - Logical shift right for A:X word (16-bit)
  // ==========================================================================

  /**
   * Generates code for SHR_WORD (16-bit logical shift right of A:X).
   *
   * Used for word division by power-of-2 constants (e.g., spriteAddr / 64).
   *
   * Uses different strategies depending on shift count to minimize code size
   * and cycle count:
   *
   * **Shift ≥ 8**: All low-byte bits are shifted out entirely. The result low
   * byte comes from the high byte shifted right by (count - 8). The result
   * high byte is always 0.
   *   - `word >> 8`  → TXA / LDX #$00 (just move high to low)
   *   - `word >> 10` → TXA / LSR / LSR / LDX #$00
   *
   * **Shift 1-7**: Uses the standard 6502 16-bit shift pattern that propagates
   * bits from high byte into low byte through carry:
   *   PHA / TXA / LSR / TAX / PLA / ROR  (per shift position)
   *
   * **Shift 0**: No-op (identity), no instructions emitted.
   *
   * IL: SHR_WORD count
   */
  protected genShrWord(instr: ILInstruction): void {
    this.emitComment(instr);
    const imm = this.getImmediateOperand(instr.operands);
    const count = imm.value;

    // No-op for shift by 0
    if (count === 0) {
      return;
    }

    if (count >= 8) {
      // Shift ≥ 8: all low-byte bits are discarded. The high byte (X)
      // becomes the new low byte, then we just LSR the remaining positions.
      // This replaces N×6 instructions with 2 + (N-8) instructions.
      this.asm.txa('high byte → A (shift ≥ 8: low byte fully shifted out)');

      // Shift the remaining (count - 8) positions on the byte now in A
      const remaining = count - 8;
      for (let i = 0; i < remaining; i++) {
        this.asm.lsr(undefined, 'accumulator');
      }

      // High byte of result is always 0 after shifting ≥ 8
      this.asm.ldx(0, 'immediate', 'high byte = 0 after shift ≥ 8');
    } else {
      // Shift 1-7: standard 16-bit shift pattern.
      // Each iteration shifts the high byte right (LSR), then rotates the
      // carry bit into the top of the low byte (ROR), propagating bits
      // from high to low across the 16-bit value.
      for (let i = 0; i < count; i++) {
        this.asm.pha('save low byte');
        this.asm.txa('high byte → A');
        this.asm.lsr(undefined, 'accumulator');
        this.asm.tax('shifted high → X');
        this.asm.pla('restore low byte');
        this.asm.ror(undefined, 'accumulator');
      }
    }
    this.invalidateA();
  }

  // ==========================================================================
  // SHR_WORD_LO - Optimized lo(word >> N) using shift-left technique
  // ==========================================================================

  /**
   * Compiler scratch ZP address for temporary storage.
   *
   * Uses $FB — the first byte of the 4-byte compiler scratch region ($FB-$FE)
   * reserved by the platform config. This is separate from the runtime math
   * routines which use $FE/$FF, so there's no conflict.
   */
  protected static readonly CODEGEN_SCRATCH_ZP = 0xfb;

  /**
   * Generates code for SHR_WORD_LO — optimized `lo(word >> N)` for N=3-7.
   *
   * Exploits the identity `lo(word >> N) = hi(word << (8-N))` to avoid the
   * expensive full 16-bit SHR_WORD loop. Instead of shifting right N times
   * (6 instructions each = 6N total), we shift left (8-N) times using a
   * temporary ZP location for the low byte.
   *
   * **Algorithm:**
   * 1. Store original low byte (A) to scratch ZP
   * 2. Move high byte (X) into A via TXA
   * 3. Repeat (8-N) times: ASL scratch / ROL A
   *    - ASL shifts the scratch byte left, pushing MSB into carry
   *    - ROL rotates carry into A from the right
   * 4. After (8-N) rounds, A = hi(word << (8-N)) = lo(word >> N)
   *
   * **Cost comparison for N=6 (sprite pointer /64):**
   * - SHR_WORD(6) + LO: 36 instructions, ~36 bytes
   * - SHR_WORD_LO(6):    6 instructions, ~9 bytes (75% reduction)
   *
   * IL: SHR_WORD_LO count (where count is 3-7)
   * 6502: STA $FB / TXA / [ASL $FB / ROL A] × (8-N)
   *
   * @param instr - IL instruction with immediate operand (shift count N)
   */
  protected genShrWordLo(instr: ILInstruction): void {
    this.emitComment(instr);
    const imm = this.getImmediateOperand(instr.operands);
    const count = imm.value;
    const rounds = 8 - count;
    const scratchAddr = BitwiseOpsGenerator.CODEGEN_SCRATCH_ZP;

    // Step 1: Save original low byte to scratch ZP
    this.asm.sta(scratchAddr, 'zeroPage', 'save low byte to scratch');

    // Step 2: Move high byte into A
    this.asm.txa('high byte → A for shift-left technique');

    // Step 3: Shift left (8-N) times, propagating bits from low→high
    // Each round: ASL scratch pushes MSB of low byte into carry,
    // then ROL A rotates that carry bit into A from the right.
    for (let i = 0; i < rounds; i++) {
      this.asm.asl(scratchAddr, 'zeroPage');
      this.asm.rol(undefined, 'accumulator');
    }

    // A now contains lo(word >> N) — no further LO needed
    this.invalidateA();
  }

  // ==========================================================================
  // Dispatch Override
  // ==========================================================================

  protected override generateInstruction(instr: ILInstruction): void {
    switch (instr.opcode) {
      case ILOpcode.AND_BYTE:
        this.genAndByte(instr);
        break;
      case ILOpcode.AND_IMM:
        this.genAndImm(instr);
        break;
      case ILOpcode.OR_BYTE:
        this.genOrByte(instr);
        break;
      case ILOpcode.OR_IMM:
        this.genOrImm(instr);
        break;
      case ILOpcode.XOR_BYTE:
        this.genXorByte(instr);
        break;
      case ILOpcode.XOR_IMM:
        this.genXorImm(instr);
        break;
      case ILOpcode.NOT_BYTE:
        this.genNotByte(instr);
        break;
      case ILOpcode.SHL_BYTE:
        this.genShlByte(instr);
        break;
      case ILOpcode.SHR_BYTE:
        this.genShrByte(instr);
        break;
      case ILOpcode.SHR_WORD:
        this.genShrWord(instr);
        break;
      case ILOpcode.SHR_WORD_LO:
        this.genShrWordLo(instr);
        break;
      default:
        super.generateInstruction(instr);
    }
  }
}