/**
 * Implementation tests for the zero-dependency PNG encoder. Encodes a synthetic
 * indexed frame and verifies the PNG structure end-to-end: signature, IHDR fields,
 * IEND, per-chunk CRC-32, and that the pixels decode back to the palette colours.
 */

import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
import { encodePng } from "./png.js";
import type { DisplayFrame, PaletteEntry } from "./protocol.js";

/** Recompute a PNG/zlib CRC-32 for chunk verification (independent of the encoder). */
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Walk the PNG chunk list, verifying each chunk's CRC and returning them by type. */
function readChunks(png: Buffer): Array<{ type: string; data: Buffer }> {
  const chunks: Array<{ type: string; data: Buffer }> = [];
  let off = 8; // skip signature
  while (off < png.length) {
    const len = png.readUInt32BE(off);
    const type = png.subarray(off + 4, off + 8).toString("ascii");
    const data = png.subarray(off + 8, off + 8 + len);
    const crc = png.readUInt32BE(off + 8 + len);
    expect(crc).toBe(crc32(png.subarray(off + 4, off + 8 + len)));
    chunks.push({ type, data: Buffer.from(data) });
    off += 12 + len;
  }
  return chunks;
}

const PALETTE: PaletteEntry[] = [
  { r: 0, g: 0, b: 0 },
  { r: 255, g: 0, b: 0 },
  { r: 0, g: 255, b: 0 },
  { r: 0, g: 0, b: 255 },
];

const FRAME: DisplayFrame = {
  width: 2,
  height: 2,
  bpp: 8,
  data: new Uint8Array([0, 1, 2, 3]), // black, red, green, blue
};

describe("PNG encoder structure", () => {
  it("emits the 8-byte signature, an IHDR, an IDAT, and an IEND in order", () => {
    const png = encodePng(FRAME, PALETTE);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const chunks = readChunks(png); // also asserts every CRC-32
    expect(chunks.map((c) => c.type)).toEqual(["IHDR", "IDAT", "IEND"]);
  });

  it("IHDR carries the frame size, 8-bit depth, and truecolor (colour type 2)", () => {
    const [ihdr] = readChunks(encodePng(FRAME, PALETTE));
    expect(ihdr.data.readUInt32BE(0)).toBe(2); // width
    expect(ihdr.data.readUInt32BE(4)).toBe(2); // height
    expect(ihdr.data[8]).toBe(8); // bit depth
    expect(ihdr.data[9]).toBe(2); // colour type: truecolor
  });

  it("IDAT inflates to filter-prefixed RGB scanlines matching the palette", () => {
    const chunks = readChunks(encodePng(FRAME, PALETTE));
    const idat = chunks.find((c) => c.type === "IDAT")!;
    const raw = inflateSync(idat.data);
    // Two rows of (1 filter byte + 2px * 3 bytes) = 2 * 7 = 14 bytes.
    expect(raw.length).toBe(2 * (1 + 2 * 3));
    // Row 0: filter 0, then black (0,0,0), red (255,0,0).
    expect([...raw.subarray(0, 7)]).toEqual([0, 0, 0, 0, 255, 0, 0]);
    // Row 1: filter 0, then green (0,255,0), blue (0,0,255).
    expect([...raw.subarray(7, 14)]).toEqual([0, 0, 255, 0, 0, 0, 255]);
  });

  it("maps an out-of-range palette index to black rather than throwing", () => {
    const frame: DisplayFrame = { width: 1, height: 1, bpp: 8, data: new Uint8Array([99]) };
    const chunks = readChunks(encodePng(frame, PALETTE));
    const raw = inflateSync(chunks.find((c) => c.type === "IDAT")!.data);
    expect([...raw]).toEqual([0, 0, 0, 0]); // filter + black
  });
});
