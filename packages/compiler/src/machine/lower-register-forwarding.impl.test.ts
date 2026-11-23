import { describe, expect, it } from "vitest";
import type { SemanticOperation } from "../semantic/operations.js";
import { selectRegisterForwarding } from "./lower-register-forwarding.js";
import {
  BOOLEAN,
  BYTE,
  VOID,
  WORD,
  semanticBlock,
  sourceBinding,
  sourceSpan,
} from "./lowering-test-support.js";

const span = sourceSpan(901);

/** A fixed destination identity emits no setup between the producer and consumer. */
const destination: SemanticOperation = {
  kind: "constant",
  result: "destination",
  value: 0x0450n,
  type: WORD,
  integer: null,
  span,
};

/** Ordered source read used to test the selector independently from instruction generation. */
const read: Extract<SemanticOperation, { kind: "memory-read" }> = {
  kind: "memory-read",
  result: "value",
  address: "source",
  width: 1,
  byteOrder: "low-first",
  volatile: true,
  type: BYTE,
  integer: null,
  span,
};

/** The sole consumer can use A only when its destination needs no register-clobbering setup. */
const write: Extract<SemanticOperation, { kind: "memory-write" }> = {
  kind: "memory-write",
  address: "destination",
  value: "value",
  width: 1,
  byteOrder: "low-first",
  volatile: true,
  span,
};

/** Query one bounded selection window without inventing another lowering path. */
function forwarded(operations: readonly SemanticOperation[], singleUse = true): boolean {
  return selectRegisterForwarding(
    [semanticBlock("entry", operations, { kind: "return", value: null, span })],
    new Set(singleUse ? ["value"] : []),
  ).forwardedRegisterValues.has("value");
}

/** Keep branch and callee edges explicit when testing the adjacent read/Z proof. */
function terminalChoice(
  options: {
    zero?: bigint;
    barrier?: boolean;
    returns?: boolean;
    width?: 1 | 2;
    fixed?: boolean;
    singleUse?: boolean;
    producer?: SemanticOperation;
  } = {},
): boolean {
  const zero: SemanticOperation = {
    kind: "constant",
    result: "zero",
    value: options.zero ?? 0n,
    type: BYTE,
    integer: null,
    span,
  };
  const comparison: SemanticOperation = {
    kind: "binary",
    result: "selected",
    operator: "!=",
    left: "value",
    right: "zero",
    type: BOOLEAN,
    integer: null,
    span,
  };
  const call: SemanticOperation = {
    kind: "call",
    result: null,
    callee: sourceBinding(902),
    arguments: [],
    type: VOID,
    span,
  };
  const blocks = [
    semanticBlock(
      "entry",
      [
        ...(options.fixed === false ? [] : [{ ...destination, result: "source" }]),
        options.producer ?? {
          ...read,
          width: options.width ?? 1,
          type: options.width === 2 ? WORD : BYTE,
        },
        ...(options.barrier
          ? [{ kind: "cpu-control" as const, control: "asm_nop" as const, span }]
          : []),
        zero,
        comparison,
      ],
      { kind: "branch", condition: "selected", whenTrue: "true", whenFalse: "false" },
    ),
    semanticBlock("true", [call], { kind: "unreachable" }),
    semanticBlock(
      "false",
      [call],
      options.returns ? { kind: "return", value: null } : { kind: "unreachable" },
    ),
  ];
  return selectRegisterForwarding(
    blocks,
    new Set(options.singleUse === false ? [] : ["value"]),
  ).forwardedRegisterValues.has("value");
}

describe("adjacent register ownership", () => {
  it("should forward only an adjacent single-use CIA2 pending byte to a fixed byte store", () => {
    const pending: SemanticOperation = {
      kind: "platform",
      capability: "c64.cia2.readAndClearPendingSources",
      arguments: [],
      result: "value",
      type: BYTE,
      effect: "volatile-read",
      span,
    };
    expect(forwarded([pending, destination, write])).toBe(true);
    expect(forwarded([pending, destination, write], false)).toBe(false);
    expect(forwarded([pending, write])).toBe(false);
    expect(forwarded([pending, { ...read, result: "other" }, destination, write])).toBe(false);
    expect(forwarded([pending, destination, { ...write, width: 2 }])).toBe(false);
    expect(forwarded([pending, destination, { ...write, value: "other" }])).toBe(false);
    expect(
      forwarded([
        { ...pending, capability: "c64.cia2.readTimerACounter", type: WORD },
        destination,
        write,
      ]),
    ).toBe(false);
  });

  it("reuses the adjacent byte read for a closed terminal-choice zero test", () => {
    expect(terminalChoice()).toBe(true);
  });

  it("should preserve the fresh read/Z proof when a selected arm returns", () => {
    expect(terminalChoice({ returns: true })).toBe(true);
  });

  it.each(["&", "|", "^"] as const)(
    "should fuse only adjacent single-use byte %s operands",
    (operator) => {
      const second = { ...read, result: "second", address: "destination" };
      const binary: SemanticOperation = {
        kind: "binary",
        operator,
        result: "combined",
        left: "value",
        right: "second",
        type: BYTE,
        integer: null,
        span,
      };
      const select = (tail: readonly SemanticOperation[], values = ["value", "second"]) =>
        selectRegisterForwarding(
          [
            semanticBlock(
              "entry",
              [{ ...destination, result: "source" }, read, destination, second, ...tail],
              { kind: "return", value: "combined" },
            ),
          ],
          new Set(values),
        ).forwardedRegisterValues;
      expect([...select([binary])]).toEqual(["value", "second"]);
      expect(select([binary], ["second"]).has("value")).toBe(false);
      expect(select([{ ...binary, type: WORD }]).has("value")).toBe(false);
      expect(select([{ kind: "cpu-control", control: "asm_nop", span }, binary]).has("value")).toBe(
        false,
      );
    },
  );

  it("should forward an ordinary byte call only into its adjacent fixed byte store", () => {
    const call: Extract<SemanticOperation, { kind: "call" }> = {
      kind: "call",
      result: "value",
      callee: sourceBinding(903),
      arguments: [],
      type: BYTE,
      span,
    };
    expect(forwarded([call, destination, write])).toBe(true);
    expect(forwarded([call, destination, write], false)).toBe(false);
    expect(forwarded([call, write])).toBe(false);
    expect(forwarded([{ ...call, type: WORD }, destination, write])).toBe(false);
    expect(forwarded([call, { ...read, result: "other" }, destination, write])).toBe(false);
    expect(terminalChoice({ producer: call })).toBe(false);
  });

  it("should forward one adjacent byte to an unselected scalar home", () => {
    const store: Extract<SemanticOperation, { kind: "store" }> = {
      kind: "store",
      place: { root: sourceBinding(904), rootType: BYTE, path: [] },
      value: "value",
      type: BYTE,
      span,
    };
    const producers: readonly SemanticOperation[] = [
      read,
      {
        kind: "call",
        result: "value",
        callee: sourceBinding(903),
        arguments: [],
        type: BYTE,
        span,
      },
      {
        kind: "platform",
        capability: "c64.cia2.readAndClearPendingSources",
        arguments: [],
        result: "value",
        type: BYTE,
        effect: "volatile-read",
        span,
      },
    ];
    for (const producer of producers) {
      expect(forwarded([producer, store])).toBe(true);
      expect(forwarded([producer, destination, store])).toBe(true);
      expect(forwarded([producer, store], false)).toBe(false);
      expect(forwarded([producer, { ...read, result: "other" }, store])).toBe(false);
      expect(forwarded([producer, { ...store, type: WORD }])).toBe(false);
      expect(forwarded([producer, { ...store, value: "other" }])).toBe(false);
      for (const path of [
        [{ kind: "field", name: "member" }] as const,
        [{ kind: "index", value: "ordinal" }] as const,
      ])
        expect(forwarded([producer, { ...store, place: { ...store.place, path } }])).toBe(false);
    }
    expect(forwarded([{ ...read, width: 2, type: WORD }, store])).toBe(false);
  });

  it.each([
    ["nonzero comparison", { zero: 1n }],
    ["explicit intervening instruction", { barrier: true }],
    ["word read", { width: 2 as const }],
    ["dynamic source address", { fixed: false }],
    ["multiple read consumers", { singleUse: false }],
  ])("does not reuse the read/Z proof for %s", (_name, options) => {
    expect(terminalChoice(options)).toBe(false);
  });

  it("forwards a single byte through zero-instruction constant setup", () => {
    expect(forwarded([read, destination, write])).toBe(true);
  });

  it("keeps a value with more than one consumer stable", () => {
    expect(forwarded([read, destination, write], false)).toBe(false);
  });

  it("does not forward through another ordered read", () => {
    expect(forwarded([read, { ...read, result: "other" }, destination, write])).toBe(false);
  });

  it("does not forward into dynamic-address setup", () => {
    expect(forwarded([read, write])).toBe(false);
  });

  it("does not mistake a different consumed value for the loaded one", () => {
    expect(forwarded([read, destination, { ...write, value: "other" }])).toBe(false);
  });

  it("keeps both bytes of a word on the existing stable path", () => {
    expect(
      forwarded([{ ...read, width: 2, type: WORD }, destination, { ...write, width: 2 }]),
    ).toBe(false);
  });
});

/** The array whose element every case below reads. */
const DATA = sourceBinding(910);
/** Two unrelated destinations, so a store between the reads writes another object. */
const FIRST = sourceBinding(911);
const SECOND = sourceBinding(912);

/** A constant ordinal, which emits nothing and so does not break adjacency. */
function ordinal(result: string, value: bigint): SemanticOperation {
  return { kind: "constant", result, value, type: BYTE, integer: null, span };
}

/** One fixed element read of `DATA`. */
function elementLoad(result: string, index = "two"): SemanticOperation {
  return {
    kind: "load",
    result,
    place: { root: DATA, path: [{ kind: "index", value: index }] },
    type: BYTE,
    integer: null,
    span,
  };
}

/** One whole-binding store of an already-loaded byte. */
function byteStore(root: typeof FIRST, value: string): SemanticOperation {
  return { kind: "store", place: { root, path: [] }, value, type: BYTE, span };
}

/**
 * Whether the repeat of a fixed element read is selected to emit nothing.
 * The window is `load data[2]`, `store first`, `load data[2]` unless a case
 * replaces one of the three.
 */
function repeatOmitted(
  operations: readonly SemanticOperation[],
  singleUse: readonly string[] = ["again"],
): boolean {
  return selectRegisterForwarding(
    [semanticBlock("entry", operations, { kind: "return", value: null, span })],
    new Set(singleUse),
  ).repeatedFixedPlaceLoads.has("again");
}

const WINDOW: readonly SemanticOperation[] = [
  ordinal("two", 2n),
  elementLoad("value"),
  byteStore(FIRST, "value"),
  elementLoad("again"),
  byteStore(SECOND, "again"),
];

describe("a fixed element read twice across a store", () => {
  it("selects the repeat to emit nothing and consume the accumulator", () => {
    expect(repeatOmitted(WINDOW)).toBe(true);
  });

  it("selects a field read repeated the same way", () => {
    const field = (result: string): SemanticOperation => ({
      kind: "load",
      result,
      place: { root: DATA, path: [{ kind: "field", name: "y" }] },
      type: BYTE,
      integer: null,
      span,
    });
    expect(repeatOmitted([field("value"), byteStore(FIRST, "value"), field("again")])).toBe(true);
  });

  // A whole binding contributes no load of its own: its byte arrives at the head
  // of the consuming operation, and the repeat is removed there instead.
  it("refuses a whole-binding read, which is removed on the other path", () => {
    const whole = (result: string): SemanticOperation => ({
      kind: "load",
      result,
      place: { root: DATA, path: [] },
      type: BYTE,
      integer: null,
      span,
    });
    expect(repeatOmitted([whole("value"), byteStore(FIRST, "value"), whole("again")])).toBe(false);
  });

  // Without a constant ordinal the two reads may address different elements.
  it("refuses an element reached through a run-time ordinal", () => {
    expect(
      repeatOmitted([
        {
          kind: "load",
          result: "i",
          place: { root: SECOND, path: [] },
          type: BYTE,
          integer: null,
          span,
        },
        elementLoad("value", "i"),
        byteStore(FIRST, "value"),
        elementLoad("again", "i"),
      ]),
    ).toBe(false);
  });

  // The store has to write the very byte the earlier read produced; that is what
  // leaves the byte still in the accumulator.
  it("refuses a store of some other value", () => {
    expect(
      repeatOmitted([
        ordinal("two", 2n),
        elementLoad("value"),
        byteStore(FIRST, "elsewhere"),
        elementLoad("again"),
      ]),
    ).toBe(false);
  });

  // Writing the object being read ends the window.
  it("refuses a store into the array itself", () => {
    expect(
      repeatOmitted([
        ordinal("two", 2n),
        elementLoad("value"),
        {
          kind: "store",
          place: { root: DATA, path: [{ kind: "index", value: "two" }] },
          value: "value",
          type: BYTE,
          span,
        },
        elementLoad("again"),
      ]),
    ).toBe(false);
  });

  it("refuses a repeat that reads a different element", () => {
    expect(
      repeatOmitted([
        ordinal("two", 2n),
        ordinal("three", 3n),
        elementLoad("value"),
        byteStore(FIRST, "value"),
        elementLoad("again", "three"),
      ]),
    ).toBe(false);
  });

  it("refuses a repeat with more than one consumer", () => {
    expect(repeatOmitted(WINDOW, [])).toBe(false);
  });

  it("refuses a window with another instruction between the store and the repeat", () => {
    expect(
      repeatOmitted([
        ordinal("two", 2n),
        elementLoad("value"),
        byteStore(FIRST, "value"),
        {
          kind: "load",
          result: "other",
          place: { root: SECOND, path: [] },
          type: BYTE,
          integer: null,
          span,
        },
        elementLoad("again"),
      ]),
    ).toBe(false);
  });

  // No lowering produces a two-byte read whose store and repeat are single bytes,
  // so this window is built by hand. The barrier is kept because the width that
  // decides whether the byte lives in the accumulator alone is this read's own,
  // not the width of whatever is done with it afterwards.
  it("refuses a two-byte read even where everything around it is one byte", () => {
    expect(
      repeatOmitted([
        ordinal("two", 2n),
        { ...elementLoad("value"), type: WORD },
        byteStore(FIRST, "value"),
        elementLoad("again"),
      ]),
    ).toBe(false);
  });

  it("refuses a two-byte read, which does not live in the accumulator alone", () => {
    expect(
      repeatOmitted([
        ordinal("two", 2n),
        { ...elementLoad("value"), type: WORD },
        { ...byteStore(FIRST, "value"), type: WORD },
        { ...elementLoad("again"), type: WORD },
      ]),
    ).toBe(false);
  });
});
