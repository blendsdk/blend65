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
      name: "interprocedural-kills",
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

describe("interprocedural raw-write callable invalidation", () => {
  it("rejects a call after a borrowed word write across the callable field", () => {
    expectRejected(`module Game;
struct Box { prefix: byte; cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function zap(p: Box): void { pokew(&p.prefix, 0); }
function main(): void { box.cb = &chosen; zap(box); poke($C000, box.cb()); }`);
  });

  it("accepts a borrowed byte write to a disjoint prefix field", () => {
    expectAccepted(`module Game;
struct Box { prefix: byte; cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function zap(p: Box): void { poke(&p.prefix, 0); }
function main(): void { box.cb = &chosen; zap(box); poke($C000, box.cb()); }`);
  });

  it("rejects a call after a helper reads the caller's killed global", () => {
    expectRejected(`module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function useIt(): byte { return callback(); }
function main(): void { callback = &chosen; pokew(&callback, 0); poke($C000, useIt()); }`);
  });

  it("rejects a borrowed read after a helper writes the aliasing global", () => {
    expectRejected(`module Game;
struct Box { cb: fn(): byte; }
let shared: Box;
function chosen(): byte { return 37; }
function corruptGlobalReadParam(p: Box): void { pokew(&shared.cb, 0); poke($C000, p.cb()); }
function main(): void { shared.cb = &chosen; corruptGlobalReadParam(shared); }`);
  });

  it("rejects forwarded parameters that receive the same object", () => {
    expectRejected(`module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function inner(x: Box, y: Box): void { pokew(&x.cb, 0); poke($C000, y.cb()); }
function outer(a: Box, b: Box): void { inner(a, b); }
function main(): void { box.cb = &chosen; outer(box, box); }`);
  });

  it("rejects a call after a finite indirect call to a raw-writing helper", () => {
    expectRejected(`module Game;
let callback: fn(): byte;
let action: fn(): void;
function chosen(): byte { return 37; }
function corrupt(): void { pokew(&callback, 0); }
function main(): void { callback = &chosen; action = &corrupt; action(); poke($C000, callback()); }`);
  });

  it("rejects a call after an opaque destination inside a helper", () => {
    expectRejected(`module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function corruptDynamic(): void { poke(peekw($0330), 0); }
function main(): void { callback = &chosen; corruptDynamic(); poke($C000, callback()); }`);
  });

  it("accepts a distinct object after a raw write to another object", () => {
    expectAccepted(`module Game;
struct Box { cb: fn(): byte; }
let left: Box;
let right: Box;
function chosen(): byte { return 37; }
function inspect(p: Box): void { poke($C000, p.cb()); }
function main(): void { left.cb = &chosen; right.cb = &chosen; inspect(left); pokew(&left.cb, 0); poke($C000, right.cb()); }`);
  });

  it("accepts a later startup initializer that repairs an earlier kill", () => {
    expectAccepted(`module Game;
let callback: fn(): byte = &chosen;
let marker: byte = corruptStartup();
let repaired: byte = repairStartup(marker);
function chosen(): byte { return 37; }
function corruptStartup(): byte { pokew(&callback, 0); return 0; }
function repairStartup(seed: byte): byte { callback = &chosen; return seed; }
function main(): void { poke($C000, callback()); }`);
  });

  it("rejects a helper that stores and then corrupts the callable", () => {
    expectRejected(`module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function repairThenCorrupt(): void { callback = &chosen; pokew(&callback, 0); }
function main(): void { pokew(&callback, 0); repairThenCorrupt(); poke($C000, callback()); }`);
  });

  it("rejects a helper that restores the callable only on one route", () => {
    expectRejected(`module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function maybeRepair(): void { if (peek($0400) != 0) { callback = &chosen; } }
function main(): void { pokew(&callback, 0); maybeRepair(); poke($C000, callback()); }`);
  });

  it("rejects a call after a constant placed write inside a helper", () => {
    expectRejected(`module Game;
struct Box { cb: fn(): byte; }
place(at: $C100) let box: Box;
function chosen(): byte { return 37; }
function use(p: Box): void { pokew($C100, 0); poke($C000, p.cb()); }
function main(): void { box.cb = &chosen; use(box); }`);
  });

  it("rejects a forwarded any-size callable array after a raw write", () => {
    expectRejected(`module Game;
let table: (fn(): byte)[1];
function chosen(): byte { return 37; }
function inner(q: (fn(): byte)[]): void { poke($C000, q[0]()); }
function outer(p: (fn(): byte)[]): void { pokew(&p[0], 0); inner(p); }
function main(): void { table[0] = &chosen; outer(table); }`);
  });

  it("rejects a borrowed read after a nested helper writes the same global", () => {
    expectRejected(`module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function corrupt(): void { pokew(&box.cb, 0); }
function use(p: Box): void { corrupt(); poke($C000, p.cb()); }
function main(): void { box.cb = &chosen; use(box); }`);
  });

  it("rejects a forwarded global read after a parameter write", () => {
    expectRejected(`module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function inner(x: Box): void { pokew(&x.cb, 0); poke($C000, box.cb()); }
function outer(p: Box): void { inner(p); }
function main(): void { box.cb = &chosen; outer(box); }`);
  });

  it("rejects a restore that skips an early returning path", () => {
    expectRejected(`module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function repair(): void { if (peek($0400) == 0) { return; } callback = &chosen; }
function main(): void { callback = &chosen; pokew(&callback, 0); repair(); poke($C000, callback()); }`);
  });

  it("rejects a dynamic read of a forwarded any-size callable array", () => {
    expectRejected(`module Game;
let table: (fn(): byte)[2];
function chosen(): byte { return 37; }
function inner(q: (fn(): byte)[]): void { poke($C000, q[peek($0400) & 1]()); }
function outer(p: (fn(): byte)[]): void { pokew(&p[0], 0); inner(p); }
function main(): void { table[0] = &chosen; table[1] = &chosen; outer(table); }`);
  });

  it("rejects a nested kill in a body with an unresolved borrowed actual", () => {
    expectRejected(`module Game;
let table: (fn(): byte)[1] = [&chosen];
function chosen(): byte { return 37; }
function corrupt(): void { pokew(&table[0], 0); }
function inner(q: (fn(): byte)[]): byte { corrupt(); return q[0](); }
function outer(p: (fn(): byte)[]): byte { return inner(p); }
function main(): void { poke($C000, outer(table)); }`);
  });

  it("rejects a read through a parameter with two possible field displacements", () => {
    expectRejected(`module Game;
struct Box { cb: fn(): byte; }
struct Pair { a: Box; b: Box; }
let pair: Pair = { a: { cb: &chosen }, b: { cb: &chosen } };
function chosen(): byte { return 37; }
function inner(x: Box): byte { pokew(&x.cb, 0); return pair.a.cb(); }
function outer(p: Box): byte { return inner(p); }
function main(): void {
  if (peek($0400) == 0) { poke($C000, outer(pair.a)); }
  else { poke($C000, outer(pair.b)); }
}`);
  });

  it("accepts a repaired callable across a read-only helper call", () => {
    expectAccepted(`module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function idle(): void {}
function main(): void {
  callback = &chosen;
  pokew(&callback, 0);
  idle();
  callback = &chosen;
  idle();
  poke($C000, callback());
}`);
  });

  it("accepts an opaque write with no later callable read", () => {
    expectAccepted(`module Game;
function main(): void { poke(peekw($0330), 0); poke($C000, 7); }`);
  });
});
