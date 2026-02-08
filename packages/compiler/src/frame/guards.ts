/**
 * Type Guards for Static Frame Allocation (SFA)
 *
 * Consolidates all type guards and predicate functions for the frame system.
 * Re-exports guards from types.ts and platform.ts, plus provides additional
 * guards for complete type narrowing support.
 *
 * **Categories:**
 * - Slot Kind Guards: Check what kind of slot (parameter, local, return, temp)
 * - Slot Location Guards: Check where slot is allocated (ZP, frame, register)
 * - ZP Directive Guards: Check ZP placement directives (@zp, @ram)
 * - Address Guards: Check address ranges and regions
 * - Validation Guards: Check allocation correctness
 *
 * @module frame/guards
 */

import { FrameSlot } from './types.js';
import { SlotKind, SlotLocation, ZpDirective } from './enums.js';
import { PlatformConfig } from './platform.js';

// ============================================================================
// Re-export existing guards from types.ts
// ============================================================================

export {
  // Slot Kind Guards
  isParameterSlot,
  isLocalSlot,
  isReturnSlot,
  isTemporarySlot,

  // Slot Location Guards
  isZpSlot,
  isFrameRegionSlot,
  isRegisterSlot,

  // ZP Directive Guards
  requiresZp,
  forbiddenFromZp,
  hasNoZpDirective,

  // Allocation Validation
  hasZpAllocationError,

  // Score Calculation
  calculateZpScoreBreakdown,
} from './types.js';

// ============================================================================
// Re-export existing guards from platform.ts
// ============================================================================

export {
  // Address Range Guards
  isZeroPageAddress,
  isInZpRange,
  isInFrameRegion,
  isZpReserved,
  isZpScratch,

  // Platform Utilities
  getUsableZpBytes,
  validatePlatformConfig,
} from './platform.js';

// ============================================================================
// Additional Slot Guards
// ============================================================================

/**
 * Check if slot has been allocated (has a valid address).
 *
 * An unallocated slot has address 0 and location FrameRegion (default).
 * After allocation, these will be updated with real values.
 *
 * @param slot - Slot to check
 * @returns true if slot has been allocated
 *
 * @example
 * ```typescript
 * const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
 * isSlotAllocated(slot)  // false (address is 0)
 *
 * slot.address = 0x0200;
 * isSlotAllocated(slot)  // true
 * ```
 */
export function isSlotAllocated(slot: FrameSlot): boolean {
  // A slot is considered allocated if:
  // 1. It has a non-zero address, OR
  // 2. It's a register slot (address may be 0 but register is set)
  return slot.address !== 0 || slot.location === SlotLocation.Register;
}

/**
 * Check if slot is an array type.
 *
 * @param slot - Slot to check
 * @returns true if slot is an array
 *
 * @example
 * ```typescript
 * isArraySlot(bufferSlot)  // true if arraySize is set
 * isArraySlot(byteSlot)    // false
 * ```
 */
export function isArraySlot(slot: FrameSlot): boolean {
  return slot.isArrayElement && slot.arraySize !== undefined && slot.arraySize > 0;
}

/**
 * Check if slot is a scalar (non-array) type.
 *
 * @param slot - Slot to check
 * @returns true if slot is a scalar (not an array)
 *
 * @example
 * ```typescript
 * isScalarSlot(byteSlot)    // true
 * isScalarSlot(bufferSlot)  // false
 * ```
 */
export function isScalarSlot(slot: FrameSlot): boolean {
  return !slot.isArrayElement;
}

/**
 * Check if slot is a single-byte type.
 *
 * Single-byte slots benefit from ZP allocation due to
 * reduced instruction size for ZP addressing modes.
 *
 * @param slot - Slot to check
 * @returns true if slot is 1 byte
 *
 * @example
 * ```typescript
 * isSingleByteSlot(byteSlot)  // true
 * isSingleByteSlot(wordSlot)  // false
 * ```
 */
export function isSingleByteSlot(slot: FrameSlot): boolean {
  return slot.size === 1;
}

/**
 * Check if slot is a word (2-byte) type.
 *
 * Word slots benefit significantly from ZP allocation
 * due to indirect addressing mode support.
 *
 * @param slot - Slot to check
 * @returns true if slot is 2 bytes
 *
 * @example
 * ```typescript
 * isWordSlot(wordSlot)   // true
 * isWordSlot(byteSlot)   // false
 * ```
 */
export function isWordSlot(slot: FrameSlot): boolean {
  return slot.size === 2;
}

/**
 * Check if slot can fit in zero page.
 *
 * Slots can fit in ZP if:
 * 1. They are not forbidden via @ram directive
 * 2. They are small enough (typically <= 8 bytes for practical use)
 *
 * Note: Arrays > 8 bytes are generally too large for ZP.
 *
 * @param slot - Slot to check
 * @param maxZpSlotSize - Maximum size for ZP allocation (default: 8)
 * @returns true if slot could be placed in ZP
 *
 * @example
 * ```typescript
 * canFitInZp(byteSlot)        // true
 * canFitInZp(largeArraySlot)  // false
 * canFitInZp(ramSlot)         // false (has @ram directive)
 * ```
 */
export function canFitInZp(slot: FrameSlot, maxZpSlotSize: number = 8): boolean {
  // Forbidden via @ram directive
  if (slot.zpDirective === ZpDirective.Ram) {
    return false;
  }

  // Too large for ZP
  if (slot.size > maxZpSlotSize) {
    return false;
  }

  return true;
}

// ============================================================================
// Slot Kind Validation
// ============================================================================

/**
 * Check if a value is a valid SlotKind enum value.
 *
 * @param value - Value to check
 * @returns true if value is a valid SlotKind
 *
 * @example
 * ```typescript
 * isValidSlotKind(SlotKind.Local)  // true
 * isValidSlotKind('invalid')       // false
 * isValidSlotKind(99)              // false
 * ```
 */
export function isValidSlotKind(value: unknown): value is SlotKind {
  if (typeof value !== 'string') return false;
  const validValues: string[] = Object.values(SlotKind);
  return validValues.includes(value);
}

/**
 * Check if a value is a valid SlotLocation enum value.
 *
 * @param value - Value to check
 * @returns true if value is a valid SlotLocation
 *
 * @example
 * ```typescript
 * isValidSlotLocation(SlotLocation.ZeroPage)  // true
 * isValidSlotLocation('invalid')              // false
 * ```
 */
export function isValidSlotLocation(value: unknown): value is SlotLocation {
  if (typeof value !== 'string') return false;
  const validValues: string[] = Object.values(SlotLocation);
  return validValues.includes(value);
}

/**
 * Check if a value is a valid ZpDirective enum value.
 *
 * @param value - Value to check
 * @returns true if value is a valid ZpDirective
 *
 * @example
 * ```typescript
 * isValidZpDirective(ZpDirective.Zp)   // true
 * isValidZpDirective('invalid')        // false
 * ```
 */
export function isValidZpDirective(value: unknown): value is ZpDirective {
  if (typeof value !== 'string') return false;
  const validValues: string[] = Object.values(ZpDirective);
  return validValues.includes(value);
}

// ============================================================================
// Address Validation
// ============================================================================

/**
 * Check if address is valid for a slot location.
 *
 * Validates that the address makes sense for the allocated location:
 * - ZeroPage: Address must be in $00-$FF
 * - FrameRegion: Address must be in platform's frame region
 * - Register: Address is ignored (register name used instead)
 *
 * @param slot - Slot to validate
 * @param config - Platform configuration
 * @returns true if address is valid for the location
 *
 * @example
 * ```typescript
 * const slot = { ...baseSlot, location: SlotLocation.ZeroPage, address: 0x50 };
 * isAddressValidForLocation(slot, C64_PLATFORM_CONFIG)  // true
 *
 * const bad = { ...baseSlot, location: SlotLocation.ZeroPage, address: 0x200 };
 * isAddressValidForLocation(bad, C64_PLATFORM_CONFIG)  // false
 * ```
 */
export function isAddressValidForLocation(
  slot: FrameSlot,
  config: PlatformConfig,
): boolean {
  switch (slot.location) {
    case SlotLocation.ZeroPage:
      // Must be in ZP range
      return slot.address >= 0x00 && slot.address <= 0xff;

    case SlotLocation.FrameRegion:
      // Must be in frame region (or unallocated with address 0)
      if (slot.address === 0) {
        return true; // Not yet allocated
      }
      return (
        slot.address >= config.frameRegionStart &&
        slot.address < config.frameRegionEnd
      );

    case SlotLocation.Register:
      // Address is not used for register slots
      return true;

    default:
      return false;
  }
}

/**
 * Check if slot would overlap with platform's scratch region.
 *
 * Scratch region is reserved for code generator use and cannot
 * be used for variable storage.
 *
 * @param slot - Slot to check
 * @param config - Platform configuration
 * @returns true if slot overlaps with scratch region
 *
 * @example
 * ```typescript
 * const slot = { ...baseSlot, address: 0xFB, size: 2 };
 * overlapsScratchRegion(slot, C64_PLATFORM_CONFIG)  // true
 * ```
 */
export function overlapsScratchRegion(
  slot: FrameSlot,
  config: PlatformConfig,
): boolean {
  // Only check for ZP slots
  if (slot.location !== SlotLocation.ZeroPage) {
    return false;
  }

  const slotEnd = slot.address + slot.size;
  const scratchStart = config.zpScratch.start;
  const scratchEnd = config.zpScratch.end;

  // Check for any overlap
  return slot.address < scratchEnd && slotEnd > scratchStart;
}

/**
 * Check if slot would overlap with reserved ZP addresses.
 *
 * @param slot - Slot to check
 * @param config - Platform configuration
 * @returns true if slot overlaps with reserved addresses
 *
 * @example
 * ```typescript
 * const slot = { ...baseSlot, address: 0x00, size: 2 };
 * overlapsReservedZp(slot, C64_PLATFORM_CONFIG)  // true
 * ```
 */
export function overlapsReservedZp(
  slot: FrameSlot,
  config: PlatformConfig,
): boolean {
  // Only check for ZP slots
  if (slot.location !== SlotLocation.ZeroPage) {
    return false;
  }

  const slotEnd = slot.address + slot.size;

  // Check if any reserved address falls within slot range
  for (const reserved of config.zpReserved) {
    if (reserved >= slot.address && reserved < slotEnd) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Composite Validation
// ============================================================================

/**
 * Fully validate a slot's allocation.
 *
 * Performs comprehensive validation:
 * 1. Address is valid for location
 * 2. @zp directive was honored (if specified)
 * 3. ZP slots don't overlap reserved/scratch
 * 4. Frame slots don't exceed region
 *
 * @param slot - Slot to validate
 * @param config - Platform configuration
 * @returns Object with isValid boolean and array of error messages
 *
 * @example
 * ```typescript
 * const result = validateSlotAllocation(slot, C64_PLATFORM_CONFIG);
 * if (!result.isValid) {
 *   console.error('Allocation errors:', result.errors);
 * }
 * ```
 */
export function validateSlotAllocation(
  slot: FrameSlot,
  config: PlatformConfig,
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check address validity
  if (!isAddressValidForLocation(slot, config)) {
    errors.push(
      `Address ${slot.address.toString(16)} is invalid for location ${slot.location}`,
    );
  }

  // Check @zp directive was honored
  if (slot.zpDirective === ZpDirective.Zp && slot.location !== SlotLocation.ZeroPage) {
    errors.push(
      `Slot "${slot.name}" has @zp directive but was not allocated to zero page`,
    );
  }

  // Check @ram directive was honored
  if (slot.zpDirective === ZpDirective.Ram && slot.location === SlotLocation.ZeroPage) {
    errors.push(
      `Slot "${slot.name}" has @ram directive but was allocated to zero page`,
    );
  }

  // Check ZP slots don't overlap scratch
  if (overlapsScratchRegion(slot, config)) {
    errors.push(
      `Slot "${slot.name}" at ${slot.address.toString(16)} overlaps compiler scratch region`,
    );
  }

  // Check ZP slots don't overlap reserved
  if (overlapsReservedZp(slot, config)) {
    errors.push(
      `Slot "${slot.name}" at ${slot.address.toString(16)} overlaps reserved zero page addresses`,
    );
  }

  // Check frame region slots fit within region
  if (slot.location === SlotLocation.FrameRegion && slot.address !== 0) {
    const slotEnd = slot.address + slot.size;
    if (slotEnd > config.frameRegionEnd) {
      errors.push(
        `Slot "${slot.name}" extends beyond frame region (ends at ${slotEnd.toString(16)}, region ends at ${config.frameRegionEnd.toString(16)})`,
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Utility: Slot Description (for error messages)
// ============================================================================

/**
 * Get a human-readable description of a slot.
 *
 * Useful for error messages and debugging output.
 *
 * @param slot - Slot to describe
 * @returns Human-readable description
 *
 * @example
 * ```typescript
 * describeSlot(slot)
 * // "local 'counter' (byte, 1 bytes) at $0200"
 * ```
 */
export function describeSlot(slot: FrameSlot): string {
  // String enums - use the value directly
  const kindName = slot.kind ?? 'unknown';
  const locationName = slot.location ?? 'unallocated';
  const typeName = slot.type.name ?? 'unknown';

  if (slot.location === SlotLocation.Register && slot.register) {
    return `${kindName} '${slot.name}' (${typeName}, ${slot.size} bytes) in register ${slot.register}`;
  }

  const addressStr = slot.address !== 0 ? `at $${slot.address.toString(16).padStart(4, '0')}` : 'unallocated';
  return `${kindName} '${slot.name}' (${typeName}, ${slot.size} bytes) ${addressStr} [${locationName}]`;
}