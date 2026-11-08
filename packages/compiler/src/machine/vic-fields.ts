/** Layout-resolved VIC field transforms available to source operations. */
export type VicFieldTransform =
  | "vic-sprite-block"
  | "vic-charset-select"
  | "vic-bitmap-select"
  | "vic-screen-select";

/** Exact byte count consumed by one VIC-visible object. */
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
  const offset = address - vicBankStart;
  if (offset < 0 || offset > 0x3fff) return null;
  const end = address + vicConsumerBytes(transform);
  if (
    characterRomStart !== undefined &&
    characterRomEnd !== undefined &&
    address < characterRomEnd + 1 &&
    end > characterRomStart
  ) {
    return null;
  }
  switch (transform) {
    case "vic-sprite-block":
      return offset % 64 === 0 ? offset / 64 : null;
    case "vic-charset-select":
      return offset % 2048 === 0 ? ((offset / 2048) & 0x07) << 1 : null;
    case "vic-bitmap-select":
      return offset % 8192 === 0 ? ((offset / 8192) & 0x01) << 3 : null;
    case "vic-screen-select":
      return offset % 1024 === 0 ? ((offset / 1024) & 0x0f) << 4 : null;
  }
}
