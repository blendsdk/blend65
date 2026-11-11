import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const D64_IMAGE_BYTES = 174_848;
const DIRECTORY_TRACK = 18;

/** Return the number of sectors on one standard 35-track D64 track. */
function sectorsOnTrack(track: number): number {
  if (track <= 17) return 21;
  if (track <= 24) return 19;
  if (track <= 30) return 18;
  return 17;
}

/** Return the byte offset of one track/sector pair in a 35-track D64 image. */
function sectorOffset(track: number, sector: number): number {
  let offset = 0;
  for (let index = 1; index < track; index += 1) offset += sectorsOnTrack(index) * 256;
  return offset + sector * 256;
}

/** One component record needed to locate and extend a published D64 unit. */
interface ComponentRecord {
  readonly id: string;
  readonly directoryNamePetsciiHex: string;
  readonly startTrack: number;
  readonly startSector: number;
  readonly blocks: number;
}

/** Narrow one published build record to the package facts used by the fixture builder. */
function packageFacts(value: unknown): {
  readonly bootComponentId: string;
  readonly components: readonly ComponentRecord[];
} {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Expected a build record");
  const record = value as Record<string, unknown>;
  const pkg = record.package;
  if (pkg === null || typeof pkg !== "object" || Array.isArray(pkg))
    throw new TypeError("Expected a package record");
  const packageRecord = pkg as Record<string, unknown>;
  if (typeof packageRecord.bootComponentId !== "string")
    throw new TypeError("Expected a boot component identity");
  if (!Array.isArray(packageRecord.components)) throw new TypeError("Expected package components");
  const components = packageRecord.components.map((component): ComponentRecord => {
    if (component === null || typeof component !== "object" || Array.isArray(component))
      throw new TypeError("Expected a component record");
    const entry = component as Record<string, unknown>;
    if (
      typeof entry.id !== "string" ||
      typeof entry.directoryNamePetsciiHex !== "string" ||
      typeof entry.startTrack !== "number" ||
      typeof entry.startSector !== "number" ||
      typeof entry.blocks !== "number"
    )
      throw new TypeError("Expected complete component facts");
    return {
      id: entry.id,
      directoryNamePetsciiHex: entry.directoryNamePetsciiHex,
      startTrack: entry.startTrack,
      startSector: entry.startSector,
      blocks: entry.blocks,
    };
  });
  return { bootComponentId: packageRecord.bootComponentId, components };
}

/**
 * Build the missing-unit and longer-replacement D64 variants used by the opt-in runtime suite.
 *
 * The success image is already published. The missing variant renames only the load unit's
 * directory entry so KERNAL LOAD cannot find it. The longer variant appends two readable sectors
 * to the unit chain so the stock loader writes past the declared destination. Both variants keep
 * the boot component and directory structure otherwise intact.
 *
 * @param directory Generation directory containing `runtime.d64` and `.build.json`.
 */
export async function createD64RuntimeVariants(directory: string): Promise<void> {
  const image = new Uint8Array(await readFile(join(directory, "runtime.d64")));
  if (image.byteLength !== D64_IMAGE_BYTES) throw new RangeError("Expected a 35-track D64 image");
  const facts = packageFacts(JSON.parse(await readFile(join(directory, ".build.json"), "utf8")));
  const unit = facts.components.find(({ id }) => id !== facts.bootComponentId);
  if (unit === undefined) throw new Error("The D64 generation has no load unit");

  const missing = new Uint8Array(image);
  let track = DIRECTORY_TRACK;
  let sector = 1;
  let renamed = false;
  while (track !== 0 && !renamed) {
    const block = missing.subarray(sectorOffset(track, sector), sectorOffset(track, sector) + 256);
    for (let slot = 0; slot < 8; slot += 1) {
      const base = slot * 32;
      if (block[base + 2] !== 0x82) continue;
      const name = [...block.subarray(base + 5, base + 21)];
      const hex = name.map((byte) => byte.toString(16).padStart(2, "0")).join("");
      if (hex === unit.directoryNamePetsciiHex) {
        block[base + 5] = 0x4d;
        renamed = true;
      }
    }
    track = block[0]!;
    sector = block[1]!;
  }
  if (!renamed) throw new Error("The load unit directory entry was not found");
  await writeFile(join(directory, "runtime-missing.d64"), missing);

  const longer = new Uint8Array(image);
  const bam = longer.subarray(
    sectorOffset(DIRECTORY_TRACK, 0),
    sectorOffset(DIRECTORY_TRACK, 0) + 256,
  );
  const takeFreeSector = (): { readonly track: number; readonly sector: number } => {
    for (let candidate = 35; candidate >= 1; candidate -= 1) {
      if (candidate === DIRECTORY_TRACK) continue;
      const base = 4 + (candidate - 1) * 4;
      for (let index = 0; index < sectorsOnTrack(candidate); index += 1) {
        const bit = (bam[base + 1 + Math.floor(index / 8)]! >> (index % 8)) & 1;
        if (bit === 1) {
          const byteIndex = base + 1 + Math.floor(index / 8);
          bam[byteIndex] = bam[byteIndex]! & ~(1 << (index % 8)) & 0xff;
          bam[base] = bam[base]! - 1;
          return { track: candidate, sector: index };
        }
      }
    }
    throw new Error("The D64 image has no free sector");
  };

  let chainTrack = unit.startTrack;
  let chainSector = unit.startSector;
  for (let index = 1; index < unit.blocks; index += 1) {
    const block = longer.subarray(
      sectorOffset(chainTrack, chainSector),
      sectorOffset(chainTrack, chainSector) + 256,
    );
    chainTrack = block[0]!;
    chainSector = block[1]!;
  }
  const first = takeFreeSector();
  const second = takeFreeSector();
  const final = longer.subarray(
    sectorOffset(chainTrack, chainSector),
    sectorOffset(chainTrack, chainSector) + 256,
  );
  final[0] = first.track;
  final[1] = first.sector;
  const firstBlock = longer.subarray(
    sectorOffset(first.track, first.sector),
    sectorOffset(first.track, first.sector) + 256,
  );
  for (let index = 2; index < 256; index += 1) firstBlock[index] = 0xee;
  firstBlock[0] = second.track;
  firstBlock[1] = second.sector;
  const secondBlock = longer.subarray(
    sectorOffset(second.track, second.sector),
    sectorOffset(second.track, second.sector) + 256,
  );
  for (let index = 0; index < 256; index += 1) secondBlock[index] = 0;
  const tail = 60;
  for (let index = 0; index < tail; index += 1) secondBlock[2 + index] = 0xdd;
  secondBlock[0] = 0;
  secondBlock[1] = 2 + tail;
  await writeFile(join(directory, "runtime-longer.d64"), longer);
}
