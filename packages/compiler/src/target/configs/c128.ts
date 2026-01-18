/**
 * Commodore 128 Target Configuration (Placeholder)
 *
 * **NOT YET IMPLEMENTED**
 *
 * This file provides a placeholder configuration for the Commodore 128.
 * The C128 is planned as a future target but is not currently supported.
 *
 * **Hardware Specifications (for future reference):**
 * - CPU: MOS 8502 (enhanced 6502, 2 MHz mode)
 * - RAM: 128K+ (bank-switched)
 * - Graphics: VIC-II + VDC ($D600)
 * - Sound: 2x SID chips
 * - Clock: 1 MHz / 2 MHz switchable
 *
 * **Zero-Page (tentative):**
 * The C128 has different KERNAL workspace usage than the C64.
 * Exact ranges TBD when implementation begins.
 *
 * @see https://www.c64-wiki.com/wiki/Commodore_128
 */

import { TargetArchitecture, CPUType } from '../architecture.js';
import type { TargetConfig } from '../config.js';

/**
 * Error thrown when C128 target is requested
 */
export class C128NotImplementedError extends Error {
  constructor() {
    super(
      'Commodore 128 target is not yet implemented. ' +
        'Please use C64 target (--target c64) or contribute the implementation!'
    );
    this.name = 'C128NotImplementedError';
  }
}

/**
 * C128 Target Configuration (Placeholder)
 *
 * **WARNING:** This target is marked as `implemented: false`.
 * Attempting to use this configuration will result in an error.
 *
 * The configuration values are approximate and serve as documentation
 * for future implementation.
 */
export const C128_CONFIG: TargetConfig = {
  // Architecture identification
  architecture: TargetArchitecture.C128,
  cpu: CPUType.MOS6502, // 8502 is 6502-compatible

  // Timing (1 MHz mode - 2 MHz mode TBD)
  clockSpeedMHz: 1.0,

  // Memory (128K base, can be expanded)
  totalMemory: 131072, // 128K

  // Zero-page configuration (tentative - needs research)
  zeroPage: {
    reservedRanges: [
      {
        start: 0x00,
        end: 0x01,
        reason: 'CPU memory configuration (8502)',
      },
      // C128 KERNAL uses different ZP locations than C64
      // This needs to be researched for actual implementation
      {
        start: 0x80,
        end: 0xff,
        reason: 'KERNAL workspace (placeholder - needs research)',
      },
    ],
    safeRange: {
      start: 0x02,
      end: 0x7f,
    },
    usableBytes: 126, // Placeholder - needs verification
  },

  // Graphics chip (VIC-II, VDC not included yet)
  graphicsChip: {
    name: 'VIC-II',
    baseAddress: 0xd000,
    cyclesPerLine: 63,
    linesPerFrame: 312,
    badlinePenalty: 40,
  },

  // Sound chip (first SID, second SID not included yet)
  soundChip: {
    name: 'SID',
    baseAddress: 0xd400,
    voices: 3,
  },

  // NOT IMPLEMENTED
  implemented: false,
};

/**
 * Get C128 configuration
 *
 * @throws {C128NotImplementedError} Always throws - C128 is not implemented
 */
export function getC128Config(): never {
  throw new C128NotImplementedError();
}

/**
 * Check if C128 target is implemented
 *
 * @returns Always false
 */
export function isC128Implemented(): boolean {
  return false;
}