/**
 * Target Architecture Definitions
 *
 * Defines supported target architectures and CPU types for the Blend65 compiler.
 * This module provides the foundation for multi-target support, allowing the
 * compiler to generate optimized code for different 6502-based machines.
 *
 * @module target/architecture
 */

/**
 * Supported target architectures
 *
 * Identifies the target machine for which code is being compiled.
 * Each architecture has different hardware characteristics that
 * affect optimization strategies.
 */
export enum TargetArchitecture {
  /** Commodore 64 - Primary target (fully implemented) */
  C64 = 'c64',

  /** Commodore 128 - Not yet implemented */
  C128 = 'c128',

  /** Commander X16 - Not yet implemented */
  X16 = 'x16',

  /** Generic 6502 - Minimal assumptions */
  Generic = 'generic',
}

/**
 * CPU types in the 6502 family
 *
 * Identifies the specific CPU variant, which affects
 * available opcodes, addressing modes, and cycle timing.
 */
export enum CPUType {
  /** Original MOS 6502 / 6510 (151 documented opcodes) */
  MOS6502 = '6502',

  /** WDC 65C02 with additional opcodes (PHX, PLX, BRA, STZ, etc.) */
  WDC65C02 = '65c02',

  /** WDC 65816 with 16-bit mode */
  WDC65816 = '65816',
}

/**
 * Check if a target architecture is implemented
 *
 * @param target - Target architecture to check
 * @returns True if target is fully implemented
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
 * Accepts various formats (case-insensitive).
 *
 * @param value - String to parse
 * @returns Parsed target architecture, or null if invalid
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
      return CPUType.MOS6502;
    case TargetArchitecture.X16:
      return CPUType.WDC65C02;
    case TargetArchitecture.Generic:
      return CPUType.MOS6502;
    default:
      return CPUType.MOS6502;
  }
}
