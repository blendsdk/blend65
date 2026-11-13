import { describe, expect, it } from "vitest";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type { SemanticBlock, SemanticOperation } from "../semantic/operations.js";
import { nmiStackPlan } from "../semantic/nmi-register-locals.js";
import { semanticBlock, sourceBinding, sourceSpan } from "../machine/lowering-test-support.js";

const sample: BindingId = sourceBinding(400);
const span = sourceSpan(100);

/** One compile-time byte constant. */
function constant(result: string, value: bigint): SemanticOperation {
  return {
    kind: "constant",
    result,
    value,
    type: { kind: "scalar", name: "byte" },
    integer: null,
    span,
  };
}

/** One empty-path byte store. */
function store(value: string, root: BindingId): SemanticOperation {
  return {
    kind: "store",
    value,
    place: { root, path: [] },
    type: { kind: "scalar", name: "byte" },
    span,
  };
}

/** One empty-path byte load. */
function load(result: string, root: BindingId): SemanticOperation {
  return {
    kind: "load",
    result,
    place: { root, path: [] },
    type: { kind: "scalar", name: "byte" },
    integer: null,
    span,
  };
}

/** The retained set used by every case. */
const retained = new Set([bindingIdentityKey(sample)]);

describe("NMI stack plan", () => {
  it("assigns one slot and a join depth to a store that dominates a merge", () => {
    const blocks = [
      semanticBlock("entry", [constant("one", 1n), store("one", sample)], {
        kind: "branch",
        condition: "one",
        whenTrue: "true",
        whenFalse: "false",
      }),
      semanticBlock("true", [], { kind: "jump", target: "join" }),
      semanticBlock("false", [], { kind: "jump", target: "join" }),
      semanticBlock("join", [load("use", sample)], { kind: "return", value: null }),
    ];
    const plan = nmiStackPlan("entry", blocks, retained);
    expect(plan).not.toBeNull();
    expect(plan?.total).toBe(1);
    expect(plan?.slots.get(bindingIdentityKey(sample))).toBe(1);
    expect(plan?.depths.get("join")).toBe(1);
    expect(plan?.depths.get("true")).toBe(1);
    expect(plan?.depths.get("false")).toBe(1);
    expect(plan?.depths.get("entry")).toBe(0);
  });

  it("assigns a total push order to two stores on one dominating path", () => {
    const second = sourceBinding(401);
    const blocks = [
      semanticBlock("entry", [constant("one", 1n), store("one", sample), store("one", second)], {
        kind: "return",
        value: null,
      }),
    ];
    const plan = nmiStackPlan(
      "entry",
      blocks,
      new Set([bindingIdentityKey(sample), bindingIdentityKey(second)]),
    );
    expect(plan?.total).toBe(2);
    expect(plan?.slots.get(bindingIdentityKey(sample))).toBe(1);
    expect(plan?.slots.get(bindingIdentityKey(second))).toBe(2);
    expect(plan?.depths.get("entry")).toBe(0);
  });

  it("rejects a store inside a loop", () => {
    const blocks = [
      semanticBlock("entry", [], { kind: "jump", target: "header" }),
      semanticBlock("header", [], {
        kind: "branch",
        condition: "one",
        whenTrue: "body",
        whenFalse: "exit",
      }),
      semanticBlock("body", [constant("one", 1n), store("one", sample)], {
        kind: "jump",
        target: "header",
      }),
      semanticBlock("exit", [load("use", sample)], { kind: "return", value: null }),
    ];
    expect(nmiStackPlan("entry", blocks, retained)).toBeNull();
  });

  it("rejects two return blocks", () => {
    const blocks = [
      semanticBlock("entry", [constant("one", 1n), store("one", sample)], {
        kind: "branch",
        condition: "one",
        whenTrue: "left",
        whenFalse: "right",
      }),
      semanticBlock("left", [], { kind: "return", value: null }),
      semanticBlock("right", [], { kind: "return", value: null }),
    ];
    expect(nmiStackPlan("entry", blocks, retained)).toBeNull();
  });

  it("rejects stores on mutually exclusive branches", () => {
    const second = sourceBinding(402);
    const blocks = [
      semanticBlock("entry", [], {
        kind: "branch",
        condition: "one",
        whenTrue: "left",
        whenFalse: "right",
      }),
      semanticBlock("left", [constant("one", 1n), store("one", sample)], {
        kind: "jump",
        target: "join",
      }),
      semanticBlock("right", [constant("one", 1n), store("one", second)], {
        kind: "jump",
        target: "join",
      }),
      semanticBlock("join", [], { kind: "return", value: null }),
    ];
    expect(
      nmiStackPlan(
        "entry",
        blocks,
        new Set([bindingIdentityKey(sample), bindingIdentityKey(second)]),
      ),
    ).toBeNull();
  });

  it("rejects a store that does not dominate the return", () => {
    const blocks = [
      semanticBlock("entry", [], {
        kind: "branch",
        condition: "one",
        whenTrue: "left",
        whenFalse: "join",
      }),
      semanticBlock("left", [constant("one", 1n), store("one", sample)], {
        kind: "jump",
        target: "join",
      }),
      semanticBlock("join", [load("use", sample)], { kind: "return", value: null }),
    ];
    expect(nmiStackPlan("entry", blocks, retained)).toBeNull();
  });
});
