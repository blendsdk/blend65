import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SourceSpan } from "../../project/types.js";
import type { AssetHandlerRequest } from "../asset-handler.js";
import { dispatchAsset } from "../asset-dispatch.js";
import { koalaHandler } from "./koala.js";

const SPAN: SourceSpan = Object.freeze({ sourceId: "src/game.blend", start: 30, end: 80 });

/** Read one committed constructed Koala fixture. */
function fixture(name: string): Buffer {
  return Buffer.from(
    readFileSync(
      new URL(`../../../../../test/rd06/fixtures/public/koala/${name}.kla`, import.meta.url),
    ),
  );
}

/** Build one handler request over exact bytes. */
function request(bytes: Buffer, selector: string | null): AssetHandlerRequest {
  return Object.freeze({
    sourceId: "src/game.blend",
    literalPath: "assets/level.kla",
    resolvedPath: "assets/level.kla",
    selector,
    owner: "resident",
    span: SPAN,
    declaration: "BITMAP",
    profileId: "c64-pal-prg-kernal-6581",
    bytes: Object.freeze([...bytes]),
    inputSha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

/** Require one accepted output. */
function output(name: string, selector: string) {
  const result = koalaHandler.parse(request(fixture(name), selector));
  expect(result.kind).toBe("output");
  if (result.kind !== "output") throw new Error(JSON.stringify(result.diagnostic));
  return result;
}

/** Require one exact failure. */
function failure(
  name: string,
  code: string,
  selector: string | null = null,
  mutate?: (bytes: Buffer) => void,
): void {
  const bytes = Buffer.from(fixture(name));
  mutate?.(bytes);
  const result = koalaHandler.parse(request(bytes, selector));
  expect(result.kind).toBe("failure");
  if (result.kind !== "failure") throw new Error("Expected a Koala failure");
  expect(result.diagnostic.code).toBe(code);
}

describe("Koala components", () => {
  // The four selectors expose the exact component slices of the 10,003-byte file.
  it("should expose the exact bitmap, screen, color and background slices", () => {
    const bytes = fixture("koala-patterned");
    const bitmap = output("koala-patterned", "bitmap");
    const screen = output("koala-patterned", "screen");
    const color = output("koala-patterned", "color_ram");
    const background = output("koala-patterned", "background");
    if (bitmap.value.kind !== "embedded") throw new Error("Expected bitmap bytes");
    if (screen.value.kind !== "embedded") throw new Error("Expected screen bytes");
    if (color.value.kind !== "embedded") throw new Error("Expected color bytes");
    expect(bitmap.value.bytes).toEqual([...bytes.subarray(2, 8002)]);
    expect(screen.value.bytes).toEqual([...bytes.subarray(8002, 9002)]);
    expect(color.value.bytes).toEqual([...bytes.subarray(9002, 10002)]);
    expect(background.value).toMatchObject({ kind: "embedded-scalar", value: 6n });
  });

  // The handler never supplies an implicit default selector.
  it("should require an explicit selector", () => {
    failure("koala-zero", "E10132");
  });

  // Unknown selectors list the complete four-name inventory.
  it("should list available selectors for an unknown name", () => {
    const result = koalaHandler.parse(request(fixture("koala-zero"), "tiles"));
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected selector failure");
    expect(result.diagnostic.code).toBe("E10133");
    expect(result.diagnostic.message).toContain("'bitmap'");
    expect(result.diagnostic.message).toContain("'screen'");
    expect(result.diagnostic.message).toContain("'color_ram'");
    expect(result.diagnostic.message).toContain("'background'");
  });

  // Only the requested component is produced; no companion image is invented.
  it("should emit only the requested component", () => {
    const bitmap = output("koala-patterned", "bitmap");
    expect(bitmap.value.kind).toBe("embedded");
    if (bitmap.value.kind !== "embedded") throw new Error("Expected bitmap bytes");
    expect(bitmap.value.bytes).toHaveLength(8000);
    expect(bitmap.selectors.map(({ name }) => name)).toEqual([
      "bitmap",
      "screen",
      "color_ram",
      "background",
    ]);
  });

  // Every Color RAM byte and the background byte preserve their high nibbles.
  it("should preserve high nibbles in color and background bytes", () => {
    const color = output("koala-color-high-nibble", "color_ram");
    const background = output("koala-background-high-nibble", "background");
    if (color.value.kind !== "embedded") throw new Error("Expected color bytes");
    expect(color.value.bytes[0]).toBe(0xf0);
    expect(color.value.bytes[999]).toBe(0xf0 | (999 & 0x0f));
    expect(background.value).toMatchObject({ kind: "embedded-scalar", value: 0xabn });
  });

  // Display components carry the required alignment and VIC visibility; metadata does not.
  it("should attach alignment and visibility only to display components", () => {
    expect(output("koala-zero", "bitmap").constraints).toEqual([
      { kind: "align", origin: "handler", bytes: 8192 },
      { kind: "visibility", origin: "handler", consumer: "vic", conditionId: "vic" },
    ]);
    expect(output("koala-zero", "screen").constraints).toEqual([
      { kind: "align", origin: "handler", bytes: 1024 },
      { kind: "visibility", origin: "handler", consumer: "vic", conditionId: "vic" },
    ]);
    expect(output("koala-zero", "color_ram").constraints).toEqual([]);
    expect(output("koala-zero", "background").constraints).toEqual([]);
  });
});

describe("Koala rejection", () => {
  it("should reject every wrong file length", () => {
    for (const length of [0, 2, 8002, 10002, 10004]) {
      const bytes = Buffer.alloc(length);
      if (length >= 2) bytes.writeUInt16LE(0x6000, 0);
      const result = koalaHandler.parse(request(bytes, "bitmap"));
      expect(result.kind, `length ${length}`).toBe("failure");
      if (result.kind !== "failure") throw new Error("Expected length rejection");
      expect(result.diagnostic.code).toBe("E10204");
    }
  });

  it("should reject a wrong load address", () => {
    failure("koala-zero", "E10204", "bitmap", (bytes) => {
      bytes.writeUInt16LE(0x6001, 0);
    });
  });

  // Both accepted extensions dispatch to the same handler.
  it("should dispatch .kla and .koa to the same handler", () => {
    for (const extension of ["kla", "koa"]) {
      const result = dispatchAsset(
        Object.freeze({
          ...request(fixture("koala-zero"), "bitmap"),
          literalPath: `assets/level.${extension}`,
          resolvedPath: `assets/level.${extension}`,
        }),
        new Map([["koala", koalaHandler]]),
        new Set([".kla", ".koa"]),
      );
      expect(result.kind).toBe("output");
      if (result.kind !== "output") throw new Error("Expected Koala output");
      expect(result.handlerKey).toBe("koala");
    }
  });
});
