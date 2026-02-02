/**
 * IL Builder - Memory Operations Layer
 *
 * Adds memory operations to the builder:
 * - Load/store byte from/to slots
 * - Load/store word from/to slots
 * - Load immediate values
 *
 * @module il/builder/memory
 */

import { FrameSlot } from '../../frame/types.js';
import { ILOpcode } from '../enums.js';
import { createSlotOperand, createImmediateOperand } from '../factories.js';
import { ILBuilderBase } from './base.js';

/**
 * Memory operations layer for IL Builder.
 *
 * Extends base with load/store operations for slots and immediates.
 */
export class ILBuilderMemory extends ILBuilderBase {
  // ═══════════════════════════════════════════════════════════════════
  // Load from Slot
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Load byte from slot into accumulator.
   *
   * @param slot - Source slot
   * @param comment - Optional comment
   */
  loadSlot(slot: FrameSlot, comment?: string): void {
    this.emit(ILOpcode.LOAD_BYTE, [createSlotOperand(slot)], comment);
  }

  /**
   * Load word from slot (16-bit).
   *
   * @param slot - Source slot
   * @param comment - Optional comment
   */
  loadSlotWord(slot: FrameSlot, comment?: string): void {
    this.emit(ILOpcode.LOAD_WORD, [createSlotOperand(slot)], comment);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Store to Slot
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Store accumulator to slot.
   *
   * @param slot - Destination slot
   * @param comment - Optional comment
   */
  storeSlot(slot: FrameSlot, comment?: string): void {
    this.emit(ILOpcode.STORE_BYTE, [createSlotOperand(slot)], comment);
  }

  /**
   * Store word to slot (16-bit).
   *
   * @param slot - Destination slot
   * @param comment - Optional comment
   */
  storeSlotWord(slot: FrameSlot, comment?: string): void {
    this.emit(ILOpcode.STORE_WORD, [createSlotOperand(slot)], comment);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Load Immediate
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Load immediate byte value into accumulator.
   *
   * @param value - Byte value (0-255)
   * @param comment - Optional comment
   */
  loadImm(value: number, comment?: string): void {
    this.emit(ILOpcode.LOAD_IMM, [createImmediateOperand(value)], comment);
  }

  /**
   * Load immediate word value (16-bit).
   *
   * @param value - Word value (0-65535)
   * @param comment - Optional comment
   */
  loadImmWord(value: number, comment?: string): void {
    this.emit(ILOpcode.LOAD_IMM_WORD, [createImmediateOperand(value, true)], comment);
  }
}