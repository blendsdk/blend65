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
  VOID,
  loadOperation,
  lowerFunctions,
  semanticBlock,
  semanticFunction,
  sourceParameter,
  sourceSpan,
} from "./lowering-test-support.js";

const span = sourceSpan(100);

/** One direct volatile byte read in the selected cooperative route. */
function read(
  result = "read",
  capability = "c64.cia2.readAndClearPendingSources",
  type = BYTE,
): PlatformOperation {
  return {
    kind: "platform",
    capability,
    result,
    arguments: [],
    type,
    effect: "volatile-read",
    span,
  };
}

/** One compile-time byte constant. */
function constant(result: string, value: bigint): SemanticOperation {
  return { kind: "constant", result, value, type: BYTE, integer: null, span };
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

/** Ask the real selector which values stay in A, own Z, or hold a Boolean. */
function selection(operations: readonly SemanticOperation[], singleUse = true, branch = false) {
  const terminator = branch
    ? ({ kind: "branch", condition: "done", whenTrue: "store", whenFalse: "end" } as const)
    : ({ kind: "return", value: null } as const);
  return selectRegisterForwarding(
    [semanticBlock("entry", operations, terminator)],
    new Set(singleUse ? ["read", "mask", "masked", "done"] : []),
  );
}

describe("direct-read Z ownership", () => {
  it("forwards the read and grants Z for an adjacent zero branch", () => {
    const result = selection(
      [read(), constant("zero", 0n), binary("done", "!=", "read", "zero")],
      true,
      true,
    );
    expect(result.forwardedRegisterValues.has("read")).toBe(true);
    expect(result.zeroFlagValues.has("read")).toBe(true);
  });

  it("does not grant Z without a branch terminator", () => {
    const selected = selection(
      [read(), constant("zero", 0n), binary("done", "!=", "read", "zero")],
      true,
      false,
    );
    expect(selected.zeroFlagValues.has("read")).toBe(false);
  });

  it("does not grant Z to a non-direct platform operation", () => {
    const wait: PlatformOperation = { ...read(), capability: "c64.video.waitNextFrame" };
    const selected = selection(
      [wait, constant("zero", 0n), binary("done", "!=", "read", "zero")],
      true,
      true,
    );
    expect(selected.zeroFlagValues.has("read")).toBe(false);
  });

  it("keeps the CIA1 store path stable while granting Z to a zero branch", () => {
    const stored = selection([
      read("read", "c64.cia1.readAndClearPendingSources"),
      constant("address", 0xc000n),
      write("address", "read"),
    ]);
    expect(stored.forwardedRegisterValues.has("read")).toBe(false);
    const branched = selection(
      [
        read("read", "c64.cia1.readAndClearPendingSources"),
        constant("zero", 0n),
        binary("done", "!=", "read", "zero"),
      ],
      true,
      true,
    );
    expect(branched.zeroFlagValues.has("read")).toBe(true);
  });

  it("reuses Z when the zero constant is converted", () => {
    const selected = selection(
      [
        read(),
        constant("zero", 0n),
        {
          kind: "convert",
          result: "convertedZero",
          operand: "zero",
          conversion: "identity",
          type: BYTE,
          integer: null,
          span,
        },
        binary("done", "!=", "read", "convertedZero"),
      ],
      true,
      true,
    );
    expect(selected.zeroFlagValues.has("read")).toBe(true);
  });
});

describe("Boolean mask-one identity", () => {
  const operations = [
    read(),
    constant("one", 1n),
    binary("masked", "&", "read", "one"),
    constant("zero", 0n),
    binary("done", "!=", "masked", "zero", BOOLEAN),
    constant("address", 0xc000n),
    constant("value", 1n),
    write("address", "done"),
  ];

  it("marks the mask result Boolean and forwards both A producers", () => {
    const result = selection(operations);
    expect(result.booleanValues.has("masked")).toBe(true);
    expect(result.forwardedRegisterValues.has("masked")).toBe(true);
    expect(result.forwardedRegisterValues.has("done")).toBe(true);
  });

  it("does not mark a mask other than one", () => {
    const other = operations.map((operation) =>
      operation.kind === "constant" && operation.result === "one" ? constant("one", 2n) : operation,
    );
    expect(selection(other).booleanValues.has("masked")).toBe(false);
  });
});

describe("addressable bitwise mask", () => {
  const mask = sourceParameter(200, BYTE);

  it("forwards the read into an empty-path byte mask", () => {
    const result = selection([
      read(),
      loadOperation("mask", mask, 201),
      binary("masked", "&", "read", "mask"),
    ]);
    expect(result.forwardedRegisterValues.has("read")).toBe(true);
  });

  it("does not forward into a converted mask", () => {
    const result = selection([
      read(),
      loadOperation("maskValue", mask, 201),
      {
        kind: "convert",
        result: "mask",
        operand: "maskValue",
        conversion: "identity",
        type: BYTE,
        integer: null,
        span,
      },
      binary("masked", "&", "read", "mask"),
    ]);
    expect(result.forwardedRegisterValues.has("read")).toBe(false);
  });

  it("does not forward a multi-use read", () => {
    const result = selectRegisterForwarding(
      [
        semanticBlock(
          "entry",
          [read(), loadOperation("mask", mask, 201), binary("masked", "&", "read", "mask")],
          { kind: "return", value: null },
        ),
      ],
      new Set(["mask", "masked"]),
    );
    expect(result.forwardedRegisterValues.has("read")).toBe(false);
  });

  it("does not forward into a multi-use mask load", () => {
    const result = selectRegisterForwarding(
      [
        semanticBlock(
          "entry",
          [
            read(),
            loadOperation("mask", mask, 201),
            binary("masked", "&", "read", "mask"),
            binary("again", "|", "masked", "mask"),
          ],
          { kind: "return", value: null },
        ),
      ],
      new Set(["read", "masked", "again"]),
    );
    expect(result.forwardedRegisterValues.has("read")).toBe(false);
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
function cost(instructions: readonly MachineInstruction[], branch?: MachineInstruction) {
  const all = branch === undefined ? instructions : [...instructions, branch];
  return all.reduce(
    (total, instruction) => ({
      bytes: total.bytes + instruction.cost.bytes,
      cycles: total.cycles + instruction.cost.maxCycles,
    }),
    { bytes: 0, cycles: 0 },
  );
}

describe("exact residual machine witnesses", () => {
  it("emits the bare zero read and branch body", () => {
    const handler = semanticFunction(1000, "timerHandler", [], VOID, [
      conditionalBlock([read(), constant("zero", 0n), binary("done", "!=", "read", "zero")]),
      storeBlock(),
      semanticBlock("end", [], { kind: "return", value: null }),
    ]);
    const lowered = lowerFunctions([handler]);
    if (lowered.kind !== "complete") throw new Error(lowered.reason);
    const entry = lowered.program.functions[0]!.blocks.find((block) => block.label === "entry")!;
    expect(entry.instructions.map(({ opcode, mode, operand }) => [opcode, mode, operand])).toEqual([
      ["lda", "absolute", { kind: "absolute", value: 0xdd0d }],
    ]);
    const branch = entry.terminator;
    if (branch.kind !== "branch") throw new Error("Expected a branch");
    expect(branch.opcode).toBe("bne");
    const store = lowered.program.functions[0]!.blocks.find((block) => block.label === "store")!;
    expect(store.instructions.map(({ opcode }) => opcode)).toEqual(["lda", "sta"]);
    // Wrapper PHA/CLD/PLA/RTI: 4 bytes. The pre-layout witness branches to the
    // store; final block layout inverts it to the 27/22-cycle BEQ form pinned by
    // the four-profile specification oracle.
    expect(
      cost(entry.instructions).bytes + branch.cost.bytes + cost(store.instructions).bytes + 4,
    ).toBe(14);
  });

  it("emits the Boolean mask-one identity body", () => {
    const handler = semanticFunction(1010, "timerHandler", [], VOID, [
      semanticBlock(
        "entry",
        [
          read(),
          constant("one", 1n),
          binary("masked", "&", "read", "one"),
          constant("zero", 0n),
          binary("done", "!=", "masked", "zero", BOOLEAN),
          constant("address", 0xc000n),
          constant("value", 1n),
          write("address", "done"),
        ],
        { kind: "return", value: null },
      ),
    ]);
    const lowered = lowerFunctions([handler]);
    if (lowered.kind !== "complete") throw new Error(lowered.reason);
    const entry = lowered.program.functions[0]!.blocks[0]!;
    expect(entry.instructions.map(({ opcode, mode, operand }) => [opcode, mode, operand])).toEqual([
      ["lda", "absolute", { kind: "absolute", value: 0xdd0d }],
      ["and", "immediate", { kind: "immediate", value: 1 }],
      ["sta", "absolute", { kind: "absolute", value: 0xc000 }],
    ]);
    expect(cost(entry.instructions).bytes + 4).toBe(12);
    expect(cost(entry.instructions).cycles + 15).toBe(25);
  });

  it("emits one inversion for the Boolean equality inverse", () => {
    const handler = semanticFunction(1020, "timerHandler", [], VOID, [
      semanticBlock(
        "entry",
        [
          read(),
          constant("one", 1n),
          binary("masked", "&", "read", "one"),
          constant("zero", 0n),
          binary("done", "==", "masked", "zero", BOOLEAN),
          constant("address", 0xc000n),
          constant("value", 1n),
          write("address", "done"),
        ],
        { kind: "return", value: null },
      ),
    ]);
    const lowered = lowerFunctions([handler]);
    if (lowered.kind !== "complete") throw new Error(lowered.reason);
    const entry = lowered.program.functions[0]!.blocks[0]!;
    expect(entry.instructions.map(({ opcode, mode, operand }) => [opcode, mode, operand])).toEqual([
      ["lda", "absolute", { kind: "absolute", value: 0xdd0d }],
      ["and", "immediate", { kind: "immediate", value: 1 }],
      ["eor", "immediate", { kind: "immediate", value: 1 }],
      ["sta", "absolute", { kind: "absolute", value: 0xc000 }],
    ]);
    expect(cost(entry.instructions).bytes + 4).toBe(14);
    expect(cost(entry.instructions).cycles + 15).toBe(27);
  });
});
