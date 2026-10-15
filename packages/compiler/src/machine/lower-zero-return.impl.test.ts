import { describe, expect, it } from "vitest";
import { repairMachineBranches } from "./block-layout.js";
import { machineInstruction } from "./lower-control.js";
import { selectZeroReturn } from "./lower-register-forwarding.js";
import { selectedProfile, sourceSpan } from "./lowering-test-support.js";
import type { MachineBlock, MachineInstruction, MachineTerminator } from "./machine-types.js";

const cpu = selectedProfile().cpu;
const span = sourceSpan(970);

/** Use real instruction metadata rather than claiming A/Z facts in a fixture. */
function immediate(opcode: string, value: number): MachineInstruction {
  return machineInstruction(cpu, opcode, "immediate", { kind: "immediate", value }, [], span);
}

/** Keep both explicit destinations visible so opposite-flag entry cannot be overlooked. */
function branch(opcode = "bne", target = "one", fallthrough = "zero"): MachineTerminator {
  return {
    kind: "branch",
    opcode,
    target,
    fallthrough,
    uses: { registers: [], flags: ["z"] },
    cost: { bytes: 2, minCycles: 2, maxCycles: 4 },
  };
}

/** Ordinary Boolean leaf with a freshly loaded A and two canonical return arms. */
function leaf(
  producer = machineInstruction(cpu, "lda", "absolute", {
    kind: "absolute",
    value: 0x3300,
  }),
): readonly MachineBlock[] {
  return [
    { label: "entry", instructions: [producer], terminator: branch() },
    { label: "zero", instructions: [immediate("lda", 0)], terminator: { kind: "return" } },
    { label: "one", instructions: [immediate("lda", 1)], terminator: { kind: "return" } },
  ];
}

describe("direct zero-return selection", () => {
  for (const opcode of ["lda", "and", "ora", "eor"]) {
    it(`should reuse the immediate ${opcode} A/Z producer without storage or traffic changes`, () => {
      const blocks = leaf(immediate(opcode, 0));
      const selected = selectZeroReturn(blocks);
      expect(selected[0]).toBe(blocks[0]);
      expect(selected[1]).toEqual({ ...blocks[1], instructions: [] });
      expect(selected[2]).toEqual({
        ...blocks[2],
        terminator: { kind: "fallthrough", target: "zero" },
      });
      expect(selected.map(({ label }) => label)).toEqual(blocks.map(({ label }) => label));
    });
  }

  it("should accept a taken BEQ zero edge and keep one shared eight-byte return layout", () => {
    const blocks = leaf();
    const selected = selectZeroReturn([
      { ...blocks[0]!, terminator: branch("beq", "zero", "one") },
      ...blocks.slice(1),
    ]);
    const repaired = repairMachineBranches({ id: "predicate", blocks: selected }, 0x2000);
    if (repaired.kind !== "complete") throw new Error(repaired.reason);
    expect(repaired.byteLength).toBe(8);
    expect(repaired.function.blocks.map(({ label }) => label)).toEqual(["entry", "one", "zero"]);
    expect(repaired.function.blocks[0]!.terminator).toMatchObject({
      opcode: "beq",
      target: "zero",
      fallthrough: "one",
    });
    expect(repaired.function.blocks[2]!.terminator.kind).toBe("return");
  });

  it("should prove both direct zero predecessors without walking through an alias", () => {
    const blocks = leaf();
    const selected = selectZeroReturn([
      { ...blocks[0]!, terminator: branch("beq", "zero", "second") },
      { ...blocks[0]!, label: "second" },
      ...blocks.slice(1),
    ]);
    expect(selected.find(({ label }) => label === "zero")!.instructions).toEqual([]);
  });

  for (const opcode of ["cmp", "cpx", "cpy"]) {
    it(`should reject ${opcode} zero flags that do not prove A is zero`, () => {
      const blocks = leaf(immediate(opcode, 0));
      expect(selectZeroReturn(blocks)).toBe(blocks);
    });
  }

  for (const opcode of ["nop", "cld", "tax"]) {
    it(`should reject an intervening ${opcode} instead of inventing flag availability`, () => {
      const blocks = leaf();
      const changed = [
        {
          ...blocks[0]!,
          instructions: [
            ...blocks[0]!.instructions,
            machineInstruction(cpu, opcode, "implied", null),
          ],
        },
        ...blocks.slice(1),
      ];
      expect(selectZeroReturn(changed)).toBe(changed);
    });
  }

  for (const edge of [
    branch("beq"),
    branch("bcc"),
    branch("bne", "zero", "zero"),
    { kind: "jump", opcode: "jmp", target: "zero", cost: { bytes: 3, minCycles: 3, maxCycles: 3 } },
    { kind: "fallthrough", target: "zero" },
    {
      kind: "long-branch",
      opcode: "bne",
      fallthrough: "one",
      jump: { opcode: "jmp", target: "zero", cost: { bytes: 3, minCycles: 3, maxCycles: 3 } },
      uses: { registers: [], flags: ["z"] },
      cost: { bytes: 5, minCycles: 3, maxCycles: 5 },
    },
  ] satisfies readonly MachineTerminator[]) {
    it(`should reject unproved ${edge.kind} entry into the zero arm`, () => {
      const blocks = leaf();
      const changed = [...blocks, { ...blocks[0]!, label: "unproved", terminator: edge }];
      expect(selectZeroReturn(changed)).toBe(changed);
    });
  }

  it("should reject a zero arm which is the function entry", () => {
    const blocks = leaf();
    const changed = [blocks[1]!, blocks[0]!, blocks[2]!];
    expect(selectZeroReturn(changed)).toBe(changed);
  });

  it("should reject duplicate labels and undeclared instruction-operand entries", () => {
    const blocks = leaf();
    const duplicate = [...blocks, blocks[0]!];
    expect(selectZeroReturn(duplicate)).toBe(duplicate);
    const reference = [
      ...blocks,
      {
        label: "reference",
        instructions: [
          machineInstruction(cpu, "jsr", "absolute", { kind: "label", label: "zero" }),
        ],
        terminator: { kind: "unreachable" as const },
      },
    ];
    expect(selectZeroReturn(reference)).toBe(reference);
  });

  it("should reject altered constants, extra instructions and a third return arm", () => {
    const blocks = leaf();
    for (const instructions of [
      [immediate("lda", 2)],
      [immediate("lda", 0), immediate("lda", 1)],
    ]) {
      const changed = [blocks[0]!, { ...blocks[1]!, instructions }, blocks[2]!];
      expect(selectZeroReturn(changed)).toBe(changed);
    }
    const third = [...blocks, { ...blocks[2]!, label: "third" }];
    expect(selectZeroReturn(third)).toBe(third);
  });

  it("should reject missing direct entry instead of treating unreachable code as proof", () => {
    const blocks = leaf();
    const changed = [
      { ...blocks[0]!, terminator: { kind: "unreachable" as const } },
      ...blocks.slice(1),
    ];
    expect(selectZeroReturn(changed)).toBe(changed);
  });
});
