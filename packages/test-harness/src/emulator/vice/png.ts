/**
 * Zero-dependency PNG encoder for emulator screenshots (RD-12 AC-09, AR-H4).
 *
 * VICE's `DISPLAY_GET` returns an INDEXED frame buffer; `PALETTE_GET` returns the
 * active palette. This encoder maps indexed pixels → RGB and emits a minimal
 * **truecolor** PNG (signature, IHDR, one IDAT of zlib-deflated scanlines, IEND),
 * each chunk carrying its CRC-32. Uses only Node's built-in `zlib` — no external
 * dependency (AR-H11), matching the AR-V2 zero-dep ethos.
 *
 * The screenshot is a FAILURE ARTIFACT only (R18) — never golden-matched — so a
 * plain uncompressed-friendly truecolor encoding is more than adequate.
 */

import { deflateSync } from "node:zlib";
import type { DisplayFrame, PaletteEntry } from "./protocol.js";

/** The 8-byte PNG file signature. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** PNG colour type 2 = truecolor (RGB). */
const COLOR_TYPE_TRUECOLOR = 2;
/** Bit depth per channel. */
const BIT_DEPTH = 8;

/** Precomputed CRC-32 table (IEEE 802.3 polynomial), built once at module load. */
const CRC_TABLE: number[] = (() => {
  const table: number[] = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** Compute the PNG/zlib CRC-32 of `buf`. */
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Assemble one PNG chunk: length(4 BE), type(4), data, CRC-32(4 BE) over type+data. */
function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

/**
 * Encode an indexed display frame + palette into a truecolor PNG (AR-H4).
 *
 * @param frame The indexed frame from `parseDisplayGet` (`width`/`height`/`data`).
 * @param palette The RGB palette from `parsePaletteGet`; out-of-range indices map to black.
 * @returns The complete PNG file bytes.
 */
export function encodePng(frame: DisplayFrame, palette: PaletteEntry[]): Buffer {
  const { width, height, data } = frame;

  // IHDR: width(4 BE), height(4 BE), bit depth, colour type, compression(0),
  // filter(0), interlace(0).
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = BIT_DEPTH;
  ihdr[9] = COLOR_TYPE_TRUECOLOR;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Raw image: each scanline is a filter byte (0 = None) followed by RGB triples.
  const stride = 1 + width * 3;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const index = data[y * width + x] ?? 0;
      const entry = palette[index] ?? { r: 0, g: 0, b: 0 };
      const p = rowStart + 1 + x * 3;
      raw[p] = entry.r;
      raw[p + 1] = entry.g;
      raw[p + 2] = entry.b;
    }
  }

  const idat = deflateSync(raw);
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
