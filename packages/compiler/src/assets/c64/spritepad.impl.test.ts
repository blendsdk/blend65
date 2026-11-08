import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { SourceSpan } from "../../project/types.js";
import type { AssetHandlerRequest } from "../asset-handler.js";
import { spritepadHandler } from "./spritepad.js";

const SPAN: SourceSpan = Object.freeze({ sourceId: "src/game.blend", start: 0, end: 10 });

/** Build one minimal SPD v5 project with one 1x1 tile and a caller-supplied name. */
function spd(name: string): Buffer {
  const header = Buffer.alloc(20);
  header.write("SPD", 0, "ascii");
  header[3] = 5;
  header[4] = 0x01;
  header.writeUInt16LE(1, 5);
  header.writeUInt16LE(1, 7);
  header[9] = 0;
  header[10] = 0;
  header[11] = 1;
  header[12] = 1;
  return Buffer.concat([
    header,
    Buffer.alloc(64, 0x44),
    Buffer.from([0x00, 0x00]),
    Buffer.from([0x01]),
    Buffer.from([0x02]),
    Buffer.from(name, "ascii"),
    Buffer.from([0]),
  ]);
}

/** Build one request. */
function request(bytes: Buffer, selector: string | null = null): AssetHandlerRequest {
  return Object.freeze({
    sourceId: "src/game.blend",
    literalPath: "assets/project.spd",
    resolvedPath: "assets/project.spd",
    selector,
    owner: "resident",
    span: SPAN,
    declaration: "SPRITES",
    profileId: "c64-pal-prg-kernal-6581",
    bytes: Object.freeze([...bytes]),
    inputSha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

describe("SpritePad internals", () => {
  // A tile name longer than 32 characters is rejected at the name block.
  it("should reject a tile name longer than 32 characters", () => {
    const result = spritepadHandler.parse(request(spd("x".repeat(33)), "tiles"));
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected name rejection");
    expect(result.diagnostic.code).toBe("E10204");
    expect(result.diagnostic.message).toContain("32");
  });

  // A valid 1x1 tile exposes its exact cell, attribute and tag.
  it("should expose one tile cell, attribute and tag", () => {
    const bytes = spd("t");
    const tiles = spritepadHandler.parse(request(bytes, "tiles"));
    expect(tiles.kind).toBe("output");
    if (tiles.kind !== "output") throw new Error("Expected tiles");
    expect(tiles.value.kind).toBe("embedded");
    if (tiles.value.kind !== "embedded") throw new Error("Expected tile bytes");
    expect(tiles.value.bytes).toEqual([0x00, 0x00]);
    expect(tiles.value.type).toMatchObject({ kind: "array", element: { name: "word" }, length: 1 });
    const attributes = spritepadHandler.parse(request(bytes, "tile_attributes"));
    expect(attributes.kind).toBe("output");
    if (attributes.kind !== "output") throw new Error("Expected tile attributes");
    expect(attributes.value).toMatchObject({ kind: "embedded", bytes: [0x01] });
  });

  // A no-tile project rejects tile selectors instead of returning an empty value.
  it("should reject tile selectors without a tile layer", () => {
    const header = Buffer.alloc(20);
    header.write("SPD", 0, "ascii");
    header[3] = 5;
    header.writeUInt16LE(1, 5);
    const bytes = Buffer.concat([header, Buffer.alloc(64, 0x33)]);
    for (const selector of ["tiles", "tile_attributes", "tile_tags"]) {
      const result = spritepadHandler.parse(request(bytes, selector));
      expect(result.kind, selector).toBe("failure");
      if (result.kind !== "failure") throw new Error("Expected no tile layer");
      expect(result.diagnostic.code).toBe("E10133");
    }
  });
});
