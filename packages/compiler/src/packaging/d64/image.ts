import { createHash } from "node:crypto";
import { D64_DATA_BLOCKS, D64_IMAGE_BYTES, D64_SYSTEM_TRACK, sectorOffset } from "./geometry.js";
import { allocateD64Files, d64FileSector } from "./allocator.js";
import type { D64InputFile, D64PlacedFile } from "./allocator.js";
import { buildD64Bam, writeSector } from "./bam.js";
import { buildD64Directory } from "./directory.js";
import { diskD64Id, encodeD64Name, paddedD64Name } from "./names.js";

/** Complete deterministic D64 image and its structural facts. */
export interface D64Image {
  readonly bytes: Uint8Array;
  readonly label: readonly number[];
  readonly diskId: readonly number[];
  readonly files: readonly D64PlacedFile[];
  readonly freeBlocks: number;
  readonly usedBlocks: number;
  readonly bamSha256: string;
  readonly directorySha256: string;
  readonly allocationPolicyId: "cbm-dos-1541-interleave-v1";
}

/** Build one standard 35-track D64 from a boot file and ordered unit files. */
export function buildD64Image(input: {
  readonly projectName: string;
  readonly semanticHash: string;
  readonly boot: D64InputFile;
  readonly units: readonly D64InputFile[];
}): D64Image {
  const label = encodeD64Name(input.projectName);
  const diskId = diskD64Id(input.semanticHash);
  const files = allocateD64Files([input.boot, ...input.units]);
  const usedBlocks = files.reduce((sum, file) => sum + file.blocks, 0);
  if (usedBlocks > D64_DATA_BLOCKS) {
    throw new Error(
      `D64_CAPACITY: ${usedBlocks} data blocks exceed the ${D64_DATA_BLOCKS}-block limit`,
    );
  }
  if (files.length > 144) {
    throw new Error(`D64_CAPACITY: ${files.length} directory entries exceed 144`);
  }
  const bytes = new Uint8Array(D64_IMAGE_BYTES);
  const used = files.flatMap((file) => file.sectors);
  const bam = buildD64Bam({ label, diskId, used });
  writeSector(bytes, D64_SYSTEM_TRACK, 0, bam);
  const directory = buildD64Directory(files);
  const chain = [1, 4, 7, 10, 13, 16, 2, 5, 8, 11, 14, 17, 3, 6, 9, 12, 15, 18];
  directory.forEach((sector, index) => {
    writeSector(bytes, D64_SYSTEM_TRACK, chain[index]!, sector);
  });
  for (const placed of files) {
    placed.sectors.forEach(({ track, sector }, index) => {
      bytes.set(d64FileSector(placed, index), sectorOffset(track, sector));
    });
  }
  return Object.freeze({
    bytes,
    label: paddedD64Name(label),
    diskId,
    files: Object.freeze(files),
    freeBlocks: D64_DATA_BLOCKS - usedBlocks,
    usedBlocks,
    bamSha256: sha256(bam),
    directorySha256: sha256(Uint8Array.from(directory.flatMap((sector) => [...sector]))),
    allocationPolicyId: "cbm-dos-1541-interleave-v1",
  });
}

/** Hash one byte sequence as lowercase SHA-256. */
function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
