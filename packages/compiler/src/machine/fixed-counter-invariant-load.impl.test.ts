import { describe, expect, it } from "vitest";
import { prepareFixedLoopFixture } from "./fixed-loop-test-support.js";
import type { MachineFunction } from "./machine-types.js";

/**
 * Fill successive elements of a module array inside the lowered `work` routine.
 *
 * @param bound Exclusive loop bound, which is also the proved trip count.
 * @param rhs Source expression for the stored byte.
 */
function fill(bound: number, rhs = "7"): string {
  return `module Game;let rows:byte[8]=[;0];function work():void{for(let i:word=0;i<${bound};i+=1){rows[i]=${rhs};}}function main():void{work();}`;
}

/**
 * Opcodes of the lowered block playing one role in the loop.
 *
 * Blocks are located by the role their label records rather than by position,
 * so a later change to the emitted order cannot quietly point an assertion at a
 * different block.
 */
function roleOpcodes(fn: MachineFunction, role: string): readonly string[] {
  const blocks = fn.blocks.filter((block) => block.label.endsWith(role));
  expect(blocks, `lowered blocks for ${role}`).toHaveLength(1);
  return blocks[0]!.instructions.map((instruction) => instruction.opcode);
}

describe("an invariant byte loaded ahead of its loop", () => {
  it("leaves the store alone in the body and carries the load into the preheader", () => {
    const fixture = prepareFixedLoopFixture(fill(4), "x-first");
    expect(roleOpcodes(fixture.machine, "entry")).toEqual(["ldx", "lda"]);
    expect(roleOpcodes(fixture.machine, "for-body")).toEqual(["sta"]);
  });

  it("keeps the load in the body of a loop proved to run once", () => {
    // One trip has no repeated load to remove, so moving it would reorder the
    // emitted bytes and buy nothing at all.
    const fixture = prepareFixedLoopFixture(fill(1), "x-first");
    expect(roleOpcodes(fixture.machine, "entry")).toEqual(["ldx"]);
    expect(roleOpcodes(fixture.machine, "for-body")).toEqual(["lda", "sta"]);
  });

  it("keeps a hardware read where the source put it", () => {
    // A volatile read is an input whose count and order are themselves
    // observable, so moving one changes what the program observes even when the
    // byte it returns would have been identical. This is the guard's own
    // witness: the body is otherwise the same two instructions that do move.
    const fixture = prepareFixedLoopFixture(fill(4, "peek($D012)"), "x-first");
    expect(roleOpcodes(fixture.machine, "entry")).toEqual(["ldx"]);
    expect(roleOpcodes(fixture.machine, "for-body")).toEqual(["lda", "sta"]);
  });
});
