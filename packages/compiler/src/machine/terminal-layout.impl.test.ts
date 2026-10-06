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

  it("does not collapse a loop with an explicit timing instruction", () => {
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
    expect(result.byteLength).toBe(10);
    expect(result.function.blocks.map(({ terminator }) => terminator.kind)).toEqual([
      "jump",
      "jump",
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
    expect(result.byteLength).toBe(7);
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
});
