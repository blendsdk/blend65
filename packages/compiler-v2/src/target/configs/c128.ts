/**
 * Commodore 128 Target Configuration (Placeholder)
 *
 * **NOT YET IMPLEMENTED** - Placeholder for future C128 target.
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
        'Please use C64 target (--target c64) or contribute the implementation!',
    );
    this.name = 'C128NotImplementedError';
  }
}

/**
 * C128 Target Configuration (Placeholder)
 *
 * **WARNING:** This target is marked as `implemented: false`.
 */
export const C128_CONFIG: TargetConfig = {
  architecture: TargetArchitecture.C128,
  cpu: CPUType.MOS6502,
  clockSpeedMHz: 1.0,
  totalMemory: 131072,
  zeroPage: {
    reservedRanges: [
      { start: 0x00, end: 0x01, reason: 'CPU memory configuration (8502)' },
      { start: 0x80, end: 0xff, reason: 'KERNAL workspace (placeholder - needs research)' },
    ],
    safeRange: { start: 0x02, end: 0x7f },
    usableBytes: 126,
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
  implemented: false,
};
