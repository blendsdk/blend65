import { D64_SYSTEM_TRACK, sectorsOnTrack, sectorOffset } from "./geometry.js";
import { paddedD64Name } from "./names.js";

/** One allocated sector in the image. */
export interface D64SectorRef {
  readonly track: number;
  readonly sector: number;
}

/** Build the complete 256-byte BAM/header sector at 18/0. */
export function buildD64Bam(input: {
  readonly label: readonly number[];
  readonly diskId: readonly number[];
  readonly used: readonly D64SectorRef[];
}): Uint8Array {
  const sector = new Uint8Array(256);
  sector[0] = D64_SYSTEM_TRACK;
  sector[1] = 1;
  sector[2] = 0x41;
  sector[3] = 0;
  const used = new Set(input.used.map(({ track, sector: index }) => `${track}:${index}`));
  for (let track = 1; track <= 35; track += 1) {
    const sectors = sectorsOnTrack(track);
    let free = 0;
    const map = [0, 0, 0];
    for (let index = 0; index < sectors; index += 1) {
      if (!used.has(`${track}:${index}`)) {
        free += 1;
        map[Math.floor(index / 8)]! |= 1 << (index % 8);
      }
    }
    if (track === D64_SYSTEM_TRACK) free = 0;
    const base = 4 + (track - 1) * 4;
    sector[base] = track === D64_SYSTEM_TRACK ? 0 : free;
    sector[base + 1] = track === D64_SYSTEM_TRACK ? 0 : map[0]!;
    sector[base + 2] = track === D64_SYSTEM_TRACK ? 0 : map[1]!;
    sector[base + 3] = track === D64_SYSTEM_TRACK ? 0 : map[2]!;
  }
  sector.set(paddedD64Name(input.label), 144);
  sector[160] = 0xa0;
  sector[161] = 0xa0;
  sector.set(input.diskId, 162);
  sector[164] = 0xa0;
  sector[165] = 0x32;
  sector[166] = 0x41;
  for (let index = 167; index <= 170; index += 1) sector[index] = 0xa0;
  return sector;
}

/** Copy one sector into the complete image. */
export function writeSector(
  image: Uint8Array,
  track: number,
  sector: number,
  bytes: Uint8Array,
): void {
  if (bytes.length !== 256) throw new Error("D64 sector must be exactly 256 bytes");
  image.set(bytes, sectorOffset(track, sector));
}
