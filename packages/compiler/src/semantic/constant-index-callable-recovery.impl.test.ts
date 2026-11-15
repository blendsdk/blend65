import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { analyzeProject } from "../frontend/service.js";
import { buildSemanticProgram } from "./lower.js";
import { closeWholeProgram } from "./whole-program.js";

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
      name: "constant-index-callable-recovery",
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      assetPaths: [],
      outDir: "out",
      optimization: "none",
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
  return buildSemanticProgram(analyzed, { boundsCheck: true });
}

/** Expect the closed program to reject the call after the raw mutation. */
function expectRejected(source: string): void {
  const lowered = lowerSource(source);
  if (lowered.kind !== "complete") throw new Error(JSON.stringify(lowered.diagnostics));
  const closed = closeWholeProgram(lowered.program);
  expect(closed.kind).toBe("error");
  if (closed.kind !== "error") return;
  expect(closed.diagnostics).toMatchObject([{ code: "E10277" }]);
}

/** Expect the closed program to keep a finite callable target. */
function expectAccepted(source: string): void {
  const lowered = lowerSource(source);
  if (lowered.kind !== "complete") throw new Error(JSON.stringify(lowered.diagnostics));
  expect(closeWholeProgram(lowered.program).kind).toBe("complete");
}

describe("constant-index callable element recovery", () => {
  it("accepts a complete constant-index store after a raw write", () => {
    expectAccepted(`module Game;
let table: (fn(): byte)[1];
function chosen(): byte { return 37; }
function main(): void {
  table[0] = &chosen;
  pokew(&table[0], 0);
  table[0] = &chosen;
  poke($C000, table[0]());
}`);
  });

  it("accepts a constant-index callable field store after a raw write", () => {
    expectAccepted(`module Game;
struct Box { cb: fn(): byte; }
let boxes: Box[1];
function chosen(): byte { return 37; }
function main(): void {
  boxes[0].cb = &chosen;
  pokew(&boxes[0].cb, 0);
  boxes[0].cb = &chosen;
  poke($C000, boxes[0].cb());
}`);
  });

  it("rejects a constant-index read of an uninitialized sibling", () => {
    expectRejected(`module Game;
let table: (fn(): byte)[2];
function chosen(): byte { return 37; }
function main(): void {
  table[0] = &chosen;
  poke($C000, table[1]());
}`);
  });

  it("rejects a constant-index read after a raw write without a restore", () => {
    expectRejected(`module Game;
let table: (fn(): byte)[1];
function chosen(): byte { return 37; }
function main(): void {
  table[0] = &chosen;
  pokew(&table[0], 0);
  poke($C000, table[0]());
}`);
  });

  it("rejects a runtime-index read of a raw-written element", () => {
    expectRejected(`module Game;
let table: (fn(): byte)[2];
function chosen(): byte { return 37; }
function main(): void {
  table[0] = &chosen;
  table[1] = &chosen;
  pokew(&table[0], 0);
  poke($C000, table[peek($0400) & 1]());
}`);
  });

  it("rejects a corrupted aggregate copy selected from a constant element", () => {
    expectRejected(`module Game;
struct Box { cb: fn(): byte; }
let boxes: Box[1];
function chosen(): byte { return 37; }
function main(): void {
  boxes[0].cb = &chosen;
  pokew(&boxes[0].cb, 0);
  let copy: Box = boxes[0];
  poke($C000, copy.cb());
}`);
  });

  it("rejects a constant-index read after a runtime-index store", () => {
    expectRejected(`module Game;
let table: (fn(): byte)[2];
function chosen(): byte { return 37; }
function main(): void {
  table[peek($0400) & 1] = &chosen;
  poke($C000, table[0]());
}`);
  });
});
