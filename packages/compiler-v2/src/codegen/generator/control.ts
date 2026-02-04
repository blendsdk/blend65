/**
 * Control Flow Operations Generator
 *
 * Handles IL opcodes for control flow:
 * - LABEL, JUMP
 * - JUMP_EQ, JUMP_NE, JUMP_LT, JUMP_LE, JUMP_GE, JUMP_GT
 * - NOP, PUSH_A, POP_A, TRANSFER_*
 *
 * @module codegen/generator/control
 */

import { ILInstruction, ILOpcode } from '../../il/index.js';
import { ComparisonOpsGenerator } from './comparison.js';

/**
 * Control flow operations layer of the code generator.
 */
export class ControlFlowOpsGenerator extends ComparisonOpsGenerator {
  // ==========================================================================
  // LABEL - Define a label
  // ==========================================================================

  protected genLabel(instr: ILInstruction): void {
    const label = this.getLabelOperand(instr.operands);
    this.asm.label(this.localLabel(label.name), true);
    // Invalidate A at labels (unknown control flow)
    this.invalidateA();
  }

  // ==========================================================================
  // JUMP - Unconditional jump
  // ==========================================================================

  protected genJump(instr: ILInstruction): void {
    this.emitComment(instr);
    const label = this.getLabelOperand(instr.operands);
    this.asm.jmp(this.localLabel(label.name));
  }

  // ==========================================================================
  // JUMP_EQ - Branch if equal (Z=1)
  // ==========================================================================

  protected genJumpEq(instr: ILInstruction): void {
    this.emitComment(instr);
    const label = this.getLabelOperand(instr.operands);
    this.asm.beq(this.localLabel(label.name));
  }

  // ==========================================================================
  // JUMP_NE - Branch if not equal (Z=0)
  // ==========================================================================

  protected genJumpNe(instr: ILInstruction): void {
    this.emitComment(instr);
    const label = this.getLabelOperand(instr.operands);
    this.asm.bne(this.localLabel(label.name));
  }

  // ==========================================================================
  // JUMP_LT - Branch if less than (unsigned: C=0)
  // ==========================================================================

  protected genJumpLt(instr: ILInstruction): void {
    this.emitComment(instr);
    const label = this.getLabelOperand(instr.operands);
    this.asm.bcc(this.localLabel(label.name));
  }

  // ==========================================================================
  // JUMP_LE - Branch if less or equal (C=0 or Z=1)
  // ==========================================================================

  protected genJumpLe(instr: ILInstruction): void {
    this.emitComment(instr);
    const label = this.getLabelOperand(instr.operands);
    // A <= B: BCC or BEQ
    this.asm.bcc(this.localLabel(label.name));
    this.asm.beq(this.localLabel(label.name));
  }

  // ==========================================================================
  // JUMP_GE - Branch if greater or equal (unsigned: C=1)
  // ==========================================================================

  protected genJumpGe(instr: ILInstruction): void {
    this.emitComment(instr);
    const label = this.getLabelOperand(instr.operands);
    this.asm.bcs(this.localLabel(label.name));
  }

  // ==========================================================================
  // JUMP_GT - Branch if greater (C=1 and Z=0)
  // ==========================================================================

  protected genJumpGt(instr: ILInstruction): void {
    this.emitComment(instr);
    const label = this.getLabelOperand(instr.operands);
    // A > B: Not (A <= B) = C=1 and Z=0
    // BEQ skip / BCS label / skip:
    const skipLabel = this.uniqueLabel('skip_gt');
    this.asm.beq(this.localLabel(skipLabel));
    this.asm.bcs(this.localLabel(label.name));
    this.asm.label(this.localLabel(skipLabel), true);
  }

  // ==========================================================================
  // NOP - No operation
  // ==========================================================================

  protected genNop(instr: ILInstruction): void {
    this.emitComment(instr);
    this.asm.nop();
  }

  // ==========================================================================
  // PUSH_A - Push accumulator
  // ==========================================================================

  protected genPushA(instr: ILInstruction): void {
    this.emitComment(instr);
    this.asm.pha();
  }

  // ==========================================================================
  // POP_A - Pop accumulator
  // ==========================================================================

  protected genPopA(instr: ILInstruction): void {
    this.emitComment(instr);
    this.asm.pla();
    this.invalidateA();
  }

  // ==========================================================================
  // TRANSFER_AX - Transfer A to X
  // ==========================================================================

  protected genTransferAX(instr: ILInstruction): void {
    this.emitComment(instr);
    this.asm.tax();
  }

  // ==========================================================================
  // TRANSFER_AY - Transfer A to Y
  // ==========================================================================

  protected genTransferAY(instr: ILInstruction): void {
    this.emitComment(instr);
    this.asm.tay();
  }

  // ==========================================================================
  // TRANSFER_XA - Transfer X to A
  // ==========================================================================

  protected genTransferXA(instr: ILInstruction): void {
    this.emitComment(instr);
    this.asm.txa();
    this.invalidateA();
  }

  // ==========================================================================
  // TRANSFER_YA - Transfer Y to A
  // ==========================================================================

  protected genTransferYA(instr: ILInstruction): void {
    this.emitComment(instr);
    this.asm.tya();
    this.invalidateA();
  }

  // ==========================================================================
  // Dispatch Override
  // ==========================================================================

  protected override generateInstruction(instr: ILInstruction): void {
    switch (instr.opcode) {
      case ILOpcode.LABEL:
        this.genLabel(instr);
        break;
      case ILOpcode.JUMP:
        this.genJump(instr);
        break;
      case ILOpcode.JUMP_EQ:
        this.genJumpEq(instr);
        break;
      case ILOpcode.JUMP_NE:
        this.genJumpNe(instr);
        break;
      case ILOpcode.JUMP_LT:
        this.genJumpLt(instr);
        break;
      case ILOpcode.JUMP_LE:
        this.genJumpLe(instr);
        break;
      case ILOpcode.JUMP_GE:
        this.genJumpGe(instr);
        break;
      case ILOpcode.JUMP_GT:
        this.genJumpGt(instr);
        break;
      case ILOpcode.NOP:
        this.genNop(instr);
        break;
      case ILOpcode.PUSH_A:
        this.genPushA(instr);
        break;
      case ILOpcode.POP_A:
        this.genPopA(instr);
        break;
      case ILOpcode.TRANSFER_AX:
        this.genTransferAX(instr);
        break;
      case ILOpcode.TRANSFER_AY:
        this.genTransferAY(instr);
        break;
      case ILOpcode.TRANSFER_XA:
        this.genTransferXA(instr);
        break;
      case ILOpcode.TRANSFER_YA:
        this.genTransferYA(instr);
        break;
      default:
        super.generateInstruction(instr);
    }
  }
}