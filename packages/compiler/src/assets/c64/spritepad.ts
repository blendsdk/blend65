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

const HANDLER_KEY = "spritepad";
const HANDLER_VERSION = "3.80";
const HEADER_BYTES = 20;

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
function inventory(
  tiles: boolean,
  spriteAnimation: boolean,
  tileAnimation: boolean,
): readonly AssetSelectorInfo[] {
  const scalar = (name: string, type = SCALAR_TYPES.word, available = true) =>
    Object.freeze({
      name,
      type: Object.freeze({ kind: "scalar" as const, scalar: type }),
      available,
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
    Object.freeze({
      name: "sprites",
      type: Object.freeze({ kind: "array" as const, array: byteArray(0) }),
      available: true,
      default: true,
    }),
    array("sprite_attributes", byteArray(0)),
    scalar("count"),
    scalar("background_color", SCALAR_TYPES.byte),
    scalar("multicolor_1", SCALAR_TYPES.byte),
    scalar("multicolor_2", SCALAR_TYPES.byte),
    scalar("sprite_overlay_distance"),
    scalar("tile_overlay_distance"),
    scalar("tile_count"),
    scalar("tile_width", SCALAR_TYPES.byte),
    scalar("tile_height", SCALAR_TYPES.byte),
    array("tiles", byteArray(0), tiles),
    array("tile_attributes", byteArray(0), tiles),
    array("tile_tags", byteArray(0), tiles),
    scalar("sprite_animation_count", SCALAR_TYPES.word, spriteAnimation),
    array("sprite_animation_starts", wordArray(0), spriteAnimation),
    array("sprite_animation_ends", wordArray(0), spriteAnimation),
    array("sprite_animation_timers", byteArray(0), spriteAnimation),
    array("sprite_animation_flags", byteArray(0), spriteAnimation),
    scalar("tile_animation_count", SCALAR_TYPES.word, tileAnimation),
    array("tile_animation_starts", wordArray(0), tileAnimation),
    array("tile_animation_ends", wordArray(0), tileAnimation),
    array("tile_animation_timers", byteArray(0), tileAnimation),
    array("tile_animation_flags", byteArray(0), tileAnimation),
  ]);
}

/** Read one little-endian 16-bit value. */
function leWord(bytes: readonly number[], offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

/** Build one word-array payload from little-endian frame values. */
function wordBytes(values: readonly number[]): readonly number[] {
  const bytes: number[] = [];
  for (const value of values) bytes.push(value & 0xff, (value >> 8) & 0xff);
  return bytes;
}

/**
 * Validate one SpritePad C64 Pro 3.80 SPD v5 project and expose its native data.
 *
 * The parser follows the exact block order, validates every count, frame index,
 * name terminator and exact EOF, and never emits tile names as runtime strings.
 */
export const spritepadHandler: AssetHandler = Object.freeze({
  key: HANDLER_KEY,
  version: HANDLER_VERSION,
  extensions: Object.freeze([".spd"]),
  defaultSelector: "sprites",
  parse(request: AssetHandlerRequest): ReturnType<AssetHandler["parse"]> {
    const bytes = request.bytes;
    if (bytes.length < HEADER_BYTES || String.fromCharCode(...bytes.slice(0, 3)) !== "SPD") {
      return failure(request, "E10204", "ID_STR", 0, "supply an ASCII SPD version 5 project");
    }
    if (bytes[3] !== 5) {
      return failure(request, "E10204", "VERSION", 3, "save the project as SPD version 5");
    }
    const flags = bytes[4]!;
    if ((flags & 0xf8) !== 0) {
      return failure(request, "E10204", "FLAGS", 4, "reserved content flag bits must be zero");
    }
    const tiles = (flags & 0x01) !== 0;
    const spriteAnimation = (flags & 0x02) !== 0;
    const tileAnimation = (flags & 0x04) !== 0;
    const spriteCount = leWord(bytes, 5);
    const tileCount = leWord(bytes, 7);
    const spriteAnimationCount = bytes[9]! + 1;
    const tileAnimationCount = bytes[0x0a]! + 1;
    const tileWidth = bytes[0x0b]!;
    const tileHeight = bytes[0x0c]!;
    for (const [offset, name] of [
      [0x0d, "COLR_BGR"],
      [0x0e, "COLR_MC1"],
      [0x0f, "COLR_MC2"],
    ] as const) {
      if ((bytes[offset]! & 0xf0) !== 0) {
        return failure(request, "E10204", name, offset, "sprite colors are 0-15");
      }
    }
    if (tiles && (tileWidth < 1 || tileWidth > 8 || tileHeight < 1 || tileHeight > 8)) {
      return failure(request, "E10204", "TILE_SIZE", 0x0b, "tile dimensions are 1 through 8");
    }
    if (!tiles && (tileCount !== 0 || tileAnimation)) {
      return failure(
        request,
        "E10204",
        "FLAGS",
        4,
        "tile data or tile animations require the tile flag",
      );
    }

    let offset = HEADER_BYTES;
    const spriteBytes = spriteCount * 64;
    if (offset + spriteBytes > bytes.length) {
      return failure(
        request,
        "E10204",
        "SPRITE_DATA",
        offset,
        `the sprite array needs ${spriteBytes} bytes`,
      );
    }
    const sprites = bytes.slice(offset, offset + spriteBytes);
    offset += spriteBytes;
    const attributes = Object.freeze(
      Array.from({ length: spriteCount }, (_, index) => sprites[index * 64 + 63]!),
    );

    let tileData: readonly number[] = Object.freeze([]);
    let tileAttributes: readonly number[] = Object.freeze([]);
    let tileTags: readonly number[] = Object.freeze([]);
    if (tiles) {
      const tileBytesLength = tileCount * tileWidth * tileHeight * 2;
      if (offset + tileBytesLength + tileCount * 2 > bytes.length) {
        return failure(request, "E10204", "TILE_DATA", offset, "truncated tile data");
      }
      tileData = bytes.slice(offset, offset + tileBytesLength);
      offset += tileBytesLength;
      tileAttributes = bytes.slice(offset, offset + tileCount);
      offset += tileCount;
      tileTags = bytes.slice(offset, offset + tileCount);
      offset += tileCount;
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

    const readAnimation = (
      count: number,
      frameLimit: number,
      field: string,
    ):
      | {
          starts: readonly number[];
          ends: readonly number[];
          timers: readonly number[];
          flags: readonly number[];
        }
      | AssetHandlerFailure => {
      const startBytes = count * 2;
      if (offset + startBytes * 2 + count * 2 > bytes.length) {
        return failure(request, "E10204", field, offset, "truncated animation block");
      }
      const starts = Array.from({ length: count }, (_, index) => leWord(bytes, offset + index * 2));
      offset += startBytes;
      const ends = Array.from({ length: count }, (_, index) => leWord(bytes, offset + index * 2));
      offset += startBytes;
      const timers = bytes.slice(offset, offset + count);
      offset += count;
      const animationFlags = bytes.slice(offset, offset + count);
      offset += count;
      for (const value of [...starts, ...ends]) {
        if (value >= frameLimit) {
          return failure(
            request,
            "E10204",
            field,
            offset - count * 2,
            `animation frame ${value} is outside the ${frameLimit}-item set`,
          );
        }
      }
      return { starts, ends, timers, flags: animationFlags };
    };

    let spriteAnimationData: {
      starts: readonly number[];
      ends: readonly number[];
      timers: readonly number[];
      flags: readonly number[];
    } | null = null;
    if (spriteAnimation) {
      const block = readAnimation(spriteAnimationCount, spriteCount, "SPRITE_ANIMATION");
      if ("kind" in block) return block;
      spriteAnimationData = block;
    }
    let tileAnimationData: {
      starts: readonly number[];
      ends: readonly number[];
      timers: readonly number[];
      flags: readonly number[];
    } | null = null;
    if (tileAnimation) {
      const block = readAnimation(tileAnimationCount, tileCount, "TILE_ANIMATION");
      if ("kind" in block) return block;
      tileAnimationData = block;
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

    const selectors = inventory(tiles, spriteAnimation, tileAnimation);
    const selector = request.selector ?? "sprites";
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
      case "sprites":
        return arrayOutput(
          sprites,
          byteArray(sprites.length),
          "spd-sprites",
          Object.freeze([
            Object.freeze({ kind: "align" as const, origin: "handler" as const, bytes: 64 }),
            Object.freeze({
              kind: "visibility" as const,
              origin: "handler" as const,
              consumer: "vic" as const,
              conditionId: "vic",
            }),
          ]),
        );
      case "sprite_attributes":
        return arrayOutput(attributes, byteArray(attributes.length), "spd-sprite-attributes");
      case "count":
        return scalarOutput(BigInt(spriteCount), SCALAR_TYPES.word);
      case "background_color":
        return scalarOutput(BigInt(bytes[0x0d]!), SCALAR_TYPES.byte);
      case "multicolor_1":
        return scalarOutput(BigInt(bytes[0x0e]!), SCALAR_TYPES.byte);
      case "multicolor_2":
        return scalarOutput(BigInt(bytes[0x0f]!), SCALAR_TYPES.byte);
      case "sprite_overlay_distance":
        return scalarOutput(BigInt(leWord(bytes, 0x10)), SCALAR_TYPES.word);
      case "tile_overlay_distance":
        return scalarOutput(BigInt(leWord(bytes, 0x12)), SCALAR_TYPES.word);
      case "tile_count":
        return scalarOutput(BigInt(tileCount), SCALAR_TYPES.word);
      case "tile_width":
        return scalarOutput(BigInt(tileWidth), SCALAR_TYPES.byte);
      case "tile_height":
        return scalarOutput(BigInt(tileHeight), SCALAR_TYPES.byte);
      case "tiles":
        return arrayOutput(tileData, byteArray(tileData.length), "spd-tiles");
      case "tile_attributes":
        return arrayOutput(tileAttributes, byteArray(tileAttributes.length), "spd-tile-attributes");
      case "tile_tags":
        return arrayOutput(tileTags, byteArray(tileTags.length), "spd-tile-tags");
      case "sprite_animation_count":
        return scalarOutput(BigInt(spriteAnimationCount), SCALAR_TYPES.word);
      case "sprite_animation_starts":
        if (spriteAnimationData === null)
          return failure(request, "E10133", "SPRITE_ANIMATION", 4, "no sprite animation block");
        return arrayOutput(
          wordBytes(spriteAnimationData.starts),
          wordArray(spriteAnimationData.starts.length),
          "spd-sprite-animation-starts",
        );
      case "sprite_animation_ends":
        if (spriteAnimationData === null)
          return failure(request, "E10133", "SPRITE_ANIMATION", 4, "no sprite animation block");
        return arrayOutput(
          wordBytes(spriteAnimationData.ends),
          wordArray(spriteAnimationData.ends.length),
          "spd-sprite-animation-ends",
        );
      case "sprite_animation_timers":
        if (spriteAnimationData === null)
          return failure(request, "E10133", "SPRITE_ANIMATION", 4, "no sprite animation block");
        return arrayOutput(
          spriteAnimationData.timers,
          byteArray(spriteAnimationData.timers.length),
          "spd-sprite-animation-timers",
        );
      case "sprite_animation_flags":
        if (spriteAnimationData === null)
          return failure(request, "E10133", "SPRITE_ANIMATION", 4, "no sprite animation block");
        return arrayOutput(
          spriteAnimationData.flags,
          byteArray(spriteAnimationData.flags.length),
          "spd-sprite-animation-flags",
        );
      case "tile_animation_count":
        return scalarOutput(BigInt(tileAnimationCount), SCALAR_TYPES.word);
      case "tile_animation_starts":
        if (tileAnimationData === null)
          return failure(request, "E10133", "TILE_ANIMATION", 4, "no tile animation block");
        return arrayOutput(
          wordBytes(tileAnimationData.starts),
          wordArray(tileAnimationData.starts.length),
          "spd-tile-animation-starts",
        );
      case "tile_animation_ends":
        if (tileAnimationData === null)
          return failure(request, "E10133", "TILE_ANIMATION", 4, "no tile animation block");
        return arrayOutput(
          wordBytes(tileAnimationData.ends),
          wordArray(tileAnimationData.ends.length),
          "spd-tile-animation-ends",
        );
      case "tile_animation_timers":
        if (tileAnimationData === null)
          return failure(request, "E10133", "TILE_ANIMATION", 4, "no tile animation block");
        return arrayOutput(
          tileAnimationData.timers,
          byteArray(tileAnimationData.timers.length),
          "spd-tile-animation-timers",
        );
      case "tile_animation_flags":
        if (tileAnimationData === null)
          return failure(request, "E10133", "TILE_ANIMATION", 4, "no tile animation block");
        return arrayOutput(
          tileAnimationData.flags,
          byteArray(tileAnimationData.flags.length),
          "spd-tile-animation-flags",
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
