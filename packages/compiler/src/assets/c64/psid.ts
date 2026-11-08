import { SCALAR_TYPES } from "../../frontend/constants.js";
import type { ArrayType } from "../../frontend/semantic-types.js";
import { selectC64KernalFacts } from "../../profile/c64-kernal.js";
import { nativeAssetDiagnostic } from "../asset-diagnostics.js";
import {
  createNativeOutput,
  type AssetCompatibility,
  type AssetHandler,
  type AssetHandlerFailure,
  type AssetHandlerRequest,
  type AssetSelectorInfo,
} from "../asset-handler.js";

const HANDLER_KEY = "psid";
const HANDLER_VERSION = "1-4";
const DATA_OFFSET_V1 = 0x76;
const DATA_OFFSET_V2 = 0x7c;

/** Build one structural failure naming the exact field and offset. */
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

/** Read one big-endian 16-bit header field. */
function word(bytes: readonly number[], offset: number): number {
  return ((bytes[offset]! << 8) | bytes[offset + 1]!) & 0xffff;
}

/** Read one little-endian 16-bit payload value. */
function littleWord(bytes: readonly number[], offset: number): number {
  return (bytes[offset]! | (bytes[offset + 1]! << 8)) & 0xffff;
}

/** Build the complete selector inventory for one accepted container. */
function selectors(length: number): readonly AssetSelectorInfo[] {
  const data: ArrayType = Object.freeze({
    kind: "array",
    element: SCALAR_TYPES.byte,
    length,
    size: length,
  });
  return Object.freeze([
    Object.freeze({
      name: "data",
      type: Object.freeze({ kind: "array" as const, array: data }),
      available: true,
      default: true,
    }),
    Object.freeze({
      name: "init_address",
      type: Object.freeze({ kind: "scalar" as const, scalar: SCALAR_TYPES.word }),
      available: true,
      default: false,
    }),
    Object.freeze({
      name: "play_address",
      type: Object.freeze({ kind: "scalar" as const, scalar: SCALAR_TYPES.word }),
      available: true,
      default: false,
    }),
  ]);
}

/**
 * Validate one self-contained PSID v1-v4 container and expose its data and entry
 * addresses.
 *
 * The handler accepts only the directly callable subset: valid magic and version,
 * exact version-specific data offset, self-contained load/init/play addresses,
 * declared song range, no relocation pages, no MUS/PlaySID dependence, and a
 * video/SID compatibility set that includes the selected profile.
 */
export const psidHandler: AssetHandler = Object.freeze({
  key: HANDLER_KEY,
  version: HANDLER_VERSION,
  extensions: Object.freeze([".sid"]),
  defaultSelector: "data",
  parse(request: AssetHandlerRequest): ReturnType<AssetHandler["parse"]> {
    const bytes = request.bytes;
    if (bytes.length < 4 || String.fromCharCode(...bytes.slice(0, 4)) !== "PSID") {
      return failure(
        request,
        "E10204",
        "ID_STR",
        0,
        "supply an ASCII PSID file; RSID is not supported",
      );
    }
    const version = word(bytes, 0x04);
    if (version < 1 || version > 4) {
      return failure(
        request,
        "E10204",
        "VERSION",
        0x04,
        "save the tune as PSID version 1 through 4",
      );
    }
    const expectedOffset = version === 1 ? DATA_OFFSET_V1 : DATA_OFFSET_V2;
    if (bytes.length < expectedOffset) {
      return failure(
        request,
        "E10204",
        "HEADER",
        bytes.length,
        `the version ${version} header requires ${expectedOffset} bytes`,
      );
    }
    const dataOffset = word(bytes, 0x06);
    if (dataOffset !== expectedOffset) {
      return failure(
        request,
        "E10204",
        "DATA_OFFSET",
        0x06,
        `a version ${version} PSID file must use data offset $${expectedOffset.toString(16)}`,
      );
    }
    const load = word(bytes, 0x08);
    const init = word(bytes, 0x0a);
    const play = word(bytes, 0x0c);
    const songs = word(bytes, 0x0e);
    const startSong = word(bytes, 0x10);

    let flags = 0;
    if (version >= 2) {
      flags = word(bytes, 0x76);
      if ((flags & 0x0001) !== 0) {
        return failure(request, "E10204", "FLAGS", 0x76, "Compute! MUS players are not supported");
      }
      if ((flags & 0x0002) !== 0) {
        return failure(
          request,
          "E10204",
          "FLAGS",
          0x76,
          "PlaySID-dependent tunes are not supported",
        );
      }
      if (bytes[0x78] !== 0 || bytes[0x79] !== 0) {
        return failure(
          request,
          "E10204",
          "START_PAGE",
          0x78,
          "relocatable PSID images are not supported; save a self-contained image",
        );
      }
      if (version === 2 && (flags & 0xffc0) !== 0) {
        return failure(
          request,
          "E10204",
          "FLAGS",
          0x76,
          "reserved version 2 flag bits must be zero",
        );
      }
      if (version === 3 && (flags & 0xff00) !== 0) {
        return failure(
          request,
          "E10204",
          "FLAGS",
          0x76,
          "reserved version 3 flag bits must be zero",
        );
      }
      if (version === 4 && (flags & 0xfc00) !== 0) {
        return failure(
          request,
          "E10204",
          "FLAGS",
          0x76,
          "reserved version 4 flag bits must be zero",
        );
      }
    }
    if (version === 2 && (bytes[0x7a] !== 0 || bytes[0x7b] !== 0)) {
      return failure(
        request,
        "E10204",
        "RESERVED",
        0x7a,
        "version 2 reserved header bytes must be zero",
      );
    }
    if (version === 3 && bytes[0x7b] !== 0) {
      return failure(
        request,
        "E10204",
        "RESERVED_THIRD_SID",
        0x7b,
        "a version 3 file has no third SID address field",
      );
    }
    if (version >= 3 && bytes[0x7a] !== 0) {
      return failure(
        request,
        "E10261",
        "SECOND_SID_ADDRESS",
        0x7a,
        "the selected profile has one SID at $D400",
      );
    }
    if (version >= 4 && bytes[0x7b] !== 0) {
      return failure(
        request,
        "E10261",
        "THIRD_SID_ADDRESS",
        0x7b,
        "the selected profile has one SID at $D400",
      );
    }
    if (version >= 3 && (flags & 0x00c0) !== 0) {
      return failure(
        request,
        "E10204",
        "FLAGS",
        0x76,
        "a second SID model is declared without a second SID address",
      );
    }
    if (version >= 4 && (flags & 0x0300) !== 0) {
      return failure(
        request,
        "E10204",
        "FLAGS",
        0x76,
        "a third SID model is declared without a third SID address",
      );
    }

    if (songs < 1 || songs > 256) {
      return failure(request, "E10204", "SONGS", 0x0e, "declare between 1 and 256 songs");
    }
    if (startSong < 1 || startSong > songs) {
      return failure(
        request,
        "E10204",
        "START_SONG",
        0x10,
        "select a start song between 1 and the declared song count",
      );
    }

    const payload = bytes.slice(dataOffset);
    if (payload.length === 0) {
      return failure(
        request,
        "E10204",
        "PAYLOAD",
        dataOffset,
        "the tune payload must not be empty",
      );
    }
    const effectiveLoad = load === 0 ? littleWord(payload, 0) : load;
    const data = load === 0 ? payload.slice(2) : payload;
    if (data.length === 0) {
      return failure(
        request,
        "E10204",
        "PAYLOAD",
        dataOffset,
        "the payload must contain music data after the load address",
      );
    }
    const dataEnd = effectiveLoad + data.length;
    const overlaps = (start: number, end: number) => effectiveLoad < end && dataEnd > start;
    if (overlaps(0x1000, 0x2000) || overlaps(0xa000, 0xc000)) {
      return failure(
        request,
        "E10261",
        "LOAD_ADDRESS",
        0x08,
        `the payload interval $${effectiveLoad.toString(16)}-$${(dataEnd - 1).toString(16)} overlaps a ROM window visible on the selected profile; no banking is inferred`,
      );
    }
    if (effectiveLoad + data.length > 0x10000) {
      return failure(
        request,
        "E10204",
        "LOAD_ADDRESS",
        0x08,
        `the load interval $${effectiveLoad.toString(16)}+${data.length} wraps past $10000`,
      );
    }
    const effectiveInit = init === 0 ? effectiveLoad : init;
    if (effectiveInit < effectiveLoad || effectiveInit >= effectiveLoad + data.length) {
      return failure(
        request,
        "E10204",
        "INIT_ADDRESS",
        0x0a,
        `the init address must lie inside $${effectiveLoad.toString(16)}-$${(effectiveLoad + data.length - 1).toString(16)}`,
      );
    }
    if (play === 0) {
      return failure(
        request,
        "E10204",
        "PLAY_ADDRESS",
        0x0c,
        "a self-contained PSID tune needs a nonzero play address",
      );
    }
    if (play < effectiveLoad || play >= effectiveLoad + data.length) {
      return failure(
        request,
        "E10204",
        "PLAY_ADDRESS",
        0x0c,
        `the play address must lie inside $${effectiveLoad.toString(16)}-$${(effectiveLoad + data.length - 1).toString(16)}`,
      );
    }

    const facts = selectC64KernalFacts(request.profileId);
    if (facts === null) {
      return failure(
        request,
        "E10261",
        "PROFILE",
        0,
        `the selected profile '${request.profileId}' has no proved PSID compatibility`,
      );
    }
    if (version >= 2) {
      const video = (flags >> 2) & 0x03;
      if ((video === 1 && facts.video !== "pal") || (video === 2 && facts.video !== "ntsc")) {
        return failure(
          request,
          "E10261",
          "FLAGS",
          0x76,
          `the tune declares ${video === 1 ? "PAL" : "NTSC"} and the selected profile is ${facts.video.toUpperCase()}`,
        );
      }
      const model = (flags >> 4) & 0x03;
      if ((model === 1 && facts.sidModel !== 6581) || (model === 2 && facts.sidModel !== 8580)) {
        return failure(
          request,
          "E10261",
          "FLAGS",
          0x76,
          `the tune declares a ${model === 1 ? "6581" : "8580"} SID and the selected profile has a ${facts.sidModel}`,
        );
      }
    }

    const videoCode = version >= 2 ? (flags >> 2) & 0x03 : 0;
    const modelCode = version >= 2 ? (flags >> 4) & 0x03 : 0;
    const compatibility: AssetCompatibility = Object.freeze({
      video:
        videoCode === 1 ? "PAL" : videoCode === 2 ? "NTSC" : videoCode === 3 ? "both" : "unknown",
      sidModel:
        modelCode === 1 ? "6581" : modelCode === 2 ? "8580" : modelCode === 3 ? "both" : "unknown",
      secondSid: version >= 3 && bytes[0x7a] !== 0,
      thirdSid: version >= 4 && bytes[0x7b] !== 0,
      songs,
      startSong,
    });
    const inventory = selectors(data.length);
    const selector = request.selector ?? "data";
    if (selector === "data") {
      return createNativeOutput({
        handlerKey: HANDLER_KEY,
        handlerVersion: HANDLER_VERSION,
        request,
        resolvedSelector: "data",
        representation: "psid-data",
        type: Object.freeze({
          kind: "array",
          element: SCALAR_TYPES.byte,
          length: data.length,
          size: data.length,
        }),
        bytes: Object.freeze([...data]),
        constraints: Object.freeze([
          Object.freeze({
            kind: "at" as const,
            origin: "handler" as const,
            addressSpaceId: "cpu16" as const,
            start: effectiveLoad,
          }),
        ]),
        selectors: inventory,
        compatibility,
      });
    }
    if (selector === "init_address") {
      return createNativeOutput({
        handlerKey: HANDLER_KEY,
        handlerVersion: HANDLER_VERSION,
        request,
        resolvedSelector: "init_address",
        representation: "scalar-word",
        type: SCALAR_TYPES.word,
        scalar: BigInt(effectiveInit),
        constraints: Object.freeze([]),
        selectors: inventory,
        compatibility,
      });
    }
    if (selector === "play_address") {
      return createNativeOutput({
        handlerKey: HANDLER_KEY,
        handlerVersion: HANDLER_VERSION,
        request,
        resolvedSelector: "play_address",
        representation: "scalar-word",
        type: SCALAR_TYPES.word,
        scalar: BigInt(play),
        constraints: Object.freeze([]),
        selectors: inventory,
        compatibility,
      });
    }
    return Object.freeze({
      kind: "failure",
      diagnostic: nativeAssetDiagnostic({
        code: "E10133",
        declaration: request.declaration,
        literalPath: request.literalPath,
        handlerKey: HANDLER_KEY,
        handlerVersion: HANDLER_VERSION,
        remedy: `choose one of: ${inventory.map(({ name }) => `'${name}'`).join(", ")}`,
        span: request.span,
      }),
    });
  },
});
