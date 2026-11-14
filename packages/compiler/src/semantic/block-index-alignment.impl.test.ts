import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { analyzeProject } from "../frontend/service.js";
import { buildSemanticProgram } from "./lower.js";
import type { SemanticGlobal } from "./operations.js";

/** Lower one real source file without host I/O or generated output. */
function lowerSource(text: string) {
  const source: SourceRecord = {
    sourceId: "src/game.blend",
    text,
    sha256: createHash("sha256").update(text).digest("hex"),
    byteLength: Buffer.byteLength(text),
    resolvedPath: "/checkout/src/game.blend",
  };
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "block-index-alignment",
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      assetPaths: [],
      outDir: "out",
      optimization: "none",
      boundsCheck: true,
      divisionZeroCheck: true,
    },
    manifestSource: {
      sourceId: "blend65.json",
      text: "{}",
      sha256: createHash("sha256").update("{}").digest("hex"),
      byteLength: 2,
      resolvedPath: "/checkout/blend65.json",
    },
    sources: [source],
    inputSha256: source.sha256,
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: [],
    outDir: "/checkout/out",
    overrides: { target: null, entry: null },
    effectiveTarget: "c64-pal-prg-kernal-6581",
    effectiveEntry: "Game",
  };
  const analyzed = analyzeProject(snapshot);
  if (analyzed.kind !== "complete") throw new Error(JSON.stringify(analyzed.diagnostics));
  return buildSemanticProgram(analyzed);
}

/** Find one module object by source name in a completed semantic program. */
function globalNamed(globals: readonly SemanticGlobal[], name: string): SemanticGlobal {
  const global = globals.find((item) => item.name === name);
  if (global === undefined) throw new Error(`Missing global ${name}`);
  return global;
}

describe("block-index alignment inference", () => {
  it("strengthens a module buffer used with division", () => {
    const lowered = lowerSource(
      `module Game;
let buffer: byte[64];
function main(): void { poke($D018, lo(&buffer / 64)); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toMatchObject({ align: 64 });
  });

  it("strengthens a module buffer used with a shift", () => {
    const lowered = lowerSource(
      `module Game;
let buffer: byte[64];
function main(): void { poke($D018, lo(&buffer >> 6)); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toMatchObject({ align: 64 });
  });

  it("requires 256-byte alignment for hi times four", () => {
    const lowered = lowerSource(
      `module Game;
let buffer: byte[64];
function main(): void { poke($D018, hi(&buffer) * 4); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toMatchObject({ align: 256 });
  });

  it("leaves a plain low-byte read unaligned", () => {
    const lowered = lowerSource(
      `module Game;
let buffer: byte[64];
function main(): void { poke($D018, lo(&buffer)); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toBeUndefined();
  });

  it("includes a constant element index in the effective offset", () => {
    const lowered = lowerSource(
      `module Game;
let blocks: byte[2][64];
function main(): void { poke($D018, lo(&blocks[1] / 64)); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "blocks").placement).toMatchObject({ align: 64 });
  });

  it("leaves a runtime element index untouched", () => {
    const lowered = lowerSource(
      `module Game;
let blocks: byte[2][64];
function main(): void {
  let index: byte = peek($0400);
  poke($D018, lo(&blocks[index] / 64));
}`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "blocks").placement).toBeUndefined();
  });

  it("accepts an aligned field offset", () => {
    const lowered = lowerSource(
      `module Game;
struct Frame { pad: byte[64]; image: byte[64]; }
let frame: Frame;
function main(): void { poke($D018, lo(&frame.image / 64)); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "frame").placement).toMatchObject({ align: 64 });
  });

  it("preserves a field offset that root alignment cannot express", () => {
    const lowered = lowerSource(
      `module Game;
struct Frame { pad: byte; image: byte[64]; }
let frame: Frame;
function main(): void { poke($D018, lo(&frame.image / 64)); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "frame").placement).toBeUndefined();
  });

  it("keeps an explicitly aligned address", () => {
    const lowered = lowerSource(
      `module Game;
place(at: $0B80) let buffer: byte[64];
function main(): void { poke($D018, lo(&buffer / 64)); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toMatchObject({
      at: 0x0b80,
      align: 1,
    });
  });

  it("preserves an explicitly misaligned address", () => {
    const lowered = lowerSource(
      `module Game;
place(at: $0B50) let buffer: byte[64];
function main(): void { poke($D018, lo(&buffer / 64)); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toMatchObject({
      at: 0x0b50,
      align: 1,
    });
  });

  it("recognizes the commuted hi times four expression", () => {
    const lowered = lowerSource(
      `module Game;
let buffer: byte[64];
function main(): void { poke($D018, 4 * hi(&buffer)); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toMatchObject({ align: 256 });
  });

  it("uses the explicit effective address for a nonzero field offset", () => {
    const lowered = lowerSource(
      `module Game;
struct Frame { pad: byte; image: byte[64]; }
place(at: $0B3F) let frame: Frame;
function main(): void { poke($D018, lo(&frame.image / 64)); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "frame").placement).toMatchObject({
      at: 0x0b3f,
      align: 1,
    });
  });

  it("does not treat a value-changing conversion as the full address", () => {
    const lowered = lowerSource(
      `module Game;
let buffer: byte[64];
function main(): void { poke($D018, hi(word(byte(&buffer))) * 4); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toBeUndefined();
  });

  it("resolves converted constant divisors and indices", () => {
    const lowered = lowerSource(
      `module Game;
let blocks: byte[2][64];
function main(): void {
  poke($D018, lo(&blocks[word(1)] / word(64)));
}`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "blocks").placement).toMatchObject({ align: 64 });
  });

  it("recognizes a commuted complete hi/lo selector", () => {
    const lowered = lowerSource(
      `module Game;
let buffer: byte[64];
function main(): void {
  poke($D018, 4 * hi(&buffer) + (lo(&buffer) >> 6));
}`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toMatchObject({ align: 64 });
  });

  it("requires only 64-byte alignment for a complete hi/lo selector", () => {
    const lowered = lowerSource(
      `module Game;
let buffer: byte[64];
function main(): void {
  poke($D018, hi(&buffer) * 4 + (lo(&buffer) >> 6));
}`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toMatchObject({ align: 64 });
  });

  it("recognizes a widening-wrapped complete selector", () => {
    const lowered = lowerSource(
      `module Game;
let buffer: byte[64];
function main(): void {
  poke($D018, lo(word(hi(&buffer) * 4) + word(lo(&buffer) >> 6)));
}`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toMatchObject({ align: 64 });
  });

  it("recognizes widening inside each complete-selector half", () => {
    const lowered = lowerSource(
      `module Game;
let buffer: byte[64];
function main(): void {
  poke($D018, lo(word(hi(&buffer)) * 4 + (word(lo(&buffer)) >> 6)));
}`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toMatchObject({ align: 64 });
  });

  it("aligns a field at a 64-byte offset through a complete selector", () => {
    const lowered = lowerSource(
      `module Game;
struct Frame { pad: byte[64]; image: byte[64]; }
let frame: Frame;
function main(): void {
  poke($D018, lo(word(hi(&frame.image) * 4) + word(lo(&frame.image) >> 6)));
}`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "frame").placement).toMatchObject({ align: 64 });
  });

  it("uses the strongest demand across several uses", () => {
    const lowered = lowerSource(
      `module Game;
let buffer: byte[64];
function main(): void { poke($D018, lo(&buffer / 64)); poke($D019, hi(&buffer) * 4); }`,
    );
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(globalNamed(lowered.program.globals, "buffer").placement).toMatchObject({ align: 256 });
  });
});
