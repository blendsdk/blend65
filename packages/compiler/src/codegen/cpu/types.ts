/**
 * CPU Target Types
 *
 * Defines the CPU target variants supported by the Blend65 compiler.
 * Currently supports the MOS 6502 (C64) and WDC 65C02 (Commander X16).
 *
 * @module codegen/cpu/types
 */

// ============================================================================
// CPU Target Type
// ============================================================================

/**
 * Supported CPU target variants.
 *
 * - `'6502'` — MOS 6502 (C64, Atari, NES, etc.)
 * - `'65c02'` — WDC 65C02 (Commander X16, Apple IIe enhanced, etc.)
 *
 * The 65C02 adds instructions like STZ, BRA, PHX/PLX/PHY/PLY, INC A, DEC A
 * that produce shorter and faster code compared to 6502 multi-instruction
 * equivalents.
 */
export type CpuTarget = '6502' | '65c02';

/**
 * Default CPU target when none is specified.
 *
 * Defaults to '6502' for backward compatibility — the MOS 6502
 * is the lowest common denominator for all supported platforms.
 */
export const DEFAULT_CPU_TARGET: CpuTarget = '6502';
