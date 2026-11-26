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

  it("keeps the load in a body whose loop carries more than the store and the step", () => {
    // The inner loop runs between one store and the next and leaves its own
    // value in the accumulator, so a byte loaded before the outer loop would be
    // gone by the second trip. Asking only about the test, the body and the step
    // would not see it: the blocks that do the damage are in neither.
    const fixture = prepareFixedLoopFixture(
      `module Game;let rows:byte[8]=[;0];let value:byte=7;let k:byte=0;function work():void{for(let i:word=0;i<4;i+=1){rows[i]=value;while(k<3){k+=1;}}}function main():void{work();}`,
      "x-first",
    );
    expect(roleOpcodes(fixture.machine, "entry")).toEqual(["ldx"]);
    expect(roleOpcodes(fixture.machine, "for-body")).toEqual(["lda", "sta"]);
  });

  it("keeps the load where an installed handler can write the byte", () => {
    // The handler can run between two trips and write the stored global, so the
    // loop may not treat it as unchanged. This is visible here and nowhere in
    // the emitted output, because such a program loses this construction for an
    // unrelated reason before anything is emitted.
    const fixture = prepareFixedLoopFixture(
      `module Game;
import { setNMI, restoreNMI } from c64.system;
let rows:byte[8]=[;0];
let value:byte=7;
interrupt function handler():void{value=1;}
function work():void{for(let i:word=0;i<4;i+=1){rows[i]=value;}}
function main():void{setNMI(&handler);work();restoreNMI();}`,
      "x-first",
    );
    expect(fixture.input.program.interruptRoutes ?? []).toHaveLength(1);
    expect(roleOpcodes(fixture.machine, "entry")).toEqual(["ldx"]);
    expect(roleOpcodes(fixture.machine, "for-body")).toEqual(["lda", "sta"]);
  });

  it("keeps a hardware read where the source put it", () => {
    // A hardware read is an input whose count and order are themselves
    // observable, so moving one changes what the program observes even when the
    // byte it returns would have been identical.
    //
    // What refuses it today is the operand test, not the volatility test: a
    // hardware read reaches its address as a literal rather than through a
    // name. The volatility test is the one that would still refuse a named
    // hardware register, and it has no witness because no such read exists yet.
    const fixture = prepareFixedLoopFixture(fill(4, "peek($D012)"), "x-first");
    expect(roleOpcodes(fixture.machine, "entry")).toEqual(["ldx"]);
    expect(roleOpcodes(fixture.machine, "for-body")).toEqual(["lda", "sta"]);
  });
});
