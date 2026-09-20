import { describe, expect, it } from "vitest";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import type { SemanticBlock, SemanticFunction } from "../semantic/operations.js";
import type { ValueLifetime, WholeProgram } from "../semantic/whole-program.js";
import { allocateStorage } from "./allocate.js";
import { closeStorage } from "./closure.js";
import { buildInterference } from "./interference.js";
import type { StorageInventory, StorageProfile, StorageRequest } from "./storage-types.js";

const BYTE: SemanticType = Object.freeze({ kind: "scalar", name: "byte" });
const WORD: SemanticType = Object.freeze({ kind: "scalar", name: "word" });
const VOID: SemanticType = Object.freeze({ kind: "scalar", name: "void" });

function span(start: number): SourceSpan {
  return Object.freeze({ sourceId: "src/closure.blend", start, end: start + 1 });
}

function binding(start: number): BindingId {
  return Object.freeze({ sourceId: "src/closure.blend", span: span(start) });
}

function semanticFunction(id: BindingId, blocks: readonly SemanticBlock[]): SemanticFunction {
  return Object.freeze({
    id,
    parameters: Object.freeze([]),
    result: VOID,
    entry: blocks[0]!.id,
    blocks,
    source: id.span,
  });
}

function lifetime(
  fn: BindingId,
  value: string,
  blockId: string,
  definition: number,
  liveAt: readonly { readonly block: string; readonly operation: number }[],
): ValueLifetime {
  return Object.freeze({
    function: fn,
    value,
    definition: Object.freeze({ block: blockId, operation: definition }),
    liveAt: Object.freeze(liveAt),
    callsCrossed: Object.freeze([]),
  });
}

function program(fn: SemanticFunction, lifetimes: readonly ValueLifetime[]): WholeProgram {
  return Object.freeze({
    semantic: Object.freeze({
      main: fn.id,
      globals: Object.freeze([]),
      functions: Object.freeze([fn]),
      assets: Object.freeze([]),
      initializerOrder: Object.freeze([]),
    }),
    roots: Object.freeze([
      Object.freeze({ kind: "startup" as const }),
      Object.freeze({ kind: "main" as const, function: fn.id }),
    ]),
    callGraph: Object.freeze([Object.freeze({ function: fn.id, callees: Object.freeze([]) })]),
    effects: Object.freeze([]),
    lifetimes: Object.freeze(lifetimes),
    reachableFunctions: Object.freeze([fn.id]),
    reachableAssets: Object.freeze([]),
  });
}

function request(
  id: string,
  storageClass: StorageRequest["storageClass"],
  type: SemanticType,
  bytes: number,
  region: StorageRequest["region"],
  valueLifetime: ValueLifetime,
): StorageRequest {
  return Object.freeze({
    id,
    storageClass,
    owner: valueLifetime.function,
    binding: null,
    value: valueLifetime.value,
    type,
    bytes,
    alignment: 1,
    region,
    source: valueLifetime.function.span,
    reason: "Explicit storage requirement",
    lifetime: valueLifetime,
  });
}

function inventory(whole: WholeProgram, requests: readonly StorageRequest[]): StorageInventory {
  return Object.freeze({
    program: whole,
    requests: Object.freeze(requests),
    results: Object.freeze([]),
  });
}

function memoryProfile(start: number, end: number): StorageProfile {
  return Object.freeze({
    zeroPage: Object.freeze([]),
    ram: Object.freeze([Object.freeze({ start, end })]),
  });
}

function zeroPageProfile(start: number, end: number): StorageProfile {
  return Object.freeze({
    zeroPage: Object.freeze([Object.freeze({ start, end })]),
    ram: Object.freeze([]),
  });
}

describe("storage interference and placement", () => {
  // Values used on exclusive branch arms may share a home, but values live together may not.
  it("should overlay mutually exclusive siblings while separating overlapping lifetimes", () => {
    const fnId = binding(1);
    const blocks: readonly SemanticBlock[] = [
      Object.freeze({
        id: "entry",
        operations: Object.freeze([]),
        terminator: Object.freeze({
          kind: "branch" as const,
          condition: "condition",
          whenTrue: "left",
          whenFalse: "right",
        }),
      }),
      Object.freeze({
        id: "left",
        operations: Object.freeze([]),
        terminator: Object.freeze({ kind: "jump" as const, target: "join" }),
      }),
      Object.freeze({
        id: "right",
        operations: Object.freeze([]),
        terminator: Object.freeze({ kind: "jump" as const, target: "join" }),
      }),
      Object.freeze({
        id: "join",
        operations: Object.freeze([]),
        terminator: Object.freeze({ kind: "return" as const, value: null }),
      }),
    ];
    const whole = program(semanticFunction(fnId, blocks), []);
    const left = lifetime(fnId, "left-value", "left", 0, [{ block: "left", operation: 1 }]);
    const right = lifetime(fnId, "right-value", "right", 0, [{ block: "right", operation: 1 }]);
    const overlapOne = lifetime(fnId, "overlap-one", "join", 0, [
      { block: "join", operation: 1 },
      { block: "join", operation: 2 },
    ]);
    const overlapTwo = lifetime(fnId, "overlap-two", "join", 1, [{ block: "join", operation: 2 }]);
    const storage = inventory(whole, [
      request("left", "temporary", BYTE, 1, "ram", left),
      request("right", "temporary", BYTE, 1, "ram", right),
      request("overlap-one", "temporary", BYTE, 1, "ram", overlapOne),
      request("overlap-two", "temporary", BYTE, 1, "ram", overlapTwo),
    ]);
    const allocation = allocateStorage(
      storage,
      buildInterference(storage),
      memoryProfile(0x2000, 0x2003),
    );

    expect(allocation.kind).toBe("complete");
    if (allocation.kind !== "complete") throw new Error("Expected a complete placement");
    const address = (requestId: string) => {
      const placed = allocation.placement.homes.find((home) => home.requestId === requestId);
      expect(placed).toBeDefined();
      if (placed === undefined) throw new Error(`Missing memory home for ${requestId}`);
      return placed.address;
    };

    expect(address("left")).toBe(address("right"));
    expect(address("overlap-one")).not.toBe(address("overlap-two"));
  });

  // A required two-byte zero-page pointer may end at $ff but must never wrap to $00.
  it("should place a required two-byte zero-page pointer at $fe or reject an isolated $ff byte", () => {
    const fnId = binding(20);
    const entry: SemanticBlock = Object.freeze({
      id: "pointer:entry",
      operations: Object.freeze([]),
      terminator: Object.freeze({ kind: "return" as const, value: null }),
    });
    const whole = program(semanticFunction(fnId, [entry]), []);
    const pointerLifetime = lifetime(fnId, "pointer", entry.id, 0, [
      { block: entry.id, operation: 1 },
    ]);
    const storage = inventory(whole, [
      request("pointer", "pointer", WORD, 2, "zero-page-required", pointerLifetime),
    ]);
    const interference = buildInterference(storage);

    const valid = allocateStorage(storage, interference, zeroPageProfile(0xfe, 0xff));
    expect(valid.kind).toBe("complete");
    if (valid.kind !== "complete") throw new Error("Expected the $fe-$ff pair to fit");
    expect(valid.placement.homes).toHaveLength(1);
    expect(valid.placement.homes[0]).toMatchObject({
      requestId: "pointer",
      region: "zero-page",
      address: 0xfe,
      bytes: 2,
    });

    const invalid = allocateStorage(storage, interference, zeroPageProfile(0xff, 0xff));
    expect(invalid.kind).toBe("error");
    expect(invalid).not.toHaveProperty("placement");
  });
});

describe("storage closure", () => {
  // A finite set of alternating late demands must stop as nonconvergent without a certificate.
  it("should fail deterministically without a certificate when finite demand never converges", () => {
    const fnId = binding(40);
    const entry: SemanticBlock = Object.freeze({
      id: "closure:entry",
      operations: Object.freeze([]),
      terminator: Object.freeze({ kind: "return" as const, value: null }),
    });
    const whole = program(semanticFunction(fnId, [entry]), []);
    const seedLifetime = lifetime(fnId, "late", entry.id, 0, [{ block: entry.id, operation: 1 }]);
    const seed = request("late", "helper-scratch", BYTE, 1, "ram", seedLifetime);
    const initial = inventory(whole, [seed]);
    const discover = (_placement: object, round: number): readonly StorageRequest[] =>
      Object.freeze([Object.freeze({ ...seed, bytes: round % 2 === 0 ? 2 : 1 })]);
    const profile = memoryProfile(0x3000, 0x3fff);

    const first = closeStorage(initial, profile, discover);
    const second = closeStorage(initial, profile, discover);

    expect(first).toEqual(second);
    expect(first).toMatchObject({ kind: "error", reason: "nonconvergent" });
    expect(first).not.toHaveProperty("certificate");
  });
});
