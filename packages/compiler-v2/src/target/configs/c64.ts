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
 * @see https://www.c64-wiki.com/wiki/Memory_Map
 */

import { TargetArchitecture, CPUType } from '../architecture.js';
import type { TargetConfig, MemoryRegion } from '../config.js';

/**
 * C64 Memory Regions
 *
 * Default configuration ($37 at $01):
 * - $0000-$9FFF: RAM
 * - $A000-$BFFF: BASIC ROM (can be RAM)
 * - $C000-$CFFF: RAM
 * - $D000-$DFFF: I/O (can be character ROM or RAM)
 * - $E000-$FFFF: KERNAL ROM (can be RAM)
 */
export const C64_MEMORY_REGIONS: MemoryRegion[] = [
  { name: 'RAM (Low)', start: 0x0000, end: 0x9fff, type: 'ram', alwaysVisible: true },
  { name: 'BASIC ROM', start: 0xa000, end: 0xbfff, type: 'rom', alwaysVisible: false },
  { name: 'RAM (Upper)', start: 0xc000, end: 0xcfff, type: 'ram', alwaysVisible: true },
  { name: 'I/O Area', start: 0xd000, end: 0xdfff, type: 'io', alwaysVisible: false },
  { name: 'KERNAL ROM', start: 0xe000, end: 0xffff, type: 'rom', alwaysVisible: false },
];

/**
 * Complete C64 Target Configuration (PAL)
 */
export const C64_CONFIG: TargetConfig = {
  architecture: TargetArchitecture.C64,
  cpu: CPUType.MOS6502,
  clockSpeedMHz: 0.985,
  totalMemory: 65536,
  zeroPage: {
    reservedRanges: [
      { start: 0x00, end: 0x01, reason: 'CPU memory configuration registers (6510 I/O port)' },
      { start: 0x90, end: 0xff, reason: 'KERNAL workspace (used by BASIC/KERNAL routines)' },
    ],
    safeRange: { start: 0x02, end: 0x8f },
    usableBytes: 142,
  },
  graphicsChip: {
    name: 'VIC-II',
    baseAddress: 0xd000,
    cyclesPerLine: 63,
    linesPerFrame: 312,
    badlinePenalty: 40,
  },
  soundChip: {
    name: 'SID',
    baseAddress: 0xd400,
    voices: 3,
  },
  memoryRegions: C64_MEMORY_REGIONS,
  implemented: true,
};

/**
 * C64 NTSC Configuration Variant
 */
export const C64_NTSC_CONFIG: TargetConfig = {
  ...C64_CONFIG,
  clockSpeedMHz: 1.023,
  graphicsChip: {
    name: 'VIC-II',
    baseAddress: 0xd000,
    cyclesPerLine: 65,
    linesPerFrame: 262,
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
