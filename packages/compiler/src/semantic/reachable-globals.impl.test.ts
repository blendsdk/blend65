import { describe, expect, it } from "vitest";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type {
  ConvertOperation,
  MemoryReadOperation,
  SemanticGlobal,
  SemanticOperation,
  SemanticProgram,
} from "./operations.js";
import {
  BYTE,
  BYTE_PAIR,
  WORD,
  VOID,
  selectedProfile,
  semanticBlock,
  semanticFunction,
  sourceBinding,
  sourceSpan,
  wholeProgramFor,
} from "../machine/lowering-test-support.js";
import { retainObservableGlobals } from "./reachable-globals.js";

/** Make a private declaration whose absent initializer permits removal. */
function data(start = 100, overrides: Partial<SemanticGlobal> = {}): SemanticGlobal {
  return {
    id: sourceBinding(start),
    storage: "module",
    exported: false,
    type: BYTE,
    initialBytes: null,
    runtimeInitialBytes: null,
    entry: null,
    blocks: [],
    source: sourceSpan(start),
    ...overrides,
  };
}

/** Isolate selection from unrelated target analysis with one reached straight-line body. */
function program(operations: readonly SemanticOperation[], globals = [data()]): SemanticProgram {
  const main = semanticFunction(0, "main", [], VOID, [
    semanticBlock("entry", operations, { kind: "return", value: null }),
  ]);
  return { ...wholeProgramFor([main]).semantic, globals };
}

/** Select with the normal cooperative allocation windows unless a case deliberately omits them. */
function select(input: SemanticProgram, windows = selectedProfile().storage): SemanticProgram {
  return retainObservableGlobals(input, new Set([bindingIdentityKey(input.main)]), windows);
}

/** A literal word followed by its exact ordered raw byte/word observer. */
function raw(address: bigint, width: 1 | 2 = 1): readonly SemanticOperation[] {
  return [
    {
      kind: "constant",
      result: "address",
      value: address,
      type: WORD,
      integer: null,
      span: sourceSpan(1),
    },
    read("address", width),
  ];
}

/** Observe an already evaluated address without granting it constant provenance. */
function read(address: string, width: 1 | 2 = 1): MemoryReadOperation {
  return {
    kind: "memory-read",
    result: "read",
    address,
    width,
    byteOrder: "low-first",
    volatile: true,
    type: width === 1 ? BYTE : WORD,
    integer: null,
    span: sourceSpan(2),
  };
}

/** A word conversion used to probe memoized definitions and cyclic malformed input. */
function convert(result: string, operand: string): ConvertOperation {
  return {
    kind: "convert",
    result,
    operand,
    conversion: "identity",
    type: WORD,
    integer: { width: 16, signed: false, wrap: true },
    span: sourceSpan(3),
  };
}

describe("observable global selection internals", () => {
  it("should remove only explicitly private unconstrained uninitialized module data", () => {
    const { exported: _visibility, ...unknown } = data(110);
    const globals = [
      data(),
      unknown,
      data(120, { exported: true }),
      data(130, { storage: "constant" }),
      data(140, { initialBytes: [0] }),
      data(150, { runtimeInitialBytes: [0] }),
      data(160, { zeropage: true }),
      data(170, { placement: { at: 0x3000 } }),
      data(180, {
        entry: "init",
        blocks: [semanticBlock("init", [], { kind: "return", value: null })],
      }),
    ];
    const input = program([], globals);
    const result = select(input);
    expect(result.globals).toEqual(globals.slice(1));
    expect(result.functions).toBe(input.functions);
    expect(input.globals).toHaveLength(9);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.globals)).toBe(true);
  });

  it("should preserve full identities rather than identical declaration names", () => {
    const first = data(100, { name: "same" });
    const other = data(110, {
      name: "same",
      id: { ...sourceBinding(100), sourceId: "other.blend" },
    });
    const input = program(
      [
        {
          kind: "load",
          result: "value",
          place: { root: other.id, path: [] },
          type: BYTE,
          integer: null,
          span: sourceSpan(1),
        },
      ],
      [first, other],
    );
    expect(select(input).globals).toEqual([other]);
  });

  it("should retain an escaped address even from a cold owner", () => {
    const input = program([]);
    const cold = semanticFunction(10, "cold", [], WORD, [
      semanticBlock(
        "cold",
        [
          {
            kind: "place-address",
            result: "address",
            place: { root: input.globals[0]!.id, path: [] },
            type: WORD,
            integer: null,
            span: sourceSpan(11),
          },
        ],
        { kind: "return", value: "address" },
      ),
    ]);
    const withCold = { ...input, functions: [...input.functions, cold] };
    expect(select(withCold)).toBe(withCold);
  });

  it.each(["aggregate", "call", "indirect-call"] as const)(
    "should retain a private aggregate destination for %s",
    (kind) => {
      const destination = data(100, { type: BYTE_PAIR });
      const place = { root: destination.id, rootType: BYTE_PAIR, path: [] };
      const shared = { result: "value", type: BYTE_PAIR, span: sourceSpan(1) };
      const operation: SemanticOperation =
        kind === "aggregate"
          ? { ...shared, kind, elements: [], integer: null, destination: { kind: "place", place } }
          : kind === "call"
            ? {
                ...shared,
                kind,
                callee: sourceBinding(10),
                arguments: [],
                aggregateDestination: { kind: "place", place },
              }
            : {
                ...shared,
                kind,
                target: "target",
                arguments: [],
                signature: { kind: "function", parameters: [], returnType: BYTE_PAIR },
                aggregateDestination: { kind: "place", place },
              };
      const input = program([operation], [destination]);
      expect(select(input)).toBe(input);
    },
  );

  it("should inspect reached initializer observers without removing their target", () => {
    const initialized = data(110, {
      entry: "init",
      blocks: [
        semanticBlock("init", [raw(0xc000n)[0]!, raw(0xc000n)[1]!], {
          kind: "return",
          value: null,
        }),
      ],
    });
    const input = program([], [data(), initialized]);
    expect(select(input)).toBe(input);
  });

  it.each([
    [0x0001n, 2, true],
    [0xffffn, 2, false],
    [0xc000n, 1, true],
    [0xd020n, 2, false],
  ] as const)(
    "should classify raw footprint %s/%s with actual windows",
    (address, width, retain) => {
      const input = program(raw(address, width));
      expect(select(input).globals).toHaveLength(retain ? 1 : 0);
      if (retain) expect(select(input)).toBe(input);
    },
  );

  it("should retain unknown raw observers or missing allocation facts", () => {
    const operations = raw(0xd020n).slice(1);
    const unknown = program(operations);
    expect(select(unknown)).toBe(unknown);
    const known = program(raw(0xd020n));
    expect(retainObservableGlobals(known, new Set([bindingIdentityKey(known.main)]))).toBe(known);
  });

  it("should test wrapped bytes against supplied zero-page windows", () => {
    const input = program(raw(0xffffn, 2));
    expect(select(input, { zeroPage: [{ start: 0, end: 0 }], ram: [] })).toBe(input);
  });

  it("should preserve data for unknown capabilities and overlapping fixed device effects", () => {
    const operation: SemanticOperation = {
      kind: "platform",
      result: null,
      capability: "c64.future.opaque",
      arguments: [],
      type: VOID,
      effect: "ordered-wait",
      span: sourceSpan(1),
    };
    const opaque = program([operation]);
    expect(select(opaque)).toBe(opaque);
    const known = program([{ ...operation, capability: "c64.video.waitNextFrame" }]);
    expect(select(known).globals).toEqual([]);
    expect(
      select(known, { ...selectedProfile().storage, ram: [{ start: 0xd000, end: 0xd02e }] }),
    ).toBe(known);
    expect(select(known, { zeroPage: [], ram: [] })).toBe(known);
  });

  it("should retain unknown indexed local/borrowed places but omit data for proved in-object paths", () => {
    const load: SemanticOperation = {
      kind: "load",
      result: "value",
      type: BYTE,
      integer: null,
      place: {
        root: sourceBinding(500),
        rootType: BYTE_PAIR,
        path: [{ kind: "index", value: "ordinal" }],
      },
      span: sourceSpan(1),
    };
    const unknown = program([load]);
    expect(select(unknown)).toBe(unknown);
    const inBounds = program([
      {
        kind: "constant",
        result: "ordinal",
        value: 1n,
        type: WORD,
        integer: null,
        span: sourceSpan(2),
      },
      load,
    ]);
    expect(select(inBounds).globals).toEqual([]);
    const outside = program([
      {
        kind: "constant",
        result: "ordinal",
        value: 2n,
        type: WORD,
        integer: null,
        span: sourceSpan(2),
      },
      load,
    ]);
    expect(select(outside)).toBe(outside);
  });

  it("should not turn cyclic or non-integer conversions into an invented address", () => {
    const observer = raw(0xd020n).slice(1);
    const cyclic = program([convert("address", "other"), convert("other", "address"), ...observer]);
    expect(select(cyclic)).toBe(cyclic);
    const untyped = program([
      raw(0xd020n)[0]!,
      { ...convert("next", "address"), integer: null },
      read("next"),
    ]);
    expect(select(untyped)).toBe(untyped);
  });
});
