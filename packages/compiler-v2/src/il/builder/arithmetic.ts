/**
 * IL Builder - Arithmetic and Bitwise Operations Layer
 *
 * Adds arithmetic and bitwise operations:
 * - Add, subtract, multiply, divide, modulo
 * - Increment, decrement
 * - AND, OR, XOR, NOT
 * - Shift left, shift right
 *
 * @module il/builder/arithmetic
 */

import { FrameSlot } from '../../frame/types.js';
import { ILOpcode } from '../enums.js';
import { createSlotOperand, createImmediateOperand } from '../factories.js';
import { ILBuilderMemory } from './memory.js';

/**
 * Arithmetic and bitwise operations layer for IL Builder.
 *
 * Extends memory layer with arithmetic/bitwise operations.
 */
export class ILBuilderArithmetic extends ILBuilderMemory {
  // ═══════════════════════════════════════════════════════════════════
  // Arithmetic with Slots
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Add byte from slot to accumulator.
   *
   * @param slot - Source slot
   * @param comment - Optional comment
   */
  addSlot(slot: FrameSlot, comment?: string): void {
    this.emit(ILOpcode.ADD_BYTE, [createSlotOperand(slot)], comment);
  }

  /**
   * Subtract byte from slot from accumulator.
   *
   * @param slot - Source slot
   * @param comment - Optional comment
   */
  subSlot(slot: FrameSlot, comment?: string): void {
    this.emit(ILOpcode.SUB_BYTE, [createSlotOperand(slot)], comment);
  }

  /**
   * Multiply accumulator by slot value.
   *
   * @param slot - Source slot
   * @param comment - Optional comment
   */
  mulSlot(slot: FrameSlot, comment?: string): void {
    this.emit(ILOpcode.MUL_BYTE, [createSlotOperand(slot)], comment);
  }

  /**
   * Divide accumulator by slot value.
   *
   * @param slot - Source slot
   * @param comment - Optional comment
   */
  divSlot(slot: FrameSlot, comment?: string): void {
    this.emit(ILOpcode.DIV_BYTE, [createSlotOperand(slot)], comment);
  }

  /**
   * Modulo accumulator by slot value.
   *
   * @param slot - Source slot
   * @param comment - Optional comment
   */
  modSlot(slot: FrameSlot, comment?: string): void {
    this.emit(ILOpcode.MOD_BYTE, [createSlotOperand(slot)], comment);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Arithmetic with Immediates
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Add immediate value to accumulator.
   *
   * @param value - Byte value (0-255)
   * @param comment - Optional comment
   */
  addImm(value: number, comment?: string): void {
    this.emit(ILOpcode.ADD_IMM, [createImmediateOperand(value)], comment);
  }

  /**
   * Subtract immediate value from accumulator.
   *
   * @param value - Byte value (0-255)
   * @param comment - Optional comment
   */
  subImm(value: number, comment?: string): void {
    this.emit(ILOpcode.SUB_IMM, [createImmediateOperand(value)], comment);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Increment/Decrement
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Increment slot in place.
   *
   * @param slot - Target slot
   * @param comment - Optional comment
   */
  incSlot(slot: FrameSlot, comment?: string): void {
    this.emit(ILOpcode.INC_BYTE, [createSlotOperand(slot)], comment);
  }

  /**
   * Decrement slot in place.
   *
   * @param slot - Target slot
   * @param comment - Optional comment
   */
  decSlot(slot: FrameSlot, comment?: string): void {
    this.emit(ILOpcode.DEC_BYTE, [createSlotOperand(slot)], comment);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Bitwise Operations with Slots
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Bitwise AND accumulator with slot.
   *
   * @param slot - Source slot
   * @param comment - Optional comment
   */
  andSlot(slot: FrameSlot, comment?: string): void {
    this.emit(ILOpcode.AND_BYTE, [createSlotOperand(slot)], comment);
  }

  /**
   * Bitwise OR accumulator with slot.
   *
   * @param slot - Source slot
   * @param comment - Optional comment
   */
  orSlot(slot: FrameSlot, comment?: string): void {
    this.emit(ILOpcode.OR_BYTE, [createSlotOperand(slot)], comment);
  }

  /**
   * Bitwise XOR accumulator with slot.
   *
   * @param slot - Source slot
   * @param comment - Optional comment
   */
  xorSlot(slot: FrameSlot, comment?: string): void {
    this.emit(ILOpcode.XOR_BYTE, [createSlotOperand(slot)], comment);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Bitwise Operations with Immediates
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Bitwise AND accumulator with immediate.
   *
   * @param value - Byte value (0-255)
   * @param comment - Optional comment
   */
  andImm(value: number, comment?: string): void {
    this.emit(ILOpcode.AND_IMM, [createImmediateOperand(value)], comment);
  }

  /**
   * Bitwise OR accumulator with immediate.
   *
   * @param value - Byte value (0-255)
   * @param comment - Optional comment
   */
  orImm(value: number, comment?: string): void {
    this.emit(ILOpcode.OR_IMM, [createImmediateOperand(value)], comment);
  }

  /**
   * Bitwise XOR accumulator with immediate.
   *
   * @param value - Byte value (0-255)
   * @param comment - Optional comment
   */
  xorImm(value: number, comment?: string): void {
    this.emit(ILOpcode.XOR_IMM, [createImmediateOperand(value)], comment);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Unary Bitwise Operations
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Bitwise NOT accumulator.
   *
   * @param comment - Optional comment
   */
  not(comment?: string): void {
    this.emit(ILOpcode.NOT_BYTE, [], comment);
  }

  /**
   * Shift accumulator left by count.
   *
   * @param count - Number of positions to shift
   * @param comment - Optional comment
   */
  shl(count: number, comment?: string): void {
    this.emit(ILOpcode.SHL_BYTE, [createImmediateOperand(count)], comment);
  }

  /**
   * Shift accumulator right by count.
   *
   * @param count - Number of positions to shift
   * @param comment - Optional comment
   */
  shr(count: number, comment?: string): void {
    this.emit(ILOpcode.SHR_BYTE, [createImmediateOperand(count)], comment);
  }
}