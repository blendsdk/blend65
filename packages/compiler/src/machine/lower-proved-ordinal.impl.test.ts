import { describe, expect, it } from "vitest";
import type { SemanticType } from "../frontend/semantic-types.js";
import type { SemanticOperation } from "../semantic/operations.js";
import { valueLifetimes } from "../semantic/value-lifetimes.js";
import { closeStorage } from "../storage/closure.js";
import { inventoryStorage } from "../storage/inventory.js";
import { bindMachineProgram } from "./bind.js";
import { selectRegisterForwarding } from "./lower-register-forwarding.js";
import {
  BOOLEAN,
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

const span = sourceSpan(9271);
const rowsType: SemanticType = { kind: "array", element: BYTE, length: 300, size: 300 };
const literal: Extract<SemanticOperation, { kind: "constant" }> = {
  kind: "constant",
  result: "three",
  value: 3n,
  type: WORD,
  integer: { width: 16, signed: false, wrap: true },
  span,
};
const addition: Extract<SemanticOperation, { kind: "binary" }> = {
  kind: "binary",
  result: "offset",
  operator: "+",
  left: "index",
  right: "three",
  type: WORD,
  integer: { width: 16, signed: false, wrap: true },
  span,
};
const access: Extract<SemanticOperation, { kind: "load" }> = {
  kind: "load",
  result: "item",
  type: BYTE,
  integer: null,
  span,
  place: {
    root: sourceBinding(9272),
    rootType: rowsType,
    path: [{ kind: "index", value: "offset" }],
  },
};

/** Supply only one exact use-site fact; the selector must not infer a producer-wide range. */
function select(operations: readonly SemanticOperation[], maximum = 255n, singleUse = true) {
  return selectRegisterForwarding(
    [semanticBlock("entry", operations, { kind: "return", value: "item" })],
    new Set(singleUse ? ["offset"] : []),
    new Map([[access, new Map([["offset", maximum]])]]),
  );
}

/** Build a guarded ordinary word addition and close its real machine-discovered storage. */
function lowerOffset(boundsCheck: boolean, barrier = false) {
  const rows = sourceParameter(9281, rowsType);
  const index = sourceParameter(9282, WORD);
  const read: SemanticOperation = { ...access, place: { ...access.place, root: rows.id } };
  const fn = semanticFunction(9280, "bounded-offset", [rows, index], BYTE, [
    semanticBlock(
      "entry",
      [
        {
          ...loadOperation("index", index, 9283),
          integer: { width: 16, signed: false, wrap: true },
        },
        { ...literal, result: "limit", value: 253n },
        { ...addition, result: "valid", operator: "<", right: "limit", type: BOOLEAN },
      ],
      { kind: "branch", condition: "valid", whenTrue: "read", whenFalse: "reject" },
    ),
    semanticBlock(
      "read",
      [
        literal,
        addition,
        ...(barrier ? [{ kind: "cpu-control" as const, control: "asm_nop" as const, span }] : []),
        read,
      ],
      { kind: "return", value: "item" },
    ),
    semanticBlock("reject", [{ ...literal, result: "zero", value: 0n, type: BYTE }], {
      kind: "return",
      value: "zero",
    }),
  ]);
  const lifetimes = valueLifetimes(fn);
  const lowered = lowerFunctions([fn], lifetimes, boundsCheck);
  if (lowered.kind !== "complete") throw new Error(lowered.reason);
  const closed = closeStorage(
    inventoryStorage(wholeProgramFor([fn], lifetimes)),
    selectedProfile().storage,
    lowered.binder,
  );
  if (closed.kind !== "complete") throw new Error("Expected complete word/index storage");
  expect(bindMachineProgram(lowered.program, closed.certificate).kind).toBe("complete");
  return {
    requests: closed.inventory.requests,
    instructions: lowered.program.functions[0]!.blocks.flatMap(({ instructions }) => instructions),
  };
}

describe("proved adjacent ordinal selection", () => {
  it("selects only the exact next stride-one consumer with a nonwrapping byte bound", () => {
    const selected = select([literal, addition, access]);
    expect([...selected.byteOrdinalAdditions]).toEqual(["offset"]);
    expect(selected.forwardedRegisterValues.has("offset")).toBe(true);
    expect(select([literal, addition, access], 256n).byteOrdinalAdditions.size).toBe(0);
    expect(select([literal, addition, access], -1n).byteOrdinalAdditions.size).toBe(0);
    expect(select([literal, addition, access], 255n, false).byteOrdinalAdditions.size).toBe(0);
    expect(
      select([literal, { ...addition, operator: "-" }, access]).byteOrdinalAdditions.size,
    ).toBe(0);
    expect(select([literal, { ...addition, type: BYTE }, access]).byteOrdinalAdditions.size).toBe(
      0,
    );
    expect(select([{ ...literal, value: 256n }, addition, access]).byteOrdinalAdditions.size).toBe(
      0,
    );
    expect(select([literal, addition, { ...access }]).byteOrdinalAdditions.size).toBe(0);
    expect(
      select([literal, addition, { kind: "cpu-control", control: "asm_nop", span }, access])
        .byteOrdinalAdditions.size,
    ).toBe(0);
    expect(
      selectRegisterForwarding(
        [
          semanticBlock("entry", [literal, addition], { kind: "jump", target: "later" }),
          semanticBlock("later", [access], { kind: "return", value: "item" }),
        ],
        new Set(["offset"]),
        new Map([[access, new Map([["offset", 255n]])]]),
      ).byteOrdinalAdditions.size,
    ).toBe(0);
  });

  it("keeps word homes but removes the adjacent sum's temporary and redundant carry reset", () => {
    const { requests, instructions } = lowerOffset(false);
    expect(requests.some(({ id }) => id.includes("arithmetic:offset"))).toBe(false);
    expect(
      requests.filter(({ storageClass }) => storageClass === "parameter").map(({ bytes }) => bytes),
    ).toEqual([2, 2]);
    const add = instructions.findIndex(
      ({ opcode, operand }) =>
        opcode === "adc" && operand?.kind === "immediate" && operand.value === 3,
    );
    expect(add).toBeGreaterThan(0);
    expect(instructions[add - 1]!.opcode).toBe("clc");
    expect(instructions[add + 1]!.opcode).toBe("adc");
    expect(instructions.filter(({ opcode }) => opcode === "clc")).toHaveLength(1);
  });

  it("stages the selected low byte before checked guards and resets address carry afterward", () => {
    const { requests, instructions } = lowerOffset(true);
    expect(requests.some(({ id }) => id.includes("arithmetic:offset"))).toBe(false);
    expect(instructions.filter(({ opcode }) => opcode === "clc").length).toBeGreaterThan(1);
    const add = instructions.findIndex(
      ({ opcode, operand }) =>
        opcode === "adc" && operand?.kind === "immediate" && operand.value === 3,
    );
    expect(instructions[add + 1]!.opcode).toBe("sta");
  });

  it("retains full arithmetic allocation when an instruction breaks adjacency", () => {
    const { requests } = lowerOffset(false, true);
    expect(requests.find(({ id }) => id.includes("arithmetic:offset"))).toMatchObject({ bytes: 2 });
  });
});
