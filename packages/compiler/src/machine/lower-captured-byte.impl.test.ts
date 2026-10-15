import { describe, expect, it } from "vitest";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticFunction, SemanticOperation } from "../semantic/operations.js";
import { analyzeInterruptContexts } from "../semantic/interrupt-contexts.js";
import { analyzeInterruptDomains } from "../semantic/interrupt-domains.js";
import { valueLifetimes } from "../semantic/value-lifetimes.js";
import { allocateStorage } from "../storage/allocate.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { machineCost, machineInstruction } from "./lower-control.js";
import { selectTerminalByteLeaves } from "./lower-terminal-byte.js";
import type { MachineBlock } from "./machine-types.js";
import {
  BYTE,
  VOID,
  WORD,
  loadOperation,
  semanticBlock,
  semanticFunction,
  selectedProfile,
  sourceBinding,
  sourceParameter,
  sourceSpan,
  wholeProgramFor,
} from "./lowering-test-support.js";

/** Retain real declaration, liveness and allocation producers around the exact machine diamond. */
function fixture(branch: "bmi" | "bpl" = "bmi") {
  const profile = selectedProfile();
  const local = sourceParameter(9981, BYTE);
  const capture: SemanticOperation = {
    kind: "memory-read",
    result: "sample",
    address: "address",
    width: 1,
    byteOrder: "low-first",
    volatile: true,
    type: BYTE,
    integer: null,
    span: sourceSpan(9982),
  };
  const store: SemanticOperation = {
    kind: "store",
    place: { root: local.id, path: [] },
    value: "sample",
    type: BYTE,
    span: sourceSpan(9983),
  };
  const call: SemanticOperation = {
    kind: "call",
    result: null,
    callee: sourceBinding(9984),
    arguments: [],
    type: VOID,
    span: sourceSpan(9985),
  };
  const source = semanticFunction(9980, "choose", [], BYTE, [
    semanticBlock(
      "guard",
      [
        {
          kind: "constant",
          result: "address",
          value: 0x3300n,
          type: WORD,
          integer: null,
          span: sourceSpan(9986),
        },
        capture,
        store,
        loadOperation("condition", local, 9987),
      ],
      { kind: "branch", condition: "condition", whenTrue: "called", whenFalse: "bypass" },
    ),
    semanticBlock("called", [call], { kind: "jump", target: "returned" }),
    semanticBlock("bypass", [], { kind: "jump", target: "returned" }),
    semanticBlock("returned", [loadOperation("result", local, 9988)], {
      kind: "return",
      value: "result",
    }),
  ]);
  const functions = [
    semanticFunction(9989, "main", [], VOID, [
      semanticBlock(
        "main",
        [
          {
            kind: "call",
            result: null,
            callee: source.id,
            arguments: [],
            type: BYTE,
            span: sourceSpan(9993),
          },
        ],
        { kind: "return", value: null },
      ),
    ]),
    source,
    semanticFunction(9984, "interfere", [], VOID, [
      semanticBlock("helper", [], { kind: "return", value: null }),
    ]),
  ];
  const root = wholeProgramFor(functions, functions.flatMap(valueLifetimes));
  const program = {
    ...root,
    executionDomains: analyzeInterruptDomains(root.semantic, root.roots, root.callGraph).functions,
    interruptContextAnalysis: analyzeInterruptContexts(root, profile.storage),
  };
  const inventory = inventoryStorage(program);
  const allocation = allocateStorage(inventory, buildInterference(inventory), profile.storage);
  if (allocation.kind !== "complete") throw new Error("Expected real private-home allocation");
  const request = inventory.requests.find(
    ({ binding }) =>
      binding !== null && bindingIdentityKey(binding) === bindingIdentityKey(local.id),
  );
  if (request === undefined)
    throw new Error("Expected the declared capture's actual storage request");
  const home = { kind: "storage" as const, requestId: request.id };
  const load = machineInstruction(
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
    capture.span,
  );
  const saved = machineInstruction(profile.cpu, "sta", "storage", home, [], store.span);
  const called = machineInstruction(
    profile.cpu,
    "jsr",
    "absolute",
    { kind: "label", label: "interfere" },
    [],
    call.span,
  );
  const reload = machineInstruction(profile.cpu, "lda", "storage", home, [], source.source);
  const blocks: readonly MachineBlock[] = [
    {
      label: "guard",
      instructions: [load, saved],
      terminator: {
        kind: "branch",
        opcode: branch,
        target: "called",
        fallthrough: "bypass",
        uses: { registers: [], flags: ["n"] },
        cost: { bytes: 2, minCycles: 2, maxCycles: 4 },
      },
    },
    {
      label: "called",
      instructions: [called],
      terminator: {
        kind: "jump",
        opcode: "jmp",
        target: "returned",
        cost: machineCost(profile.cpu, "jmp", "absolute"),
      },
    },
    {
      label: "bypass",
      instructions: [],
      terminator: {
        kind: "jump",
        opcode: "jmp",
        target: "returned",
        cost: machineCost(profile.cpu, "jmp", "absolute"),
      },
    },
    { label: "returned", instructions: [reload], terminator: { kind: "return" } },
  ];
  const state = {
    input: { program, profile, placement: allocation.placement },
    interruptDepth: { domain: "main" as const, irq: 0, nmi: 0 },
  };
  return { source, state, blocks, local, load, saved, called, reload };
}

/** Replace one body operation without changing the machine witness under test. */
function withOperations(source: SemanticFunction, operations: readonly SemanticOperation[]) {
  return { ...source, blocks: [{ ...source.blocks[0]!, operations }, ...source.blocks.slice(1)] };
}

describe("exact conditional captured-byte leaf selection", () => {
  it.each(["bmi", "bpl"] as const)("moves only the private save/reload for %s", (branch) => {
    const { source, state, blocks, load, saved, called, reload } = fixture(branch);
    const selected = selectTerminalByteLeaves(blocks, state, false, source);
    expect(selected.map(({ instructions }) => instructions.map(({ opcode }) => opcode))).toEqual([
      ["lda"],
      ["sta", "jsr", "lda"],
      [],
      [],
    ]);
    expect(selected[0]!.instructions[0]).toBe(load);
    expect(selected[1]!.instructions).toEqual([saved, called, reload]);
    expect(selected[2]).toBe(blocks[2]);
    expect(selected.every((block, index) => block.terminator === blocks[index]!.terminator)).toBe(
      true,
    );
    expect(
      state.input.placement.homes.some(
        ({ requestId }) =>
          saved.operand?.kind === "storage" && saved.operand.requestId === requestId,
      ),
    ).toBe(true);
  });

  it("retains source-address and selected-place uses even when they emit no instruction", () => {
    const { source, state, blocks, local } = fixture();
    const original = source.blocks[0]!.operations;
    const address: SemanticOperation = {
      kind: "place-address",
      result: "borrow",
      place: { root: local.id, path: [] },
      type: WORD,
      integer: null,
      span: sourceSpan(9990),
    };
    expect(
      selectTerminalByteLeaves(
        blocks,
        state,
        false,
        withOperations(source, [...original, address]),
      ),
    ).toBe(blocks);
    const selectedRead = {
      ...loadOperation("selected", local, 9991),
      place: { root: local.id, path: [{ kind: "index" as const, value: "index" }] },
    };
    expect(
      selectTerminalByteLeaves(
        blocks,
        state,
        false,
        withOperations(source, [...original, selectedRead]),
      ),
    ).toBe(blocks);
  });

  it("retains ambiguous source ownership and a call with arguments", () => {
    const { source, state, blocks } = fixture();
    const original = source.blocks[0]!.operations;
    expect(
      selectTerminalByteLeaves(
        blocks,
        state,
        false,
        withOperations(source, [...original, original[2]!]),
      ),
    ).toBe(blocks);
    const called = source.blocks[1]!;
    const operation = called.operations[0]!;
    if (operation.kind !== "call") throw new Error("Expected direct call");
    for (const operations of [
      [{ ...operation, arguments: ["argument"] }],
      [operation, operation],
    ]) {
      const changed = {
        ...source,
        blocks: [source.blocks[0]!, { ...called, operations }, ...source.blocks.slice(2)],
      };
      expect(selectTerminalByteLeaves(blocks, state, false, changed)).toBe(blocks);
    }
  });

  it("retains differing homes, additional effects and nonmatching call/branch shapes", () => {
    const { source, state, blocks, saved, called, load } = fixture();
    const alternatives: readonly (readonly MachineBlock[])[] = [
      [
        { ...blocks[0]!, instructions: [load, { ...saved, memory: load.memory }] },
        ...blocks.slice(1),
      ],
      [{ ...blocks[0]!, instructions: [load, saved, load] }, ...blocks.slice(1)],
      [
        blocks[0]!,
        { ...blocks[1]!, instructions: [{ ...called, opcode: "jmp" }] },
        ...blocks.slice(2),
      ],
      [...blocks.slice(0, 2), { ...blocks[2]!, instructions: [load] }, blocks[3]!],
      [
        ...blocks.slice(0, 3),
        {
          ...blocks[3]!,
          instructions: [
            { ...saved, opcode: "lda", operand: { kind: "storage", requestId: "other" } },
          ],
        },
      ],
      [
        blocks[0]!,
        {
          ...blocks[1]!,
          terminator: {
            kind: "jump",
            opcode: "jmp",
            target: "guard",
            cost: machineCost(state.input.profile.cpu, "jmp", "absolute"),
          },
        },
        ...blocks.slice(2),
      ],
    ];
    for (const changed of alternatives)
      expect(selectTerminalByteLeaves(changed, state, false, source)).toBe(changed);
  });

  it("retains startup, parameters, interrupts and non-byte results", () => {
    const { source, state, blocks } = fixture();
    expect(selectTerminalByteLeaves(blocks, state, true, source)).toBe(blocks);
    for (const changed of [
      { ...source, parameters: [sourceParameter(9992, BYTE)] },
      { ...source, entryKind: "interrupt" as const },
      { ...source, result: WORD },
    ])
      expect(selectTerminalByteLeaves(blocks, state, false, changed)).toBe(blocks);
    for (const domain of ["irq", "nmi"] as const)
      expect(
        selectTerminalByteLeaves(
          blocks,
          { ...state, interruptDepth: { domain, irq: 1, nmi: 1 } },
          false,
          source,
        ),
      ).toBe(blocks);
  });
});
