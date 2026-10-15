import { describe, expect, it } from "vitest";
import type { SemanticType } from "../frontend/semantic-types.js";
import { allocateStorage } from "../storage/allocate.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { machineInstruction } from "./lower-control.js";
import { selectTerminalByteArithmetic } from "./lower-terminal-byte.js";
import type { MachineBlock, MachineInstruction } from "./machine-types.js";
import {
  BYTE,
  VOID,
  WORD,
  semanticBlock,
  semanticFunction,
  selectedProfile,
  sourceSpan,
  wholeProgramFor,
} from "./lowering-test-support.js";

const profile = selectedProfile();
const span = sourceSpan(9920);
const leaf = semanticFunction(9921, "combine", [], BYTE, [
  semanticBlock("entry", [], { kind: "return", value: null }),
]);
const program = wholeProgramFor([
  semanticFunction(9922, "main", [], VOID, [
    semanticBlock("main", [], { kind: "return", value: null }),
  ]),
  leaf,
]);
const inventory = inventoryStorage(program);
const allocation = allocateStorage(inventory, buildInterference(inventory), profile.storage);
if (allocation.kind !== "complete") throw new Error("Expected real test allocation");
const state = {
  input: { profile, program, placement: allocation.placement },
  interruptDepth: { domain: "main" as const, irq: 0, nmi: 0 },
};

/** Real opcode facts keep the register/flag assertion independent from fixture claims. */
function instruction(
  opcode: string,
  mode: string = "implied",
  operand: MachineInstruction["operand"] = null,
): MachineInstruction {
  return machineInstruction(profile.cpu, opcode, mode, operand, [], span);
}

/** The complete terminal shape keeps the original private home, not a guessed address. */
function blocks(captured = false, add = false, opcode = "and"): readonly MachineBlock[] {
  const home = { kind: "storage" as const, requestId: "original", offset: 2 };
  const load = captured
    ? machineInstruction(
        profile.cpu,
        "lda",
        "absolute",
        { kind: "absolute", value: 0x3300 },
        [
          {
            kind: "read",
            address: { kind: "absolute", value: 0x3300 },
            width: 1,
            volatile: true,
            order: 0,
          },
        ],
        span,
      )
    : instruction("lda", "storage", home);
  return [
    {
      label: "entry",
      instructions: [
        load,
        ...(captured ? [instruction("sta", "storage", home)] : []),
        instruction(add ? "clc" : "sec"),
        instruction(add ? "adc" : "sbc", "immediate", { kind: "immediate", value: 1 }),
        instruction(opcode, "storage", home),
      ],
      terminator: { kind: "return" },
    },
  ];
}

/** Replace one exact instruction without hiding the rest of the complete function. */
function replace(
  original: readonly MachineBlock[],
  index: number,
  changed: MachineInstruction,
): readonly MachineBlock[] {
  return [
    {
      ...original[0]!,
      instructions: original[0]!.instructions.map((value, at) => (at === index ? changed : value)),
    },
  ];
}

describe("ordinary terminal byte instruction selection", () => {
  for (const captured of [false, true]) {
    for (const add of [false, true]) {
      it.each(["and", "ora", "eor"])(
        `selects captured=${captured}, add=${add} and %s without changing a home or access`,
        (opcode) => {
          const original = blocks(captured, add, opcode);
          const selected = selectTerminalByteArithmetic(original, state, false, leaf);
          const instructions = selected[0]!.instructions;
          expect(instructions.map(({ opcode }) => opcode)).toEqual([
            "ldx",
            ...(captured ? ["stx"] : []),
            add ? "inx" : "dex",
            "txa",
            opcode,
          ]);
          expect(instructions[0]!.operand).toBe(original[0]!.instructions[0]!.operand);
          expect(instructions[0]!.memory).toEqual(original[0]!.instructions[0]!.memory);
          expect(instructions[0]!.source).toBe(span);
          expect(instructions[0]!.defines.registers).toEqual(["x"]);
          if (captured) {
            expect(instructions[1]!.operand).toBe(original[0]!.instructions[1]!.operand);
            expect(instructions[1]!.uses.registers).toEqual(["x"]);
          }
          expect(instructions.at(-1)).toBe(original[0]!.instructions.at(-1));
          expect(selected[0]!.terminator).toBe(original[0]!.terminator);
          expect(instructions.reduce((sum, value) => sum + value.cost.bytes, 1)).toBe(
            captured ? 12 : 9,
          );
          expect(instructions.reduce((sum, value) => sum + value.cost.minCycles, 6)).toBe(
            captured ? 22 : 18,
          );
          expect(state.input.placement).toBe(allocation.placement);
        },
      );
    }
  }

  it("keeps startup, interrupt source and every non-main domain unchanged", () => {
    const original = blocks(true);
    expect(selectTerminalByteArithmetic(original, state, true, leaf)).toBe(original);
    expect(selectTerminalByteArithmetic(original, state, false, undefined)).toBe(original);
    expect(
      selectTerminalByteArithmetic(original, state, false, { ...leaf, entryKind: "interrupt" }),
    ).toBe(original);
    for (const domain of ["irq", "nmi"] as const)
      expect(
        selectTerminalByteArithmetic(
          original,
          { ...state, interruptDepth: { domain, irq: 1, nmi: 1 } },
          false,
          leaf,
        ),
      ).toBe(original);
    for (const result of [
      WORD,
      VOID,
      { kind: "scalar", name: "boolean" },
    ] satisfies readonly SemanticType[])
      expect(selectTerminalByteArithmetic(original, state, false, { ...leaf, result })).toBe(
        original,
      );
  });

  it("keeps extra instructions, blocks and nonreturn edges unchanged", () => {
    const original = blocks();
    for (const changed of [
      [{ ...original[0]!, instructions: [instruction("nop"), ...original[0]!.instructions] }],
      [...original, { label: "other", instructions: [], terminator: { kind: "return" as const } }],
      [{ ...original[0]!, terminator: { kind: "fallthrough" as const, target: "other" } }],
    ])
      expect(selectTerminalByteArithmetic(changed, state, false, leaf)).toBe(changed);
  });

  it("keeps distinct homes, address transforms and observable private accesses unchanged", () => {
    const original = blocks(true);
    const bitwise = original[0]!.instructions.at(-1)!;
    for (const operand of [
      { kind: "storage", requestId: "different", offset: 2 },
      { kind: "storage", requestId: "original", offset: 1 },
      { kind: "storage", requestId: "original", offset: 2, addressByte: "low" },
    ] satisfies readonly NonNullable<MachineInstruction["operand"]>[]) {
      const changed = replace(original, 4, { ...bitwise, operand });
      expect(selectTerminalByteArithmetic(changed, state, false, leaf)).toBe(changed);
    }
    const changed = replace(original, 4, {
      ...bitwise,
      memory: original[0]!.instructions[0]!.memory,
    });
    expect(selectTerminalByteArithmetic(changed, state, false, leaf)).toBe(changed);
  });

  it("keeps indexed source reads and nonmatching arithmetic/carry forms unchanged", () => {
    const original = blocks(true);
    for (const [index, changedInstruction] of [
      [0, instruction("lda", "absolute-x", { kind: "absolute", value: 0x3300 })],
      [2, instruction("clc")],
      [3, instruction("sbc", "immediate", { kind: "immediate", value: 2 })],
      [3, instruction("adc", "immediate", { kind: "immediate", value: 1 })],
    ] as const) {
      const changed = replace(original, index, changedInstruction);
      expect(selectTerminalByteArithmetic(changed, state, false, leaf)).toBe(changed);
    }
  });
});
