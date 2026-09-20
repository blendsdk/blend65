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

function completeSemantic(text: string) {
  const analysis = analyzeProject(snapshot(text));
  expect(analysis.kind).toBe("complete");
  expect(analysis.diagnostics).toEqual([]);
  if (analysis.kind !== "complete") throw new Error(`Expected complete, got ${analysis.kind}`);
  const lowered = buildSemanticProgram(analysis);
  expect(lowered.kind).toBe("complete");
  if (lowered.kind !== "complete") throw new Error(`Expected complete, got ${lowered.kind}`);
  return { frontend: analysis.program, semantic: lowered.program };
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
