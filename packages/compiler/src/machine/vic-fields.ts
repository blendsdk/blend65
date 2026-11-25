import { vicConsumerAlignment, vicConsumerBytes } from "../target/vic-fetch.js";
import type { VicFieldTransform } from "../target/vic-fetch.js";

// What the chip fetches through each field, and the alignment each field can
// express, are properties of the selected machine rather than of lowering, so
// they are stated once there and re-exported here for the callers that reach
// for them beside the field arithmetic below.
export { vicConsumerAlignment, vicConsumerBytes };
export type { VicFieldTransform };

/** Exact reason a VIC field cannot be derived from a final address. */
export type VicFieldFailureReason = "out-of-bank" | "character-rom" | "misaligned";

/** Structured VIC field failure with a message that names the violated constraint. */
export interface VicFieldFailure {
  /** Stable failure discriminator. */
  readonly reason: VicFieldFailureReason;
  /** Complete user-facing explanation naming the field, address and constraint. */
  readonly message: string;
}

/**
 * Explain why one VIC field cannot be derived from a final address.
 *
 * The checks are shared by lowering-time constants and post-layout transforms so
 * both diagnostics name the same constraint instead of duplicating the rules.
 */
export function vicFieldFailure(
  transform: VicFieldTransform,
  address: number,
  vicBankStart: number,
  characterRomStart?: number,
  characterRomEnd?: number,
): VicFieldFailure | null {
  const offset = address - vicBankStart;
  if (offset < 0 || offset > 0x3fff) {
    return Object.freeze({
      reason: "out-of-bank",
      message: `VIC field '${transform}' requires an address in the selected VIC bank ($${vicBankStart.toString(16)}-$${(vicBankStart + 0x3fff).toString(16)}); $${address.toString(16)} is outside it`,
    });
  }
  const end = address + vicConsumerBytes(transform);
  if (
    characterRomStart !== undefined &&
    characterRomEnd !== undefined &&
    address < characterRomEnd + 1 &&
    end > characterRomStart
  ) {
    return Object.freeze({
      reason: "character-rom",
      message: `VIC field '${transform}' at $${address.toString(16)} overlaps the VIC-invisible character-ROM window $${characterRomStart.toString(16)}-$${characterRomEnd.toString(16)}`,
    });
  }
  const alignment = vicConsumerAlignment(transform);
  if (offset % alignment !== 0) {
    return Object.freeze({
      reason: "misaligned",
      message: `VIC field '${transform}' requires ${alignment}-byte alignment; $${address.toString(16)} is not aligned`,
    });
  }
  return null;
}

/**
 * Compute one pure VIC field constant from a final bank-relative address.
 *
 * Returns null when the address is misaligned, outside the selected bank, or
 * when the object it names would overlap the VIC-invisible character-ROM window.
 * The caller fails closed instead of emitting a wrong or invisible field.
 */
export function vicFieldValue(
  transform: VicFieldTransform,
  address: number,
  vicBankStart: number,
  characterRomStart?: number,
  characterRomEnd?: number,
): number | null {
  if (
    vicFieldFailure(transform, address, vicBankStart, characterRomStart, characterRomEnd) !== null
  ) {
    return null;
  }
  const offset = address - vicBankStart;
  switch (transform) {
    case "vic-sprite-block":
      return offset / 64;
    case "vic-charset-select":
      return ((offset / 2048) & 0x07) << 1;
    case "vic-bitmap-select":
      return ((offset / 8192) & 0x01) << 3;
    case "vic-screen-select":
      return ((offset / 1024) & 0x0f) << 4;
  }
}
