import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { analyzeProject } from "../frontend/service.js";
import type { TypedProgram } from "../frontend/service.js";
import { buildSemanticProgram } from "./lower.js";

const PROFILE_ID = "c64-pal-prg-kernal-6581";

function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Build one immutable in-memory project without involving host files. */
function snapshot(text: string): ProjectSnapshot {
  const manifestText = "{}";
  const source: SourceRecord = {
    sourceId: "src/game.blend",
    text,
    sha256: hash(text),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: "/checkout/src/game.blend",
  };
  return {
    manifest: {
      schemaVersion: 1,
      name: "semantic-operations-spec",
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
      text: manifestText,
      sha256: hash(manifestText),
      byteLength: Buffer.byteLength(manifestText, "utf8"),
      resolvedPath: "/checkout/blend65.json",
    },
    sources: [source],
    inputSha256: hash(text),
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: [],
    outDir: "/checkout/out",
    overrides: { target: null, entry: null },
    effectiveTarget: PROFILE_ID,
    effectiveEntry: "Game",
  };
}

function completeFrontend(text: string): TypedProgram {
  const result = analyzeProject(snapshot(text));
  expect(result.kind).toBe("complete");
  expect(result.diagnostics).toEqual([]);
  if (result.kind !== "complete") throw new Error(`Expected complete, got ${result.kind}`);
  return result.program;
}

function binding(program: TypedProgram, qualifiedName: string) {
  const found = program.bindings.find((candidate) => candidate.qualifiedName === qualifiedName);
  expect(found).toBeDefined();
  if (found === undefined) throw new Error(`Missing binding ${qualifiedName}`);
  return found.id;
}

function sameBinding(
  left: {
    readonly sourceId: string;
    readonly span: { readonly start: number; readonly end: number };
  },
  right: {
    readonly sourceId: string;
    readonly span: { readonly start: number; readonly end: number };
  },
): boolean {
  return (
    left.sourceId === right.sourceId &&
    left.span.start === right.span.start &&
    left.span.end === right.span.end
  );
}

function lower(text: string) {
  const frontend = completeFrontend(text);
  const result = buildSemanticProgram({ kind: "complete", diagnostics: [], program: frontend });
  expect(result.kind).toBe("complete");
  expect(result).not.toHaveProperty("diagnostics");
  if (result.kind !== "complete") throw new Error(`Expected complete, got ${result.kind}`);
  return { frontend, semantic: result.program };
}

describe("ordered semantic operations", () => {
  // Each source operand and dynamic aggregate place is evaluated once in source order.
  it("should preserve nested call staging and one-time compound-place evaluation", () => {
    const text = [
      "module Game;",
      "let values: byte[4] = [0; 0];",
      "function next(): byte { return 1; }",
      "function inner(value: byte): byte { return value; }",
      "function outer(first: byte, second: byte): byte { return first + second; }",
      "function index(): word { return 1; }",
      "function delta(): byte { return 2; }",
      "function main(): void {",
      "  let x: byte = 0;",
      "  x = next();",
      "  x = outer(next(), inner(next()));",
      "  values[index()] += delta();",
      "}",
    ].join("\n");
    const { frontend, semantic } = lower(text);
    const mainId = binding(frontend, "Game.main");
    const valuesId = binding(frontend, "Game.values");
    const callees = {
      next: binding(frontend, "Game.next"),
      inner: binding(frontend, "Game.inner"),
      outer: binding(frontend, "Game.outer"),
      index: binding(frontend, "Game.index"),
      delta: binding(frontend, "Game.delta"),
    };
    const main = semantic.functions.find((candidate) => sameBinding(candidate.id, mainId));
    expect(main).toBeDefined();
    if (main === undefined) throw new Error("Missing lowered main");
    const operations = main.blocks.flatMap((block) => block.operations);
    const calls = operations.filter((operation) => operation.kind === "call");

    expect(calls.map(({ callee }) => callee)).toEqual([
      callees.next,
      callees.next,
      callees.next,
      callees.inner,
      callees.outer,
      callees.index,
      callees.delta,
    ]);

    const nestedArgument = calls[2]?.result;
    const innerResult = calls[3]?.result;
    expect(calls[3]).toMatchObject({ arguments: [nestedArgument] });
    expect(calls[4]).toMatchObject({ arguments: [calls[1]?.result, innerResult] });

    const indexResult = calls[5]?.result;
    const aggregateOperations = operations.filter(
      (operation) =>
        (operation.kind === "load" || operation.kind === "store") &&
        sameBinding(operation.place.root, valuesId),
    );
    expect(aggregateOperations).toHaveLength(2);
    expect(aggregateOperations.map(({ kind }) => kind)).toEqual(["load", "store"]);
    expect(aggregateOperations[0]?.place.path).toEqual([{ kind: "index", value: indexResult }]);
    expect(aggregateOperations[1]?.place.path).toEqual([{ kind: "index", value: indexResult }]);

    const compoundOrder = [
      operations.indexOf(calls[5]!),
      operations.indexOf(aggregateOperations[0]!),
      operations.indexOf(calls[6]!),
      operations.findIndex(
        (operation, index) => index > operations.indexOf(calls[6]!) && operation.kind === "binary",
      ),
      operations.indexOf(aggregateOperations[1]!),
    ];
    expect(compoundOrder).toEqual([...compoundOrder].sort((left, right) => left - right));
    expect(new Set(compoundOrder).size).toBe(compoundOrder.length);
  });

  // Dynamic raw-memory operands remain word-addressed and produce one ordered volatile access.
  it("should retain byte and word memory access width order volatility and modulo address domain", () => {
    const text = [
      "module Game;",
      "function address(): word { return $ffff; }",
      "function byteValue(): byte { return $12; }",
      "function wordValue(): word { return $3456; }",
      "function main(): void {",
      "  let b: byte = peek(address());",
      "  poke(address(), byteValue());",
      "  let w: word = peekw(address());",
      "  pokew(address(), wordValue());",
      "}",
    ].join("\n");
    const { frontend, semantic } = lower(text);
    const mainId = binding(frontend, "Game.main");
    const addressId = binding(frontend, "Game.address");
    const byteValueId = binding(frontend, "Game.byteValue");
    const wordValueId = binding(frontend, "Game.wordValue");
    const main = semantic.functions.find((candidate) => sameBinding(candidate.id, mainId));
    expect(main).toBeDefined();
    if (main === undefined) throw new Error("Missing lowered main");
    const operations = main.blocks.flatMap((block) => block.operations);
    const calls = operations.filter((operation) => operation.kind === "call");
    const memory = operations.filter(
      (operation) => operation.kind === "memory-read" || operation.kind === "memory-write",
    );

    expect(calls.map(({ callee }) => callee)).toEqual([
      addressId,
      addressId,
      byteValueId,
      addressId,
      addressId,
      wordValueId,
    ]);
    expect(calls.filter(({ callee }) => sameBinding(callee, addressId))).toHaveLength(4);
    expect(
      memory.map(({ kind, width, byteOrder, volatile }) => ({
        kind,
        width,
        byteOrder,
        volatile,
      })),
    ).toEqual([
      { kind: "memory-read", width: 1, byteOrder: "low-first", volatile: true },
      { kind: "memory-write", width: 1, byteOrder: "low-first", volatile: true },
      { kind: "memory-read", width: 2, byteOrder: "low-first", volatile: true },
      { kind: "memory-write", width: 2, byteOrder: "low-first", volatile: true },
    ]);

    expect(memory.map(({ address }) => address)).toEqual([
      calls[0]?.result,
      calls[1]?.result,
      calls[3]?.result,
      calls[4]?.result,
    ]);
    expect(calls.filter(({ callee }) => sameBinding(callee, addressId))).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: { kind: "scalar", name: "word" } })]),
    );
    expect(memory[1]).toMatchObject({ value: calls[2]?.result });
    expect(memory[3]).toMatchObject({ value: calls[5]?.result });
  });
});
