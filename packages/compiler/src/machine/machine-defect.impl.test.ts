import { describe, expect, it } from "vitest";
import { NMOS_6510 } from "../target/nmos6510.js";
import type { SourceSpan } from "../project/types.js";
import { findMachineProgramDefect, validateMachineProgram } from "./bind.js";
import { machineCost, machineInstruction, machineState } from "./lower-control.js";
import type { MachineProgramDefect } from "./machine-defect.js";
import type {
  MachineBlock,
  MachineFunction,
  MachineInstruction,
  MachineProgram,
} from "./machine-types.js";

/** A tiny closed program isolates the validator's verdicts from source lowering. */
function program(
  blocks: readonly MachineBlock[],
  functions: readonly MachineFunction[] = [],
): MachineProgram {
  return { startup: { id: "startup", blocks }, functions, data: [], requiredStorage: [] };
}

function implied(opcode: string): MachineInstruction {
  return machineInstruction(NMOS_6510, opcode, "implied", null);
}

function branch(
  target: string,
  fallthrough: string,
  flag: "v" | "z" = "v",
): MachineBlock["terminator"] {
  const opcode = flag === "v" ? "bvs" : "beq";
  return {
    kind: "branch",
    opcode,
    target,
    fallthrough,
    uses: machineState([], [flag]),
    cost: machineCost(NMOS_6510, opcode, "relative"),
  };
}

const exit: MachineBlock = { label: "exit", instructions: [], terminator: { kind: "return" } };

/** A span proves the defect points at the construct rather than at a default location. */
const span: SourceSpan = { sourceId: "src/game.blend", start: 4, end: 9 };

/** A function the program names but never gives a body. */
const bodiless: MachineFunction = { id: "helper", blocks: [] };

describe("machine program defect reporting", () => {
  /**
   * Take the defect while proving it agrees with the boolean verdict.
   *
   * The two must never disagree. A refusal that produced no defect would read as a proved
   * program to every caller that asks for the boolean, which would accept malformed code.
   */
  function defectOf(subject: MachineProgram): MachineProgramDefect | null {
    const defect = findMachineProgramDefect(subject);
    expect(validateMachineProgram(subject)).toBe(defect === null);
    return defect;
  }

  it("reports no defect for a program that proves out", () => {
    expect(
      defectOf(
        program([
          { label: "entry", instructions: [implied("clv")], terminator: branch("exit", "exit") },
          exit,
        ]),
      ),
    ).toBeNull();
  });

  it("names the instruction and the source of a flag consumer without a producer", () => {
    const consumer = machineInstruction(
      NMOS_6510,
      "adc",
      "immediate",
      { kind: "immediate", value: 1 },
      [],
      span,
    );
    const defect = defectOf(
      program([{ label: "entry", instructions: [consumer], terminator: { kind: "return" } }]),
    );
    expect(defect?.opcode).toBe("adc");
    expect(defect?.source).toEqual(span);
    expect(defect?.blockLabel).toBe("entry");
    expect(defect?.reason).toContain("'adc'");
  });

  it("falls back to the first span in the block when the instruction carries none", () => {
    const located = machineInstruction(
      NMOS_6510,
      "lda",
      "immediate",
      { kind: "immediate", value: 0 },
      [],
      span,
    );
    const consumer = machineInstruction(NMOS_6510, "adc", "immediate", {
      kind: "immediate",
      value: 1,
    });
    const defect = defectOf(
      program([
        { label: "entry", instructions: [located, consumer], terminator: { kind: "return" } },
      ]),
    );
    expect(defect?.opcode).toBe("adc");
    expect(defect?.source).toEqual(span);
  });

  it("witnesses a duplicate generated block label", () => {
    const defect = defectOf(
      program([
        { label: "entry", instructions: [], terminator: { kind: "return" } },
        { label: "entry", instructions: [], terminator: { kind: "return" } },
      ]),
    );
    expect(defect?.reason).toContain("share one label");
  });

  it("witnesses a call to a function with no body", () => {
    const defect = defectOf(
      program(
        [
          {
            label: "entry",
            instructions: [
              machineInstruction(NMOS_6510, "jsr", "absolute", { kind: "label", label: "helper" }),
            ],
            terminator: { kind: "return" },
          },
        ],
        [bodiless],
      ),
    );
    expect(defect?.reason).toContain("call names a function with no body");
  });

  it("witnesses a call that leads back into the function being proved", () => {
    const recursive: MachineFunction = {
      id: "helper",
      blocks: [
        {
          label: "helper.entry",
          instructions: [
            machineInstruction(NMOS_6510, "jsr", "absolute", {
              kind: "label",
              label: "helper.entry",
            }),
          ],
          terminator: { kind: "return" },
        },
      ],
    };
    const defect = defectOf(
      program([{ label: "entry", instructions: [], terminator: { kind: "return" } }], [recursive]),
    );
    expect(defect?.reason).toContain("leads back into a function whose own proof is still open");
  });

  it("witnesses a transfer into a block with no body", () => {
    const defect = defectOf(
      program(
        [
          {
            label: "entry",
            instructions: [],
            terminator: { kind: "fallthrough", target: "helper" },
          },
        ],
        [bodiless],
      ),
    );
    expect(defect?.reason).toContain("transfer leads to a code block with no body");
  });

  it("witnesses a status restore with nothing saved", () => {
    const defect = defectOf(
      program([{ label: "entry", instructions: [implied("plp")], terminator: { kind: "return" } }]),
    );
    expect(defect?.opcode).toBe("plp");
    expect(defect?.reason).toContain("never saved");
  });

  it("witnesses two paths joining with different hardware-stack contents", () => {
    const defect = defectOf(
      program([
        {
          label: "entry",
          instructions: [
            machineInstruction(NMOS_6510, "lda", "immediate", { kind: "immediate", value: 0 }),
          ],
          terminator: branch("left", "right", "z"),
        },
        {
          label: "left",
          instructions: [implied("pha")],
          terminator: { kind: "fallthrough", target: "join" },
        },
        { label: "right", instructions: [], terminator: { kind: "fallthrough", target: "join" } },
        { label: "join", instructions: [], terminator: { kind: "fallthrough", target: "exit" } },
        exit,
      ]),
    );
    expect(defect?.reason).toContain("different hardware-stack contents");
  });

  it("witnesses a return that leaves pushed bytes on the hardware stack", () => {
    const defect = defectOf(
      program([{ label: "entry", instructions: [implied("pha")], terminator: { kind: "return" } }]),
    );
    expect(defect?.reason).toContain("hardware stack");
  });

  it("witnesses an instruction whose recorded cost does not match it", () => {
    const miscosted = Object.freeze({
      ...machineInstruction(NMOS_6510, "clv", "implied", null),
      cost: { bytes: 9, minCycles: 9, maxCycles: 9 },
    });
    const defect = defectOf(
      program([{ label: "entry", instructions: [miscosted], terminator: { kind: "return" } }]),
    );
    expect(defect?.opcode).toBe("clv");
    expect(defect?.reason).toContain("cycle cost");
  });

  it("witnesses a transfer to generated code the program does not contain", () => {
    const defect = defectOf(
      program([
        {
          label: "entry",
          instructions: [
            machineInstruction(NMOS_6510, "jsr", "absolute", { kind: "label", label: "absent" }),
          ],
          terminator: { kind: "return" },
        },
      ]),
    );
    expect(defect?.opcode).toBe("jsr");
    expect(defect?.reason).toContain("does not contain");
  });
});
