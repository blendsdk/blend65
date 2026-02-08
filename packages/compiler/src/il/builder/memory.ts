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

  // ═══════════════════════════════════════════════════════════════════
  // Indexed Array Access
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Load array element at static offset.
   *
   * Creates a virtual slot at base + offset for the load.
   *
   * @param arraySlot - Base array slot
   * @param offset - Static index offset
   * @param comment - Optional comment
   */
  loadIndexedImm(arraySlot: FrameSlot, offset: number, comment?: string): void {
    // Create a modified slot with the computed address
    const elementSlot: FrameSlot = {
      ...arraySlot,
      name: `${arraySlot.name}[${offset}]`,
      address: (arraySlot.address ?? 0) + offset,
      isArrayElement: true,
    };
    this.emit(ILOpcode.LOAD_BYTE, [createSlotOperand(elementSlot)], comment);
  }

  /**
   * Load array element using Y register as index.
   *
   * Emits LOAD_BYTE with an indexed slot operand.
   * The code generator will use Y-indexed addressing.
   *
   * @param arraySlot - Base array slot
   * @param comment - Optional comment
   */
  loadIndexedY(arraySlot: FrameSlot, comment?: string): void {
    // Create an indexed slot operand - the slot's base + Y
    const indexedSlot: FrameSlot = {
      ...arraySlot,
      name: `${arraySlot.name}[Y]`,
      isArrayElement: true,
    };
    const operand = createSlotOperand(indexedSlot);
    // Mark this as Y-indexed addressing
    (operand as any).indexedByY = true;
    this.emit(ILOpcode.LOAD_BYTE, [operand], comment);
  }
}