import { describe, expect, it } from "vitest";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import type { SemanticBlock, SemanticFunction } from "../semantic/operations.js";
import type { ValueLifetime, WholeProgram } from "../semantic/whole-program.js";
import { allocateStorage } from "./allocate.js";
import { buildInterference } from "./interference.js";
import { inventoryStorage } from "./inventory.js";
import type { StorageInventory, StorageProfile, StorageRequest } from "./storage-types.js";

const BYTE: SemanticType = Object.freeze({ kind: "scalar", name: "byte" });

function binding(start: number): BindingId {
  const span = Object.freeze({ sourceId: "src/sfa-impl.blend", start, end: start + 1 });
  return Object.freeze({ sourceId: span.sourceId, span });
}

function lifetime(owner: BindingId, value: string, liveAt: readonly number[]): ValueLifetime {
  return Object.freeze({
    function: owner,
    value,
    definition: Object.freeze({ block: "entry", operation: 0 }),
    liveAt: Object.freeze(liveAt.map((operation) => Object.freeze({ block: "entry", operation }))),
    callsCrossed: Object.freeze([]),
  });
}

function request(
  owner: BindingId,
  id: string,
  bytes: number,
  alignment: number,
  region: StorageRequest["region"],
  liveAt: readonly number[],
): StorageRequest {
  return Object.freeze({
    id,
    storageClass: region === "ram" ? "temporary" : "pointer",
    owner,
    binding: null,
    value: id,
    type: BYTE,
    bytes,
    alignment,
    region,
    lifetime: lifetime(owner, id, liveAt),
    source: owner.span,
    reason: "Focused allocator case",
  });
}

function program(owner: BindingId): WholeProgram {
  const block: SemanticBlock = Object.freeze({
    id: "entry",
    operations: Object.freeze([]),
    terminator: Object.freeze({ kind: "return", value: null }),
  });
  const fn: SemanticFunction = Object.freeze({
    id: owner,
    parameters: Object.freeze([]),
    result: Object.freeze({ kind: "scalar", name: "void" }),
    entry: block.id,
    blocks: Object.freeze([block]),
    source: owner.span,
  });
  return Object.freeze({
    semantic: Object.freeze({
      main: owner,
      globals: Object.freeze([]),
      functions: Object.freeze([fn]),
      assets: Object.freeze([]),
      initializerOrder: Object.freeze([]),
    }),
    roots: Object.freeze([
      Object.freeze({ kind: "startup" as const }),
      Object.freeze({ kind: "main" as const, function: owner }),
    ]),
    callGraph: Object.freeze([Object.freeze({ function: owner, callees: Object.freeze([]) })]),
    effects: Object.freeze([]),
    lifetimes: Object.freeze([]),
    reachableFunctions: Object.freeze([owner]),
    reachableAssets: Object.freeze([]),
  });
}

function inventory(owner: BindingId, requests: readonly StorageRequest[]): StorageInventory {
  return Object.freeze({
    program: program(owner),
    requests: Object.freeze(requests),
    results: Object.freeze([]),
  });
}

describe("static storage allocator implementation", () => {
  it("keeps a live aggregate snapshot separate and reuses its bytes after its lifetime", () => {
    const owner = binding(100);
    const array: SemanticType = Object.freeze({
      kind: "array",
      element: BYTE,
      length: 300,
      size: 300,
    });
    const snapshot: StorageRequest = Object.freeze({
      ...request(owner, "snapshot", 300, 1, "ram", [1]),
      type: array,
    });
    const concurrent = request(owner, "concurrent", 2, 1, "ram", [1]);
    const later: StorageRequest = Object.freeze({
      ...request(owner, "later", 300, 1, "ram", [2]),
      type: array,
    });
    const storage = inventory(owner, [snapshot, concurrent, later]);
    const conflicts = buildInterference(storage);
    expect(conflicts).toContainEqual({ left: "concurrent", right: "snapshot", reason: "lifetime" });
    expect(conflicts.some(({ left, right }) => left === "later" && right === "snapshot")).toBe(
      false,
    );
    const result = allocateStorage(
      storage,
      conflicts,
      Object.freeze({
        zeroPage: Object.freeze([]),
        ram: Object.freeze([Object.freeze({ start: 0x6000, end: 0x612d })]),
      }),
    );
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected aggregate snapshot allocation");
    const homes = new Map(result.placement.homes.map((home) => [home.requestId, home]));
    const snapshotHome = homes.get(snapshot.id)!;
    const concurrentHome = homes.get(concurrent.id)!;
    const laterHome = homes.get(later.id)!;
    expect(
      snapshotHome.address + snapshotHome.bytes <= concurrentHome.address ||
        concurrentHome.address + concurrentHome.bytes <= snapshotHome.address,
    ).toBe(true);
    expect(laterHome.address).toBe(snapshotHome.address);
  });

  it("keeps placement deterministic across input order and aligns wider requests", () => {
    const owner = binding(1);
    const wide = request(owner, "wide", 2, 2, "ram", [1]);
    const narrow = request(owner, "narrow", 1, 1, "ram", [1]);
    const profile: StorageProfile = Object.freeze({
      zeroPage: Object.freeze([]),
      ram: Object.freeze([
        Object.freeze({ start: 0x2005, end: 0x2008 }),
        Object.freeze({ start: 0x2000, end: 0x2004 }),
      ]),
    });
    const first = inventory(owner, [narrow, wide]);
    const second = inventory(owner, [wide, narrow]);

    const firstResult = allocateStorage(first, buildInterference(first), profile);
    const secondResult = allocateStorage(second, buildInterference(second), profile);

    expect(firstResult).toEqual(secondResult);
    expect(firstResult).toMatchObject({
      kind: "complete",
      placement: {
        homes: [
          { requestId: "narrow", address: 0x2002 },
          { requestId: "wide", address: 0x2000 },
        ],
      },
    });
  });

  it("falls back for preferred zero page and returns no partial placement on exhaustion", () => {
    const owner = binding(20);
    const preferred = request(owner, "preferred", 2, 1, "zero-page-preferred", [1]);
    const required = request(owner, "required", 1, 1, "zero-page-required", [1]);
    const storage = inventory(owner, [preferred, required]);
    const profile: StorageProfile = Object.freeze({
      zeroPage: Object.freeze([Object.freeze({ start: 0xfe, end: 0xfe })]),
      ram: Object.freeze([Object.freeze({ start: 0x3000, end: 0x3001 })]),
    });
    const result = allocateStorage(storage, buildInterference(storage), profile);

    expect(result).toMatchObject({
      kind: "complete",
      placement: {
        homes: [
          { requestId: "preferred", region: "ram", address: 0x3000 },
          { requestId: "required", region: "zero-page", address: 0xfe },
        ],
      },
    });

    const exhaustedProfile: StorageProfile = Object.freeze({
      zeroPage: Object.freeze([]),
      ram: Object.freeze([Object.freeze({ start: 0x3000, end: 0x3000 })]),
    });
    const exhausted = allocateStorage(storage, buildInterference(storage), exhaustedProfile);
    expect(exhausted).toEqual({ kind: "error", reason: "resource", requestId: "required" });
    expect(exhausted).not.toHaveProperty("placement");
  });

  it("backtracks when deterministic first-fit blocks a valid two-byte coloring", () => {
    const owner = binding(40);
    const storage = inventory(owner, [
      request(owner, "a", 1, 1, "ram", [1]),
      request(owner, "b", 1, 1, "ram", [2]),
      request(owner, "c", 1, 1, "ram", [3]),
      request(owner, "d", 1, 1, "ram", [4]),
    ]);
    const result = allocateStorage(
      storage,
      Object.freeze([
        Object.freeze({ left: "a", right: "c", reason: "lifetime" as const }),
        Object.freeze({ left: "b", right: "d", reason: "lifetime" as const }),
        Object.freeze({ left: "c", right: "d", reason: "lifetime" as const }),
      ]),
      Object.freeze({
        zeroPage: Object.freeze([]),
        ram: Object.freeze([Object.freeze({ start: 0x5000, end: 0x5001 })]),
      }),
    );

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected exact fallback placement");
    expect(new Set(result.placement.homes.map(({ address }) => address))).toEqual(
      new Set([0x5000, 0x5001]),
    );
  });

  it("rejects every malformed request before exact fallback can place it", () => {
    const owner = binding(50);
    const valid = request(owner, "a-valid", 1, 1, "ram", [1]);
    const blocking = request(owner, "b-blocking", 1, 1, "ram", [1]);
    const malformed = request(owner, "z-malformed", -1, 1, "ram", [2]);
    const storage = inventory(owner, [valid, blocking, malformed]);
    const result = allocateStorage(
      storage,
      buildInterference(storage),
      Object.freeze({
        zeroPage: Object.freeze([]),
        ram: Object.freeze([Object.freeze({ start: 0x6000, end: 0x6000 })]),
      }),
    );

    expect(result).toEqual({
      kind: "error",
      reason: "resource",
      requestId: "z-malformed",
    });
    expect(result).not.toHaveProperty("placement");
  });

  it("inventories call-crossing values owned by an executable initializer", () => {
    const main = binding(60);
    const global = binding(61);
    const callee = binding(62);
    const nestedCall = Object.freeze({
      sourceId: global.sourceId,
      start: 70,
      end: 71,
    });
    const whole = program(main);
    const initializerLifetime = Object.freeze({
      function: global,
      value: "outer",
      definition: Object.freeze({ block: "initializer", operation: 0 }),
      liveAt: Object.freeze([
        Object.freeze({ block: "initializer", operation: 1 }),
        Object.freeze({ block: "initializer", operation: 2 }),
      ]),
      callsCrossed: Object.freeze([nestedCall]),
    });
    const withInitializer: WholeProgram = Object.freeze({
      ...whole,
      semantic: Object.freeze({
        ...whole.semantic,
        globals: Object.freeze([
          Object.freeze({
            id: global,
            type: BYTE,
            entry: "initializer",
            blocks: Object.freeze([
              Object.freeze({
                id: "initializer",
                operations: Object.freeze([
                  Object.freeze({
                    kind: "constant" as const,
                    result: "outer",
                    type: BYTE,
                    integer: null,
                    value: 1n,
                    span: global.span,
                  }),
                  Object.freeze({
                    kind: "call" as const,
                    result: "inner",
                    callee,
                    arguments: Object.freeze([]),
                    type: BYTE,
                    span: nestedCall,
                  }),
                ]),
                terminator: Object.freeze({ kind: "return" as const, value: null }),
              }),
            ]),
            source: global.span,
          }),
        ]),
        initializerOrder: Object.freeze([global]),
      }),
      roots: Object.freeze([
        Object.freeze({ kind: "startup" as const }),
        Object.freeze({ kind: "initializer" as const, binding: global }),
        Object.freeze({ kind: "main" as const, function: main }),
      ]),
      initializers: Object.freeze([
        Object.freeze({
          binding: global,
          callees: Object.freeze([callee]),
          lifetimes: Object.freeze([initializerLifetime]),
        }),
      ]),
    });

    expect(inventoryStorage(withInitializer).requests).toMatchObject([
      { owner: global, value: "outer", storageClass: "argument-stage" },
    ]);
  });

  it("does not allocate an unused aggregate copy for a borrowed call argument", () => {
    const owner = binding(80);
    const data = binding(81);
    const callee = binding(82);
    const array: SemanticType = Object.freeze({ kind: "array", element: BYTE, length: 2, size: 2 });
    const callSpan = binding(83).span;
    const block: SemanticBlock = Object.freeze({
      id: "entry",
      operations: Object.freeze([
        Object.freeze({
          kind: "load" as const,
          result: "borrow",
          place: Object.freeze({ root: data, rootType: array, path: Object.freeze([]) }),
          type: array,
          integer: null,
          span: data.span,
        }),
        Object.freeze({
          kind: "call" as const,
          result: null,
          callee,
          arguments: Object.freeze(["borrow"]),
          type: Object.freeze({ kind: "scalar" as const, name: "void" as const }),
          span: callSpan,
        }),
      ]),
      terminator: Object.freeze({ kind: "return" as const, value: null }),
    });
    const fn: SemanticFunction = Object.freeze({
      id: owner,
      parameters: Object.freeze([]),
      result: Object.freeze({ kind: "scalar", name: "void" }),
      entry: block.id,
      blocks: Object.freeze([block]),
      source: owner.span,
    });
    const base = program(owner);
    const whole: WholeProgram = Object.freeze({
      ...base,
      semantic: Object.freeze({ ...base.semantic, functions: Object.freeze([fn]) }),
      lifetimes: Object.freeze([
        Object.freeze({
          function: owner,
          value: "borrow",
          definition: Object.freeze({ block: "entry", operation: 0 }),
          liveAt: Object.freeze([Object.freeze({ block: "entry", operation: 1 })]),
          callsCrossed: Object.freeze([callSpan]),
        }),
      ]),
    });

    const requests = inventoryStorage(whole).requests;
    expect(requests).toEqual([
      expect.objectContaining({ storageClass: "local", binding: data, bytes: 2 }),
    ]);
  });
});
