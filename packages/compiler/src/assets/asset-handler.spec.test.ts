import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ArrayType, ScalarType } from "../frontend/semantic-types.js";
import { SCALAR_TYPES } from "../frontend/constants.js";
import { projectDiagnostic } from "../project/diagnostics.js";
import type { SourceSpan } from "../project/types.js";
import { nativeAssetId, rawAssetId } from "./asset-identity.js";
import {
  createNativeOutput,
  type AssetHandler,
  type AssetHandlerFailure,
  type AssetHandlerOutput,
  type AssetHandlerRequest,
  type AssetSelectorInfo,
} from "./asset-handler.js";
import { dispatchAsset } from "./asset-dispatch.js";
import { nativeAssetDiagnostic } from "./asset-diagnostics.js";
import type { EmbeddedArrayValue, EmbeddedScalarValue } from "./asset-types.js";

const SPAN: SourceSpan = Object.freeze({ sourceId: "src/game.blend", start: 10, end: 40 });
const BYTE_ARRAY: ArrayType = Object.freeze({
  kind: "array",
  element: SCALAR_TYPES.byte,
  length: 4,
  size: 4,
});

function request(overrides: Partial<AssetHandlerRequest> = {}): AssetHandlerRequest {
  return Object.freeze({
    sourceId: "src/game.blend",
    literalPath: "assets/player.spd",
    resolvedPath: "assets/player.spd",
    selector: null,
    owner: "resident",
    span: SPAN,
    bytes: Object.freeze([1, 2, 3, 4]),
    inputSha256: createHash("sha256")
      .update(Buffer.from([1, 2, 3, 4]))
      .digest("hex"),
    ...overrides,
  });
}

const SELECTORS: readonly AssetSelectorInfo[] = Object.freeze([
  Object.freeze({
    name: "sprites",
    type: Object.freeze({ kind: "array" as const, array: BYTE_ARRAY }),
    available: true,
    default: true,
  }),
  Object.freeze({
    name: "count",
    type: Object.freeze({ kind: "scalar" as const, scalar: SCALAR_TYPES.word }),
    available: true,
    default: false,
  }),
]);

/** Build one synthetic handler with observable parse calls. */
function handler(
  parse: (input: AssetHandlerRequest) => AssetHandlerOutput | AssetHandlerFailure,
  overrides: Partial<AssetHandler> = {},
): { readonly handler: AssetHandler; readonly calls: AssetHandlerRequest[] } {
  const calls: AssetHandlerRequest[] = [];
  return {
    calls,
    handler: Object.freeze({
      key: "spritepad",
      version: "3.80",
      extensions: Object.freeze([".spd"]),
      defaultSelector: "sprites",
      parse: (input: AssetHandlerRequest) => {
        calls.push(input);
        return parse(input);
      },
      ...overrides,
    }),
  };
}

function arrayOutput(
  input: AssetHandlerRequest,
  selector = "sprites",
  bytes: readonly number[] = [1, 2, 3, 4],
): AssetHandlerOutput {
  return createNativeOutput({
    handlerKey: "spritepad",
    handlerVersion: "3.80",
    request: input,
    resolvedSelector: selector,
    representation: "native-bytes",
    type: Object.freeze({ ...BYTE_ARRAY, length: bytes.length, size: bytes.length }),
    bytes,
    constraints: Object.freeze([{ kind: "align", origin: "handler", bytes: 64 }]),
    selectors: SELECTORS,
  });
}

function failure(code: string, message: string): AssetHandlerFailure {
  return Object.freeze({ kind: "failure", diagnostic: projectDiagnostic(code, message, SPAN) });
}

describe("asset handler dispatch", () => {
  // A registered handler owns its extension and resolves the documented default selector.
  it("should dispatch to the registered handler and resolve its default selector", () => {
    const { handler: spritepad, calls } = handler((input) => arrayOutput(input));
    const result = dispatchAsset(request(), new Map([["spritepad", spritepad]]), new Set([".spd"]));
    expect(result.kind).toBe("output");
    if (result.kind !== "output") throw new Error("Expected a handler output");
    expect(result.resolvedSelector).toBe("sprites");
    expect(result.representation).toBe("native-bytes");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.selector).toBe("sprites");
  });

  // A reserved extension must never fall back to raw bytes or reach a parser.
  it("should fail closed for a reserved extension without a registered handler", () => {
    const result = dispatchAsset(request(), new Map(), new Set([".spd"]));
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected a reserved failure");
    expect(result.diagnostic.code).toBe("E10204");
    expect(result.diagnostic.message).toMatch(/reserved/iu);
    expect(result.diagnostic.primarySpan).toEqual(SPAN);
  });

  // A selector on an unregistered extension is rejected before any input is read.
  it("should reject a selector when no handler owns the extension", () => {
    const result = dispatchAsset(
      request({ literalPath: "assets/table.bin", selector: "x" }),
      new Map(),
      new Set([".spd"]),
    );
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected an extension failure");
    expect(result.diagnostic.code).toBe("E10137");
  });

  // Native delivery under a loadable const is refused before the handler parses anything.
  it("should refuse a native loadable const without parsing the file", () => {
    const { handler: spritepad, calls } = handler((input) => arrayOutput(input));
    const result = dispatchAsset(
      request({ owner: "loadable" }),
      new Map([["spritepad", spritepad]]),
      new Set([".spd"]),
    );
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected a loadable failure");
    expect(result.diagnostic.code).toBe("E10204");
    expect(result.diagnostic.message).toMatch(/loadable/iu);
    expect(calls).toHaveLength(0);
  });

  // Every rejected selector names the complete available inventory.
  it("should pass through an unknown-selector diagnostic with the available inventory", () => {
    const { handler: spritepad } = handler(() =>
      failure("E10133", "Selector 'nope' is unavailable — choose one of: 'sprites', 'count'"),
    );
    const result = dispatchAsset(
      request({ selector: "nope" }),
      new Map([["spritepad", spritepad]]),
      new Set([".spd"]),
    );
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected a selector failure");
    expect(result.diagnostic.code).toBe("E10133");
    expect(result.diagnostic.message).toContain("'sprites', 'count'");
  });

  // A selected array above the language extent limit fails before any value is exposed.
  it("should reject a selected output larger than 65535 bytes", () => {
    const oversized = Object.freeze(new Array<number>(0x10000).fill(0));
    const { handler: spritepad } = handler((input) => arrayOutput(input, "sprites", oversized));
    const result = dispatchAsset(request(), new Map([["spritepad", spritepad]]), new Set([".spd"]));
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected an extent failure");
    expect(result.diagnostic.code).toBe("E10265");
  });

  // Scalar selectors produce compile-time values with no resident bytes.
  it("should build an immutable scalar value for a scalar selector", () => {
    const input = request({ selector: "count" });
    const output = createNativeOutput({
      handlerKey: "spritepad",
      handlerVersion: "3.80",
      request: input,
      resolvedSelector: "count",
      representation: "scalar-word",
      type: SCALAR_TYPES.word as ScalarType,
      scalar: 0x1234n,
      constraints: Object.freeze([]),
      selectors: SELECTORS,
    });
    expect(output.value.kind).toBe("embedded-scalar");
    const value = output.value as EmbeddedScalarValue;
    expect(value.value).toBe(0x1234n);
    expect(value.constant).toBe(true);
    expect(value.type).toEqual(SCALAR_TYPES.word);
    expect(Object.isFrozen(value)).toBe(true);
  });

  // A handler that ignores the requested selector is rejected as inconsistent.
  it("should reject a handler that ignores the requested selector", () => {
    const { handler: spritepad } = handler((input) => arrayOutput(input, "sprites"));
    const result = dispatchAsset(
      request({ selector: "count" }),
      new Map([["spritepad", spritepad]]),
      new Set([".spd"]),
    );
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected a selector failure");
    expect(result.diagnostic.code).toBe("E10204");
  });

  // A handler that reports a digest unrelated to its selected value is rejected.
  it("should reject a handler output with a mismatched output digest", () => {
    const { handler: spritepad } = handler((input) => ({
      ...arrayOutput(input),
      outputSha256: "0".repeat(64),
    }));
    const result = dispatchAsset(request(), new Map([["spritepad", spritepad]]), new Set([".spd"]));
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected a digest failure");
    expect(result.diagnostic.code).toBe("E10204");
  });

  // A missing default is a handler failure rather than an implicit selector.
  it("should require a selector when the handler declares no default", () => {
    const { handler: spritepad } = handler(
      () => failure("E10132", "This registered format requires a selector"),
      { defaultSelector: null },
    );
    const result = dispatchAsset(request(), new Map([["spritepad", spritepad]]), new Set([".spd"]));
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected a selector failure");
    expect(result.diagnostic.code).toBe("E10132");
  });

  // Array outputs keep the selected byte sequence and 64-byte handler constraint.
  it("should retain the exact selected bytes and handler constraints", () => {
    const input = request();
    const output = arrayOutput(input);
    const value = output.value as EmbeddedArrayValue;
    expect(value.kind).toBe("embedded");
    expect(value.bytes).toEqual([1, 2, 3, 4]);
    expect(value.type).toMatchObject({ kind: "array", length: 4 });
    expect(output.constraints).toEqual([{ kind: "align", origin: "handler", bytes: 64 }]);
  });
});

describe("asset identity", () => {
  const provenance = {
    handlerKey: "spritepad",
    handlerVersion: "3.80",
    selector: "sprites",
    representation: "native-bytes",
    inputSha256: "a".repeat(64),
    outputSha256: "b".repeat(64),
    selectors: SELECTORS,
  };

  // Different selectors of one file are always distinct canonical objects.
  it("should distinguish selectors and representations of one input", () => {
    const base = nativeAssetId(provenance, "assets/player.spd");
    const selector = nativeAssetId({ ...provenance, selector: "count" }, "assets/player.spd");
    const representation = nativeAssetId(
      { ...provenance, representation: "packed12" },
      "assets/player.spd",
    );
    expect(new Set([base, selector, representation]).size).toBe(3);
  });

  // Equal output bytes from two different inputs keep two identities and addresses.
  it("should distinguish two inputs that produce equal output bytes", () => {
    const first = nativeAssetId(provenance, "assets/first.spd");
    const second = nativeAssetId(provenance, "assets/second.spd");
    expect(first).not.toBe(second);
  });

  // The established raw identity stays byte-for-byte stable.
  it("should keep the raw identity stable for unchanged inputs", () => {
    const expected = createHash("sha256")
      .update(`blend65-raw-v1\0assets/table.bin\0${"c".repeat(64)}`, "utf8")
      .digest("hex");
    expect(rawAssetId("assets/table.bin", "c".repeat(64))).toBe(expected);
  });
});

describe("native asset diagnostics", () => {
  // A structural failure names the declaration, relative spelling, handler, field and remedy.
  it("should format one diagnostic without an absolute path or binary dump", () => {
    const diagnostic = nativeAssetDiagnostic({
      code: "E10204",
      declaration: "SPRITES",
      literalPath: "assets/player.spd",
      handlerKey: "spritepad",
      handlerVersion: "3.80",
      field: "VERSION",
      offset: 3,
      remedy: "save the project as SPD version 5",
      span: SPAN,
    });
    expect(diagnostic.code).toBe("E10204");
    expect(diagnostic.message).toContain("'SPRITES'");
    expect(diagnostic.message).toContain("'assets/player.spd'");
    expect(diagnostic.message).toContain("'spritepad' 3.80");
    expect(diagnostic.message).toContain("'VERSION' (offset 3)");
    expect(diagnostic.message).toContain("save the project as SPD version 5");
    expect(diagnostic.message).not.toMatch(/^\/|\\\\|[A-Za-z]:\\/u);
  });

  // Escaped bytes cannot forge a second line or an absolute host path.
  it("should escape hostile declaration and path spellings", () => {
    const diagnostic = nativeAssetDiagnostic({
      code: "E10204",
      declaration: "A\nB/secret",
      literalPath: "assets/\u0000evil",
      handlerKey: "spritepad",
      handlerVersion: "3.80",
      remedy: "fix the file",
      span: SPAN,
    });
    expect(diagnostic.message).not.toContain("\n");
    expect(diagnostic.message).not.toContain("\u0000");
  });
});
