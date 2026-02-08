/**
 * IL Values - Virtual Registers, Constants, and Labels
 *
 * This module defines the value types used in IL instructions:
 * - VirtualRegister: Named storage locations (unlimited, allocated by code generator)
 * - ILConstant: Compile-time constant values
 * - ILLabel: Control flow targets for jumps and branches
 *
 * Key Design Decisions:
 * - Virtual registers are unlimited (code generator maps to A/X/Y)
 * - Each register has an associated type for type-safe IL
 * - Labels are separate from registers for clean control flow
 * - Factory class manages ID allocation and ensures uniqueness
 *
 * @module il/values
 */

import type { ILType } from './types.js';

/**
 * Virtual Register - represents a storage location in IL
 *
 * Virtual registers are used in SSA form where each definition creates
 * a new register. The code generator will later allocate these to
 * the actual 6502 registers (A, X, Y) or memory locations.
 *
 * @example
 * ```typescript
 * // Create a register for a byte value
 * const v0 = new VirtualRegister(0, IL_BYTE, 'counter');
 * v0.toString() // "v0:counter"
 *
 * // Create an anonymous register
 * const v1 = new VirtualRegister(1, IL_WORD);
 * v1.toString() // "v1"
 * ```
 */
export class VirtualRegister {
  /**
   * Creates a new virtual register.
   *
   * @param id - Unique numeric identifier for this register
   * @param type - IL type of values stored in this register
   * @param name - Optional name (usually the original variable name for debugging)
   */
  constructor(
    public readonly id: number,
    public readonly type: ILType,
    public readonly name?: string,
  ) {}

  /**
   * Returns a string representation for debugging.
   *
   * Format: "v{id}:{name}" if name is provided, "v{id}" otherwise.
   *
   * @returns String representation of this register
   */
  toString(): string {
    return this.name ? `v${this.id}:${this.name}` : `v${this.id}`;
  }

  /**
   * Checks equality with another register.
   *
   * Two registers are equal if they have the same ID.
   *
   * @param other - Register to compare with
   * @returns true if registers have the same ID
   */
  equals(other: VirtualRegister): boolean {
    return this.id === other.id;
  }
}

/**
 * IL Constant - represents a compile-time constant value
 *
 * Constants are immediate values that can be used directly in IL instructions.
 * They carry type information for type checking and code generation.
 */
export interface ILConstant {
  /** Discriminator for type guards */
  readonly kind: 'constant';

  /** The constant's numeric value */
  readonly value: number;

  /** IL type of this constant */
  readonly type: ILType;
}

/**
 * IL Label - represents a control flow target
 *
 * Labels are used as targets for jump and branch instructions.
 * Each label has a unique name and is associated with a basic block.
 */
export interface ILLabel {
  /** Discriminator for type guards */
  readonly kind: 'label';

  /** Label name (must be unique within a function) */
  readonly name: string;

  /** ID of the basic block this label points to */
  readonly blockId: number;
}

/**
 * IL Value - union type for all values that can be used in instructions
 *
 * An IL value can be:
 * - VirtualRegister: A storage location
 * - ILConstant: An immediate constant
 * - ILLabel: A control flow target
 */
export type ILValue = VirtualRegister | ILConstant | ILLabel;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard for VirtualRegister.
 *
 * @param value - Value to check
 * @returns true if value is a VirtualRegister
 */
export function isVirtualRegister(value: ILValue): value is VirtualRegister {
  return value instanceof VirtualRegister;
}

/**
 * Type guard for ILConstant.
 *
 * @param value - Value to check
 * @returns true if value is an ILConstant
 */
export function isILConstant(value: ILValue): value is ILConstant {
  return typeof value === 'object' && 'kind' in value && value.kind === 'constant';
}

/**
 * Type guard for ILLabel.
 *
 * @param value - Value to check
 * @returns true if value is an ILLabel
 */
export function isILLabel(value: ILValue): value is ILLabel {
  return typeof value === 'object' && 'kind' in value && value.kind === 'label';
}

// =============================================================================
// Value Factory
// =============================================================================

/**
 * Factory for creating IL values with managed ID allocation.
 *
 * The factory ensures unique IDs for registers and labels within a scope.
 * Typically one factory is created per function to manage local values.
 *
 * @example
 * ```typescript
 * const factory = new ILValueFactory();
 *
 * // Create registers
 * const v0 = factory.createRegister(IL_BYTE, 'x');
 * const v1 = factory.createRegister(IL_WORD);
 *
 * // Create constants
 * const c42 = factory.createConstant(42, IL_BYTE);
 *
 * // Create labels
 * const loopStart = factory.createLabel('loop_start');
 * const loopEnd = factory.createUniqueLabel('loop_end');
 * ```
 */
export class ILValueFactory {
  /** Next available register ID */
  protected nextRegisterId = 0;

  /** Next available label ID */
  protected nextLabelId = 0;

  /**
   * Creates a new virtual register with a unique ID.
   *
   * @param type - IL type for the register
   * @param name - Optional name for debugging (usually original variable name)
   * @returns A new VirtualRegister with unique ID
   */
  createRegister(type: ILType, name?: string): VirtualRegister {
    return new VirtualRegister(this.nextRegisterId++, type, name);
  }

  /**
   * Creates a constant value.
   *
   * Constants don't need unique IDs - they are identified by their value and type.
   *
   * @param value - Numeric value of the constant
   * @param type - IL type of the constant
   * @returns A new ILConstant
   */
  createConstant(value: number, type: ILType): ILConstant {
    return Object.freeze({
      kind: 'constant' as const,
      value,
      type,
    });
  }

  /**
   * Creates a label with a specific name.
   *
   * The label is assigned the next available block ID.
   * Use this when you need a specific, meaningful label name.
   *
   * @param name - Name for the label
   * @returns A new ILLabel
   */
  createLabel(name: string): ILLabel {
    return Object.freeze({
      kind: 'label' as const,
      name,
      blockId: this.nextLabelId++,
    });
  }

  /**
   * Creates a label with an auto-generated unique suffix.
   *
   * This is useful when you need multiple labels with the same prefix
   * (e.g., multiple loop constructs generating "loop_start" labels).
   *
   * @param prefix - Prefix for the label name
   * @returns A new ILLabel with name "{prefix}_{id}"
   */
  createUniqueLabel(prefix: string): ILLabel {
    const id = this.nextLabelId++;
    return Object.freeze({
      kind: 'label' as const,
      name: `${prefix}_${id}`,
      blockId: id,
    });
  }

  /**
   * Creates a label with a specific block ID.
   *
   * This is useful when creating labels that reference existing blocks.
   * Does not increment the internal label ID counter.
   *
   * @param name - Name for the label
   * @param blockId - ID of the block this label references
   * @returns A new ILLabel with the specified block ID
   */
  createLabelForBlock(name: string, blockId: number): ILLabel {
    return Object.freeze({
      kind: 'label' as const,
      name,
      blockId,
    });
  }

  /**
   * Resets all ID counters to zero.
   *
   * Useful for testing or when starting a new compilation unit.
   */
  reset(): void {
    this.nextRegisterId = 0;
    this.nextLabelId = 0;
  }

  /**
   * Gets the next register ID that would be assigned.
   *
   * Useful for checking how many registers have been allocated.
   *
   * @returns The next register ID
   */
  getNextRegisterId(): number {
    return this.nextRegisterId;
  }

  /**
   * Gets the next label ID that would be assigned.
   *
   * Useful for checking how many labels have been created.
   *
   * @returns The next label ID
   */
  getNextLabelId(): number {
    return this.nextLabelId;
  }

  /**
   * Gets the current count of allocated registers.
   *
   * @returns Number of registers allocated so far
   */
  getRegisterCount(): number {
    return this.nextRegisterId;
  }

  /**
   * Gets the current count of created labels.
   *
   * @returns Number of labels created so far
   */
  getLabelCount(): number {
    return this.nextLabelId;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Returns a string representation of an IL value for debugging.
 *
 * @param value - IL value to convert to string
 * @returns Human-readable string representation
 *
 * @example
 * ```typescript
 * valueToString(new VirtualRegister(0, IL_BYTE)) // "v0"
 * valueToString({ kind: 'constant', value: 42, type: IL_BYTE }) // "42"
 * valueToString({ kind: 'label', name: 'loop', blockId: 1 }) // "label:loop"
 * ```
 */
export function valueToString(value: ILValue): string {
  if (isVirtualRegister(value)) {
    return value.toString();
  }
  if (isILConstant(value)) {
    return value.value.toString();
  }
  if (isILLabel(value)) {
    return `label:${value.name}`;
  }
  return 'unknown';
}

/**
 * Gets the IL type of a value.
 *
 * For registers and constants, returns their type.
 * For labels, returns undefined (labels don't have a value type).
 *
 * @param value - IL value to get type of
 * @returns The IL type, or undefined for labels
 */
export function getValueType(value: ILValue): ILType | undefined {
  if (isVirtualRegister(value)) {
    return value.type;
  }
  if (isILConstant(value)) {
    return value.type;
  }
  return undefined;
}