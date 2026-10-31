import { describe, expect, it } from "vitest";
import { allocateStorage } from "../storage/allocate.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { proveByteAvailability, selectByteWindows } from "./byte-value-availability.js";
import { machineCost, machineInstruction } from "./lower-control.js";
import { lowerMachineProgram } from "./lower.js";
import type { MachineBlock, MachineFunction } from "./machine-types.js";
import {
  BOOLEAN,
  BYTE,
  WORD,
  VOID,
  loadOperation,
  selectedProfile,
  semanticBlock,
  semanticFunction,
  sourceBinding,
  sourceParameter,
  sourceSpan,
  state,
  wholeProgramFor,
} from "./lowering-test-support.js";

const cpu = selectedProfile().cpu;
const owner = sourceBinding(10);

/** Actual CPU metadata gives the matcher register/flag/volatile facts, not mocked instruction names. */
function edge() {
  const left = { kind: "label" as const, label: "global.left" };
  const right = { kind: "label" as const, label: "global.right" };
  const producer: MachineBlock = {
    label: "compare",
    instructions: [
      machineInstruction(cpu, "lda", "absolute", left, [], sourceSpan(11)),
      machineInstruction(cpu, "eor", "absolute", right, [], sourceSpan(12)),
    ],
    terminator: {
      kind: "branch",
      opcode: "bne",
      target: "and",
      fallthrough: "zero",
      uses: state([], ["z"]),
      cost: machineCost(cpu, "bne", "relative"),
    },
  };
  const consumer: MachineBlock = {
    label: "and",
    instructions: [
      machineInstruction(cpu, "lda", "absolute", left, [], sourceSpan(13)),
      machineInstruction(cpu, "and", "absolute", right, [], sourceSpan(14)),
    ],
    terminator: { kind: "return" },
  };
  const sibling: MachineBlock = {
    label: "zero",
    instructions: [
      machineInstruction(
        cpu,
        "lda",
        "immediate",
        { kind: "immediate", value: 0 },
        [],
        sourceSpan(16),
      ),
    ],
    terminator: { kind: "return" },
  };
  return {
    function: owner,
    domain: "main" as const,
    producer,
    consumer,
    blocks: new Map([
      [producer.label, producer],
      [consumer.label, consumer],
      [sibling.label, sibling],
    ]),
    incomingEdges: 1,
    externallyEntered: false,
  };
}

describe("conditional byte edge retention", () => {
  it.each(["php-after-and", "php-sibling", "adc-before-reset", "empty-zero-arm"])(
    "should retain ordinary equality when %s observes or relies on changed state",
    (caseName) => {
      const input = edge();
      const php = machineInstruction(cpu, "php", "implied", null, [], sourceSpan(17));
      let consumer = input.consumer;
      let sibling: MachineBlock = {
        label: "zero",
        instructions: [
          machineInstruction(
            cpu,
            "lda",
            "immediate",
            { kind: "immediate", value: 0 },
            [],
            sourceSpan(18),
          ),
        ],
        terminator: { kind: "return" },
      };
      if (caseName === "php-after-and" || caseName === "adc-before-reset")
        consumer = {
          ...consumer,
          instructions: [
            ...consumer.instructions,
            caseName === "php-after-and"
              ? php
              : machineInstruction(
                  cpu,
                  "adc",
                  "immediate",
                  { kind: "immediate", value: 0 },
                  [],
                  sourceSpan(19),
                ),
          ],
        };
      if (caseName === "php-sibling")
        sibling = { ...sibling, instructions: [php, ...sibling.instructions] };
      if (caseName === "empty-zero-arm") sibling = { ...sibling, instructions: [] };
      const candidate = {
        ...input,
        consumer,
        blocks: new Map([
          [input.producer.label, input.producer],
          [consumer.label, consumer],
          [sibling.label, sibling],
        ]),
      };
      expect(proveByteAvailability(candidate)).toBeNull();
    },
  );

  it("should retain A only across the exact single-entry comparison edge", () => {
    const input = edge();
    const fn: MachineFunction = {
      id: "predicate",
      blocks: [
        input.producer,
        input.consumer,
        { label: "zero", instructions: [], terminator: { kind: "return" } },
      ],
    };
    const selected = selectByteWindows({ ...fn, blocks: [...input.blocks.values()] }, owner, cpu);
    expect(selected.blocks[0]?.instructions.at(-1)?.opcode).toBe("cmp");
    expect(selected.blocks[1]?.instructions.map(({ opcode }) => opcode)).toEqual(["and"]);
    expect(fn.blocks[1]?.instructions.map(({ opcode }) => opcode)).toEqual(["lda", "and"]);
    expect(selected.byteAvailabilityProofs).toHaveLength(1);
    expect(selected.byteAvailabilityProofs?.[0]).toMatchObject({
      from: "compare",
      to: "and",
      left: { kind: "symbol", id: "global.left", offset: 0 },
      pendingObservers: true,
    });
    expect(selectByteWindows(selected, owner, cpu)).toBe(selected);
  });

  it("should permit status observation only after both prefixes independently reset changed state", () => {
    const input = edge();
    const reset = machineInstruction(cpu, "clc", "implied", null, [], sourceSpan(31));
    const php = machineInstruction(cpu, "php", "implied", null, [], sourceSpan(32));
    const consumer = {
      ...input.consumer,
      instructions: [...input.consumer.instructions, reset, php],
    };
    const sibling = {
      ...input.blocks.get("zero")!,
      instructions: [...input.blocks.get("zero")!.instructions, reset, php],
    };
    expect(
      proveByteAvailability({
        ...input,
        consumer,
        blocks: new Map([
          [input.producer.label, input.producer],
          [consumer.label, consumer],
          [sibling.label, sibling],
        ]),
      }),
    ).not.toBeNull();
  });

  it.each([0, 2, 3])("should reject a successor with %i incoming edges", (incomingEdges) => {
    expect(proveByteAvailability({ ...edge(), incomingEdges })).toBeNull();
  });

  it("should reject an alternate entry, restored status, changed operand or volatile read", () => {
    const input = edge();
    expect(proveByteAvailability({ ...input, externallyEntered: true })).toBeNull();
    expect(proveByteAvailability({ ...input, domain: "irq" })).toBeNull();
    expect(proveByteAvailability({ ...input, domain: "nmi" })).toBeNull();
    expect(
      proveByteAvailability({
        ...input,
        consumer: {
          ...input.consumer,
          instructions: [
            machineInstruction(cpu, "plp", "implied", null, [], sourceSpan(15)),
            ...input.consumer.instructions,
          ],
        },
      }),
    ).toBeNull();
    expect(
      proveByteAvailability({
        ...input,
        consumer: {
          ...input.consumer,
          instructions: [
            machineInstruction(
              cpu,
              "lda",
              "absolute",
              { kind: "label", label: "different" },
              [],
              sourceSpan(15),
            ),
            input.consumer.instructions[1]!,
          ],
        },
      }),
    ).toBeNull();
    const load = input.producer.instructions[0]!;
    expect(
      proveByteAvailability({
        ...input,
        producer: {
          ...input.producer,
          instructions: [
            {
              ...load,
              memory: [
                {
                  kind: "read",
                  address: { kind: "symbolic", label: "global.left" },
                  width: 1,
                  volatile: true,
                  order: 0,
                },
              ],
            },
            input.producer.instructions[1]!,
          ],
        },
      }),
    ).toBeNull();
  });

  it("should reject a different comparison or a call between the load and equality", () => {
    const input = edge();
    expect(
      proveByteAvailability({
        ...input,
        producer: {
          ...input.producer,
          instructions: [
            input.producer.instructions[0]!,
            machineInstruction(
              cpu,
              "adc",
              "absolute",
              { kind: "label", label: "global.right" },
              [],
              sourceSpan(12),
            ),
          ],
        },
      }),
    ).toBeNull();
    expect(
      proveByteAvailability({
        ...input,
        producer: {
          ...input.producer,
          instructions: [
            input.producer.instructions[0]!,
            machineInstruction(
              cpu,
              "jsr",
              "absolute",
              { kind: "label", label: "other" },
              [],
              sourceSpan(15),
            ),
            input.producer.instructions[1]!,
          ],
        },
      }),
    ).toBeNull();
  });

  it("should retain the load when another predecessor can reach the same successor", () => {
    const input = edge();
    const fn: MachineFunction = {
      id: "predicate",
      blocks: [
        input.producer,
        input.consumer,
        {
          label: "zero",
          instructions: [],
          terminator: {
            kind: "jump",
            opcode: "jmp",
            target: "and",
            cost: machineCost(cpu, "jmp", "absolute"),
          },
        },
      ],
    };
    expect(selectByteWindows(fn, owner, cpu)).toBe(fn);
  });
});

describe.each([false, true])("equality representation with Closed=%s", (closed) => {
  it.each([false, true])(
    "should preserve wider and materialized equality (materialized=%s)",
    (materialized) => {
      for (const type of [BYTE, WORD]) {
        const left = sourceParameter(21, type);
        const right = sourceParameter(22, type);
        const fn = semanticFunction(20, "equality", [left, right], materialized ? BOOLEAN : VOID, [
          semanticBlock(
            "entry",
            [
              loadOperation("left", left, 23),
              loadOperation("right", right, 24),
              {
                kind: "binary",
                result: "equal",
                operator: "!=",
                left: "left",
                right: "right",
                type: BOOLEAN,
                integer: null,
                span: sourceSpan(25),
              },
            ],
            materialized
              ? { kind: "return", value: "equal" }
              : { kind: "branch", condition: "equal", whenTrue: "yes", whenFalse: "no" },
          ),
          ...(materialized
            ? []
            : [
                semanticBlock("yes", [], { kind: "return", value: null }),
                semanticBlock("no", [], { kind: "return", value: null }),
              ]),
        ]);
        const program = wholeProgramFor([fn]);
        const profile = selectedProfile();
        const inventory = inventoryStorage(program);
        const allocation = allocateStorage(
          inventory,
          buildInterference(inventory),
          profile.storage,
        );
        if (allocation.kind !== "complete") throw new Error("Expected fixture storage");
        const lowered = lowerMachineProgram({
          program,
          profile,
          placement: allocation.placement,
          sourceFacts: {
            program,
            functions: new Map(),
            nonLoopBundle: closed ? "closed" : "direct",
          },
        });
        if (lowered.kind !== "complete") throw new Error(JSON.stringify(lowered));
        const opcodes = lowered.program.functions[0]!.blocks.flatMap((block) =>
          block.instructions.map(({ opcode }) => opcode),
        );
        // Equality without a complete retention window must remain ordinary.
        expect(opcodes.includes("eor")).toBe(true);
      }
    },
  );
});
