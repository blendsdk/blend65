/**
 * IL Operand Types
 *
 * Defines all operand types used by IL instructions.
 * The key innovation is the slot-centric operand which carries
 * full SFA context for optimal code generation.
 *
 * @module il/operands
 */

import { FrameSlot } from '../frame/types.js';
import { AddressingModeHint } from './enums.js';

// ============================================================================
// Slot-Centric Operand (The Key Innovation)
// ============================================================================

/**
 * Slot operand - references a FrameSlot with full context.
 *
 * This is the key innovation: instead of just an address,
 * we carry the complete slot information for optimal code generation.
 * The code generator can make intelligent decisions based on:
 * - Slot location (ZP vs Frame vs Register)
 * - Addressing mode hints
 * - Array indexing information
 *
 * @example
 * ```typescript
 * const slotOp: SlotOperand = {
 *   kind: 'slot',
 *   slot: counterSlot,
 *   addressingHint: AddressingModeHint.ZeroPage,
 * };
 * ```
 */
export interface SlotOperand {
  /** Discriminator for type narrowing */
  readonly kind: 'slot';

  /** Reference to the frame slot */
  readonly slot: FrameSlot;

  /** Pre-computed addressing mode hint */
  readonly addressingHint: AddressingModeHint;

  /** Array index offset (for array element access) */
  readonly indexOffset?: number;

  /** Index variable slot (for dynamic array access) */
  readonly indexSlot?: FrameSlot;
}

// ============================================================================
// Immediate Operand
// ============================================================================

/**
 * Immediate operand - a compile-time constant value.
 *
 * Used for literal values that are known at compile time.
 * Can represent both 8-bit and 16-bit values.
 *
 * @example
 * ```typescript
 * const byteImm: ImmediateOperand = { kind: 'immediate', value: 42, isWord: false };
 * const wordImm: ImmediateOperand = { kind: 'immediate', value: 0x1000, isWord: true };
 * ```
 */
export interface ImmediateOperand {
  /** Discriminator for type narrowing */
  readonly kind: 'immediate';

  /** The constant value (0-255 for byte, 0-65535 for word) */
  readonly value: number;

  /** Whether this is a 16-bit value */
  readonly isWord: boolean;
}

// ============================================================================
// Label Operand
// ============================================================================

/**
 * Label operand - a jump target.
 *
 * Used for control flow instructions (JUMP, JUMP_EQ, etc.).
 * Labels are unique within a function.
 *
 * @example
 * ```typescript
 * const labelOp: LabelOperand = { kind: 'label', name: 'loop_start' };
 * ```
 */
export interface LabelOperand {
  /** Discriminator for type narrowing */
  readonly kind: 'label';

  /** Label name (unique within function) */
  readonly name: string;
}

// ============================================================================
// Function Operand
// ============================================================================

/**
 * Function operand - a function reference for CALL instruction.
 *
 * Contains metadata about the callee for optimization purposes.
 *
 * @example
 * ```typescript
 * const funcOp: FunctionOperand = {
 *   kind: 'function',
 *   name: 'add',
 *   isCallback: false,
 *   coalesceGroup: 1,
 * };
 * ```
 */
export interface FunctionOperand {
  /** Discriminator for type narrowing */
  readonly kind: 'function';

  /** Function name */
  readonly name: string;

  /** Whether this is a callback/ISR */
  readonly isCallback: boolean;

  /** Callee's coalesce group (for optimization hints) */
  readonly coalesceGroup: number;
}

// ============================================================================
// Address Operand
// ============================================================================

/**
 * Address operand - for peek/poke intrinsics.
 *
 * Used when accessing raw memory addresses (hardware registers, etc.).
 * Unlike SlotOperand, this doesn't carry SFA context.
 *
 * @example
 * ```typescript
 * // Hardware register access: $D020 (border color)
 * const addrOp: AddressOperand = {
 *   kind: 'address',
 *   address: 0xD020,
 *   isZeroPage: false,
 * };
 * ```
 */
export interface AddressOperand {
  /** Discriminator for type narrowing */
  readonly kind: 'address';

  /** The memory address */
  readonly address: number;

  /** Whether address is in zero page (0x00-0xFF) */
  readonly isZeroPage: boolean;
}

// ============================================================================
// Union Type
// ============================================================================

/**
 * Union type of all operand kinds.
 *
 * IL instructions use this type for their operands array.
 * Use type guards to narrow down to specific operand types.
 */
export type ILOperand =
  | SlotOperand
  | ImmediateOperand
  | LabelOperand
  | FunctionOperand
  | AddressOperand;