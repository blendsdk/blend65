import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { SourceSpan } from "../../project/types.js";
import type { AssetHandlerRequest } from "../asset-handler.js";
import { charpadHandler } from "./charpad.js";

const SPAN: SourceSpan = Object.freeze({ sourceId: "src/game.blend", start: 0, end: 10 });

/** Build one minimal CTM v9 project with a single map cell. */
function ctm(options: {
  readonly chars: number;
  readonly tileMode: boolean;
  readonly tileCell?: number;
  readonly displayMode?: number;
  readonly colorMethod?: number;
}): Buffer {
  const header = Buffer.alloc(19);
  header.write("CTM", 0, "ascii");
  header[3] = 9;
  header[4] = options.displayMode ?? 1;
  header[5] = options.colorMethod ?? 0;
  header[6] = options.tileMode ? 1 : 0;
  header.writeUInt16LE(10, 7);
  header.writeUInt16LE(10, 9);
  const parts: Buffer[] = [];
  const block = (number: number) => Buffer.from([0xda, 0xb0 | (number & 0x0f)]);
  const count = (items: number) => Buffer.from([(items - 1) & 0xff, ((items - 1) >> 8) & 0xff]);
  parts.push(block(0), count(options.chars), Buffer.alloc(options.chars * 8, 0x55));
  parts.push(block(1), Buffer.alloc(options.chars, 0x01));
  if (options.colorMethod === 2) {
    parts.push(block(2), Buffer.alloc(options.chars * (options.displayMode === 3 ? 2 : 3), 0x02));
  }
  let next = options.colorMethod === 2 ? 3 : 2;
  if (options.tileMode) {
    parts.push(
      block(next++),
      count(1),
      Buffer.from([1, 1]),
      Buffer.from([options.tileCell! & 0xff, (options.tileCell! >> 8) & 0xff]),
    );
    parts.push(block(next++), Buffer.from([1]));
    parts.push(block(next++), Buffer.from([0]));
  }
  parts.push(block(next++), Buffer.from([1, 0, 1, 0]), Buffer.from([0, 0]));
  return Buffer.concat([header, ...parts]);
}

/** Build one request over exact CTM bytes. */
function request(bytes: Buffer, selector: string): AssetHandlerRequest {
  return Object.freeze({
    sourceId: "src/game.blend",
    literalPath: "assets/level.ctm",
    resolvedPath: "assets/level.ctm",
    selector,
    owner: "resident",
    span: SPAN,
    declaration: "LEVEL",
    profileId: "c64-pal-prg-kernal-6581",
    bytes: Object.freeze([...bytes]),
    inputSha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

describe("CharPad internals", () => {
  // A tile value above 12 bits makes packed-12 unavailable but keeps the word form.
  it("should reject packed-12 when a tile value exceeds 4095", () => {
    const bytes = ctm({ chars: 4097, tileMode: true, tileCell: 4096 });
    const packed = charpadHandler.parse(request(bytes, "tiles_packed12"));
    expect(packed.kind).toBe("failure");
    if (packed.kind !== "failure") throw new Error("Expected packed-12 rejection");
    expect(packed.diagnostic.code).toBe("E10133");
    const word = charpadHandler.parse(request(bytes, "tiles_word"));
    expect(word.kind).toBe("output");
    if (word.kind !== "output") throw new Error("Expected word form");
    expect(word.value.kind).toBe("embedded");
    if (word.value.kind !== "embedded") throw new Error("Expected bytes");
    expect(word.value.bytes).toEqual([0, 16]);
  });

  // A no-tile project still exposes the map and the default tile dimensions.
  it("should keep map data and default tile metadata without a tile layer", () => {
    const bytes = ctm({ chars: 2, tileMode: false });
    const mode = charpadHandler.parse(request(bytes, "tile_mode"));
    expect(mode.kind).toBe("output");
    if (mode.kind !== "output") throw new Error("Expected tile mode");
    expect(mode.value).toMatchObject({ kind: "embedded-scalar", value: false });
    const width = charpadHandler.parse(request(bytes, "tile_width"));
    expect(width.kind).toBe("output");
    if (width.kind !== "output") throw new Error("Expected width");
    expect(width.value).toMatchObject({ value: 1n });
    const tiles = charpadHandler.parse(request(bytes, "tiles"));
    expect(tiles.kind).toBe("failure");
    if (tiles.kind !== "failure") throw new Error("Expected no tiles");
    expect(tiles.diagnostic.code).toBe("E10133");
  });

  // Per-char bitmap colors use three bytes per character.
  it("should use three color bytes per character for bitmap multicolor", () => {
    const bytes = ctm({ chars: 2, tileMode: false, displayMode: 4, colorMethod: 2 });
    const colors = charpadHandler.parse(request(bytes, "colors"));
    expect(colors.kind).toBe("output");
    if (colors.kind !== "output") throw new Error("Expected colors");
    expect(colors.value.kind).toBe("embedded");
    if (colors.value.kind !== "embedded") throw new Error("Expected color bytes");
    expect(colors.value.bytes).toHaveLength(6);
  });
});
