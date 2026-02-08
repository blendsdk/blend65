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
   * @param name - Function name
   * @param isCallback - Whether this is a callback/ISR (default: false)
   * @param coalesceGroup - Callee's coalesce group (default: -1)
   * @param comment - Optional comment
   */
  call(name: string, isCallback: boolean = false, coalesceGroup: number = -1, comment?: string): void {
    this.emit(ILOpcode.CALL, [createFunctionOperand(name, isCallback, coalesceGroup)], comment);
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