/**
 * Frame Types for Static Frame Allocation (SFA)
 *
 * Core type definitions for the frame system:
 * - FrameSlot: Represents a single variable in a function's frame
 * - ZpScoreBreakdown: Debugging info for ZP score calculation
 * - Factory functions and type guards
 *
 * @module frame/types
 */

import { TypeInfo, TypeKind } from '../semantic/types.js';
import { SlotLocation, SlotKind, ZpDirective } from './enums.js';

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * A slot in a function's frame.
 *
 * Each parameter, local variable, and return value gets a slot.
 * The slot tracks:
 * - Basic info: name, kind, type, size
 * - Allocation: location, address, offset
 * - ZP analysis: directive, score, access patterns
 * - Arrays: isArrayElement, arraySize
 *
 * **Allocation Flow:**
 * 1. Semantic analysis creates slots with basic info
 * 2. Access analysis fills in accessCount and maxLoopDepth
 * 3. ZP scoring calculates zpScore
 * 4. Frame allocator sets location, address, offset
 *
 * @example
 * ```typescript
 * // A byte parameter slot
 * const slot: FrameSlot = {
 *   name: 'x',
 *   kind: SlotKind.Parameter,
 *   type: BUILTIN_TYPES.BYTE,
 *   size: 1,
 *   zpDirective: ZpDirective.None,
 *   location: SlotLocation.FrameRegion,
 *   address: 0x0200,
 *   offset: 0,
 *   accessCount: 5,
 *   maxLoopDepth: 2,
 *   zpScore: 0,
 *   isArrayElement: false,
 * };
 * ```
 */
export interface FrameSlot {
  // ========================================
  // Basic Information (readonly after creation)
  // ========================================

  /**
   * Slot name (variable/parameter name).
   * For return slots, this is '__return'.
   * For temporaries, this is '__temp_N'.
   */
  readonly name: string;

  /**
   * Kind of slot (parameter, local, return, temporary).
   * Determines allocation order within frame.
   */
  readonly kind: SlotKind;

  /**
   * Type information from semantic analysis.
   * Used for size calculation and type checking.
   */
  readonly type: TypeInfo;

  /**
   * Size in bytes.
   * - byte/bool: 1
   * - word: 2
   * - array: elementSize * count
   */
  readonly size: number;

  // ========================================
  // Zero Page Handling
  // ========================================

  /**
   * Zero page directive from source code annotation.
   * - None: compiler decides based on scoring (deterministic)
   * - Zp: MUST be in ZP, error if impossible (@zp)
   * - Ram: MUST be in RAM, never in ZP (@ram)
   */
  readonly zpDirective: ZpDirective;

  // ========================================
  // Allocation Results (mutable - set by allocator)
  // ========================================

  /**
   * Assigned storage location after allocation.
   * Set by the frame allocator.
   */
  location: SlotLocation;

  /**
   * Absolute address after allocation.
   * This is the final memory address used in generated code.
   */
  address: number;

  /**
   * Offset from frame base (for frame region slots).
   * For ZP slots, this is 0 (address is absolute).
   */
  offset: number;

  /**
   * Register name for register-passed parameters.
   * Only set when location === SlotLocation.Register.
   * Values: 'A', 'X', 'Y'
   */
  register?: string;

  // ========================================
  // Analysis Data (mutable - set by analysis)
  // ========================================

  /**
   * Access count from variable usage analysis.
   * Higher count = more likely to benefit from ZP.
   */
  accessCount: number;

  /**
   * Maximum loop nesting depth where this slot is accessed.
   * Variables in deep loops benefit more from ZP placement.
   */
  maxLoopDepth: number;

  /**
   * Computed ZP priority score.
   * Higher score = higher priority for ZP allocation.
   * Set by the ZP scoring algorithm.
   */
  zpScore: number;

  // ========================================
  // Array Handling
  // ========================================

  /**
   * Is this slot part of an array?
   * If true, this represents the array base.
   */
  isArrayElement: boolean;

  /**
   * Array size if this is an array base slot.
   * Undefined for non-array slots.
   */
  arraySize?: number;

  /**
   * ACME assembler label for @data const globals.
   *
   * Propagated from GlobalSlot.dataLabel when the IL builder creates
   * a FrameSlot for a global variable with @data storage class.
   * The code generator uses this label instead of the numeric address
   * for memory operands (e.g., `LDA __data_Module_name,Y`).
   *
   * Only set for @data storage class globals.
   */
  dataLabel?: string;
}

/**
 * Breakdown of ZP score calculation (for debugging).
 *
 * Used to understand why a slot received its ZP score.
 * Helpful for debugging and tuning the ZP allocation algorithm.
 *
 * @example
 * ```typescript
 * const breakdown: ZpScoreBreakdown = {
 *   typeWeight: 50,     // Pointer type, high weight
 *   accessBonus: 30,    // Accessed 15 times (2 * 15)
 *   loopBonus: 40,      // In loop depth 2 (20 * 2)
 *   directiveBonus: 0,  // No @zp directive
 *   totalScore: 120,    // Sum of all components
 * };
 * ```
 */
export interface ZpScoreBreakdown {
  /** Base score from type (pointers high, bytes medium, words low) */
  typeWeight: number;

  /** Bonus from access count (more accesses = higher bonus) */
  accessBonus: number;

  /** Bonus from loop depth (deeper loops = higher bonus) */
  loopBonus: number;

  /** Bonus from @zp directive (10000 for @zp) */
  directiveBonus: number;

  /** Final computed score */
  totalScore: number;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Get size of a type in bytes.
 *
 * Uses TypeInfo to calculate the byte size of any type.
 * For arrays, calculates element size * count.
 *
 * @param type - TypeInfo to get size of
 * @returns Size in bytes
 *
 * @example
 * ```typescript
 * getTypeSize(BUILTIN_TYPES.BYTE)  // 1
 * getTypeSize(BUILTIN_TYPES.WORD)  // 2
 * getTypeSize({ kind: TypeKind.Array, elementCount: 10, elementType: BUILTIN_TYPES.BYTE })  // 10
 * ```
 */
export function getTypeSize(type: TypeInfo): number {
  switch (type.kind) {
    case TypeKind.Byte:
    case TypeKind.Bool:
      return 1;
    case TypeKind.Word:
      return 2;
    case TypeKind.Array:
      if (type.elementType && type.elementCount !== undefined) {
        return getTypeSize(type.elementType) * type.elementCount;
      }
      return 0; // Unsized array
    case TypeKind.Void:
      return 0;
    case TypeKind.String:
      return 2; // Pointer size
    default:
      return type.size || 1;
  }
}

/**
 * Create a new frame slot with sensible defaults.
 *
 * This factory function creates a FrameSlot with all required
 * properties initialized. Allocation-related properties (location,
 * address, offset) are set to default values and will be updated
 * by the frame allocator.
 *
 * @param name - Slot name (variable/parameter name)
 * @param kind - Kind of slot (parameter, local, return, temporary)
 * @param type - TypeInfo for the slot
 * @param options - Optional overrides for any slot property
 * @returns A new FrameSlot with defaults applied
 *
 * @example
 * ```typescript
 * // Create a parameter slot
 * const param = createFrameSlot('x', SlotKind.Parameter, BUILTIN_TYPES.BYTE);
 *
 * // Create a ZP-required local
 * const local = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD, {
 *   zpDirective: ZpDirective.Zp,
 * });
 *
 * // Create a return slot
 * const ret = createFrameSlot('__return', SlotKind.Return, BUILTIN_TYPES.BYTE);
 * ```
 */
export function createFrameSlot(
  name: string,
  kind: SlotKind,
  type: TypeInfo,
  options?: Partial<Omit<FrameSlot, 'name' | 'kind' | 'type'>>
): FrameSlot {
  const size = getTypeSize(type);
  const isArray = type.kind === TypeKind.Array;

  return {
    // Basic info (readonly)
    name,
    kind,
    type,
    size,

    // ZP handling
    zpDirective: ZpDirective.None,

    // Allocation results (to be set later by allocator)
    location: SlotLocation.FrameRegion,
    address: 0,
    offset: 0,

    // Analysis data (to be set by analysis phase)
    accessCount: 0,
    maxLoopDepth: 0,
    zpScore: 0,

    // Array handling
    isArrayElement: isArray,
    arraySize: isArray ? type.elementCount : undefined,

    // Apply overrides (spread after defaults to allow override)
    ...options,
  };
}

/**
 * Create a return value slot.
 *
 * Convenience function for creating the return value slot
 * with the standard '__return' name.
 *
 * @param type - Return type of the function
 * @param options - Optional overrides
 * @returns A new FrameSlot for return value
 *
 * @example
 * ```typescript
 * const returnSlot = createReturnSlot(BUILTIN_TYPES.BYTE);
 * // { name: '__return', kind: SlotKind.Return, type: BUILTIN_TYPES.BYTE, ... }
 * ```
 */
export function createReturnSlot(
  type: TypeInfo,
  options?: Partial<Omit<FrameSlot, 'name' | 'kind' | 'type'>>
): FrameSlot {
  return createFrameSlot('__return', SlotKind.Return, type, options);
}

/**
 * Create a temporary slot.
 *
 * Convenience function for creating compiler-generated
 * temporary slots with auto-generated names.
 *
 * @param index - Temporary index (for naming)
 * @param type - Type of the temporary
 * @param options - Optional overrides
 * @returns A new FrameSlot for temporary storage
 *
 * @example
 * ```typescript
 * const temp = createTemporarySlot(0, BUILTIN_TYPES.WORD);
 * // { name: '__temp_0', kind: SlotKind.Temporary, type: BUILTIN_TYPES.WORD, ... }
 * ```
 */
export function createTemporarySlot(
  index: number,
  type: TypeInfo,
  options?: Partial<Omit<FrameSlot, 'name' | 'kind' | 'type'>>
): FrameSlot {
  return createFrameSlot(`__temp_${index}`, SlotKind.Temporary, type, options);
}

// ============================================================================
// Type Guards - Slot Kind
// ============================================================================

/**
 * Check if slot is a parameter.
 *
 * @param slot - Slot to check
 * @returns true if slot.kind === SlotKind.Parameter
 */
export function isParameterSlot(slot: FrameSlot): boolean {
  return slot.kind === SlotKind.Parameter;
}

/**
 * Check if slot is a local variable.
 *
 * @param slot - Slot to check
 * @returns true if slot.kind === SlotKind.Local
 */
export function isLocalSlot(slot: FrameSlot): boolean {
  return slot.kind === SlotKind.Local;
}

/**
 * Check if slot is the return value.
 *
 * @param slot - Slot to check
 * @returns true if slot.kind === SlotKind.Return
 */
export function isReturnSlot(slot: FrameSlot): boolean {
  return slot.kind === SlotKind.Return;
}

/**
 * Check if slot is a temporary.
 *
 * @param slot - Slot to check
 * @returns true if slot.kind === SlotKind.Temporary
 */
export function isTemporarySlot(slot: FrameSlot): boolean {
  return slot.kind === SlotKind.Temporary;
}

// ============================================================================
// Type Guards - Slot Location
// ============================================================================

/**
 * Check if slot is in zero page.
 *
 * @param slot - Slot to check
 * @returns true if slot.location === SlotLocation.ZeroPage
 */
export function isZpSlot(slot: FrameSlot): boolean {
  return slot.location === SlotLocation.ZeroPage;
}

/**
 * Check if slot is in frame region.
 *
 * @param slot - Slot to check
 * @returns true if slot.location === SlotLocation.FrameRegion
 */
export function isFrameRegionSlot(slot: FrameSlot): boolean {
  return slot.location === SlotLocation.FrameRegion;
}

/**
 * Check if slot is passed via register.
 *
 * @param slot - Slot to check
 * @returns true if slot.location === SlotLocation.Register
 */
export function isRegisterSlot(slot: FrameSlot): boolean {
  return slot.location === SlotLocation.Register;
}

// ============================================================================
// Type Guards - ZP Directive
// ============================================================================

/**
 * Check if slot requires ZP placement (@zp directive).
 *
 * @param slot - Slot to check
 * @returns true if slot.zpDirective === ZpDirective.Zp
 */
export function requiresZp(slot: FrameSlot): boolean {
  return slot.zpDirective === ZpDirective.Zp;
}

/**
 * Check if slot is forbidden from ZP (@ram directive).
 *
 * @param slot - Slot to check
 * @returns true if slot.zpDirective === ZpDirective.Ram
 */
export function forbiddenFromZp(slot: FrameSlot): boolean {
  return slot.zpDirective === ZpDirective.Ram;
}

/**
 * Check if slot has no ZP directive (compiler decides).
 *
 * @param slot - Slot to check
 * @returns true if slot.zpDirective === ZpDirective.None
 */
export function hasNoZpDirective(slot: FrameSlot): boolean {
  return slot.zpDirective === ZpDirective.None;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a slot's ZP allocation should be verified.
 *
 * Returns true if the slot requires ZP (via @zp directive)
 * but was not allocated to ZP. This indicates an allocation error.
 *
 * @param slot - Slot to check
 * @returns true if ZP was required but not allocated
 *
 * @example
 * ```typescript
 * if (hasZpAllocationError(slot)) {
 *   throw new Error(`@zp variable "${slot.name}" could not be allocated to zero page`);
 * }
 * ```
 */
export function hasZpAllocationError(slot: FrameSlot): boolean {
  return requiresZp(slot) && !isZpSlot(slot);
}

/**
 * Calculate ZP score breakdown for debugging.
 *
 * Computes the individual components that make up a slot's ZP score.
 * Useful for understanding and debugging allocation decisions.
 *
 * @param slot - Slot to calculate score breakdown for
 * @returns Breakdown of score components
 *
 * @example
 * ```typescript
 * const breakdown = calculateZpScoreBreakdown(slot);
 * console.log(`Type weight: ${breakdown.typeWeight}`);
 * console.log(`Access bonus: ${breakdown.accessBonus}`);
 * console.log(`Loop bonus: ${breakdown.loopBonus}`);
 * console.log(`Total: ${breakdown.totalScore}`);
 * ```
 */
export function calculateZpScoreBreakdown(slot: FrameSlot): ZpScoreBreakdown {
  // Type weight: pointers/word are more valuable in ZP (indirect addressing)
  let typeWeight = 0;
  switch (slot.type.kind) {
    case TypeKind.Word:
      typeWeight = 50; // Pointers benefit most from ZP indirect addressing
      break;
    case TypeKind.Byte:
      typeWeight = 20; // Bytes benefit less
      break;
    case TypeKind.Bool:
      typeWeight = 10; // Booleans least benefit
      break;
    case TypeKind.Array:
      typeWeight = 5; // Arrays are usually too large for ZP
      break;
    default:
      typeWeight = 0;
  }

  // Access bonus: 2 points per access
  const accessBonus = slot.accessCount * 2;

  // Loop bonus: 20 points per loop depth level
  const loopBonus = slot.maxLoopDepth * 20;

  // Directive bonus: 10000 for @zp to ensure allocation
  const directiveBonus = slot.zpDirective === ZpDirective.Zp ? 10000 : 0;

  const totalScore = typeWeight + accessBonus + loopBonus + directiveBonus;

  return {
    typeWeight,
    accessBonus,
    loopBonus,
    directiveBonus,
    totalScore,
  };
}