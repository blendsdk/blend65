import type { SourceSpan } from "../project/types.js";

/** Layout-resolved VIC field transforms available to source operations. */
export type VicFieldTransform =
  | "vic-sprite-block"
  | "vic-charset-select"
  | "vic-bitmap-select"
  | "vic-screen-select";

/** Bytes of one video-chip bank, which is the span a block number can address. */
export const VIC_BANK_BYTES = 16384;

/** Platform capabilities that derive one VIC field from an address. */
const VIC_FIELD_CAPABILITIES: ReadonlyMap<string, VicFieldTransform> = new Map([
  ["c64.vic.vicSpriteBlock", "vic-sprite-block"],
  ["c64.vic.vicCharsetSelect", "vic-charset-select"],
  ["c64.vic.vicBitmapSelect", "vic-bitmap-select"],
  ["c64.vic.vicScreenSelect", "vic-screen-select"],
] as const);

/**
 * The VIC field one capability computes, or null for every other capability.
 *
 * Three stages need the same answer and must not disagree about it: the demand
 * stated on the addressed object, the decision to keep its address symbolic
 * until layout, and the field arithmetic itself. A capability named in only two
 * of the three would place an object for a field nobody resolves, or resolve a
 * field against a home nothing constrained.
 *
 * @param capability Fully qualified platform capability name.
 * @returns The field this capability derives, or null when it derives none.
 * @example vicFieldTransformOf("c64.vic.vicSpriteBlock") // "vic-sprite-block"
 */
export function vicFieldTransformOf(capability: string): VicFieldTransform | null {
  return VIC_FIELD_CAPABILITIES.get(capability) ?? null;
}

/**
 * Whether a constant address could be one of a screen matrix's sprite pointers.
 *
 * A sprite's block number only acts as a pointer in eight specific bytes: the
 * last eight of the active screen matrix. That matrix occupies an aligned
 * 1 KiB interval wherever it is placed, so those bytes are always the top eight
 * of a 1 KiB boundary regardless of which matrix or bank is selected — which
 * makes this answerable without knowing either.
 *
 * Writing a block number anywhere else puts a byte where the chip either never
 * looks or looks for something that is not a pointer, and changes nothing about
 * where it fetches sprite data from.
 *
 * @param address Constant destination address of a raw write.
 * @returns Whether the address falls in a screen matrix's pointer tail.
 * @example couldBeSpritePointer(0x07f8) // true: sprite 0 for a matrix at $0400
 */
export function couldBeSpritePointer(address: number): boolean {
  return (address & 0x03ff) >= 0x03f8;
}

/**
 * Byte footprint one VIC field occupies, which is what placement must keep
 * reachable.
 *
 * This is the record the hardware addresses rather than a count of bytes read:
 * a sprite image is 63 bytes inside a 64-byte block, and the block is the unit
 * the pointer selects. Bank and character-ROM boundaries are multiples of every
 * footprint here, so constraining the footprint constrains exactly what the
 * chip can reach.
 */
export function vicConsumerBytes(transform: VicFieldTransform): number {
  switch (transform) {
    case "vic-sprite-block":
      return 64;
    case "vic-charset-select":
      return 2_048;
    case "vic-bitmap-select":
      return 8_000;
    case "vic-screen-select":
      return 1_000;
  }
}

/** Required address alignment for one VIC field operation. */
export function vicConsumerAlignment(transform: VicFieldTransform): number {
  switch (transform) {
    case "vic-sprite-block":
      return 64;
    case "vic-charset-select":
      return 2_048;
    case "vic-bitmap-select":
      return 8_192;
    case "vic-screen-select":
      return 1_024;
  }
}

/**
 * One run of bytes the video chip fetches, measured from an object's first byte.
 *
 * The chip reads a bounded run, not whole objects: a sprite image is 64 bytes at
 * the addressed offset, and the thousands of bytes a sprite sheet holds around it
 * are never fetched. Keeping the demand this narrow is what lets a large object
 * live in ordinary storage while the bytes the hardware reads stay reachable.
 */
export interface VicFetchRange {
  /** Byte offset of the fetched run from the object's first byte. */
  readonly offset: number;
  /** Length of the fetched run. */
  readonly bytes: number;
}

/**
 * Everything placement needs in order to keep one object's fetched bytes
 * reachable by the video chip, together with the expression that asked for it.
 *
 * The compiler infers this; the author wrote no constraint. That origin is part
 * of the demand rather than a detail, because a refusal has to name the
 * expression that caused it instead of blaming a constraint nobody wrote, and
 * because an author-written region means the whole object and must not be
 * confused with this.
 */
export interface VicFetchDemand {
  /**
   * Runs that must each stay inside the chip's bank and clear of the window
   * where it reads character ROM. Every run is required; satisfying one does
   * not excuse another.
   */
  readonly ranges: readonly VicFetchRange[];
  /** The block-index expression this demand was inferred from. */
  readonly span: SourceSpan;
  /**
   * Set when the block is chosen at run time, so the runs cover every block the
   * program could select rather than bytes the chip reads at one moment. The
   * distinction matters to the author: one says "these bytes are read", the
   * other says "any of these bytes may be read".
   */
  readonly runtimeSelected?: true;
  /**
   * Set when the block number left along a route the proof does not follow, so
   * the runs cover the object because no narrower answer is available — not
   * because the hardware reads that much.
   */
  readonly unfollowed?: true;
}

/**
 * Merge fetched runs that touch or overlap, leaving genuine gaps alone.
 *
 * Two runs that meet describe one longer run, and saying so keeps the placement
 * check and any later evidence shorter. A gap between two runs is kept, because
 * the bytes between them carry no requirement and closing the gap would demand
 * storage the chip never reads.
 *
 * @param ranges Fetched runs in any order, possibly overlapping.
 * @returns The same requirement expressed as disjoint runs in address order.
 * @example mergeVicFetchRanges([{ offset: 64, bytes: 64 }, { offset: 0, bytes: 64 }])
 */
export function mergeVicFetchRanges(ranges: readonly VicFetchRange[]): readonly VicFetchRange[] {
  const ordered = [...ranges]
    .filter(({ bytes }) => bytes > 0)
    .sort((left, right) => left.offset - right.offset);
  const merged: VicFetchRange[] = [];
  for (const range of ordered) {
    const last = merged.at(-1);
    if (last !== undefined && range.offset <= last.offset + last.bytes) {
      const end = Math.max(last.offset + last.bytes, range.offset + range.bytes);
      merged[merged.length - 1] = Object.freeze({ offset: last.offset, bytes: end - last.offset });
      continue;
    }
    merged.push(Object.freeze({ ...range }));
  }
  return Object.freeze(merged);
}
