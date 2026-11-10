import { DIRECTORY_CHAIN, D64_SYSTEM_TRACK } from "./geometry.js";
import { d64DirectoryEntry } from "./allocator.js";
import type { D64PlacedFile } from "./allocator.js";

/** Build the 18 directory sectors in chain order. */
export function buildD64Directory(files: readonly D64PlacedFile[]): readonly Uint8Array[] {
  if (files.length > 144) {
    throw new Error(`D64_CAPACITY: ${files.length} directory entries exceed the 144-entry limit`);
  }
  const sectors: Uint8Array[] = [];
  let fileIndex = 0;
  for (let chainIndex = 0; chainIndex < DIRECTORY_CHAIN.length; chainIndex += 1) {
    const sector = new Uint8Array(256);
    const next = DIRECTORY_CHAIN[chainIndex + 1];
    if (next === undefined) {
      sector[0] = 0;
      sector[1] = 0xff;
    } else {
      sector[0] = D64_SYSTEM_TRACK;
      sector[1] = next;
    }
    for (let slot = 0; slot < 8 && fileIndex < files.length; slot += 1) {
      const entry = d64DirectoryEntry(
        files[fileIndex]!,
        slot === 0 && next !== undefined ? { track: D64_SYSTEM_TRACK, sector: next } : null,
      );
      sector.set(entry, slot * 32);
      fileIndex += 1;
    }
    sectors.push(sector);
  }
  if (fileIndex !== files.length) {
    throw new Error("D64_STRUCTURE: directory did not consume every file");
  }
  return Object.freeze(sectors);
}
