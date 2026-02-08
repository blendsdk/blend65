/**
 * Commodore 64 Target Configuration
 *
 * Full implementation of the C64 target architecture.
 * This is the primary target for the Blend65 compiler.
 *
 * **Hardware Specifications:**
 * - CPU: MOS 6510 (6502 with I/O port at $00-$01)
 * - RAM: 64K
 * - Graphics: VIC-II ($D000-$D3FF)
 * - Sound: SID ($D400-$D7FF)
 * - Clock: 0.985 MHz (PAL) / 1.023 MHz (NTSC)
 *
 * **Zero-Page:**
 * - Reserved: $00-$01 (CPU I/O port)
 * - Reserved: $90-$FF (KERNAL workspace)
 * - Safe: $02-$8F (142 bytes)
 *
 * @see https://www.c64-wiki.com/wiki/Memory_Map
 */

import { TargetArchitecture, CPUType } from '../architecture.js';
import type { TargetConfig, MemoryRegion } from '../config.js';

/**
 * C64 Zero-Page Reserved Ranges
 *
 * **CRITICAL:** Using these addresses will crash the C64 or
 * corrupt system state. The analyzer validates all @zp and
 * @map declarations against these ranges.
 *
 * Reserved ranges:
 * - $00-$01: CPU 6510 I/O port (memory configuration)
 * - $90-$FF: KERNAL workspace (used by BASIC/KERNAL routines)
 */
export const C64_RESERVED_ZERO_PAGE = [
  {
    start: 0x00,
    end: 0x01,
    reason: 'CPU memory configuration registers (6510 I/O port)',
  },
  {
    start: 0x90,
    end: 0xff,
    reason: 'KERNAL workspace (used by BASIC/KERNAL routines)',
  },
] as const;

/**
 * C64 Safe Zero-Page Range
 *
 * The range $02-$8F (142 bytes) is safe for user variables.
 * This is significantly less than the full 256-byte zero-page!
 *
 * The compiler allocates @zp variables within this range,
 * prioritizing high-value variables (hot loops, frequent access).
 */
export const C64_SAFE_ZERO_PAGE = {
  start: 0x02,
  end: 0x8f,
  size: 142, // 0x8F - 0x02 + 1 = 142 bytes
} as const;

/**
 * C64 VIC-II Configuration
 *
 * The VIC-II is the graphics chip in the C64.
 * Understanding its timing is critical for raster effects.
 *
 * **PAL Timing:**
 * - 63 CPU cycles per raster line
 * - 312 lines per frame (50 Hz)
 * - Badlines steal 40 cycles (every 8th line in text mode)
 *
 * **NTSC Timing:**
 * - 65 CPU cycles per raster line
 * - 262 lines per frame (60 Hz)
 */
export const C64_VIC_II_CONFIG = {
  name: 'VIC-II',
  baseAddress: 0xd000,
  cyclesPerLine: 63, // PAL (NTSC: 65)
  linesPerFrame: 312, // PAL (NTSC: 262)
  badlinePenalty: 40, // Cycles stolen on badlines
} as const;

/**
 * C64 SID Configuration
 *
 * The SID (Sound Interface Device) is the legendary
 * sound chip in the C64 with 3 voices and a filter.
 *
 * Register layout at $D400:
 * - Voice 1: $D400-$D406
 * - Voice 2: $D407-$D40D
 * - Voice 3: $D40E-$D414
 * - Filter/Volume: $D415-$D418
 */
export const C64_SID_CONFIG = {
  name: 'SID',
  baseAddress: 0xd400,
  voices: 3,
} as const;

/**
 * C64 Memory Regions
 *
 * The C64 has a complex memory map with bank-switching.
 * This describes the default memory configuration.
 *
 * Default configuration ($37 at $01):
 * - $0000-$9FFF: RAM
 * - $A000-$BFFF: BASIC ROM (can be RAM)
 * - $C000-$CFFF: RAM
 * - $D000-$DFFF: I/O (can be character ROM or RAM)
 * - $E000-$FFFF: KERNAL ROM (can be RAM)
 */
export const C64_MEMORY_REGIONS: MemoryRegion[] = [
  {
    name: 'RAM (Low)',
    start: 0x0000,
    end: 0x9fff,
    type: 'ram',
    alwaysVisible: true,
  },
  {
    name: 'BASIC ROM',
    start: 0xa000,
    end: 0xbfff,
    type: 'rom',
    alwaysVisible: false, // Can be switched to RAM
  },
  {
    name: 'RAM (Upper)',
    start: 0xc000,
    end: 0xcfff,
    type: 'ram',
    alwaysVisible: true,
  },
  {
    name: 'I/O Area',
    start: 0xd000,
    end: 0xdfff,
    type: 'io',
    alwaysVisible: false, // Can be character ROM or RAM
  },
  {
    name: 'KERNAL ROM',
    start: 0xe000,
    end: 0xffff,
    type: 'rom',
    alwaysVisible: false, // Can be switched to RAM
  },
];

/**
 * Complete C64 Target Configuration
 *
 * This configuration is used by:
 * - M6502HintAnalyzer for zero-page validation
 * - AdvancedAnalyzer for target-specific optimizations
 * - Memory layout calculations
 *
 * @example
 * ```typescript
 * import { C64_CONFIG } from './configs/c64.js';
 *
 * // Check if address is safe for @zp
 * const isSafe = addr >= C64_CONFIG.zeroPage.safeRange.start
 *             && addr <= C64_CONFIG.zeroPage.safeRange.end;
 * ```
 */
export const C64_CONFIG: TargetConfig = {
  // Architecture identification
  architecture: TargetArchitecture.C64,
  cpu: CPUType.MOS6502,

  // Timing
  clockSpeedMHz: 0.985, // PAL: 985248 Hz

  // Memory
  totalMemory: 65536, // 64K

  // Zero-page configuration
  zeroPage: {
    reservedRanges: [
      {
        start: 0x00,
        end: 0x01,
        reason: 'CPU memory configuration registers (6510 I/O port)',
      },
      {
        start: 0x90,
        end: 0xff,
        reason: 'KERNAL workspace (used by BASIC/KERNAL routines)',
      },
    ],
    safeRange: {
      start: 0x02,
      end: 0x8f,
    },
    usableBytes: 142, // 0x8F - 0x02 + 1
  },

  // Graphics chip
  graphicsChip: {
    name: 'VIC-II',
    baseAddress: 0xd000,
    cyclesPerLine: 63, // PAL
    linesPerFrame: 312, // PAL
    badlinePenalty: 40,
  },

  // Sound chip
  soundChip: {
    name: 'SID',
    baseAddress: 0xd400,
    voices: 3,
  },

  // Memory regions
  memoryRegions: C64_MEMORY_REGIONS,

  // Implementation status
  implemented: true,
};

/**
 * C64 NTSC Configuration Variant
 *
 * NTSC C64s have slightly different timing:
 * - Faster clock: 1.023 MHz
 * - Different VIC-II timing: 65 cycles/line, 262 lines/frame
 *
 * Use this for NTSC-specific optimization or timing calculations.
 */
export const C64_NTSC_CONFIG: TargetConfig = {
  ...C64_CONFIG,

  // NTSC timing
  clockSpeedMHz: 1.023, // NTSC: 1022727 Hz

  // VIC-II NTSC timing
  graphicsChip: {
    name: 'VIC-II',
    baseAddress: 0xd000,
    cyclesPerLine: 65, // NTSC
    linesPerFrame: 262, // NTSC
    badlinePenalty: 40,
  },
};

/**
 * Get C64 configuration (PAL or NTSC)
 *
 * @param ntsc - True for NTSC variant, false for PAL (default)
 * @returns C64 target configuration
 */
export function getC64Config(ntsc: boolean = false): TargetConfig {
  return ntsc ? C64_NTSC_CONFIG : C64_CONFIG;
}