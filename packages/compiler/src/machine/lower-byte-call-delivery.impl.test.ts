import { describe, expect, it } from "vitest";
import type { SemanticType } from "../frontend/semantic-types.js";
import type {
  SemanticFunction,
  SemanticOperation,
  SemanticTerminator,
} from "../semantic/operations.js";
import { canReceiveByteArgumentInA } from "./lower-call.js";
import { selectRegisterForwarding } from "./lower-register-forwarding.js";
import {
  BOOLEAN,
  BYTE,
  BYTE_PAIR,
  VOID,
  WORD,
  loadOperation,
  semanticBlock,
  semanticFunction,
  sourceBinding,
  sourceParameter,
  sourceSpan,
} from "./lowering-test-support.js";

const span = sourceSpan(9980);
const parameter = sourceParameter(9981, BYTE);
const sink = semanticFunction(9982, "sink", [parameter], VOID, [
  semanticBlock("entry", [], { kind: "return", value: null }),
]);
const call: Extract<SemanticOperation, { kind: "call" }> = {
  kind: "call",
  result: null,
  callee: sink.id,
  arguments: ["value"],
  type: VOID,
  span,
};
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
const conversion: Extract<SemanticOperation, { kind: "convert" }> = {
  kind: "convert",
  result: "cast",
  operand: "value",
  type: BYTE,
  conversion: "reinterpret",
  integer: null,
  span,
};

/** Query the existing block-local selector with explicit source signatures and sole uses. */
function forwarded(
  operations: readonly SemanticOperation[],
  uses: readonly string[] = ["value", "cast"],
  functions: readonly SemanticFunction[] = [sink],
  terminator: SemanticTerminator = { kind: "return", value: null },
) {
  return selectRegisterForwarding(
    [semanticBlock("entry", operations, terminator)],
    new Set(uses),
    new Map(),
    functions,
  ).forwardedRegisterValues;
}

describe("direct byte parameter receiver", () => {
  const enumType: SemanticType = { kind: "enum", name: "Direction", binding: sourceBinding(9983) };
  it.each([BYTE, BOOLEAN, { kind: "scalar", name: "sbyte" }, enumType] as const)(
    "should use the exact one-byte scalar or enum declaration %j",
    (type) => {
      const declared = { ...sink, parameters: [{ ...parameter, type }] };
      expect(canReceiveByteArgumentInA(call, "value", [declared])).toBe(true);
    },
  );
  it("should reject missing signatures, mismatched identities, arity and interrupt entries", () => {
    expect(canReceiveByteArgumentInA(call, "value", [])).toBe(false);
    expect(canReceiveByteArgumentInA(call, "other", [sink])).toBe(false);
    expect(
      canReceiveByteArgumentInA({ ...call, callee: sourceBinding(9984) }, "value", [sink]),
    ).toBe(false);
    for (const arguments_ of [[], ["value", "other"]])
      expect(canReceiveByteArgumentInA({ ...call, arguments: arguments_ }, "value", [sink])).toBe(
        false,
      );
    for (const parameters of [[], [parameter, sourceParameter(9985, BYTE)]])
      expect(canReceiveByteArgumentInA(call, "value", [{ ...sink, parameters }])).toBe(false);
    expect(canReceiveByteArgumentInA(call, "value", [{ ...sink, entryKind: "interrupt" }])).toBe(
      false,
    );
  });
  it("should keep wider, borrowed and even one-byte aggregate parameters on their existing ABI", () => {
    const record: SemanticType = {
      kind: "struct",
      binding: sourceBinding(9986),
      size: 1,
      fields: [{ name: "value", type: BYTE, offset: 0 }],
    };
    const types: readonly SemanticType[] = [
      WORD,
      VOID,
      record,
      { kind: "array", element: BYTE, length: 1, size: 1 },
      { kind: "function", parameters: [], returnType: VOID },
    ];
    for (const type of types)
      expect(
        canReceiveByteArgumentInA(call, "value", [
          { ...sink, parameters: [{ ...parameter, type }] },
        ]),
      ).toBe(false);
    expect(
      canReceiveByteArgumentInA(call, "value", [
        {
          ...sink,
          parameters: [{ ...parameter, outerUnsized: true }],
        },
      ]),
    ).toBe(false);
  });
  it("should consume the byte parameter before scalar or aggregate result setup", () => {
    for (const result of [BYTE, WORD, BYTE_PAIR])
      expect(
        canReceiveByteArgumentInA({ ...call, result: "returned", type: result }, "value", [
          { ...sink, result },
        ]),
      ).toBe(true);
  });
});

describe("sole adjacent byte delivery", () => {
  it("should forward source reads, unselected loads and ordinary byte call results", () => {
    const producers: readonly SemanticOperation[] = [
      read,
      loadOperation("value", sourceParameter(9987, BYTE), 9988),
      { ...call, arguments: [], result: "value", callee: sourceBinding(9989), type: BYTE },
    ];
    for (const producer of producers) expect(forwarded([producer, call]).has("value")).toBe(true);
  });
  it.each(["identity", "reinterpret"] as const)(
    "should pass through one sole same-width %s conversion",
    (kind) => {
      const result = forwarded([
        read,
        { ...conversion, conversion: kind },
        { ...call, arguments: ["cast"] },
      ]);
      expect([...result]).toEqual(["value", "cast"]);
    },
  );
  it("should allow identities with no instructions but reject clobbering gaps", () => {
    const constant: SemanticOperation = {
      kind: "constant",
      result: "zero",
      value: 0n,
      type: BYTE,
      integer: null,
      span,
    };
    expect(forwarded([read, constant, call]).has("value")).toBe(true);
    for (const gap of [
      { kind: "cpu-control" as const, control: "asm_nop" as const, span },
      { ...call, arguments: [] },
    ])
      expect(forwarded([read, gap, call]).has("value")).toBe(false);
  });
  it("should retain unknown, multiple-argument, indirect and multiply-used values", () => {
    expect(forwarded([read, call], undefined, []).has("value")).toBe(false);
    expect(forwarded([read, call], []).has("value")).toBe(false);
    expect(forwarded([read, { ...call, arguments: ["value", "other"] }]).has("value")).toBe(false);
    const indirect: SemanticOperation = {
      kind: "indirect-call",
      target: "target",
      arguments: ["value"],
      result: null,
      type: VOID,
      span,
    };
    expect(forwarded([read, indirect]).has("value")).toBe(false);
    expect(
      selectRegisterForwarding(
        [semanticBlock("entry", [read, call], { kind: "return", value: null })],
        new Set(["value"]),
      ).forwardedRegisterValues.has("value"),
    ).toBe(false);
  });
  it("should not cross widening, extra or multiply-used conversions", () => {
    const consumer = { ...call, arguments: ["cast"] };
    for (const kind of ["truncate", "zero-extend", "sign-extend"] as const)
      expect(forwarded([read, { ...conversion, conversion: kind }, consumer]).has("value")).toBe(
        false,
      );
    expect(forwarded([{ ...read, width: 2, type: WORD }, call]).has("value")).toBe(false);
    for (const changed of [
      { ...conversion, type: WORD },
      { ...conversion, operand: "other" },
    ])
      expect(forwarded([read, changed, consumer]).has("value")).toBe(false);
    expect(forwarded([read, conversion, consumer], ["value"]).has("value")).toBe(false);
    expect(forwarded([read, conversion, consumer], ["cast"]).has("value")).toBe(false);
    expect(
      forwarded([
        read,
        conversion,
        { ...conversion, result: "twice", operand: "cast" },
        { ...call, arguments: ["twice"] },
      ]).has("value"),
    ).toBe(false);
  });
});

describe("final byte read return", () => {
  it("should return a sole byte read directly and leave wider, nonreturn or interrupted paths stable", () => {
    const returning: SemanticTerminator = { kind: "return", value: "value" };
    expect(forwarded([read], undefined, [], returning).has("value")).toBe(true);
    expect(forwarded([read], [], [], returning).has("value")).toBe(false);
    expect(
      forwarded([{ ...read, width: 2, type: WORD }], undefined, [], returning).has("value"),
    ).toBe(false);
    expect(forwarded([read], undefined, [], { kind: "jump", target: "next" }).has("value")).toBe(
      false,
    );
    expect(
      forwarded(
        [read, { kind: "cpu-control", control: "asm_nop", span }],
        undefined,
        [],
        returning,
      ).has("value"),
    ).toBe(false);
    expect(forwarded([read], undefined, [], { kind: "return", value: "other" }).has("value")).toBe(
      false,
    );
  });
});
