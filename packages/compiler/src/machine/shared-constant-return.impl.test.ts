import { describe, expect, it } from "vitest";
import { repairMachineBranches } from "./block-layout.js";
import { machineInstruction } from "./lower-control.js";
import { nop, selectedProfile, sourceSpan } from "./lowering-test-support.js";
import type { MachineBlock, MachineFunction } from "./machine-types.js";

const cpu = selectedProfile().cpu;

/** Equal constants have identical hardware effects even at different source spans. */
function arm(label: string, value: number): MachineBlock {
  return {
    label,
    instructions: [
      machineInstruction(
        cpu,
        "lda",
        "immediate",
        { kind: "immediate", value },
        [],
        sourceSpan(label === "first" ? 981 : 982),
      ),
    ],
    terminator: { kind: "return", opcode: "rts", cost: { bytes: 1, minCycles: 6, maxCycles: 6 } },
  };
}

/** A real source-like branch chain reaches either identical return or its distinct default. */
function chain(value = 2): MachineFunction {
  const branch = (target: string, fallthrough: string) => ({
    kind: "branch" as const,
    opcode: "bne",
    target,
    fallthrough,
    uses: { registers: [], flags: ["z" as const] },
    cost: { bytes: 2, minCycles: 2, maxCycles: 4 },
  });
  return {
    id: "classified",
    blocks: [
      {
        label: "entry",
        instructions: [
          machineInstruction(cpu, "lda", "absolute", { kind: "absolute", value: 0x3300 }),
        ],
        terminator: branch("first", "second-test"),
      },
      {
        label: "second-test",
        instructions: [
          machineInstruction(cpu, "lda", "absolute", { kind: "absolute", value: 0x3301 }),
        ],
        terminator: branch("second", "default"),
      },
      arm("first", value),
      arm("second", value),
      arm("default", value === 1 ? 2 : 1),
    ],
  };
}

/** Fail rather than interpreting missing placement as an empty successful function. */
function repair(fn: MachineFunction) {
  const result = repairMachineBranches(fn, 0x2000);
  if (result.kind !== "complete") throw new Error(result.reason);
  return result;
}

describe("shared pure constant-return layout", () => {
  for (const value of [0, 1, 2, 0xff]) {
    it(`should share constant ${value} while preserving every source label`, () => {
      const fn = chain(value);
      const result = repair(fn);
      expect(result.byteLength).toBe(16);
      const blocks = result.function.blocks;
      const first = blocks.find(({ label }) => label === "first")!;
      const second = blocks.find(({ label }) => label === "second")!;
      expect(first.origin).toBe(second.origin);
      expect(first.instructions).toEqual(fn.blocks[2]!.instructions);
      expect(second.instructions).toEqual([]);
      expect(second.terminator).toEqual({ kind: "fallthrough", target: "first" });
      expect(blocks.filter(({ terminator }) => terminator.kind === "return")).toHaveLength(2);
      expect(blocks.map(({ label }) => label).sort()).toEqual(
        fn.blocks.map(({ label }) => label).sort(),
      );
      expect(fn.blocks[3]!.instructions).toHaveLength(1);
      expect(repair(result.function).byteLength).toBe(result.byteLength);
    });
  }

  it("should not fold unequal constants", () => {
    const fn = chain();
    const result = repair({
      ...fn,
      blocks: fn.blocks.map((block) => (block.label === "second" ? arm("second", 3) : block)),
    });
    expect(
      result.function.blocks.filter(({ terminator }) => terminator.kind === "return"),
    ).toHaveLength(3);
    expect(result.byteLength).toBe(19);
  });

  for (const opcode of ["lda", "ldx"]) {
    it(`should not share a ${opcode} memory load merely because its address matches`, () => {
      const fn = chain();
      const result = repair({
        ...fn,
        blocks: fn.blocks.map((block) =>
          block.label === "first" || block.label === "second"
            ? {
                ...block,
                instructions: [
                  machineInstruction(cpu, opcode, "absolute", { kind: "absolute", value: 0x3302 }),
                ],
              }
            : block,
        ),
      });
      expect(
        result.function.blocks.filter(({ terminator }) => terminator.kind === "return"),
      ).toHaveLength(3);
    });
  }

  it("should not fold an extra instruction or a declared memory effect", () => {
    const fn = chain();
    for (const extra of [false, true]) {
      const changed = fn.blocks.map((block) => {
        if (block.label !== "first" && block.label !== "second") return block;
        const load = block.instructions[0]!;
        return {
          ...block,
          instructions: extra
            ? [load, nop()]
            : [
                {
                  ...load,
                  memory: [
                    {
                      kind: "read" as const,
                      address: { kind: "absolute" as const, value: 0x3302 },
                      width: 1 as const,
                      volatile: true,
                      order: 0,
                    },
                  ],
                },
              ],
        };
      });
      const result = repair({ ...fn, blocks: changed });
      expect(
        result.function.blocks.filter(({ terminator }) => terminator.kind === "return"),
      ).toHaveLength(3);
    }
  });

  it("should preserve startup jumps instead of treating them as ordinary RTS", () => {
    const fn = chain();
    const result = repair({
      ...fn,
      blocks: fn.blocks.map((block) =>
        block.label === "first" || block.label === "second"
          ? {
              ...block,
              terminator: {
                kind: "jump" as const,
                opcode: "jmp" as const,
                target: "startup.restore",
                cost: { bytes: 3, minCycles: 3, maxCycles: 3 },
              },
            }
          : block,
      ),
    });
    expect(
      result.function.blocks.find(({ label }) => label === "first")!.instructions,
    ).toHaveLength(1);
    expect(
      result.function.blocks.find(({ label }) => label === "second")!.instructions,
    ).toHaveLength(1);
  });

  it("should preserve non-byte immediates and relocation operands", () => {
    const fn = chain();
    for (const value of [-1, 256, 1.5]) {
      const result = repair({
        ...fn,
        blocks: fn.blocks.map((block) =>
          block.label === "first" || block.label === "second" ? arm(block.label, value) : block,
        ),
      });
      expect(
        result.function.blocks.filter(({ terminator }) => terminator.kind === "return"),
      ).toHaveLength(3);
    }
    const result = repair({
      ...fn,
      blocks: fn.blocks.map((block) =>
        block.label === "first" || block.label === "second"
          ? {
              ...block,
              instructions: [
                machineInstruction(cpu, "lda", "immediate", {
                  kind: "label",
                  label: "object",
                  addressByte: "low",
                }),
              ],
            }
          : block,
      ),
    });
    expect(
      result.function.blocks.filter(({ terminator }) => terminator.kind === "return"),
    ).toHaveLength(3);
  });
});
