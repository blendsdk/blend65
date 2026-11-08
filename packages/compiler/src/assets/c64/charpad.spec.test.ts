import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AssetHandlerRequest } from "../asset-handler.js";
import { charpadHandler } from "./charpad.js";

const producerRoot = "/home/gevik/workdir/github/blend65.ri/apps";
const available = existsSync(producerRoot);
const manifest = JSON.parse(
  readFileSync(
    new URL("../../../../../test/rd06/fixtures/producer-evidence.json", import.meta.url),
    "utf8",
  ),
) as {
  fixtures: { id: string; family: string; path: string; sha256: string }[];
};

/** Read one producer fixture and build a request for it. */
function request(id: string, selector: string | null = null): AssetHandlerRequest {
  const entry = manifest.fixtures.find((item) => item.id === id);
  if (entry === undefined) throw new Error(`Missing fixture ${id}`);
  const bytes = [...readFileSync(join(producerRoot, entry.path))];
  expect(createHash("sha256").update(Buffer.from(bytes)).digest("hex")).toBe(entry.sha256);
  return Object.freeze({
    sourceId: "src/game.blend",
    literalPath: "assets/project.ctm",
    resolvedPath: "assets/project.ctm",
    selector,
    owner: "resident",
    span: Object.freeze({ sourceId: "src/game.blend", start: 0, end: 10 }),
    declaration: "LEVEL",
    profileId: "c64-pal-prg-kernal-6581",
    bytes: Object.freeze(bytes),
    inputSha256: entry.sha256,
  });
}

/** Parse one selector and require an output. */
function output(id: string, selector: string) {
  const result = charpadHandler.parse(request(id, selector));
  expect(result.kind, result.kind === "failure" ? result.diagnostic.message : "").toBe("output");
  if (result.kind !== "output") throw new Error("Expected CharPad output");
  return result;
}

/** Read one scalar selector as a bigint. */
function scalar(id: string, selector: string): bigint {
  const result = output(id, selector);
  expect(result.value.kind).toBe("embedded-scalar");
  if (result.value.kind !== "embedded-scalar") throw new Error("Expected scalar");
  return typeof result.value.value === "bigint" ? result.value.value : result.value.value ? 1n : 0n;
}

/** Read one array selector as bytes. */
function bytes(id: string, selector: string): readonly number[] {
  const result = output(id, selector);
  expect(result.value.kind).toBe("embedded");
  if (result.value.kind !== "embedded") throw new Error("Expected array");
  return result.value.bytes;
}

describe.skipIf(!available)("CharPad 3.80 CTM v9 producer examples", () => {
  // A tile map exposes its exact projected charset, tile and map data.
  it("should parse Hexagone tile-per-tile data", () => {
    expect(scalar("charpad-3.80-ctm9-tile-per-tile", "tile_mode")).toBe(1n);
    expect(scalar("charpad-3.80-ctm9-tile-per-tile", "color_method")).toBe(1n);
    const charCount = scalar("charpad-3.80-ctm9-tile-per-tile", "charset_count");
    expect(bytes("charpad-3.80-ctm9-tile-per-tile", "charset")).toHaveLength(Number(charCount) * 8);
    expect(bytes("charpad-3.80-ctm9-tile-per-tile", "char_materials")).toHaveLength(
      Number(charCount),
    );
    const width = scalar("charpad-3.80-ctm9-tile-per-tile", "tile_width");
    const height = scalar("charpad-3.80-ctm9-tile-per-tile", "tile_height");
    const tiles = scalar("charpad-3.80-ctm9-tile-per-tile", "tile_count");
    expect(bytes("charpad-3.80-ctm9-tile-per-tile", "tiles_word")).toHaveLength(
      Number(width * height * tiles) * 2,
    );
    const mapWidth = scalar("charpad-3.80-ctm9-tile-per-tile", "map_width");
    const mapHeight = scalar("charpad-3.80-ctm9-tile-per-tile", "map_height");
    expect(bytes("charpad-3.80-ctm9-tile-per-tile", "map")).toHaveLength(
      Number(mapWidth * mapHeight),
    );
    expect(bytes("charpad-3.80-ctm9-tile-per-tile", "colors")).toHaveLength(Number(tiles));
  });

  // A no-tile text map still exposes its charset and map representations.
  it("should parse a text map without a tile layer", () => {
    const id = "charpad-3.80-ctm9-text-hr-no-tiles";
    expect(scalar(id, "tile_mode")).toBe(0n);
    expect(scalar(id, "tile_width")).toBe(1n);
    expect(scalar(id, "tile_height")).toBe(1n);
    expect(() => charpadHandler.parse(request(id, "tiles"))).not.toThrow();
    const tiles = charpadHandler.parse(request(id, "tiles"));
    expect(tiles.kind).toBe("failure");
    if (tiles.kind !== "failure") throw new Error("Expected no tile layer");
    expect(tiles.diagnostic.code).toBe("E10133");
    expect(bytes(id, "map").length).toBe(
      Number(scalar(id, "map_width") * scalar(id, "map_height")),
    );
  });

  // Per-char bitmap color data has the exact three-byte-per-character width.
  it("should parse bitmap per-char colors", () => {
    const id = "charpad-3.80-ctm9-bitmap-mc-per-char";
    expect(scalar(id, "color_method")).toBe(2n);
    expect(bytes(id, "colors")).toHaveLength(Number(scalar(id, "charset_count")) * 3);
  });

  // Every producer example has no default and requires an explicit selector.
  it("should require an explicit selector for every example", () => {
    for (const entry of manifest.fixtures.filter(({ family }) => family === "charpad")) {
      const result = charpadHandler.parse(request(entry.id));
      expect(result.kind, entry.id).toBe("failure");
      if (result.kind !== "failure") throw new Error("Expected missing selector");
      expect(result.diagnostic.code).toBe("E10132");
    }
  });

  // Adjacent versions, reserved bits and trailing bytes fail closed.
  it("should reject adjacent versions, reserved flags and trailing bytes", () => {
    const base = [...request("charpad-3.80-ctm9-tile-per-tile").bytes];
    for (const [label, bytesValue] of [
      ["version 8", base.map((byte, index) => (index === 3 ? 8 : byte))],
      ["version 10", base.map((byte, index) => (index === 3 ? 10 : byte))],
      ["reserved flag", base.map((byte, index) => (index === 6 ? byte | 0x02 : byte))],
      ["keymap 11", base.map((byte, index) => (index === 6 ? (0xb << 4) | (byte & 0x0f) : byte))],
      ["trailing", [...base, 0]],
    ] as const) {
      const result = charpadHandler.parse({
        ...request("charpad-3.80-ctm9-tile-per-tile"),
        bytes: bytesValue,
        inputSha256: createHash("sha256").update(Buffer.from(bytesValue)).digest("hex"),
      });
      expect(result.kind, label).toBe("failure");
      if (result.kind !== "failure") throw new Error(`Expected ${label} failure`);
      expect(result.diagnostic.code).toBe("E10204");
    }
  });

  // A map cell that references a missing tile is rejected.
  it("should reject an out-of-range map cell", () => {
    const bytes = [...request("charpad-3.80-ctm9-tile-per-tile").bytes];
    // The map block is the final block; flip its last cell to $FFFF.
    bytes[bytes.length - 1] = 0xff;
    bytes[bytes.length - 2] = 0xff;
    const result = charpadHandler.parse({
      ...request("charpad-3.80-ctm9-tile-per-tile"),
      bytes,
      inputSha256: createHash("sha256").update(Buffer.from(bytes)).digest("hex"),
    });
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected map rejection");
    expect(result.diagnostic.code).toBe("E10204");
  });
});
