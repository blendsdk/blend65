import { describe, expect, it } from "vitest";
import { repairMachineBranches } from "./block-layout.js";
import { machineInstruction } from "./lower-control.js";
import { selectedProfile } from "./lowering-test-support.js";
import type { MachineFunction } from "./machine-types.js";

/** Preserve the declared entry/condition/body labels while testing physical layout. */
function emptyLoop(): MachineFunction {
  const jump = (target: string) => ({
    kind: "jump" as const,
    opcode: "jmp" as const,
    target,
    cost: { bytes: 3, minCycles: 3, maxCycles: 3 },
  });
  return {
    id: "loop",
    blocks: [
      { label: "entry", instructions: [], terminator: jump("condition") },
      { label: "condition", instructions: [], terminator: jump("body") },
      { label: "body", instructions: [], terminator: jump("condition") },
    ],
  };
}

describe("effect-free terminal layout", () => {
  it("shares adjacent empty labels while keeping one exact self-loop", () => {
    const result = repairMachineBranches(emptyLoop(), 0x2000);
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected layout");
    expect(result.byteLength).toBe(3);
    expect(result.function.blocks.map(({ origin }) => origin)).toEqual([0x2000, 0x2000, 0x2000]);
    expect(result.function.blocks.map(({ label }) => label)).toEqual([
      "entry",
      "condition",
      "body",
    ]);
    expect(result.function.blocks.map(({ terminator }) => terminator.kind)).toEqual([
      "fallthrough",
      "fallthrough",
      "jump",
    ]);
    expect(result.function.blocks[2]!.terminator).toMatchObject({
      target: "condition",
      cost: { bytes: 3, minCycles: 3, maxCycles: 3 },
    });
  });

  it("retains an explicit timing instruction while removing ordinary redundant jumps", () => {
    const fn = emptyLoop();
    const result = repairMachineBranches(
      {
        ...fn,
        blocks: fn.blocks.map((block, index) =>
          index !== 2
            ? block
            : {
                ...block,
                instructions: [machineInstruction(selectedProfile().cpu, "nop", "implied", null)],
              },
        ),
      },
      0x2000,
    );
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected layout");
    expect(result.byteLength).toBe(4);
    expect(
      result.function.blocks
        .flatMap(({ instructions }) => instructions)
        .map(({ opcode }) => opcode),
    ).toEqual(["nop"]);
    expect(result.function.blocks.map(({ terminator }) => terminator.kind)).toEqual([
      "fallthrough",
      "fallthrough",
      "jump",
    ]);
  });

  it("keeps return duties on a finite empty body", () => {
    const fn = emptyLoop();
    const result = repairMachineBranches(
      {
        ...fn,
        blocks: fn.blocks.map((block, index) =>
          index !== 2
            ? block
            : {
                ...block,
                terminator: { kind: "return" as const },
              },
        ),
      },
      0x2000,
    );
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected layout");
    expect(result.byteLength).toBe(1);
    expect(result.function.blocks[2]!.terminator.kind).toBe("return");
  });

  it("retains the existing malformed duplicate-label rejection", () => {
    const fn = emptyLoop();
    expect(repairMachineBranches({ ...fn, blocks: [...fn.blocks, fn.blocks[0]!] }, 0x2000)).toEqual(
      {
        kind: "error",
        reason: "missing-label",
      },
    );
  });

  it("orders a nested condition before its shared false continuation without a bridge", () => {
    const branch = (target: string, fallthrough: string) => ({
      kind: "branch" as const,
      opcode: "bne",
      target,
      fallthrough,
      uses: { registers: [], flags: ["z" as const] },
      cost: { bytes: 2, minCycles: 2, maxCycles: 4 },
    });
    const result = repairMachineBranches(
      {
        id: "nested",
        blocks: [
          { label: "entry", instructions: [], terminator: branch("true", "second") },
          { label: "second", instructions: [], terminator: branch("third", "false") },
          { label: "true", instructions: [], terminator: { kind: "return" } },
          { label: "false", instructions: [], terminator: { kind: "return" } },
          { label: "third", instructions: [], terminator: branch("true", "false") },
        ],
      },
      0x2000,
    );
    if (result.kind !== "complete") throw new Error("Expected nested layout");
    expect(result.byteLength).toBe(8);
    expect(result.function.blocks.map(({ label }) => label)).toEqual([
      "entry",
      "second",
      "third",
      "false",
      "true",
    ]);
    expect(result.function.blocks[1]!.terminator).toMatchObject({
      kind: "branch",
      opcode: "beq",
      target: "false",
      fallthrough: "third",
    });
    expect(result.function.blocks.every(({ label }) => !label.includes(".fallthrough."))).toBe(
      true,
    );
  });

  it("keeps backward edges and external transfers as real jumps", () => {
    const fn = emptyLoop();
    const result = repairMachineBranches(
      {
        ...fn,
        blocks: [
          ...fn.blocks,
          {
            label: "external",
            instructions: [],
            terminator: {
              kind: "jump",
              opcode: "jmp",
              target: "other-function",
              cost: { bytes: 3, minCycles: 3, maxCycles: 3 },
            },
          },
        ],
      },
      0x2000,
    );
    if (result.kind !== "complete") throw new Error("Expected jump layout");
    expect(result.function.blocks[2]!.terminator).toMatchObject({
      kind: "jump",
      target: "condition",
    });
    expect(result.function.blocks[3]!.terminator).toMatchObject({
      kind: "jump",
      target: "other-function",
    });
  });
});
