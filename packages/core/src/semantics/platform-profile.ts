/**
 * Minimal `PlatformProfile` stub extended with interim SFA budget fields.
 *
 * The full platform-profile system — memory map, zero-page ranges, output binary
 * format, intrinsic registry, character encodings — is not implemented yet. The
 * two original fields (`name`, `charEncoding`) exist so `analyze()` can carry its
 * signature; the current passthrough accepts a profile but never reads it.
 *
 * The RAM/ZP/stack budget fields let the SFA passes compile and be
 * fixture-tested today; a canonical profile with real platform semantics will
 * later supersede/extend this as an additive, non-breaking change. A
 * C64-shaped test fixture supplies concrete values (see the frontend `sfa`
 * test fixtures).
 *
 * The complete profile shape and its platform library are not implemented yet.
 */

/**
 * A placeholder platform profile plus interim SFA budget fields. A canonical
 * profile definition will supersede this.
 */
export interface PlatformProfile {
  /** Platform identifier, e.g. "c64" (placeholder; the canonical set is not defined yet). */
  readonly name: string;
  /** Character-encoding name for char/string literals, e.g. "petscii". */
  readonly charEncoding: string;

  // --- interim SFA budget fields (to be superseded by a canonical profile) ---

  /** RAM segment start — module vars are placed first, then the frame region. */
  readonly ramStart: number;
  /** RAM segment end, **exclusive**: `ramBudget = ramEnd − ramStart` (half-open). */
  readonly ramEnd: number;
  /** First usable zero-page byte. */
  readonly zpStart: number;
  /**
   * Last usable zero-page byte, **inclusive**: `zpBudget = zpEnd − zpStart + 1`.
   * The inclusive ZP convention deliberately differs from the half-open RAM one.
   */
  readonly zpEnd: number;
  /** Usable hardware-stack bytes (256 − platform reserve). */
  readonly stackBudget: number;
  /**
   * Reserved runtime-ABI zero-page arg-block floor. The interim default is
   * **4** bytes, matching the core-ABI floor now that marshalling consumes the
   * `"arg-block"` ZP category (the allocator already honours this).
   */
  readonly zpArgBlockMin: number;
  /** Default zero-page main-expression-temp bytes (default 4). */
  readonly mainTempBytes: number;
  /** Default zero-page IRQ-temp bytes (default 2). */
  readonly irqTempBytes: number;
  /** ZP usage fraction (0..1) at/above which W10030 is emitted (default 0.80). */
  readonly zpWarnThreshold: number;
  /** RAM usage fraction (0..1) at/above which W10033 is emitted (default 0.90). */
  readonly ramWarnThreshold: number;
  /** Stack usage fraction (0..1) at/above which W10180 is emitted (default 0.75). */
  readonly stackWarnThreshold: number;
}

/**
 * A neutral default profile so callers and tests have something to pass. The
 * current passthrough ignores it. The interim SFA budget fields carry small,
 * safe placeholder values (no real platform semantics); real budget values
 * come from a platform fixture or, later, a canonical profile.
 */
export const DEFAULT_PROFILE: PlatformProfile = {
  name: "none",
  charEncoding: "ascii",
  // Neutral, internally-consistent budgets (zpEnd ≥ zpStart, ramEnd > ramStart).
  // Real targets override these.
  ramStart: 0x0800,
  ramEnd: 0xa000,
  zpStart: 0x02,
  zpEnd: 0x2f,
  stackBudget: 230,
  zpArgBlockMin: 4,
  mainTempBytes: 4,
  irqTempBytes: 2,
  zpWarnThreshold: 0.8,
  ramWarnThreshold: 0.9,
  stackWarnThreshold: 0.75,
};
