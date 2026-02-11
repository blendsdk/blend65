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

  /**
   * Multiply accumulator by immediate value.
   *
   * @param value - Byte value (0-255)
   * @param comment - Optional comment
   */
  mulImm(value: number, comment?: string): void {
    this.emit(ILOpcode.MUL_IMM, [createImmediateOperand(value)], comment);
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

  /**
   * Increment word slot in place (16-bit).
   *
   * Increments a 16-bit value stored at the slot address.
   * Handles carry propagation from low byte to high byte.
   * 6502: INC slot / BNE +2 / INC slot+1
   *
   * @param slot - Word-sized target slot
   * @param comment - Optional comment
   */
  incWord(slot: FrameSlot, comment?: string): void {
    this.emit(ILOpcode.INC_WORD, [createSlotOperand(slot)], comment);
  }

  /**
   * Decrement word slot in place (16-bit).
   *
   * Decrements a 16-bit value stored at the slot address.
   * Handles borrow propagation from low byte to high byte.
   * 6502: LDA slot / BNE +2 / DEC slot+1 / DEC slot
   *
   * @param slot - Word-sized target slot
   * @param comment - Optional comment
   */
  decWord(slot: FrameSlot, comment?: string): void {
    this.emit(ILOpcode.DEC_WORD, [createSlotOperand(slot)], comment);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Word (16-bit) Arithmetic with Immediates
  // All word operations use A:X convention (low byte in A, high byte in X)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Add immediate word (16-bit) to A:X.
   *
   * Full 16-bit addition: A:X ← A:X + imm16.
   * 6502: CLC / ADC #lo / PHA / TXA / ADC #hi / TAX / PLA
   *
   * @param value - Word value (0-65535)
   * @param comment - Optional comment
   */
  addWordImm(value: number, comment?: string): void {
    this.emit(ILOpcode.ADD_WORD_IMM, [createImmediateOperand(value, true)], comment);
  }

  /**
   * Add immediate byte to A:X with carry propagation.
   *
   * Optimized path when adding a small constant to a word:
   * A:X ← A:X + imm8 (zero-extended).
   * 6502: CLC / ADC #byte / BCC +2 / INX
   *
   * @param value - Byte value (0-255)
   * @param comment - Optional comment
   */
  addWordByteImm(value: number, comment?: string): void {
    this.emit(ILOpcode.ADD_WORD_BYTE_IMM, [createImmediateOperand(value)], comment);
  }

  /**
   * Subtract immediate word (16-bit) from A:X.
   *
   * Full 16-bit subtraction: A:X ← A:X - imm16.
   * 6502: SEC / SBC #lo / PHA / TXA / SBC #hi / TAX / PLA
   *
   * @param value - Word value (0-65535)
   * @param comment - Optional comment
   */
  subWordImm(value: number, comment?: string): void {
    this.emit(ILOpcode.SUB_WORD_IMM, [createImmediateOperand(value, true)], comment);
  }

  /**
   * Subtract immediate byte from A:X with borrow propagation.
   *
   * Optimized path when subtracting a small constant from a word:
   * A:X ← A:X - imm8 (zero-extended).
   * 6502: SEC / SBC #byte / BCS +2 / DEX
   *
   * @param value - Byte value (0-255)
   * @param comment - Optional comment
   */
  subWordByteImm(value: number, comment?: string): void {
    this.emit(ILOpcode.SUB_WORD_BYTE_IMM, [createImmediateOperand(value)], comment);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Word (16-bit) Arithmetic with Slots
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Add word slot (16-bit) to A:X.
   *
   * Full 16-bit addition from a word-sized slot:
   * A:X ← A:X + [slot16].
   * 6502: CLC / ADC slot / PHA / TXA / ADC slot+1 / TAX / PLA
   *
   * @param slot - Word-sized source slot
   * @param comment - Optional comment
   */
  addWordSlot(slot: FrameSlot, comment?: string): void {
    this.emit(ILOpcode.ADD_WORD_SLOT, [createSlotOperand(slot)], comment);
  }

  /**
   * Add byte slot to A:X with carry propagation (zero-extended).
   *
   * Common case: word + byte_variable (e.g., $0400 + i).
   * A:X ← A:X + [slot8].
   * 6502: CLC / ADC slot / BCC +2 / INX
   *
   * @param slot - Byte-sized source slot
   * @param comment - Optional comment
   */
  addWordByteSlot(slot: FrameSlot, comment?: string): void {
    this.emit(ILOpcode.ADD_WORD_BYTE_SLOT, [createSlotOperand(slot)], comment);
  }

  /**
   * Subtract word slot (16-bit) from A:X.
   *
   * Full 16-bit subtraction from a word-sized slot:
   * A:X ← A:X - [slot16].
   * 6502: SEC / SBC slot / PHA / TXA / SBC slot+1 / TAX / PLA
   *
   * @param slot - Word-sized source slot
   * @param comment - Optional comment
   */
  subWordSlot(slot: FrameSlot, comment?: string): void {
    this.emit(ILOpcode.SUB_WORD_SLOT, [createSlotOperand(slot)], comment);
  }

  /**
   * Subtract byte slot from A:X with borrow propagation (zero-extended).
   *
   * A:X ← A:X - [slot8].
   * 6502: SEC / SBC slot / BCS +2 / DEX
   *
   * @param slot - Byte-sized source slot
   * @param comment - Optional comment
   */
  subWordByteSlot(slot: FrameSlot, comment?: string): void {
    this.emit(ILOpcode.SUB_WORD_BYTE_SLOT, [createSlotOperand(slot)], comment);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Type Promotion
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Promote byte in A to word in A:X (zero-extend).
   *
   * Sets X to 0, making the byte value in A into a 16-bit
   * unsigned word in A:X. Used when a byte participates in
   * word arithmetic.
   * 6502: LDX #0
   *
   * @param comment - Optional comment
   */
  promoteByteWord(comment?: string): void {
    this.emit(ILOpcode.PROMOTE_BYTE_WORD, [], comment);
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