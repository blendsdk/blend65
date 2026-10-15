import { describe, expect, it } from "vitest";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticType } from "../frontend/semantic-types.js";
import type { SemanticFunction, SemanticOperation } from "../semantic/operations.js";
import { allocateStorage } from "../storage/allocate.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { machineCost, machineInstruction } from "./lower-control.js";
import { selectTerminalByteLeaves } from "./lower-terminal-byte.js";
import type { MachineBlock, MachineInstruction } from "./machine-types.js";
import {
  BYTE,
  VOID,
  WORD,
  loadOperation,
  semanticBlock,
  semanticFunction,
  selectedProfile,
  sourceParameter,
  sourceSpan,
  wholeProgramFor,
} from "./lowering-test-support.js";

const profile = selectedProfile();
const span = sourceSpan(9950);

/** Build a real source owner and ordinary parameter inventory for each admission control. */
function fixture(
  opcode = "asl",
  parameterType: SemanticType = BYTE,
  result: SemanticType = VOID,
  count = 7n,
  interrupt = false,
) {
  const parameter = sourceParameter(9951, parameterType);
  const operations: readonly SemanticOperation[] = [
    loadOperation("input", parameter, 9952),
    {
      kind: "constant",
      result: "count",
      value: count,
      type: BYTE,
      integer: null,
      span: sourceSpan(9953),
    },
    {
      kind: "binary",
      result: "shifted",
      operator: opcode === "asl" ? "<<" : ">>",
      left: "input",
      right: "count",
      type: parameterType,
      integer: null,
      span,
    },
  ];
  const body = semanticBlock("leaf", operations, { kind: "return", value: null });
  const fn: SemanticFunction = {
    ...semanticFunction(9954, "deliver", [parameter], result, [body]),
    ...(interrupt ? { entryKind: "interrupt" as const } : {}),
  };
  const main = semanticFunction(9955, "main", [], VOID, [
    semanticBlock("main", [], { kind: "return", value: null }),
  ]);
  const program = wholeProgramFor([main, fn]);
  const inventory = inventoryStorage(program);
  const allocation = allocateStorage(inventory, buildInterference(inventory), profile.storage);
  if (allocation.kind !== "complete") throw new Error("Expected source-owned parameter placement");
  const state = {
    input: { profile, program, placement: allocation.placement },
    interruptDepth: { domain: "main" as const, irq: 0, nmi: 0 },
  };
  const home = {
    kind: "storage" as const,
    requestId: `${bindingIdentityKey(fn.id)}:parameter:${bindingIdentityKey(parameter.id)}`,
    offset: 0,
  };
  const load = machineInstruction(profile.cpu, "lda", "storage", home, [], sourceSpan(9952));
  const store = machineInstruction(
    profile.cpu,
    "sta",
    "absolute",
    { kind: "absolute", value: 0x3200 },
    [
      {
        kind: "write",
        address: { kind: "absolute", value: 0x3200 },
        width: 1,
        volatile: true,
        order: 0,
      },
    ],
    sourceSpan(9956),
  );
  const blocks: readonly MachineBlock[] = [
    {
      label: "leaf",
      instructions: [
        load,
        ...Array.from({ length: 7 }, () =>
          machineInstruction(profile.cpu, opcode, "accumulator", null, [], span),
        ),
        store,
      ],
      terminator: { kind: "return" },
    },
  ];
  return { fn, state, inventory, blocks };
}

/** Change one selected instruction while retaining the independently built source owner. */
function replace(blocks: readonly MachineBlock[], index: number, instruction: MachineInstruction) {
  return [
    {
      ...blocks[0]!,
      instructions: blocks[0]!.instructions.map((value, at) =>
        at === index ? instruction : value,
      ),
    },
  ];
}

describe("complete ordinary void-leaf endpoint shifts", () => {
  it.each(["asl", "lsr"])(
    "selects %s endpoint extraction with official effects and no storage change",
    (opcode) => {
      const { fn, state, inventory, blocks } = fixture(opcode);
      const before = structuredClone({ inventory, placement: state.input.placement });
      const selected = selectTerminalByteLeaves(blocks, state, false, fn);
      const instructions = selected[0]!.instructions;
      expect(instructions.map((instruction) => instruction.opcode)).toEqual([
        "lda",
        opcode === "asl" ? "lsr" : "asl",
        "lda",
        opcode === "asl" ? "ror" : "rol",
        "sta",
      ]);
      expect(instructions[0]).toBe(blocks[0]!.instructions[0]);
      expect(instructions.at(-1)).toBe(blocks[0]!.instructions.at(-1));
      expect(selected[0]!.terminator).toBe(blocks[0]!.terminator);
      expect(instructions.slice(1, 4).every((instruction) => instruction.source === span)).toBe(
        true,
      );
      expect(instructions[1]!.defines.flags).toEqual(["n", "z", "c"]);
      expect(instructions[2]!.defines.flags).toEqual(["n", "z"]);
      expect(instructions[3]!.uses.flags).toEqual(["c"]);
      expect(instructions[3]!.defines.flags).toEqual(["n", "z", "c"]);
      expect(instructions.slice(1, 4).every((instruction) => instruction.memory.length === 0)).toBe(
        true,
      );
      expect(instructions.reduce((sum, instruction) => sum + instruction.cost.bytes, 1)).toBe(11);
      expect(instructions.reduce((sum, instruction) => sum + instruction.cost.minCycles, 6)).toBe(
        20,
      );
      expect(instructions.reduce((sum, instruction) => sum + instruction.cost.maxCycles, 6)).toBe(
        20,
      );
      expect({ inventory, placement: state.input.placement }).toEqual(before);
      expect(inventory.requests.map((request) => request.bytes)).toEqual([1]);
    },
  );
  it("retains startup, interrupt domains, missing owners and non-void/non-byte source ABIs", () => {
    const { fn, state, blocks } = fixture();
    expect(selectTerminalByteLeaves(blocks, state, true, fn)).toBe(blocks);
    expect(selectTerminalByteLeaves(blocks, state, false, undefined)).toBe(blocks);
    for (const domain of ["irq", "nmi"] as const) {
      expect(
        selectTerminalByteLeaves(
          blocks,
          { ...state, interruptDepth: { domain, irq: 1, nmi: 1 } },
          false,
          fn,
        ),
      ).toBe(blocks);
    }
    for (const fixtureValue of [
      fixture("lsr", { kind: "scalar", name: "sbyte" }),
      fixture("asl", WORD),
      fixture("asl", BYTE, BYTE),
      fixture("asl", BYTE, VOID, 6n),
      fixture("asl", BYTE, VOID, 7n, true),
    ]) {
      expect(
        selectTerminalByteLeaves(fixtureValue.blocks, fixtureValue.state, false, fixtureValue.fn),
      ).toBe(fixtureValue.blocks);
    }
  });
  it("retains all later flag observers, calls, edges and extra instructions", () => {
    const { fn, state, blocks } = fixture();
    for (const opcode of ["php", "nop", "jsr"]) {
      const extra = machineInstruction(
        profile.cpu,
        opcode,
        opcode === "jsr" ? "absolute" : "implied",
        opcode === "jsr" ? { kind: "absolute", value: 0x4000 } : null,
        [],
        span,
      );
      const changed = [{ ...blocks[0]!, instructions: [...blocks[0]!.instructions, extra] }];
      expect(selectTerminalByteLeaves(changed, state, false, fn)).toBe(changed);
    }
    const extraBlock = [
      ...blocks,
      { label: "extra", instructions: [], terminator: { kind: "return" as const } },
    ];
    expect(selectTerminalByteLeaves(extraBlock, state, false, fn)).toBe(extraBlock);
    const jumped = [
      {
        ...blocks[0]!,
        terminator: {
          kind: "jump" as const,
          opcode: "jmp" as const,
          target: "other",
          cost: machineCost(profile.cpu, "jmp", "absolute"),
        },
      },
    ];
    expect(selectTerminalByteLeaves(jumped, state, false, fn)).toBe(jumped);
  });
  it("requires the exact parameter home and a uniform accumulator/source shift chain", () => {
    const { fn, state, blocks } = fixture();
    const load = blocks[0]!.instructions[0]!;
    const shift = blocks[0]!.instructions[1]!;
    const changedInstructions = [
      {
        index: 0,
        instruction: { ...load, operand: { kind: "storage" as const, requestId: "other" } },
      },
      {
        index: 0,
        instruction: {
          ...load,
          operand: {
            kind: "storage" as const,
            requestId: load.operand?.kind === "storage" ? load.operand.requestId : "invalid",
            offset: 1,
          },
        },
      },
      {
        index: 0,
        instruction: machineInstruction(
          profile.cpu,
          "lda",
          "absolute",
          { kind: "absolute", value: 0x3300 },
          [],
          span,
        ),
      },
      {
        index: 1,
        instruction: machineInstruction(profile.cpu, "lsr", "accumulator", null, [], span),
      },
      { index: 1, instruction: { ...shift, source: sourceSpan(9950) } },
      { index: 1, instruction: { ...shift, source: null } },
      {
        index: 1,
        instruction: machineInstruction(
          profile.cpu,
          "asl",
          "storage",
          { kind: "storage", requestId: "other" },
          [],
          span,
        ),
      },
      {
        index: 1,
        instruction: {
          ...shift,
          memory: [
            {
              kind: "read" as const,
              address: { kind: "absolute" as const, value: 0x3300 },
              width: 1 as const,
              volatile: true,
              order: 0,
            },
          ],
        },
      },
    ];
    for (const { index, instruction } of changedInstructions) {
      const changed = replace(blocks, index, instruction);
      expect(selectTerminalByteLeaves(changed, state, false, fn)).toBe(changed);
    }
  });
  it("keeps selected or transformed stores and read-bearing destinations unchanged", () => {
    const { fn, state, blocks } = fixture();
    const store = blocks[0]!.instructions[8]!;
    const changedStores = [
      machineInstruction(
        profile.cpu,
        "sta",
        "absolute-x",
        { kind: "absolute", value: 0x3200 },
        [],
        span,
      ),
      { ...store, operand: { kind: "label" as const, label: "data", addressByte: "low" as const } },
      {
        ...store,
        operand: { kind: "label" as const, label: "data", transform: "vic-sprite-block" as const },
      },
      {
        ...store,
        operand: { kind: "storage" as const, requestId: "data", addressByte: "high" as const },
      },
      {
        ...store,
        memory: [
          {
            kind: "read" as const,
            address: { kind: "absolute" as const, value: 0x3300 },
            width: 1 as const,
            volatile: true,
            order: 0,
          },
        ],
      },
    ];
    for (const instruction of changedStores) {
      const changed = replace(blocks, 8, instruction);
      expect(selectTerminalByteLeaves(changed, state, false, fn)).toBe(changed);
    }
  });
});
