import {
  vicConsumerAlignment,
  vicConsumerBytes,
  vicFieldAcceptsModuleStorage,
} from "../target/vic-fetch.js";
import type { VicFieldTransform } from "../target/vic-fetch.js";

// What the chip fetches through each field, and the alignment each field can
// express, are properties of the selected machine rather than of lowering, so
// they are stated once there and re-exported here for the callers that reach
// for them beside the field arithmetic below.
export { vicConsumerAlignment, vicConsumerBytes };
export type { VicFieldTransform };

/** Exact reason a VIC field cannot be derived from a final address. */
export type VicFieldFailureReason = "out-of-bank" | "character-rom" | "misaligned";

/** Why one module object's address could not be kept symbolic for a VIC field. */
export type VicFieldAddressRefusal =
  /** This field's module-storage support is not complete yet. */
  | "module-storage"
  /** A zero-page allocator chose the home, and it knows nothing of video alignment. */
  | "zero-page"
  /** The same address serves another purpose and must keep its run-time form. */
  | "shared-address"
  /** An index read at run time names a different block on every execution. */
  | "runtime-index";

/**
 * Explain one refused VIC field address, and name the spelling that works.
 *
 * The sentence stays short so it reads as one requirement clause inside its
 * registry template; the action the author can take is returned separately,
 * because a remedy inside the message has to argue with the template's own
 * closing clause.
 *
 * @param transform Field whose address was refused.
 * @param refusal Why the address could not be resolved before layout, or
 *   undefined when the address never named a module object at all.
 * @returns The requirement clause and the concrete action, as two strings.
 * @example vicFieldAddressRefusal("vic-sprite-block", "runtime-index").help
 */
export function vicFieldAddressRefusal(
  transform: VicFieldTransform,
  refusal: VicFieldAddressRefusal | undefined,
): { readonly requirement: string; readonly help: string } {
  const sprite = transform === "vic-sprite-block";
  if (refusal === "module-storage") {
    return {
      requirement: `VIC field '${transform}' requires an embedded asset or a constant address`,
      help: `Address an 'embed()' asset or write the address itself; this field cannot yet derive its value from module-level stored data.`,
    };
  }
  if (refusal === "zero-page") {
    return {
      requirement: `VIC field '${transform}' cannot use zero-page storage`,
      help: `Declare the data at module level instead of inside a 'zeropage' block; a zero-page home is chosen for fast access and cannot be given the ${vicConsumerAlignment(transform)}-byte alignment this field needs.`,
    };
  }
  if (refusal === "shared-address") {
    return {
      requirement: `VIC field '${transform}' requires an address used only by this field`,
      help: `Take the address again at the call instead of sharing one value, so the compiler can resolve this one after layout.`,
    };
  }
  if (refusal === "runtime-index") {
    return {
      requirement: `VIC field '${transform}' requires an index known before layout`,
      help: sprite
        ? `Select the element with the block number instead of with the address: 'vicSpriteBlock(&object[0]) + index' names the same block and keeps every selectable block reachable.`
        : `Address one element whose index is a literal; this field selects a fixed region and cannot follow an index chosen while the program runs.`,
    };
  }
  const accepted = vicFieldAcceptsModuleStorage(transform)
    ? `module-level stored data, an 'embed()' asset and a constant address all work`
    : `an 'embed()' asset and a constant address both work`;
  return {
    requirement: `VIC field '${transform}' requires an address the compiler can attribute to one object`,
    help: `Pass the address straight to the field, as '&object', rather than through a variable or a parameter: ${accepted}, and the compiler cannot see which object an address carried in a value names.`,
  };
}

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
