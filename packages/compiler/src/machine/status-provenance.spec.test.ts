import { describe, expect, it } from "vitest";
import { validateMachineProgram } from "./bind.js";
import type {
  MachineBlock,
  MachineFunction,
  MachineInstruction,
  MachineProgram,
} from "./machine-types.js";

const STATUS_FLAGS = ["n", "v", "d", "i", "z", "c"] as const;

/** Describe the exact official stack and flag effects without deriving them from a CPU table. */
function instruction(opcode: "php" | "plp" | "pha" | "pla" | "clv" | "jsr"): MachineInstruction {
  const base: MachineInstruction = {
    opcode,
    mode: "implied",
    operand: null,
    uses: { registers: [], flags: [] },
    defines: { registers: [], flags: [] },
    memory: [],
    cost: { bytes: 1, minCycles: 2, maxCycles: 2 },
    source: null,
  };
  switch (opcode) {
    case "php":
      return {
        ...base,
        uses: { registers: ["s"], flags: STATUS_FLAGS },
        defines: { registers: ["s"], flags: [] },
        cost: { bytes: 1, minCycles: 3, maxCycles: 3 },
      };
    case "plp":
      return {
        ...base,
        uses: { registers: ["s"], flags: [] },
        defines: { registers: ["s"], flags: STATUS_FLAGS },
        cost: { bytes: 1, minCycles: 4, maxCycles: 4 },
      };
    case "pha":
      return {
        ...base,
        uses: { registers: ["a", "s"], flags: [] },
        defines: { registers: ["s"], flags: [] },
        cost: { bytes: 1, minCycles: 3, maxCycles: 3 },
      };
    case "pla":
      return {
        ...base,
        uses: { registers: ["s"], flags: [] },
        defines: { registers: ["a", "s"], flags: ["n", "z"] },
        cost: { bytes: 1, minCycles: 4, maxCycles: 4 },
      };
    case "clv":
      return { ...base, defines: { registers: [], flags: ["v"] } };
    case "jsr":
      return {
        ...base,
        mode: "absolute",
        operand: { kind: "label", label: "helper" },
        uses: { registers: ["s"], flags: [] },
        defines: { registers: ["s"], flags: [] },
        cost: { bytes: 3, minCycles: 6, maxCycles: 6 },
      };
  }
}

/** A volatile byte read supplies an unconstrained branch choice without supplying overflow. */
function readByte(): MachineInstruction {
  return {
    opcode: "lda",
    mode: "absolute",
    operand: { kind: "absolute", value: 0x0400 },
    uses: { registers: [], flags: [] },
    defines: { registers: ["a"], flags: ["n", "z"] },
    memory: [
      {
        kind: "read",
        address: { kind: "absolute", value: 0x0400 },
        width: 1,
        volatile: true,
        order: 0,
      },
    ],
    cost: { bytes: 3, minCycles: 4, maxCycles: 4 },
    source: null,
  };
}

/** Terminate by consuming exactly one tracked flag on two terminal paths. */
function branchBlock(
  label: string,
  instructions: readonly MachineInstruction[],
  flag: "v" | "z" = "v",
): MachineBlock {
  return {
    label,
    instructions,
    terminator: {
      kind: "branch",
      opcode: flag === "v" ? "bvs" : "beq",
      target: "taken",
      fallthrough: "exit",
      uses: { registers: [], flags: [flag] },
      cost: { bytes: 2, minCycles: 2, maxCycles: 4 },
    },
  };
}

/** Keep all storage and terminal paths explicit so each case varies only status provenance. */
function program(
  blocks: readonly MachineBlock[],
  functions: readonly MachineFunction[] = [],
): MachineProgram {
  return {
    functions,
    data: [],
    requiredStorage: [],
    startup: {
      id: "entry",
      blocks: [
        ...blocks,
        { label: "exit", instructions: [], terminator: { kind: "unreachable" } },
        { label: "taken", instructions: [], terminator: { kind: "unreachable" } },
      ],
    },
  };
}

describe("saved processor status provenance", () => {
  // Pushing and pulling unknown status preserves uncertainty rather than creating a flag producer.
  it.each([
    ["an unchanged unknown snapshot", ["php", "plp"]],
    ["an unknown snapshot with an inner overflow producer", ["php", "clv", "plp"]],
    [
      "an outer unknown snapshot around an inner known snapshot",
      ["php", "clv", "php", "plp", "plp"],
    ],
  ] as const)("should reject an overflow branch after %s", (_name, opcodes) => {
    expect(validateMachineProgram(program([branchBlock("entry", opcodes.map(instruction))]))).toBe(
      false,
    );
  });

  // A matched restore makes a previously established flag usable again.
  it.each([
    ["one known snapshot", ["clv", "php", "plp"]],
    ["nested known snapshots", ["clv", "php", "php", "plp", "plp"]],
  ] as const)("should retain overflow provenance through %s", (_name, opcodes) => {
    expect(validateMachineProgram(program([branchBlock("entry", opcodes.map(instruction))]))).toBe(
      true,
    );
  });

  // Ordinary saved accumulator bytes must not displace or erase a deeper status snapshot.
  it.each([false, true])("should preserve the saved overflow proof around PHA/PLA: %s", (known) => {
    const instructions = [
      readByte(),
      ...(known ? [instruction("clv")] : []),
      instruction("php"),
      instruction("pha"),
      instruction("clv"),
      instruction("pla"),
      instruction("plp"),
    ];
    expect(validateMachineProgram(program([branchBlock("entry", instructions)]))).toBe(known);
  });

  // Facts stored in matching stack slots intersect at a merge just as current flag facts do.
  it.each([false, true])("should require overflow in every saved predecessor: %s", (bothKnown) => {
    const entry = branchBlock("entry", [readByte()], "z");
    const branch: MachineBlock = {
      ...entry,
      terminator: {
        ...entry.terminator,
        kind: "branch",
        opcode: "beq",
        target: "left",
        fallthrough: "right",
        uses: { registers: [], flags: ["z"] },
        cost: { bytes: 2, minCycles: 2, maxCycles: 4 },
      },
    };
    const path = (label: string, known: boolean): MachineBlock => ({
      label,
      instructions: [...(known ? [instruction("clv")] : []), instruction("php")],
      terminator: {
        kind: "jump",
        opcode: "jmp",
        target: "merge",
        cost: { bytes: 3, minCycles: 3, maxCycles: 3 },
      },
    });
    const merged = program([
      branch,
      path("left", true),
      path("right", bothKnown),
      branchBlock("merge", [instruction("clv"), instruction("plp")]),
    ]);
    expect(validateMachineProgram(merged)).toBe(bothKnown);
  });

  // A balanced callee owns only its own stack entries; it cannot consume its caller's snapshot.
  it.each([false, true])("should restore caller status across a balanced helper: %s", (known) => {
    const helper: MachineFunction = {
      id: "helper",
      blocks: [
        {
          label: "helper",
          instructions: [instruction("php"), instruction("clv"), instruction("plp")],
          terminator: {
            kind: "return",
            opcode: "rts",
            cost: { bytes: 1, minCycles: 6, maxCycles: 6 },
          },
        },
      ],
    };
    const instructions = [
      ...(known ? [instruction("clv")] : []),
      instruction("php"),
      instruction("jsr"),
      instruction("plp"),
    ];
    expect(validateMachineProgram(program([branchBlock("entry", instructions)], [helper]))).toBe(
      known,
    );
  });
});
