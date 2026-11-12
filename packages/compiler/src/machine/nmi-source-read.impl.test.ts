import { describe, expect, it } from "vitest";
import type { PlatformOperation, SemanticOperation } from "../semantic/operations.js";
import { selectRegisterForwarding } from "./lower-register-forwarding.js";
import type { MachineInstruction } from "./machine-types.js";
import {
  BYTE,
  VOID,
  WORD,
  lowerFunctions,
  semanticBlock,
  semanticFunction,
  sourceSpan,
} from "./lowering-test-support.js";

const span = sourceSpan(100);

/** The consuming CIA2 read used by every case: one volatile byte result in A. */
function read(result = "read", type = BYTE): PlatformOperation {
  return {
    kind: "platform",
    capability: "c64.cia2.readAndClearPendingSources",
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

/** One byte binary operation with the given operator and operands. */
function binary(
  result: string,
  operator: "&" | "|" | "^" | "+" | "!=" | "==",
  left: string,
  right: string,
): SemanticOperation {
  return { kind: "binary", result, operator, left, right, type: BYTE, integer: null, span };
}

/** Ask the real selector whether the read stays in A for this exact block. */
function forwards(operations: readonly SemanticOperation[], singleUse = true): boolean {
  return selectRegisterForwarding(
    [semanticBlock("entry", operations, { kind: "return", value: null })],
    new Set(singleUse ? ["read"] : []),
  ).forwardedRegisterValues.has("read");
}

describe("platform byte forwarding into an adjacent constant mask", () => {
  // The delivered form: read, constant mask, and one bitwise consumer.
  it("forwards the read when the mask is the constant right operand", () => {
    expect(forwards([read(), constant("mask", 1n), binary("masked", "&", "read", "mask")])).toBe(
      true,
    );
  });

  // The bitwise lowering commutes a register-A right operand with a constant left.
  it("forwards the read when the constant is the left operand", () => {
    expect(forwards([read(), constant("mask", 1n), binary("masked", "&", "mask", "read")])).toBe(
      true,
    );
  });

  // A second machine consumer would need A twice, which the rule never grants.
  it("does not forward a multi-use read", () => {
    expect(
      forwards([read(), constant("mask", 1n), binary("masked", "&", "read", "mask")], false),
    ).toBe(false);
  });

  // A non-constant operand may need a load that clobbers A before the ALU operation.
  it("does not forward a read consumed by a non-constant mask", () => {
    expect(forwards([read(), binary("masked", "&", "read", "other")])).toBe(false);
  });

  // A word read is not proven to leave its byte in A under this rule.
  it("does not forward a word read", () => {
    expect(
      forwards([read("read", WORD), constant("mask", 1n), binary("masked", "&", "read", "mask")]),
    ).toBe(false);
  });

  // Only the bitwise consumer shape is proved; a bare zero test stays retained.
  it("does not forward a read consumed by a comparison", () => {
    expect(forwards([read(), constant("zero", 0n), binary("done", "!=", "read", "zero")])).toBe(
      false,
    );
  });

  // Arithmetic does not guarantee the same A/operand order.
  it("does not forward a read consumed by addition", () => {
    expect(forwards([read(), constant("one", 1n), binary("sum", "+", "read", "one")])).toBe(false);
  });
});

/** Build the conditional witness as a semantic function and lower it. */
function conditionalLowering() {
  const entry = semanticBlock(
    "entry",
    [
      read(),
      constant("mask", 1n),
      binary("masked", "&", "read", "mask"),
      constant("zero", 0n),
      binary("pending", "!=", "masked", "zero"),
    ],
    { kind: "branch", condition: "pending", whenTrue: "store", whenFalse: "end" },
  );
  const store = semanticBlock(
    "store",
    [
      constant("one", 1n),
      constant("address", 0xc000n),
      {
        kind: "memory-write",
        address: "address",
        value: "one",
        width: 1,
        byteOrder: "low-first",
        volatile: true,
        span,
      },
    ],
    { kind: "jump", target: "end" },
  );
  const end = semanticBlock("end", [], { kind: "return", value: null });
  return lowerFunctions([semanticFunction(1000, "timerHandler", [], VOID, [entry, store, end])]);
}

/** Count bytes, or one path's maximum cycles, over emitted instructions. */
function bytes(instructions: readonly MachineInstruction[]): number {
  return instructions.reduce((total, instruction) => total + instruction.cost.bytes, 0);
}

function cycles(instructions: readonly MachineInstruction[]): number {
  return instructions.reduce((total, instruction) => total + instruction.cost.maxCycles, 0);
}

describe("conditional witness machine output", () => {
  // The body must keep the read in A, mask it once and branch before any store.
  it("emits the expert read/mask/branch/store body", () => {
    const lowered = conditionalLowering();
    if (lowered.kind !== "complete") throw new Error("Expected complete conditional lowering");
    const blocks = lowered.program.functions[0]!.blocks;
    const entry = blocks.find((block) => block.label === "entry");
    if (entry === undefined) throw new Error("Missing entry block");
    expect(entry.instructions.map(({ opcode, mode, operand }) => [opcode, mode, operand])).toEqual([
      ["lda", "absolute", { kind: "absolute", value: 0xdd0d }],
      ["and", "immediate", { kind: "immediate", value: 1 }],
    ]);
    expect(entry.terminator).toMatchObject({ kind: "branch", opcode: "bne" });
    const store = lowered.program.functions[0]!.blocks.find((block) => block.label === "store");
    if (store === undefined) throw new Error("Missing store block");
    expect(store.instructions.map(({ opcode }) => opcode)).toEqual(["lda", "sta"]);
    expect(store.instructions[0]!.operand).toEqual({ kind: "immediate", value: 1 });
    expect(store.instructions[1]!.operand).toEqual({ kind: "absolute", value: 0xc000 });

    // The exclusive NMI wrapper adds PHA/CLD/PLA/RTI: 4 bytes and 15 cycles.
    const body = blocks.flatMap((block) => block.instructions);
    const branch = entry.terminator;
    if (branch.kind !== "branch") throw new Error("Expected a branch terminator");
    // Store path: not-taken branch. Skip path: taken branch and no store block.
    // The model charges the conservative page-cross allowance, so the skip-path
    // maximum is 25; the same-page emitted code is 24.
    expect(bytes(body) + branch.cost.bytes + 4).toBe(16);
    expect(cycles(body) + branch.cost.minCycles + 15).toBe(29);
    expect(cycles(body) - cycles(store.instructions) + branch.cost.maxCycles + 15).toBe(25);
  });
});
