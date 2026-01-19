/**
 * Commander X16 Target Configuration (Placeholder)
 *
 * **NOT YET IMPLEMENTED**
 *
 * This file provides a placeholder configuration for the Commander X16.
 * The X16 is planned as a future target but is not currently supported.
 *
 * **Hardware Specifications (for future reference):**
 * - CPU: WDC 65C02 at 8 MHz
 * - RAM: 512K-2MB (banked)
 * - Graphics: VERA ($9F20+) - completely different from VIC-II
 * - Sound: YM2151 FM + VERA PSG
 * - Clock: 8 MHz (much faster than C64!)
 *
 * **Zero-Page:**
 * The X16 KERNAL reserves most of zero-page for system use.
 * Only $00-$15 (22 bytes) are available for user programs!
 *
 * **Important Differences from C64:**
 * - 65C02 has additional opcodes (PHX, PLX, PHY, PLY, BRA, STZ, etc.)
 * - No badlines (VERA handles graphics independently)
 * - Much more RAM but heavily banked
 * - Different I/O locations entirely
 *
 * @see https://github.com/commanderx16/x16-docs
 */

import { TargetArchitecture, CPUType } from '../architecture.js';
import type { TargetConfig } from '../config.js';

/**
 * Error thrown when X16 target is requested
 */
export class X16NotImplementedError extends Error {
  constructor() {
    super(
      'Commander X16 target is not yet implemented. ' +
        'Please use C64 target (--target c64) or contribute the implementation!'
    );
    this.name = 'X16NotImplementedError';
  }
}

/**
 * X16 Target Configuration (Placeholder)
 *
 * **WARNING:** This target is marked as `implemented: false`.
 * Attempting to use this configuration will result in an error.
 *
 * The configuration values are based on X16 documentation and serve
 * as a starting point for future implementation.
 */
export const X16_CONFIG: TargetConfig = {
  // Architecture identification
  architecture: TargetArchitecture.X16,
  cpu: CPUType.WDC65C02, // Real 65C02 with new opcodes!

  // Timing (8 MHz - very fast!)
  clockSpeedMHz: 8.0,

  // Memory (512K base, up to 2MB banked)
  totalMemory: 524288, // 512K base

  // Zero-page configuration
  // X16 KERNAL reserves most of ZP - only 22 bytes available!
  zeroPage: {
    reservedRanges: [
      // X16 reserves $16-$FF for KERNAL
      {
        start: 0x16,
        end: 0xff,
        reason: 'X16 KERNAL workspace',
      },
    ],
    safeRange: {
      start: 0x00,
      end: 0x15,
    },
    usableBytes: 22, // Only 22 bytes! ($00-$15)
  },

  // Graphics chip - VERA (completely different from VIC-II)
  graphicsChip: {
    name: 'VERA',
    baseAddress: 0x9f20,
    cyclesPerLine: 0, // Not applicable - VERA works independently
    linesPerFrame: 525, // 480p mode
    badlinePenalty: 0, // No badlines!
  },

  // Sound chip - YM2151 FM synthesizer
  soundChip: {
    name: 'YM2151',
    baseAddress: 0x9f40, // YM2151 address
    voices: 8,
  },

  // NOT IMPLEMENTED
  implemented: false,
};

/**
 * Get X16 configuration
 *
 * @throws {X16NotImplementedError} Always throws - X16 is not implemented
 */
export function getX16Config(): never {
  throw new X16NotImplementedError();
}

/**
 * Check if X16 target is implemented
 *
 * @returns Always false
 */
export function isX16Implemented(): boolean {
  return false;
}

/**
 * X16-specific notes for future implementation:
 *
 * **65C02 New Opcodes to Support:**
 * - PHX/PLX: Push/pull X register
 * - PHY/PLY: Push/pull Y register
 * - BRA: Branch always (unconditional relative branch)
 * - STZ: Store zero (more efficient than LDA #0 / STA)
 * - TRB/TSB: Test and reset/set bits
 * - (zp): Zero-page indirect without Y (new addressing mode)
 *
 * **VERA Graphics:**
 * - Layer 0/1: Tile or bitmap modes
 * - Sprites: 128 sprites
 * - No raster IRQ like VIC-II - use VERA VSYNC IRQ instead
 *
 * **Memory Banking:**
 * - $00-$9EFF: Low RAM
 * - $9F00-$9FFF: I/O area (VERA, VIA, etc.)
 * - $A000-$BFFF: Banked RAM (256 banks of 8K)
 * - $C000-$FFFF: Banked ROM (32 banks of 16K)
 */