import { describe, expect, it } from "vitest";
import type { SemanticOperation } from "../semantic/operations.js";
import { machineInstruction } from "./lower-control.js";
import { appendImmediateByteBitwise } from "./lower-scalar.js";
import type { MachineInstruction } from "./machine-types.js";
import {
  BYTE,
  loadOperation,
  lowerFunctions,
  selectedProfile,
  semanticBlock,
  semanticFunction,
  sourceParameter,
  sourceSpan,
} from "./lowering-test-support.js";

const cpu = selectedProfile().cpu;

/** Construct official immediate operations with distinct source identities. */
function immediate(opcode: "and" | "eor" | "ora", value: number, start: number) {
  return machineInstruction(
    cpu,
    opcode,
    "immediate",
    { kind: "immediate", value },
    [],
    sourceSpan(start),
  );
}

describe("adjacent immediate byte-chain composition", () => {
  it.each([
    [0xff, 0x7f, 0x20],
    [0xa5, 0x3f, 0x12],
  ] as const)(
    "composes %i/%i/%i while retaining final effects, costs and source spans",
    (first, mask, last) => {
      const original = [immediate("eor", first, 910), immediate("and", mask, 911)];
      const final = immediate("eor", last, 912);
      const instructions = [...original];
      appendImmediateByteBitwise(instructions, [final], cpu);
      expect(instructions).toHaveLength(2);
      expect(instructions[0]).toBe(original[1]);
      expect(instructions[1]).toEqual({
        ...final,
        operand: { kind: "immediate", value: (first & mask) ^ last },
      });
      expect(instructions.reduce((sum, instruction) => sum + instruction.cost.bytes, 0)).toBe(4);
      expect(instructions.reduce((sum, instruction) => sum + instruction.cost.maxCycles, 0)).toBe(
        4,
      );
      for (let input = 0; input <= 255; input += 1)
        expect((input & mask) ^ ((first & mask) ^ last)).toBe(((input ^ first) & mask) ^ last);
      expect(final.defines).toEqual({ registers: ["a"], flags: ["n", "z"] });
      expect(final.uses).toEqual({ registers: ["a"], flags: [] });
    },
  );

  it.each(["clc", "cmp", "sta", "jsr"])("does not cross a %s instruction", (opcode) => {
    const barrier = machineInstruction(
      cpu,
      opcode,
      opcode === "clc" ? "implied" : opcode === "cmp" ? "immediate" : "absolute",
      opcode === "clc"
        ? null
        : opcode === "cmp"
          ? { kind: "immediate", value: 0 }
          : { kind: "absolute", value: 0x3200 },
    );
    const before = [immediate("eor", 0xff, 913), immediate("and", 0x7f, 914), barrier];
    const final = immediate("eor", 0x20, 915);
    const instructions = [...before];
    appendImmediateByteBitwise(instructions, [final], cpu);
    expect(instructions).toEqual([...before, final]);
  });

  it("retains non-immediate, memory-observing, malformed and differently shaped tails", () => {
    const first = immediate("eor", 0xff, 916);
    const mask = immediate("and", 0x7f, 917);
    const final = immediate("eor", 0x20, 918);
    const cases: readonly (readonly MachineInstruction[])[] = [
      [first, immediate("ora", 0x7f, 917), final],
      [mask, mask, final],
      [first, mask, { ...final, mode: "absolute", operand: { kind: "absolute", value: 0x3300 } }],
      [
        first,
        mask,
        {
          ...final,
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
      ],
      [immediate("eor", 256, 916), mask, final],
      [first, immediate("and", -1, 917), final],
      [first, mask, immediate("eor", 0.5, 918)],
    ];
    for (const original of cases) {
      const instructions = original.slice(0, -1);
      appendImmediateByteBitwise(instructions, [original.at(-1)!], cpu);
      expect(instructions).toEqual(original);
    }
    const multiple: MachineInstruction[] = [];
    appendImmediateByteBitwise(multiple, [first, mask, final], cpu);
    expect(multiple).toEqual([first, mask, final]);
    const short = [first];
    appendImmediateByteBitwise(short, [final], cpu);
    expect(short).toEqual([first, final]);
  });

  it("records the final source operation even when append does not grow the instruction list", () => {
    const parameter = sourceParameter(920, BYTE);
    const operations: readonly SemanticOperation[] = [
      loadOperation("input", parameter, 921),
      {
        kind: "unary",
        result: "complement",
        operand: "input",
        operator: "~",
        type: BYTE,
        integer: null,
        span: sourceSpan(922),
      },
      {
        kind: "constant",
        result: "mask",
        value: 0x7fn,
        type: BYTE,
        integer: null,
        span: sourceSpan(923),
      },
      {
        kind: "binary",
        result: "masked",
        left: "complement",
        right: "mask",
        operator: "&",
        type: BYTE,
        integer: null,
        span: sourceSpan(924),
      },
      {
        kind: "constant",
        result: "toggle",
        value: 0x20n,
        type: BYTE,
        integer: null,
        span: sourceSpan(925),
      },
      {
        kind: "binary",
        result: "final",
        left: "masked",
        right: "toggle",
        operator: "^",
        type: BYTE,
        integer: null,
        span: sourceSpan(926),
      },
    ];
    const result = lowerFunctions([
      semanticFunction(919, "byte-chain", [parameter], BYTE, [
        semanticBlock("entry", operations, { kind: "return", value: "final" }),
      ]),
    ]);
    if (result.kind !== "complete") throw new Error("Expected byte-chain lowering");
    const instructions = result.program.functions[0]!.blocks[0]!.instructions;
    expect(instructions.map(({ opcode }) => opcode)).toEqual(["lda", "and", "eor"]);
    expect(instructions.at(-2)?.source).toBe(operations[3]!.span);
    expect(instructions.at(-1)?.source).toBe(operations[5]!.span);
    expect(result.binder.instructionSites?.has(operations[5]!)).toBe(true);
    expect(
      result.program.requiredStorage.filter(({ storageClass }) => storageClass === "temporary"),
    ).toHaveLength(0);
  });
});
