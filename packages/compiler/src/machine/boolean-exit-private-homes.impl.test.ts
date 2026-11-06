import { describe, expect, it } from "vitest";
import {
  deriveBooleanExitFacts,
  deriveBooleanExitGraph,
  validBooleanExitFacts,
  machineCost,
  machineInstruction,
  machineState,
} from "./lower-control.js";
import type { MachineBlock, MachineFunction, MachineInstruction } from "./machine-types.js";
import { selectedProfile } from "./lowering-test-support.js";

const cpu = selectedProfile().cpu;

/** Keep the real CPU flag/cost tables for private-byte transfers. */
function instruction(opcode: string, home?: string, immediate?: number): MachineInstruction {
  return machineInstruction(
    cpu,
    opcode,
    home === undefined ? (immediate === undefined ? "implied" : "immediate") : "storage",
    home === undefined
      ? immediate === undefined
        ? null
        : { kind: "immediate", value: immediate }
      : { kind: "storage", requestId: home },
  );
}

/** Both source arms really join the same return block. */
function jump(target: string): MachineBlock["terminator"] {
  return { kind: "jump", opcode: "jmp", target, cost: machineCost(cpu, "jmp", "absolute") };
}

/** A real Boolean leaf feeds a caller's captured value and shared private merge. */
function fixture() {
  const leaf: MachineFunction = {
    id: "leaf",
    blocks: [
      {
        label: "leaf.entry",
        instructions: [instruction("lda", undefined, 1)],
        terminator: { kind: "return" },
      },
    ],
  };
  const caller: MachineFunction = {
    id: "caller",
    blocks: [
      {
        label: "entry",
        instructions: [
          machineInstruction(cpu, "lda", "absolute", { kind: "absolute", value: 0x3200 }),
        ],
        terminator: {
          kind: "branch",
          opcode: "bne",
          target: "selected",
          fallthrough: "bypassed",
          uses: machineState([], ["z"]),
          cost: machineCost(cpu, "bne", "relative"),
        },
      },
      {
        label: "selected",
        instructions: [
          machineInstruction(cpu, "jsr", "absolute", { kind: "label", label: leaf.id }),
          instruction("sta", "captured"),
          instruction("lda", "captured"),
          instruction("sta", "merge"),
        ],
        terminator: jump("join"),
      },
      {
        label: "bypassed",
        instructions: [instruction("lda", undefined, 0), instruction("sta", "merge")],
        terminator: jump("join"),
      },
      {
        label: "join",
        instructions: [instruction("lda", "merge")],
        terminator: { kind: "return" },
      },
    ],
  };
  const leafFacts = deriveBooleanExitFacts(leaf);
  if (leafFacts === null) throw new Error("Expected a certified constant Boolean leaf");
  const context = {
    functions: new Map([
      [leaf.id, leaf],
      [caller.id, caller],
    ]),
    callees: new Map([[leaf.id, leafFacts]]),
    privateByte: (value: MachineInstruction): string | null =>
      value.mode === "storage" &&
      value.operand?.kind === "storage" &&
      ["captured", "merge"].includes(value.operand.requestId) &&
      value.operand.addressByte === undefined &&
      (value.operand.offset ?? 0) === 0 &&
      !value.memory.some(({ volatile }) => volatile)
        ? value.operand.requestId
        : null,
  };
  return { caller, leaf, context };
}

describe("private Boolean return provenance", () => {
  it("should prove a certified call captured through an exactly joined private byte", () => {
    const { caller, context } = fixture();
    const original = structuredClone(caller);
    expect(deriveBooleanExitFacts(caller)).toBeNull();
    expect(deriveBooleanExitFacts(caller, context)).not.toBeNull();
    expect(caller).toEqual(original);
  });

  it("should discover captured-call dependencies independently of source order", () => {
    const { caller, leaf, context } = fixture();
    for (const functions of [
      [caller, leaf],
      [leaf, caller],
    ]) {
      const facts = deriveBooleanExitGraph(functions, (_fn, value) => context.privateByte(value));
      expect(facts.has(caller.id)).toBe(true);
      expect(facts.has(leaf.id)).toBe(true);
    }
  });

  it("should invalidate an unchanged caller certificate when its dependent body changes", () => {
    const { caller, leaf, context } = fixture();
    const facts = deriveBooleanExitFacts(caller, context);
    if (facts === null) throw new Error("Expected the captured-call certificate");
    expect(validBooleanExitFacts(facts, caller, context.functions)).toBe(true);
    context.functions.set(leaf.id, { ...leaf });
    expect(validBooleanExitFacts(facts, caller, context.functions)).toBe(false);
    expect(deriveBooleanExitFacts(caller, context)).toBeNull();
  });

  it.each([
    "missing initialization",
    "noncanonical arm",
    "wrong offset",
    "unknown memory write",
    "unknown call",
    "restored status",
    "unstructured branch",
    "external trap",
  ])("should reject %s rather than claim a canonical captured return", (reason) => {
    const { caller, context } = fixture();
    const changed: MachineFunction = {
      ...caller,
      blocks: caller.blocks.map((block) => {
        let instructions = [...block.instructions];
        if (block.label === "bypassed" && reason === "missing initialization") instructions.pop();
        if (block.label === "bypassed" && reason === "noncanonical arm")
          instructions[0] = instruction("lda", undefined, 2);
        if (block.label === "join" && reason === "wrong offset")
          instructions[0] = machineInstruction(cpu, "lda", "storage", {
            kind: "storage",
            requestId: "merge",
            offset: 1,
          });
        if (block.label === "join" && reason === "unknown memory write")
          instructions.unshift(
            machineInstruction(cpu, "sta", "absolute", { kind: "absolute", value: 0x4000 }),
          );
        if (block.label === "join" && reason === "unknown call")
          instructions.unshift(
            machineInstruction(cpu, "jsr", "absolute", { kind: "label", label: "unknown" }),
          );
        if (block.label === "join" && reason === "restored status")
          instructions.push(instruction("plp"));
        if (block.label === "join" && reason === "unstructured branch")
          instructions.push(
            machineInstruction(cpu, "bne", "relative", { kind: "label", label: "entry" }),
          );
        if (block.label === "join" && reason === "external trap")
          instructions.push(instruction("brk"));
        return { ...block, instructions };
      }),
    };
    expect(deriveBooleanExitFacts(changed, context)).toBeNull();
  });

  it("should lose private memory facts across unknown calls even before a later reload", () => {
    const { caller, context } = fixture();
    expect(deriveBooleanExitFacts(caller, { ...context, privateByte: () => null })).toBeNull();
    expect(deriveBooleanExitFacts(caller, { ...context, callees: new Map() })).toBeNull();
  });
});
