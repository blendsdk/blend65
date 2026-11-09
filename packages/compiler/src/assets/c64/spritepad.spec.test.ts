import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AssetHandlerRequest } from "../asset-handler.js";
import { spritepadHandler } from "./spritepad.js";

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
    literalPath: "assets/project.spd",
    resolvedPath: "assets/project.spd",
    selector,
    owner: "resident",
    span: Object.freeze({ sourceId: "src/game.blend", start: 0, end: 10 }),
    declaration: "SPRITES",
    profileId: "c64-pal-prg-kernal-6581",
    bytes: Object.freeze(bytes),
    inputSha256: entry.sha256,
  });
}

/** Parse one selector and require an output. */
function output(id: string, selector: string | null = null) {
  const result = spritepadHandler.parse(request(id, selector));
  expect(result.kind, result.kind === "failure" ? result.diagnostic.message : "").toBe("output");
  if (result.kind !== "output") throw new Error("Expected SpritePad output");
  return result;
}

/** Build a request over exact committed synthetic bytes. */
function synthetic(bytes: readonly number[], selector: string | null = null): AssetHandlerRequest {
  const frozen = Object.freeze([...bytes]);
  return Object.freeze({
    sourceId: "src/game.blend",
    literalPath: "assets/synthetic.spd",
    resolvedPath: "assets/synthetic.spd",
    selector,
    owner: "resident",
    span: Object.freeze({ sourceId: "src/game.blend", start: 0, end: 10 }),
    declaration: "SPRITES",
    profileId: "c64-pal-prg-kernal-6581",
    bytes: frozen,
    inputSha256: createHash("sha256").update(Buffer.from(frozen)).digest("hex"),
  });
}

const syntheticBytes = [
  ...readFileSync(
    new URL(
      "../../../../../test/rd06/fixtures/public/spritepad/synthetic-basic.spd",
      import.meta.url,
    ),
  ),
];

describe("SpritePad SPD v5 structural cases", () => {
  // An unknown or unavailable selector fails with the closed inventory.
  it("should reject unknown and unavailable selectors", () => {
    for (const selector of ["nope", "tiles"]) {
      const result = spritepadHandler.parse(synthetic(syntheticBytes, selector));
      expect(result.kind, selector).toBe("failure");
      if (result.kind !== "failure") throw new Error(`Expected ${selector} failure`);
      expect(result.diagnostic.code).toBe("E10133");
    }
  });

  // The declared sprite count controls the exact record boundary.
  it("should reject a declared count that exceeds the record data", () => {
    const bytes = [...syntheticBytes];
    bytes[5] = 2;
    const result = spritepadHandler.parse(synthetic(bytes));
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected count failure");
    expect(result.diagnostic.code).toBe("E10204");
  });

  // The inventory publishes exact parsed extents rather than zero-length placeholders.
  it("should publish exact selector extents and filter unavailable remedies", () => {
    const result = spritepadHandler.parse(synthetic(syntheticBytes));
    if (result.kind !== "output") throw new Error("Expected synthetic SpritePad output");
    const spriteCount = syntheticBytes[5]! | (syntheticBytes[6]! << 8);
    const extent = (name: string) => {
      const type = result.selectors.find(({ name: selector }) => selector === name)?.type;
      return type?.kind === "array" ? type.array : undefined;
    };
    expect(extent("sprites")).toMatchObject({ length: spriteCount * 64 });
    expect(extent("sprite_attributes")).toMatchObject({ length: spriteCount });
    const failure = spritepadHandler.parse(synthetic(syntheticBytes, "nope"));
    if (failure.kind !== "failure") throw new Error("Expected unavailable selector failure");
    expect(failure.diagnostic.message).not.toContain("'tiles'");
    expect(failure.diagnostic.message).not.toContain("'tile_attributes'");
  });

  // Truncation and unexplained trailing bytes are exact structural failures.
  it("should reject truncated and trailing bytes", () => {
    for (const bytes of [syntheticBytes.slice(0, -1), [...syntheticBytes, 0]]) {
      const result = spritepadHandler.parse(synthetic(bytes));
      expect(result.kind).toBe("failure");
      if (result.kind !== "failure") throw new Error("Expected structural failure");
      expect(result.diagnostic.code).toBe("E10204");
    }
  });
});

describe.skipIf(!available)("SpritePad 3.80 SPD v5 producer examples", () => {
  // A plain sprite sheet uses the default sprite selector and exact records.
  it("should parse ChromeFont with the default sprites selector", () => {
    const result = output("spritepad-3.80-spd5-chromefont");
    expect(result.handlerKey).toBe("spritepad");
    expect(result.resolvedSelector).toBe("sprites");
    expect(result.value.kind).toBe("embedded");
    if (result.value.kind !== "embedded") throw new Error("Expected sprites");
    expect(result.value.type).toMatchObject({ kind: "array", element: { name: "byte" } });
    expect(result.value.bytes).toHaveLength(37 * 64);
    expect(output("spritepad-3.80-spd5-chromefont", "count").value).toMatchObject({
      kind: "embedded-scalar",
      value: 37n,
    });
    const attributes = output("spritepad-3.80-spd5-chromefont", "sprite_attributes");
    if (attributes.value.kind !== "embedded") throw new Error("Expected attributes");
    expect(attributes.value.bytes).toHaveLength(37);
    const sprites = result.value;
    expect([...attributes.value.bytes]).toEqual(
      Array.from({ length: 37 }, (_, index) => sprites.bytes[index * 64 + 63]),
    );
  });

  // Sprite animation blocks expose exact frame, timer and flag arrays.
  it("should parse SpriteAnimations01 animation components", () => {
    const result = output("spritepad-3.80-spd5-sprite-animations");
    if (result.value.kind !== "embedded") throw new Error("Expected sprites");
    expect(result.value.bytes).toHaveLength(203 * 64);
    expect(
      output("spritepad-3.80-spd5-sprite-animations", "sprite_animation_count").value,
    ).toMatchObject({
      value: 40n,
    });
    for (const [selector, length] of [
      ["sprite_animation_starts", 80],
      ["sprite_animation_ends", 80],
      ["sprite_animation_timers", 40],
      ["sprite_animation_flags", 40],
    ] as const) {
      const selected = output("spritepad-3.80-spd5-sprite-animations", selector);
      if (selected.value.kind !== "embedded") throw new Error(`Expected ${selector}`);
      expect(selected.value.bytes).toHaveLength(length);
    }
  });

  // A tile sheet exposes its exact native tile data, attributes and tags.
  it("should parse Expanded Sprite Test tile components", () => {
    const result = output("spritepad-3.80-spd5-tiles");
    if (result.value.kind !== "embedded") throw new Error("Expected sprites");
    expect(result.value.bytes).toHaveLength(14 * 64);
    expect(output("spritepad-3.80-spd5-tiles", "tile_count").value).toMatchObject({ value: 6n });
    expect(output("spritepad-3.80-spd5-tiles", "tile_width").value).toMatchObject({ value: 3n });
    expect(output("spritepad-3.80-spd5-tiles", "tile_height").value).toMatchObject({ value: 3n });
    const tiles = output("spritepad-3.80-spd5-tiles", "tiles");
    if (tiles.value.kind !== "embedded") throw new Error("Expected tiles");
    expect(tiles.value.bytes).toHaveLength(6 * 3 * 3 * 2);
    for (const selector of ["tile_attributes", "tile_tags"]) {
      const selected = output("spritepad-3.80-spd5-tiles", selector);
      if (selected.value.kind !== "embedded") throw new Error(`Expected ${selector}`);
      expect(selected.value.bytes).toHaveLength(6);
    }
  });

  // Structural failures fail closed before exposing a partial value.
  it("should reject adjacent versions, reserved flags, truncation and trailing bytes", () => {
    const base = [...request("spritepad-3.80-spd5-chromefont").bytes];
    const cases: [string, number[]][] = [
      ["version 4", base.map((byte, index) => (index === 3 ? 4 : byte))],
      ["reserved flags", base.map((byte, index) => (index === 4 ? 0x80 : byte))],
      ["truncated", base.slice(0, base.length - 1)],
      ["trailing", [...base, 0]],
    ];
    for (const [label, bytes] of cases) {
      const result = spritepadHandler.parse({
        ...request("spritepad-3.80-spd5-chromefont"),
        bytes,
        inputSha256: createHash("sha256").update(Buffer.from(bytes)).digest("hex"),
      });
      expect(result.kind, label).toBe("failure");
      if (result.kind !== "failure") throw new Error(`Expected ${label} failure`);
      expect(result.diagnostic.code).toBe("E10204");
    }
  });

  // An animation frame outside the declared sprite set is rejected.
  it("should reject an animation frame outside the sprite set", () => {
    const bytes = [...request("spritepad-3.80-spd5-sprite-animations").bytes];
    const start = 20 + 203 * 64;
    bytes[start] = 0xff;
    bytes[start + 1] = 0xff;
    const result = spritepadHandler.parse({
      ...request("spritepad-3.80-spd5-sprite-animations"),
      bytes,
      inputSha256: createHash("sha256").update(Buffer.from(bytes)).digest("hex"),
    });
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected frame rejection");
    expect(result.diagnostic.code).toBe("E10204");
  });
});
