import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { analyzeProject } from "../frontend/service.js";
import { buildSemanticProgram } from "./lower.js";
import { ControlFlowBuilder } from "./cfg.js";

const PROFILE_ID = "c64-pal-prg-kernal-6581";

/** Build a minimal in-memory project for semantic implementation tests. */
function snapshot(text: string): ProjectSnapshot {
  const sha256 = createHash("sha256").update(text, "utf8").digest("hex");
  const source: SourceRecord = {
    sourceId: "src/game.blend",
    text,
    sha256,
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: "/checkout/src/game.blend",
  };
  return {
    manifest: {
      schemaVersion: 1,
      name: "cfg-implementation",
      sourceRoot: "src",
      entry: "Game",
      target: PROFILE_ID,
      assetPaths: [],
      outDir: "out",
      optimization: "none",
      boundsCheck: true,
      divisionZeroCheck: true,
    },
    manifestSource: {
      sourceId: "blend65.json",
      text: "{}",
      sha256: createHash("sha256").update("{}", "utf8").digest("hex"),
      byteLength: 2,
      resolvedPath: "/checkout/blend65.json",
    },
    sources: [source],
    inputSha256: sha256,
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: [],
    outDir: "/checkout/out",
    overrides: { target: null, entry: null },
    effectiveTarget: PROFILE_ID,
    effectiveEntry: "Game",
  };
}

/** Analyze and lower one complete source fixture. */
function lower(text: string) {
  const analysis = analyzeProject(snapshot(text));
  if (analysis.kind !== "complete") throw new Error(JSON.stringify(analysis));
  const semantic = buildSemanticProgram(analysis);
  if (semantic.kind !== "complete") throw new Error(JSON.stringify(semantic));
  return semantic.program;
}

describe("semantic CFG implementation", () => {
  it("retains the proved status-save peak for hardware-stack closure", () => {
    const program = lower(
      [
        "module Game;",
        "function leaf(): void {}",
        "function main(): void {",
        "  asm_php();",
        "  asm_php();",
        "  leaf();",
        "  asm_plp();",
        "  asm_plp();",
        "}",
      ].join("\n"),
    );

    const main = program.functions.find(({ name }) => name === "Game.main");
    expect(main?.statusStackPeak).toBe(2);
    expect(
      main?.blocks
        .flatMap(({ operations }) => operations)
        .filter(({ kind }) => kind === "cpu-control"),
    ).toHaveLength(4);
  });

  it("rejects an internally malformed jump target before publishing the graph", () => {
    const builder = new ControlFlowBuilder("malformed");
    builder.terminate(Object.freeze({ kind: "jump", target: "malformed:missing" }));

    expect(() => builder.finish({ kind: "scalar", name: "void" })).toThrow(
      "Unknown semantic successor 'malformed:missing'",
    );
  });

  it("freezes every graph record and resolves every represented successor", () => {
    const program = lower(
      [
        "module Game;",
        "function choose(flag: boolean): byte {",
        "  if (flag) { return 1; } else { return 2; }",
        "}",
        "function main(): void { let result: byte = choose(true); }",
      ].join("\n"),
    );

    expect(Object.isFrozen(program)).toBe(true);
    for (const fn of program.functions) {
      const ids = new Set(fn.blocks.map(({ id }) => id));
      expect(Object.isFrozen(fn)).toBe(true);
      expect(ids.has(fn.entry)).toBe(true);
      for (const block of fn.blocks) {
        expect(Object.isFrozen(block)).toBe(true);
        expect(Object.isFrozen(block.operations)).toBe(true);
        if (block.terminator.kind === "jump") {
          expect(ids.has(block.terminator.target)).toBe(true);
        } else if (block.terminator.kind === "branch") {
          expect(ids.has(block.terminator.whenTrue)).toBe(true);
          expect(ids.has(block.terminator.whenFalse)).toBe(true);
        }
      }
    }
  });

  it("keeps parameter order and distinct value identities through nested calls", () => {
    const program = lower(
      [
        "module Game;",
        "function add(first: byte, second: byte): byte { return first + second; }",
        "function one(): byte { return 1; }",
        "function main(): void { let value: byte = add(one(), one()); }",
      ].join("\n"),
    );
    const add = program.functions.find(({ parameters }) => parameters.length === 2);
    const main = program.functions.find(({ id }) => id.span.start === program.main.span.start);
    expect(add?.parameters.map(({ id }) => id.span.start)).toEqual(
      [...(add?.parameters ?? [])]
        .map(({ id }) => id.span.start)
        .sort((left, right) => left - right),
    );
    const calls = (main?.blocks ?? [])
      .flatMap(({ operations }) => operations)
      .filter((operation) => operation.kind === "call");
    expect(calls).toHaveLength(3);
    expect(new Set(calls.flatMap(({ result }) => (result === null ? [] : [result]))).size).toBe(3);
    expect(calls[2]?.arguments).toEqual([calls[0]?.result, calls[1]?.result]);
  });

  it("represents runtime byte extraction as a target-neutral unary operation", () => {
    const program = lower(
      "module Game; function extract(value: word): byte { return hi(value); } function main(): void {}",
    );
    const extraction = program.functions
      .flatMap(({ blocks }) => blocks)
      .flatMap(({ operations }) => operations)
      .find((operation) => operation.kind === "unary" && operation.operator === "hi");

    expect(extraction).toMatchObject({ kind: "unary", operator: "hi" });
  });

  it("retains each lowered place root's declared packed type", () => {
    const program = lower(
      [
        "module Game;",
        "let values: word[4] = [0; 0];",
        "function main(): void {",
        "  let index: byte = 1;",
        "  values[index] = $1234;",
        "}",
      ].join("\n"),
    );
    const places = [
      ...program.globals.flatMap(({ blocks }) => blocks),
      ...program.functions.flatMap(({ blocks }) => blocks),
    ]
      .flatMap(({ operations }) => operations)
      .flatMap((operation) =>
        operation.kind === "load" ||
        operation.kind === "store" ||
        operation.kind === "place-address"
          ? [operation.place]
          : [],
      );

    expect(places.length).toBeGreaterThan(0);
    expect(places.every(({ rootType }) => rootType !== undefined)).toBe(true);
    expect(places.find(({ path }) => path.length > 0)?.rootType).toEqual({
      kind: "array",
      element: { kind: "scalar", name: "word" },
      length: 4,
      size: 8,
    });
  });

  it("keeps runtime module initialization distinct from aggregate constant data", () => {
    const program = lower(
      [
        "module Game;",
        "struct Pair { tag: byte; value: word; active: boolean; }",
        "const MAGIC: word = $1234;",
        "let pairs: Pair[2] = [",
        "  { tag: 1, value: MAGIC, active: true },",
        "  { tag: 2, value: $5678, active: false }",
        "];",
        "function main(): void {}",
      ].join("\n"),
    );

    expect(program.globals.map(({ storage, initialBytes }) => ({ storage, initialBytes }))).toEqual(
      [
        { storage: "constant", initialBytes: null },
        { storage: "module", initialBytes: null },
      ],
    );
    const moduleGlobal = program.globals[1];
    expect(moduleGlobal?.runtimeInitialBytes).toEqual([
      0x01, 0x34, 0x12, 0x01, 0x02, 0x78, 0x56, 0x00,
    ]);
    expect(moduleGlobal?.entry).not.toBeNull();
    expect(moduleGlobal?.blocks.flatMap(({ operations }) => operations).at(-1)).toMatchObject({
      kind: "store",
      type: { kind: "array" },
    });

    const aggregateConstant = lower(
      [
        "module Game;",
        "struct Pair { tag: byte; value: word; }",
        "const PAIR: Pair = { tag: 1, value: $1234 };",
        "function main(): void {}",
      ].join("\n"),
    );
    expect(aggregateConstant.globals[0]?.initialBytes).toEqual([0x01, 0x34, 0x12]);
  });

  it("does not lower bodies or updates behind constant-false loop conditions", () => {
    const program = lower(
      [
        "module Game;",
        "function deadBody(): void {}",
        "function deadUpdate(): void {}",
        "function main(): void {",
        "  while (1 == 2) { deadBody(); }",
        "  for (; 2 < 1; deadUpdate()) { deadBody(); }",
        "}",
      ].join("\n"),
    );
    const main = program.functions.find(({ id }) => id.span.start === program.main.span.start);
    const calls = (main?.blocks ?? [])
      .flatMap(({ operations }) => operations)
      .filter((operation) => operation.kind === "call");

    expect(calls).toEqual([]);
    expect(main?.blocks.filter(({ terminator }) => terminator.kind === "branch")).toEqual([]);
  });

  it("retains false-pretest condition effects and the for initializer exactly once", () => {
    const program = lower(`module Game;
let tested: boolean;
let initialized: byte;
function dead(): void { poke($0421, 99); }
function main(): void {
  while (tested = false) { dead(); }
  for (initialized = 9; tested = false; dead()) { dead(); }
}`);
    const main = program.functions.find(({ name }) => name === "Game.main")!;
    const operations = main.blocks.flatMap(({ operations }) => operations);
    const values = new Map(
      operations.flatMap((operation) =>
        operation.kind === "constant" ? [[operation.result, operation.value] as const] : [],
      ),
    );
    const stores = operations.filter((operation) => operation.kind === "store");
    expect(stores.map(({ value }) => values.get(value))).toEqual([false, 9n, false]);
    expect(stores[0]!.place.root).toEqual(stores[2]!.place.root);
    expect(stores[0]!.place.root).not.toEqual(stores[1]!.place.root);
    expect(operations.filter(({ kind }) => kind === "call")).toEqual([]);
    expect(main.blocks).toHaveLength(1);
    expect(main.blocks[0]!.terminator.kind).toBe("return");
  });

  it("retains ordered operand stores while replacing a known binary computation", () => {
    const program = lower(`module Game;
let left: byte;
let right: byte;
function main(): void { poke($0420, (left = 7) + (right = 8)); }`);
    const operations = program.functions
      .find(({ name }) => name === "Game.main")!
      .blocks.flatMap(({ operations }) => operations);
    const constants = operations.filter((operation) => operation.kind === "constant");
    const values = new Map(constants.map(({ result, value }) => [result, value]));
    const stores = operations.filter((operation) => operation.kind === "store");
    expect(stores.map(({ value }) => values.get(value))).toEqual([7n, 8n]);
    expect(stores[0]!.place.root).not.toEqual(stores[1]!.place.root);
    expect(constants.at(-1)?.value).toBe(15n);
    expect(operations.filter(({ kind }) => kind === "binary")).toEqual([]);
    expect(operations.at(-1)?.kind).toBe("memory-write");
  });

  it.each([
    ["byte(255) + byte(1)", 0n],
    ["sbyte(-128) - sbyte(1)", 127n],
    // An ordinary runtime expression wraps its word product before division.
    ["(300 * 300) / 300", 81n],
  ])("keeps the typed constant value for %s", (expression, expected) => {
    const program = lower(`module Game;
function main(): void { pokew($0420, word(${expression})); }`);
    const operations = program.functions
      .find(({ name }) => name === "Game.main")!
      .blocks.flatMap(({ operations }) => operations);
    expect(operations.filter(({ kind }) => kind === "binary")).toEqual([]);
    expect(operations.filter((operation) => operation.kind === "constant").at(-1)?.value).toBe(
      expected,
    );
  });

  it("keeps full precision in a constant declaration instead of using runtime wrapping", () => {
    const program = lower(`module Game;
const VALUE: word = (300 * 300) / 300;
function main(): void { pokew($0420, VALUE); }`);
    const operations = program.functions
      .find(({ name }) => name === "Game.main")!
      .blocks.flatMap(({ operations }) => operations);
    expect(operations.filter((operation) => operation.kind === "constant").at(-1)?.value).toBe(
      300n,
    );
    expect(operations.filter(({ kind }) => kind === "binary")).toEqual([]);
  });

  it("keeps unknown binary calculations and switch dispatch as runtime operations", () => {
    const program = lower(`module Game;
function choose(value: byte): byte {
  switch (value + 1) { case 1: return 6; default: return 2; }
}
function main(): void { poke($0420, choose(peek($0400))); }`);
    const choose = program.functions.find(({ name }) => name === "Game.choose")!;
    expect(
      choose.blocks.flatMap(({ operations }) => operations).filter(({ kind }) => kind === "binary"),
    ).toHaveLength(2);
    expect(choose.blocks.some(({ terminator }) => terminator.kind === "branch")).toBe(true);
  });

  it("keeps a no-match selector effect without creating switch blocks", () => {
    const program = lower(`module Game;
let selected: byte;
function main(): void {
  switch (selected = 7) { case 1: poke($0421, 99); }
}`);
    const main = program.functions.find(({ name }) => name === "Game.main")!;
    const operations = main.blocks.flatMap(({ operations }) => operations);
    expect(operations.filter(({ kind }) => kind === "store")).toHaveLength(1);
    expect(operations.filter(({ kind }) => kind === "memory-write")).toEqual([]);
    expect(main.blocks).toHaveLength(1);
  });

  it("retains a selected return and suppresses later explicit-fallthrough effects", () => {
    const program = lower(`module Game;
function choose(): byte {
  switch (2) {
    case 1: return 1;
    case 2: return 6; fallthrough;
    case 3: poke($0421, 99); return 3;
  }
  return 0;
}
function main(): void { poke($0420, choose()); }`);
    const choose = program.functions.find(({ name }) => name === "Game.choose")!;
    expect(choose.blocks).toHaveLength(1);
    expect(choose.blocks[0]!.terminator.kind).toBe("return");
    expect(choose.blocks[0]!.operations).toMatchObject([
      { kind: "constant", value: 2n },
      { kind: "constant", value: 6n },
    ]);
    expect(choose.blocks[0]!.terminator).toMatchObject({
      value:
        choose.blocks[0]!.operations[1]!.kind === "constant"
          ? choose.blocks[0]!.operations[1]!.result
          : null,
    });
  });

  it.each([
    "poke(&value, 2);",
    "let pointer: word = &value; value = 3; poke(pointer, 2);",
    "set(&value);",
  ])("does not fold an address-mutated local after %s", (write) => {
    const program = lower(`module Game;
function set(address: word): void { poke(address, 2); }
function main(): void {
  let value: byte = 1;
  ${write}
  let sum: byte = value + 1;
  switch (value) { case 1: poke($0421, 99); case 2: poke($0420, sum); }
}`);
    const main = program.functions.find(({ name }) => name === "Game.main")!;
    const operations = main.blocks.flatMap(({ operations }) => operations);
    expect(
      operations.some((operation) => operation.kind === "binary" && operation.operator === "+"),
    ).toBe(true);
    expect(main.blocks.some(({ terminator }) => terminator.kind === "branch")).toBe(true);
  });

  it.each(["shared", "Game.shared"])("preserves possibly interrupted reads of %s", (read) => {
    const program = lower(`module Game;
export let shared: byte;
interrupt function handler(): void { shared = 2; }
function main(): void {
  c64.system.setIRQ(&handler);
  shared = 1;
  let sum: byte = ${read} + 1;
  switch (${read}) { case 1: poke($0421, 99); case 2: poke($0420, sum); }
  c64.system.restoreIRQ();
}`);
    const main = program.functions.find(({ name }) => name === "Game.main")!;
    const operations = main.blocks.flatMap(({ operations }) => operations);
    expect(
      operations.some((operation) => operation.kind === "binary" && operation.operator === "+"),
    ).toBe(true);
    expect(main.blocks.some(({ terminator }) => terminator.kind === "branch")).toBe(true);
  });

  it("does not fold a local across a no-argument call with a numeric memory write", () => {
    const program = lower(`module Game;
function change(): void { poke($0acd, 2); }
function main(): void {
  let value: byte = 1;
  change();
  poke($0420, value + 1);
}`);
    const operations = program.functions
      .find(({ name }) => name === "Game.main")!
      .blocks.flatMap(({ operations }) => operations);
    const callIndex = operations.findIndex(({ kind }) => kind === "call");
    const sumIndex = operations.findIndex(
      (operation) => operation.kind === "binary" && operation.operator === "+",
    );
    expect(callIndex).toBeGreaterThanOrEqual(0);
    expect(sumIndex).toBeGreaterThan(callIndex);
    expect(operations.slice(callIndex + 1, sumIndex).some(({ kind }) => kind === "load")).toBe(
      true,
    );
  });

  it.each(["writeBox(box);", "set(box.pointer);"])(
    "keeps aggregate-hidden aliases safe through %s",
    (write) => {
      const program = lower(`module Game;
struct Box { pointer: word; }
function set(address: word): void { poke(address, 2); }
function writeBox(box: Box): void { poke(box.pointer, 2); }
function main(): void {
  let value: byte = 1;
  let box: Box = { pointer: &value };
  ${write}
  poke($0420, value + 1);
}`);
      const operations = program.functions
        .find(({ name }) => name === "Game.main")!
        .blocks.flatMap(({ operations }) => operations);
      expect(
        operations.some((operation) => operation.kind === "binary" && operation.operator === "+"),
      ).toBe(true);
    },
  );

  it("does not select a Boolean arm from an asynchronously mutable module fact", () => {
    const program = lower(`module Game;
let flag: boolean;
interrupt function handler(): void { flag = false; }
function main(): void {
  c64.system.setIRQ(&handler);
  flag = true;
  if (flag == true) { poke($0420, 1); } else { poke($0420, 2); }
  c64.system.restoreIRQ();
}`);
    const main = program.functions.find(({ name }) => name === "Game.main")!;
    expect(main.blocks.some(({ terminator }) => terminator.kind === "branch")).toBe(true);
  });
});
