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
  readonly mapCell?: number;
  readonly mapWidth?: number;
  readonly mapHeight?: number;
  readonly mapCells?: readonly number[];
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
  const width = options.mapWidth ?? 1;
  const height = options.mapHeight ?? 1;
  const cells = options.mapCells ?? [options.mapCell ?? 0];
  parts.push(
    block(next++),
    Buffer.from([width & 0xff, (width >> 8) & 0xff, height & 0xff, (height >> 8) & 0xff]),
    Buffer.from(cells.flatMap((cell) => [cell & 0xff, (cell >> 8) & 0xff])),
  );
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
  // Inventory types use the exact parsed slices, including packed-12 length.
  it("should publish exact selector extents and filter unavailable remedies", () => {
    const result = charpadHandler.parse(
      request(ctm({ chars: 4, tileMode: true, tileCell: 3 }), "charset"),
    );
    if (result.kind !== "output") throw new Error("Expected charset output");
    const extent = (name: string) => {
      const type = result.selectors.find(({ name: selector }) => selector === name)?.type;
      return type?.kind === "array" ? type.array : undefined;
    };
    expect(extent("charset")).toMatchObject({ length: 32 });
    expect(extent("char_materials")).toMatchObject({ length: 4 });
    expect(extent("colors")).toMatchObject({ length: 3 });
    expect(extent("tiles")).toMatchObject({ length: 1, size: 1 });
    expect(extent("tiles_packed12")).toMatchObject({ length: 2 });
    expect(extent("map")).toMatchObject({ length: 1 });
    expect(extent("map_packed12")).toMatchObject({ length: 2 });
    const missing = charpadHandler.parse(request(ctm({ chars: 4, tileMode: false }), "tiles"));
    if (missing.kind !== "failure") throw new Error("Expected unavailable tile failure");
    expect(missing.diagnostic.message).not.toContain("'tiles_packed12'");
  });
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

  // The map packed-12 form is available up to index 4095 and absent above it.
  it("should expose map packed-12 only below 4096", () => {
    const packed = charpadHandler.parse(
      request(ctm({ chars: 0x300, tileMode: false, mapCell: 0x123 }), "map_packed12"),
    );
    expect(packed.kind).toBe("output");
    if (packed.kind !== "output") throw new Error("Expected packed map");
    expect(packed.value).toMatchObject({ kind: "embedded", bytes: [0x23, 0x01] });
    expect(packed.value.type).toMatchObject({ kind: "array", length: 2, size: 2 });
    const unavailable = charpadHandler.parse(
      request(ctm({ chars: 4097, tileMode: false, mapCell: 4096 }), "map_packed12"),
    );
    expect(unavailable.kind).toBe("failure");
    if (unavailable.kind !== "failure") throw new Error("Expected packed map rejection");
    expect(unavailable.diagnostic.code).toBe("E10133");
  });

  // Packed-12 output types must describe the packed byte count, including the
  // trailing high-nibble byte for an odd cell count.
  it("should type map packed-12 with its complete packed length", () => {
    const packed = charpadHandler.parse(
      request(
        ctm({
          chars: 4097,
          tileMode: false,
          mapWidth: 3,
          mapHeight: 1,
          mapCells: [0x123, 0x456, 0x789],
        }),
        "map_packed12",
      ),
    );
    expect(packed.kind).toBe("output");
    if (packed.kind !== "output") throw new Error("Expected packed map");
    expect(packed.value.kind).toBe("embedded");
    if (packed.value.kind !== "embedded") throw new Error("Expected packed bytes");
    expect(packed.value.bytes).toEqual([0x23, 0x56, 0x89, 0x41, 0x07]);
    expect(packed.value.type).toMatchObject({ kind: "array", length: 5, size: 5 });
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
