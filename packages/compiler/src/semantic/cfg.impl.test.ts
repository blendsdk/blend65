import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { analyzeProject } from "../frontend/service.js";
import { buildSemanticProgram } from "./lower.js";

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
});
