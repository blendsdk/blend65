import { describe, expect, it } from "vitest";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type {
  SemanticFunction,
  LoadOperation,
  StoreOperation,
  ConvertOperation,
  SemanticBlock,
  MemoryWriteOperation,
} from "./operations.js";
import { interruptWriteMayTouchHomes } from "./interrupt-address-facts.js";
import {
  interruptArgumentInputs,
  interruptArgumentFactsKey,
  interruptArgumentValue,
  advanceInterruptArgumentFacts,
  enterInterruptArgumentBlock,
  forgetInterruptArgumentHomes,
} from "./interrupt-argument-facts.js";

const span = { sourceId: "src/game.blend", start: 10, end: 20 };
const parameter = { sourceId: span.sourceId, span };
const root = bindingIdentityKey(parameter);
const roots = new Set([root]);
const byteType = { kind: "scalar", name: "byte" } as const;
const integer = { width: 8, signed: false, wrap: true } as const;
const literals = new Map([
  ["full", 0x1fn],
  ["partial", 1n],
  ["wide", 0x11fn],
]);

/** A real scalar parameter is copied by value; no concrete SFA address is invented. */
function body(): SemanticFunction {
  return {
    id: parameter,
    parameters: [{ id: parameter, type: byteType }],
    result: byteType,
    entry: "entry",
    blocks: [],
    source: span,
  };
}

/** Load snapshots are separate SSA values, even when they read the same home. */
function load(result: string): LoadOperation {
  return {
    kind: "load",
    result,
    type: byteType,
    integer,
    place: { root: parameter, path: [] },
    span,
  };
}

/** Only the root parameter copy changes, not the caller's evaluated argument. */
function store(value: string): StoreOperation {
  return { kind: "store", place: { root: parameter, path: [] }, value, type: byteType, span };
}

describe("exact interrupt argument facts", () => {
  it("should preserve home facts only for writes proved outside every selected storage window", () => {
    const operation: MemoryWriteOperation = {
      kind: "memory-write",
      address: "address",
      value: "value",
      width: 1,
      byteOrder: "low-first",
      volatile: true,
      span,
    };
    const windows = { ram: [{ start: 0x0801, end: 0xcfff }], zeroPage: [{ start: 2, end: 0x8f }] };
    expect(interruptWriteMayTouchHomes(operation, 0x0410n, windows)).toBe(false);
    expect(interruptWriteMayTouchHomes(operation, 0xdd0dn, windows)).toBe(false);
    expect(interruptWriteMayTouchHomes(operation, 0x0801n, windows)).toBe(true);
    expect(interruptWriteMayTouchHomes(operation, undefined, windows)).toBe(true);
    expect(interruptWriteMayTouchHomes(operation, 0xdd0dn)).toBe(true);
    expect(interruptWriteMayTouchHomes({ ...operation, width: 2 }, 1n, windows)).toBe(true);
    expect(
      interruptWriteMayTouchHomes(
        { ...operation, width: 2 },
        { kind: "owned-place", ranges: [{ start: 0x0400, end: 0x0800 }] },
        windows,
      ),
    ).toBe(true);
    expect(
      interruptWriteMayTouchHomes(
        { ...operation, width: 2 },
        { kind: "owned-place", ranges: [{ start: 0xffff, end: 0xffff }] },
        { ram: [{ start: 0, end: 0 }], zeroPage: [] },
      ),
    ).toBe(true);
  });
  it("should replace and invalidate parameter facts in operation order", () => {
    const input = interruptArgumentInputs(body(), [0x1fn]);
    const copied = advanceInterruptArgumentFacts(input, literals, load("before"), roots);
    const changed = advanceInterruptArgumentFacts(copied, literals, store("partial"), roots);
    const reloaded = advanceInterruptArgumentFacts(changed, literals, load("after"), roots);
    expect(interruptArgumentValue(reloaded, literals, "before")).toBe(0x1fn);
    expect(interruptArgumentValue(reloaded, literals, "after")).toBe(1n);
    expect(input.parameters.get(root)).toBe(0x1fn);
    const unknown = advanceInterruptArgumentFacts(reloaded, literals, store("unknown"), roots);
    expect(
      advanceInterruptArgumentFacts(unknown, literals, load("after"), roots).values.has("after"),
    ).toBe(false);
  });

  it("should preserve evaluated values but forget homes after possible alias effects", () => {
    const loaded = advanceInterruptArgumentFacts(
      interruptArgumentInputs(body(), [0x1fn]),
      literals,
      load("snapshot"),
      roots,
    );
    const forgotten = forgetInterruptArgumentHomes(loaded);
    expect(interruptArgumentValue(forgotten, literals, "snapshot")).toBe(0x1fn);
    expect(forgotten.parameters.size).toBe(0);
    const addressed = advanceInterruptArgumentFacts(
      loaded,
      literals,
      {
        kind: "place-address",
        result: "pointer",
        type: { kind: "scalar", name: "word" },
        integer: { ...integer, width: 16 },
        place: { root: parameter, path: [] },
        span,
      },
      roots,
    );
    expect(addressed.parameters.get(root)).toBe(0x1fn);
    expect(
      advanceInterruptArgumentFacts(addressed, literals, load("later"), roots).values.get("later"),
    ).toBe(0x1fn);
  });

  it.each([false, true])("should normalize exact conversions with signed=%s", (signed) => {
    const operation: ConvertOperation = {
      kind: "convert",
      result: "converted",
      operand: "wide",
      conversion: "truncate",
      type: byteType,
      integer: { ...integer, signed },
      span,
    };
    const result = advanceInterruptArgumentFacts(
      interruptArgumentInputs(body(), []),
      literals,
      operation,
      roots,
    );
    expect(result.values.get("converted")).toBe(0x1fn);
  });

  it("should use only the selected predecessor's merge operand", () => {
    const block: SemanticBlock = {
      id: "join",
      operations: [
        {
          kind: "merge",
          result: "mask",
          type: byteType,
          integer,
          span,
          incoming: [
            { block: "full-edge", value: "full" },
            { block: "partial-edge", value: "partial" },
          ],
        },
      ],
      terminator: { kind: "return", value: null },
    };
    const input = interruptArgumentInputs(body(), []);
    const full = enterInterruptArgumentBlock(input, literals, block, "full-edge");
    const partial = enterInterruptArgumentBlock(input, literals, block, "partial-edge");
    expect(full.values.get("mask")).toBe(0x1fn);
    expect(partial.values.get("mask")).toBe(1n);
    expect(interruptArgumentFactsKey(full)).not.toBe(interruptArgumentFactsKey(partial));
    expect(
      enterInterruptArgumentBlock(full, literals, block, "unknown-edge").values.has("mask"),
    ).toBe(false);
  });

  it("should canonicalize actual facts without enumerating unknown values", () => {
    const input = interruptArgumentInputs(body(), [undefined]);
    expect(input.parameters.size).toBe(0);
    const facts = {
      parameters: new Map([[root, 0x1fn]]),
      values: new Map([
        ["b", 1n],
        ["a", 2n],
      ]),
    };
    expect(interruptArgumentFactsKey(facts)).toBe(
      interruptArgumentFactsKey({ ...facts, values: new Map([...facts.values].reverse()) }),
    );
  });
});
