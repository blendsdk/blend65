import { D64_DATA_BLOCKS, D64_SYSTEM_TRACK, interleaveOrder } from "./geometry.js";
import type { D64SectorRef } from "./bam.js";
import { paddedD64Name } from "./names.js";

/** One input file before allocation. */
export interface D64InputFile {
  readonly id: string;
  readonly name: readonly number[];
  readonly loadAddress: number;
  readonly body: readonly number[];
  readonly aliases: readonly string[];
  readonly destinationCalls: readonly {
    readonly sourceId: string;
    readonly start: number;
    readonly end: number;
  }[];
}

/** One allocated file with its exact on-disk bytes and sector chain. */
export interface D64PlacedFile {
  readonly file: D64InputFile;
  readonly bytes: readonly number[];
  readonly sectors: readonly D64SectorRef[];
  readonly blocks: number;
}

/** Allocate every file in canonical order with the standard 1541 interleave. */
export function allocateD64Files(files: readonly D64InputFile[]): readonly D64PlacedFile[] {
  const used = new Set<string>();
  for (let sector = 0; sector <= 18; sector += 1) used.add(`${D64_SYSTEM_TRACK}:${sector}`);
  const result: D64PlacedFile[] = [];
  for (const file of files) {
    const bytes = [file.loadAddress & 0xff, (file.loadAddress >> 8) & 0xff, ...file.body];
    const blocks = Math.max(1, Math.ceil(bytes.length / 254));
    const sectors: D64SectorRef[] = [];
    for (let track = 1; track <= 35 && sectors.length < blocks; track += 1) {
      if (track === D64_SYSTEM_TRACK) continue;
      for (const sector of interleaveOrder(track)) {
        if (sectors.length >= blocks) break;
        const key = `${track}:${sector}`;
        if (used.has(key)) continue;
        used.add(key);
        sectors.push(Object.freeze({ track, sector }));
      }
    }
    if (sectors.length !== blocks) {
      throw new Error(
        `D64_CAPACITY: only ${D64_DATA_BLOCKS} data blocks are available; the image does not fit`,
      );
    }
    result.push(Object.freeze({ file, bytes, sectors: Object.freeze(sectors), blocks }));
  }
  return Object.freeze(result);
}

/** Build one file-sector chain exactly as the 1541 expects. */
export function d64FileSector(placed: D64PlacedFile, index: number): Uint8Array {
  const payload = placed.bytes.slice(index * 254, (index + 1) * 254);
  const sector = new Uint8Array(256);
  const next = placed.sectors[index + 1];
  if (next !== undefined) {
    sector[0] = next.track;
    sector[1] = next.sector;
  } else {
    sector[0] = 0;
    sector[1] = payload.length + 1;
  }
  sector.set(payload, 2);
  return sector;
}

/** Build one 32-byte directory entry for a placed file. */
export function d64DirectoryEntry(placed: D64PlacedFile, link: D64SectorRef | null): Uint8Array {
  const entry = new Uint8Array(32);
  if (link !== null) {
    entry[0] = link.track;
    entry[1] = link.sector;
  }
  entry[2] = 0x82;
  entry[3] = placed.sectors[0]!.track;
  entry[4] = placed.sectors[0]!.sector;
  entry.set(paddedD64Name(placed.file.name), 5);
  entry[30] = placed.blocks & 0xff;
  entry[31] = (placed.blocks >> 8) & 0xff;
  return entry;
}
