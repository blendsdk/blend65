/**
 * IL Builder - Control Flow and Comparison Layer
 *
 * Adds control flow and comparison operations:
 * - Compare with slot/immediate
 * - Unconditional jump
 * - Conditional jumps (eq, ne, lt, le, ge, gt)
 * - Function call/return
 * - Register transfers
 * - Intrinsics (peek/poke)
 *
 * @module il/builder/control
 */

import { FrameSlot } from '../../frame/types.js';
import { ILOpcode } from '../enums.js';
import {
  createSlotOperand,
  createImmediateOperand,
  createLabelOperand,
  createFunctionOperand,
  createAddressOperand,
} from '../factories.js';
import { ILBuilderArithmetic } from './arithmetic.js';

/**
 * Control flow and comparison layer for IL Builder.
 *
 * Extends arithmetic layer with comparison, jumps, and function ops.
 */
export class ILBuilderControl extends ILBuilderArithmetic {
  // ═══════════════════════════════════════════════════════════════════
  // Comparison Operations
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Compare accumulator with slot value.
   *
   * @param slot - Source slot
   * @param comment - Optional comment
   */
  cmpSlot(slot: FrameSlot, comment?: string): void {
    this.emit(ILOpcode.CMP_BYTE, [createSlotOperand(slot)], comment);
  }

  /**
   * Compare accumulator with immediate value.
   *
   * @param value - Byte value (0-255)
   * @param comment - Optional comment
   */
  cmpImm(value: number, comment?: string): void {
    this.emit(ILOpcode.CMP_IMM, [createImmediateOperand(value)], comment);
  }

  /**
   * Compare A:X with immediate word (16-bit comparison).
   *
   * Compares the word in A:X with a 16-bit immediate value.
   * Sets Z and C flags correctly for all conditional jumps.
   * 6502: CPX #>word / BNE .done / CMP #<word / .done:
   *
   * @param value - Word value (0-65535)
   * @param comment - Optional comment
   */
  cmpWordImm(value: number, comment?: string): void {
    this.emit(ILOpcode.CMP_WORD_IMM, [createImmediateOperand(value, true)], comment);
  }

  /**
   * Compare A:X with word slot (16-bit comparison).
   *
   * Compares the word in A:X with a 16-bit value from a slot.
   * Sets Z and C flags correctly for all conditional jumps.
   * 6502: CPX slot+1 / BNE .done / CMP slot / .done:
   *
   * @param slot - Word-sized source slot
   * @param comment - Optional comment
   */
  cmpWordSlot(slot: FrameSlot, comment?: string): void {
    this.emit(ILOpcode.CMP_WORD_SLOT, [createSlotOperand(slot)], comment);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Jump Operations
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Unconditional jump.
   *
   * @param label - Target label
   * @param comment - Optional comment
   */
  jump(label: string, comment?: string): void {
    this.emit(ILOpcode.JUMP, [createLabelOperand(label)], comment);
  }

  /**
   * Jump if equal (zero flag set).
   *
   * @param label - Target label
   * @param comment - Optional comment
   */
  jumpEq(label: string, comment?: string): void {
    this.emit(ILOpcode.JUMP_EQ, [createLabelOperand(label)], comment);
  }

  /**
   * Jump if not equal (zero flag clear).
   *
   * @param label - Target label
   * @param comment - Optional comment
   */
  jumpNe(label: string, comment?: string): void {
    this.emit(ILOpcode.JUMP_NE, [createLabelOperand(label)], comment);
  }

  /**
   * Jump if less than (carry flag clear).
   *
   * @param label - Target label
   * @param comment - Optional comment
   */
  jumpLt(label: string, comment?: string): void {
    this.emit(ILOpcode.JUMP_LT, [createLabelOperand(label)], comment);
  }

  /**
   * Jump if less than or equal.
   *
   * @param label - Target label
   * @param comment - Optional comment
   */
  jumpLe(label: string, comment?: string): void {
    this.emit(ILOpcode.JUMP_LE, [createLabelOperand(label)], comment);
  }

  /**
   * Jump if greater than or equal (carry flag set).
   *
   * @param label - Target label
   * @param comment - Optional comment
   */
  jumpGe(label: string, comment?: string): void {
    this.emit(ILOpcode.JUMP_GE, [createLabelOperand(label)], comment);
  }

  /**
   * Jump if greater than.
   *
   * @param label - Target label
   * @param comment - Optional comment
   */
  jumpGt(label: string, comment?: string): void {
    this.emit(ILOpcode.JUMP_GT, [createLabelOperand(label)], comment);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Function Operations
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Call a function.
   *
   * When parameterUses is provided, the CALL instruction's defUse.uses
   * is patched to include those slot names. This tells liveness analysis
   * that the CALL reads from these parameter slots, preventing DCE from
   * removing the preceding stores that set them up.
   *
   * @param name - Function name
   * @param isCallback - Whether this is a callback/ISR (default: false)
   * @param coalesceGroup - Callee's coalesce group (default: -1)
   * @param comment - Optional comment
   * @param parameterUses - Callee parameter slot names consumed by this call
   */
  call(
    name: string,
    isCallback: boolean = false,
    coalesceGroup: number = -1,
    comment?: string,
    parameterUses?: string[],
  ): void {
    this.emit(ILOpcode.CALL, [createFunctionOperand(name, isCallback, coalesceGroup)], comment);

    // Patch defUse to include callee parameter slot names as uses.
    // Without this, liveness analysis doesn't see that CALL reads from
    // parameter slots, and DCE incorrectly removes the preceding stores.
    if (parameterUses && parameterUses.length > 0) {
      const lastInstr = this.instructions[this.instructions.length - 1];
      if (lastInstr.defUse) {
        // DefUse is readonly, so replace the entire object
        lastInstr.defUse = {
          defs: lastInstr.defUse.defs,
          uses: [...lastInstr.defUse.uses, ...parameterUses],
        };
      }
    }
  }

  /**
   * Return from function.
   *
   * @param comment - Optional comment
   */
  return_(comment?: string): void {
    this.emit(ILOpcode.RETURN, [], comment);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Register Transfers
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Transfer A to X (TAX).
   *
   * @param comment - Optional comment
   */
  transferAX(comment?: string): void {
    this.emit(ILOpcode.TRANSFER_AX, [], comment);
  }

  /**
   * Transfer A to Y (TAY).
   *
   * @param comment - Optional comment
   */
  transferAY(comment?: string): void {
    this.emit(ILOpcode.TRANSFER_AY, [], comment);
  }

  /**
   * Transfer X to A (TXA).
   *
   * @param comment - Optional comment
   */
  transferXA(comment?: string): void {
    this.emit(ILOpcode.TRANSFER_XA, [], comment);
  }

  /**
   * Transfer Y to A (TYA).
   *
   * @param comment - Optional comment
   */
  transferYA(comment?: string): void {
    this.emit(ILOpcode.TRANSFER_YA, [], comment);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Stack Operations
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Push accumulator to stack (PHA).
   *
   * @param comment - Optional comment
   */
  pushA(comment?: string): void {
    this.emit(ILOpcode.PUSH_A, [], comment);
  }

  /**
   * Pop accumulator from stack (PLA).
   *
   * @param comment - Optional comment
   */
  popA(comment?: string): void {
    this.emit(ILOpcode.POP_A, [], comment);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Intrinsics
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Peek byte from address.
   *
   * @param address - Memory address
   * @param comment - Optional comment
   */
  peek(address: number, comment?: string): void {
    this.emit(ILOpcode.PEEK, [createAddressOperand(address)], comment);
  }

  /**
   * Poke byte to address.
   *
   * @param address - Memory address
   * @param comment - Optional comment
   */
  poke(address: number, comment?: string): void {
    this.emit(ILOpcode.POKE, [createAddressOperand(address)], comment);
  }

  /**
   * Peek word from address.
   *
   * @param address - Memory address
   * @param comment - Optional comment
   */
  peekw(address: number, comment?: string): void {
    this.emit(ILOpcode.PEEKW, [createAddressOperand(address)], comment);
  }

  /**
   * Poke word to address.
   *
   * @param address - Memory address
   * @param comment - Optional comment
   */
  pokew(address: number, comment?: string): void {
    this.emit(ILOpcode.POKEW, [createAddressOperand(address)], comment);
  }

  /**
   * Extract high byte from word value in accumulator.
   *
   * @param comment - Optional comment
   */
  hi(comment?: string): void {
    this.emit(ILOpcode.HI, [], comment);
  }

  /**
   * Extract low byte from word value in accumulator.
   *
   * @param comment - Optional comment
   */
  lo(comment?: string): void {
    this.emit(ILOpcode.LO, [], comment);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Special
  // ═══════════════════════════════════════════════════════════════════

  /**
   * No operation.
   *
   * @param comment - Optional comment
   */
  nop(comment?: string): void {
    this.emit(ILOpcode.NOP, [], comment);
  }
}