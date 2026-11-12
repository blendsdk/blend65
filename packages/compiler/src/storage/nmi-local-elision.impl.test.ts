import { describe, expect, it } from "vitest";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type { SemanticFunction, SemanticOperation } from "../semantic/operations.js";
import { nmiLocalElisionKey, nmiRegisterOnlyLocals } from "../semantic/nmi-register-locals.js";
import {
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

  it("rejects a non-direct initializer", () => {
    const constant: SemanticOperation = {
      kind: "constant",
      result: "read",
      value: 7n,
      type: BYTE,
      integer: null,
      span,
    };
    expect(
      nmiRegisterOnlyLocals(
        handler([constant, store("read"), load("sample"), store("sample", destination)]),
        excluded,
      ).size,
    ).toBe(0);
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
