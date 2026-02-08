/**
 * Target Configuration Interfaces
 *
 * Defines the configuration structure for target architectures.
 * Each target (C64, C128, X16, etc.) provides a TargetConfig that
 * describes its hardware characteristics.
 *
 * @module target/config
 */

import type { TargetArchitecture, CPUType } from './architecture.js';

/**
 * Zero-page reserved range
 *
 * Describes a contiguous range of zero-page addresses that
 * CANNOT be used for user variables.
 */
export interface ReservedZeroPageRange {
  /** Start address (inclusive, 0x00-0xFF) */
  start: number;

  /** End address (inclusive, must be >= start and <= 0xFF) */
  end: number;

  /** Human-readable reason why this range is reserved */
  reason: string;
}

/**
 * Zero-page configuration for a target
 *
 * Defines which zero-page addresses are safe to use for
 * user variables and which are reserved by the system.
 */
export interface ZeroPageConfig {
  /** Ranges that cannot be used (system reserved) */
  reservedRanges: ReservedZeroPageRange[];

  /** Safe range for user allocation */
  safeRange: {
    /** First safe address (inclusive) */
    start: number;
    /** Last safe address (inclusive) */
    end: number;
  };

  /** Total usable bytes (should equal: safeRange.end - safeRange.start + 1) */
  usableBytes: number;
}

/**
 * Graphics chip configuration
 *
 * Describes the graphics hardware of the target system.
 */
export interface GraphicsChipConfig {
  /** Chip name (VIC-II, VDC, VERA) */
  name: string;

  /** Base register address */
  baseAddress: number;

  /** Cycles per raster line */
  cyclesPerLine: number;

  /** Lines per frame */
  linesPerFrame: number;

  /** Badline cycle penalty */
  badlinePenalty: number;
}

/**
 * Sound chip configuration
 *
 * Describes the sound hardware of the target system.
 */
export interface SoundChipConfig {
  /** Chip name (SID, PSG, YM2151) */
  name: string;

  /** Base register address */
  baseAddress: number;

  /** Number of voices */
  voices: number;
}

/**
 * Memory region configuration
 *
 * Describes a significant memory region for the target.
 */
export interface MemoryRegion {
  /** Region name */
  name: string;

  /** Start address (inclusive) */
  start: number;

  /** End address (inclusive) */
  end: number;

  /** Region type */
  type: 'ram' | 'rom' | 'io';

  /** Whether this region is always visible */
  alwaysVisible: boolean;
}

/**
 * Complete target configuration
 *
 * Contains all hardware configuration for a target architecture.
 * This is the main configuration object used throughout the compiler.
 */
export interface TargetConfig {
  /** Target architecture identifier */
  architecture: TargetArchitecture;

  /** CPU type */
  cpu: CPUType;

  /** Clock speed in MHz */
  clockSpeedMHz: number;

  /** Total addressable memory in bytes */
  totalMemory: number;

  /** Zero-page configuration */
  zeroPage: ZeroPageConfig;

  /** Graphics chip configuration (null if none) */
  graphicsChip: GraphicsChipConfig | null;

  /** Sound chip configuration (null if none) */
  soundChip: SoundChipConfig | null;

  /** Memory regions (optional) */
  memoryRegions?: MemoryRegion[];

  /** Whether target is fully implemented */
  implemented: boolean;
}

/**
 * Validate a target configuration
 *
 * Checks that the configuration is internally consistent.
 *
 * @param config - Configuration to validate
 * @returns Array of error messages (empty if valid)
 */
export function validateTargetConfig(config: TargetConfig): string[] {
  const errors: string[] = [];
  const zp = config.zeroPage;

  // Check safe range is valid
  if (zp.safeRange.start > zp.safeRange.end) {
    errors.push(`Safe range start (${zp.safeRange.start}) > end (${zp.safeRange.end})`);
  }

  if (zp.safeRange.start < 0 || zp.safeRange.end > 0xff) {
    errors.push(`Safe range out of zero-page bounds (0x00-0xFF)`);
  }

  // Check usable bytes calculation
  const expectedUsable = zp.safeRange.end - zp.safeRange.start + 1;
  if (zp.usableBytes !== expectedUsable) {
    errors.push(`Usable bytes (${zp.usableBytes}) doesn't match safe range size (${expectedUsable})`);
  }

  // Check reserved ranges
  for (let i = 0; i < zp.reservedRanges.length; i++) {
    const range = zp.reservedRanges[i];

    if (range.start > range.end) {
      errors.push(`Reserved range ${i}: start (${range.start}) > end (${range.end})`);
    }

    if (range.start < 0 || range.end > 0xff) {
      errors.push(`Reserved range ${i}: out of zero-page bounds`);
    }

    // Check for overlap with safe range
    if (range.start <= zp.safeRange.end && range.end >= zp.safeRange.start) {
      errors.push(`Reserved range ${i} overlaps with safe range`);
    }

    // Check for overlap with other reserved ranges
    for (let j = i + 1; j < zp.reservedRanges.length; j++) {
      const other = zp.reservedRanges[j];
      if (range.start <= other.end && range.end >= other.start) {
        errors.push(`Reserved ranges ${i} and ${j} overlap`);
      }
    }
  }

  // Validate graphics chip if present
  if (config.graphicsChip) {
    const gfx = config.graphicsChip;
    if (gfx.baseAddress < 0 || gfx.baseAddress > 0xffff) {
      errors.push(`Graphics chip base address out of range`);
    }
    if (gfx.cyclesPerLine <= 0) {
      errors.push(`Graphics chip cycles per line must be positive`);
    }
    if (gfx.linesPerFrame <= 0) {
      errors.push(`Graphics chip lines per frame must be positive`);
    }
  }

  // Validate sound chip if present
  if (config.soundChip) {
    const snd = config.soundChip;
    if (snd.baseAddress < 0 || snd.baseAddress > 0xffff) {
      errors.push(`Sound chip base address out of range`);
    }
    if (snd.voices <= 0) {
      errors.push(`Sound chip voices must be positive`);
    }
  }

  return errors;
}

/**
 * Check if an address is in a reserved zero-page range
 *
 * @param config - Target configuration
 * @param address - Address to check (0-255)
 * @returns True if address is reserved
 */
export function isAddressReserved(config: TargetConfig, address: number): boolean {
  for (const range of config.zeroPage.reservedRanges) {
    if (address >= range.start && address <= range.end) {
      return true;
    }
  }
  return false;
}

/**
 * Get the reason why an address is reserved
 *
 * @param config - Target configuration
 * @param address - Address to check (0-255)
 * @returns Reason string, or undefined if not reserved
 */
export function getReservationReason(
  config: TargetConfig,
  address: number,
): string | undefined {
  for (const range of config.zeroPage.reservedRanges) {
    if (address >= range.start && address <= range.end) {
      return range.reason;
    }
  }
  return undefined;
}

/**
 * Check if an address is in the safe zero-page range
 *
 * @param config - Target configuration
 * @param address - Address to check (0-255)
 * @returns True if address is in safe range
 */
export function isAddressSafe(config: TargetConfig, address: number): boolean {
  return (
    address >= config.zeroPage.safeRange.start &&
    address <= config.zeroPage.safeRange.end
  );
}

/**
 * Check if an allocation fits in the safe zero-page range
 *
 * @param config - Target configuration
 * @param address - Starting address
 * @param size - Size in bytes
 * @returns True if entire allocation is in safe range
 */
export function doesAllocationFit(
  config: TargetConfig,
  address: number,
  size: number,
): boolean {
  const endAddress = address + size - 1;
  return (
    address >= config.zeroPage.safeRange.start &&
    endAddress <= config.zeroPage.safeRange.end
  );
}
