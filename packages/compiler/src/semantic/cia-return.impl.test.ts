import { describe, expect, it } from "vitest";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import {
  INITIAL_CIA_STATE,
  handlerCiaMutation,
  isFinalCiaRelease,
  joinCiaState,
  mutateCiaState,
  rawCia1Effect,
  restoreCiaState,
  sameCiaState,
  type CiaMutation,
  type CiaState,
  type IrqRoute,
} from "./cia-ownership-facts.js";
import { checkInterruptOwnership } from "./interrupt-ownership.js";
import type {
  MemoryWriteOperation,
  PlatformOperation,
  SemanticOperation,
  SemanticProgram,
} from "./operations.js";

const span = { sourceId: "cia-return.blend", start: 0, end: 1 };
const voidType = { kind: "scalar", name: "void" } as const;

/** Supply aligned route, handler and mutation frames without runtime device state. */
function state(routes: readonly IrqRoute[], mutations: readonly CiaMutation[]): CiaState {
  return {
    ...INITIAL_CIA_STATE,
    routes,
    mutations,
    handlerKeys: routes.map((_, index) => [`handler-${index}`]),
    maskKnown: true,
    possibleSources: 3,
  };
}

/** Model a volatile raw write whose address is resolved separately by literal propagation. */
function rawWrite(width: 1 | 2): MemoryWriteOperation {
  return {
    kind: "memory-write",
    address: "address",
    value: "value",
    width,
    byteOrder: "low-first",
    volatile: true,
    span,
  };
}

/** Retain the exact source-operation object used as the lowering proof key. */
function platform(capability: string): PlatformOperation {
  return {
    kind: "platform",
    result: null,
    capability,
    arguments: [],
    type: voidType,
    effect: "volatile-write",
    span,
  };
}

/** Construct a minimal already-lowered main for the device/vector ownership seam. */
function analyze(operations: readonly SemanticOperation[]) {
  const id = { sourceId: span.sourceId, span };
  const program: SemanticProgram = {
    main: id,
    globals: [],
    assets: [],
    initializerOrder: [],
    functions: [
      {
        id,
        parameters: [],
        result: voidType,
        entry: "entry",
        source: span,
        blocks: [{ id: "entry", operations, terminator: { kind: "return", value: null } }],
      },
    ],
  };
  return checkInterruptOwnership(program, new Set([bindingIdentityKey(id)]), new Map());
}

describe("CIA1 per-route return facts", () => {
  it("should charge a mutation only to its current route without mutating the input", () => {
    const before = state(["exclusive", "exclusive"], ["typed", "clean"]);
    const after = mutateCiaState(before, "raw");
    expect(after.mutations).toEqual(["typed", "raw"]);
    expect(before.mutations).toEqual(["typed", "clean"]);
    expect(restoreCiaState(after)).toBeNull();
  });

  it("should pop a clean inner route and then establish the stock Timer A mask", () => {
    const before = state(["exclusive", "exclusive"], ["typed", "clean"]);
    expect(isFinalCiaRelease(before)).toBe(false);
    const inner = restoreCiaState(before);
    expect(inner).toMatchObject({
      routes: ["exclusive"],
      mutations: ["typed"],
      possibleSources: 3,
    });
    if (inner === null) throw new Error("Clean inner route must restore");
    expect(isFinalCiaRelease(inner)).toBe(true);
    expect(restoreCiaState(inner)).toMatchObject({
      routes: [],
      handlerKeys: [],
      mutations: [],
      maskKnown: true,
      possibleSources: 1,
      irqMayRun: true,
    });
  });

  it.each(["clean", "typed"] as const)(
    "should reject a nonstock final predecessor even with %s effects",
    (mutation) => {
      expect(
        restoreCiaState({ ...state(["exclusive"], [mutation]), stockPredecessor: false }),
      ).toBeNull();
    },
  );

  it("should leave clean chaining vector-only without establishing a stock mask", () => {
    const before = { ...state(["chained"], ["clean"]), maskKnown: false, possibleSources: 0x1f };
    expect(isFinalCiaRelease(before)).toBe(false);
    expect(restoreCiaState(before)).toMatchObject({
      routes: [],
      maskKnown: false,
      possibleSources: 0x1f,
    });
  });

  it("should join mutation, source, handler and predecessor facts conservatively", () => {
    const left = {
      ...state(["exclusive"], ["typed"]),
      handlerKeys: [["a"]],
      irqMayRun: false,
      possibleSources: 1,
    };
    const right = {
      ...state(["exclusive"], ["raw"]),
      handlerKeys: [["b"]],
      maskKnown: false,
      possibleSources: 2,
      stockPredecessor: false,
    };
    const joined = joinCiaState(left, right);
    expect(joined).toMatchObject({
      mutations: ["raw"],
      handlerKeys: [["a", "b"]],
      irqMayRun: true,
      maskKnown: false,
      possibleSources: 3,
      stockPredecessor: false,
    });
    if (joined === null) throw new Error("Equal routes must join");
    expect(sameCiaState(joined, { ...joined })).toBe(true);
    expect(sameCiaState(joined, { ...joined, stockPredecessor: true })).toBe(false);
    expect(sameCiaState(joined, { ...joined, mutations: ["typed"] })).toBe(false);
    expect(restoreCiaState(joined)).toBeNull();
    expect(joinCiaState(left, state([], []))).toBeNull();
    expect(joinCiaState(left, state(["chained"], ["clean"]))).toBeNull();
  });

  it("should include only selected handler summaries and retain raw dominance", () => {
    const typed = new Set(["typed-handler"]);
    const raw = new Set(["raw-helper"]);
    expect(handlerCiaMutation(["other"], typed, raw)).toBe("clean");
    expect(handlerCiaMutation(["typed-handler"], typed, raw)).toBe("typed");
    expect(handlerCiaMutation(["typed-handler", "raw-helper"], typed, raw)).toBe("raw");
  });
});

describe("known raw CIA1 and selected-vector writes", () => {
  it.each([
    [0xdc03, 1, false, false, false],
    [0xdc04, 1, true, false, false],
    [0xdc14, 1, true, false, false],
    [0xdcfc, 2, true, true, false],
    [0xdcff, 2, true, false, false],
    [0x0313, 2, false, false, true],
    [0xffff, 2, false, false, true],
  ] as const)(
    "should classify both bytes at $%i with width %i",
    (address, width, dirty, icr, vector) => {
      expect(
        rawCia1Effect(
          rawWrite(width),
          new Map([["address", BigInt(address)]]),
          new Set([0x0314, 0x0315, 0]),
        ),
      ).toEqual({ dirty, icr, vector });
    },
  );

  it("should keep an opaque runtime address at the explicit caller-owned boundary", () => {
    expect(rawCia1Effect(rawWrite(2), new Map(), new Set([0x0314]))).toEqual({
      dirty: false,
      icr: false,
      vector: false,
    });
  });
});

describe("CIA1 proof propagation", () => {
  it("should retain only the final source restore identity across a clean inner pop", () => {
    const inner = platform("c64.system.restoreIRQ");
    const final = platform("c64.system.restoreIRQ");
    const result = analyze([
      { kind: "cpu-control", control: "asm_sei", span },
      platform("c64.system.setIRQExclusive"),
      platform("c64.cia1.writeTimerALatch"),
      platform("c64.system.setIRQExclusive"),
      inner,
      final,
    ]);
    expect(result.diagnostics).toEqual([]);
    expect(result.maxDepth.irq).toBe(2);
    expect([...result.cia1Handbacks]).toEqual([final]);
    expect(result.cia1Handbacks.has(inner)).toBe(false);
  });

  it("should expose no partial handback facts when later vector ownership fails", () => {
    const final = platform("c64.system.restoreIRQ");
    const result = analyze([
      { kind: "cpu-control", control: "asm_sei", span },
      platform("c64.system.setIRQExclusive"),
      final,
      platform("c64.system.setIRQExclusive"),
    ]);
    expect(result.diagnostics).toMatchObject([{ code: "E10278" }]);
    expect(result.cia1Handbacks.size).toBe(0);
  });

  it.each([false, true])(
    "should clear every handback proof after an out-of-lease raw write with prior release %s",
    (priorRelease) => {
      const earlier: readonly SemanticOperation[] = priorRelease
        ? [platform("c64.system.setIRQExclusive"), platform("c64.system.restoreIRQ")]
        : [];
      const result = analyze([
        { kind: "cpu-control", control: "asm_sei", span },
        ...earlier,
        {
          kind: "constant",
          result: "address",
          value: 0xdc0en,
          type: { kind: "scalar", name: "word" },
          integer: { width: 16, signed: false, wrap: true },
          span,
        },
        rawWrite(1),
        platform("c64.system.setIRQExclusive"),
        platform("c64.system.restoreIRQ"),
      ]);
      expect(result.diagnostics).toMatchObject([{ code: "E10278" }]);
      // A rejected later release also removes an earlier provisional proof.
      expect(result.cia1Handbacks.size).toBe(0);
    },
  );
});
