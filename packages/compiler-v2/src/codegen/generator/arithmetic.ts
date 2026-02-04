/**
 * Arithmetic Operations Generator
 *
 * Handles IL opcodes for arithmetic operations:
 * - ADD_BYTE, ADD_IMM, SUB_BYTE, SUB_IMM
 * - MUL_BYTE, MUL_IMM, DIV_BYTE, MOD_BYTE
 * - INC_BYTE, DEC_BYTE
 *
 * @module codegen/generator/arithmetic
 */

import { ILInstruction, ILOpcode } from '../../il/index.js';
import { MemoryOpsGenerator } from './memory.js';

/**
 * Arithmetic operations layer of the code generator.
 *
 * Extends MemoryOpsGenerator with arithmetic operations.
 */
export class ArithmeticOpsGenerator extends MemoryOpsGenerator {
  // ==========================================================================
  // ADD_BYTE - Add slot value to A
  // ==========================================================================

  /**
   * Generates code for ADD_BYTE.
   *
   * IL: ADD_BYTE slot
   * 6502: CLC / ADC addr
   */
  protected genAddByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);

    this.asm.clc();
    this.asm.adc(address, mode);
    this.invalidateA(); // Result unknown
  }

  // ==========================================================================
  // ADD_IMM - Add immediate to A
  // ==========================================================================

  /**
   * Generates code for ADD_IMM.
   *
   * IL: ADD_IMM value
   * 6502: CLC / ADC #value
   */
  protected genAddImm(instr: ILInstruction): void {
    this.emitComment(instr);
    const imm = this.getImmediateOperand(instr.operands);

    this.asm.clc();
    this.asm.adc(imm.value, 'immediate');
    this.invalidateA();
  }

  // ==========================================================================
  // SUB_BYTE - Subtract slot value from A
  // ==========================================================================

  /**
   * Generates code for SUB_BYTE.
   *
   * IL: SUB_BYTE slot
   * 6502: SEC / SBC addr
   */
  protected genSubByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);

    this.asm.sec();
    this.asm.sbc(address, mode);
    this.invalidateA();
  }

  // ==========================================================================
  // SUB_IMM - Subtract immediate from A
  // ==========================================================================

  /**
   * Generates code for SUB_IMM.
   *
   * IL: SUB_IMM value
   * 6502: SEC / SBC #value
   */
  protected genSubImm(instr: ILInstruction): void {
    this.emitComment(instr);
    const imm = this.getImmediateOperand(instr.operands);

    this.asm.sec();
    this.asm.sbc(imm.value, 'immediate');
    this.invalidateA();
  }

  // ==========================================================================
  // MUL_BYTE - Multiply A by slot value (software)
  // ==========================================================================

  /**
   * Generates code for MUL_BYTE.
   *
   * IL: MUL_BYTE slot
   * 6502: (setup) JSR __mul8
   *
   * Multiplication requires a software routine.
   * A = multiplicand, loaded from slot = multiplier
   * Result in A.
   */
  protected genMulByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);

    // Save A (multiplicand) to temp
    this.asm.sta(0xfe, 'zeroPage', 'multiplicand');
    // Load multiplier
    this.asm.lda(address, mode, 'multiplier');
    this.asm.sta(0xff, 'zeroPage');
    // Restore multiplicand
    this.asm.lda(0xfe, 'zeroPage');
    // Call multiply routine
    this.asm.jsr('__mul8');

    this.invalidateA();
  }

  // ==========================================================================
  // MUL_IMM - Multiply A by immediate (software)
  // ==========================================================================

  /**
   * Generates code for MUL_IMM.
   *
   * IL: MUL_IMM value
   * 6502: (setup) JSR __mul8_imm
   */
  protected genMulImm(instr: ILInstruction): void {
    this.emitComment(instr);
    const imm = this.getImmediateOperand(instr.operands);

    // Save A (multiplicand) to temp
    this.asm.sta(0xfe, 'zeroPage', 'multiplicand');
    // Load multiplier
    this.asm.lda(imm.value, 'immediate', 'multiplier');
    this.asm.sta(0xff, 'zeroPage');
    // Restore multiplicand
    this.asm.lda(0xfe, 'zeroPage');
    // Call multiply routine
    this.asm.jsr('__mul8');

    this.invalidateA();
  }

  // ==========================================================================
  // DIV_BYTE - Divide A by slot value (software)
  // ==========================================================================

  /**
   * Generates code for DIV_BYTE.
   *
   * IL: DIV_BYTE slot
   * 6502: (setup) JSR __div8
   *
   * Division requires a software routine.
   * A = dividend, slot = divisor
   * Result (quotient) in A.
   */
  protected genDivByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);

    // Save A (dividend) to temp
    this.asm.sta(0xfe, 'zeroPage', 'dividend');
    // Load divisor
    this.asm.lda(address, mode, 'divisor');
    this.asm.sta(0xff, 'zeroPage');
    // Restore dividend
    this.asm.lda(0xfe, 'zeroPage');
    // Call divide routine
    this.asm.jsr('__div8');

    this.invalidateA();
  }

  // ==========================================================================
  // MOD_BYTE - Modulo A by slot value (software)
  // ==========================================================================

  /**
   * Generates code for MOD_BYTE.
   *
   * IL: MOD_BYTE slot
   * 6502: (setup) JSR __mod8
   *
   * Modulo requires a software routine.
   * A = dividend, slot = divisor
   * Result (remainder) in A.
   */
  protected genModByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);

    // Save A (dividend) to temp
    this.asm.sta(0xfe, 'zeroPage', 'dividend');
    // Load divisor
    this.asm.lda(address, mode, 'divisor');
    this.asm.sta(0xff, 'zeroPage');
    // Restore dividend
    this.asm.lda(0xfe, 'zeroPage');
    // Call modulo routine
    this.asm.jsr('__mod8');

    this.invalidateA();
  }

  // ==========================================================================
  // INC_BYTE - Increment memory
  // ==========================================================================

  /**
   * Generates code for INC_BYTE.
   *
   * IL: INC_BYTE slot
   * 6502: INC addr
   */
  protected genIncByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);

    this.asm.inc(address, mode);
    // Invalidate A - the memory changed but we didn't load it
  }

  // ==========================================================================
  // DEC_BYTE - Decrement memory
  // ==========================================================================

  /**
   * Generates code for DEC_BYTE.
   *
   * IL: DEC_BYTE slot
   * 6502: DEC addr
   */
  protected genDecByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);

    this.asm.dec(address, mode);
    // Invalidate A if it held this address
    if (this.aHasSlot(address)) {
      this.invalidateA();
    }
  }

  // ==========================================================================
  // Dispatch Override
  // ==========================================================================

  /**
   * Handles arithmetic operation opcodes.
   */
  protected override generateInstruction(instr: ILInstruction): void {
    switch (instr.opcode) {
      case ILOpcode.ADD_BYTE:
        this.genAddByte(instr);
        break;
      case ILOpcode.ADD_IMM:
        this.genAddImm(instr);
        break;
      case ILOpcode.SUB_BYTE:
        this.genSubByte(instr);
        break;
      case ILOpcode.SUB_IMM:
        this.genSubImm(instr);
        break;
      case ILOpcode.MUL_BYTE:
        this.genMulByte(instr);
        break;
      case ILOpcode.MUL_IMM:
        this.genMulImm(instr);
        break;
      case ILOpcode.DIV_BYTE:
        this.genDivByte(instr);
        break;
      case ILOpcode.MOD_BYTE:
        this.genModByte(instr);
        break;
      case ILOpcode.INC_BYTE:
        this.genIncByte(instr);
        break;
      case ILOpcode.DEC_BYTE:
        this.genDecByte(instr);
        break;
      default:
        // Pass to parent
        super.generateInstruction(instr);
    }
  }
}