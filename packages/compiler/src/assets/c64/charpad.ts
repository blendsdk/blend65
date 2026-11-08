import { SCALAR_TYPES } from "../../frontend/constants.js";
import { nativeAssetDiagnostic } from "../asset-diagnostics.js";
import {
  createNativeOutput,
  type AssetConstraint,
  type AssetHandler,
  type AssetHandlerFailure,
  type AssetHandlerRequest,
  type AssetSelectorInfo,
} from "../asset-handler.js";

const HANDLER_KEY = "charpad";
const HANDLER_VERSION = "3.80";
const HEADER_BYTES = 19;

/** Build one source-linked structural failure. */
function failure(
  request: AssetHandlerRequest,
  code: string,
  field: string,
  offset: number,
  remedy: string,
): AssetHandlerFailure {
  return Object.freeze({
    kind: "failure",
    diagnostic: nativeAssetDiagnostic({
      code,
      declaration: request.declaration,
      literalPath: request.literalPath,
      handlerKey: HANDLER_KEY,
      handlerVersion: HANDLER_VERSION,
      field,
      offset,
      remedy,
      span: request.span,
    }),
  });
}

/** Return the number of native color bytes per item for one display mode. */
function colorWidth(displayMode: number): number {
  return displayMode === 3 ? 2 : displayMode === 4 ? 3 : 1;
}

/** Build one byte-array type. */
function byteArray(length: number) {
  return Object.freeze({
    kind: "array" as const,
    element: SCALAR_TYPES.byte,
    length,
    size: length,
  });
}

/** Build one word-array type. */
function wordArray(length: number) {
  return Object.freeze({
    kind: "array" as const,
    element: SCALAR_TYPES.word,
    length,
    size: length * 2,
  });
}

/** Selector inventory for one parsed file. */
function inventory(tileMode: boolean, packed: boolean): readonly AssetSelectorInfo[] {
  const scalar = (name: string, type = SCALAR_TYPES.word) =>
    Object.freeze({
      name,
      type: Object.freeze({ kind: "scalar" as const, scalar: type }),
      available: true,
      default: false,
    });
  const array = (name: string, type: ReturnType<typeof byteArray>, available = true) =>
    Object.freeze({
      name,
      type: Object.freeze({ kind: "array" as const, array: type }),
      available,
      default: false,
    });
  return Object.freeze([
    array("charset", byteArray(0)),
    array("char_materials", byteArray(0)),
    array("colors", byteArray(0)),
    scalar("color_method", SCALAR_TYPES.byte),
    scalar("tile_mode", SCALAR_TYPES.boolean),
    scalar("tile_count"),
    scalar("tile_width", SCALAR_TYPES.byte),
    scalar("tile_height", SCALAR_TYPES.byte),
    scalar("charset_count"),
    scalar("map_width"),
    scalar("map_height"),
    array("tiles", byteArray(0), tileMode),
    array("tiles_word", wordArray(0), tileMode),
    array("tiles_low", byteArray(0), tileMode),
    array("tiles_high", byteArray(0), tileMode),
    array("tiles_packed12", byteArray(0), tileMode && packed),
    array("map", byteArray(0)),
    array("map_word", wordArray(0)),
    array("map_low", byteArray(0)),
    array("map_high", byteArray(0)),
  ]);
}

/** Read one little-endian 16-bit value. */
function leWord(bytes: readonly number[], offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

/** Pack 12-bit values as low bytes followed by packed high nibbles. */
function pack12(values: readonly number[]): readonly number[] {
  const packed = values.map((value) => value & 0xff);
  for (let index = 0; index < values.length; index += 2) {
    const low = (values[index]! >> 8) & 0x0f;
    const high = index + 1 < values.length ? (values[index + 1]! >> 8) & 0x0f : 0;
    packed.push(low | (high << 4));
  }
  return packed;
}

/** Build one canonical smallest-lossless array from raw little-endian cells. */
function canonicalCells(values: readonly number[]): {
  readonly type: ReturnType<typeof byteArray> | ReturnType<typeof wordArray>;
  readonly bytes: readonly number[];
} {
  const maximum = Math.max(0, ...values);
  if (maximum <= 0xff) {
    return {
      type: byteArray(values.length),
      bytes: values.map((value) => value & 0xff),
    };
  }
  const bytes: number[] = [];
  for (const value of values) bytes.push(value & 0xff, (value >> 8) & 0xff);
  return { type: wordArray(values.length), bytes };
}

/** Build one word-array payload from little-endian cells. */
function wordBytes(values: readonly number[]): readonly number[] {
  const bytes: number[] = [];
  for (const value of values) bytes.push(value & 0xff, (value >> 8) & 0xff);
  return bytes;
}

/** Build one low- or high-plane byte array. */
function planeBytes(values: readonly number[], plane: "low" | "high"): readonly number[] {
  return values.map((value) => (plane === "low" ? value & 0xff : (value >> 8) & 0xff));
}

/**
 * Validate one CharPad C64 Pro 3.80 CTM v9 project and expose its native data.
 *
 * The parser follows the official block order, validates every count, cell,
 * color width and exact EOF, and never flattens or invents Color RAM.
 */
export const charpadHandler: AssetHandler = Object.freeze({
  key: HANDLER_KEY,
  version: HANDLER_VERSION,
  extensions: Object.freeze([".ctm"]),
  defaultSelector: null,
  parse(request: AssetHandlerRequest): ReturnType<AssetHandler["parse"]> {
    const bytes = request.bytes;
    if (bytes.length < HEADER_BYTES || String.fromCharCode(...bytes.slice(0, 3)) !== "CTM") {
      return failure(request, "E10204", "ID_STR", 0, "supply an ASCII CTM v9 project");
    }
    if (bytes[3] !== 9) {
      return failure(request, "E10204", "VERSION", 3, "save the project as CTM version 9");
    }
    const displayMode = bytes[4]!;
    if (displayMode > 4) {
      return failure(request, "E10204", "DISP_MODE", 4, "use a display mode 0 through 4");
    }
    const colorMethod = bytes[5]!;
    if (colorMethod > 2) {
      return failure(request, "E10204", "COLR_METH", 5, "use coloring method 0, 1 or 2");
    }
    const keyMap = (bytes[6]! >> 4) & 0x0f;
    if (keyMap > 10) {
      return failure(request, "E10204", "KEYMAP", 6, "record a key map index 0 through 10");
    }
    if ((bytes[6]! & 0x0e) !== 0) {
      return failure(request, "E10204", "FLAGS", 6, "reserved project flag bits must be zero");
    }
    const tileMode = (bytes[6]! & 0x01) !== 0;
    const gridWidth = leWord(bytes, 7);
    const gridHeight = leWord(bytes, 9);
    if (gridWidth < 1 || gridWidth > 256 || gridHeight < 1 || gridHeight > 256) {
      return failure(
        request,
        "E10204",
        "FLEXI_GRID",
        7,
        "the flexi-grid dimensions must be 1 through 256",
      );
    }
    for (let index = 0; index < 4; index += 1) {
      if ((bytes[0x0c + index]! & 0xf0) !== 0) {
        return failure(request, "E10204", "VCOLR_BG", 0x0c + index, "background colors are 0-15");
      }
    }
    const baseColors = Object.freeze([
      bytes[0x10]! & 0x0f,
      bytes[0x11]! & 0x0f,
      bytes[0x12]! & 0x0f,
    ]);

    let offset = HEADER_BYTES;
    let blockNumber = 0;
    const readMarker = (expected: string): string | null => {
      if (offset + 2 > bytes.length) return "truncated block marker";
      if (bytes[offset] !== 0xda || ((bytes[offset + 1]! >> 4) & 0x0f) !== 0x0b) {
        return `expected a $DA,$B? marker for ${expected}`;
      }
      if ((bytes[offset + 1]! & 0x0f) !== (blockNumber & 0x0f)) {
        return `expected block number ${blockNumber} before ${expected}`;
      }
      offset += 2;
      blockNumber += 1;
      return null;
    };

    const marker = readMarker("the character set");
    if (marker !== null) return failure(request, "E10204", "CHARACTER_SET", offset, marker);
    if (offset + 2 > bytes.length) {
      return failure(request, "E10204", "CHARACTER_SET", offset, "truncated character count");
    }
    const charCount = leWord(bytes, offset) + 1;
    offset += 2;
    const charBytes = charCount * 8;
    if (offset + charBytes > bytes.length) {
      return failure(
        request,
        "E10204",
        "CHARACTER_SET",
        offset,
        `the character set needs ${charBytes} bytes`,
      );
    }
    const charset = bytes.slice(offset, offset + charBytes);
    offset += charBytes;

    const materialsMarker = readMarker("character materials");
    if (materialsMarker !== null)
      return failure(request, "E10204", "CHAR_MATERIALS", offset, materialsMarker);
    if (offset + charCount > bytes.length) {
      return failure(request, "E10204", "CHAR_MATERIALS", offset, "truncated material data");
    }
    const materials = bytes.slice(offset, offset + charCount);
    offset += charCount;

    let charColors: readonly number[] = Object.freeze([]);
    if (colorMethod === 2) {
      const colorsMarker = readMarker("character colors");
      if (colorsMarker !== null)
        return failure(request, "E10204", "CHAR_COLORS", offset, colorsMarker);
      const length = charCount * colorWidth(displayMode);
      if (offset + length > bytes.length) {
        return failure(request, "E10204", "CHAR_COLORS", offset, "truncated character colors");
      }
      charColors = bytes.slice(offset, offset + length);
      offset += length;
    }

    let tileCount = 0;
    let tileWidth = 1;
    let tileHeight = 1;
    let tileBytes: readonly number[] = Object.freeze([]);
    let tileColors: readonly number[] = Object.freeze([]);
    let tileValues: readonly number[] = Object.freeze([]);
    let tilePacked: readonly number[] = Object.freeze([]);
    if (tileMode) {
      const tileMarker = readMarker("the tile set");
      if (tileMarker !== null) return failure(request, "E10204", "TILE_SET", offset, tileMarker);
      if (offset + 4 > bytes.length) {
        return failure(request, "E10204", "TILE_SET", offset, "truncated tile header");
      }
      tileCount = leWord(bytes, offset) + 1;
      tileWidth = bytes[offset + 2]!;
      tileHeight = bytes[offset + 3]!;
      offset += 4;
      if (tileWidth < 1 || tileHeight < 1) {
        return failure(
          request,
          "E10204",
          "TILE_SIZE",
          offset - 2,
          "tile dimensions must be at least 1",
        );
      }
      const cells = tileCount * tileWidth * tileHeight;
      const length = cells * 2;
      if (offset + length > bytes.length) {
        return failure(
          request,
          "E10204",
          "TILE_DATA",
          offset,
          `the tile set needs ${length} bytes`,
        );
      }
      tileBytes = bytes.slice(offset, offset + length);
      offset += length;
      tileValues = Array.from({ length: cells }, (_, index) => leWord(tileBytes, index * 2));
      for (const value of tileValues) {
        if (value >= charCount) {
          return failure(
            request,
            "E10204",
            "TILE_DATA",
            offset - length,
            `tile cell references character ${value} but the set has ${charCount}`,
          );
        }
      }
      if (Math.max(0, ...tileValues) <= 0xfff) {
        tilePacked = Object.freeze(pack12(tileValues));
      }
      if (colorMethod === 1) {
        const tileColorsMarker = readMarker("tile colors");
        if (tileColorsMarker !== null)
          return failure(request, "E10204", "TILE_COLORS", offset, tileColorsMarker);
        const colorLength = tileCount * colorWidth(displayMode);
        if (offset + colorLength > bytes.length) {
          return failure(request, "E10204", "TILE_COLORS", offset, "truncated tile colors");
        }
        tileColors = bytes.slice(offset, offset + colorLength);
        offset += colorLength;
      }
      const tagsMarker = readMarker("tile tags");
      if (tagsMarker !== null) return failure(request, "E10204", "TILE_TAGS", offset, tagsMarker);
      if (offset + tileCount > bytes.length) {
        return failure(request, "E10204", "TILE_TAGS", offset, "truncated tile tags");
      }
      // Tile tag bytes are validated structurally but not exposed as a selector.
      offset += tileCount;
      const namesMarker = readMarker("tile names");
      if (namesMarker !== null)
        return failure(request, "E10204", "TILE_NAMES", offset, namesMarker);
      for (let index = 0; index < tileCount; index += 1) {
        let length = 0;
        while (offset + length < bytes.length && bytes[offset + length] !== 0) {
          length += 1;
          if (length > 32) {
            return failure(
              request,
              "E10204",
              "TILE_NAMES",
              offset,
              "a tile name is limited to 32 characters",
            );
          }
        }
        if (offset + length >= bytes.length) {
          return failure(request, "E10204", "TILE_NAMES", offset, "unterminated tile name");
        }
        offset += length + 1;
      }
    }

    const mapMarker = readMarker("the map");
    if (mapMarker !== null) return failure(request, "E10204", "MAP", offset, mapMarker);
    if (offset + 4 > bytes.length) {
      return failure(request, "E10204", "MAP", offset, "truncated map dimensions");
    }
    const mapWidth = leWord(bytes, offset);
    const mapHeight = leWord(bytes, offset + 2);
    offset += 4;
    if (mapWidth < 1 || mapHeight < 1) {
      return failure(
        request,
        "E10204",
        "MAP_SIZE",
        offset - 4,
        "map dimensions must be at least 1",
      );
    }
    const mapCells = mapWidth * mapHeight;
    const mapLength = mapCells * 2;
    if (offset + mapLength > bytes.length) {
      return failure(request, "E10204", "MAP_DATA", offset, `the map needs ${mapLength} bytes`);
    }
    const mapBytes = bytes.slice(offset, offset + mapLength);
    offset += mapLength;
    const mapValues = Array.from({ length: mapCells }, (_, index) => leWord(mapBytes, index * 2));
    const mapLimit = tileMode ? tileCount : charCount;
    for (const value of mapValues) {
      if (value >= mapLimit) {
        return failure(
          request,
          "E10204",
          "MAP_DATA",
          offset - mapLength,
          `map cell references ${tileMode ? "tile" : "character"} ${value} but the set has ${mapLimit}`,
        );
      }
    }
    if (offset !== bytes.length) {
      return failure(
        request,
        "E10204",
        "EOF",
        offset,
        `unexplained trailing bytes: ${bytes.length - offset} remain`,
      );
    }

    const colors =
      colorMethod === 0
        ? Object.freeze([...baseColors])
        : colorMethod === 1
          ? tileColors
          : charColors;
    const packedAvailable = tileMode && Math.max(0, ...tileValues) <= 0xfff;
    const selectors = inventory(tileMode, packedAvailable);
    const selector = request.selector;
    if (selector === null) {
      return Object.freeze({
        kind: "failure",
        diagnostic: nativeAssetDiagnostic({
          code: "E10132",
          declaration: request.declaration,
          literalPath: request.literalPath,
          handlerKey: HANDLER_KEY,
          handlerVersion: HANDLER_VERSION,
          remedy: `choose one of: ${selectors.map(({ name }) => `'${name}'`).join(", ")}`,
          span: request.span,
        }),
      });
    }
    const canonicalMap = canonicalCells(mapValues);
    const canonicalTiles = tileMode ? canonicalCells(tileValues) : null;
    const scalarOutput = (
      value: bigint | boolean,
      type: typeof SCALAR_TYPES.word | typeof SCALAR_TYPES.byte | typeof SCALAR_TYPES.boolean,
    ) =>
      createNativeOutput({
        handlerKey: HANDLER_KEY,
        handlerVersion: HANDLER_VERSION,
        request,
        resolvedSelector: selector,
        representation: "scalar",
        type,
        scalar: value,
        constraints: Object.freeze([]),
        selectors,
      });
    const arrayOutput = (
      data: readonly number[],
      type: ReturnType<typeof byteArray> | ReturnType<typeof wordArray>,
      representation: string,
      constraints: readonly AssetConstraint[] = Object.freeze([]),
    ) =>
      createNativeOutput({
        handlerKey: HANDLER_KEY,
        handlerVersion: HANDLER_VERSION,
        request,
        resolvedSelector: selector,
        representation,
        type,
        bytes: Object.freeze([...data]),
        constraints,
        selectors,
      });

    switch (selector) {
      case "charset":
        return arrayOutput(
          charset,
          byteArray(charset.length),
          "ctm-charset",
          Object.freeze([
            Object.freeze({ kind: "align" as const, origin: "handler" as const, bytes: 2_048 }),
            Object.freeze({
              kind: "visibility" as const,
              origin: "handler" as const,
              consumer: "vic" as const,
              conditionId: "vic",
            }),
          ]),
        );
      case "char_materials":
        return arrayOutput(materials, byteArray(materials.length), "ctm-bytes");
      case "colors":
        return arrayOutput(colors, byteArray(colors.length), "ctm-colors");
      case "color_method":
        return scalarOutput(BigInt(colorMethod), SCALAR_TYPES.byte);
      case "tile_mode":
        return scalarOutput(tileMode, SCALAR_TYPES.boolean);
      case "tile_count":
        return scalarOutput(BigInt(tileCount), SCALAR_TYPES.word);
      case "tile_width":
        return scalarOutput(BigInt(tileWidth), SCALAR_TYPES.byte);
      case "tile_height":
        return scalarOutput(BigInt(tileHeight), SCALAR_TYPES.byte);
      case "charset_count":
        return scalarOutput(BigInt(charCount), SCALAR_TYPES.word);
      case "map_width":
        return scalarOutput(BigInt(mapWidth), SCALAR_TYPES.word);
      case "map_height":
        return scalarOutput(BigInt(mapHeight), SCALAR_TYPES.word);
      case "tiles":
        if (canonicalTiles === null)
          return failure(request, "E10133", "TILESYS", 6, "this project has no tile layer");
        return arrayOutput(canonicalTiles.bytes, canonicalTiles.type, "ctm-tiles");
      case "tiles_word":
        if (!tileMode)
          return failure(request, "E10133", "TILESYS", 6, "this project has no tile layer");
        return arrayOutput(wordBytes(tileValues), wordArray(tileValues.length), "ctm-tiles-word");
      case "tiles_low":
        if (!tileMode)
          return failure(request, "E10133", "TILESYS", 6, "this project has no tile layer");
        return arrayOutput(
          planeBytes(tileValues, "low"),
          byteArray(tileValues.length),
          "ctm-tiles-low",
        );
      case "tiles_high":
        if (!tileMode)
          return failure(request, "E10133", "TILESYS", 6, "this project has no tile layer");
        return arrayOutput(
          planeBytes(tileValues, "high"),
          byteArray(tileValues.length),
          "ctm-tiles-high",
        );
      case "tiles_packed12":
        if (!tileMode || !packedAvailable)
          return failure(
            request,
            "E10133",
            "TILES_PACKED12",
            6,
            "packed-12 needs a tile layer whose values all fit in 12 bits",
          );
        return arrayOutput(tilePacked, byteArray(tilePacked.length), "ctm-tiles-packed12");
      case "map":
        return arrayOutput(canonicalMap.bytes, canonicalMap.type, "ctm-map");
      case "map_word":
        return arrayOutput(wordBytes(mapValues), wordArray(mapValues.length), "ctm-map-word");
      case "map_low":
        return arrayOutput(
          planeBytes(mapValues, "low"),
          byteArray(mapValues.length),
          "ctm-map-low",
        );
      case "map_high":
        return arrayOutput(
          planeBytes(mapValues, "high"),
          byteArray(mapValues.length),
          "ctm-map-high",
        );
      default:
        return Object.freeze({
          kind: "failure",
          diagnostic: nativeAssetDiagnostic({
            code: "E10133",
            declaration: request.declaration,
            literalPath: request.literalPath,
            handlerKey: HANDLER_KEY,
            handlerVersion: HANDLER_VERSION,
            remedy: `choose one of: ${selectors.map(({ name }) => `'${name}'`).join(", ")}`,
            span: request.span,
          }),
        });
    }
  },
});
