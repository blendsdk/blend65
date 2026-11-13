import { describe, expect, it } from "vitest";
import type { SemanticBlock, SemanticOperation } from "../semantic/operations.js";
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

/** One compile-time constant of the requested width. */
function constant(result: string, value: bigint, type = BYTE): SemanticOperation {
  return { kind: "constant", result, value, type, integer: null, span };
}

/** One bitwise or equality binary operation. */
function binary(
  result: string,
  operator: "&" | "|" | "^" | "==" | "!=",
  left: string,
  right: string,
  type = BYTE,
): SemanticOperation {
  return { kind: "binary", result, operator, left, right, type, integer: null, span };
}

/** One fixed byte memory write to a constant address. */
function write(address: string, value: string): SemanticOperation {
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

/** The A consumer that makes a materialized Boolean worth selecting. */
const consumed = (): readonly SemanticOperation[] => [
  constant("address", 0xc000n),
  write("address", "done"),
];

/** Ask the real selector which values stay in A or use the general mask branch. */
function selection(operations: readonly SemanticOperation[]) {
  return selectRegisterForwarding(
    [semanticBlock("entry", operations, { kind: "return", value: null })],
    new Set(operations.flatMap((operation) => ("result" in operation ? [operation.result] : []))),
  );
}

/** One semantic block holding a complete handler body. */
function handler(operations: readonly SemanticOperation[]): SemanticBlock {
  return semanticBlock("entry", operations, { kind: "return", value: null });
}

/** The instructions and body cost of one materialized handler. */
function materialized(operations: readonly SemanticOperation[]) {
  const fn = semanticFunction(1000, "timerHandler", [], VOID, [handler(operations)]);
  const lowered = lowerFunctions([fn]);
  if (lowered.kind !== "complete") throw new Error(lowered.reason);
  return lowered.program.functions[0]!.blocks;
}

/** Return the total bytes and path-max cycles of one instruction list. */
function cost(instructions: readonly MachineInstruction[]) {
  return instructions.reduce(
    (total, instruction) => ({
      bytes: total.bytes + instruction.cost.bytes,
      cycles: total.cycles + instruction.cost.maxCycles,
    }),
    { bytes: 0, cycles: 0 },
  );
}

describe("general masked comparison selection", () => {
  it("selects a single-bit mask equal to its comparison constant", () => {
    const result = selection([
      read(),
      constant("mask", 8n),
      binary("masked", "&", "read", "mask"),
      constant("eight", 8n),
      binary("done", "==", "masked", "eight", BOOLEAN),
      ...consumed(),
    ]);
    expect(result.booleanMaskTests.get("masked")).toEqual({
      form: "byte",
      constant: 8,
      mask: 8,
    });
    expect(result.forwardedRegisterValues.has("masked")).toBe(true);
    expect(result.forwardedRegisterValues.has("done")).toBe(true);
  });

  it("selects a general nonzero constant with its compile-time mask", () => {
    const result = selection([
      read(),
      constant("mask", 3n),
      binary("masked", "&", "read", "mask"),
      constant("one", 1n),
      binary("done", "==", "masked", "one", BOOLEAN),
      ...consumed(),
    ]);
    expect(result.booleanMaskTests.get("masked")).toEqual({
      form: "byte",
      constant: 1,
      mask: 3,
    });
  });

  it("does not select a constant wider than one byte", () => {
    const result = selection([
      read(),
      constant("mask", 14n),
      binary("masked", "&", "read", "mask"),
      constant("wide", 300n),
      binary("done", "==", "masked", "wide", BOOLEAN),
      ...consumed(),
    ]);
    expect(result.booleanMaskTests.size).toBe(0);
  });

  it("selects a wide word mask and records the high mask byte", () => {
    const word = sourceParameter(210, WORD);
    const result = selection([
      loadOperation("w", word, 211),
      constant("mask", 258n, WORD),
      binary("masked", "&", "w", "mask", WORD),
      constant("zero", 0n, WORD),
      binary("done", "!=", "masked", "zero", BOOLEAN),
      ...consumed(),
    ]);
    expect(result.booleanMaskTests.get("masked")).toEqual({
      form: "word-align",
      constant: 0,
      mask: 258,
      highMask: 1,
    });
  });

  it("selects a mirrored wide word mask", () => {
    const word = sourceParameter(212, WORD);
    const result = selection([
      loadOperation("w", word, 213),
      constant("mask", 258n, WORD),
      binary("masked", "&", "mask", "w", WORD),
      constant("zero", 0n, WORD),
      binary("done", "!=", "masked", "zero", BOOLEAN),
      ...consumed(),
    ]);
    expect(result.booleanMaskTests.get("masked")?.form).toBe("word-align");
  });

  it("selects a high-byte-only general constant", () => {
    const word = sourceParameter(240, WORD);
    const result = selection([
      loadOperation("w", word, 241),
      constant("mask", 768n, WORD),
      binary("masked", "&", "w", "mask", WORD),
      constant("high", 256n, WORD),
      binary("done", "==", "masked", "high", BOOLEAN),
      ...consumed(),
    ]);
    expect(result.booleanMaskTests.get("masked")?.form).toBe("word-high");
    expect(result.booleanMaskTests.get("masked")?.constant).toBe(256);
  });

  it("keeps a byte-masked word on the zero-extension path", () => {
    const word = sourceParameter(214, WORD);
    const result = selection([
      loadOperation("w", word, 215),
      constant("mask", 2n, WORD),
      binary("masked", "&", "w", "mask", WORD),
      constant("zero", 0n, WORD),
      binary("done", "!=", "masked", "zero", BOOLEAN),
      ...consumed(),
    ]);
    expect(result.booleanMaskTests.size).toBe(0);
    expect(result.booleanShiftValues.get("masked")).toBe(1);
  });

  it("selects the general join for a word constant outside the mask", () => {
    const word = sourceParameter(216, WORD);
    const result = selection([
      loadOperation("w", word, 217),
      constant("mask", 258n, WORD),
      binary("masked", "&", "w", "mask", WORD),
      constant("other", 4n, WORD),
      binary("done", "!=", "masked", "other", BOOLEAN),
      ...consumed(),
    ]);
    expect(result.booleanMaskTests.get("masked")?.form).toBe("word");
  });

  it("selects the general join for a multi-bit-per-byte word mask", () => {
    const word = sourceParameter(220, WORD);
    const result = selection([
      loadOperation("w", word, 221),
      constant("mask", 0x0303n, WORD),
      binary("masked", "&", "w", "mask", WORD),
      constant("zero", 0n, WORD),
      binary("done", "!=", "masked", "zero", BOOLEAN),
      ...consumed(),
    ]);
    expect(result.booleanMaskTests.get("masked")?.form).toBe("word");
  });
});

describe("general masked comparison lowering", () => {
  it("uses the zero test branch for a single-bit identity", () => {
    const blocks = materialized([
      read(),
      constant("mask", 8n),
      binary("masked", "&", "read", "mask"),
      constant("eight", 8n),
      binary("done", "==", "masked", "eight", BOOLEAN),
      ...consumed(),
    ]);
    const entry = blocks.find((block) => block.label === "entry")!;
    expect(entry.instructions.map(({ opcode }) => opcode)).toEqual(["lda", "and"]);
    expect(entry.terminator.kind).toBe("branch");
    if (entry.terminator.kind === "branch") expect(entry.terminator.opcode).toBe("beq");
    const all = blocks.flatMap((block) => block.instructions);
    expect(all.filter(({ opcode }) => opcode === "cmp")).toEqual([]);
    // Instruction-only body; each branch terminator adds its own two bytes.
    expect(cost(all)).toEqual({ bytes: 10, cycles: 12 });
  });

  it("uses EOR rather than CMP so equality leaves A zero", () => {
    const blocks = materialized([
      read(),
      constant("mask", 3n),
      binary("masked", "&", "read", "mask"),
      constant("one", 1n),
      binary("done", "==", "masked", "one", BOOLEAN),
      ...consumed(),
    ]);
    const entry = blocks.find((block) => block.label === "entry")!;
    expect(entry.instructions.map(({ opcode }) => opcode)).toEqual(["lda", "and", "eor"]);
    expect(entry.instructions.find(({ opcode }) => opcode === "eor")?.operand).toEqual({
      kind: "immediate",
      value: 1,
    });
    expect(cost(blocks.flatMap((block) => block.instructions))).toEqual({
      bytes: 14,
      cycles: 16,
    });
  });

  it("aligns both selected bits of a single-bit-per-byte word mask", () => {
    const word = sourceParameter(218, WORD);
    const blocks = materialized([
      loadOperation("w", word, 219),
      constant("mask", 258n, WORD),
      binary("masked", "&", "w", "mask", WORD),
      constant("zero", 0n, WORD),
      binary("done", "!=", "masked", "zero", BOOLEAN),
      ...consumed(),
    ]);
    const entry = blocks.find((block) => block.label === "entry")!;
    expect(entry.instructions.map(({ opcode }) => opcode)).toEqual([
      "lda",
      "lsr",
      "ora",
      "and",
      "sta",
    ]);
    expect(cost(entry.instructions)).toEqual({ bytes: 12, cycles: 16 });
  });

  it("normalizes a high aligned bit with ASL, LDA #0 and ROL", () => {
    const word = sourceParameter(230, WORD);
    const blocks = materialized([
      loadOperation("w", word, 231),
      constant("mask", 0x8080n, WORD),
      binary("masked", "&", "w", "mask", WORD),
      constant("zero", 0n, WORD),
      binary("done", "!=", "masked", "zero", BOOLEAN),
      ...consumed(),
    ]);
    const entry = blocks.find((block) => block.label === "entry")!;
    expect(entry.instructions.map(({ opcode }) => opcode)).toEqual([
      "lda",
      "ora",
      "asl",
      "lda",
      "rol",
      "sta",
    ]);
    expect(cost(entry.instructions)).toEqual({ bytes: 13, cycles: 18 });
  });

  it("joins both masked bytes of a multi-bit word mask without a temporary", () => {
    const word = sourceParameter(222, WORD);
    const blocks = materialized([
      loadOperation("w", word, 223),
      constant("mask", 0x0303n, WORD),
      binary("masked", "&", "w", "mask", WORD),
      constant("zero", 0n, WORD),
      binary("done", "!=", "masked", "zero", BOOLEAN),
      ...consumed(),
    ]);
    const entry = blocks.find((block) => block.label === "entry")!;
    expect(entry.instructions.map(({ opcode, operand }) => [opcode, operand])).toEqual([
      ["lda", { kind: "storage", requestId: expect.any(String), offset: 0 }],
      ["and", { kind: "immediate", value: 3 }],
    ]);
    expect(entry.terminator.kind).toBe("branch");
    if (entry.terminator.kind === "branch") expect(entry.terminator.opcode).toBe("bne");
    const high = blocks.find((block) => block.label === `${entry.label}.boolean.0.high`)!;
    expect(high.instructions.map(({ opcode }) => opcode)).toEqual(["lda", "and"]);
    const all = blocks.flatMap((block) => block.instructions);
    expect(all.filter(({ opcode }) => opcode === "sta")).toHaveLength(1);
    expect(cost(all)).toEqual({ bytes: 15, cycles: 18 });
  });
});
