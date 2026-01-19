/**
 * C64 Zero-Page Analysis
 *
 * Provides C64-specific zero-page validation and analysis.
 * This module understands the C64's specific zero-page layout.
 *
 * **C64 Zero-Page Layout:**
 * - $00-$01: CPU 6510 I/O port (memory configuration)
 * - $02-$8F: Safe for user programs (142 bytes)
 * - $90-$FF: KERNAL workspace (used by BASIC/KERNAL routines)
 *
 * **CRITICAL:** Using reserved addresses will crash the C64
 * or corrupt system state. This module helps prevent that.
 *
 * @see https://www.c64-wiki.com/wiki/Zero_Page
 */

// Imports removed - not used in this file

/**
 * C64 Zero-Page Address Categories
 */
export enum C64ZeroPageCategory {
  /** CPU I/O port - $00-$01 */
  CPU_IO_PORT = 'cpu_io_port',

  /** Safe for user - $02-$8F */
  USER_SAFE = 'user_safe',

  /** KERNAL workspace - $90-$FF */
  KERNAL_WORKSPACE = 'kernal_workspace',
}

/**
 * Detailed zero-page location info
 */
export interface ZeroPageLocationInfo {
  /** Address */
  address: number;

  /** Category */
  category: C64ZeroPageCategory;

  /** Is it safe to use? */
  isSafe: boolean;

  /** Detailed description */
  description: string;

  /** What uses this location */
  usedBy: string;
}

/**
 * C64 Zero-Page validation result
 */
export interface C64ZeroPageValidationResult {
  /** Is the allocation valid? */
  valid: boolean;

  /** Error message if invalid */
  errorMessage?: string;

  /** Start address */
  startAddress: number;

  /** End address (inclusive) */
  endAddress: number;

  /** Size in bytes */
  size: number;

  /** Any addresses that are problematic */
  problematicAddresses?: number[];
}

/**
 * Detailed C64 zero-page locations
 *
 * This provides more detail than the generic config for
 * better error messages and documentation.
 */
export const C64_ZERO_PAGE_DETAILS: readonly ZeroPageLocationInfo[] = [
  // CPU I/O Port
  {
    address: 0x00,
    category: C64ZeroPageCategory.CPU_IO_PORT,
    isSafe: false,
    description: 'Processor port data direction register',
    usedBy: '6510 CPU',
  },
  {
    address: 0x01,
    category: C64ZeroPageCategory.CPU_IO_PORT,
    isSafe: false,
    description: 'Processor port (memory configuration)',
    usedBy: '6510 CPU',
  },
  // Note: We don't enumerate all safe addresses ($02-$8F) individually
  // We just mark them as safe in the category check
];

/**
 * Check what category a C64 zero-page address belongs to
 *
 * @param address - Address to check (0-255)
 * @returns Category of the address
 */
export function getC64ZeroPageCategory(address: number): C64ZeroPageCategory {
  if (address >= 0x00 && address <= 0x01) {
    return C64ZeroPageCategory.CPU_IO_PORT;
  }
  if (address >= 0x02 && address <= 0x8f) {
    return C64ZeroPageCategory.USER_SAFE;
  }
  // $90-$FF
  return C64ZeroPageCategory.KERNAL_WORKSPACE;
}

/**
 * Get human-readable description for a C64 zero-page category
 *
 * @param category - Category to describe
 * @returns Human-readable description
 */
export function getC64CategoryDescription(category: C64ZeroPageCategory): string {
  switch (category) {
    case C64ZeroPageCategory.CPU_IO_PORT:
      return 'CPU 6510 I/O port (memory configuration registers)';
    case C64ZeroPageCategory.USER_SAFE:
      return 'User-safe area (available for program use)';
    case C64ZeroPageCategory.KERNAL_WORKSPACE:
      return 'KERNAL workspace (used by BASIC/KERNAL routines)';
  }
}

/**
 * Check if a C64 zero-page address is safe to use
 *
 * @param address - Address to check (0-255)
 * @returns True if safe for user programs
 */
export function isC64ZeroPageSafe(address: number): boolean {
  return address >= 0x02 && address <= 0x8f;
}

/**
 * Validate a zero-page allocation for C64
 *
 * Checks that an allocation starting at `address` with `size` bytes
 * doesn't overlap any reserved C64 zero-page areas.
 *
 * @param address - Starting address
 * @param size - Size in bytes
 * @returns Validation result
 *
 * @example
 * ```typescript
 * // Valid allocation
 * validateC64ZeroPageAllocation(0x02, 10); // { valid: true, ... }
 *
 * // Invalid - starts in CPU I/O
 * validateC64ZeroPageAllocation(0x00, 1); // { valid: false, errorMessage: ... }
 *
 * // Invalid - extends into KERNAL
 * validateC64ZeroPageAllocation(0x8F, 2); // { valid: false, errorMessage: ... }
 * ```
 */
export function validateC64ZeroPageAllocation(
  address: number,
  size: number
): C64ZeroPageValidationResult {
  const endAddress = address + size - 1;
  const problematicAddresses: number[] = [];

  // Check each byte in the allocation
  for (let addr = address; addr <= endAddress; addr++) {
    if (!isC64ZeroPageSafe(addr)) {
      problematicAddresses.push(addr);
    }
  }

  if (problematicAddresses.length > 0) {
    // Determine the type of violation
    const firstBad = problematicAddresses[0];
    const category = getC64ZeroPageCategory(firstBad);
    const categoryDesc = getC64CategoryDescription(category);

    let errorMessage: string;

    if (problematicAddresses.length === 1) {
      errorMessage =
        `Zero-page address $${firstBad.toString(16).toUpperCase().padStart(2, '0')} ` +
        `is reserved: ${categoryDesc}. Safe range is $02-$8F.`;
    } else if (address < 0x02) {
      // Starts in reserved area
      errorMessage =
        `Zero-page allocation at $${address.toString(16).toUpperCase().padStart(2, '0')} ` +
        `starts in reserved area: ${categoryDesc}. Safe range is $02-$8F.`;
    } else {
      // Extends into reserved area
      errorMessage =
        `Zero-page allocation at $${address.toString(16).toUpperCase().padStart(2, '0')} ` +
        `with size ${size} extends into reserved area at ` +
        `$${firstBad.toString(16).toUpperCase().padStart(2, '0')}: ${categoryDesc}. ` +
        `Safe range is $02-$8F.`;
    }

    return {
      valid: false,
      errorMessage,
      startAddress: address,
      endAddress,
      size,
      problematicAddresses,
    };
  }

  return {
    valid: true,
    startAddress: address,
    endAddress,
    size,
  };
}

/**
 * Get detailed info for a C64 zero-page address
 *
 * @param address - Address to get info for
 * @returns Detailed info about the address
 */
export function getC64ZeroPageInfo(address: number): ZeroPageLocationInfo {
  // Check if we have specific info
  const specific = C64_ZERO_PAGE_DETAILS.find((info) => info.address === address);
  if (specific) {
    return specific;
  }

  // Generate generic info based on category
  const category = getC64ZeroPageCategory(address);
  const isSafe = category === C64ZeroPageCategory.USER_SAFE;

  let usedBy: string;
  let description: string;

  switch (category) {
    case C64ZeroPageCategory.CPU_IO_PORT:
      usedBy = '6510 CPU';
      description = 'CPU I/O port register';
      break;
    case C64ZeroPageCategory.USER_SAFE:
      usedBy = 'User program';
      description = 'Available for user allocation';
      break;
    case C64ZeroPageCategory.KERNAL_WORKSPACE:
      usedBy = 'KERNAL/BASIC';
      description = 'KERNAL workspace variable';
      break;
  }

  return {
    address,
    category,
    isSafe,
    description,
    usedBy,
  };
}

/**
 * Get available zero-page bytes for C64
 *
 * @returns Number of bytes available (142)
 */
export function getC64AvailableZeroPageBytes(): number {
  return 142; // $02-$8F inclusive
}

/**
 * Get C64 safe zero-page range
 *
 * @returns Start and end addresses
 */
export function getC64SafeZeroPageRange(): { start: number; end: number } {
  return { start: 0x02, end: 0x8f };
}

/**
 * Suggest alternative allocation for an invalid C64 ZP allocation
 *
 * If an allocation is invalid, this suggests a valid location
 * within the safe range.
 *
 * @param size - Size needed in bytes
 * @param preferredAddress - Preferred start address (optional)
 * @returns Suggested address, or null if no space
 */
export function suggestC64ZeroPageAllocation(
  size: number,
  preferredAddress?: number
): number | null {
  const safeStart = 0x02;
  const safeEnd = 0x8f;
  const safeSize = safeEnd - safeStart + 1;

  // Check if allocation even fits
  if (size > safeSize) {
    return null;
  }

  // If preferred address is provided and valid, use it
  if (
    preferredAddress !== undefined &&
    preferredAddress >= safeStart &&
    preferredAddress + size - 1 <= safeEnd
  ) {
    return preferredAddress;
  }

  // Otherwise, start from beginning of safe range
  if (safeStart + size - 1 <= safeEnd) {
    return safeStart;
  }

  return null;
}