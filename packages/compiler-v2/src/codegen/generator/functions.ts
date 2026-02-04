/**
 * Function Operations Generator
 *
 * Handles IL opcodes for function operations:
 * - CALL, RETURN
 *
 * @module codegen/generator/functions
 */

import { ILInstruction, ILOpcode } from '../../il/index.js';
import { ControlFlowOpsGenerator } from './control.js';

/**
 * Function operations layer of the code generator.
 */
export class FunctionOpsGenerator extends ControlFlowOpsGenerator {
  // ==========================================================================
  // CALL - Call function
  // ==========================================================================

  /**
   * Generates code for CALL.
   *
   * IL: CALL funcname
   * 6502: JSR funcname
   */
  protected genCall(instr: ILInstruction): void {
    this.emitComment(instr);
    const func = this.getFunctionOperand(instr.operands);
    this.asm.jsr(func.name);
    // Function may clobber A
    this.invalidateA();
  }

  // ==========================================================================
  // RETURN - Return from function
  // ==========================================================================

  /**
   * Generates code for RETURN.
   *
   * IL: RETURN
   * 6502: RTS
   */
  protected genReturn(instr: ILInstruction): void {
    this.emitComment(instr);
    this.asm.rts();
  }

  // ==========================================================================
  // Dispatch Override
  // ==========================================================================

  protected override generateInstruction(instr: ILInstruction): void {
    switch (instr.opcode) {
      case ILOpcode.CALL:
        this.genCall(instr);
        break;
      case ILOpcode.RETURN:
        this.genReturn(instr);
        break;
      default:
        super.generateInstruction(instr);
    }
  }
}