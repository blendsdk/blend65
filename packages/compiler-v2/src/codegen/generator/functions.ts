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
  // CPU-Aware Register Save/Restore Helpers
  // ==========================================================================

  /**
   * Saves the X register to the stack using the CPU strategy.
   *
   * Delegates to `this.cpu.emitPushX()` which selects the optimal
   * instruction sequence for the target CPU:
   * - **6502:** TXA + PHA (2 bytes, clobbers A)
   * - **65C02:** PHX (1 byte, preserves A)
   *
   * Use in function prologues or around calls that clobber X.
   *
   * @param comment - Optional comment for the instruction
   */
  protected saveX(comment?: string): void {
    this.cpu.emitPushX(this.asm, comment);
    // On 6502, TXA clobbers A. On 65C02, PHX preserves A.
    // Conservatively invalidate A since 6502 is the common target.
    this.invalidateA();
  }

  /**
   * Restores the X register from the stack using the CPU strategy.
   *
   * Delegates to `this.cpu.emitPullX()` which selects the optimal
   * instruction sequence for the target CPU:
   * - **6502:** PLA + TAX (2 bytes, clobbers A)
   * - **65C02:** PLX (1 byte, preserves A)
   *
   * Use in function epilogues to restore callee-save registers.
   *
   * @param comment - Optional comment for the instruction
   */
  protected restoreX(comment?: string): void {
    this.cpu.emitPullX(this.asm, comment);
    // On 6502, PLA+TAX clobbers A. On 65C02, PLX preserves A.
    this.invalidateA();
  }

  /**
   * Saves the Y register to the stack using the CPU strategy.
   *
   * Delegates to `this.cpu.emitPushY()` which selects the optimal
   * instruction sequence for the target CPU:
   * - **6502:** TYA + PHA (2 bytes, clobbers A)
   * - **65C02:** PHY (1 byte, preserves A)
   *
   * Use in function prologues or around calls that clobber Y.
   *
   * @param comment - Optional comment for the instruction
   */
  protected saveY(comment?: string): void {
    this.cpu.emitPushY(this.asm, comment);
    // On 6502, TYA clobbers A. On 65C02, PHY preserves A.
    this.invalidateA();
  }

  /**
   * Restores the Y register from the stack using the CPU strategy.
   *
   * Delegates to `this.cpu.emitPullY()` which selects the optimal
   * instruction sequence for the target CPU:
   * - **6502:** PLA + TAY (2 bytes, clobbers A)
   * - **65C02:** PLY (1 byte, preserves A)
   *
   * Use in function epilogues to restore callee-save registers.
   *
   * @param comment - Optional comment for the instruction
   */
  protected restoreY(comment?: string): void {
    this.cpu.emitPullY(this.asm, comment);
    // On 6502, PLA+TAY clobbers A. On 65C02, PLY preserves A.
    this.invalidateA();
  }

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