/**
 * Target Architecture Definitions
 *
 * Defines supported target architectures and CPU types for the Blend65 compiler.
 * This module provides the foundation for multi-target support, allowing the
 * compiler to generate optimized code for different 6502-based machines.
 *
 * **Architecture Design:**
 * - TargetArchitecture: Identifies the target machine (C64, C128, X16, etc.)
 * - CPUType: Identifies the CPU variant (6502, 65C02, 65816)
 *
 * Each target architecture has specific:
 * - Zero-page reserved ranges (system-dependent)
 * - Hardware registers (VIC-II, SID, VERA, etc.)
 * - Memory maps and bank switching
 * - CPU-specific optimizations
 *
 * @example
 * ```typescript
 * import { TargetArchitecture, CPUType } from './architecture.js';
 *
 * // Default target is C64
 * const target = TargetArchitecture.C64;
 *
 * // C64 uses 6510 (6502 variant)
 * const cpu = CPUType.MOS6502;
 * ```
 */

/**
 * Supported target architectures
 *
 * Identifies the target machine for which code is being compiled.
 * Each architecture has different hardware characteristics that
 * affect optimization strategies.
 *
 * **Primary Target:**
 * - C64: Commodore 64 (fully implemented)
 *
 * **Future Targets:**
 * - C128: Commodore 128 (placeholder)
 * - X16: Commander X16 (placeholder)
 * - Generic: Minimal 6502 assumptions (placeholder)
 */
export enum TargetArchitecture {
  /**
   * Commodore 64 - Primary target
   *
   * Hardware:
   * - CPU: 6510 (6502 with I/O port)
   * - RAM: 64K
   * - Graphics: VIC-II ($D000-$D3FF)
   * - Sound: SID ($D400-$D7FF)
   * - Zero-page safe: $02-$8F (142 bytes)
   */
  C64 = 'c64',

  /**
   * Commodore 128 - Not yet implemented
   *
   * Hardware:
   * - CPU: 8502 (enhanced 6502)
   * - RAM: 128K+ (banked)
   * - Graphics: VIC-II + VDC ($D600)
   * - Sound: 2x SID
   * - Zero-page: Different KERNAL workspace
   */
  C128 = 'c128',

  /**
   * Commander X16 - Not yet implemented
   *
   * Hardware:
   * - CPU: WDC 65C02
   * - RAM: Up to 2MB (banked)
   * - Graphics: VERA ($9F20+)
   * - Sound: YM2151 + PSG
   * - Zero-page: 22 bytes user ($00-$15)
   */
  X16 = 'x16',

  /**
   * Generic 6502 - Minimal assumptions
   *
   * For bare-metal 6502 systems without specific
   * hardware assumptions. Useful for custom hardware
   * or testing.
   */
  Generic = 'generic',
}

/**
 * CPU types in the 6502 family
 *
 * Identifies the specific CPU variant, which affects:
 * - Available opcodes
 * - Addressing modes
 * - Cycle timing
 * - Special features (decimal mode, etc.)
 */
export enum CPUType {
  /**
   * Original MOS 6502 / 6510
   *
   * The standard 6502 instruction set.
   * The 6510 (used in C64) is identical except
   * for the memory-mapped I/O port at $00-$01.
   *
   * Features:
   * - 151 documented opcodes
   * - Standard addressing modes
   * - 1-2 MHz typical clock
   */
  MOS6502 = '6502',

  /**
   * WDC 65C02 with additional opcodes
   *
   * Enhanced version with new instructions:
   * - PHX, PLX, PHY, PLY (push/pull X/Y)
   * - BRA (branch always)
   * - STZ (store zero)
   * - TRB, TSB (test and set/reset bits)
   * - (zp) indirect without Y
   *
   * Used in: Commander X16, Apple IIc/IIe enhanced
   */
  WDC65C02 = '65c02',

  /**
   * WDC 65816 with 16-bit mode
   *
   * 16-bit extension of 65C02:
   * - Native 16-bit mode
   * - 24-bit address bus (16MB)
   * - New registers (direct page, stack pointer)
   * - Block move instructions
   *
   * Used in: Apple IIGS, SNES
   */
  WDC65816 = '65816',
}

/**
 * Check if a target architecture is implemented
 *
 * @param target - Target architecture to check
 * @returns True if target is fully implemented
 *
 * @example
 * ```typescript
 * isTargetImplemented(TargetArchitecture.C64);   // true
 * isTargetImplemented(TargetArchitecture.C128);  // false
 * ```
 */
export function isTargetImplemented(target: TargetArchitecture): boolean {
  switch (target) {
    case TargetArchitecture.C64:
      return true;
    case TargetArchitecture.C128:
    case TargetArchitecture.X16:
    case TargetArchitecture.Generic:
      return false;
    default:
      return false;
  }
}

/**
 * Check if a CPU type is implemented
 *
 * @param cpu - CPU type to check
 * @returns True if CPU type is fully implemented
 *
 * @example
 * ```typescript
 * isCPUImplemented(CPUType.MOS6502);    // true
 * isCPUImplemented(CPUType.WDC65C02);   // false
 * ```
 */
export function isCPUImplemented(cpu: CPUType): boolean {
  switch (cpu) {
    case CPUType.MOS6502:
      return true;
    case CPUType.WDC65C02:
    case CPUType.WDC65816:
      return false;
    default:
      return false;
  }
}

/**
 * Get display name for target architecture
 *
 * @param target - Target architecture
 * @returns Human-readable name
 */
export function getTargetDisplayName(target: TargetArchitecture): string {
  switch (target) {
    case TargetArchitecture.C64:
      return 'Commodore 64';
    case TargetArchitecture.C128:
      return 'Commodore 128';
    case TargetArchitecture.X16:
      return 'Commander X16';
    case TargetArchitecture.Generic:
      return 'Generic 6502';
    default:
      return 'Unknown';
  }
}

/**
 * Get display name for CPU type
 *
 * @param cpu - CPU type
 * @returns Human-readable name
 */
export function getCPUDisplayName(cpu: CPUType): string {
  switch (cpu) {
    case CPUType.MOS6502:
      return 'MOS 6502/6510';
    case CPUType.WDC65C02:
      return 'WDC 65C02';
    case CPUType.WDC65816:
      return 'WDC 65816';
    default:
      return 'Unknown';
  }
}

/**
 * Parse target architecture from string
 *
 * Accepts various formats (case-insensitive):
 * - 'c64', 'C64', 'commodore64'
 * - 'c128', 'C128', 'commodore128'
 * - 'x16', 'X16', 'commanderx16'
 * - 'generic', '6502'
 *
 * @param value - String to parse
 * @returns Parsed target architecture, or null if invalid
 *
 * @example
 * ```typescript
 * parseTargetArchitecture('c64');        // TargetArchitecture.C64
 * parseTargetArchitecture('COMMODORE64'); // TargetArchitecture.C64
 * parseTargetArchitecture('invalid');    // null
 * ```
 */
export function parseTargetArchitecture(value: string): TargetArchitecture | null {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, '');

  switch (normalized) {
    case 'c64':
    case 'commodore64':
      return TargetArchitecture.C64;
    case 'c128':
    case 'commodore128':
      return TargetArchitecture.C128;
    case 'x16':
    case 'commanderx16':
      return TargetArchitecture.X16;
    case 'generic':
    case '6502':
      return TargetArchitecture.Generic;
    default:
      return null;
  }
}

/**
 * Get the default target architecture
 *
 * @returns Default target (C64)
 */
export function getDefaultTarget(): TargetArchitecture {
  return TargetArchitecture.C64;
}

/**
 * Get the default CPU type for a target architecture
 *
 * @param target - Target architecture
 * @returns Default CPU for the target
 */
export function getDefaultCPU(target: TargetArchitecture): CPUType {
  switch (target) {
    case TargetArchitecture.C64:
      return CPUType.MOS6502;
    case TargetArchitecture.C128:
      return CPUType.MOS6502; // 8502 is 6502-compatible
    case TargetArchitecture.X16:
      return CPUType.WDC65C02;
    case TargetArchitecture.Generic:
      return CPUType.MOS6502;
    default:
      return CPUType.MOS6502;
  }
}