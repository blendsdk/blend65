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
function read(): PlatformOperation {
  return {
    kind: "platform",
    capability: "c64.cia2.readAndClearPendingSources",
    result: "read",
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

/** One binary operation of the requested width. */
function binary(
  result: string,
  operator: "&" | "==" | "!=",
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

/** The selected masked-value and zero-test window for one mask. */
function maskedValue(
  mask: bigint,
  operator: "==" | "!=",
  maskOnLeft = false,
): readonly SemanticOperation[] {
  return [
    read(),
    constant("mask", mask),
    maskOnLeft ? binary("masked", "&", "mask", "read") : binary("masked", "&", "read", "mask"),
    constant("zero", 0n),
    binary("done", operator, "masked", "zero", BOOLEAN),
  ];
}

/** The one A consumer that makes the comparison materialized. */
const consumed = (): readonly SemanticOperation[] => [
  constant("address", 0xc000n),
  constant("one", 1n),
  write("address", "done"),
];

/** Ask the real selector which values stay in A or carry a branch/shift/set fact. */
function selection(operations: readonly SemanticOperation[]) {
  return selectRegisterForwarding(
    [semanticBlock("entry", operations, { kind: "return", value: null })],
    new Set(
      operations
        .filter(
          (operation): operation is SemanticOperation & { result: string } =>
            "result" in operation && operation.result !== null,
        )
        .map((operation) => operation.result),
    ),
  );
}

/** Lower one materialized Boolean handler and return its machine blocks. */
function loweredBlocks(operations: readonly SemanticOperation[]) {
  const handler = semanticFunction(1000, "timerHandler", [], VOID, [
    semanticBlock("entry", operations, { kind: "return", value: null }),
  ]);
  const lowered = lowerFunctions([handler]);
  if (lowered.kind !== "complete") throw new Error(lowered.reason);
  return lowered.program.functions[0]!.blocks;
}

/** Total bytes and static path-max cycles of one instruction list. */
function cost(instructions: readonly MachineInstruction[]) {
  return instructions.reduce(
    (total, instruction) => ({
      bytes: total.bytes + instruction.cost.bytes,
      cycles: total.cycles + instruction.cost.maxCycles,
    }),
    { bytes: 0, cycles: 0 },
  );
}

describe("remaining Boolean mask selection", () => {
  it.each([
    [8n, "!="],
    [8n, "=="],
    [3n, "!="],
    [3n, "=="],
    [0x80n, "!="],
  ] as const)("selects mask %s %s through the inline branch", (mask, operator) => {
    const result = selection([...maskedValue(mask, operator), ...consumed()]);
    expect(result.booleanShiftValues.has("masked")).toBe(false);
    expect(result.booleanBranchValues.has("masked")).toBe(true);
    expect(result.forwardedRegisterValues.has("masked")).toBe(true);
    expect(result.forwardedRegisterValues.has("done")).toBe(true);
  });

  it("selects the mirrored masked operand through the inline branch", () => {
    const result = selection([...maskedValue(8n, "!=", true), ...consumed()]);
    expect(result.booleanBranchValues.has("masked")).toBe(true);
  });

  it("keeps masks one, two and four on their existing identity and shift paths", () => {
    const one = selection([...maskedValue(1n, "!="), ...consumed()]);
    expect(one.booleanValues.has("masked")).toBe(true);
    expect(one.booleanBranchValues.has("masked")).toBe(false);
    const two = selection([...maskedValue(2n, "!="), ...consumed()]);
    expect(two.booleanShiftValues.get("masked")).toBe(1);
    expect(two.booleanBranchValues.has("masked")).toBe(false);
    const four = selection([...maskedValue(4n, "!="), ...consumed()]);
    expect(four.booleanShiftValues.get("masked")).toBe(2);
  });

  it("does not select the zero mask, which the folds handle", () => {
    const result = selection([...maskedValue(0n, "!="), ...consumed()]);
    expect(result.booleanBranchValues.has("masked")).toBe(false);
  });

  it("selects an addressable runtime mask through the branch", () => {
    const mask = sourceParameter(200, BYTE);
    const result = selection([
      read(),
      loadOperation("mask", mask, 201),
      binary("masked", "&", "read", "mask"),
      constant("zero", 0n),
      binary("done", "!=", "masked", "zero", BOOLEAN),
      ...consumed(),
    ]);
    expect(result.booleanBranchValues.has("masked")).toBe(true);
  });

  it("selects the mirrored runtime mask and leaves the read in A", () => {
    const mask = sourceParameter(210, BYTE);
    const result = selection([
      read(),
      loadOperation("mask", mask, 211),
      binary("masked", "&", "mask", "read"),
      constant("zero", 0n),
      binary("done", "!=", "masked", "zero", BOOLEAN),
      ...consumed(),
    ]);
    expect(result.booleanBranchValues.has("masked")).toBe(true);
    expect(result.forwardedRegisterValues.has("read")).toBe(true);
  });

  it("selects a byte-masked word through the shift identity", () => {
    const word = sourceParameter(220, WORD);
    const result = selection([
      loadOperation("wordValue", word, 221),
      constant("mask", 2n, WORD),
      binary("masked", "&", "wordValue", "mask", WORD),
      constant("zero", 0n, WORD),
      binary("done", "!=", "masked", "zero", BOOLEAN),
      ...consumed(),
    ]);
    expect(result.booleanShiftValues.get("masked")).toBe(1);
    expect(result.booleanBranchValues.has("masked")).toBe(false);
  });

  it("does not select a 16-bit word mask", () => {
    const word = sourceParameter(230, WORD);
    const result = selection([
      loadOperation("wordValue", word, 231),
      constant("mask", 258n, WORD),
      binary("masked", "&", "wordValue", "mask", WORD),
      constant("zero", 0n, WORD),
      binary("done", "!=", "masked", "zero", BOOLEAN),
      ...consumed(),
    ]);
    expect(result.booleanShiftValues.has("masked")).toBe(false);
    expect(result.booleanBranchValues.has("masked")).toBe(false);
  });

  it("does not select a multi-use masked value", () => {
    const operations = [
      ...maskedValue(8n, "!="),
      ...consumed(),
      binary("again", "&", "masked", "mask"),
    ];
    const result = selectRegisterForwarding(
      [semanticBlock("entry", operations, { kind: "return", value: null })],
      new Set(["read", "mask", "done"]),
    );
    expect(result.booleanBranchValues.has("masked")).toBe(false);
  });

  it("does not select a branch condition", () => {
    const operations = maskedValue(8n, "!=");
    const result = selectRegisterForwarding(
      [
        semanticBlock("entry", operations, {
          kind: "branch",
          condition: "done",
          whenTrue: "store",
          whenFalse: "end",
        }),
        semanticBlock(
          "store",
          [constant("address", 0xc000n), constant("one", 1n), write("address", "one")],
          { kind: "jump", target: "end" },
        ),
        semanticBlock("end", [], { kind: "return", value: null }),
      ],
      new Set(["read", "mask", "done"]),
    );
    expect(result.booleanBranchValues.has("masked")).toBe(false);
  });

  it("selects the mask-one word identity", () => {
    const word = sourceParameter(260, WORD);
    const result = selection([
      loadOperation("wordValue", word, 261),
      constant("mask", 1n, WORD),
      binary("masked", "&", "wordValue", "mask", WORD),
      constant("zero", 0n, WORD),
      binary("done", "!=", "masked", "zero", BOOLEAN),
      ...consumed(),
    ]);
    expect(result.booleanValues.has("masked")).toBe(true);
    expect(result.booleanBranchValues.has("masked")).toBe(false);
  });

  it("falls back to the constant fold when a selected mask folds", () => {
    const blocks = loweredBlocks([
      constant("value", 5n),
      constant("mask", 8n),
      binary("masked", "&", "value", "mask"),
      constant("zero", 0n),
      binary("done", "!=", "masked", "zero", BOOLEAN),
      ...consumed(),
    ]);
    const entry = blocks.find((block) => block.label === "entry")!;
    expect(entry.instructions.map(({ opcode }) => opcode)).toEqual(["lda", "sta"]);
    expect(blocks.some((block) => block.label.includes(".boolean."))).toBe(false);
  });

  it("does not select a nonzero-constant comparison", () => {
    const operations = [
      read(),
      constant("mask", 8n),
      binary("masked", "&", "read", "mask"),
      constant("eight", 8n),
      binary("done", "!=", "masked", "eight", BOOLEAN),
      ...consumed(),
    ];
    const result = selection(operations);
    expect(result.booleanBranchValues.has("masked")).toBe(false);
  });

  it("does not select a computed runtime mask", () => {
    const mask = sourceParameter(240, BYTE);
    const result = selection([
      read(),
      loadOperation("mask", mask, 241),
      binary("computed", "&", "mask", "mask"),
      binary("masked", "&", "read", "computed"),
      constant("zero", 0n),
      binary("done", "!=", "masked", "zero", BOOLEAN),
      ...consumed(),
    ]);
    expect(result.booleanBranchValues.has("masked")).toBe(false);
  });
});

describe("inline Boolean branch output", () => {
  it("emits the expert not-equal shape", () => {
    const blocks = loweredBlocks([...maskedValue(8n, "!="), ...consumed()]);
    const entry = blocks.find((block) => block.label === "entry")!;
    expect(entry.instructions.map(({ opcode, operand }) => [opcode, operand])).toEqual([
      ["lda", { kind: "absolute", value: 0xdd0d }],
      ["and", { kind: "immediate", value: 8 }],
    ]);
    expect(entry.terminator.kind).toBe("branch");
    if (entry.terminator.kind === "branch") {
      expect(entry.terminator.opcode).toBe("beq");
      expect(entry.terminator.target).toContain(".boolean.0.continue");
    }
    const nonzero = blocks.find((block) => block.label.endsWith(".boolean.0.nonzero"))!;
    expect(nonzero.instructions.map(({ opcode }) => opcode)).toEqual(["lda"]);
    expect(cost(entry.instructions)).toEqual({ bytes: 5, cycles: 6 });
    expect(cost(nonzero.instructions)).toEqual({ bytes: 2, cycles: 2 });
  });

  it("emits the expert equal shape with one inversion on the zero arm", () => {
    const blocks = loweredBlocks([...maskedValue(3n, "=="), ...consumed()]);
    const entry = blocks.find((block) => block.label === "entry")!;
    expect(entry.terminator.kind).toBe("branch");
    if (entry.terminator.kind === "branch")
      expect(entry.terminator.target).toContain(".boolean.0.zero");
    const zero = blocks.find((block) => block.label.endsWith(".boolean.0.zero"))!;
    expect(zero.instructions.map(({ opcode }) => opcode)).toEqual(["eor"]);
    const continuation = blocks.find((block) => block.label.endsWith(".boolean.0.continue"))!;
    expect(continuation.instructions.map(({ opcode }) => opcode)).toEqual(["sta"]);
  });

  it("folds the zero mask and emits no AND", () => {
    const blocks = loweredBlocks([...maskedValue(0n, "!="), ...consumed()]);
    const entry = blocks.find((block) => block.label === "entry")!;
    expect(entry.instructions.map(({ opcode, operand }) => [opcode, operand])).toEqual([
      ["lda", { kind: "absolute", value: 0xdd0d }],
      ["lda", { kind: "immediate", value: 0 }],
      ["sta", { kind: "absolute", value: 0xc000 }],
    ]);
    expect(blocks.some((block) => block.label.includes(".boolean."))).toBe(false);
  });

  it("folds the inverse zero mask to a constant one", () => {
    const blocks = loweredBlocks([...maskedValue(0n, "=="), ...consumed()]);
    const entry = blocks.find((block) => block.label === "entry")!;
    expect(
      entry.instructions.filter(({ opcode }) => opcode === "lda").map(({ operand }) => operand),
    ).toEqual([
      { kind: "absolute", value: 0xdd0d },
      { kind: "immediate", value: 1 },
    ]);
  });

  it("keeps a zero-extended word only in A and tests its low byte", () => {
    const word = sourceParameter(250, WORD);
    const blocks = loweredBlocks([
      loadOperation("wordValue", word, 251),
      constant("mask", 2n, WORD),
      binary("masked", "&", "wordValue", "mask", WORD),
      constant("zero", 0n, WORD),
      binary("done", "!=", "masked", "zero", BOOLEAN),
      ...consumed(),
    ]);
    const entry = blocks.find((block) => block.label === "entry")!;
    expect(entry.instructions.map(({ opcode }) => opcode)).toEqual(["lda", "and", "lsr", "sta"]);
    expect(blocks.some((block) => block.label.includes(".boolean."))).toBe(false);
  });

  it("keeps the branch path-max at the expert total", () => {
    for (const [mask, operator, expected] of [
      [8n, "!=", 29],
      [3n, "==", 31],
    ] as const) {
      const blocks = loweredBlocks([...maskedValue(mask, operator), ...consumed()]);
      const entry = blocks.find((block) => block.label === "entry")!;
      const continuation = blocks.find((block) => block.label.endsWith(".boolean.0.continue"))!;
      const nonzero = blocks.find((block) => block.label.endsWith(".boolean.0.nonzero"))!;
      const zero = blocks.find((block) => block.label.endsWith(".boolean.0.zero"));
      expect(entry.terminator.kind).toBe("branch");
      if (entry.terminator.kind !== "branch") continue;
      const entryCost = cost(entry.instructions);
      const nonzeroCost = cost(nonzero.instructions).cycles;
      const zeroCost = zero === undefined ? 0 : cost(zero.instructions).cycles;
      const storeCost = cost(continuation.instructions).cycles;
      const taken = entryCost.cycles + entry.terminator.cost.maxCycles + zeroCost + storeCost;
      const untaken = entryCost.cycles + 2 + nonzeroCost + zeroCost + storeCost;
      expect(Math.max(taken, untaken) + 15).toBe(expected);
    }
  });

  it("keeps mask one on the identity path", () => {
    const blocks = loweredBlocks([...maskedValue(1n, "!="), ...consumed()]);
    const entry = blocks.find((block) => block.label === "entry")!;
    expect(entry.instructions.map(({ opcode }) => opcode)).toEqual(["lda", "and", "sta"]);
  });
});
