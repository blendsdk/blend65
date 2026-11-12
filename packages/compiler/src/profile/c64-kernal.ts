/** Complete resident C64 PRG and D64 identities; partial names never select a default. */
export type C64ResidentProfileId =
  | "c64-pal-prg-kernal-6581"
  | "c64-pal-prg-kernal-8580"
  | "c64-pal-prg-takeover-6581"
  | "c64-pal-prg-takeover-8580"
  | "c64-ntsc-prg-kernal-6581"
  | "c64-ntsc-prg-kernal-8580"
  | "c64-ntsc-prg-takeover-6581"
  | "c64-ntsc-prg-takeover-8580"
  | "c64-pal-d64-kernal-6581";

/** Backward-compatible name for the closed resident-profile identity union. */
export type C64KernalProfileId = C64ResidentProfileId;

/** Firmware ownership mode carried by one closed profile identity. */
export type C64ProfileOwnership = "cooperative" | "takeover";

/** Immutable nominal machine facts shared by source declarations and target selection. */
export interface C64KernalProfileFacts {
  /** Exact identity, including video, artifact, firmware ownership and SID model. */
  readonly id: C64ResidentProfileId;
  /** Firmware ownership path while application code runs. */
  readonly ownership: C64ProfileOwnership;
  /** Primary artifact family selected by this profile. */
  readonly profileKind: "prg" | "d64";
  /** PAL or later NTSC timing, not the early NTSC VIC revision. */
  readonly video: "pal" | "ntsc";
  /** Single SID chip model at the ordinary C64 address. */
  readonly sidModel: 6581 | 8580;
  /** Nominal CPU clock in hertz; host precision preserves the complete value. */
  readonly clockHz: number;
  /** Stock 901227-03 Timer A latch for the selected video standard, not a raster period. */
  readonly kernalTimerAReload: number;
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
export const C64_RESIDENT_PROFILES: readonly C64KernalProfileFacts[] = Object.freeze([
  Object.freeze({
    id: "c64-pal-prg-kernal-6581",
    ownership: "cooperative",
    profileKind: "prg",
    video: "pal",
    sidModel: 6581,
    clockHz: 985248,
    kernalTimerAReload: 16421,
    rasterLines: 312,
    cyclesPerLine: 63,
    cyclesPerFrame: 19656,
    frameRateWhole: 50,
    frameRateFractionNumerator: 34,
    frameRateFractionDenominator: 273,
  }),
  Object.freeze({
    id: "c64-pal-prg-kernal-8580",
    ownership: "cooperative",
    profileKind: "prg",
    video: "pal",
    sidModel: 8580,
    clockHz: 985248,
    kernalTimerAReload: 16421,
    rasterLines: 312,
    cyclesPerLine: 63,
    cyclesPerFrame: 19656,
    frameRateWhole: 50,
    frameRateFractionNumerator: 34,
    frameRateFractionDenominator: 273,
  }),
  Object.freeze({
    id: "c64-pal-prg-takeover-6581",
    ownership: "takeover",
    profileKind: "prg",
    video: "pal",
    sidModel: 6581,
    clockHz: 985248,
    kernalTimerAReload: 16421,
    rasterLines: 312,
    cyclesPerLine: 63,
    cyclesPerFrame: 19656,
    frameRateWhole: 50,
    frameRateFractionNumerator: 34,
    frameRateFractionDenominator: 273,
  }),
  Object.freeze({
    id: "c64-pal-prg-takeover-8580",
    ownership: "takeover",
    profileKind: "prg",
    video: "pal",
    sidModel: 8580,
    clockHz: 985248,
    kernalTimerAReload: 16421,
    rasterLines: 312,
    cyclesPerLine: 63,
    cyclesPerFrame: 19656,
    frameRateWhole: 50,
    frameRateFractionNumerator: 34,
    frameRateFractionDenominator: 273,
  }),
  Object.freeze({
    id: "c64-ntsc-prg-kernal-6581",
    ownership: "cooperative",
    profileKind: "prg",
    video: "ntsc",
    sidModel: 6581,
    clockHz: 1022730,
    kernalTimerAReload: 17045,
    rasterLines: 263,
    cyclesPerLine: 65,
    cyclesPerFrame: 17095,
    frameRateWhole: 59,
    frameRateFractionNumerator: 2825,
    frameRateFractionDenominator: 3419,
  }),
  Object.freeze({
    id: "c64-ntsc-prg-kernal-8580",
    ownership: "cooperative",
    profileKind: "prg",
    video: "ntsc",
    sidModel: 8580,
    clockHz: 1022730,
    kernalTimerAReload: 17045,
    rasterLines: 263,
    cyclesPerLine: 65,
    cyclesPerFrame: 17095,
    frameRateWhole: 59,
    frameRateFractionNumerator: 2825,
    frameRateFractionDenominator: 3419,
  }),
  Object.freeze({
    id: "c64-ntsc-prg-takeover-6581",
    ownership: "takeover",
    profileKind: "prg",
    video: "ntsc",
    sidModel: 6581,
    clockHz: 1022730,
    kernalTimerAReload: 17045,
    rasterLines: 263,
    cyclesPerLine: 65,
    cyclesPerFrame: 17095,
    frameRateWhole: 59,
    frameRateFractionNumerator: 2825,
    frameRateFractionDenominator: 3419,
  }),
  Object.freeze({
    id: "c64-ntsc-prg-takeover-8580",
    ownership: "takeover",
    profileKind: "prg",
    video: "ntsc",
    sidModel: 8580,
    clockHz: 1022730,
    kernalTimerAReload: 17045,
    rasterLines: 263,
    cyclesPerLine: 65,
    cyclesPerFrame: 17095,
    frameRateWhole: 59,
    frameRateFractionNumerator: 2825,
    frameRateFractionDenominator: 3419,
  }),
  Object.freeze({
    id: "c64-pal-d64-kernal-6581",
    ownership: "cooperative",
    profileKind: "d64",
    video: "pal",
    sidModel: 6581,
    clockHz: 985248,
    kernalTimerAReload: 16421,
    rasterLines: 312,
    cyclesPerLine: 63,
    cyclesPerFrame: 19656,
    frameRateWhole: 50,
    frameRateFractionNumerator: 34,
    frameRateFractionDenominator: 273,
  }),
]);

/** Backward-compatible alias for the closed resident-profile table. */
export const C64_KERNAL_PROFILES = C64_RESIDENT_PROFILES;

/**
 * Select exact resident facts without host state, mutable configuration or fallback.
 * @example selectC64KernalFacts("c64-ntsc-prg-takeover-8580")?.rasterLines // 263
 */
export function selectC64KernalFacts(profileId: string): C64KernalProfileFacts | null {
  return C64_RESIDENT_PROFILES.find(({ id }) => id === profileId) ?? null;
}
