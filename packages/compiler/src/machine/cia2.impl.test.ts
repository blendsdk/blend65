import { describe, expect, it } from "vitest";
import type { PlatformOperation } from "../semantic/operations.js";
import { lowerC64Operation } from "./lower-c64.js";
import type { C64LoweringSupport } from "./lower-c64.js";
import type { LoweredValue } from "./lower-control.js";
import { lowerC64InterruptOperation } from "./lower-c64-interrupt.js";
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

/** Already-evaluated inputs leave device order and function-storage ownership to lowering. */
function operation(
  capability: string,
  arguments_: readonly string[] = [],
  result: string | null = null,
): PlatformOperation {
  return {
    kind: "platform",
    capability,
    arguments: arguments_,
    result,
    type: result === null ? VOID : capability.includes("Counter") ? WORD : BYTE,
    effect: result === null ? "volatile-write" : "volatile-read",
    span: sourceSpan(100),
  };
}

/** Fixed paths must not invent any private storage or runtime selector. */
const noScratch: C64LoweringSupport = {
  requestScratch: () => {
    throw new Error("Fixed CIA2 path requested private storage");
  },
};

/** A shutdown certificate is supplied by source/context proof, never inferred here. */
function restore(handback: boolean, capability = "c64.system.restoreNMI", matchingLowNmi = true) {
  return lowerC64InterruptOperation(operation(capability), selectedProfile(), {
    ...noScratch,
    interruptBinding: () => ({
      linkRequestId: "saved",
      entryLabel: null,
      matchingLowNmi,
      stockCia2Handback: handback,
    }),
  })!;
}

describe("direct CIA2 instruction and effect contracts", () => {
  it.each([
    ["A", 0xdd04],
    ["B", 0xdd06],
  ] as const)(
    "should write retained timer %s bytes low then high without scratch",
    (timer, address) => {
      const values = new Map<string, LoweredValue>([
        ["period", { kind: "register", registers: "ax", bytes: 2 }],
      ]);
      const lowered = lowerC64Operation(
        operation(`c64.cia2.writeTimer${timer}Latch`, ["period"]),
        values,
        selectedProfile(),
        noScratch,
      );
      expect(lowered.instructions.map(({ opcode, operand }) => [opcode, operand])).toEqual([
        ["sta", { kind: "absolute", value: address }],
        ["stx", { kind: "absolute", value: address + 1 }],
      ]);
      expect(
        lowered.instructions
          .flatMap(({ memory }) => memory)
          .map(({ kind, volatile, order }) => [kind, volatile, order]),
      ).toEqual([
        ["write", true, 0],
        ["write", true, 1],
      ]);
      expect(lowered.data).toEqual([]);
    },
  );

  it.each([
    ["A", 0xdd0e, 0xc6, 0x19],
    ["B", 0xdd0f, 0x86, 0x49],
  ] as const)(
    "should preserve unrelated timer %s control fields with one read and one write",
    (timer, address, mask, flags) => {
      const lowered = lowerC64Operation(
        operation(`c64.cia2.configureTimer${timer}`, ["flags"]),
        new Map([["flags", { kind: "constant", value: flags, bytes: 1 }]]),
        selectedProfile(),
        noScratch,
      );
      expect(lowered.instructions.map(({ opcode, operand }) => [opcode, operand])).toEqual([
        ["lda", { kind: "absolute", value: address }],
        ["and", { kind: "immediate", value: mask }],
        ["ora", { kind: "immediate", value: flags }],
        ["sta", { kind: "absolute", value: address }],
      ]);
      expect(
        lowered.instructions
          .flatMap(({ memory }) => memory)
          .map(({ kind, volatile, order }) => [kind, volatile, order]),
      ).toEqual([
        ["read", true, 0],
        ["write", true, 1],
      ]);
    },
  );

  it("should expose one consuming ICR read in A, not a read-modify-write or mask snapshot", () => {
    const lowered = lowerC64Operation(
      operation("c64.cia2.readAndClearPendingSources", [], "pending"),
      new Map(),
      selectedProfile(),
      noScratch,
    );
    expect(lowered.instructions.map(({ opcode, operand }) => [opcode, operand])).toEqual([
      ["lda", { kind: "absolute", value: 0xdd0d }],
    ]);
    expect(lowered.result).toMatchObject({ kind: "register", registers: "a", bytes: 1 });
    expect(lowered.instructions[0]!.memory).toEqual([
      {
        kind: "read",
        address: { kind: "absolute", value: 0xdd0d },
        width: 1,
        volatile: true,
        order: 0,
      },
    ]);
    expect(lowered.instructions[0]!.cost).toMatchObject({ bytes: 3, minCycles: 4, maxCycles: 4 });
  });

  it("should discover dynamic control staging before final function-storage closure", () => {
    const flags = sourceParameter(400, BYTE);
    const lowered = lowerFunctions([
      semanticFunction(390, "dynamic-cia2", [flags], VOID, [
        semanticBlock(
          "entry",
          [loadOperation("flags", flags, 410), operation("c64.cia2.configureTimerB", ["flags"])],
          { kind: "return", value: null },
        ),
      ]),
    ]);
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") throw new Error("Expected provisional scratch discovery");
    const scratch = lowered.program.requiredStorage.filter(({ id }) =>
      id.endsWith(":cia-control-flags"),
    );
    expect(scratch).toHaveLength(1);
    expect(scratch[0]!.bytes).toBe(1);
    const instructions = lowered.program.functions[0]!.blocks[0]!.instructions;
    const stage = instructions.findIndex(
      ({ opcode, operand }) =>
        opcode === "sta" && operand?.kind === "storage" && operand.requestId === scratch[0]!.id,
    );
    const read = instructions.findIndex(
      ({ opcode, operand }) =>
        opcode === "lda" && operand?.kind === "absolute" && operand.value === 0xdd0f,
    );
    expect(stage).toBeGreaterThanOrEqual(0);
    expect(stage).toBeLessThan(read);
    expect(
      instructions.some(
        ({ opcode, operand }) =>
          opcode === "and" && operand?.kind === "immediate" && operand.value === 0x59,
      ),
    ).toBe(true);
  });

  it("should publish stock first and preserve every ordered volatile shutdown effect", () => {
    const lowered = restore(true);
    const effects = lowered.instructions.flatMap(({ memory }) => memory);
    expect(
      effects.map(({ kind, address, width, volatile, order }) => [
        kind,
        address,
        width,
        volatile,
        order,
      ]),
    ).toEqual([
      ["write", { kind: "absolute", value: 0x0319 }, 1, true, 0],
      ["write", { kind: "absolute", value: 0xdd0d }, 1, true, 1],
      ["read", { kind: "absolute", value: 0xdd0e }, 1, true, 2],
      ["write", { kind: "absolute", value: 0xdd0e }, 1, true, 3],
      ["read", { kind: "absolute", value: 0xdd0f }, 1, true, 4],
      ["write", { kind: "absolute", value: 0xdd0f }, 1, true, 5],
      ["read", { kind: "absolute", value: 0xdd0d }, 1, true, 6],
    ]);
    expect(lowered.instructions.slice(0, 3).map(({ opcode }) => opcode)).toEqual([
      "php",
      "pha",
      "sei",
    ]);
    expect(lowered.instructions.slice(-2).map(({ opcode }) => opcode)).toEqual(["pla", "plp"]);
    expect(lowered.instructions.every(({ source }) => source?.start === 100)).toBe(true);
    expect(
      lowered.instructions.every(
        ({ defines }) => !defines.registers.includes("x") && !defines.registers.includes("y"),
      ),
    ).toBe(true);
    expect(lowered.instructions.at(-1)!.defines.flags).toEqual(
      expect.arrayContaining(["n", "v", "d", "i", "z", "c"]),
    );
    expect(
      lowered.instructions.reduce(
        (sum, { cost }) => ({ bytes: sum.bytes + cost.bytes, cycles: sum.cycles + cost.minCycles }),
        { bytes: 0, cycles: 0 },
      ),
    ).toEqual({ bytes: 38, cycles: 56 });
    expect(lowered.result).toBeNull();
    expect(lowered.data).toEqual([]);
  });

  it("should retain captured-predecessor removal when no shutdown certificate exists", () => {
    const lowered = restore(false);
    const effects = lowered.instructions.flatMap(({ memory }) => memory);
    expect(effects).toEqual([
      {
        kind: "read",
        address: { kind: "storage", requestId: "saved", offset: 1 },
        width: 1,
        volatile: false,
        order: 0,
      },
      {
        kind: "write",
        address: { kind: "absolute", value: 0x0319 },
        width: 1,
        volatile: true,
        order: 1,
      },
    ]);
    expect(lowered.instructions.some(({ opcode }) => opcode === "sei")).toBe(false);
  });

  it("should reject a misplaced or unproved shutdown certificate", () => {
    expect(() => restore(true, "c64.system.restoreIRQ")).toThrow(/CIA2 handback/);
    expect(() => restore(true, "c64.system.restoreNMI", false)).toThrow(/matching-low/);
  });
});
