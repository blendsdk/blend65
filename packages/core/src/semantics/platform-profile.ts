/**
 * Minimal `PlatformProfile` stub (RD-04 D4) extended with the interim SFA budget
 * fields RD-05 needs (RD-05 D2).
 *
 * The full platform-profile system — memory map, zero-page ranges, output binary
 * format, intrinsic registry, character encodings — is RD-10's domain. The two
 * original fields (`name`, `charEncoding`) exist so `analyze()` can carry its
 * R118/R120 signature; the RD-04 passthrough accepts a profile but never reads it.
 *
 * RD-05 additively defines the RAM/ZP/stack budget fields its planner requires so
 * the SFA passes can compile and be fixture-tested today (D2). RD-10 later
 * supersedes/extends this with the canonical profile — an additive change with no
 * breaking impact (F2 platform-profile-ready). A C64-shaped test fixture supplies
 * concrete values (see the frontend `sfa` test fixtures).
 *
 * DEFERRED(RD-10): the complete profile shape and its platform library.
 */

/**
 * A placeholder platform profile (RD-04 R120) plus the interim SFA budget fields
 * (RD-05 D2). RD-10 supersedes this with the canonical profile definition.
 */
export interface PlatformProfile {
  /** Platform identifier, e.g. "c64" (placeholder — RD-10 defines the canonical set). */
  readonly name: string;
  /** Character-encoding name for char/string literals (R47/R120), e.g. "petscii". */
  readonly charEncoding: string;

  // --- interim SFA budget fields (RD-05 D2; superseded by RD-10) ---

  /** RAM segment start — module vars are placed first, then the frame region (R24). */
  readonly ramStart: number;
  /** RAM segment end, **exclusive**: `ramBudget = ramEnd − ramStart` (half-open). */
  readonly ramEnd: number;
  /** First usable zero-page byte (R28). */
  readonly zpStart: number;
  /**
   * Last usable zero-page byte, **inclusive**: `zpBudget = zpEnd − zpStart + 1`.
   * The inclusive ZP convention deliberately differs from the half-open RAM one.
   */
  readonly zpEnd: number;
  /** Usable hardware-stack bytes (256 − platform reserve) (R39). */
  readonly stackBudget: number;
  /**
   * Reserved runtime-ABI zero-page arg-block floor (AR-34). RD-17 (AR-P10) raises
   * the interim default from 0 to **4** to match the R34 core-ABI floor now that
   * marshalling consumes the `"arg-block"` ZP category (an additive change the
   * allocator already honours).
   */
  readonly zpArgBlockMin: number;
  /** Default zero-page main-expression-temp bytes (R33, default 4). */
  readonly mainTempBytes: number;
  /** Default zero-page IRQ-temp bytes (R34, default 2). */
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
 * RD-04 passthrough ignores it. The interim SFA budget fields carry small, safe
 * placeholder values (no real platform semantics, D4); real budget values come
 * from a platform fixture or, later, RD-10's canonical profiles.
 */
export const DEFAULT_PROFILE: PlatformProfile = {
  name: "none",
  charEncoding: "ascii",
  // Neutral, internally-consistent budgets (zpEnd ≥ zpStart, ramEnd > ramStart).
  // Real targets override these (D2/RD-10).
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
