/**
 * Comparison Operations Generator
 *
 * Handles IL opcodes for comparison operations:
 * - CMP_BYTE, CMP_IMM
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
      default:
        super.generateInstruction(instr);
    }
  }
}