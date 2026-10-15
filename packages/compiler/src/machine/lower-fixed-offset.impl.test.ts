import { describe, expect, it } from "vitest";
import type { SemanticType } from "../frontend/semantic-types.js";
import type { SemanticOperation } from "../semantic/operations.js";
import { valueLifetimes } from "../semantic/value-lifetimes.js";
import { closeStorage } from "../storage/closure.js";
import { inventoryStorage } from "../storage/inventory.js";
import { bindMachineProgram } from "./bind.js";
import {
  BYTE,
  WORD,
  loadOperation,
  lowerFunctions,
  semanticBlock,
  semanticFunction,
  selectedProfile,
  sourceBinding,
  sourceParameter,
  sourceSpan,
  wholeProgramFor,
} from "./lowering-test-support.js";

/** Close a real borrowed-field read, optionally followed by a full-width runtime ordinal. */
function lowerField(offset: number, indexed = false) {
  const fieldType: SemanticType = indexed
    ? { kind: "array", element: BYTE, length: 4, size: 4 }
    : BYTE;
  const record: SemanticType = {
    kind: "struct",
    binding: sourceBinding(9341),
    size: offset + (indexed ? 4 : 1),
    fields: [{ name: "value", type: fieldType, offset }],
  };
  const root = sourceParameter(9342, record);
  const ordinal = sourceParameter(9343, WORD);
  const operations: SemanticOperation[] = [];
  if (indexed) operations.push(loadOperation("ordinal", ordinal, 9344));
  operations.push({
    kind: "load",
    result: "read",
    type: BYTE,
    integer: null,
    span: sourceSpan(9345),
    place: {
      root: root.id,
      rootType: record,
      path: [
        { kind: "field", name: "value" },
        ...(indexed ? [{ kind: "index" as const, value: "ordinal" }] : []),
      ],
    },
  });
  const fn = semanticFunction(9340, "borrowed-field", indexed ? [root, ordinal] : [root], BYTE, [
    semanticBlock("entry", operations, { kind: "return", value: "read" }),
  ]);
  const lifetimes = valueLifetimes(fn);
  const lowered = lowerFunctions([fn], lifetimes);
  if (lowered.kind !== "complete") throw new Error(lowered.reason);
  const closed = closeStorage(
    inventoryStorage(wholeProgramFor([fn], lifetimes)),
    selectedProfile().storage,
    lowered.binder,
  );
  if (closed.kind !== "complete") throw new Error("Expected closed borrowed-field storage");
  expect(bindMachineProgram(lowered.program, closed.certificate).kind).toBe("complete");
  const parameter = closed.inventory.requests.find(
    ({ storageClass }) => storageClass === "parameter",
  )!;
  const pointer = closed.inventory.requests.filter(({ region }) => region === "zero-page-required");
  expect(parameter.bytes).toBe(2);
  expect(pointer).toHaveLength(1);
  expect(pointer[0]!.bytes).toBe(2);
  const parameterHome = closed.certificate.homes.find(
    ({ requestId }) => requestId === parameter.id,
  )!;
  const pointerHome = closed.certificate.homes.find(
    ({ requestId }) => requestId === pointer[0]!.id,
  )!;
  expect(
    parameterHome.address + parameterHome.bytes <= pointerHome.address ||
      pointerHome.address + pointerHome.bytes <= parameterHome.address,
    "Live borrowed base and effective pointer have disjoint certified homes",
  ).toBe(true);
  return {
    parameter: parameter.id,
    pointer: pointer[0]!.id,
    requests: closed.inventory.requests,
    instructions: lowered.program.functions[0]!.blocks.flatMap(({ instructions }) => instructions),
  };
}

describe("borrowed fixed-offset address formation", () => {
  it.each([1, 255])(
    "uses the required zero index to add short offset %i before access",
    (offset) => {
      const { parameter, pointer, instructions } = lowerField(offset);
      expect(instructions.slice(0, 8).map(({ opcode }) => opcode)).toEqual([
        "ldy",
        "lda",
        "clc",
        "adc",
        "sta",
        "tya",
        "adc",
        "sta",
      ]);
      expect(instructions[1]!.operand).toMatchObject({
        kind: "storage",
        requestId: parameter,
        offset: 0,
      });
      expect(instructions[6]!.operand).toMatchObject({
        kind: "storage",
        requestId: parameter,
        offset: 1,
      });
      expect(instructions[3]!.operand).toEqual({ kind: "immediate", value: offset });
      expect(instructions[0]!.operand).toEqual({ kind: "immediate", value: 0 });
      expect(instructions.filter(({ opcode }) => opcode === "clc")).toHaveLength(1);
      expect(
        instructions.filter(({ opcode }) => opcode === "sta").map(({ operand }) => operand),
      ).toEqual([
        { kind: "storage", requestId: pointer, offset: 0 },
        { kind: "storage", requestId: pointer, offset: 1 },
      ]);
      expect(instructions.filter(({ mode }) => mode === "indirect-indexed-y")).toHaveLength(1);
      expect(instructions.filter(({ opcode }) => opcode === "ldy")).toHaveLength(1);
    },
  );

  it("keeps both immediate addend bytes for a high fixed offset", () => {
    const { parameter, instructions } = lowerField(257);
    expect(instructions.slice(0, 8).map(({ opcode }) => opcode)).toEqual([
      "lda",
      "clc",
      "adc",
      "sta",
      "lda",
      "adc",
      "sta",
      "ldy",
    ]);
    expect(instructions[4]!.operand).toMatchObject({ requestId: parameter, offset: 1 });
    expect(instructions[2]!.operand).toEqual({ kind: "immediate", value: 1 });
    expect(instructions[5]!.operand).toEqual({ kind: "immediate", value: 1 });
  });

  it("preserves the zero-offset copy without inserting arithmetic", () => {
    const { instructions } = lowerField(0);
    expect(instructions.map(({ opcode }) => opcode)).toEqual([
      "lda",
      "sta",
      "lda",
      "sta",
      "ldy",
      "lda",
    ]);
  });

  it("keeps full-width runtime ordinal addition after a high fixed offset", () => {
    const { instructions, requests, parameter } = lowerField(257, true);
    expect(
      requests.filter(({ storageClass }) => storageClass === "parameter").map(({ bytes }) => bytes),
    ).toEqual([2, 2]);
    expect(instructions.slice(0, 7).map(({ opcode }) => opcode)).toEqual([
      "lda",
      "clc",
      "adc",
      "sta",
      "lda",
      "adc",
      "sta",
    ]);
    expect(instructions[4]!.operand).toMatchObject({ requestId: parameter, offset: 1 });
    expect(instructions.filter(({ opcode }) => opcode === "clc")).toHaveLength(2);
    const highOrdinal = instructions.find(
      ({ opcode, operand }) =>
        opcode === "adc" && operand?.kind === "storage" && operand.offset === 1,
    );
    expect(highOrdinal).toBeDefined();
    expect(highOrdinal!.operand).not.toMatchObject({ requestId: parameter });
  });
});
