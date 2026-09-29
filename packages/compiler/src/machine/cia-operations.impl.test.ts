import { describe, expect, it } from "vitest";
import type { PlatformOperation } from "../semantic/operations.js";
import { lowerC64Operation, type C64LoweringSupport } from "./lower-c64.js";
import type { LoweredValue } from "./lower-control.js";
import type { MachineInstruction } from "./machine-types.js";
import {
  BYTE,
  VOID,
  WORD,
  loadOperation,
  lowerFunctions,
  semanticBlock,
  semanticFunction,
  selectedProfile,
  sourceParameter,
  sourceSpan,
} from "./lowering-test-support.js";

/** A direct selected-profile call, with already evaluated arguments. */
function operation(
  capability: string,
  arguments_: readonly string[] = [],
  result: string | null = null,
): PlatformOperation {
  return Object.freeze({
    kind: "platform",
    result,
    capability,
    arguments: Object.freeze(arguments_),
    type: result === null ? VOID : capability.includes("Counter") ? WORD : BYTE,
    effect: result === null ? "volatile-write" : "volatile-read",
    span: sourceSpan(100),
  });
}

/** Constant paths must never allocate a function temporary. */
const noScratch: C64LoweringSupport = {
  requestScratch: () => {
    throw new Error("Constant CIA operation must not request scratch storage");
  },
};

/** Physical CIA accesses are always visible and ordered in the machine representation. */
function deviceEffects(instructions: readonly MachineInstruction[]) {
  return instructions.flatMap(({ memory }) => memory);
}

/** Sum selected instruction costs without including startup or caller code. */
function instructionCost(instructions: readonly MachineInstruction[]) {
  return instructions.reduce(
    (sum, { cost }) => ({
      bytes: sum.bytes + cost.bytes,
      cycles: sum.cycles + cost.minCycles,
    }),
    { bytes: 0, cycles: 0 },
  );
}

describe("CIA direct machine operations", () => {
  it("retains low/high volatile counter reads and the expert six-byte sequence", () => {
    const lowered = lowerC64Operation(
      operation("c64.cia2.readTimerBCounter", [], "counter"),
      new Map(),
      selectedProfile(),
      noScratch,
    );
    expect(lowered.instructions.map(({ opcode }) => opcode)).toEqual(["lda", "ldx"]);
    expect(deviceEffects(lowered.instructions)).toEqual([
      {
        kind: "read",
        address: { kind: "absolute", value: 0xdd06 },
        width: 1,
        volatile: true,
        order: 0,
      },
      {
        kind: "read",
        address: { kind: "absolute", value: 0xdd07 },
        width: 1,
        volatile: true,
        order: 1,
      },
    ]);
    expect(lowered.result).toMatchObject({ kind: "register", registers: "ax", bytes: 2 });
    expect(instructionCost(lowered.instructions)).toEqual({ bytes: 6, cycles: 8 });
  });

  it("writes a retained word to the latch low byte before the high byte", () => {
    const values = new Map<string, LoweredValue>([
      ["period", { kind: "register", registers: "ax", bytes: 2 }],
    ]);
    const lowered = lowerC64Operation(
      operation("c64.cia1.writeTimerALatch", ["period"]),
      values,
      selectedProfile(),
      noScratch,
    );
    expect(lowered.instructions.map(({ opcode }) => opcode)).toEqual(["sta", "stx"]);
    expect(
      deviceEffects(lowered.instructions).map(({ address, order }) => ({ address, order })),
    ).toEqual([
      { address: { kind: "absolute", value: 0xdc04 }, order: 0 },
      { address: { kind: "absolute", value: 0xdc05 }, order: 1 },
    ]);
    expect(instructionCost(lowered.instructions)).toEqual({ bytes: 6, cycles: 8 });
  });

  it("folds constant control flags into one read/modify/write without scratch", () => {
    const lowered = lowerC64Operation(
      operation("c64.cia1.configureTimerA", ["flags"]),
      new Map([["flags", { kind: "constant", value: 0x11, bytes: 1 }]]),
      selectedProfile(),
      noScratch,
    );
    expect(lowered.instructions.map(({ opcode, operand }) => [opcode, operand])).toEqual([
      ["lda", { kind: "absolute", value: 0xdc0e }],
      ["and", { kind: "immediate", value: 0xc6 }],
      ["ora", { kind: "immediate", value: 0x11 }],
      ["sta", { kind: "absolute", value: 0xdc0e }],
    ]);
    expect(deviceEffects(lowered.instructions).map(({ kind, order }) => [kind, order])).toEqual([
      ["read", 0],
      ["write", 1],
    ]);
    expect(instructionCost(lowered.instructions)).toEqual({ bytes: 10, cycles: 12 });
  });

  it("stages dynamic flags in function-owned storage before reading control", () => {
    const flags = sourceParameter(400, BYTE);
    const fn = semanticFunction(390, "dynamic-control", [flags], VOID, [
      semanticBlock(
        "entry",
        [loadOperation("flags", flags, 410), operation("c64.cia1.configureTimerB", ["flags"])],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    const lowered = lowerFunctions([fn]);
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") throw new Error("Expected finite CIA scratch allocation");
    const scratch = lowered.program.requiredStorage.filter(({ id }) =>
      id.endsWith(":cia-control-flags"),
    );
    expect(scratch).toHaveLength(1);
    expect(scratch[0]?.bytes).toBe(1);
    const instructions = lowered.program.functions[0]!.blocks[0]!.instructions;
    const read = instructions.findIndex(
      ({ opcode, operand }) =>
        opcode === "lda" && operand?.kind === "absolute" && operand.value === 0xdc0f,
    );
    const staged = instructions.findIndex(
      ({ opcode, operand }) =>
        opcode === "sta" && operand?.kind === "storage" && operand.requestId === scratch[0]?.id,
    );
    const merged = instructions.findIndex(
      ({ opcode, operand }) =>
        opcode === "ora" && operand?.kind === "storage" && operand.requestId === scratch[0]?.id,
    );
    expect(staged).toBeGreaterThanOrEqual(0);
    expect(staged).toBeLessThan(read);
    expect(merged).toBeGreaterThan(read);
    expect(
      instructions.some(
        ({ opcode, operand }) =>
          opcode === "and" && operand?.kind === "immediate" && operand.value === 0x59,
      ),
    ).toBe(true);
  });

  it("uses one ICR write per constant mask and one consuming read", () => {
    const profile = selectedProfile();
    const enable = lowerC64Operation(
      operation("c64.cia1.enableInterruptSources", ["mask"]),
      new Map([["mask", { kind: "constant", value: 0x03, bytes: 1 }]]),
      profile,
      noScratch,
    );
    const disable = lowerC64Operation(
      operation("c64.cia1.disableInterruptSources", ["mask"]),
      new Map([["mask", { kind: "constant", value: 0x1f, bytes: 1 }]]),
      profile,
      noScratch,
    );
    const pending = lowerC64Operation(
      operation("c64.cia1.readAndClearPendingSources", [], "pending"),
      new Map(),
      profile,
      noScratch,
    );
    expect(enable.instructions.map(({ opcode, operand }) => [opcode, operand])).toEqual([
      ["lda", { kind: "immediate", value: 0x83 }],
      ["sta", { kind: "absolute", value: 0xdc0d }],
    ]);
    expect(disable.instructions[0]?.operand).toEqual({ kind: "immediate", value: 0x1f });
    expect(pending.instructions.map(({ opcode }) => opcode)).toEqual(["lda"]);
    expect(pending.result).toMatchObject({ kind: "register", registers: "a", bytes: 1 });
    expect(
      [
        ...deviceEffects(enable.instructions),
        ...deviceEffects(disable.instructions),
        ...deviceEffects(pending.instructions),
      ].map(({ kind, address }) => [kind, address]),
    ).toEqual([
      ["write", { kind: "absolute", value: 0xdc0d }],
      ["write", { kind: "absolute", value: 0xdc0d }],
      ["read", { kind: "absolute", value: 0xdc0d }],
    ]);
    expect(instructionCost(enable.instructions)).toEqual({ bytes: 5, cycles: 6 });
    expect(instructionCost(disable.instructions)).toEqual({ bytes: 5, cycles: 6 });
    expect(instructionCost(pending.instructions)).toEqual({ bytes: 3, cycles: 4 });
  });
});
