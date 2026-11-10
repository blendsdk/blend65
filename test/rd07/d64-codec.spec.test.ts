import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildD64Image } from "@blend65/compiler";
import type { D64InputFile } from "@blend65/compiler";

const IMAGE_BYTES = 174_848;
const SYSTEM_TRACK = 18;

/** Decode one D64 image without importing the production serializer. */
function decode(image: Uint8Array) {
  expect(image.length).toBe(IMAGE_BYTES);
  const sectorsOnTrack = (track: number): number => {
    if (track >= 1 && track <= 17) return 21;
    if (track >= 18 && track <= 24) return 19;
    if (track >= 25 && track <= 30) return 18;
    if (track >= 31 && track <= 35) return 17;
    throw new Error(`bad track ${track}`);
  };
  const offset = (track: number, sector: number): number => {
    let base = 0;
    for (let current = 1; current < track; current += 1) base += sectorsOnTrack(current) * 256;
    return base + sector * 256;
  };
  const sector = (track: number, sectorIndex: number): Uint8Array =>
    image.subarray(offset(track, sectorIndex), offset(track, sectorIndex) + 256);
  const bam = sector(SYSTEM_TRACK, 0);
  expect(bam[0]).toBe(SYSTEM_TRACK);
  expect(bam[1]).toBe(1);
  expect(bam[2]).toBe(0x41);
  const label = [...bam.subarray(144, 160)];
  const id = [...bam.subarray(162, 164)];
  expect([...bam.subarray(165, 167)]).toEqual([0x32, 0x41]);
  expect([...bam.subarray(167, 171)]).toEqual([0xa0, 0xa0, 0xa0, 0xa0]);
  const freeByTrack: number[] = [];
  for (let track = 1; track <= 35; track += 1) {
    const base = 4 + (track - 1) * 4;
    freeByTrack.push(bam[base]!);
  }
  expect(freeByTrack[SYSTEM_TRACK - 1]).toBe(0);
  const chain: { track: number; sector: number }[] = [];
  let directoryTrack = SYSTEM_TRACK;
  let directorySector = 1;
  const entries: {
    type: number;
    startTrack: number;
    startSector: number;
    name: number[];
    blocks: number;
  }[] = [];
  while (directoryTrack !== 0) {
    const block = sector(directoryTrack, directorySector);
    for (let slot = 0; slot < 8; slot += 1) {
      const base = slot * 32;
      const type = block[base + 2]!;
      if (type === 0) continue;
      entries.push({
        type,
        startTrack: block[base + 3]!,
        startSector: block[base + 4]!,
        name: [...block.subarray(base + 5, base + 21)],
        blocks: block[base + 30]! | (block[base + 31]! << 8),
      });
    }
    chain.push({ track: directoryTrack, sector: directorySector });
    const nextTrack = block[0]!;
    const nextSector = block[1]!;
    if (nextTrack === 0) break;
    directoryTrack = nextTrack;
    directorySector = nextSector;
  }
  const files = entries.map((entry) => {
    const chunks: number[] = [];
    let track = entry.startTrack;
    let index = entry.startSector;
    let sectors = 0;
    const sectorList: { track: number; sector: number }[] = [];
    const visited = new Set<string>();
    for (;;) {
      const key = `${track}:${index}`;
      expect(visited.has(key)).toBe(false);
      visited.add(key);
      const block = sector(track, index);
      sectorList.push({ track, sector: index });
      sectors += 1;
      const nextTrack = block[0]!;
      const nextSector = block[1]!;
      if (nextTrack === 0) {
        const payload = [...block.subarray(2, nextSector + 1)];
        chunks.push(...payload);
        break;
      }
      chunks.push(...block.subarray(2));
      track = nextTrack;
      index = nextSector;
    }
    expect(sectors).toBe(entry.blocks);
    return { ...entry, bytes: chunks, sectors: sectorList };
  });
  const used = new Set(
    files.flatMap(({ sectors }) => sectors.map(({ track, sector: index }) => `${track}:${index}`)),
  );
  for (let track = 1; track <= 35; track += 1) {
    const base = 4 + (track - 1) * 4;
    let freeBits = 0;
    for (let index = 0; index < sectorsOnTrack(track); index += 1) {
      const byte = bam[base + 1 + Math.floor(index / 8)]!;
      const isFree = (byte >> (index % 8)) & 1;
      freeBits += isFree;
      if (track === SYSTEM_TRACK) expect(isFree).toBe(0);
      else expect(isFree).toBe(used.has(`${track}:${index}`) ? 0 : 1);
    }
    expect(bam[base]).toBe(track === SYSTEM_TRACK ? 0 : freeBits);
  }
  return { bam, label, id, chain, entries, files };
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

const boot: D64InputFile = {
  id: "boot",
  name: [0x42, 0x4f, 0x4f, 0x54],
  loadAddress: 0x0801,
  body: [1, 2, 3, 4, 5],
  aliases: [],
  destinationCalls: [],
};

const unit: D64InputFile = {
  id: "unit-a",
  name: [0x4c, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x31],
  loadAddress: 0,
  body: [9, 8, 7, 6],
  aliases: ["asset::level"],
  destinationCalls: [{ sourceId: "src/game.blend", start: 10, end: 20 }],
};

describe("D64 codec", () => {
  // The BAM, directory, chain and component bytes decode exactly.
  it("should build one standard image with boot and unit entries", () => {
    const image = buildD64Image({
      projectName: "GAME",
      semanticHash: "ab".repeat(32),
      boot,
      units: [unit],
    });
    const decoded = decode(image.bytes);
    expect(decoded.chain[0]).toEqual({ track: 18, sector: 1 });
    expect(decoded.entries).toHaveLength(2);
    expect(decoded.entries[0]!.type).toBe(0x82);
    expect(decoded.entries[0]!.name.slice(0, 4)).toEqual([0x42, 0x4f, 0x4f, 0x54]);
    expect(decoded.files[0]!.bytes).toEqual([0x01, 0x08, 1, 2, 3, 4, 5]);
    expect(decoded.files[1]!.bytes).toEqual([0x00, 0x00, 9, 8, 7, 6]);
    expect(decoded.id).toEqual([0x41, 0x42]);
    expect(image.freeBlocks).toBe(664 - decoded.files.reduce((sum, f) => sum + f.blocks, 0));
    expect(image.bamSha256).toBe(sha256(decoded.bam));
  });

  // Identical inputs produce byte-identical images.
  it("should be deterministic for identical inputs", () => {
    const input = {
      projectName: "GAME",
      semanticHash: "cd".repeat(32),
      boot,
      units: [unit],
    } as const;
    const first = buildD64Image(input);
    const second = buildD64Image(input);
    expect(Buffer.from(first.bytes).equals(Buffer.from(second.bytes))).toBe(true);
    expect(first.bamSha256).toBe(second.bamSha256);
    expect(first.directorySha256).toBe(second.directorySha256);
  });

  // A zero-byte unit still occupies one 2-byte header sector.
  it("should represent a zero-byte unit with one data sector", () => {
    const image = buildD64Image({
      projectName: "GAME",
      semanticHash: "ef".repeat(32),
      boot,
      units: [{ ...unit, body: [] }],
    });
    const decoded = decode(image.bytes);
    expect(decoded.files[1]!.bytes).toEqual([0x00, 0x00]);
    expect(decoded.files[1]!.blocks).toBe(1);
  });

  // Exactly 664 data blocks fit; one more fails before producing an image.
  it("should accept exactly 664 blocks and reject one more", () => {
    const exactBody = 664 * 254 - 2;
    const exact = buildD64Image({
      projectName: "GAME",
      semanticHash: "11".repeat(32),
      boot: { ...boot, body: Array.from({ length: exactBody }, () => 0) },
      units: [],
    });
    expect(exact.usedBlocks).toBe(664);
    expect(exact.freeBlocks).toBe(0);
    expect(() =>
      buildD64Image({
        projectName: "GAME",
        semanticHash: "22".repeat(32),
        boot: { ...boot, body: Array.from({ length: exactBody + 1 }, () => 0) },
        units: [],
      }),
    ).toThrow(/D64_CAPACITY/u);
  });

  // Names longer than 16 bytes are rejected, never truncated.
  it("should reject an over-length name", () => {
    expect(() =>
      buildD64Image({
        projectName: "A".repeat(17),
        semanticHash: "33".repeat(32),
        boot,
        units: [],
      }),
    ).toThrow(/D64_NAME/u);
  });
});
