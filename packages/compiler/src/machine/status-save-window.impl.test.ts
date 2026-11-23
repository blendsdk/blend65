import { describe, expect, it } from "vitest";
import { NMOS_6510, nmosInstructionState } from "../target/nmos6510.js";
import { nop, state } from "./lowering-test-support.js";
import type { MachineInstruction } from "./machine-types.js";
import { matchedStatusRestore } from "./status-save-window.js";

/** The pair every case asks about. */
const PAIR = new Set(["n", "z"]);

/**
 * One instruction carrying the documented architectural effects of its mnemonic,
 * so a case never has to restate what the processor already says.
 */
function real(opcode: string, mode = "implied"): MachineInstruction {
  const facts = nmosInstructionState(NMOS_6510, opcode, mode);
  if (facts === null) throw new Error(`No documented form for ${opcode} ${mode}`);
  return Object.freeze({
    ...nop(),
    opcode,
    mode,
    uses: state(facts.usesRegisters, facts.usesFlags),
    defines: state(facts.definesRegisters, facts.definesFlags),
  });
}

/** One instruction built from the inert default, overriding only what a case needs. */
function instruction(overrides: Partial<MachineInstruction> = {}): MachineInstruction {
  return Object.freeze({ ...nop(), ...overrides });
}

describe("a matched status save and restore", () => {
  it("reports the restore that closes the generated ownership prologue", () => {
    const window = [
      real("php"),
      real("pha"),
      real("sei"),
      real("lda", "absolute"),
      real("sta", "absolute"),
      real("pla"),
      real("plp"),
    ];
    expect(matchedStatusRestore(window, 0, PAIR)).toBe(6);
  });

  it("reports an immediate restore", () => {
    expect(matchedStatusRestore([real("php"), real("plp")], 0, PAIR)).toBe(1);
  });

  it("finds the window from a save part-way through a block", () => {
    const block = [real("lda", "absolute"), real("php"), real("sei"), real("plp"), real("nop")];
    expect(matchedStatusRestore(block, 1, PAIR)).toBe(3);
  });

  it("allows a balanced accumulator save inside the window", () => {
    const window = [real("php"), real("pha"), real("pla"), real("plp")];
    expect(matchedStatusRestore(window, 0, PAIR)).toBe(3);
  });

  it("allows an inner restore that pulls a byte of its own", () => {
    const window = [real("php"), real("php"), real("plp"), real("plp")];
    // The nested save is built rather than taken from the table: a save reads the
    // pair, so the documented `php` would refuse here on its flag use alone.
    const silentSave = instruction({ opcode: "php", uses: state(["s"]), defines: state(["s"]) });
    expect(matchedStatusRestore([window[0]!, silentSave, window[2]!, window[3]!], 0, PAIR)).toBe(3);
  });

  it("allows a flag read the walk is not asking about", () => {
    const window = [real("php"), real("adc", "immediate"), real("plp")];
    expect(window[1]?.uses.flags).toContain("c");
    expect(matchedStatusRestore(window, 0, PAIR)).toBe(2);
  });

  it("refuses an index that is not a save", () => {
    expect(matchedStatusRestore([real("pha"), real("plp")], 0, PAIR)).toBeNull();
    expect(matchedStatusRestore([real("php"), real("plp")], 1, PAIR)).toBeNull();
    expect(matchedStatusRestore([], 0, PAIR)).toBeNull();
  });

  it("refuses a window whose block ends before the restore", () => {
    expect(matchedStatusRestore([real("php"), real("sei")], 0, PAIR)).toBeNull();
  });

  it("refuses a read of either flag inside the window", () => {
    for (const flag of ["n", "z"] as const) {
      const reader = instruction({ opcode: "bpl", uses: state([], [flag]) });
      expect(matchedStatusRestore([real("php"), reader, real("plp")], 0, PAIR)).toBeNull();
    }
  });

  it("refuses a nested save, which reads the pair it would preserve", () => {
    expect(
      matchedStatusRestore([real("php"), real("php"), real("plp"), real("plp")], 0, PAIR),
    ).toBeNull();
  });

  it("refuses a pull that consumes the saved byte into the accumulator", () => {
    expect(matchedStatusRestore([real("php"), real("pla")], 0, PAIR)).toBeNull();
    expect(matchedStatusRestore([real("php"), real("pla"), real("plp")], 0, PAIR)).toBeNull();
  });

  it("refuses any other instruction that moves or reads the stack pointer", () => {
    for (const opcode of ["jsr", "rts", "rti", "tsx", "txs", "brk"]) {
      const mode = opcode === "jsr" ? "absolute" : "implied";
      expect(
        matchedStatusRestore([real("php"), real(opcode, mode), real("plp")], 0, PAIR),
      ).toBeNull();
    }
  });

  it("refuses a restore that leaves the saved byte on the stack", () => {
    const window = [real("php"), real("pha"), real("plp"), real("sei")];
    expect(matchedStatusRestore(window, 0, PAIR)).toBeNull();
  });
});
