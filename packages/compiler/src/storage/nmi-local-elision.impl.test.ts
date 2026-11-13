import { describe, expect, it } from "vitest";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type { SemanticFunction, SemanticOperation } from "../semantic/operations.js";
import {
  nmiLocalElisionKey,
  nmiRegisterOnlyLocals,
  nmiStackRetainedLocals,
} from "../semantic/nmi-register-locals.js";
import {
  BOOLEAN,
  BYTE,
  VOID,
  semanticBlock,
  semanticFunction,
  sourceBinding,
  sourceSpan,
  wholeProgramFor,
} from "../machine/lowering-test-support.js";
import { inventoryStorage } from "./inventory.js";

const local: BindingId = sourceBinding(200);
const destination: BindingId = sourceBinding(300);
const span = sourceSpan(100);

/** One direct volatile byte read. */
function read(result = "read"): SemanticOperation {
  return {
    kind: "platform",
    capability: "c64.cia2.readAndClearPendingSources",
    result,
    arguments: [],
    type: BYTE,
    effect: "volatile-read",
    span,
  };
}

/** One empty-path local store. */
function store(value: string, root = local): SemanticOperation {
  return {
    kind: "store",
    value,
    place: { root, path: [] },
    type: BYTE,
    span,
  };
}

/** One empty-path local load. */
function load(result: string, root = local): SemanticOperation {
  return {
    kind: "load",
    result,
    place: { root, path: [] },
    type: BYTE,
    integer: null,
    span,
  };
}

/** Build the canonical adjacent single-use shape. */
function handler(
  operations: readonly SemanticOperation[],
  extra?: readonly SemanticOperation[],
): SemanticFunction {
  const entry = semanticBlock("entry", [...operations, ...(extra ?? [])], {
    kind: "return",
    value: null,
  });
  return semanticFunction(100, "handler", [], VOID, [entry]);
}

const canonical = handler([read(), store("read"), load("sample"), store("sample", destination)]);
const excluded = new Set([bindingIdentityKey(destination)]);
const mainFunction = semanticFunction(400, "main", [], VOID, [
  semanticBlock("entry", [], { kind: "return", value: null }),
]);

describe("single-use NMI local proof", () => {
  it("finds the adjacent direct-read store/load pair", () => {
    const found = nmiRegisterOnlyLocals(canonical, excluded);
    expect([...found.keys()]).toEqual([bindingIdentityKey(local)]);
    expect(found.get(bindingIdentityKey(local))).toMatchObject({
      binding: local,
      block: "entry",
      storeIndex: 1,
      loadIndex: 2,
    });
  });

  it("finds the adjacent pair when the load is the right bitwise operand", () => {
    const constant: SemanticOperation = {
      kind: "constant",
      result: "two",
      value: 2n,
      type: BYTE,
      integer: null,
      span,
    };
    const masked: SemanticOperation = {
      kind: "binary",
      result: "masked",
      operator: "&",
      left: "two",
      right: "sample",
      type: BYTE,
      integer: null,
      span,
    };
    const zero: SemanticOperation = {
      kind: "constant",
      result: "zero",
      value: 0n,
      type: BYTE,
      integer: null,
      span,
    };
    const condition: SemanticOperation = {
      kind: "binary",
      result: "done",
      operator: "!=",
      left: "masked",
      right: "zero",
      type: BOOLEAN,
      integer: null,
      span,
    };
    const fn = handler([
      read(),
      store("read"),
      load("sample"),
      constant,
      masked,
      zero,
      condition,
      store("done", destination),
    ]);
    expect(nmiRegisterOnlyLocals(fn, excluded).has(bindingIdentityKey(local))).toBe(true);
  });

  it("rejects a local whose address is taken", () => {
    const addressTaken: SemanticOperation = {
      kind: "place-address",
      result: "address",
      place: { root: local, path: [] },
      type: BYTE,
      captureValue: false,
      span,
    };
    expect(
      nmiRegisterOnlyLocals(
        handler([
          read(),
          store("read"),
          addressTaken,
          load("sample"),
          store("sample", destination),
        ]),
        excluded,
      ).size,
    ).toBe(0);
  });

  it("rejects a second load", () => {
    expect(
      nmiRegisterOnlyLocals(
        handler([
          read(),
          store("read"),
          load("sample"),
          load("again"),
          store("sample", destination),
        ]),
        excluded,
      ).size,
    ).toBe(0);
  });

  it("rejects an interleaved second local between the store and load", () => {
    const second = sourceBinding(210);
    const interleaved = handler([
      read("readA"),
      store("readA"),
      read("readB"),
      store("readB", second),
      load("sampleB", second),
      store("sampleB", destination),
      load("sampleA"),
      store("sampleA", destination),
    ]);
    const found = nmiRegisterOnlyLocals(
      interleaved,
      new Set([...excluded, bindingIdentityKey(second)]),
    );
    expect(found.has(bindingIdentityKey(local))).toBe(false);
  });

  it("rejects a non-constant, non-read initializer", () => {
    const other = sourceBinding(220);
    expect(
      nmiRegisterOnlyLocals(
        handler([load("read", other), store("read"), load("sample"), store("sample", destination)]),
        excluded,
      ).size,
    ).toBe(0);
  });

  it("elides a single-use constant local", () => {
    const constant: SemanticOperation = {
      kind: "constant",
      result: "read",
      value: 7n,
      type: BYTE,
      integer: null,
      span,
    };
    const elided = nmiRegisterOnlyLocals(
      handler([constant, store("read"), load("sample"), store("sample", destination)]),
      excluded,
    );
    expect(elided.has(bindingIdentityKey(local))).toBe(true);
    expect(elided.get(bindingIdentityKey(local))?.loadIndex).toBe(2);
  });

  it("rejects a load in a different block", () => {
    const first = semanticBlock("entry", [read(), store("read")], { kind: "jump", target: "next" });
    const next = semanticBlock("next", [load("sample"), store("sample", destination)], {
      kind: "return",
      value: null,
    });
    const fn = semanticFunction(100, "handler", [], VOID, [first, next]);
    expect(nmiRegisterOnlyLocals(fn, excluded).size).toBe(0);
  });

  it("rejects a multi-use peer mask", () => {
    const mask = sourceBinding(220);
    const fn = handler([
      read(),
      store("read"),
      load("sample"),
      load("mask", mask),
      {
        kind: "binary",
        result: "masked",
        operator: "&",
        left: "sample",
        right: "mask",
        type: BYTE,
        integer: null,
        span,
      },
      {
        kind: "binary",
        result: "again",
        operator: "|",
        left: "masked",
        right: "mask",
        type: BYTE,
        integer: null,
        span,
      },
      store("again", destination),
    ]);
    expect(nmiRegisterOnlyLocals(fn, excluded).size).toBe(0);
  });
});

describe("NMI local inventory omission", () => {
  it("omits the proved local request and records the shared key", () => {
    const base = wholeProgramFor([mainFunction, canonical]);
    const program = Object.freeze({
      ...base,
      executionDomains: Object.freeze([
        Object.freeze({ function: canonical.id, domains: Object.freeze(["nmi" as const]) }),
      ]),
    });
    const inventory = inventoryStorage(program);
    expect(
      inventory.requests.some(
        (request) =>
          request.storageClass === "local" &&
          request.binding !== null &&
          bindingIdentityKey(request.binding) === bindingIdentityKey(local),
      ),
    ).toBe(false);
    expect(
      inventory.elidedLocalBindings?.has(
        nmiLocalElisionKey("nmi", undefined, bindingIdentityKey(local)),
      ),
    ).toBe(true);
  });

  it("keeps the local request outside the NMI domain", () => {
    const inventory = inventoryStorage(wholeProgramFor([mainFunction, canonical]));
    expect(
      inventory.requests.some(
        (request) =>
          request.storageClass === "local" &&
          request.binding !== null &&
          bindingIdentityKey(request.binding) === bindingIdentityKey(local),
      ),
    ).toBe(true);
    expect(inventory.elidedLocalBindings).toBeUndefined();
  });
});

/** One byte binary operation. */
function binary(
  result: string,
  operator: "&" | "|" | "==" | "!=",
  left: string,
  right: string,
): SemanticOperation {
  return { kind: "binary", result, operator, left, right, type: BYTE, integer: null, span };
}

/** One compile-time byte constant. */
function constant(result: string, value: bigint): SemanticOperation {
  return { kind: "constant", result, value, type: BYTE, integer: null, span };
}

/** One fixed-address byte memory read. */
function peek(result: string, address: string): SemanticOperation {
  return {
    kind: "memory-read",
    result,
    address,
    width: 1,
    byteOrder: "low-first",
    volatile: true,
    type: BYTE,
    integer: null,
    span,
  };
}

describe("bounded stack-retention proof", () => {
  it("retains a masked local shared by two consumers", () => {
    const found = nmiStackRetainedLocals(
      {
        ...handler([
          read(),
          constant("mask", 3n),
          binary("masked", "&", "read", "mask"),
          store("masked"),
          load("first"),
          store("first", destination),
          load("second"),
          store("second", sourceBinding(301)),
        ]),
        entryKind: "interrupt",
      },
      excluded,
    );
    expect([...found.keys()]).toEqual([bindingIdentityKey(local)]);
    expect(found.get(bindingIdentityKey(local))?.loadIndexes).toEqual([4, 6]);
  });

  it("retains nine bytes because the platform capacity is the whole-handler bound", () => {
    const operations: SemanticOperation[] = [];
    for (let index = 0; index < 9; index += 1) {
      const root = sourceBinding(500 + index);
      const address = `address${index}`;
      operations.push(
        constant(address, BigInt(0x0400 + index)),
        peek(`sample${index}`, address),
        store(`sample${index}`, root),
        load(`use${index}`, root),
        store(`use${index}`, destination),
      );
    }
    expect(
      nmiStackRetainedLocals({ ...handler(operations), entryKind: "interrupt" }, excluded).size,
    ).toBe(9);
  });

  it("retains a computed mask consumed as the right operand of a bitwise AND", () => {
    const maskLocal = sourceBinding(320);
    const globalMask = sourceBinding(330);
    const found = nmiStackRetainedLocals(
      {
        ...handler([
          load("outer", globalMask),
          constant("one", 1n),
          binary("m", "|", "outer", "one"),
          store("m", maskLocal),
          read("consumed"),
          load("mask", maskLocal),
          binary("masked", "&", "consumed", "mask"),
        ]),
        entryKind: "interrupt",
      },
      new Set([...excluded, bindingIdentityKey(globalMask)]),
    );
    expect(found.has(bindingIdentityKey(maskLocal))).toBe(true);
    expect(found.get(bindingIdentityKey(maskLocal))?.loadIndexes).toEqual([5]);
  });

  it("rejects a store that reaches a join without dominating it", () => {
    const extra = sourceBinding(620);
    const blocks = [
      semanticBlock("entry", [constant("cond", 1n), read("readP"), store("readP", local)], {
        kind: "branch",
        condition: "cond",
        whenTrue: "s",
        whenFalse: "j",
      }),
      semanticBlock(
        "s",
        [
          constant("cond2", 1n),
          read("readQ"),
          store("readQ", extra),
          load("useQ", extra),
          store("useQ", destination),
        ],
        {
          kind: "branch",
          condition: "cond2",
          whenTrue: "r",
          whenFalse: "j",
        },
      ),
      semanticBlock("r", [], { kind: "return", value: null }),
      semanticBlock("j", [constant("cond3", 1n), load("useP", local), store("useP", destination)], {
        kind: "jump",
        target: "j",
      }),
    ];
    const fn: SemanticFunction = {
      ...semanticFunction(100, "handler", [], VOID, blocks),
      entryKind: "interrupt",
    };
    expect(nmiStackRetainedLocals(fn, excluded).size).toBe(0);
  });

  it("retains a computed mask consumed as the left operand of a bitwise AND", () => {
    const maskLocal = sourceBinding(321);
    const globalMask = sourceBinding(331);
    const found = nmiStackRetainedLocals(
      {
        ...handler([
          load("outer", globalMask),
          constant("one", 1n),
          binary("m", "|", "outer", "one"),
          store("m", maskLocal),
          read("consumed"),
          load("mask", maskLocal),
          binary("masked", "&", "mask", "consumed"),
        ]),
        entryKind: "interrupt",
      },
      new Set([...excluded, bindingIdentityKey(globalMask)]),
    );
    expect(found.has(bindingIdentityKey(maskLocal))).toBe(true);
  });

  it("elides a nested zero-mask fold across an intervening volatile read", () => {
    const globalMask = sourceBinding(640);
    const fn: SemanticFunction = {
      ...handler([
        load("outer", globalMask),
        constant("zero", 0n),
        binary("zeroed", "&", "outer", "zero"),
        constant("one", 1n),
        binary("m", "|", "zeroed", "one"),
        store("m"),
        read("consumed"),
        load("sample"),
        binary("masked", "&", "consumed", "sample"),
        store("masked", destination),
      ]),
      entryKind: "interrupt",
    };
    const excludedWithMask = new Set([...excluded, bindingIdentityKey(globalMask)]);
    expect(nmiRegisterOnlyLocals(fn, excludedWithMask).has(bindingIdentityKey(local))).toBe(true);
    expect(nmiStackRetainedLocals(fn, excludedWithMask).size).toBe(0);
  });

  it("does not consume a top slot when a later non-consuming use needs it", () => {
    const helper = sourceBinding(700);
    const fn: SemanticFunction = {
      ...handler([
        read("readP"),
        store("readP", local),
        load("first", local),
        store("first", destination),
        { kind: "call", result: null, callee: helper, arguments: [], type: VOID, span },
        load("second", local),
        constant("zero", 0n),
        binary("combined", "|", "second", "zero"),
        store("combined", destination),
      ]),
      entryKind: "interrupt",
    };
    const found = nmiStackRetainedLocals(fn, excluded);
    expect(found.has(bindingIdentityKey(local))).toBe(true);
    expect(found.get(bindingIdentityKey(local))?.consumeResult).toBeNull();
  });

  it("elides a local initialized by a zero-mask bitwise expression", () => {
    const globalMask = sourceBinding(630);
    const fn: SemanticFunction = {
      ...handler([
        load("outer", globalMask),
        constant("zero", 0n),
        binary("m", "&", "outer", "zero"),
        store("m"),
        read("consumed"),
        load("sample"),
        binary("masked", "&", "consumed", "sample"),
        store("masked", destination),
      ]),
      entryKind: "interrupt",
    };
    const excludedWithMask = new Set([...excluded, bindingIdentityKey(globalMask)]);
    expect(nmiRegisterOnlyLocals(fn, excludedWithMask).has(bindingIdentityKey(local))).toBe(true);
    expect(nmiStackRetainedLocals(fn, excludedWithMask).size).toBe(0);
  });
});
