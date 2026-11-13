import { describe, expect, it } from "vitest";
import type {
  MemoryWriteOperation,
  PlatformOperation,
  SemanticBlock,
  SemanticOperation,
} from "../semantic/operations.js";
import { selectRegisterForwarding } from "./lower-register-forwarding.js";
import type { MachineInstruction } from "./machine-types.js";
import {
  BOOLEAN,
  BYTE,
  loadOperation,
  lowerFunctions,
  semanticBlock,
  semanticFunction,
  sourceParameter,
  sourceSpan,
  VOID,
  WORD,
} from "./lowering-test-support.js";

const span = sourceSpan(100);

/** One direct volatile byte read in the selected cooperative route. */
function read(
  result = "read",
  capability = "c64.cia2.readAndClearPendingSources",
): PlatformOperation {
  return {
    kind: "platform",
    capability,
    result,
    arguments: [],
    type: BYTE,
    effect: "volatile-read",
    span,
  };
}

/** One compile-time byte constant. */
function constant(result: string, value: bigint, type = BYTE): SemanticOperation {
  return { kind: "constant", result, value, type, integer: null, span };
}

/** One byte binary operation. */
function binary(
  result: string,
  operator: "&" | "|" | "^" | "==" | "!=",
  left: string,
  right: string,
  type = BYTE,
): SemanticOperation {
  return { kind: "binary", result, operator, left, right, type, integer: null, span };
}

/** One fixed byte memory write. */
function write(address: string, value: string): MemoryWriteOperation {
  return {
    kind: "memory-write",
    address,
    value,
    width: 1,
    byteOrder: "low-first",
    volatile: false,
    span,
  };
}

/** The exact constant-and-comparison tail for one delivered mask. */
function maskedValue(
  mask: bigint,
  operator: "==" | "!=",
  maskResult = "masked",
): readonly SemanticOperation[] {
  return [
    read(),
    constant("mask", mask),
    binary(maskResult, "&", "read", "mask"),
    constant("zero", 0n),
    binary("done", operator, maskResult, "zero", BOOLEAN),
  ];
}

/** Ask the real selector which values stay in A, own Z, or carry a shift count. */
function selection(
  operations: readonly SemanticOperation[],
  terminator?: SemanticBlock["terminator"],
) {
  return selectRegisterForwarding(
    [semanticBlock("entry", operations, terminator ?? { kind: "return", value: null })],
    new Set(["read", "mask", "masked", "done"]),
  );
}

/** The single A consumer that makes a materialized Boolean worth selecting. */
const consumed = (): readonly SemanticOperation[] => [
  constant("address", 0xc000n),
  constant("one", 1n),
  write("address", "done"),
];

describe("single-bit Boolean shift selection", () => {
  it("selects mask two with one shift for a materialized value", () => {
    const result = selection([...maskedValue(2n, "!="), ...consumed()]);
    expect(result.booleanShiftValues.get("masked")).toBe(1);
    expect(result.forwardedRegisterValues.has("masked")).toBe(true);
    expect(result.forwardedRegisterValues.has("done")).toBe(true);
  });

  it("selects mask four with two shifts for the inverse", () => {
    const result = selection([...maskedValue(4n, "=="), ...consumed()]);
    expect(result.booleanShiftValues.get("masked")).toBe(2);
  });

  it("keeps mask one on the existing identity selection", () => {
    const result = selection([...maskedValue(1n, "!="), ...consumed()]);
    expect(result.booleanValues.has("masked")).toBe(true);
    expect(result.booleanShiftValues.has("masked")).toBe(false);
  });

  it("selects mask eight through the inline branch", () => {
    const result = selection([...maskedValue(8n, "!="), ...consumed()]);
    expect(result.booleanShiftValues.has("masked")).toBe(false);
    expect(result.booleanBranchValues.has("masked")).toBe(true);
    expect(result.forwardedRegisterValues.has("masked")).toBe(true);
  });

  it("selects a multi-bit constant mask through the inline branch", () => {
    const result = selection([...maskedValue(3n, "!="), ...consumed()]);
    expect(result.booleanBranchValues.has("masked")).toBe(true);
  });

  it("selects an addressable runtime mask through the inline branch", () => {
    const mask = sourceParameter(200, BYTE);
    const result = selection([
      read(),
      loadOperation("mask", mask, 201),
      binary("masked", "&", "read", "mask"),
      constant("zero", 0n),
      binary("done", "!=", "masked", "zero", BOOLEAN),
      ...consumed(),
    ]);
    expect(result.booleanShiftValues.has("masked")).toBe(false);
    expect(result.booleanBranchValues.has("masked")).toBe(true);
  });

  it("selects a mirrored comparison with the zero on the left", () => {
    const result = selection([
      read(),
      constant("mask", 2n),
      binary("masked", "&", "read", "mask"),
      constant("zero", 0n),
      binary("done", "!=", "zero", "masked", BOOLEAN),
      ...consumed(),
    ]);
    expect(result.booleanShiftValues.get("masked")).toBe(1);
    expect(result.forwardedRegisterValues.has("done")).toBe(true);
  });

  it("selects the mirrored constant-left mask", () => {
    const result = selection([
      read(),
      constant("mask", 2n),
      binary("masked", "&", "mask", "read"),
      constant("zero", 0n),
      binary("done", "!=", "masked", "zero", BOOLEAN),
      ...consumed(),
    ]);
    expect(result.booleanShiftValues.get("masked")).toBe(1);
  });

  it("selects a converted constant mask", () => {
    const result = selection([
      read(),
      constant("twoConst", 2n),
      {
        kind: "convert",
        result: "mask",
        operand: "twoConst",
        conversion: "identity",
        type: BYTE,
        integer: null,
        span,
      },
      binary("masked", "&", "read", "mask"),
      constant("zero", 0n),
      binary("done", "!=", "masked", "zero", BOOLEAN),
      ...consumed(),
    ]);
    expect(result.booleanShiftValues.get("masked")).toBe(1);
  });

  it("selects a byte-masked word through the existing shift identity", () => {
    const mask = sourceParameter(210, WORD);
    const result = selection([
      loadOperation("wordValue", mask, 211),
      constant("mask", 2n, WORD),
      binary("masked", "&", "wordValue", "mask", WORD),
      constant("zero", 0n, WORD),
      binary("done", "!=", "masked", "zero", BOOLEAN),
      ...consumed(),
    ]);
    expect(result.booleanShiftValues.get("masked")).toBe(1);
  });

  it("does not shift a branch condition", () => {
    const result = selection(maskedValue(2n, "!="), {
      kind: "branch",
      condition: "done",
      whenTrue: "store",
      whenFalse: "end",
    });
    expect(result.booleanShiftValues.size).toBe(0);
    expect(result.zeroFlagValues.has("masked")).toBe(true);
  });

  it("does not shift a multi-use masked value", () => {
    const result = selectRegisterForwarding(
      [
        semanticBlock(
          "entry",
          [...maskedValue(2n, "!="), ...consumed(), binary("again", "|", "masked", "mask")],
          { kind: "return", value: null },
        ),
      ],
      new Set(["read", "mask", "done"]),
    );
    expect(result.booleanShiftValues.has("masked")).toBe(false);
  });

  it("selects a Boolean return consumer", () => {
    const result = selection(maskedValue(2n, "!="), { kind: "return", value: "done" });
    expect(result.booleanShiftValues.get("masked")).toBe(1);
    expect(result.forwardedRegisterValues.has("done")).toBe(true);
  });
});

/** Build one handler body with a terminal branch to a fixed store block. */
function conditionalBlock(operations: readonly SemanticOperation[]): SemanticBlock {
  return semanticBlock("entry", operations, {
    kind: "branch",
    condition: "done",
    whenTrue: "store",
    whenFalse: "end",
  });
}

/** Build the store block used by the cost witnesses. */
function storeBlock(): SemanticBlock {
  return semanticBlock(
    "store",
    [constant("address", 0xc000n), constant("one", 1n), write("address", "one")],
    { kind: "jump", target: "end" },
  );
}

/** Return the total bytes and cycles of one instruction list. */
function cost(instructions: readonly MachineInstruction[]) {
  return instructions.reduce(
    (total, instruction) => ({
      bytes: total.bytes + instruction.cost.bytes,
      cycles: total.cycles + instruction.cost.maxCycles,
    }),
    { bytes: 0, cycles: 0 },
  );
}

/** The instructions and body cost of one materialized handler. */
function materialized(operations: readonly SemanticOperation[]) {
  const handler = semanticFunction(1000, "timerHandler", [], VOID, [
    semanticBlock("entry", operations, { kind: "return", value: null }),
  ]);
  const lowered = lowerFunctions([handler]);
  if (lowered.kind !== "complete") throw new Error(lowered.reason);
  const entry = lowered.program.functions[0]!.blocks[0]!;
  return { instructions: entry.instructions, ...cost(entry.instructions) };
}

describe("materialized Boolean shift output", () => {
  it("emits one shift for mask two", () => {
    const lowered = materialized([...maskedValue(2n, "!="), ...consumed()]);
    expect(
      lowered.instructions.map(({ opcode, mode, operand }) => [opcode, mode, operand]),
    ).toEqual([
      ["lda", "absolute", { kind: "absolute", value: 0xdd0d }],
      ["and", "immediate", { kind: "immediate", value: 2 }],
      ["lsr", "accumulator", null],
      ["sta", "absolute", { kind: "absolute", value: 0xc000 }],
    ]);
    expect(lowered.bytes).toBe(9);
    expect(lowered.cycles).toBe(12);
  });

  it("emits two shifts and one inversion for mask four equality", () => {
    const lowered = materialized([...maskedValue(4n, "=="), ...consumed()]);
    expect(
      lowered.instructions.map(({ opcode, mode, operand }) => [opcode, mode, operand]),
    ).toEqual([
      ["lda", "absolute", { kind: "absolute", value: 0xdd0d }],
      ["and", "immediate", { kind: "immediate", value: 4 }],
      ["lsr", "accumulator", null],
      ["lsr", "accumulator", null],
      ["eor", "immediate", { kind: "immediate", value: 1 }],
      ["sta", "absolute", { kind: "absolute", value: 0xc000 }],
    ]);
    expect(lowered.bytes).toBe(12);
    expect(lowered.cycles).toBe(16);
  });

  it("keeps the mask-one identity output unchanged", () => {
    const lowered = materialized([...maskedValue(1n, "!="), ...consumed()]);
    expect(lowered.instructions.map(({ opcode }) => opcode)).toEqual(["lda", "and", "sta"]);
    expect(lowered.bytes).toBe(8);
    expect(lowered.cycles).toBe(10);
  });

  it("emits the same body for a mirrored zero test", () => {
    const lowered = materialized([
      read(),
      constant("mask", 2n),
      binary("masked", "&", "read", "mask"),
      constant("zero", 0n),
      binary("done", "!=", "zero", "masked", BOOLEAN),
      ...consumed(),
    ]);
    expect(lowered.instructions.map(({ opcode }) => opcode)).toEqual(["lda", "and", "lsr", "sta"]);
  });

  it("emits a direct store for a byte memory-write consumer", () => {
    const lowered = materialized([
      ...maskedValue(2n, "!="),
      constant("target", 0x0402n),
      write("target", "done"),
    ]);
    expect(
      lowered.instructions.map(({ opcode, mode, operand }) => [opcode, mode, operand]),
    ).toEqual([
      ["lda", "absolute", { kind: "absolute", value: 0xdd0d }],
      ["and", "immediate", { kind: "immediate", value: 2 }],
      ["lsr", "accumulator", null],
      ["sta", "absolute", { kind: "absolute", value: 0x0402 }],
    ]);
  });

  it("keeps a Boolean return in A without a staging store", () => {
    const handler = semanticFunction(1020, "boolHandler", [], BOOLEAN, [
      semanticBlock("entry", maskedValue(2n, "!="), { kind: "return", value: "done" }),
    ]);
    const lowered = lowerFunctions([handler]);
    if (lowered.kind !== "complete") throw new Error(lowered.reason);
    const entry = lowered.program.functions[0]!.blocks[0]!;
    expect(entry.instructions.map(({ opcode }) => opcode)).toEqual(["lda", "and", "lsr"]);
  });

  it("pins the complete handler bytes and path-max cycles", () => {
    const cases = [
      { mask: 2n, operator: "!=" as const, bytes: 13, cycles: 27 },
      { mask: 4n, operator: "!=" as const, bytes: 14, cycles: 29 },
      { mask: 2n, operator: "==" as const, bytes: 15, cycles: 29 },
      { mask: 4n, operator: "==" as const, bytes: 16, cycles: 31 },
    ];
    for (const { mask, operator, bytes, cycles } of cases) {
      const lowered = materialized([...maskedValue(mask, operator), ...consumed()]);
      // PHA/CLD/PLA/RTI add four bytes and fifteen cycles to the handler body.
      expect(lowered.bytes + 4).toBe(bytes);
      expect(lowered.cycles + 15).toBe(cycles);
    }
  });

  it("keeps a branch condition on the AND flags with no shift", () => {
    const handler = semanticFunction(1010, "timerHandler", [], VOID, [
      conditionalBlock(maskedValue(2n, "!=")),
      storeBlock(),
      semanticBlock("end", [], { kind: "return", value: null }),
    ]);
    const lowered = lowerFunctions([handler]);
    if (lowered.kind !== "complete") throw new Error(lowered.reason);
    const entry = lowered.program.functions[0]!.blocks.find((block) => block.label === "entry")!;
    expect(entry.instructions.map(({ opcode }) => opcode)).toEqual(["lda", "and"]);
    expect(entry.terminator.kind).toBe("branch");
    if (entry.terminator.kind === "branch") expect(entry.terminator.opcode).toBe("bne");
  });
});
