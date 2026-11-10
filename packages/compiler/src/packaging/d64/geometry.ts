/** Standard 1541 geometry and image offsets. */
export const D64_IMAGE_BYTES = 174_848;
export const D64_TRACKS = 35;
export const D64_SECTORS = 683;
export const D64_DATA_BLOCKS = 664;
export const D64_DIRECTORY_ENTRIES = 144;
export const D64_SYSTEM_TRACK = 18;

/** Sectors per track for tracks 1–35. */
export function sectorsOnTrack(track: number): number {
  if (track >= 1 && track <= 17) return 21;
  if (track >= 18 && track <= 24) return 19;
  if (track >= 25 && track <= 30) return 18;
  if (track >= 31 && track <= 35) return 17;
  throw new Error(`Invalid D64 track ${track}`);
}

/** Zero-based byte offset of one sector in the image. */
export function sectorOffset(track: number, sector: number): number {
  if (track < 1 || track > D64_TRACKS) throw new Error(`Invalid D64 track ${track}`);
  const sectors = sectorsOnTrack(track);
  if (sector < 0 || sector >= sectors) throw new Error(`Invalid D64 sector ${sector}`);
  let offset = 0;
  for (let current = 1; current < track; current += 1) {
    offset += sectorsOnTrack(current) * 256;
  }
  return offset + sector * 256;
}

/** Standard directory chain order for track 18. */
export const DIRECTORY_CHAIN: readonly number[] = Object.freeze([
  1, 4, 7, 10, 13, 16, 2, 5, 8, 11, 14, 17, 3, 6, 9, 12, 15, 18,
]);

/** Standard file interleave sequence within one track. */
export function interleaveOrder(track: number): readonly number[] {
  const sectors = sectorsOnTrack(track);
  const order: number[] = [];
  const seen = new Set<number>();
  let sector = 0;
  for (let count = 0; count < sectors; count += 1) {
    while (seen.has(sector)) sector = (sector + 1) % sectors;
    order.push(sector);
    seen.add(sector);
    if (count + 1 < sectors) sector = (sector + 10) % sectors;
  }
  return Object.freeze(order);
}
