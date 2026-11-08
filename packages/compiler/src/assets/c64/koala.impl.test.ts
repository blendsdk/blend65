import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SourceSpan } from "../../project/types.js";
import { canonicalAssetExtension, dispatchAsset } from "../asset-dispatch.js";
import type { AssetHandlerRequest } from "../asset-handler.js";
import { koalaHandler } from "./koala.js";

const SPAN: SourceSpan = Object.freeze({ sourceId: "src/game.blend", start: 0, end: 10 });

/** Read one committed Koala fixture. */
function fixture(name: string): Buffer {
  return Buffer.from(
    readFileSync(
      new URL(`../../../../../test/rd06/fixtures/public/koala/${name}.kla`, import.meta.url),
    ),
  );
}

/** Build one handler request. */
function request(
  bytes: Buffer,
  selector: string | null,
  path = "assets/level.kla",
): AssetHandlerRequest {
  return Object.freeze({
    sourceId: "src/game.blend",
    literalPath: path,
    resolvedPath: path,
    selector,
    owner: "resident",
    span: SPAN,
    declaration: "LEVEL",
    profileId: "c64-pal-prg-kernal-6581",
    bytes: Object.freeze([...bytes]),
    inputSha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

describe("Koala internals", () => {
  // Component boundaries are exact and do not offset by one.
  it("should slice each component at its exact boundary", () => {
    const bytes = fixture("koala-patterned");
    const bitmap = koalaHandler.parse(request(bytes, "bitmap"));
    const screen = koalaHandler.parse(request(bytes, "screen"));
    const color = koalaHandler.parse(request(bytes, "color_ram"));
    if (bitmap.kind !== "output" || screen.kind !== "output" || color.kind !== "output")
      throw new Error("Expected Koala outputs");
    const bitmapBytes = bitmap.value.kind === "embedded" ? bitmap.value.bytes : [];
    const screenBytes = screen.value.kind === "embedded" ? screen.value.bytes : [];
    const colorBytes = color.value.kind === "embedded" ? color.value.bytes : [];
    expect(bitmapBytes[0]).toBe(bytes[2]);
    expect(bitmapBytes.at(-1)).toBe(bytes[8001]);
    expect(screenBytes[0]).toBe(bytes[8002]);
    expect(screenBytes.at(-1)).toBe(bytes[9001]);
    expect(colorBytes[0]).toBe(bytes[9002]);
    expect(colorBytes.at(-1)).toBe(bytes[10001]);
  });

  // Extension lookup is canonical regardless of source casing.
  it("should canonicalize .KLA and .KOA", () => {
    expect(canonicalAssetExtension("assets/LEVEL.KLA")).toBe(".kla");
    expect(canonicalAssetExtension("assets/LEVEL.KOA")).toBe(".koa");
    const result = dispatchAsset(
      request(fixture("koala-zero"), "bitmap", "assets/LEVEL.KLA"),
      new Map([["koala", koalaHandler]]),
      new Set([".kla", ".koa"]),
    );
    expect(result.kind).toBe("output");
  });

  // A background byte keeps its full eight bits.
  it("should preserve every background bit", () => {
    const result = koalaHandler.parse(
      request(fixture("koala-background-high-nibble"), "background"),
    );
    expect(result.kind).toBe("output");
    if (result.kind !== "output") throw new Error("Expected background output");
    expect(result.value).toMatchObject({ kind: "embedded-scalar", value: 0xabn });
  });
});
