/**
 * Memory Operations Generator
 *
 * Handles IL opcodes for memory operations:
 * - LOAD_BYTE, LOAD_WORD, LOAD_IMM, LOAD_IMM_WORD
 * - STORE_BYTE, STORE_WORD
 *
 * @module codegen/generator/memory
 */

import { ILInstruction, ILOpcode } from '../../il/index.js';
import { CodeGeneratorBase } from './base.js';

/**
 * Memory operations layer of the code generator.
 *
 * Extends CodeGeneratorBase with load/store operations.
 */
export class MemoryOpsGenerator extends CodeGeneratorBase {
  // ==========================================================================
  // LOAD_BYTE - Load byte from slot into A
  // ==========================================================================

  /**
   * Generates code for LOAD_BYTE.
   *
   * IL: LOAD_BYTE slot
   * 6502: LDA addr (ZP or absolute)
   *
   * With accumulator tracking, skips load if A already has the value.
   */
  protected genLoadByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;

    // Skip if A already has this value
    if (this.aHasSlot(address)) {
      this.asm.comment(`; A already has $${address.toString(16).toUpperCase()}`);
      return;
    }

    const mode = this.getLoadMode(slot.slot);
    this.asm.lda(address, mode);
    this.setAFromSlot(address);
  }

  // ==========================================================================
  // STORE_BYTE - Store A to slot
  // ==========================================================================

  /**
   * Generates code for STORE_BYTE.
   *
   * IL: STORE_BYTE slot
   * 6502: STA addr
   */
  protected genStoreByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getStoreMode(slot.slot);
    this.asm.sta(address, mode);
    // A still has the same value
    this.setAFromSlot(address);
  }

  // ==========================================================================
  // LOAD_WORD - Load word from slot into A/X
  // ==========================================================================

  /**
   * Generates code for LOAD_WORD.
   *
   * IL: LOAD_WORD slot
   * 6502: LDA addr / LDX addr+1
   *
   * For 16-bit values, low byte in A, high byte in X.
   */
  protected genLoadWord(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);

    // Load low byte into A
    this.asm.lda(address, mode);
    // Load high byte into X
    this.asm.ldx(address + 1, mode === 'zeroPage' ? 'zeroPage' : 'absolute');

    // Invalidate A state (we track it as word low)
    this.invalidateA();
  }

  // ==========================================================================
  // STORE_WORD - Store A/X to slot
  // ==========================================================================

  /**
   * Generates code for STORE_WORD.
   *
   * IL: STORE_WORD slot
   * 6502: STA addr / STX addr+1
   */
  protected genStoreWord(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getStoreMode(slot.slot);

    // Store low byte from A
    this.asm.sta(address, mode);
    // Store high byte from X
    this.asm.stx(address + 1, mode === 'zeroPage' ? 'zeroPage' : 'absolute');

    // Invalidate A state (word operations are complex)
    this.invalidateA();
  }

  // ==========================================================================
  // LOAD_IMM - Load immediate byte into A
  // ==========================================================================

  /**
   * Generates code for LOAD_IMM.
   *
   * IL: LOAD_IMM value
   * 6502: LDA #value
   */
  protected genLoadImm(instr: ILInstruction): void {
    this.emitComment(instr);
    const imm = this.getImmediateOperand(instr.operands);

    // Skip if A already has this value
    if (this.aHasImmediate(imm.value)) {
      this.asm.comment(`; A already has #${imm.value}`);
      return;
    }

    this.asm.lda(imm.value, 'immediate');
    this.setAFromImmediate(imm.value);
  }

  // ==========================================================================
  // LOAD_IMM_WORD - Load immediate word into A/X
  // ==========================================================================

  /**
   * Generates code for LOAD_IMM_WORD.
   *
   * IL: LOAD_IMM_WORD value
   * 6502: LDA #lo / LDX #hi
   */
  protected genLoadImmWord(instr: ILInstruction): void {
    this.emitComment(instr);
    const imm = this.getImmediateOperand(instr.operands);
    const lo = imm.value & 0xff;
    const hi = (imm.value >> 8) & 0xff;

    this.asm.lda(lo, 'immediate');
    this.asm.ldx(hi, 'immediate');

    // Invalidate A state (word)
    this.invalidateA();
  }

  // ==========================================================================
  // Dispatch Override
  // ==========================================================================

  /**
   * Handles memory operation opcodes.
   */
  protected override generateInstruction(instr: ILInstruction): void {
    switch (instr.opcode) {
      case ILOpcode.LOAD_BYTE:
        this.genLoadByte(instr);
        break;
      case ILOpcode.STORE_BYTE:
        this.genStoreByte(instr);
        break;
      case ILOpcode.LOAD_WORD:
        this.genLoadWord(instr);
        break;
      case ILOpcode.STORE_WORD:
        this.genStoreWord(instr);
        break;
      case ILOpcode.LOAD_IMM:
        this.genLoadImm(instr);
        break;
      case ILOpcode.LOAD_IMM_WORD:
        this.genLoadImmWord(instr);
        break;
      default:
        // Pass to parent (will throw for unhandled)
        super.generateInstruction(instr);
    }
  }
}