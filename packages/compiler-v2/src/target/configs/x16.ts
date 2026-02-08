/**
 * Commander X16 Target Configuration (Placeholder)
 *
 * **NOT YET IMPLEMENTED** - Placeholder for future X16 target.
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
        'Please use C64 target (--target c64) or contribute the implementation!',
    );
    this.name = 'X16NotImplementedError';
  }
}

/**
 * X16 Target Configuration (Placeholder)
 *
 * **WARNING:** This target is marked as `implemented: false`.
 */
export const X16_CONFIG: TargetConfig = {
  architecture: TargetArchitecture.X16,
  cpu: CPUType.WDC65C02,
  clockSpeedMHz: 8.0,
  totalMemory: 524288,
  zeroPage: {
    reservedRanges: [
      { start: 0x16, end: 0xff, reason: 'X16 KERNAL workspace' },
    ],
    safeRange: { start: 0x00, end: 0x15 },
    usableBytes: 22,
  },
  graphicsChip: {
    name: 'VERA',
    baseAddress: 0x9f20,
    cyclesPerLine: 0,
    linesPerFrame: 525,
    badlinePenalty: 0,
  },
  soundChip: {
    name: 'YM2151',
    baseAddress: 0x9f40,
    voices: 8,
  },
  implemented: false,
};
