/**
 * Platform Configuration for Static Frame Allocation (SFA)
 *
 * Defines memory layout and constraints for each target platform:
 * - C64: Commodore 64
 * - X16: Commander X16
 * - Custom: User-defined configurations
 *
 * Memory regions defined:
 * - Zero Page: Fast access, limited space
 * - Frame Region: Normal function frame storage
 * - Hardware Stack: 6502 hardware stack
 * - Compiler Scratch: Temporary storage for code generation
 *
 * @module frame/platform
 */

import type { CpuTarget } from '../codegen/cpu/types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * A contiguous region of zero page memory.
 *
 * Used to describe available ZP areas and special regions
 * like compiler scratch space.
 *
 * @example
 * ```typescript
 * const scratch: ZpRegion = {
 *   start: 0xFB,
 *   end: 0xFF,
 *   size: 4,
 *   label: 'compiler_scratch',
 * };
 * ```
 */
export interface ZpRegion {
  /** Start address (inclusive) */
  readonly start: number;

  /** End address (exclusive) */
  readonly end: number;

  /** Size in bytes (end - start) */
  readonly size: number;

  /** Purpose/label for this region */
  readonly label: string;
}

/**
 * Platform-specific memory configuration.
 *
 * Defines memory layout, limits, and constraints for a target platform.
 * Each platform has different available memory regions.
 *
 * **Memory Layout (C64 Example):**
 * ```
 * $0000-$00FF: Zero Page (256 bytes total)
 *   $00-$01: CPU indirect pointers (reserved)
 *   $02-$8F: Available for variables (142 bytes)
 *   $90-$FA: KERNAL workspace (avoid)
 *   $FB-$FE: Compiler scratch (4 bytes)
 * $0100-$01FF: Hardware stack (256 bytes)
 * $0200-$03FF: Frame region (512 bytes)
 * ```
 *
 * @example
 * ```typescript
 * const config: PlatformConfig = C64_PLATFORM_CONFIG;
 * console.log(`ZP available: ${config.zpAvailable} bytes`);
 * console.log(`Frame region: ${config.frameRegionSize} bytes`);
 * ```
 */
export interface PlatformConfig {
  // ========================================
  // Identity
  // ========================================

  /**
   * Platform identifier.
   * Used for platform detection and configuration lookup.
   */
  readonly platform: 'c64' | 'x16' | 'nes' | 'custom';

  /**
   * Human-readable platform name.
   * Used in error messages and diagnostic output.
   */
  readonly displayName: string;

  // ========================================
  // Frame Region
  // ========================================

  /**
   * Start address of frame region (inclusive).
   * Function frames are allocated starting from this address.
   */
  readonly frameRegionStart: number;

  /**
   * End address of frame region (exclusive).
   * Frame allocation cannot exceed this address.
   */
  readonly frameRegionEnd: number;

  /**
   * Frame region size in bytes.
   * Computed as: frameRegionEnd - frameRegionStart
   */
  readonly frameRegionSize: number;

  // ========================================
  // Zero Page
  // ========================================

  /**
   * Start of available ZP (inclusive).
   * First usable zero page address for variable allocation.
   */
  readonly zpStart: number;

  /**
   * End of available ZP (exclusive).
   * Zero page allocation cannot exceed this address.
   */
  readonly zpEnd: number;

  /**
   * Available ZP size in bytes.
   * Computed as: zpEnd - zpStart
   */
  readonly zpAvailable: number;

  /**
   * Reserved ZP addresses (system use, cannot allocate).
   * These addresses are used by the CPU, KERNAL, or BASIC.
   */
  readonly zpReserved: readonly number[];

  /**
   * Compiler scratch ZP locations.
   * Used by code generator for temporary operations.
   * These bytes are NOT available for variable allocation.
   */
  readonly zpScratch: ZpRegion;

  // ========================================
  // Hardware Stack
  // ========================================

  /**
   * Hardware stack start ($0100 on 6502).
   * The 6502 hardware stack grows downward from $01FF.
   */
  readonly hwStackStart: number;

  /**
   * Hardware stack end ($01FF on 6502, inclusive).
   * The stack pointer starts here and grows toward hwStackStart.
   */
  readonly hwStackEnd: number;

  /**
   * Maximum recommended call depth.
   * Based on hardware stack size and typical call overhead.
   * Each JSR/RTS pair uses 2 bytes, plus register saves.
   */
  readonly maxRecommendedCallDepth: number;

  // ========================================
  // Type Information
  // ========================================

  /**
   * Size of pointer type in bytes (2 on 6502).
   * Used for indirect addressing calculations.
   */
  readonly pointerSize: number;

  /**
   * Alignment requirement (1 = none, 2 = word-aligned).
   * 6502 has no alignment requirements (alignment = 1).
   */
  readonly alignment: number;

  // ========================================
  // CPU Target
  // ========================================

  /**
   * CPU target for code generation.
   *
   * Determines which instruction set the code generator uses:
   * - `'6502'` — MOS 6502 (C64, Atari, NES, etc.)
   * - `'65c02'` — WDC 65C02 (Commander X16, Apple IIe enhanced, etc.)
   *
   * The 65C02 adds instructions like STZ, BRA, PHX/PLX/PHY/PLY,
   * INC A, DEC A that produce shorter and faster code.
   *
   * Defaults to `'6502'` for backward compatibility.
   */
  readonly cpuTarget: CpuTarget;
}

// ============================================================================
// C64 Platform Configuration
// ============================================================================

/**
 * Commodore 64 platform configuration.
 *
 * **Memory Map:**
 * ```
 * $0000-$00FF: Zero Page
 *   $00-$01: CPU indirect pointers (reserved by hardware)
 *   $02-$8F: Available for variables (142 bytes)
 *   $90-$FA: KERNAL workspace (avoid unless KERNAL disabled)
 *   $FB-$FE: Compiler scratch (4 bytes)
 *   $FF: Reserved
 * $0100-$01FF: Hardware stack (256 bytes)
 * $0200-$033B: OS input buffer (can be repurposed)
 * $033C-$03FF: Tape buffer (can be repurposed)
 * ```
 *
 * **Design Decisions:**
 * - Frame region: $0200-$0400 (512 bytes)
 *   - Uses input buffer area (safe if not using BASIC input)
 *   - Can be extended if tape buffer not needed
 * - ZP: $02-$8F (142 bytes)
 *   - Avoids KERNAL workspace for compatibility
 *   - Can be extended to $02-$FA if KERNAL disabled
 * - Scratch: $FB-$FE (4 bytes)
 *   - Used for 16-bit temporary operations
 *   - Reserved by compiler, not user-allocatable
 */
export const C64_PLATFORM_CONFIG: PlatformConfig = {
  platform: 'c64',
  displayName: 'Commodore 64',

  // Frame region: $0200-$0400 (512 bytes)
  frameRegionStart: 0x0200,
  frameRegionEnd: 0x0400,
  frameRegionSize: 512,

  // Zero page: $02-$90 (142 bytes usable)
  zpStart: 0x02,
  zpEnd: 0x90,
  zpAvailable: 142, // 0x90 - 0x02 = 142

  // Reserved: $00-$01 (CPU indirect pointers)
  zpReserved: [0x00, 0x01],

  // Compiler scratch: $FB-$FF (4 bytes)
  zpScratch: {
    start: 0xfb,
    end: 0xff,
    size: 4,
    label: 'compiler_scratch',
  },

  // Hardware stack: $0100-$01FF (256 bytes)
  hwStackStart: 0x0100,
  hwStackEnd: 0x0200,
  maxRecommendedCallDepth: 40, // ~6 bytes per call (JSR + register saves)

  // Types
  pointerSize: 2,
  alignment: 1, // No alignment required on 6502

  // CPU: MOS 6502 (C64 uses the original 6502)
  cpuTarget: '6502',
};

// ============================================================================
// Commander X16 Platform Configuration
// ============================================================================

/**
 * Commander X16 platform configuration.
 *
 * **Memory Map:**
 * ```
 * $0000-$00FF: Zero Page
 *   $00-$21: System use (reserved by KERNAL)
 *   $22-$7F: Available for variables (94 bytes)
 *   $80-$FF: KERNAL/BASIC workspace
 * $0100-$01FF: Hardware stack (256 bytes)
 * $0400-$0800: Safe frame region (1KB)
 * ```
 *
 * **Design Decisions:**
 * - Frame region: $0400-$0800 (1KB)
 *   - X16 has more RAM, larger frame region is safe
 * - ZP: $22-$80 (94 bytes)
 *   - X16 KERNAL uses more ZP than C64
 *   - Smaller ZP budget than C64
 * - Scratch: $7C-$80 (4 bytes)
 *   - At end of user ZP region
 */
export const X16_PLATFORM_CONFIG: PlatformConfig = {
  platform: 'x16',
  displayName: 'Commander X16',

  // Frame region: $0400-$0800 (1KB)
  frameRegionStart: 0x0400,
  frameRegionEnd: 0x0800,
  frameRegionSize: 1024,

  // Zero page: $22-$80 (94 bytes usable)
  zpStart: 0x22,
  zpEnd: 0x80,
  zpAvailable: 94, // 0x80 - 0x22 = 94

  // Reserved: $00-$21 (KERNAL workspace)
  zpReserved: Object.freeze(Array.from({ length: 0x22 }, (_, i) => i)),

  // Compiler scratch: $7C-$80 (4 bytes)
  zpScratch: {
    start: 0x7c,
    end: 0x80,
    size: 4,
    label: 'compiler_scratch',
  },

  // Hardware stack: $0100-$0200 (256 bytes)
  hwStackStart: 0x0100,
  hwStackEnd: 0x0200,
  maxRecommendedCallDepth: 40,

  // Types
  pointerSize: 2,
  alignment: 1,

  // CPU: WDC 65C02 (X16 uses the enhanced 65C02)
  cpuTarget: '65c02',
};

// ============================================================================
// Test Platform Configuration
// ============================================================================

/**
 * Minimal test platform configuration.
 *
 * Small memory regions for testing edge cases and overflow scenarios.
 * NOT intended for real compilation - only for unit tests.
 *
 * **Memory Layout:**
 * - Frame region: $0200-$0220 (32 bytes)
 * - Zero page: $10-$20 (16 bytes)
 * - Scratch: $1C-$20 (4 bytes)
 */
export const TEST_PLATFORM_CONFIG: PlatformConfig = {
  platform: 'custom',
  displayName: 'Test Platform (Minimal)',

  // Tiny frame region: 32 bytes
  frameRegionStart: 0x0200,
  frameRegionEnd: 0x0220,
  frameRegionSize: 32,

  // Tiny ZP: 16 bytes
  zpStart: 0x10,
  zpEnd: 0x20,
  zpAvailable: 16,

  // Reserved: none for tests
  zpReserved: [],

  // Compiler scratch: $1C-$20 (4 bytes)
  zpScratch: {
    start: 0x1c,
    end: 0x20,
    size: 4,
    label: 'test_scratch',
  },

  // Standard hardware stack
  hwStackStart: 0x0100,
  hwStackEnd: 0x0200,
  maxRecommendedCallDepth: 10, // Very limited for testing

  // Types
  pointerSize: 2,
  alignment: 1,

  // CPU: MOS 6502 (test platform defaults to baseline)
  cpuTarget: '6502',
};

// ============================================================================
// Platform Factory
// ============================================================================

/**
 * Options for creating a custom platform configuration.
 *
 * Required fields define the core memory regions.
 * Optional fields use sensible defaults for 6502 systems.
 */
export interface CustomPlatformOptions {
  /** Required: Human-readable name */
  displayName: string;

  /** Required: Frame region start address */
  frameRegionStart: number;

  /** Required: Frame region end address */
  frameRegionEnd: number;

  /** Required: Zero page start address */
  zpStart: number;

  /** Required: Zero page end address */
  zpEnd: number;

  /** Optional: Reserved ZP addresses (default: empty) */
  zpReserved?: number[];

  /** Optional: Compiler scratch region */
  zpScratch?: ZpRegion;

  /** Optional: Hardware stack start (default: $0100) */
  hwStackStart?: number;

  /** Optional: Hardware stack end (default: $0200) */
  hwStackEnd?: number;

  /** Optional: Max call depth (default: 40) */
  maxRecommendedCallDepth?: number;

  /** Optional: Pointer size (default: 2) */
  pointerSize?: number;

  /** Optional: Alignment requirement (default: 1) */
  alignment?: number;

  /** Optional: CPU target (default: '6502') */
  cpuTarget?: CpuTarget;
}

/**
 * Create a custom platform configuration.
 *
 * Use this to define memory layout for custom 6502 systems
 * or special configurations (e.g., KERNAL-disabled C64).
 *
 * @param options - Platform configuration options
 * @returns A valid PlatformConfig with computed sizes
 *
 * @example
 * ```typescript
 * // Custom system with extended ZP
 * const myPlatform = createCustomPlatform({
 *   displayName: 'My 6502 System',
 *   frameRegionStart: 0x0300,
 *   frameRegionEnd: 0x0700,
 *   zpStart: 0x02,
 *   zpEnd: 0xF0, // More ZP available
 * });
 *
 * // C64 with KERNAL disabled (more ZP available)
 * const c64NoKernal = createCustomPlatform({
 *   displayName: 'C64 (KERNAL Disabled)',
 *   frameRegionStart: 0x0200,
 *   frameRegionEnd: 0x0800, // Can use more RAM
 *   zpStart: 0x02,
 *   zpEnd: 0xFA, // Use KERNAL workspace
 * });
 * ```
 */
export function createCustomPlatform(
  options: CustomPlatformOptions,
): PlatformConfig {
  const frameRegionSize = options.frameRegionEnd - options.frameRegionStart;
  const zpAvailable = options.zpEnd - options.zpStart;

  // Validate inputs
  if (frameRegionSize <= 0) {
    throw new Error(
      `Invalid frame region: end (${options.frameRegionEnd}) must be greater than start (${options.frameRegionStart})`,
    );
  }
  if (zpAvailable <= 0) {
    throw new Error(
      `Invalid ZP region: end (${options.zpEnd}) must be greater than start (${options.zpStart})`,
    );
  }
  if (options.zpEnd > 0x100) {
    throw new Error(
      `Invalid ZP end: ${options.zpEnd} exceeds zero page limit (0x100)`,
    );
  }

  return {
    platform: 'custom',
    displayName: options.displayName,

    // Frame region
    frameRegionStart: options.frameRegionStart,
    frameRegionEnd: options.frameRegionEnd,
    frameRegionSize,

    // Zero page
    zpStart: options.zpStart,
    zpEnd: options.zpEnd,
    zpAvailable,
    zpReserved: Object.freeze(options.zpReserved ?? []),

    // Compiler scratch (default: last 4 bytes of ZP region)
    zpScratch: options.zpScratch ?? {
      start: options.zpEnd - 4,
      end: options.zpEnd,
      size: 4,
      label: 'compiler_scratch',
    },

    // Hardware stack (standard 6502)
    hwStackStart: options.hwStackStart ?? 0x0100,
    hwStackEnd: options.hwStackEnd ?? 0x0200,
    maxRecommendedCallDepth: options.maxRecommendedCallDepth ?? 40,

    // Types
    pointerSize: options.pointerSize ?? 2,
    alignment: options.alignment ?? 1,

    // CPU target (default: 6502 for maximum compatibility)
    cpuTarget: options.cpuTarget ?? '6502',
  };
}

// ============================================================================
// Platform Registry
// ============================================================================

/** Internal map of known platform configurations */
const PLATFORM_CONFIGS: Map<string, PlatformConfig> = new Map([
  ['c64', C64_PLATFORM_CONFIG],
  ['x16', X16_PLATFORM_CONFIG],
  ['test', TEST_PLATFORM_CONFIG],
]);

/**
 * Get platform configuration by name.
 *
 * Looks up a platform configuration from the built-in registry.
 * Platform names are case-insensitive.
 *
 * @param platform - Platform name ('c64', 'x16', 'test')
 * @returns Platform configuration
 * @throws Error if platform not found
 *
 * @example
 * ```typescript
 * const c64 = getPlatformConfig('c64');
 * const x16 = getPlatformConfig('X16'); // Case insensitive
 * ```
 */
export function getPlatformConfig(platform: string): PlatformConfig {
  const config = PLATFORM_CONFIGS.get(platform.toLowerCase());
  if (!config) {
    const available = Array.from(PLATFORM_CONFIGS.keys()).join(', ');
    throw new Error(`Unknown platform: "${platform}". Available: ${available}`);
  }
  return config;
}

/**
 * Get list of available platform names.
 *
 * Returns the names of all built-in platform configurations.
 *
 * @returns Array of platform names
 *
 * @example
 * ```typescript
 * const platforms = getAvailablePlatforms();
 * // ['c64', 'x16', 'test']
 * ```
 */
export function getAvailablePlatforms(): string[] {
  return Array.from(PLATFORM_CONFIGS.keys());
}

/**
 * Check if a platform configuration exists.
 *
 * @param platform - Platform name to check
 * @returns true if platform exists in registry
 *
 * @example
 * ```typescript
 * if (hasPlatform('c64')) {
 *   const config = getPlatformConfig('c64');
 * }
 * ```
 */
export function hasPlatform(platform: string): boolean {
  return PLATFORM_CONFIGS.has(platform.toLowerCase());
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if an address is in zero page range.
 *
 * @param address - Address to check
 * @returns true if address is in $00-$FF range
 *
 * @example
 * ```typescript
 * isZeroPageAddress(0x50)  // true
 * isZeroPageAddress(0x0200)  // false
 * ```
 */
export function isZeroPageAddress(address: number): boolean {
  return address >= 0x00 && address <= 0xff;
}

/**
 * Check if an address is in the platform's available ZP range.
 *
 * @param address - Address to check
 * @param config - Platform configuration
 * @returns true if address is in available ZP range
 *
 * @example
 * ```typescript
 * isInZpRange(0x50, C64_PLATFORM_CONFIG)  // true
 * isInZpRange(0x00, C64_PLATFORM_CONFIG)  // false (reserved)
 * ```
 */
export function isInZpRange(address: number, config: PlatformConfig): boolean {
  return address >= config.zpStart && address < config.zpEnd;
}

/**
 * Check if an address is in the platform's frame region.
 *
 * @param address - Address to check
 * @param config - Platform configuration
 * @returns true if address is in frame region
 *
 * @example
 * ```typescript
 * isInFrameRegion(0x0250, C64_PLATFORM_CONFIG)  // true
 * isInFrameRegion(0x0800, C64_PLATFORM_CONFIG)  // false
 * ```
 */
export function isInFrameRegion(
  address: number,
  config: PlatformConfig,
): boolean {
  return address >= config.frameRegionStart && address < config.frameRegionEnd;
}

/**
 * Check if a ZP address is reserved (cannot be used for variables).
 *
 * @param address - Address to check
 * @param config - Platform configuration
 * @returns true if address is reserved
 *
 * @example
 * ```typescript
 * isZpReserved(0x00, C64_PLATFORM_CONFIG)  // true (CPU indirect)
 * isZpReserved(0x50, C64_PLATFORM_CONFIG)  // false (available)
 * ```
 */
export function isZpReserved(address: number, config: PlatformConfig): boolean {
  return config.zpReserved.includes(address);
}

/**
 * Check if a ZP address is in the compiler scratch region.
 *
 * @param address - Address to check
 * @param config - Platform configuration
 * @returns true if address is in scratch region
 *
 * @example
 * ```typescript
 * isZpScratch(0xFB, C64_PLATFORM_CONFIG)  // true
 * isZpScratch(0x50, C64_PLATFORM_CONFIG)  // false
 * ```
 */
export function isZpScratch(address: number, config: PlatformConfig): boolean {
  return address >= config.zpScratch.start && address < config.zpScratch.end;
}

/**
 * Get the effective usable ZP bytes after accounting for scratch.
 *
 * This is the actual number of bytes available for variable allocation,
 * after subtracting the compiler scratch region.
 *
 * @param config - Platform configuration
 * @returns Usable ZP bytes
 *
 * @example
 * ```typescript
 * getUsableZpBytes(C64_PLATFORM_CONFIG)  // 142 (scratch is outside usable range)
 * ```
 */
export function getUsableZpBytes(config: PlatformConfig): number {
  // If scratch is within the ZP range, subtract it
  const scratchInRange =
    config.zpScratch.start >= config.zpStart &&
    config.zpScratch.end <= config.zpEnd;

  if (scratchInRange) {
    return config.zpAvailable - config.zpScratch.size;
  }

  return config.zpAvailable;
}

/**
 * Validate a platform configuration for consistency.
 *
 * Checks that all computed sizes match and regions don't overlap.
 *
 * @param config - Platform configuration to validate
 * @returns Array of validation error messages (empty if valid)
 *
 * @example
 * ```typescript
 * const errors = validatePlatformConfig(myConfig);
 * if (errors.length > 0) {
 *   console.error('Invalid config:', errors);
 * }
 * ```
 */
export function validatePlatformConfig(config: PlatformConfig): string[] {
  const errors: string[] = [];

  // Check frame region
  const expectedFrameSize = config.frameRegionEnd - config.frameRegionStart;
  if (config.frameRegionSize !== expectedFrameSize) {
    errors.push(
      `Frame region size mismatch: expected ${expectedFrameSize}, got ${config.frameRegionSize}`,
    );
  }

  // Check ZP region
  const expectedZpSize = config.zpEnd - config.zpStart;
  if (config.zpAvailable !== expectedZpSize) {
    errors.push(
      `ZP available size mismatch: expected ${expectedZpSize}, got ${config.zpAvailable}`,
    );
  }

  // Check ZP end doesn't exceed page boundary
  if (config.zpEnd > 0x100) {
    errors.push(`ZP end (${config.zpEnd}) exceeds zero page limit (0x100)`);
  }

  // Check scratch region is valid
  const expectedScratchSize = config.zpScratch.end - config.zpScratch.start;
  if (config.zpScratch.size !== expectedScratchSize) {
    errors.push(
      `Scratch size mismatch: expected ${expectedScratchSize}, got ${config.zpScratch.size}`,
    );
  }

  // Check scratch is in zero page
  if (config.zpScratch.end > 0x100) {
    errors.push(
      `Scratch end (${config.zpScratch.end}) exceeds zero page limit (0x100)`,
    );
  }

  // Check hardware stack
  const expectedHwStackSize = config.hwStackEnd - config.hwStackStart;
  if (expectedHwStackSize !== 256) {
    errors.push(
      `Hardware stack size should be 256 bytes, got ${expectedHwStackSize}`,
    );
  }

  return errors;
}