import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { analyzeProject } from "../frontend/service.js";
import { buildSemanticProgram } from "./lower.js";
import { closeWholeProgram } from "./whole-program.js";

/** Lower one real source file without host I/O or generated output. */
function lowerSource(text: string, boundsCheck = true) {
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
      name: "raw-write-callable-invalidation",
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      assetPaths: [],
      outDir: "out",
      optimization: "none",
      boundsCheck,
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
  return buildSemanticProgram(analyzed, { boundsCheck });
}

/** Expect the closed program to reject the call after the raw mutation. */
function expectRejected(source: string, boundsCheck = true): void {
  const lowered = lowerSource(source, boundsCheck);
  if (lowered.kind !== "complete") throw new Error(JSON.stringify(lowered.diagnostics));
  const closed = closeWholeProgram(lowered.program);
  expect(closed.kind).toBe("error");
  if (closed.kind !== "error") return;
  expect(closed.diagnostics).toMatchObject([{ code: "E10277" }]);
}

/** Expect the closed program to keep a finite callable target. */
function expectAccepted(source: string, boundsCheck = true): void {
  const lowered = lowerSource(source, boundsCheck);
  if (lowered.kind !== "complete") throw new Error(JSON.stringify(lowered.diagnostics));
  expect(closeWholeProgram(lowered.program).kind).toBe("complete");
}

describe("direct raw-write callable invalidation", () => {
  it("rejects a call after a word write to the callable", () => {
    expectRejected(
      `module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function main(): void { callback = &chosen; pokew(&callback, peekw($0330)); poke($C000, callback()); }`,
    );
  });

  it("rejects a call after a byte write to the callable", () => {
    expectRejected(
      `module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function main(): void { callback = &chosen; poke(&callback, 0); poke($C000, callback()); }`,
    );
  });

  it("rejects a call after a write to a callable field", () => {
    expectRejected(
      `module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function main(): void { box.cb = &chosen; pokew(&box.cb, peekw($0330)); poke($C000, box.cb()); }`,
    );
  });

  it("rejects a closing word write that crosses into the callable field", () => {
    expectRejected(
      `module Game;
struct Box { prefix: byte; cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function main(): void { box.prefix = 0; box.cb = &chosen; pokew(&box.prefix, peekw($0330)); poke($C000, box.cb()); }`,
    );
  });

  it("keeps a byte write to a disjoint field accepted", () => {
    expectAccepted(
      `module Game;
struct Box { prefix: byte; cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function main(): void { box.cb = &chosen; poke(&box.prefix, 0); poke($C000, box.cb()); }`,
    );
  });

  it("rejects a constant write overlapping an explicitly placed callable", () => {
    expectRejected(
      `module Game;
place(at: $C100) let callback: fn(): byte;
function chosen(): byte { return 37; }
function main(): void { callback = &chosen; pokew($C100, peekw($0330)); poke($C000, callback()); }`,
    );
  });

  it("accepts a raw write before the callable assignment", () => {
    expectAccepted(
      `module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function main(): void { pokew(&callback, 0); callback = &chosen; poke($C000, callback()); }`,
    );
  });

  it("accepts a raw write to unrelated storage", () => {
    expectAccepted(
      `module Game;
let callback: fn(): byte;
let other: word;
function chosen(): byte { return 37; }
function main(): void { callback = &chosen; pokew(&other, peekw($0330)); poke($C000, callback()); }`,
    );
  });

  it("rejects a call after a branch-only raw write", () => {
    expectRejected(
      `module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function main(): void { callback = &chosen; if (peek($0400) != 0) { pokew(&callback, 0); } poke($C000, callback()); }`,
    );
  });

  it("accepts a direct reassignment after the raw write", () => {
    expectAccepted(
      `module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function main(): void { callback = &chosen; pokew(&callback, 0); callback = &chosen; poke($C000, callback()); }`,
    );
  });

  it("accepts a call in a loop before a write that occurs after the loop", () => {
    expectAccepted(
      `module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function main(): void {
  callback = &chosen;
  while (peek($0400) != 0) { poke($C000, callback()); }
  pokew(&callback, 0);
}`,
    );
  });

  it("keeps a copied aggregate callable accepted when only a disjoint prefix was written", () => {
    expectAccepted(
      `module Game;
struct Box { prefix: byte; cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function main(): void {
  box.prefix = 1;
  box.cb = &chosen;
  poke(&box.prefix, 0);
  let copy: Box = box;
  poke($C000, copy.cb());
}`,
    );
  });

  it("rejects a word write at a placed byte that overlaps the adjacent placed callable", () => {
    expectRejected(
      `module Game;
place(at: $C100) let prefix: byte;
place(at: $C101) let callback: fn(): byte;
function chosen(): byte { return 37; }
function main(): void {
  prefix = 0;
  callback = &chosen;
  pokew(&prefix, peekw($0330));
  poke($C000, callback());
}`,
    );
  });

  it("rejects a dynamic read that can select a raw-written callable element", () => {
    expectRejected(
      `module Game;
let callbacks: (fn(): byte)[2] = [&chosen, &chosen];
function chosen(): byte { return 37; }
function main(): void {
  pokew(&callbacks, peekw($0330));
  let index: byte = peek($0400) & 1;
  poke($C000, callbacks[index]());
}`,
    );
  });

  it("keeps a dynamic callable read accepted when only a disjoint prefix was written", () => {
    expectAccepted(
      `module Game;
struct Box { prefix: byte; callbacks: (fn(): byte)[2]; }
let box: Box;
function chosen(): byte { return 37; }
function main(): void {
  box.callbacks = [&chosen, &chosen];
  poke(&box.prefix, 0);
  let index: byte = peek($0400) & 1;
  poke($C000, box.callbacks[index]());
}`,
    );
  });

  it("keeps an untouched callable field accepted after a dynamic sibling index", () => {
    expectAccepted(
      `module Game;
struct Pair { bad: fn(): byte; good: fn(): byte; }
let pairs: Pair[2] = [
  { bad: &chosen, good: &chosen },
  { bad: &chosen, good: &chosen }
];
function chosen(): byte { return 37; }
function main(): void {
  poke(&pairs[0].bad, 0);
  let index: byte = peek($0400) & 1;
  poke($C000, pairs[index].good());
}`,
    );
  });

  it("rejects the corrupted callable field after a dynamic index", () => {
    expectRejected(
      `module Game;
struct Pair { bad: fn(): byte; good: fn(): byte; }
let pairs: Pair[2] = [
  { bad: &chosen, good: &chosen },
  { bad: &chosen, good: &chosen }
];
function chosen(): byte { return 37; }
function main(): void {
  poke(&pairs[0].bad, 0);
  let index: byte = peek($0400) & 1;
  poke($C000, pairs[index].bad());
}`,
    );
  });

  it("keeps an untouched callable leaf accepted through a dynamic aggregate copy", () => {
    expectAccepted(
      `module Game;
struct Pair { bad: fn(): byte; good: fn(): byte; }
let pairs: Pair[2] = [
  { bad: &chosen, good: &chosen },
  { bad: &chosen, good: &chosen }
];
function chosen(): byte { return 37; }
function main(): void {
  poke(&pairs[0].bad, 0);
  let index: byte = peek($0400) & 1;
  let copy: Pair = pairs[index];
  poke($C000, copy.good());
}`,
    );
  });

  it("rejects the corrupted leaf through a dynamic aggregate copy", () => {
    expectRejected(
      `module Game;
struct Pair { bad: fn(): byte; good: fn(): byte; }
let pairs: Pair[2] = [
  { bad: &chosen, good: &chosen },
  { bad: &chosen, good: &chosen }
];
function chosen(): byte { return 37; }
function main(): void {
  poke(&pairs[0].bad, 0);
  let index: byte = peek($0400) & 1;
  let copy: Pair = pairs[index];
  poke($C000, copy.bad());
}`,
    );
  });

  it("accounts for an adjacent placed callable when bounds checks are disabled", () => {
    const source = `module Game;
function chosen(): byte { return 37; }
place(at: $C100) let callbacks: (fn(): byte)[2] = [&chosen, &chosen];
place(at: $C104) let tail: fn(): byte = &chosen;
function main(): void {
  pokew(&tail, peekw($0330));
  poke($C000, callbacks[peek($0400) & 1]());
}`;
    expectAccepted(source, true);
    expectAccepted(source, false);
  });

  it("rejects an unchecked unbounded read that can reach an adjacent placed callable", () => {
    expectRejected(
      `module Game;
function chosen(): byte { return 37; }
place(at: $C100) let callbacks: (fn(): byte)[2] = [&chosen, &chosen];
place(at: $C104) let tail: fn(): byte = &chosen;
function main(): void {
  pokew(&tail, peekw($0330));
  poke($C000, callbacks[peek($0400)]());
}`,
      false,
    );
  });

  it("accounts for unchecked out-of-bounds callable reads conservatively", () => {
    const source = `module Game;
struct Box { callbacks: (fn(): byte)[2]; tail: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function main(): void {
  box.callbacks = [&chosen, &chosen];
  box.tail = &chosen;
  pokew(&box.tail, peekw($0330));
  poke($C000, box.callbacks[peek($0400)]());
}`;
    expectAccepted(source, true);
    expectRejected(source, false);
  });

  it("leaves an unresolved dynamic-index write on the deferred boundary", () => {
    expectAccepted(
      `module Game;
struct Box { cb: fn(): byte; data: byte[2]; }
let box: Box;
function chosen(): byte { return 37; }
function main(): void {
  box.cb = &chosen;
  let index: byte = peek($0400) & 1;
  poke(&box.data[index], 0);
  poke($C000, box.cb());
}`,
    );
  });

  it("returns to a finite target when a later store restores the pointer bytes", () => {
    expectAccepted(
      `module Game;
struct Box { prefix: byte; cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function main(): void { box.prefix = 0; box.cb = &chosen; pokew(&box.prefix, peekw($0330)); box.cb = &chosen; poke($C000, box.cb()); }`,
    );
  });
});
