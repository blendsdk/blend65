import { describe, expect, it } from "vitest";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import type { SemanticBlock, SemanticFunction, SemanticProgram } from "../semantic/operations.js";
import type { ValueLifetime, WholeProgram } from "../semantic/whole-program.js";
import { allocateStorage } from "./allocate.js";
import { buildInterference } from "./interference.js";
import { inventoryStorage } from "./inventory.js";
import type { StorageProfile } from "./storage-types.js";

const BYTE: SemanticType = Object.freeze({ kind: "scalar", name: "byte" });
const SBYTE: SemanticType = Object.freeze({ kind: "scalar", name: "sbyte" });
const WORD: SemanticType = Object.freeze({ kind: "scalar", name: "word" });
const SWORD: SemanticType = Object.freeze({ kind: "scalar", name: "sword" });
const BOOLEAN: SemanticType = Object.freeze({ kind: "scalar", name: "boolean" });
const VOID: SemanticType = Object.freeze({ kind: "scalar", name: "void" });

function span(start: number, sourceId = "src/storage.blend"): SourceSpan {
  return Object.freeze({ sourceId, start, end: start + 1 });
}

function binding(start: number, sourceId = "src/storage.blend"): BindingId {
  return Object.freeze({ sourceId, span: span(start, sourceId) });
}

function block(
  id: string,
  operations: SemanticBlock["operations"],
  terminator: SemanticBlock["terminator"] = Object.freeze({ kind: "return", value: null }),
): SemanticBlock {
  return Object.freeze({ id, operations: Object.freeze(operations), terminator });
}

function semanticFunction(
  id: BindingId,
  parameters: SemanticFunction["parameters"],
  result: SemanticType,
  blocks: readonly SemanticBlock[],
): SemanticFunction {
  return Object.freeze({ id, parameters, result, entry: blocks[0]!.id, blocks, source: id.span });
}

function lifetime(
  fn: BindingId,
  value: string,
  blockId: string,
  definition: number,
  liveAt: readonly number[],
  callsCrossed: readonly SourceSpan[] = [],
): ValueLifetime {
  return Object.freeze({
    function: fn,
    value,
    definition: Object.freeze({ block: blockId, operation: definition }),
    liveAt: Object.freeze(liveAt.map((operation) => Object.freeze({ block: blockId, operation }))),
    callsCrossed: Object.freeze(callsCrossed),
  });
}

function wholeProgram(
  functions: readonly SemanticFunction[],
  lifetimes: readonly ValueLifetime[],
  globals: SemanticProgram["globals"] = [],
  assets: SemanticProgram["assets"] = [],
): WholeProgram {
  const main = functions[0]!.id;
  const semantic: SemanticProgram = Object.freeze({
    main,
    globals: Object.freeze(globals),
    functions: Object.freeze(functions),
    assets: Object.freeze(assets),
    initializerOrder: Object.freeze([]),
  });
  return Object.freeze({
    semantic,
    roots: Object.freeze([
      Object.freeze({ kind: "startup" as const }),
      Object.freeze({ kind: "main" as const, function: main }),
    ]),
    callGraph: Object.freeze(
      functions.map((fn) => {
        const callees = new Map<string, BindingId>();
        for (const operation of fn.blocks.flatMap(({ operations }) => operations)) {
          if (operation.kind !== "call") continue;
          const key = `${operation.callee.sourceId}:${operation.callee.span.start}:${operation.callee.span.end}`;
          callees.set(key, operation.callee);
        }
        return Object.freeze({ function: fn.id, callees: Object.freeze([...callees.values()]) });
      }),
    ),
    effects: Object.freeze([]),
    lifetimes: Object.freeze(lifetimes),
    reachableFunctions: Object.freeze(functions.map(({ id }) => id)),
    reachableAssets: Object.freeze(assets.map(({ id }) => id)),
  });
}

function sameBinding(left: BindingId | null, right: BindingId): boolean {
  return (
    left !== null &&
    left.sourceId === right.sourceId &&
    left.span.start === right.span.start &&
    left.span.end === right.span.end
  );
}

function memoryProfile(start: number, end: number): StorageProfile {
  return Object.freeze({
    zeroPage: Object.freeze([]),
    ram: Object.freeze([Object.freeze({ start, end })]),
  });
}

function requestForValue(inventory: ReturnType<typeof inventoryStorage>, value: string) {
  const request = inventory.requests.find((candidate) => candidate.value === value);
  expect(request).toBeDefined();
  if (request === undefined) throw new Error(`Missing storage request for ${value}`);
  return request;
}

describe("static frame inventory", () => {
  // Parameters, locals and call-crossing staging values receive storage; transient values do not.
  it("should inventory only values that require function storage and do so deterministically", () => {
    const fn = binding(1);
    const parameter = binding(2);
    const local = binding(3);
    const gId = binding(4);
    const hId = binding(5);
    const gCall = span(15);
    const hCall = span(16);
    const entry = block("main:entry", [
      Object.freeze({
        kind: "constant" as const,
        result: "ordinary-immediate",
        type: BYTE,
        integer: null,
        value: 1n,
        span: span(10),
      }),
      Object.freeze({
        kind: "store" as const,
        place: Object.freeze({ root: local, path: Object.freeze([]) }),
        value: "ordinary-immediate",
        type: BYTE,
        span: span(11),
      }),
      Object.freeze({
        kind: "load" as const,
        result: "ordinary-load",
        type: BYTE,
        integer: null,
        place: Object.freeze({ root: local, path: Object.freeze([]) }),
        span: span(12),
      }),
      Object.freeze({
        kind: "constant" as const,
        result: "argument-staging",
        type: BYTE,
        integer: null,
        value: 2n,
        span: span(13),
      }),
      Object.freeze({
        kind: "call" as const,
        result: "return-staging",
        callee: gId,
        arguments: Object.freeze([]),
        type: BYTE,
        span: gCall,
      }),
      Object.freeze({
        kind: "call" as const,
        result: null,
        callee: hId,
        arguments: Object.freeze([]),
        type: VOID,
        span: hCall,
      }),
      Object.freeze({
        kind: "store" as const,
        place: Object.freeze({ root: local, path: Object.freeze([]) }),
        value: "argument-staging",
        type: BYTE,
        span: span(17),
      }),
      Object.freeze({
        kind: "store" as const,
        place: Object.freeze({ root: local, path: Object.freeze([]) }),
        value: "return-staging",
        type: BYTE,
        span: span(18),
      }),
    ]);
    const gBlock = block(
      "g:entry",
      [
        Object.freeze({
          kind: "constant" as const,
          result: "g-result",
          type: BYTE,
          integer: null,
          value: 3n,
          span: span(19),
        }),
      ],
      Object.freeze({ kind: "return", value: "g-result" }),
    );
    const program = wholeProgram(
      [
        semanticFunction(fn, [{ id: parameter, type: BYTE }], VOID, [entry]),
        semanticFunction(gId, [], BYTE, [gBlock]),
        semanticFunction(hId, [], VOID, [block("h:entry", [])]),
      ],
      [
        lifetime(fn, "ordinary-immediate", entry.id, 0, [1]),
        lifetime(fn, "ordinary-load", entry.id, 2, [3]),
        lifetime(fn, "argument-staging", entry.id, 3, [4, 5, 6], [gCall, hCall]),
        lifetime(fn, "return-staging", entry.id, 4, [5, 7], [hCall]),
        lifetime(gId, "g-result", gBlock.id, 0, [1]),
      ],
    );

    const first = inventoryStorage(program);
    const second = inventoryStorage(program);
    const interference = buildInterference(first);
    const allocation = allocateStorage(first, interference, memoryProfile(0x2000, 0x200f));

    expect(second).toEqual(first);
    expect(first.requests).toHaveLength(4);
    expect(new Set(first.requests.map(({ id }) => id)).size).toBe(4);
    expect(first.requests.filter(({ storageClass }) => storageClass === "parameter")).toHaveLength(
      1,
    );
    expect(first.requests.filter(({ storageClass }) => storageClass === "local")).toHaveLength(1);
    expect(
      first.requests.filter(({ storageClass }) => storageClass === "argument-stage"),
    ).toHaveLength(1);
    expect(
      first.requests.filter(({ storageClass }) => storageClass === "return-stage"),
    ).toHaveLength(1);
    expect(first.requests.filter(({ binding: id }) => sameBinding(id, parameter))).toHaveLength(1);
    expect(first.requests.filter(({ binding: id }) => sameBinding(id, local))).toHaveLength(1);
    expect(first.requests.find(({ value }) => value === "argument-staging")).toMatchObject({
      storageClass: "argument-stage",
      owner: fn,
    });
    expect(first.requests.find(({ value }) => value === "return-staging")).toMatchObject({
      storageClass: "return-stage",
      owner: fn,
    });
    expect(first.requests.some(({ value }) => value === "ordinary-immediate")).toBe(false);
    expect(first.requests.some(({ value }) => value === "ordinary-load")).toBe(false);
    expect(first.requests.some(({ value }) => value === "g-result")).toBe(false);
    expect(first.requests.every(({ lifetime: requestLifetime }) => requestLifetime !== null)).toBe(
      true,
    );
    expect(allocation.kind).toBe("complete");
    if (allocation.kind !== "complete") throw new Error("Expected a complete placement");
    expect(allocation.placement.homes).toHaveLength(first.requests.length);
    expect(new Set(allocation.placement.homes.map(({ requestId }) => requestId))).toEqual(
      new Set(first.requests.map(({ id }) => id)),
    );
  });

  // Scalar results use the fixed machine return registers and do not allocate a second RAM home.
  it("should bind byte-like results to A and word-like results to AX without RAM return requests", () => {
    const types = [BYTE, SBYTE, BOOLEAN, WORD, SWORD] as const;
    const resultLifetimes: ValueLifetime[] = [];
    const functions = types.map((type, index) => {
      const fn = binding(20 + index);
      const blockId = `return:${index}`;
      const result = `result:${index}`;
      resultLifetimes.push(lifetime(fn, result, blockId, 0, [1]));
      return semanticFunction(fn, [], type, [
        block(
          blockId,
          [
            Object.freeze({
              kind: "constant" as const,
              result,
              type,
              integer: null,
              value: type === BOOLEAN ? true : 0n,
              span: span(30 + index),
            }),
          ],
          Object.freeze({ kind: "return", value: result }),
        ),
      ]);
    });

    const inventory = inventoryStorage(wholeProgram(functions, resultLifetimes));

    expect(inventory.results.map(({ location }) => location)).toEqual([
      { kind: "a" },
      { kind: "a" },
      { kind: "a" },
      { kind: "ax" },
      { kind: "ax" },
    ]);
    expect(inventory.results.map(({ function: owner }) => owner)).toEqual(
      functions.map(({ id }) => id),
    );
    expect(inventory.requests).toEqual([]);
  });

  // Caller values staged before a nested call remain distinct from every callee-owned request.
  it("should protect outer argument staging across distinct and repeated nested callees", () => {
    const mainId = binding(40);
    const fId = binding(41);
    const gId = binding(42);
    const fFirst = binding(43);
    const fSecond = binding(44);
    const gParameter = binding(45);
    const gCall = span(50);
    const innerFCall = span(51);
    const mainBlock = block("nested:entry", [
      Object.freeze({
        kind: "constant" as const,
        result: "outer-for-g",
        type: BYTE,
        integer: null,
        value: 1n,
        span: span(46),
      }),
      Object.freeze({
        kind: "call" as const,
        result: "g-result",
        callee: gId,
        arguments: Object.freeze([]),
        type: BYTE,
        span: gCall,
      }),
      Object.freeze({
        kind: "call" as const,
        result: "first-result",
        callee: fId,
        arguments: Object.freeze(["outer-for-g", "g-result"]),
        type: BYTE,
        span: span(52),
      }),
      Object.freeze({
        kind: "constant" as const,
        result: "outer-for-f",
        type: BYTE,
        integer: null,
        value: 1n,
        span: span(53),
      }),
      Object.freeze({
        kind: "call" as const,
        result: "inner-f-result",
        callee: fId,
        arguments: Object.freeze([]),
        type: BYTE,
        span: innerFCall,
      }),
      Object.freeze({
        kind: "call" as const,
        result: "second-result",
        callee: fId,
        arguments: Object.freeze(["outer-for-f", "inner-f-result"]),
        type: BYTE,
        span: span(54),
      }),
    ]);
    const main = semanticFunction(mainId, [], VOID, [mainBlock]);
    const f = semanticFunction(
      fId,
      [
        { id: fFirst, type: BYTE },
        { id: fSecond, type: BYTE },
      ],
      BYTE,
      [block("f:entry", [])],
    );
    const g = semanticFunction(gId, [{ id: gParameter, type: BYTE }], BYTE, [block("g:entry", [])]);
    const program = wholeProgram(
      [main, f, g],
      [
        lifetime(mainId, "outer-for-g", mainBlock.id, 0, [1, 2], [gCall]),
        lifetime(mainId, "g-result", mainBlock.id, 1, [2]),
        lifetime(mainId, "first-result", mainBlock.id, 2, []),
        lifetime(mainId, "outer-for-f", mainBlock.id, 3, [4, 5], [innerFCall]),
        lifetime(mainId, "inner-f-result", mainBlock.id, 4, [5]),
        lifetime(mainId, "second-result", mainBlock.id, 5, []),
      ],
    );
    const inventory = inventoryStorage(program);
    const interference = buildInterference(inventory);
    const outerForG = requestForValue(inventory, "outer-for-g");
    const outerForF = requestForValue(inventory, "outer-for-f");
    const fParameters = inventory.requests.filter(
      ({ binding: id }) => sameBinding(id, fFirst) || sameBinding(id, fSecond),
    );
    const gParameters = inventory.requests.filter(({ binding: id }) => sameBinding(id, gParameter));
    const hasEdge = (left: string, right: string) =>
      interference.some(
        (edge) =>
          (edge.left === left && edge.right === right) ||
          (edge.left === right && edge.right === left),
      );

    expect(gParameters).toHaveLength(1);
    expect(fParameters).toHaveLength(2);
    expect(gParameters.every(({ id }) => hasEdge(outerForG.id, id))).toBe(true);
    expect(fParameters.every(({ id }) => hasEdge(outerForF.id, id))).toBe(true);
  });

  // Global data and resident assets stay outside function-execution storage allocation.
  it("should exclude globals and immutable assets from the static frame inventory", () => {
    const mainId = binding(70);
    const globalId = binding(71);
    const main = semanticFunction(mainId, [], VOID, [block("empty:entry", [])]);
    const program = wholeProgram(
      [main],
      [],
      [
        Object.freeze({
          id: globalId,
          type: BYTE,
          entry: null,
          blocks: Object.freeze([]),
          source: globalId.span,
        }),
      ],
      [
        Object.freeze({
          id: "asset:one",
          sourcePath: "assets/one.bin",
          sha256: "0".repeat(64),
          bytes: Object.freeze([1, 2, 3]),
        }),
      ],
    );

    expect(inventoryStorage(program).requests).toEqual([]);
  });
});
