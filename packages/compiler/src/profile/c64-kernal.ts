/** Complete cooperative C64 PRG identities; partial names never select a default. */
export type C64KernalProfileId =
  | "c64-pal-prg-kernal-6581"
  | "c64-pal-prg-kernal-8580"
  | "c64-ntsc-prg-kernal-6581"
  | "c64-ntsc-prg-kernal-8580";

/** Immutable nominal machine facts shared by source declarations and target selection. */
export interface C64KernalProfileFacts {
  /** Exact identity, including video, artifact, firmware ownership and SID model. */
  readonly id: C64KernalProfileId;
  /** PAL or later NTSC timing, not the early NTSC VIC revision. */
  readonly video: "pal" | "ntsc";
  /** Single SID chip model at the ordinary C64 address. */
  readonly sidModel: 6581 | 8580;
  /** Nominal CPU clock in hertz; host precision preserves the complete value. */
  readonly clockHz: number;
  /** Raster lines in one video frame. */
  readonly rasterLines: number;
  /** CPU clock periods in one raster line. */
  readonly cyclesPerLine: number;
  /** CPU clock periods in one complete frame, before device bus denial. */
  readonly cyclesPerFrame: number;
  /** Integer part of the exact nominal frame rate. */
  readonly frameRateWhole: number;
  /** Numerator of the positive reduced fractional frame rate. */
  readonly frameRateFractionNumerator: number;
  /** Denominator of the positive reduced fractional frame rate. */
  readonly frameRateFractionDenominator: number;
}

/** Closed, deeply immutable fact rows; their order also defines diagnostic admission lists. */
export const C64_KERNAL_PROFILES: readonly C64KernalProfileFacts[] = Object.freeze([
  Object.freeze({
    id: "c64-pal-prg-kernal-6581",
    video: "pal",
    sidModel: 6581,
    clockHz: 985248,
    rasterLines: 312,
    cyclesPerLine: 63,
    cyclesPerFrame: 19656,
    frameRateWhole: 50,
    frameRateFractionNumerator: 34,
    frameRateFractionDenominator: 273,
  }),
  Object.freeze({
    id: "c64-pal-prg-kernal-8580",
    video: "pal",
    sidModel: 8580,
    clockHz: 985248,
    rasterLines: 312,
    cyclesPerLine: 63,
    cyclesPerFrame: 19656,
    frameRateWhole: 50,
    frameRateFractionNumerator: 34,
    frameRateFractionDenominator: 273,
  }),
  Object.freeze({
    id: "c64-ntsc-prg-kernal-6581",
    video: "ntsc",
    sidModel: 6581,
    clockHz: 1022730,
    rasterLines: 263,
    cyclesPerLine: 65,
    cyclesPerFrame: 17095,
    frameRateWhole: 59,
    frameRateFractionNumerator: 2825,
    frameRateFractionDenominator: 3419,
  }),
  Object.freeze({
    id: "c64-ntsc-prg-kernal-8580",
    video: "ntsc",
    sidModel: 8580,
    clockHz: 1022730,
    rasterLines: 263,
    cyclesPerLine: 65,
    cyclesPerFrame: 17095,
    frameRateWhole: 59,
    frameRateFractionNumerator: 2825,
    frameRateFractionDenominator: 3419,
  }),
]);

/**
 * Select exact cooperative facts without host state, mutable configuration or fallback.
 * @example selectC64KernalFacts("c64-ntsc-prg-kernal-8580")?.rasterLines // 263
 */
export function selectC64KernalFacts(profileId: string): C64KernalProfileFacts | null {
  return C64_KERNAL_PROFILES.find(({ id }) => id === profileId) ?? null;
}
