import { describe, expect, it } from "vitest";
import { NMOS_6510 } from "../target/nmos6510.js";
import { machineCost, machineInstruction, machineState } from "./lower-control.js";
import type {
  MachineBlock,
  MachineFunction,
  MachineInstruction,
  MachineProgram,
} from "./machine-types.js";
import { validateMachineProgram } from "./bind.js";

/** A tiny closed program isolates validator facts from source lowering. */
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

describe("machine flag data flow", () => {
  it.each([false, true])(
    "accepts an opaque status restore only without a later flag consumer: %s",
    (consume) => {
      expect(
        validateMachineProgram(
          program([
            {
              label: "entry",
              instructions: [implied("clv"), implied("pha"), implied("plp")],
              terminator: consume
                ? branch("exit", "exit")
                : { kind: "fallthrough", target: "exit" },
            },
            exit,
          ]),
        ),
      ).toBe(!consume);
    },
  );

  it.each([false, true])(
    "retains incoming flag identity through a callee status save: %s",
    (known) => {
      const helper: MachineFunction = {
        id: "helper",
        blocks: [
          {
            label: "helper.entry",
            instructions: [implied("php"), implied("clv"), implied("plp")],
            terminator: { kind: "return" },
          },
        ],
      };
      expect(
        validateMachineProgram(
          program(
            [
              {
                label: "entry",
                instructions: [
                  ...(known ? [implied("clv")] : []),
                  machineInstruction(NMOS_6510, "jsr", "absolute", {
                    kind: "label",
                    label: "helper",
                  }),
                ],
                terminator: branch("exit", "exit"),
              },
              exit,
            ],
            [helper],
          ),
        ),
      ).toBe(known);
    },
  );

  it("rejects a callee that leaks a status snapshot into its return address", () => {
    const helper: MachineFunction = {
      id: "helper",
      blocks: [
        { label: "helper.entry", instructions: [implied("php")], terminator: { kind: "return" } },
      ],
    };
    expect(
      validateMachineProgram(
        program(
          [
            {
              label: "entry",
              instructions: [
                machineInstruction(NMOS_6510, "jsr", "absolute", {
                  kind: "label",
                  label: "helper",
                }),
              ],
              terminator: { kind: "return" },
            },
          ],
          [helper],
        ),
      ),
    ).toBe(false);
  });

  it.each([false, true])("requires a producer through every side of a join: %s", (both) => {
    const blocks: MachineBlock[] = [
      {
        label: "entry",
        instructions: [
          machineInstruction(NMOS_6510, "lda", "immediate", { kind: "immediate", value: 0 }),
        ],
        terminator: branch("left", "right", "z"),
      },
      {
        label: "left",
        instructions: [implied("clv")],
        terminator: { kind: "fallthrough", target: "join" },
      },
      {
        label: "right",
        instructions: both ? [implied("clv")] : [],
        terminator: { kind: "fallthrough", target: "join" },
      },
      { label: "join", instructions: [], terminator: branch("exit", "exit") },
      exit,
    ];
    expect(validateMachineProgram(program(blocks))).toBe(both);
  });

  it.each([false, true])("does not invent a producer from a loop back-edge: %s", (initialize) => {
    expect(
      validateMachineProgram(
        program([
          {
            label: "entry",
            instructions: initialize ? [implied("clv")] : [],
            terminator: { kind: "fallthrough", target: "loop" },
          },
          { label: "loop", instructions: [], terminator: branch("body", "exit") },
          {
            label: "body",
            instructions: [implied("clv")],
            terminator: { kind: "fallthrough", target: "loop" },
          },
          exit,
        ]),
      ),
    ).toBe(initialize);
  });

  it.each(["producer", "preserved", "unknown"] as const)(
    "uses the actual callee flag summary: %s",
    (mode) => {
      const helper: MachineFunction = {
        id: "helper",
        blocks: [
          {
            label: "helper.entry",
            instructions: [implied(mode === "producer" ? "clv" : "nop")],
            terminator: { kind: "return" },
          },
        ],
      };
      const instructions = [
        ...(mode === "preserved" ? [implied("clv")] : []),
        machineInstruction(NMOS_6510, "jsr", "absolute", { kind: "label", label: "helper" }),
      ];
      expect(
        validateMachineProgram(
          program(
            [{ label: "entry", instructions, terminator: branch("exit", "exit") }, exit],
            [helper],
          ),
        ),
      ).toBe(mode !== "unknown");
    },
  );

  it("does not trust flags after an unmodelled external call", () => {
    expect(
      validateMachineProgram(
        program([
          {
            label: "entry",
            instructions: [
              implied("clv"),
              machineInstruction(NMOS_6510, "jsr", "absolute", { kind: "absolute", value: 0xffd2 }),
            ],
            terminator: branch("exit", "exit"),
          },
          exit,
        ]),
      ),
    ).toBe(false);
  });

  it("rejects a recursive call proof instead of recursing forever", () => {
    expect(
      validateMachineProgram(
        program([
          {
            label: "entry",
            instructions: [
              machineInstruction(NMOS_6510, "jsr", "absolute", { kind: "label", label: "startup" }),
            ],
            terminator: { kind: "return" },
          },
        ]),
      ),
    ).toBe(false);
  });

  it("permits an opaque entry-status snapshot without authorizing a branch on it", () => {
    expect(
      validateMachineProgram(
        program([
          { label: "entry", instructions: [implied("php")], terminator: branch("exit", "exit") },
          exit,
        ]),
      ),
    ).toBe(false);
  });
});
