import { describe, expect, it } from "vitest";
import { machineInstruction } from "./lower-control.js";
import { selectedProfile } from "./lowering-test-support.js";
import type { MachineBlock, MachineFunction, MachineInstruction } from "./machine-types.js";
import { foldShiftHome } from "./optimization-shift-home.js";

const CPU = selectedProfile().cpu;
const HOME = Object.freeze({ kind: "storage" as const, requestId: "home", offset: 0 });

/** Build the exact `lda home; shift A; sta home` triple the fold targets. */
function shiftTriple(shift: "asl" | "lsr" | "rol" | "ror"): MachineInstruction[] {
  return [
    machineInstruction(CPU, "lda", "storage", HOME),
    machineInstruction(CPU, shift, "accumulator"),
    machineInstruction(CPU, "sta", "storage", HOME),
  ];
}

/** Build a single-block function with a return terminator. */
function functionWith(instructions: readonly MachineInstruction[]): MachineFunction {
  const block: MachineBlock = Object.freeze({
    label: "entry",
    instructions: Object.freeze([...instructions]),
    terminator: Object.freeze({ kind: "return" }),
  });
  return Object.freeze({ id: "entry", blocks: Object.freeze([block]) });
}

/** Return the only block's instructions after the fold. */
function foldedInstructions(fn: MachineFunction): readonly MachineInstruction[] {
  return foldShiftHome(CPU, [fn])[0]!.blocks[0]!.instructions;
}

describe("shift-home fold A liveness", () => {
  it.each(["asl", "lsr", "rol", "ror"] as const)(
    "folds %s when a later instruction overwrites A before reading it",
    (shift) => {
      const reload = machineInstruction(
        CPU,
        "lda",
        "immediate",
        Object.freeze({ kind: "immediate", value: 0 }),
      );
      const folded = foldedInstructions(functionWith([...shiftTriple(shift), reload]));
      expect(folded.map(({ opcode }) => opcode)).toEqual([shift, "lda"]);
      expect(folded[0]).toMatchObject({ opcode: shift, mode: "storage", operand: HOME });
    },
  );

  it.each(["adc", "and", "eor", "ora"] as const)(
    "keeps the triple when a later %s reads the A result before overwriting it",
    (opcode) => {
      // These instructions both read and write A. Treating the write as proof
      // that A is dead would feed them the pre-load value instead of the shift
      // result, so the fold must stay unreachable here.
      const consumer = machineInstruction(
        CPU,
        opcode,
        "immediate",
        Object.freeze({ kind: "immediate", value: 1 }),
      );
      const instructions = foldedInstructions(functionWith([...shiftTriple("asl"), consumer]));
      expect(instructions.map(({ opcode }) => opcode)).toEqual(["lda", "asl", "sta", opcode]);
    },
  );

  it("keeps the triple when a successor block reads A before defining it", () => {
    const successor: MachineBlock = Object.freeze({
      label: "successor",
      instructions: Object.freeze([
        machineInstruction(CPU, "sta", "storage", HOME),
        machineInstruction(CPU, "lda", "immediate", Object.freeze({ kind: "immediate", value: 0 })),
      ]),
      terminator: Object.freeze({ kind: "return" }),
    });
    const fn: MachineFunction = Object.freeze({
      id: "entry",
      blocks: Object.freeze([
        Object.freeze({
          label: "entry",
          instructions: Object.freeze(shiftTriple("asl")),
          terminator: Object.freeze({
            kind: "jump" as const,
            opcode: "jmp" as const,
            target: "successor",
            cost: Object.freeze({ bytes: 3, minCycles: 3, maxCycles: 3 }),
          }),
        }),
        successor,
      ]),
    });
    expect(foldedInstructions(fn).map(({ opcode }) => opcode)).toEqual(["lda", "asl", "sta"]);
  });
});
