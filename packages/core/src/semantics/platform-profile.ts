/**
 * Minimal `PlatformProfile` stub for the RD-04 skeleton (D4).
 *
 * The full platform-profile system — memory map, zero-page ranges, output
 * binary format, intrinsic registry, character encodings — is RD-10's domain.
 * This stub exists only so `analyze()` can carry its R118/R120 signature today;
 * the passthrough accepts a profile but never reads it.
 *
 * DEFERRED(RD-10): the complete profile shape and its platform library.
 */

/**
 * A placeholder platform profile (RD-04 R120). RD-10 supersedes this with the
 * canonical profile definition; only the two fields the analyzer signature needs
 * are modelled here.
 */
export interface PlatformProfile {
  /** Platform identifier, e.g. "c64" (placeholder — RD-10 defines the canonical set). */
  readonly name: string;
  /** Character-encoding name for char/string literals (R47/R120), e.g. "petscii". */
  readonly charEncoding: string;
}

/**
 * A neutral default profile so callers and tests have something to pass. The
 * passthrough ignores it; it carries no real platform semantics (D4).
 */
export const DEFAULT_PROFILE: PlatformProfile = { name: "none", charEncoding: "ascii" };
