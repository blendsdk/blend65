/**
 * Target Configuration Interfaces
 *
 * Defines the configuration structure for target architectures.
 * Each target (C64, C128, X16, etc.) provides a TargetConfig that
 * describes its hardware characteristics.
 *
 * **Configuration Components:**
 * - Zero-page configuration (reserved ranges, safe allocation area)
 * - Graphics chip configuration (VIC-II, VDC, VERA)
 * - Sound chip configuration (SID, YM2151, PSG)
 * - Memory map configuration (RAM, ROM, I/O)
 *
 * This configuration drives:
 * - Zero-page allocation decisions in M6502HintAnalyzer
 * - Hardware-specific optimizations
 * - Cycle timing calculations
 * - Memory layout decisions
 *
 * @example
 * ```typescript
 * import type { TargetConfig } from './config.js';
 * import { TargetArchitecture, CPUType } from './architecture.js';
 *
 * const config: TargetConfig = {
 *   architecture: TargetArchitecture.C64,
 *   cpu: CPUType.MOS6502,
 *   clockSpeedMHz: 0.985,
 *   totalMemory: 65536,
 *   zeroPage: { ... },
 *   graphicsChip: { ... },
 *   soundChip: { ... },
 *   implemented: true,
 * };
 * ```
 */

import type { TargetArchitecture, CPUType } from './architecture.js';

/**
 * Zero-page reserved range
 *
 * Describes a contiguous range of zero-page addresses that
 * CANNOT be used for user variables. These are reserved by
 * the system (KERNAL, BASIC, hardware I/O).
 *
 * Using reserved addresses will crash the system or corrupt
 * system state.
 *
 * @example
 * ```typescript
 * // C64 CPU I/O port at $00-$01
 * const cpuPort: ReservedZeroPageRange = {
 *   start: 0x00,
 *   end: 0x01,
 *   reason: 'CPU memory configuration registers (6510 I/O port)',
 * };
 * ```
 */
export interface ReservedZeroPageRange {
  /**
   * Start address (inclusive)
   *
   * First byte of the reserved range.
   * Must be in range 0x00-0xFF.
   */
  start: number;

  /**
   * End address (inclusive)
   *
   * Last byte of the reserved range.
   * Must be >= start and <= 0xFF.
   */
  end: number;

  /**
   * Human-readable reason why this range is reserved
   *
   * Used in error messages to help developers understand
   * why their allocation failed.
   *
   * @example
   * - "CPU memory configuration registers (6510 I/O port)"
   * - "KERNAL workspace (used by BASIC/KERNAL routines)"
   */
  reason: string;
}

/**
 * Zero-page configuration for a target
 *
 * Defines which zero-page addresses are safe to use for
 * user variables and which are reserved by the system.
 *
 * **Critical for Optimization:**
 * Zero-page access is faster (3 cycles vs 4 for absolute),
 * so the compiler prioritizes high-value variables for ZP.
 *
 * **Target-Dependent:**
 * Each target has different reserved ranges based on its
 * KERNAL, BASIC, and hardware requirements.
 *
 * @example
 * ```typescript
 * // C64 zero-page: $02-$8F safe (142 bytes)
 * const c64ZP: ZeroPageConfig = {
 *   reservedRanges: [
 *     { start: 0x00, end: 0x01, reason: 'CPU I/O port' },
 *     { start: 0x90, end: 0xff, reason: 'KERNAL workspace' },
 *   ],
 *   safeRange: { start: 0x02, end: 0x8f },
 *   usableBytes: 142,
 * };
 * ```
 */
export interface ZeroPageConfig {
  /**
   * Ranges that cannot be used (system reserved)
   *
   * Array of reserved ranges. The analyzer will reject
   * any @zp or @map declarations that overlap these ranges.
   */
  reservedRanges: ReservedZeroPageRange[];

  /**
   * Safe range for user allocation
   *
   * The contiguous range of addresses that are safe for
   * user variables. The compiler will allocate @zp variables
   * within this range.
   */
  safeRange: {
    /** First safe address (inclusive) */
    start: number;
    /** Last safe address (inclusive) */
    end: number;
  };

  /**
   * Total usable bytes
   *
   * Pre-calculated size of the safe range.
   * Should equal: safeRange.end - safeRange.start + 1
   */
  usableBytes: number;
}

/**
 * Graphics chip configuration
 *
 * Describes the graphics hardware of the target system.
 * Used for timing calculations and register validation.
 *
 * **Timing-Critical:**
 * Graphics chips steal CPU cycles during display rendering.
 * The compiler needs to know timing characteristics to
 * generate efficient raster-synchronized code.
 *
 * @example
 * ```typescript
 * // C64 VIC-II configuration
 * const vicII: GraphicsChipConfig = {
 *   name: 'VIC-II',
 *   baseAddress: 0xd000,
 *   cyclesPerLine: 63,
 *   linesPerFrame: 312,
 *   badlinePenalty: 40,
 * };
 * ```
 */
export interface GraphicsChipConfig {
  /**
   * Chip name (VIC-II, VDC, VERA)
   *
   * Human-readable name for error messages and documentation.
   */
  name: string;

  /**
   * Base register address
   *
   * Starting address of the chip's register bank.
   * - VIC-II: $D000
   * - VDC: $D600
   * - VERA: $9F20
   */
  baseAddress: number;

  /**
   * Cycles per raster line
   *
   * CPU cycles available per horizontal scan line.
   * Used for cycle-accurate timing calculations.
   *
   * - C64 PAL: 63 cycles
   * - C64 NTSC: 65 cycles
   * - X16: Many more (40 MHz CPU!)
   */
  cyclesPerLine: number;

  /**
   * Lines per frame
   *
   * Total scan lines in one video frame.
   * Used for frame timing calculations.
   *
   * - PAL: 312 lines
   * - NTSC: 262 lines
   */
  linesPerFrame: number;

  /**
   * Badline cycle penalty
   *
   * CPU cycles stolen on "bad lines" when the graphics
   * chip accesses character data.
   *
   * - VIC-II: 40 cycles per badline
   * - VDC: Different behavior
   * - VERA: No badlines (40 MHz CPU)
   */
  badlinePenalty: number;
}

/**
 * Sound chip configuration
 *
 * Describes the sound hardware of the target system.
 * Used for resource conflict detection between voices.
 *
 * @example
 * ```typescript
 * // C64 SID configuration
 * const sid: SoundChipConfig = {
 *   name: 'SID',
 *   baseAddress: 0xd400,
 *   voices: 3,
 * };
 * ```
 */
export interface SoundChipConfig {
  /**
   * Chip name (SID, PSG, YM2151)
   *
   * Human-readable name for error messages.
   */
  name: string;

  /**
   * Base register address
   *
   * Starting address of the chip's register bank.
   * - SID: $D400
   * - YM2151: varies
   * - PSG: varies
   */
  baseAddress: number;

  /**
   * Number of voices
   *
   * Sound channels available on the chip.
   * - SID: 3 voices
   * - YM2151: 8 voices
   * - PSG: 4 voices
   */
  voices: number;
}

/**
 * Memory region configuration
 *
 * Describes a significant memory region for the target.
 * Used for memory map documentation and validation.
 */
export interface MemoryRegion {
  /**
   * Region name
   *
   * Human-readable name (e.g., "RAM", "KERNAL ROM", "I/O")
   */
  name: string;

  /**
   * Start address (inclusive)
   */
  start: number;

  /**
   * End address (inclusive)
   */
  end: number;

  /**
   * Region type
   *
   * - 'ram': Read/write memory
   * - 'rom': Read-only memory
   * - 'io': Hardware I/O registers
   */
  type: 'ram' | 'rom' | 'io';

  /**
   * Whether this region is always visible
   *
   * Some regions are bank-switched and not always accessible.
   */
  alwaysVisible: boolean;
}

/**
 * Complete target configuration
 *
 * Contains all hardware configuration for a target architecture.
 * This is the main configuration object used throughout the compiler.
 *
 * **Usage:**
 * - Obtained via TargetRegistry.getConfig(architecture)
 * - Passed to AdvancedAnalyzer for target-specific analysis
 * - Used by M6502HintAnalyzer for zero-page decisions
 *
 * @example
 * ```typescript
 * const config = getTargetConfig(TargetArchitecture.C64);
 *
 * // Check if address is in safe zero-page
 * const isSafe = addr >= config.zeroPage.safeRange.start
 *             && addr <= config.zeroPage.safeRange.end;
 * ```
 */
export interface TargetConfig {
  /**
   * Target architecture identifier
   *
   * Identifies which target this config is for.
   */
  architecture: TargetArchitecture;

  /**
   * CPU type
   *
   * Identifies the CPU variant for opcode selection.
   */
  cpu: CPUType;

  /**
   * Clock speed in MHz
   *
   * Used for cycle timing calculations.
   * - C64 PAL: 0.985 MHz
   * - C64 NTSC: 1.023 MHz
   * - X16: 8 MHz (up to 40 MHz effective)
   */
  clockSpeedMHz: number;

  /**
   * Total addressable memory in bytes
   *
   * - C64: 65536 (64K)
   * - C128: 131072+ (128K+)
   * - X16: Up to 2MB (banked)
   */
  totalMemory: number;

  /**
   * Zero-page configuration
   *
   * Defines reserved ranges and safe allocation area.
   */
  zeroPage: ZeroPageConfig;

  /**
   * Graphics chip configuration (null if none)
   *
   * Most 6502 systems have a graphics chip.
   * Set to null for headless systems.
   */
  graphicsChip: GraphicsChipConfig | null;

  /**
   * Sound chip configuration (null if none)
   *
   * Most 6502 systems have a sound chip.
   * Set to null for systems without sound.
   */
  soundChip: SoundChipConfig | null;

  /**
   * Memory regions (optional)
   *
   * Significant memory regions for documentation
   * and validation purposes.
   */
  memoryRegions?: MemoryRegion[];

  /**
   * Whether target is fully implemented
   *
   * If false, the compiler will reject this target
   * with a "not yet implemented" error.
   */
  implemented: boolean;
}

/**
 * Validate a target configuration
 *
 * Checks that the configuration is internally consistent:
 * - Reserved ranges don't overlap
 * - Safe range doesn't overlap reserved ranges
 * - Usable bytes matches safe range size
 * - Addresses are in valid ranges
 *
 * @param config - Configuration to validate
 * @returns Array of error messages (empty if valid)
 *
 * @example
 * ```typescript
 * const errors = validateTargetConfig(myConfig);
 * if (errors.length > 0) {
 *   console.error('Invalid config:', errors);
 * }
 * ```
 */
export function validateTargetConfig(config: TargetConfig): string[] {
  const errors: string[] = [];

  // Validate zero-page configuration
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
    if (
      range.start <= zp.safeRange.end &&
      range.end >= zp.safeRange.start
    ) {
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
 * Utility function to check if a specific address is reserved
 * according to the target configuration.
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
  address: number
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
  size: number
): boolean {
  const endAddress = address + size - 1;
  return (
    address >= config.zeroPage.safeRange.start &&
    endAddress <= config.zeroPage.safeRange.end
  );
}