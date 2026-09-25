import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord, SourceSpan } from "../project/types.js";
import { analyzeProject } from "../frontend/service.js";
import type { AnalysisResult, TypedProgram } from "../frontend/service.js";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import { buildSemanticProgram } from "./lower.js";
import type { SemanticFunction, SemanticProgram } from "./operations.js";
import { closeWholeProgram } from "./whole-program.js";

const PROFILE_ID = "c64-pal-prg-kernal-6581";
const VOID_TYPE: SemanticType = Object.freeze({ kind: "scalar", name: "void" });

function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function snapshot(text: string, target = PROFILE_ID): ProjectSnapshot {
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
      name: "whole-program-spec",
      sourceRoot: "src",
      entry: "Game",
      target,
      assetPaths: [],
      outDir: "out",
      optimization: "none",
      boundsCheck: true,
      divisionZeroCheck: true,
    },
    manifestSource: {
      sourceId: "blend65.json",
      text: "{}",
      sha256: hash("{}"),
      byteLength: 2,
      resolvedPath: "/checkout/blend65.json",
    },
    sources: [source],
    inputSha256: hash(text),
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: [],
    outDir: "/checkout/out",
    overrides: { target: null, entry: null },
    effectiveTarget: target,
    effectiveEntry: "Game",
  };
}

/** Build an immutable multi-module project without consulting host files. */
function multiModuleSnapshot(
  sources: readonly { readonly sourceId: string; readonly text: string }[],
): ProjectSnapshot {
  const manifestText = "{}";
  const records = sources.map<SourceRecord>(({ sourceId, text }) => ({
    sourceId,
    text,
    sha256: hash(text),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: `/checkout/${sourceId}`,
  }));
  return {
    manifest: {
      schemaVersion: 1,
      name: "whole-program-modules-spec",
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
    sources: records,
    inputSha256: hash(JSON.stringify(records.map(({ sourceId, sha256 }) => [sourceId, sha256]))),
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: [],
    outDir: "/checkout/out",
    overrides: { target: null, entry: null },
    effectiveTarget: PROFILE_ID,
    effectiveEntry: "Game",
  };
}

function sameBinding(left: BindingId, right: BindingId): boolean {
  return (
    left.sourceId === right.sourceId &&
    left.span.start === right.span.start &&
    left.span.end === right.span.end
  );
}

function binding(program: TypedProgram, qualifiedName: string): BindingId {
  const found = program.bindings.find((candidate) => candidate.qualifiedName === qualifiedName);
  expect(found).toBeDefined();
  if (found === undefined) throw new Error(`Missing binding ${qualifiedName}`);
  return found.id;
}

function completeSemanticProject(project: ProjectSnapshot) {
  const analysis = analyzeProject(project);
  expect(analysis.kind).toBe("complete");
  expect(analysis.diagnostics).toEqual([]);
  if (analysis.kind !== "complete") throw new Error(`Expected complete, got ${analysis.kind}`);
  const lowered = buildSemanticProgram(analysis);
  expect(lowered.kind).toBe("complete");
  if (lowered.kind !== "complete") throw new Error(`Expected complete, got ${lowered.kind}`);
  return { frontend: analysis.program, semantic: lowered.program };
}

function completeSemantic(text: string) {
  return completeSemanticProject(snapshot(text));
}

function span(start: number): SourceSpan {
  return { sourceId: "src/cycle.blend", start, end: start + 1 };
}

function id(start: number): BindingId {
  const declaration = span(start);
  return { sourceId: declaration.sourceId, span: declaration };
}

function semanticFunction(functionId: BindingId, callees: readonly BindingId[]): SemanticFunction {
  const blockId = `block:${functionId.span.start}`;
  return {
    id: functionId,
    parameters: [],
    result: VOID_TYPE,
    entry: blockId,
    blocks: [
      {
        id: blockId,
        operations: callees.map((callee, index) => ({
          kind: "call" as const,
          result: null,
          callee,
          arguments: [],
          type: VOID_TYPE,
          span: span(functionId.span.start + index + 1),
        })),
        terminator: { kind: "return", value: null },
      },
    ],
    source: functionId.span,
  };
}

function semanticGraph(
  functionIds: readonly BindingId[],
  edges: ReadonlyMap<BindingId, readonly BindingId[]>,
): SemanticProgram {
  return {
    main: functionIds[0]!,
    globals: [],
    functions: functionIds.map((functionId) =>
      semanticFunction(functionId, edges.get(functionId) ?? []),
    ),
    assets: [],
    initializerOrder: [],
  };
}

describe("frontend poison gate", () => {
  // Invalid and incomplete frontend states pass through without creating semantic output.
  it.each([
    {
      name: "poisoned typed source",
      text: "module Game; function main(): void { if (1) {} }",
      target: PROFILE_ID,
      expected: "error",
    },
    {
      name: "incomplete embedded value",
      text: 'module Game; const DATA: byte[] = embed("missing.bin"); function main(): void {}',
      target: "test.target",
      expected: "incomplete",
    },
    {
      name: "unknown call target",
      text: "module Game; function main(): void { missing(); }",
      target: PROFILE_ID,
      expected: "error",
    },
  ] as const)("should reject $name before semantic construction", ({ text, target, expected }) => {
    const analysis: AnalysisResult = analyzeProject(snapshot(text, target));
    expect(analysis.kind).toBe(expected);
    expect(analysis).not.toHaveProperty("program");
    const result = buildSemanticProgram(analysis);

    expect(result.kind).toBe(analysis.kind);
    expect(result).not.toHaveProperty("program");
    expect(result.diagnostics).toBe(analysis.diagnostics);
    if (analysis.kind === "incomplete" && result.kind === "incomplete") {
      expect(result.obligations).toBe(analysis.obligations);
    }
  });
});

describe("whole-program closure", () => {
  // Startup, ordered initializers and main close over only reachable calls and effects.
  it("should retain stable roots and reachable-only call and effect closure", () => {
    const text = [
      "module Game;",
      "let first: byte = initFirst();",
      "let second: byte = initSecond();",
      "function initFirst(): byte { return 1; }",
      "function initSecond(): byte { return 2; }",
      "function leaf(): void { c64.video.waitNextFrame(); }",
      "function helper(): void { leaf(); }",
      "function dead(): void { c64.vic.setBorderColor(1); }",
      "function main(): void { helper(); }",
    ].join("\n");
    const { frontend, semantic } = completeSemantic(text);
    const result = closeWholeProgram(semantic);

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected complete whole program");
    const ids = {
      first: binding(frontend, "Game.first"),
      second: binding(frontend, "Game.second"),
      initFirst: binding(frontend, "Game.initFirst"),
      initSecond: binding(frontend, "Game.initSecond"),
      leaf: binding(frontend, "Game.leaf"),
      helper: binding(frontend, "Game.helper"),
      dead: binding(frontend, "Game.dead"),
      main: binding(frontend, "Game.main"),
    };

    expect(result.program.roots.map(({ kind }) => kind)).toEqual([
      "startup",
      "initializer",
      "initializer",
      "main",
    ]);
    expect(result.program.semantic.initializerOrder).toEqual([ids.first, ids.second]);
    expect(result.program.semantic.main).toEqual(ids.main);
    expect(result.program.reachableFunctions).toEqual([
      ids.initFirst,
      ids.initSecond,
      ids.leaf,
      ids.helper,
      ids.main,
    ]);
    expect(
      result.program.reachableFunctions.some((functionId) => sameBinding(functionId, ids.dead)),
    ).toBe(false);
    expect(result.program.callGraph.map((node) => node.function)).toEqual(
      result.program.reachableFunctions,
    );
    const effect = result.program.effects.find((candidate) =>
      sameBinding(candidate.function, ids.main),
    );
    expect(effect).toMatchObject({ operationEffects: ["ordered-wait"], opaque: true });
  });

  // Nested scalar and aggregate calls keep source order across modules and retain separate live results.
  it("should preserve cross-module nested call order and disjoint aggregate results", () => {
    const project = multiModuleSnapshot([
      {
        sourceId: "src/game.blend",
        text: [
          "module Game;",
          "import { Pair, f, make, merge } from Math;",
          "function main(): void {",
          "  let scalar: byte = f(1, f(2, 3));",
          "  let pair: Pair = merge(make(scalar), make(4));",
          "}",
        ].join("\n"),
      },
      {
        sourceId: "src/math.blend",
        text: [
          "module Math;",
          "export struct Pair { first: byte; second: byte; }",
          "export function f(first: byte, second: byte): byte { return first + second; }",
          "export function make(value: byte): Pair { return { first: value, second: value + 1 }; }",
          "export function merge(first: Pair, second: Pair): Pair { return { first: first.first, second: second.first }; }",
        ].join("\n"),
      },
    ]);
    const { frontend, semantic } = completeSemanticProject(project);
    const closed = closeWholeProgram(semantic);
    expect(closed.kind).toBe("complete");

    const mainId = binding(frontend, "Game.main");
    const callees = {
      f: binding(frontend, "Math.f"),
      make: binding(frontend, "Math.make"),
      merge: binding(frontend, "Math.merge"),
    };
    const main = semantic.functions.find((candidate) => sameBinding(candidate.id, mainId));
    expect(main).toBeDefined();
    if (main === undefined) throw new Error("Missing semantic main function");
    const calls = main.blocks
      .flatMap(({ operations }) => operations)
      .filter((operation) => operation.kind === "call");

    expect(calls.map(({ callee }) => callee)).toEqual([
      callees.f,
      callees.f,
      callees.make,
      callees.make,
      callees.merge,
    ]);
    expect(calls[1]?.arguments[1]).toEqual(calls[0]?.result);
    expect(calls[4]?.arguments).toEqual([calls[2]?.result, calls[3]?.result]);
    expect(calls[2]?.result).not.toBeNull();
    expect(calls[3]?.result).not.toBeNull();
    expect(calls[2]?.result).not.toEqual(calls[3]?.result);
  });

  // Closed typed storage admits finite targets, while opaque targets and finite indirect cycles fail before allocation.
  it("should close finite function targets and reject opaque or recursive target sets", () => {
    const finite = completeSemantic(
      [
        "module Game;",
        "function left(value: byte): byte { return value - 1; }",
        "function right(value: byte): byte { return value + 1; }",
        "let callbacks: (fn(byte): byte)[2] = [&left, &right];",
        "function apply(callback: fn(byte): byte, value: byte): byte { return callback(value); }",
        "function main(): void {",
        "  let selected: word = word(peek($02)) & 1;",
        "  let result: byte = apply(callbacks[selected], 3);",
        "}",
      ].join("\n"),
    );
    const finiteResult = closeWholeProgram(finite.semantic);
    expect(finiteResult.kind).toBe("complete");
    if (finiteResult.kind !== "complete") throw new Error("Expected finite function targets");
    const finiteTargets = [
      binding(finite.frontend, "Game.left"),
      binding(finite.frontend, "Game.right"),
    ];
    expect(
      finiteTargets.every((target) =>
        finiteResult.program.reachableFunctions.some((candidate) => sameBinding(candidate, target)),
      ),
    ).toBe(true);

    const opaqueAnalysis = analyzeProject(
      snapshot("module Game; let callback: fn(byte): byte; function main(): void { callback(1); }"),
    );
    expect(opaqueAnalysis.kind).toBe("complete");
    if (opaqueAnalysis.kind !== "complete") throw new Error("Expected an analyzable opaque target");
    const opaqueSemantic = buildSemanticProgram(opaqueAnalysis);
    expect(opaqueSemantic.kind).toBe("complete");
    if (opaqueSemantic.kind !== "complete") throw new Error("Expected an opaque semantic target");
    const opaqueResult = closeWholeProgram(opaqueSemantic.program);
    expect(opaqueResult.kind).toBe("error");
    expect(opaqueResult.diagnostics.map(({ code }) => code)).toEqual(["E10277"]);

    const recursive = completeSemantic(
      [
        "module Game;",
        "function first(): void { let next: fn(): void = &second; next(); }",
        "function second(): void { first(); }",
        "function main(): void { first(); }",
      ].join("\n"),
    );
    const recursiveResult = closeWholeProgram(recursive.semantic);
    expect(recursiveResult.kind).toBe("error");
    expect(recursiveResult.diagnostics).toMatchObject([
      {
        code: "E10181",
        message: "Indirect recursion detected — cycle: first → second → first",
      },
    ]);
  });

  // Direct and mutual recursive cycles are terminal before storage allocation can begin.
  it.each([
    {
      name: "direct recursion",
      expectedCode: "E10180",
      make: () => {
        const main = id(0);
        return semanticGraph([main], new Map([[main, [main]]]));
      },
    },
    {
      name: "mutual recursion",
      expectedCode: "E10181",
      make: () => {
        const first = id(0);
        const second = id(10);
        return semanticGraph(
          [first, second],
          new Map([
            [first, [second]],
            [second, [first]],
          ]),
        );
      },
    },
  ])("should reject $name without a downstream program", ({ expectedCode, make }) => {
    const result = closeWholeProgram(make());

    expect(result.kind).toBe("error");
    expect(result).not.toHaveProperty("program");
    if (result.kind !== "error") throw new Error("Expected recursive closure to fail");
    expect(result.diagnostics.map(({ code }) => code)).toEqual([expectedCode]);
  });

  // A call edge must resolve to a known function or fail instead of disappearing.
  it("should reject an unknown call edge with its proving source location", () => {
    const main = id(0);
    const missing = id(20);
    const program = semanticGraph([main], new Map([[main, [missing]]]));
    const result = closeWholeProgram(program);

    expect(result.kind).toBe("error");
    expect(result).not.toHaveProperty("program");
    if (result.kind !== "error") throw new Error("Expected unknown call edge to fail");
    expect(result.diagnostics).toMatchObject([
      {
        code: "E10277",
        severity: "error",
        primarySpan: span(1),
      },
    ]);
  });

  // Named platform intent keeps only its target-neutral capability and ordered effect upstream.
  it("should retain platform intent without target addresses opcodes layout or serializer facts", () => {
    const text = ["module Game;", "function main(): void { c64.vic.setBorderColor(1); }"].join(
      "\n",
    );
    const { frontend, semantic } = completeSemantic(text);
    const main = semantic.functions.find((candidate) =>
      sameBinding(candidate.id, binding(frontend, "Game.main")),
    );
    expect(main).toBeDefined();
    if (main === undefined) throw new Error("Missing lowered main");
    const platform = main.blocks
      .flatMap((block) => block.operations)
      .find((operation) => operation.kind === "platform");

    expect(platform).toMatchObject({
      kind: "platform",
      capability: "c64.vic.setBorderColor",
      effect: "volatile-write",
    });
    expect(Object.keys(platform ?? {}).sort()).not.toEqual(
      expect.arrayContaining([
        "address",
        "opcode",
        "addressingMode",
        "bank",
        "layout",
        "acme",
        "prg",
      ]),
    );
  });
});
