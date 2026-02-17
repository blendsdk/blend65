/**
 * Comparison Operations Generator
 *
 * Handles IL opcodes for comparison operations:
 * - CMP_BYTE, CMP_IMM
 * - CMP_WORD_IMM, CMP_WORD_SLOT
 *
 * @module codegen/generator/comparison
 */

import { ILInstruction, ILOpcode } from '../../il/index.js';
import { BitwiseOpsGenerator } from './bitwise.js';

/**
 * Comparison operations layer of the code generator.
 */
export class ComparisonOpsGenerator extends BitwiseOpsGenerator {
  // ==========================================================================
  // CMP_BYTE - Compare A with slot
  // ==========================================================================

  /**
   * Generates code for CMP_BYTE.
   *
   * IL: CMP_BYTE slot
   * 6502: CMP addr
   *
   * Sets processor flags for subsequent branch instructions.
   */
  protected genCmpByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);
    this.asm.cmp(address, mode);
    // A is unchanged by CMP
  }

  // ==========================================================================
  // CMP_IMM - Compare A with immediate
  // ==========================================================================

  /**
   * Generates code for CMP_IMM.
   *
   * IL: CMP_IMM value
   * 6502: CMP #value
   */
  protected genCmpImm(instr: ILInstruction): void {
    this.emitComment(instr);
    const imm = this.getImmediateOperand(instr.operands);
    this.asm.cmp(imm.value, 'immediate');
    // A is unchanged by CMP
  }

  // ==========================================================================
  // CMP_WORD_IMM - Compare A:X with immediate word
  // ==========================================================================

  /**
   * Generates code for CMP_WORD_IMM.
   *
   * Compares the 16-bit A:X register pair with an immediate word value.
   * High bytes are compared first; if they differ, the flags from CPX
   * determine the result. Only when high bytes are equal do we compare
   * the low bytes with CMP.
   *
   * IL: CMP_WORD_IMM value
   * 6502: CPX #>value / BNE .done / CMP #<value / .done:
   *
   * This correctly sets Z (equal) and C (greater-or-equal) flags for
   * unsigned 16-bit comparison, compatible with BEQ/BNE/BCC/BCS branches.
   */
  protected genCmpWordImm(instr: ILInstruction): void {
    this.emitComment(instr);
    const imm = this.getImmediateOperand(instr.operands);
    const lo = imm.value & 0xff;
    const hi = (imm.value >> 8) & 0xff;
    const doneLabel = this.uniqueLabel('cmp_done');

    // Compare high bytes first (X vs immediate high byte)
    this.asm.cpx(hi, 'immediate', 'compare high bytes');
    // If high bytes differ, flags already reflect the comparison result
    this.asm.bne(this.localLabel(doneLabel));
    // High bytes are equal — compare low bytes to determine final result
    this.asm.cmp(lo, 'immediate', 'compare low bytes');
    this.asm.label(this.localLabel(doneLabel), true);

    // A and X are unchanged by CPX/CMP
  }

  // ==========================================================================
  // CMP_WORD_SLOT - Compare A:X with word slot
  // ==========================================================================

  /**
   * Generates code for CMP_WORD_SLOT.
   *
   * Compares the 16-bit A:X register pair with a word stored in memory.
   * High bytes are compared first (X vs slot+1); if they differ, the
   * flags from CPX determine the result. Only when high bytes are equal
   * do we compare the low bytes (A vs slot).
   *
   * IL: CMP_WORD_SLOT slot
   * 6502: CPX slot_addr+1 / BNE .done / CMP slot_addr / .done:
   */
  protected genCmpWordSlot(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);
    // High byte is at address+1, use same mode category
    const hiMode = mode === 'zeroPage' ? 'zeroPage' : 'absolute';
    const doneLabel = this.uniqueLabel('cmp_done');

    // Compare high bytes first (X vs slot high byte at addr+1)
    this.asm.cpx(address + 1, hiMode, 'compare high bytes');
    // If high bytes differ, flags already reflect the comparison result
    this.asm.bne(this.localLabel(doneLabel));
    // High bytes are equal — compare low bytes to determine final result
    this.asm.cmp(address, mode, 'compare low bytes');
    this.asm.label(this.localLabel(doneLabel), true);

    // A and X are unchanged by CPX/CMP
  }

  // ==========================================================================
  // Dispatch Override
  // ==========================================================================

  protected override generateInstruction(instr: ILInstruction): void {
    switch (instr.opcode) {
      case ILOpcode.CMP_BYTE:
        this.genCmpByte(instr);
        break;
      case ILOpcode.CMP_IMM:
        this.genCmpImm(instr);
        break;
      case ILOpcode.CMP_WORD_IMM:
        this.genCmpWordImm(instr);
        break;
      case ILOpcode.CMP_WORD_SLOT:
        this.genCmpWordSlot(instr);
        break;
      default:
        super.generateInstruction(instr);
    }
  }
}
