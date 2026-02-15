/**
 * Bitwise Operations Generator
 *
 * Handles IL opcodes for bitwise operations:
 * - AND_BYTE, AND_IMM, OR_BYTE, OR_IMM, XOR_BYTE, XOR_IMM
 * - NOT_BYTE, SHL_BYTE, SHR_BYTE, SHR_WORD
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
   * Each shift iteration uses the 6502 pattern:
   *   PHA       ; save low byte (A) to stack
   *   TXA       ; move high byte (X) → A
   *   LSR       ; shift high byte right, bit 0 → carry
   *   TAX       ; store shifted high byte back to X
   *   PLA       ; restore low byte to A
   *   ROR       ; rotate low byte right, carry → bit 7
   *
   * This correctly propagates bits from the high byte into the low byte
   * across each shift, implementing unsigned 16-bit right shift.
   *
   * IL: SHR_WORD count
   * 6502: (PHA / TXA / LSR / TAX / PLA / ROR) × count
   */
  protected genShrWord(instr: ILInstruction): void {
    this.emitComment(instr);
    const imm = this.getImmediateOperand(instr.operands);
    const count = imm.value;

    for (let i = 0; i < count; i++) {
      this.asm.pha('save low byte');
      this.asm.txa('high byte → A');
      this.asm.lsr(undefined, 'accumulator');
      this.asm.tax('shifted high → X');
      this.asm.pla('restore low byte');
      this.asm.ror(undefined, 'accumulator');
    }
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
      default:
        super.generateInstruction(instr);
    }
  }
}