/**
 * Memory Operations Generator
 *
 * Handles IL opcodes for memory operations:
 * - LOAD_BYTE, LOAD_WORD, LOAD_IMM, LOAD_IMM_WORD
 * - STORE_BYTE, STORE_WORD
 * - PROMOTE_BYTE_WORD
 *
 * @module codegen/generator/memory
 */

import { ILInstruction, ILOpcode } from '../../il/index.js';
import { AsmAddressingMode } from '../asm-il/types.js';
import { CodeGeneratorBase } from './base.js';

/**
 * Memory operations layer of the code generator.
 *
 * Extends CodeGeneratorBase with load/store operations.
 */
export class MemoryOpsGenerator extends CodeGeneratorBase {
  // ==========================================================================
  // CPU-Aware Memory Helpers
  // ==========================================================================

  /**
   * Stores zero to a memory address using the CPU strategy.
   *
   * Delegates to `this.cpu.emitStoreZero()` which selects the optimal
   * instruction sequence for the target CPU:
   * - **6502:** LDA #0 + STA addr (4-5 bytes, clobbers A)
   * - **65C02:** STZ addr (2-3 bytes, preserves A)
   *
   * Use this method when the codegen needs to explicitly zero a memory
   * location WITHOUT a preceding LOAD_IMM 0. For the LOAD_IMM 0 + STORE_BYTE
   * IL sequence, the normal genLoadImm + genStoreByte path is used instead
   * (the LOAD_IMM already loads zero into A, so only STA is needed).
   *
   * @param address - The memory address to store zero at
   * @param isZp - Whether the address is in zero page ($00-$FF)
   * @param comment - Optional comment for the instruction
   */
  protected storeZeroToAddress(address: number, isZp: boolean, comment?: string): void {
    this.cpu.emitStoreZero(this.asm, address, isZp, comment);
    // On 6502, emitStoreZero clobbers A (loads 0). On 65C02, A is preserved.
    // Conservatively mark A as holding immediate 0 since that's the
    // common case (6502), and on 65C02 we're being conservative.
    this.setAFromImmediate(0);
  }

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

    // Check for Y-indexed array access (set by IL builder's loadIndexedY).
    // When indexedByY is true, emit LDA base,Y instead of plain LDA base.
    // This is critical for array element reads: arr[i] must use the Y register
    // as the dynamic index offset from the array's base address.
    // NOTE: 6502 LDA does NOT support zeroPageY — only absoluteY is available
    // for Y-indexed loads. Even for ZP base addresses, absoluteY mode is used.
    if (slot.indexedByY) {
      // @data const arrays: use ACME label for correct addressing.
      // The label resolves to the absolute address at assembly time,
      // avoiding the broken relative-offset address (which would be 0).
      if (slot.slot.dataLabel) {
        this.asm.instruction('LDA', AsmAddressingMode.AbsoluteY, undefined, slot.slot.dataLabel);
      } else {
        this.asm.lda(address, 'absoluteY');
      }
      // Y-indexed loads produce variable results, cannot track A state
      this.invalidateA();
      return;
    }

    // @data const scalars: use ACME label for correct addressing.
    if (slot.slot.dataLabel) {
      this.asm.instruction('LDA', AsmAddressingMode.Absolute, undefined, slot.slot.dataLabel);
      this.invalidateA();
      return;
    }

    // Skip redundant load if A already holds this slot's value.
    // No comment emitted — these tracking comments can be misleading
    // at branch convergence points where A's actual state is uncertain.
    if (this.aHasSlot(address)) {
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

    // Check for Y-indexed array access (set by IL builder's storeIndexedY).
    // When indexedByY is true, emit STA base,Y instead of plain STA base.
    // This is critical for array element writes: arr[i] = value must use the
    // Y register as the dynamic index offset from the array's base address.
    // NOTE: 6502 STA does NOT support zeroPageY — only absoluteY is available
    // for Y-indexed stores. Even for ZP base addresses, absoluteY mode is used.
    if (slot.indexedByY) {
      // @data const arrays: use ACME label for correct addressing (defensive).
      // In practice, @data arrays are read-only, but if the IL ever emits
      // a store to a @data slot, use the label for correct addressing.
      if (slot.slot.dataLabel) {
        this.asm.instruction('STA', AsmAddressingMode.AbsoluteY, undefined, slot.slot.dataLabel);
      } else {
        this.asm.sta(address, 'absoluteY');
      }
      // Y-indexed stores — A still holds the stored value but we can't
      // associate it with a specific slot (it went to a dynamic location)
      this.invalidateA();
      return;
    }

    // @data const scalars: use ACME label for correct addressing (defensive).
    if (slot.slot.dataLabel) {
      this.asm.instruction('STA', AsmAddressingMode.Absolute, undefined, slot.slot.dataLabel);
      this.invalidateA();
      return;
    }

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

    // Skip redundant load if A already holds this immediate value.
    // No comment emitted — these tracking comments can be misleading
    // at branch convergence points where A's actual state is uncertain.
    if (this.aHasImmediate(imm.value)) {
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
  // PROMOTE_BYTE_WORD - Zero-extend byte in A to word in A:X
  // ==========================================================================

  /**
   * Generates code for PROMOTE_BYTE_WORD.
   *
   * Promotes a byte value in A to a 16-bit word in A:X by setting
   * X to 0 (unsigned zero extension). A is preserved unchanged.
   *
   * IL: PROMOTE_BYTE_WORD
   * 6502: LDX #0
   *
   * This is emitted by the IL generator when a byte value needs to
   * participate in word arithmetic (e.g., `byte_var + word_var`).
   */
  protected genPromoteByteWord(instr: ILInstruction): void {
    this.emitComment(instr);
    // Zero-extend: high byte = 0, low byte (A) stays unchanged
    this.asm.ldx(0, 'immediate', 'promote byte to word (high byte = 0)');
    // A is unchanged — keep current accumulator state
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
      case ILOpcode.PROMOTE_BYTE_WORD:
        this.genPromoteByteWord(instr);
        break;
      default:
        // Pass to parent (will throw for unhandled)
        super.generateInstruction(instr);
    }
  }
}