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
    // Mark this as Y-indexed addressing (property defined on SlotOperand)
    const indexedOperand = { ...operand, indexedByY: true as const };
    this.emit(ILOpcode.LOAD_BYTE, [indexedOperand], comment);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Indirect Addressing (ZP pointer $FB/$FC)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Store A:X word to the zero-page pointer at $FB/$FC.
   *
   * Used for indirect addressing: after computing a 16-bit address
   * in A:X, this stores it to the ZP pointer for subsequent
   * POKE_INDIRECT or PEEK_INDIRECT operations.
   *
   * 6502: STA $FB / STX $FC
   *
   * @param comment - Optional comment
   */
  storeZpPtr(comment?: string): void {
    this.emit(ILOpcode.STORE_ZP_PTR, [], comment ?? 'store A:X → ZP ptr');
  }

  /**
   * Indirect poke: store A through the ZP pointer ($FB/$FC).
   *
   * Writes the accumulator through the zero-page pointer using
   * 6502 indirect indexed addressing: LDY #0 / STA ($FB),Y.
   *
   * @param comment - Optional comment
   */
  pokeIndirect(comment?: string): void {
    this.emit(ILOpcode.POKE_INDIRECT, [], comment ?? 'STA ($FB),Y');
  }

  /**
   * Indirect peek: load A through the ZP pointer ($FB/$FC).
   *
   * Reads a byte through the zero-page pointer using 6502
   * indirect indexed addressing: LDY #0 / LDA ($FB),Y.
   *
   * @param comment - Optional comment
   */
  peekIndirect(comment?: string): void {
    this.emit(ILOpcode.PEEK_INDIRECT, [], comment ?? 'LDA ($FB),Y');
  }

  /**
   * Indirect pokew: store A:X (word) through the ZP pointer ($FB/$FC).
   *
   * Writes a 16-bit value through the zero-page pointer:
   * - Low byte (A) at ($FB),Y with Y=0
   * - High byte (X→A) at ($FB),Y with Y=1
   *
   * @param comment - Optional comment
   */
  pokewIndirect(comment?: string): void {
    this.emit(ILOpcode.POKEW_INDIRECT, [], comment ?? 'STW ($FB) A:X');
  }

  /**
   * Indirect peekw: load A:X (word) through the ZP pointer ($FB/$FC).
   *
   * Reads a 16-bit value through the zero-page pointer:
   * - High byte at ($FB),Y=1 → X
   * - Low byte at ($FB),Y=0 → A
   * Result: low in A, high in X.
   *
   * @param comment - Optional comment
   */
  peekwIndirect(comment?: string): void {
    this.emit(ILOpcode.PEEKW_INDIRECT, [], comment ?? 'LDW ($FB) → A:X');
  }
}
