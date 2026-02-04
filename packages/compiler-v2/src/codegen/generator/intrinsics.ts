/**
 * Intrinsics Operations Generator
 *
 * Handles IL opcodes for intrinsic operations:
 * - PEEK, POKE, PEEKW, POKEW, HI, LO
 *
 * @module codegen/generator/intrinsics
 */

import { ILInstruction, ILOpcode } from '../../il/index.js';
import { FunctionOpsGenerator } from './functions.js';

/**
 * Intrinsics operations layer of the code generator.
 */
export class IntrinsicsOpsGenerator extends FunctionOpsGenerator {
  // ==========================================================================
  // PEEK - Read byte from address
  // ==========================================================================

  /**
   * Generates code for PEEK.
   *
   * IL: PEEK addr
   * 6502: LDA addr (or indirect for dynamic)
   */
  protected genPeek(instr: ILInstruction): void {
    this.emitComment(instr);
    const addr = this.getAddressOperand(instr.operands);
    const mode = this.getAddressMode(addr);
    this.asm.lda(addr.address, mode);
    this.invalidateA();
  }

  // ==========================================================================
  // POKE - Write byte to address
  // ==========================================================================

  /**
   * Generates code for POKE.
   *
   * IL: POKE addr
   * 6502: STA addr
   *
   * Value to write should already be in A.
   */
  protected genPoke(instr: ILInstruction): void {
    this.emitComment(instr);
    const addr = this.getAddressOperand(instr.operands);
    const mode = this.getAddressMode(addr);
    this.asm.sta(addr.address, mode);
  }

  // ==========================================================================
  // PEEKW - Read word from address
  // ==========================================================================

  /**
   * Generates code for PEEKW.
   *
   * IL: PEEKW addr
   * 6502: LDA addr / LDX addr+1
   */
  protected genPeekw(instr: ILInstruction): void {
    this.emitComment(instr);
    const addr = this.getAddressOperand(instr.operands);
    const mode = this.getAddressMode(addr);
    this.asm.lda(addr.address, mode);
    this.asm.ldx(addr.address + 1, mode === 'zeroPage' ? 'zeroPage' : 'absolute');
    this.invalidateA();
  }

  // ==========================================================================
  // POKEW - Write word to address
  // ==========================================================================

  /**
   * Generates code for POKEW.
   *
   * IL: POKEW addr
   * 6502: STA addr / STX addr+1
   *
   * Value to write: low byte in A, high byte in X.
   */
  protected genPokew(instr: ILInstruction): void {
    this.emitComment(instr);
    const addr = this.getAddressOperand(instr.operands);
    const mode = this.getAddressMode(addr);
    this.asm.sta(addr.address, mode);
    this.asm.stx(addr.address + 1, mode === 'zeroPage' ? 'zeroPage' : 'absolute');
  }

  // ==========================================================================
  // HI - Get high byte of word
  // ==========================================================================

  /**
   * Generates code for HI.
   *
   * IL: HI
   * 6502: TXA (high byte is in X, move to A)
   */
  protected genHi(instr: ILInstruction): void {
    this.emitComment(instr);
    this.asm.txa();
    this.invalidateA();
  }

  // ==========================================================================
  // LO - Get low byte of word
  // ==========================================================================

  /**
   * Generates code for LO.
   *
   * IL: LO
   * 6502: (no-op, low byte already in A)
   */
  protected genLo(instr: ILInstruction): void {
    this.emitComment(instr);
    // Low byte is already in A, nothing to do
    this.asm.comment('; lo(word) - A already has low byte');
  }

  // ==========================================================================
  // Dispatch Override
  // ==========================================================================

  protected override generateInstruction(instr: ILInstruction): void {
    switch (instr.opcode) {
      case ILOpcode.PEEK:
        this.genPeek(instr);
        break;
      case ILOpcode.POKE:
        this.genPoke(instr);
        break;
      case ILOpcode.PEEKW:
        this.genPeekw(instr);
        break;
      case ILOpcode.POKEW:
        this.genPokew(instr);
        break;
      case ILOpcode.HI:
        this.genHi(instr);
        break;
      case ILOpcode.LO:
        this.genLo(instr);
        break;
      default:
        super.generateInstruction(instr);
    }
  }
}