import { SCALAR_TYPES } from "../../frontend/constants.js";
import { nativeAssetDiagnostic } from "../asset-diagnostics.js";
import {
  createNativeOutput,
  type AssetHandler,
  type AssetHandlerFailure,
  type AssetHandlerRequest,
  type AssetSelectorInfo,
} from "../asset-handler.js";

const HANDLER_KEY = "koala";
const HANDLER_VERSION = "classic";
const FILE_BYTES = 10_003;
const LOAD_ADDRESS = 0x6000;
const BITMAP_BYTES = 8_000;
const SCREEN_BYTES = 1_000;
const COLOR_BYTES = 1_000;

/** Build one selector inventory with no default. */
function selectors(): readonly AssetSelectorInfo[] {
  return Object.freeze([
    Object.freeze({
      name: "bitmap",
      type: Object.freeze({
        kind: "array" as const,
        array: Object.freeze({
          kind: "array",
          element: SCALAR_TYPES.byte,
          length: BITMAP_BYTES,
          size: BITMAP_BYTES,
        }),
      }),
      available: true,
      default: false,
    }),
    Object.freeze({
      name: "screen",
      type: Object.freeze({
        kind: "array" as const,
        array: Object.freeze({
          kind: "array",
          element: SCALAR_TYPES.byte,
          length: SCREEN_BYTES,
          size: SCREEN_BYTES,
        }),
      }),
      available: true,
      default: false,
    }),
    Object.freeze({
      name: "color_ram",
      type: Object.freeze({
        kind: "array" as const,
        array: Object.freeze({
          kind: "array",
          element: SCALAR_TYPES.byte,
          length: COLOR_BYTES,
          size: COLOR_BYTES,
        }),
      }),
      available: true,
      default: false,
    }),
    Object.freeze({
      name: "background",
      type: Object.freeze({ kind: "scalar" as const, scalar: SCALAR_TYPES.byte }),
      available: true,
      default: false,
    }),
  ]);
}

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

/**
 * Validate one classic Koala Paint project and expose exactly four components.
 *
 * Every source byte is preserved, including unused high nibbles. The handler
 * attaches alignment and VIC-visibility constraints to the two display
 * components; it never supplies a base address, `$D018` value or Color RAM
 * transfer.
 */
export const koalaHandler: AssetHandler = Object.freeze({
  key: HANDLER_KEY,
  version: HANDLER_VERSION,
  extensions: Object.freeze([".kla", ".koa"]),
  defaultSelector: null,
  parse(request: AssetHandlerRequest): ReturnType<AssetHandler["parse"]> {
    const bytes = request.bytes;
    if (bytes.length !== FILE_BYTES) {
      return failure(
        request,
        "E10204",
        "LENGTH",
        FILE_BYTES,
        `a classic Koala file is exactly ${FILE_BYTES} bytes; found ${bytes.length}`,
      );
    }
    const load = bytes[0]! | (bytes[1]! << 8);
    if (load !== LOAD_ADDRESS) {
      return failure(
        request,
        "E10204",
        "LOAD_ADDRESS",
        0,
        `a classic Koala file loads at $${LOAD_ADDRESS.toString(16)}; found $${load.toString(16)}`,
      );
    }
    const inventory = selectors();
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
          remedy: `choose one of: ${inventory.map(({ name }) => `'${name}'`).join(", ")}`,
          span: request.span,
        }),
      });
    }
    if (selector === "bitmap") {
      const bitmap = bytes.slice(2, 2 + BITMAP_BYTES);
      return createNativeOutput({
        handlerKey: HANDLER_KEY,
        handlerVersion: HANDLER_VERSION,
        request,
        resolvedSelector: "bitmap",
        representation: "koala-bitmap",
        type: Object.freeze({
          kind: "array",
          element: SCALAR_TYPES.byte,
          length: BITMAP_BYTES,
          size: BITMAP_BYTES,
        }),
        bytes: Object.freeze([...bitmap]),
        constraints: Object.freeze([
          Object.freeze({ kind: "align" as const, origin: "handler" as const, bytes: 8_192 }),
          Object.freeze({
            kind: "visibility" as const,
            origin: "handler" as const,
            consumer: "vic" as const,
            conditionId: "vic",
          }),
        ]),
        selectors: inventory,
      });
    }
    if (selector === "screen") {
      const screen = bytes.slice(2 + BITMAP_BYTES, 2 + BITMAP_BYTES + SCREEN_BYTES);
      return createNativeOutput({
        handlerKey: HANDLER_KEY,
        handlerVersion: HANDLER_VERSION,
        request,
        resolvedSelector: "screen",
        representation: "koala-screen",
        type: Object.freeze({
          kind: "array",
          element: SCALAR_TYPES.byte,
          length: SCREEN_BYTES,
          size: SCREEN_BYTES,
        }),
        bytes: Object.freeze([...screen]),
        constraints: Object.freeze([
          Object.freeze({ kind: "align" as const, origin: "handler" as const, bytes: 1_024 }),
          Object.freeze({
            kind: "visibility" as const,
            origin: "handler" as const,
            consumer: "vic" as const,
            conditionId: "vic",
          }),
        ]),
        selectors: inventory,
      });
    }
    if (selector === "color_ram") {
      const color = bytes.slice(
        2 + BITMAP_BYTES + SCREEN_BYTES,
        2 + BITMAP_BYTES + SCREEN_BYTES + COLOR_BYTES,
      );
      return createNativeOutput({
        handlerKey: HANDLER_KEY,
        handlerVersion: HANDLER_VERSION,
        request,
        resolvedSelector: "color_ram",
        representation: "koala-color-ram",
        type: Object.freeze({
          kind: "array",
          element: SCALAR_TYPES.byte,
          length: COLOR_BYTES,
          size: COLOR_BYTES,
        }),
        bytes: Object.freeze([...color]),
        constraints: Object.freeze([]),
        selectors: inventory,
      });
    }
    if (selector === "background") {
      return createNativeOutput({
        handlerKey: HANDLER_KEY,
        handlerVersion: HANDLER_VERSION,
        request,
        resolvedSelector: "background",
        representation: "scalar-byte",
        type: SCALAR_TYPES.byte,
        scalar: BigInt(bytes[2 + BITMAP_BYTES + SCREEN_BYTES + COLOR_BYTES]!),
        constraints: Object.freeze([]),
        selectors: inventory,
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
