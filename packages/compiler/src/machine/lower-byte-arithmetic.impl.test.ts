import { describe, expect, it } from "vitest";
import type { SemanticOperation } from "../semantic/operations.js";
import { machineInstruction } from "./lower-control.js";
import { appendScalarPrefix } from "./lower-scalar.js";
import type { MachineInstruction } from "./machine-types.js";
import { BYTE, WORD, selectedProfile, sourceSpan } from "./lowering-test-support.js";

const cpu = selectedProfile().cpu;
const span = sourceSpan(9940);
const operand = { kind: "storage" as const, requestId: "captured", offset: 1 };
const subtraction: SemanticOperation = {
  kind: "binary",
  result: "difference",
  operator: "-",
  left: "input",
  right: "one",
  type: BYTE,
  integer: null,
  span,
};

/** Official byte instructions expose the actual A/N/Z facts used by the appender. */
function immediate(opcode: string): MachineInstruction {
  return machineInstruction(cpu, opcode, "immediate", { kind: "immediate", value: 1 }, [], span);
}

/** A symbolic private home can be identical without a physical-address assumption. */
function home(opcode: string): MachineInstruction {
  return machineInstruction(cpu, opcode, "storage", operand, [], span);
}

const selected = [home("lda"), machineInstruction(cpu, "sec", "implied", null), immediate("sbc")];

describe("adjacent byte arithmetic private reload", () => {
  it.each(["lda", "and", "ora", "eor"])(
    "omits only the same private LDA after %s/STA with fresh A/N/Z",
    (opcode) => {
      const producer = immediate(opcode);
      const store = home("sta");
      const instructions = [producer, store];
      appendScalarPrefix(instructions, selected, subtraction);
      expect(instructions).toEqual([producer, store, ...selected.slice(1)]);
      expect(instructions[0]).toBe(producer);
      expect(instructions[1]).toBe(store);
      expect(instructions.at(-1)).toBe(selected.at(-1));
      expect(instructions.flatMap(({ memory }) => memory)).toEqual([]);
    },
  );

  it("applies the same proof to byte addition without deleting carry ownership", () => {
    const prefix = [immediate("lda"), home("sta")];
    const sum = [home("lda"), machineInstruction(cpu, "clc", "implied", null), immediate("adc")];
    const instructions = [...prefix];
    appendScalarPrefix(instructions, sum, { ...subtraction, operator: "+" });
    expect(instructions).toEqual([...prefix, ...sum.slice(1)]);
  });

  it.each(["adc", "sbc", "cmp", "tax"])(
    "keeps the LDA when %s does not establish the required fresh A/N/Z",
    (opcode) => {
      const producer =
        opcode === "tax" ? machineInstruction(cpu, opcode, "implied", null) : immediate(opcode);
      const prefix = [producer, home("sta")];
      const instructions = [...prefix];
      appendScalarPrefix(instructions, selected, subtraction);
      expect(instructions).toEqual([...prefix, ...selected]);
    },
  );

  it("keeps differing identities, offsets, transformed operands and memory effects", () => {
    const load = selected[0]!;
    const variants: readonly MachineInstruction[] = [
      { ...load, operand: { ...operand, requestId: "other" } },
      { ...load, operand: { ...operand, offset: 0 } },
      { ...load, operand: { ...operand, addressByte: "low" } },
      {
        ...load,
        memory: [
          {
            kind: "read",
            address: { kind: "absolute", value: 0x3300 },
            width: 1,
            volatile: true,
            order: 0,
          },
        ],
      },
      { ...load, mode: "absolute", operand: { kind: "absolute", value: 0x3300 } },
    ];
    for (const changed of variants) {
      const prefix = [immediate("lda"), home("sta")];
      const instructions = [...prefix];
      const tail = [changed, ...selected.slice(1)];
      appendScalarPrefix(instructions, tail, subtraction);
      expect(instructions).toEqual([...prefix, ...tail]);
    }
  });

  it("keeps intervening instructions, changed carry/arithmetic and wider source operations", () => {
    const prefix = [immediate("lda"), home("sta")];
    const nop = machineInstruction(cpu, "nop", "implied", null);
    const interrupted = [...prefix, nop];
    appendScalarPrefix(interrupted, selected, subtraction);
    expect(interrupted).toEqual([...prefix, nop, ...selected]);
    for (const [operation, tail] of [
      [{ ...subtraction, type: WORD }, selected],
      [{ ...subtraction, operator: "&" }, selected],
      [subtraction, selected.slice(0, 2)],
      [subtraction, [selected[0]!, nop, selected[2]!]],
      [subtraction, [selected[0]!, selected[1]!, immediate("adc")]],
    ] as const) {
      const instructions = [...prefix];
      appendScalarPrefix(instructions, tail, operation);
      expect(instructions).toEqual([...prefix, ...tail]);
    }
  });
});

describe("adjacent comparison private reload", () => {
  it("retains the comparison reload when the caller has no observer proof", () => {
    const prefix = [immediate("lda"), home("sta")];
    const instructions = [...prefix];
    appendScalarPrefix(instructions, [home("lda")], { ...subtraction, operator: "<" });
    expect(instructions).toEqual([...prefix, home("lda")]);
  });
  it.each(["==", "!=", "<", "<=", ">", ">="])(
    "keeps the already-fresh byte for %s, including a flags-only selected test",
    (operator) => {
      for (const tail of [[home("lda")], [home("lda"), immediate("cmp")]]) {
        const prefix = [immediate("lda"), home("sta")];
        const instructions = [...prefix];
        appendScalarPrefix(instructions, tail, { ...subtraction, operator }, true);
        expect(instructions).toEqual([...prefix, ...tail.slice(1)]);
      }
    },
  );

  it.each(["adc", "sbc", "cmp", "tax"])(
    "keeps a comparison reload after %s with unproved N/Z",
    (opcode) => {
      const producer =
        opcode === "tax" ? machineInstruction(cpu, opcode, "implied", null) : immediate(opcode);
      const prefix = [producer, home("sta")];
      const instructions = [...prefix];
      appendScalarPrefix(instructions, [home("lda")], { ...subtraction, operator: "<" }, true);
      expect(instructions).toEqual([...prefix, home("lda")]);
    },
  );

  it("rejects effects, different offsets and transformed comparison homes", () => {
    for (const load of [
      { ...home("lda"), operand: { ...operand, offset: 2 } },
      { ...home("lda"), operand: { ...operand, addressByte: "high" as const } },
      {
        ...home("lda"),
        memory: [
          {
            kind: "read" as const,
            address: { kind: "absolute" as const, value: 0x3300 },
            width: 1,
            volatile: true,
            order: 0,
          },
        ],
      },
    ]) {
      const prefix = [immediate("lda"), home("sta")];
      const instructions = [...prefix];
      appendScalarPrefix(instructions, [load], { ...subtraction, operator: ">=" }, true);
      expect(instructions).toEqual([...prefix, load]);
    }
  });
});
