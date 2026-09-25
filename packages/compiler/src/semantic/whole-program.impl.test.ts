import { describe, expect, it } from "vitest";
import type {
  BindingId,
  EffectSummary,
  FunctionType,
  SemanticType,
} from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import type { SemanticFunction, SemanticProgram } from "./operations.js";
import { resolveFunctionTargets } from "./function-targets.js";
import { closeWholeProgram } from "./whole-program.js";

const VOID_TYPE: SemanticType = Object.freeze({ kind: "scalar", name: "void" });

/** Create a one-byte proving span. */
function span(start: number): SourceSpan {
  return { sourceId: "src/graph.blend", start, end: start + 1 };
}

/** Create a stable source function identity. */
function id(start: number): BindingId {
  return { sourceId: "src/graph.blend", span: span(start) };
}

/** Create one straight-line semantic function with the supplied calls and optional effect. */
function fn(
  functionId: BindingId,
  callees: readonly BindingId[],
  effect: "ordered-wait" | null = null,
): SemanticFunction {
  const operations = callees.map((callee, index) => ({
    kind: "call" as const,
    result: null,
    callee,
    arguments: [],
    type: VOID_TYPE,
    span: span(functionId.span.start + index + 1),
  }));
  if (effect !== null) {
    operations.push({
      kind: "platform" as const,
      result: null,
      capability: "c64.video.waitNextFrame",
      arguments: [],
      type: VOID_TYPE,
      effect,
      span: span(functionId.span.start + 5),
    });
  }
  const blockId = `block:${functionId.span.start}`;
  return {
    id: functionId,
    parameters: [],
    result: VOID_TYPE,
    entry: blockId,
    blocks: [
      {
        id: blockId,
        operations,
        terminator: { kind: "return", value: null },
      },
    ],
    source: functionId.span,
  };
}

/** Create a minimal semantic program rooted at the first function. */
function program(
  functions: readonly SemanticFunction[],
  effects: readonly EffectSummary[] = [],
): SemanticProgram {
  return {
    main: functions[0]!.id,
    globals: [],
    functions,
    effects,
    assets: [],
    initializerOrder: [],
  };
}

/** Create one already-proved transitive effect summary. */
function effect(
  functionId: BindingId,
  operationEffects: EffectSummary["operationEffects"],
): EffectSummary {
  return {
    function: functionId,
    reads: [],
    writes: [],
    operationEffects,
    opaque: operationEffects.length > 0,
  };
}

describe("whole-program implementation", () => {
  it("retains exported and address-taken functions as independent roots", () => {
    const main = id(0);
    const exported = id(10);
    const addressed = id(20);
    const dead = id(30);
    const signature: FunctionType = Object.freeze({
      kind: "function",
      parameters: Object.freeze([]),
      returnType: VOID_TYPE,
    });
    const owner: SemanticFunction = {
      ...fn(main, []),
      blocks: [
        {
          id: "block:0",
          operations: [
            {
              kind: "function-address",
              result: "target",
              function: addressed,
              type: signature,
              integer: null,
              span: span(1),
            },
          ],
          terminator: { kind: "return", value: null },
        },
      ],
    };
    const result = closeWholeProgram(
      program([owner, { ...fn(exported, []), exported: true }, fn(addressed, []), fn(dead, [])]),
    );
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected complete closure");
    expect(result.program.reachableFunctions).toEqual([main, exported, addressed]);
    expect(result.program.roots).toEqual([
      { kind: "startup" },
      { kind: "main", function: main },
      { kind: "callable", function: exported },
      { kind: "callable", function: addressed },
    ]);
  });

  it("keeps a precise merged target set separate from unrelated address-taken functions", () => {
    const main = id(0);
    const first = id(10);
    const second = id(20);
    const unrelated = id(30);
    const signature: FunctionType = Object.freeze({
      kind: "function",
      parameters: Object.freeze([]),
      returnType: VOID_TYPE,
    });
    const address = (target: BindingId, result: string) =>
      Object.freeze({
        kind: "function-address" as const,
        result,
        function: target,
        type: signature,
        integer: null,
        span: target.span,
      });
    const indirect = Object.freeze({
      kind: "indirect-call" as const,
      result: null,
      target: "selected",
      arguments: Object.freeze([]),
      signature,
      type: VOID_TYPE,
      span: span(4),
    });
    const owner: SemanticFunction = {
      ...fn(main, []),
      blocks: [
        {
          id: "block:0",
          operations: [
            address(second, "second"),
            address(first, "first"),
            address(unrelated, "unrelated"),
            {
              kind: "merge",
              result: "selected",
              incoming: [
                { block: "right", value: "second" },
                { block: "left", value: "first" },
              ],
              type: signature,
              integer: null,
              span: span(3),
            },
            indirect,
          ],
          terminator: { kind: "return", value: null },
        },
      ],
    };
    const targets = resolveFunctionTargets(
      program([owner, fn(unrelated, []), fn(second, []), fn(first, [])]),
    );
    expect(targets.get(indirect)).toEqual([first, second]);
  });

  it("rejects a malformed indirect edge whose source function is absent", () => {
    const main = id(0);
    const missing = id(90);
    const signature: FunctionType = Object.freeze({
      kind: "function",
      parameters: Object.freeze([]),
      returnType: VOID_TYPE,
    });
    const callSpan = span(5);
    const owner: SemanticFunction = {
      ...fn(main, []),
      blocks: [
        {
          id: "block:0",
          operations: [
            {
              kind: "function-address",
              result: "missing",
              function: missing,
              type: signature,
              integer: null,
              span: span(4),
            },
            {
              kind: "indirect-call",
              result: null,
              target: "missing",
              arguments: [],
              signature,
              type: VOID_TYPE,
              span: callSpan,
            },
          ],
          terminator: { kind: "return", value: null },
        },
      ],
    };
    const result = closeWholeProgram(program([owner]));
    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("Expected malformed indirect edge to fail");
    expect(result.diagnostics).toMatchObject([{ code: "E10277", primarySpan: callSpan }]);
  });

  it("reports the same recursive path after function records are shuffled", () => {
    const main = id(0);
    const first = id(10);
    const second = id(20);
    const third = id(30);
    const functions = [
      { ...fn(main, [first]), name: "Game.main" },
      { ...fn(first, [second]), name: "Game.first" },
      { ...fn(second, [third]), name: "Game.second" },
      { ...fn(third, [first]), name: "Game.third" },
    ];
    for (const ordered of [functions, [...functions].reverse()]) {
      const result = closeWholeProgram({ ...program(functions), functions: ordered });
      expect(result.kind).toBe("error");
      if (result.kind !== "error") throw new Error("Expected recursive closure to fail");
      expect(result.diagnostics).toMatchObject([
        {
          code: "E10181",
          message: "Indirect recursion detected — cycle: first → second → third → first",
        },
      ]);
    }
  });
  it("deduplicates and sorts direct edges while closing transitive effects", () => {
    const main = id(0);
    const first = id(10);
    const second = id(20);
    const result = closeWholeProgram(
      program(
        [fn(main, [second, first, second]), fn(second, []), fn(first, [], "ordered-wait")],
        [effect(main, ["ordered-wait"]), effect(first, ["ordered-wait"]), effect(second, [])],
      ),
    );

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected complete closure");
    expect(result.program.reachableFunctions).toEqual([main, first, second]);
    expect(result.program.callGraph[0]).toEqual({ function: main, callees: [first, second] });
    expect(result.program.effects[0]).toMatchObject({
      function: main,
      operationEffects: ["ordered-wait"],
      opaque: true,
    });
  });

  it("rejects an unknown call reached through a successor block", () => {
    const main = id(0);
    const missing = id(50);
    const callSpan = span(8);
    const semantic: SemanticProgram = {
      main,
      globals: [],
      functions: [
        {
          id: main,
          parameters: [],
          result: VOID_TYPE,
          entry: "entry",
          blocks: [
            {
              id: "entry",
              operations: [
                {
                  kind: "constant",
                  result: "condition",
                  value: true,
                  type: Object.freeze({ kind: "scalar", name: "boolean" }),
                  integer: null,
                  span: span(1),
                },
              ],
              terminator: {
                kind: "branch",
                condition: "condition",
                whenTrue: "called",
                whenFalse: "exit",
              },
            },
            {
              id: "called",
              operations: [
                {
                  kind: "call",
                  result: null,
                  callee: missing,
                  arguments: [],
                  type: VOID_TYPE,
                  span: callSpan,
                },
              ],
              terminator: { kind: "jump", target: "exit" },
            },
            { id: "exit", operations: [], terminator: { kind: "return", value: null } },
          ],
          source: main.span,
        },
      ],
      assets: [],
      initializerOrder: [],
    };

    const result = closeWholeProgram(semantic);
    expect(result.kind).toBe("error");
    expect(result).not.toHaveProperty("program");
    if (result.kind !== "error") throw new Error("Expected unknown edge to fail");
    expect(result.diagnostics).toMatchObject([{ code: "E10277", primarySpan: callSpan }]);
  });

  it("rejects an unknown function reached only from an initializer root", () => {
    const main = id(0);
    const global = id(30);
    const missing = id(50);
    const callSpan = span(31);
    const semantic: SemanticProgram = {
      main,
      globals: [
        {
          id: global,
          storage: "module",
          type: Object.freeze({ kind: "scalar", name: "byte" }),
          initialBytes: null,
          runtimeInitialBytes: null,
          entry: "initializer",
          blocks: [
            {
              id: "initializer",
              operations: [
                {
                  kind: "call",
                  result: "value",
                  callee: missing,
                  arguments: [],
                  type: Object.freeze({ kind: "scalar", name: "byte" }),
                  span: callSpan,
                },
              ],
              terminator: { kind: "return", value: null },
            },
          ],
          source: global.span,
        },
      ],
      functions: [fn(main, [])],
      assets: [],
      initializerOrder: [global],
    };

    const result = closeWholeProgram(semantic);
    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("Expected initializer edge to fail");
    expect(result.diagnostics).toMatchObject([{ code: "E10277", primarySpan: callSpan }]);
  });

  it("retains initializer call edges and values which cross a nested call", () => {
    const main = id(0);
    const global = id(30);
    const outerCall = span(32);
    const finalCall = span(33);
    const first = id(60);
    const second = id(70);
    const byteType: SemanticType = Object.freeze({ kind: "scalar", name: "byte" });
    const semantic: SemanticProgram = {
      main,
      globals: [
        {
          id: global,
          storage: "module",
          type: byteType,
          initialBytes: null,
          runtimeInitialBytes: null,
          entry: "initializer",
          blocks: [
            {
              id: "initializer",
              operations: [
                {
                  kind: "constant",
                  result: "outer",
                  type: byteType,
                  integer: null,
                  value: 1n,
                  span: span(31),
                },
                {
                  kind: "call",
                  result: "inner",
                  callee: second,
                  arguments: [],
                  type: byteType,
                  span: outerCall,
                },
                {
                  kind: "call",
                  result: "final",
                  callee: first,
                  arguments: ["outer", "inner"],
                  type: byteType,
                  span: finalCall,
                },
                {
                  kind: "store",
                  place: { root: global, path: [] },
                  value: "final",
                  type: byteType,
                  span: span(34),
                },
              ],
              terminator: { kind: "return", value: null },
            },
          ],
          source: global.span,
        },
      ],
      functions: [
        fn(main, []),
        { ...fn(first, []), result: byteType },
        { ...fn(second, []), result: byteType },
      ],
      assets: [],
      initializerOrder: [global],
    };

    const result = closeWholeProgram(semantic);
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected initializer closure to complete");
    expect(result.program.initializers).toHaveLength(1);
    expect(result.program.initializers?.[0]?.callees).toEqual([first, second]);
    expect(
      result.program.initializers?.[0]?.lifetimes.find(({ value }) => value === "outer"),
    ).toMatchObject({ callsCrossed: [outerCall] });
  });

  it("ignores unknown edges and recursion in unreachable functions", () => {
    const main = id(0);
    const deadFirst = id(10);
    const deadSecond = id(20);
    const missing = id(30);
    const result = closeWholeProgram(
      program([fn(main, []), fn(deadFirst, [deadSecond, missing]), fn(deadSecond, [deadFirst])]),
    );

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected dead edges to be excluded");
    expect(result.program.reachableFunctions).toEqual([main]);
  });

  it("retains frontend-proved reads and writes without rebuilding a partial effect model", () => {
    const main = id(0);
    const global = id(40);
    const proved: EffectSummary = {
      function: main,
      reads: [{ binding: global, path: [], readonly: false }],
      writes: [{ binding: global, path: [], readonly: false }],
      operationEffects: [],
      opaque: false,
    };
    const result = closeWholeProgram(program([fn(main, [])], [proved]));

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected effect closure to complete");
    expect(result.program.effects).toEqual([proved]);
  });

  it("rejects a reachable effect-bearing function without a frontend effect proof", () => {
    const main = id(0);
    expect(() => closeWholeProgram(program([fn(main, [], "ordered-wait")]))).toThrow(
      "Reachable semantic effects are missing their frontend proof",
    );
  });

  it("follows referenced constant globals to their resident assets", () => {
    const main = id(0);
    const spriteData = id(10);
    const semantic: SemanticProgram = {
      main,
      globals: [
        {
          id: spriteData,
          storage: "constant",
          type: Object.freeze({
            kind: "array",
            element: Object.freeze({ kind: "scalar", name: "byte" }),
            length: 1,
            size: 1,
          }),
          initialBytes: null,
          runtimeInitialBytes: null,
          entry: "asset-initializer",
          blocks: [
            {
              id: "asset-initializer",
              operations: [
                {
                  kind: "embedded-address",
                  result: "asset-address",
                  asset: "sprite",
                  type: Object.freeze({ kind: "scalar", name: "word" }),
                  integer: Object.freeze({ width: 16, signed: false, wrap: true }),
                  span: span(11),
                },
              ],
              terminator: { kind: "return", value: null },
            },
          ],
          source: spriteData.span,
        },
      ],
      functions: [
        {
          ...fn(main, []),
          blocks: [
            {
              id: "block:0",
              operations: [
                {
                  kind: "place-address",
                  result: "sprite-place",
                  place: { root: spriteData, path: [] },
                  type: Object.freeze({ kind: "scalar", name: "word" }),
                  integer: Object.freeze({ width: 16, signed: false, wrap: true }),
                  span: span(1),
                },
              ],
              terminator: { kind: "return", value: null },
            },
          ],
        },
      ],
      effects: [],
      assets: [
        { id: "sprite", sourcePath: "sprites.bin", sha256: "a".repeat(64), bytes: [1] },
        { id: "dead", sourcePath: "dead.bin", sha256: "b".repeat(64), bytes: [2] },
      ],
      initializerOrder: [],
    };

    const result = closeWholeProgram(semantic);
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected asset closure to complete");
    expect(result.program.reachableAssets).toEqual(["sprite"]);
  });

  it("keeps mutually exclusive merge inputs disjoint in CFG liveness", () => {
    const main = id(0);
    const semantic: SemanticProgram = {
      main,
      globals: [],
      functions: [
        {
          id: main,
          parameters: [],
          result: Object.freeze({ kind: "scalar", name: "boolean" }),
          entry: "entry",
          blocks: [
            {
              id: "entry",
              operations: [
                {
                  kind: "constant",
                  result: "condition",
                  value: true,
                  type: Object.freeze({ kind: "scalar", name: "boolean" }),
                  integer: null,
                  span: span(1),
                },
              ],
              terminator: {
                kind: "branch",
                condition: "condition",
                whenTrue: "true-arm",
                whenFalse: "false-arm",
              },
            },
            {
              id: "true-arm",
              operations: [
                {
                  kind: "constant",
                  result: "true-value",
                  value: true,
                  type: Object.freeze({ kind: "scalar", name: "boolean" }),
                  integer: null,
                  span: span(2),
                },
              ],
              terminator: { kind: "jump", target: "merge" },
            },
            {
              id: "false-arm",
              operations: [
                {
                  kind: "constant",
                  result: "false-value",
                  value: false,
                  type: Object.freeze({ kind: "scalar", name: "boolean" }),
                  integer: null,
                  span: span(3),
                },
              ],
              terminator: { kind: "jump", target: "merge" },
            },
            {
              id: "merge",
              operations: [
                {
                  kind: "merge",
                  result: "result",
                  incoming: [
                    { block: "true-arm", value: "true-value" },
                    { block: "false-arm", value: "false-value" },
                  ],
                  type: Object.freeze({ kind: "scalar", name: "boolean" }),
                  integer: null,
                  span: span(4),
                },
              ],
              terminator: { kind: "return", value: "result" },
            },
          ],
          source: main.span,
        },
      ],
      effects: [],
      assets: [],
      initializerOrder: [],
    };

    const result = closeWholeProgram(semantic);
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected liveness closure to complete");
    const byValue = new Map(result.program.lifetimes.map((lifetime) => [lifetime.value, lifetime]));
    const truePositions = new Set(
      byValue.get("true-value")?.liveAt.map(({ block, operation }) => `${block}:${operation}`),
    );
    const falsePositions = new Set(
      byValue.get("false-value")?.liveAt.map(({ block, operation }) => `${block}:${operation}`),
    );
    expect([...truePositions].filter((position) => falsePositions.has(position))).toEqual([]);
  });
});
