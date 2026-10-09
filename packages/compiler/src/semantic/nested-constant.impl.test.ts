import { describe, expect, it } from "vitest";
import { SCALAR_TYPES } from "../frontend/constants.js";
import { bindingIdentityKey, createSemanticBodyBinding } from "../frontend/semantic-types.js";
import type { SemanticBinding, TypedExpr } from "../frontend/semantic-types.js";
import { isConstantAggregateLiteral } from "./lower-aggregate-literal.js";
import { valueLifetimes } from "./value-lifetimes.js";

const span = { sourceId: "src/constant.blend", start: 10, end: 11 };
const bindings = new Map<string, SemanticBinding>();

/** A completed typed constant, without a runtime place or observable read. */
function scalar(value = 7n): TypedExpr {
  return {
    kind: "number",
    span,
    type: SCALAR_TYPES.byte,
    constant: value,
    binding: null,
    place: null,
    conversion: null,
    integer: null,
    value,
  };
}

/** Build real typed literal records for the proof's syntax/effect boundaries. */
function array(elements: readonly TypedExpr[], fill: TypedExpr | null = null): TypedExpr {
  return {
    ...scalar(),
    kind: "array-literal",
    constant: null,
    type: {
      kind: "array",
      element: SCALAR_TYPES.byte,
      length: elements.length + (fill ? 1 : 0),
      size: elements.length + (fill ? 1 : 0),
    },
    elements,
    fill,
  };
}

describe("constant literal proof internals", () => {
  it("should accept nested constants and scalar fills without inspecting machine state", () => {
    expect(
      isConstantAggregateLiteral(array([scalar(), array([scalar()])], scalar()), bindings),
    ).toBe(true);
  });

  it.each(["call", "assignment", "index"] as const)(
    "should reject a constant-looking %s before any child can be forwarded",
    (kind) => {
      expect(isConstantAggregateLiteral(array([{ ...scalar(), kind }]), bindings)).toBe(false);
    },
  );

  it("should reject volatile leaves and aggregate fill reuse", () => {
    const volatile: TypedExpr = {
      ...scalar(),
      memory: { volatile: true, access: "read", width: 1, byteOrder: "low-first" },
    };
    expect(isConstantAggregateLiteral(array([volatile]), bindings)).toBe(false);
    expect(isConstantAggregateLiteral(array([], array([scalar()])), bindings)).toBe(false);
  });

  it("should distinguish immutable names from constant-looking mutable storage", () => {
    for (const storage of ["constant", "local"] as const) {
      const binding = createSemanticBodyBinding("value", span, storage, SCALAR_TYPES.byte);
      const scope = new Map([[bindingIdentityKey(binding.id), binding]]);
      const name: TypedExpr = { ...scalar(), kind: "name", binding: binding.id };
      expect(isConstantAggregateLiteral(array([name]), scope)).toBe(storage === "constant");
    }
  });

  it("should reject unknown effects hidden under operators or qualifiers", () => {
    const call: TypedExpr = { ...scalar(), kind: "call" };
    const unary: TypedExpr = { ...scalar(), kind: "unary", operator: "-", operand: call };
    const member: TypedExpr = { ...scalar(), kind: "member", object: call };
    expect(isConstantAggregateLiteral(array([unary]), bindings)).toBe(false);
    expect(isConstantAggregateLiteral(array([member]), bindings)).toBe(false);
    expect(
      isConstantAggregateLiteral(
        array([{ ...scalar(), kind: "unary", operator: "&", operand: scalar() }]),
        bindings,
      ),
    ).toBe(false);
  });

  it("should accept existing constant conversions and pure expression trees", () => {
    const cast: TypedExpr = { ...scalar(), kind: "cast", operand: scalar() };
    const binary: TypedExpr = { ...scalar(), kind: "binary", left: cast, right: scalar() };
    const condition: TypedExpr = {
      ...scalar(),
      kind: "conditional",
      condition: scalar(),
      whenTrue: binary,
      whenFalse: scalar(),
    };
    expect(isConstantAggregateLiteral(array([condition]), bindings)).toBe(true);
    expect(isConstantAggregateLiteral(array([{ ...scalar(), constant: null }]), bindings)).toBe(
      false,
    );
  });

  it("should keep a destination ordinal live until its child construction consumes it", () => {
    const root = createSemanticBodyBinding("rows", span, "local", {
      kind: "array",
      element: { kind: "array", element: SCALAR_TYPES.byte, length: 1, size: 1 },
      length: 2,
      size: 2,
    });
    const lifetimes = valueLifetimes({
      id: root.id,
      entry: "entry",
      blocks: [
        {
          id: "entry",
          operations: [
            {
              kind: "constant",
              result: "index",
              value: 1n,
              type: SCALAR_TYPES.word,
              integer: null,
              span,
            },
            {
              kind: "constant",
              result: "byte",
              value: 7n,
              type: SCALAR_TYPES.byte,
              integer: null,
              span,
            },
            {
              kind: "aggregate",
              result: "child",
              type: { kind: "array", element: SCALAR_TYPES.byte, length: 1, size: 1 },
              elements: [{ field: null, value: "byte" }],
              fill: null,
              destination: {
                kind: "place",
                freshConstant: true,
                place: {
                  root: root.id,
                  rootType: root.type!,
                  path: [{ kind: "index", value: "index" }],
                },
              },
              integer: null,
              span,
            },
          ],
          terminator: { kind: "return", value: null },
        },
      ],
    });
    expect(lifetimes.find(({ value }) => value === "index")?.liveAt).toContainEqual({
      block: "entry",
      operation: 2,
    });
  });
});
