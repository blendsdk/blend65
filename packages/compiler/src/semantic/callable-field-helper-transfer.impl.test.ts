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
      name: "callable-field-helper-transfer",
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

describe("callable-field helper transfer", () => {
  it("accepts a global callable field stored by a helper", () => {
    expectAccepted(`module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function prepare(): void { box.cb = &chosen; }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { prepare(); poke($C000, invoke(box)); }`);
  });

  it("accepts a borrowed callable field stored by a helper", () => {
    expectAccepted(`module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function other(): byte { return 11; }
function prepare(value: Box): void { value.cb = &chosen; }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { box.cb = &other; prepare(box); poke($C000, invoke(box)); }`);
  });

  it("accepts an uninitialized borrowed aggregate initialized by a helper", () => {
    expectAccepted(`module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function prepare(value: Box): void { value.cb = &chosen; }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { prepare(box); poke($C000, invoke(box)); }`);
  });

  it("accepts a callable field when a sibling field is also stored", () => {
    expectAccepted(`module Game;
struct Box { prefix: byte; cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function prepare(): void { box.prefix = 0; box.cb = &chosen; }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { prepare(); poke($C000, invoke(box)); }`);
  });

  it("accepts a helper that corrupts and then stores the callable field", () => {
    expectAccepted(`module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function prepare(): void { pokew(&box.cb, 0); box.cb = &chosen; }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { prepare(); poke($C000, invoke(box)); }`);
  });

  it("rejects a raw write through the borrowed callable field before the read", () => {
    expectRejected(`module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function prepare(): void { box.cb = &chosen; }
function corrupt(value: Box): void { pokew(&value.cb, 0); }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { prepare(); corrupt(box); poke($C000, invoke(box)); }`);
  });

  it("rejects a helper that stores and then corrupts the callable field", () => {
    expectRejected(`module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function prepare(): void { box.cb = &chosen; pokew(&box.cb, 0); }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { prepare(); poke($C000, invoke(box)); }`);
  });

  it("rejects a conditional callable-field store", () => {
    expectRejected(`module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function prepare(): void { if (peek($0400) != 0) { box.cb = &chosen; } }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { prepare(); poke($C000, invoke(box)); }`);
  });

  it("rejects an indexed store to the aggregate before the callable read", () => {
    expectRejected(`module Game;
struct Box { callbacks: (fn(): byte)[2]; cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function prepare(): void { box.cb = &chosen; box.callbacks[peek($0400) & 1] = &chosen; }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { prepare(); poke($C000, invoke(box)); }`);
  });

  it("rejects a callable field copied from a non-source value", () => {
    expectRejected(`module Game;
struct Box { cb: fn(): byte; }
let box: Box;
let other: Box;
function chosen(): byte { return 37; }
function prepare(): void { box.cb = other.cb; }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { other.cb = &chosen; prepare(); poke($C000, invoke(box)); }`);
  });

  it("rejects a corrupted aggregate copy after a helper raw write", () => {
    expectRejected(`module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function corrupt(): void { pokew(&box.cb, 0); }
function main(): void { box.cb = &chosen; corrupt(); let copy: Box = box; poke($C000, copy.cb()); }`);
  });

  it("accepts a caller kill repaired by a global field helper", () => {
    expectAccepted(`module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function prepare(): void { box.cb = &chosen; }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { box.cb = &chosen; pokew(&box.cb, 0); prepare(); poke($C000, invoke(box)); }`);
  });

  it("accepts a caller kill repaired by a borrowed field helper", () => {
    expectAccepted(`module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function prepare(value: Box): void { value.cb = &chosen; }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { box.cb = &chosen; pokew(&box.cb, 0); prepare(box); poke($C000, invoke(box)); }`);
  });

});
