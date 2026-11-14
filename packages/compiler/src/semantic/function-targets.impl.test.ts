import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { analyzeProject } from "../frontend/service.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
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
      name: "function-target-review",
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
  expect(analyzed.kind, JSON.stringify(analyzed.diagnostics)).toBe("complete");
  if (analyzed.kind !== "complete") throw new Error("Expected a complete frontend");
  const lowered = buildSemanticProgram(analyzed);
  expect(lowered.kind).toBe("complete");
  if (lowered.kind !== "complete") throw new Error("Expected semantic operations");
  return lowered.program;
}

describe("function target proof regressions", () => {
  it("keeps differently typed aggregate fields out of each other's calls", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "struct Pair { first: fn(byte): byte; second: fn(): void; }",
        "function one(value: byte): byte { return value + 1; }",
        "function two(): void {}",
        "function main(): void {",
        "  let pair: Pair = {first: &one, second: &two};",
        "  poke($0400, pair.first(3));",
        "}",
      ].join("\n"),
    );
    const closed = closeWholeProgram(semantic);
    expect(closed.kind).toBe("complete");
    if (closed.kind !== "complete") throw new Error("Expected finite call targets");
    const main = semantic.main;
    const one = semantic.functions.find(({ name }) => name === "Game.one")?.id;
    expect(one).toBeDefined();
    expect(
      closed.program.callGraph.find(
        ({ function: id }) => bindingIdentityKey(id) === bindingIdentityKey(main),
      )?.callees,
    ).toEqual([one]);
  });

  it("propagates one aggregate callback through a borrowed parameter without false recursion", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "struct Box { cb: fn(): void; }",
        "function first(): void {}",
        "function apply(box: Box): void { box.cb(); }",
        "function other(): void {",
        "  let unused: fn(): void = &other;",
        "  let box: Box = {cb: &first};",
        "  apply(box);",
        "}",
        "function main(): void { other(); }",
      ].join("\n"),
    );
    const closed = closeWholeProgram(semantic);
    expect(closed.kind, closed.kind === "error" ? JSON.stringify(closed.diagnostics) : "").toBe(
      "complete",
    );
    if (closed.kind !== "complete") throw new Error("Expected non-recursive callback graph");
    const apply = semantic.functions.find(({ name }) => name === "Game.apply")?.id;
    const first = semantic.functions.find(({ name }) => name === "Game.first")?.id;
    expect(apply).toBeDefined();
    expect(first).toBeDefined();
    expect(
      closed.program.callGraph.find(
        ({ function: id }) => bindingIdentityKey(id) === bindingIdentityKey(apply!),
      )?.callees,
    ).toEqual([first]);
  });

  it("rejects a callback that is not initialized on every route", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "let callback: fn(): void;",
        "function foo(): void {}",
        "function main(): void {",
        "  if (peek($0400) != 0) { callback = &foo; }",
        "  callback();",
        "}",
      ].join("\n"),
    );
    const closed = closeWholeProgram(semantic);
    expect(closed.kind).toBe("error");
    if (closed.kind !== "error") throw new Error("Expected opaque callback rejection");
    expect(closed.diagnostics).toMatchObject([{ code: "E10277" }]);
    expect(closed.diagnostics[0]?.message).toContain("'callback'");
    expect(closed.diagnostics[0]?.message).toContain("'fn(): void'");
  });

  it("accepts an unconditional assignment before a module callback call", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "let callback: fn(): void;",
        "function foo(): void {}",
        "function main(): void { callback = &foo; callback(); }",
      ].join("\n"),
    );
    expect(closeWholeProgram(semantic).kind).toBe("complete");
  });

  it("retains a callback written through a borrowed aggregate parameter", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "struct Box { cb: fn(): void; }",
        "function first(): void {}",
        "function second(): void {}",
        "function mutate(box: Box): void { box.cb = &second; }",
        "function main(): void {",
        "  let box: Box = {cb: &first};",
        "  mutate(box);",
        "  box.cb();",
        "}",
      ].join("\n"),
    );
    const closed = closeWholeProgram(semantic);
    expect(closed.kind).toBe("complete");
    if (closed.kind !== "complete") throw new Error("Expected finite borrowed callback targets");
    const second = semantic.functions.find(({ name }) => name === "Game.second")?.id;
    expect(second).toBeDefined();
    const mainCalls = closed.program.callGraph.find(
      ({ function: id }) => bindingIdentityKey(id) === bindingIdentityKey(semantic.main),
    )?.callees;
    expect(mainCalls?.map(bindingIdentityKey)).toContain(bindingIdentityKey(second!));
  });

  it("accepts a callback field assigned before its first read", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "struct Box { cb: fn(): void; }",
        "function first(): void {}",
        "function main(): void { let box: Box; box.cb = &first; box.cb(); }",
      ].join("\n"),
    );
    expect(closeWholeProgram(semantic).kind).toBe("complete");
  });

  it("accepts a global callback assigned before entering its direct callee", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "let callback: fn(): void;",
        "function first(): void {}",
        "function invoke(): void { callback(); }",
        "function main(): void { callback = &first; invoke(); }",
      ].join("\n"),
    );
    expect(closeWholeProgram(semantic).kind).toBe("complete");
  });

  it("does not hide an unassigned route through a direct caller", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "let callback: fn(): void;",
        "function first(): void {}",
        "function invoke(): void { callback(); }",
        "function main(): void {",
        "  if (peek($0400) != 0) { callback = &first; }",
        "  invoke();",
        "}",
      ].join("\n"),
    );
    const closed = closeWholeProgram(semantic);
    expect(closed.kind).toBe("error");
    if (closed.kind !== "error") throw new Error("Expected unassigned caller route rejection");
    expect(closed.diagnostics).toMatchObject([{ code: "E10277" }]);
  });

  it("passes a field-initialized borrowed callback without requiring unrelated fields", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "struct Box { cb: fn(): void; other: byte; }",
        "function first(): void {}",
        "function apply(box: Box): void { box.cb(); }",
        "function main(): void {",
        "  let box: Box; box.cb = &first; apply(box);",
        "}",
      ].join("\n"),
    );
    expect(closeWholeProgram(semantic).kind).toBe("complete");
  });

  it("rejects an uninitialized borrowed callback field", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "struct Box { cb: fn(): void; }",
        "function first(): void {}",
        "function apply(box: Box): void { box.cb(); }",
        "function main(): void {",
        "  let unused: fn(): void = &first;",
        "  let box: Box; apply(box);",
        "}",
      ].join("\n"),
    );
    const closed = closeWholeProgram(semantic);
    expect(closed.kind).toBe("error");
    if (closed.kind !== "error")
      throw new Error("Expected uninitialized aggregate field rejection");
    expect(closed.diagnostics).toMatchObject([{ code: "E10277" }]);
  });

  it("transfers a directly called helper's definite global write", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "let callback: fn(): byte;",
        "function chosen(): byte { return 37; }",
        "function prepare(): void { callback = &chosen; }",
        "function invoke(): byte { return callback(); }",
        "function main(): void { prepare(); poke($c000, invoke()); }",
      ].join("\n"),
    );
    expect(closeWholeProgram(semantic).kind).toBe("complete");
  });

  it("transfers a definite global write through a transitive helper", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "let callback: fn(): byte;",
        "function chosen(): byte { return 41; }",
        "function prepare(): void { callback = &chosen; }",
        "function outer(): void { prepare(); }",
        "function invoke(): byte { return callback(); }",
        "function main(): void { outer(); poke($c000, invoke()); }",
      ].join("\n"),
    );
    expect(closeWholeProgram(semantic).kind).toBe("complete");
  });

  it("rejects a helper write that happens after the callable read", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "let callback: fn(): byte;",
        "function chosen(): byte { return 37; }",
        "function invoke(): byte { return callback(); }",
        "function prepare(): void { poke($c000, invoke()); callback = &chosen; }",
        "function main(): void { prepare(); }",
      ].join("\n"),
    );
    const closed = closeWholeProgram(semantic);
    expect(closed.kind).toBe("error");
    if (closed.kind !== "error") throw new Error("Expected a post-read assignment rejection");
    expect(closed.diagnostics).toMatchObject([{ code: "E10277" }]);
  });

  it("rejects a helper that returns before assigning the callback", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "let callback: fn(): byte;",
        "function chosen(): byte { return 37; }",
        "function invoke(): byte { return callback(); }",
        "function prepare(): void {",
        "  if (peek($0400) != 0) { return; }",
        "  callback = &chosen;",
        "}",
        "function main(): void { prepare(); poke($c000, invoke()); }",
      ].join("\n"),
    );
    const closed = closeWholeProgram(semantic);
    expect(closed.kind).toBe("error");
    if (closed.kind !== "error") throw new Error("Expected an early-return rejection");
    expect(closed.diagnostics).toMatchObject([{ code: "E10277" }]);
  });

  it("intersects definite writes across independent callers", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "let callback: fn(): byte;",
        "function chosen(): byte { return 37; }",
        "function prepare(): void { callback = &chosen; }",
        "function invoke(): byte { return callback(); }",
        "function unproved(): byte { return invoke(); }",
        "let entry: fn(): byte = &unproved;",
        "function main(): void { prepare(); poke($c000, invoke()); }",
      ].join("\n"),
    );
    const closed = closeWholeProgram(semantic);
    expect(closed.kind).toBe("error");
    if (closed.kind !== "error") throw new Error("Expected a caller-intersection rejection");
    expect(closed.diagnostics).toMatchObject([{ code: "E10277" }]);
  });

  it("rejects a call that can reach an omitted callable array element", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "let callbacks: (fn(): byte)[2] = [&chosen];",
        "function chosen(): byte { return 37; }",
        "function main(): void { poke($c000, callbacks[1]()); }",
      ].join("\n"),
    );
    const closed = closeWholeProgram(semantic);
    expect(closed.kind).toBe("error");
    if (closed.kind !== "error") throw new Error("Expected an omitted-element rejection");
    expect(closed.diagnostics).toMatchObject([{ code: "E10277" }]);
  });

  it("carries a helper write through global startup into main", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "let callback: fn(): byte;",
        "function chosen(): byte { return 37; }",
        "function prepare(): byte { callback = &chosen; return 1; }",
        "let ready: byte = prepare();",
        "function invoke(): byte { return callback(); }",
        "function main(): void { poke($c001, ready); poke($c000, invoke()); }",
      ].join("\n"),
    );
    expect(closeWholeProgram(semantic).kind).toBe("complete");
  });

  it("rejects a helper write whose global address is taken", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "let callback: fn(): byte;",
        "function chosen(): byte { return 37; }",
        "function prepare(): void {",
        "  callback = &chosen;",
        "  pokew(&callback, peekw($0330));",
        "}",
        "function invoke(): byte { return callback(); }",
        "function main(): void { prepare(); poke($c000, invoke()); }",
      ].join("\n"),
    );
    const closed = closeWholeProgram(semantic);
    expect(closed.kind).toBe("error");
    if (closed.kind !== "error") throw new Error("Expected an addressed-global rejection");
    expect(closed.diagnostics).toMatchObject([{ code: "E10277" }]);
  });

  it("rejects a dynamic index that can reach an omitted callable element", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "let callbacks: (fn(): byte)[2] = [&chosen];",
        "function chosen(): byte { return 37; }",
        "function main(): void {",
        "  let index: byte = peek($0400);",
        "  poke($c000, callbacks[index]());",
        "}",
      ].join("\n"),
    );
    const closed = closeWholeProgram(semantic);
    expect(closed.kind).toBe("error");
    if (closed.kind !== "error") throw new Error("Expected a dynamic omitted-element rejection");
    expect(closed.diagnostics).toMatchObject([{ code: "E10277" }]);
  });

  it("rejects a startup helper write whose global address is taken", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "let callback: fn(): byte;",
        "function chosen(): byte { return 37; }",
        "function prepare(): byte { callback = &chosen; return 1; }",
        "let ready: byte = prepare();",
        "function main(): void { pokew(&callback, peekw($0330)); poke($c000, callback()); }",
      ].join("\n"),
    );
    const closed = closeWholeProgram(semantic);
    expect(closed.kind).toBe("error");
    if (closed.kind !== "error") throw new Error("Expected a startup raw-write rejection");
    expect(closed.diagnostics).toMatchObject([{ code: "E10277" }]);
  });

  it("rejects a helper write to a placed global with a raw write at its address", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "place(at: $C100) let callback: fn(): byte;",
        "function chosen(): byte { return 37; }",
        "function prepare(): void { callback = &chosen; pokew($C100, peekw($0330)); }",
        "function invoke(): byte { return callback(); }",
        "function main(): void { prepare(); poke($c000, invoke()); }",
      ].join("\n"),
    );
    const closed = closeWholeProgram(semantic);
    expect(closed.kind).toBe("error");
    if (closed.kind !== "error") throw new Error("Expected a placed raw-write rejection");
    expect(closed.diagnostics).toMatchObject([{ code: "E10277" }]);
  });

  it("rejects a direct startup assignment whose global address is taken", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "let callback: fn(): byte;",
        "function chosen(): byte { return 37; }",
        "let seeded: fn(): byte = (callback = &chosen);",
        "function main(): void { pokew(&callback, peekw($0330)); poke($c000, callback()); }",
      ].join("\n"),
    );
    const closed = closeWholeProgram(semantic);
    expect(closed.kind).toBe("error");
    if (closed.kind !== "error") throw new Error("Expected a direct startup raw-write rejection");
    expect(closed.diagnostics).toMatchObject([{ code: "E10277" }]);
  });

  it("rejects a placed global with a computed raw address", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "place(at: $C100) let callback: fn(): byte;",
        "function chosen(): byte { return 37; }",
        "function prepare(): void { callback = &chosen; pokew(~$3EFF, peekw($0330)); }",
        "function invoke(): byte { return callback(); }",
        "function main(): void { prepare(); poke($c000, invoke()); }",
      ].join("\n"),
    );
    const closed = closeWholeProgram(semantic);
    expect(closed.kind).toBe("error");
    if (closed.kind !== "error") throw new Error("Expected a computed raw-address rejection");
    expect(closed.diagnostics).toMatchObject([{ code: "E10277" }]);
  });

  it("rejects a helper that copies an overwritten callable into an eligible global", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "let callback: fn(): byte;",
        "let donor: fn(): byte = &chosen;",
        "function chosen(): byte { return 37; }",
        "function prepare(): void { pokew(&donor, peekw($0330)); callback = donor; }",
        "function main(): void { prepare(); poke($c000, callback()); }",
      ].join("\n"),
    );
    const closed = closeWholeProgram(semantic);
    expect(closed.kind).toBe("error");
    if (closed.kind !== "error") throw new Error("Expected a copied-source rejection");
    expect(closed.diagnostics).toMatchObject([{ code: "E10277" }]);
  });

  it("rejects a helper that overwrites a direct assignment with corrupted provenance", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "let callback: fn(): byte;",
        "let donor: fn(): byte = &chosen;",
        "function chosen(): byte { return 37; }",
        "function prepare(): void {",
        "  callback = &chosen;",
        "  pokew(&donor, peekw($0330));",
        "  callback = donor;",
        "}",
        "function main(): void { prepare(); poke($c000, callback()); }",
      ].join("\n"),
    );
    const closed = closeWholeProgram(semantic);
    expect(closed.kind).toBe("error");
    if (closed.kind !== "error") throw new Error("Expected an overwrite rejection");
    expect(closed.diagnostics).toMatchObject([{ code: "E10277" }]);
  });

  it("rejects a destination written by both a safe and an unsafe helper", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "let callback: fn(): byte;",
        "let donor: fn(): byte = &chosen;",
        "function chosen(): byte { return 37; }",
        "function seed(): void { callback = &chosen; }",
        "function overwrite(): void { callback = donor; }",
        "function main(): void { seed(); overwrite(); poke($c000, callback()); }",
      ].join("\n"),
    );
    const closed = closeWholeProgram(semantic);
    expect(closed.kind).toBe("error");
    if (closed.kind !== "error") throw new Error("Expected a cross-helper rejection");
    expect(closed.diagnostics).toMatchObject([{ code: "E10277" }]);
  });

  it("rejects a startup destination written by both a safe and an unsafe helper", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "let callback: fn(): byte;",
        "let donor: fn(): byte = &chosen;",
        "function chosen(): byte { return 37; }",
        "function seed(): byte { callback = &chosen; return 1; }",
        "function overwrite(): byte { callback = donor; return 2; }",
        "let first: byte = seed();",
        "let second: byte = overwrite();",
        "function main(): void { poke($c000, callback()); }",
      ].join("\n"),
    );
    const closed = closeWholeProgram(semantic);
    expect(closed.kind).toBe("error");
    if (closed.kind !== "error") throw new Error("Expected a startup overwrite rejection");
    expect(closed.diagnostics).toMatchObject([{ code: "E10277" }]);
  });

  it("accepts a fully supplied callable array", () => {
    const semantic = lowerSource(
      [
        "module Game;",
        "function first(): byte { return 11; }",
        "function second(): byte { return 22; }",
        "let callbacks: (fn(): byte)[2] = [&first, &second];",
        "function main(): void { poke($c000, callbacks[0]()); }",
      ].join("\n"),
    );
    expect(closeWholeProgram(semantic).kind).toBe("complete");
  });
});
