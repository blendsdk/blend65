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

/** A candidate function that returns after running the instructions it is given. */
function candidate(id: string, instructions: readonly MachineInstruction[]): MachineFunction {
  return { id, blocks: [{ label: `${id}.entry`, instructions, terminator: { kind: "return" } }] };
}

/** The indirect transfer a dispatch block is built around. */
function indirectJump(): MachineInstruction {
  return machineInstruction(NMOS_6510, "jmp", "indirect", { kind: "absolute", value: 0x0300 });
}

/**
 * A block that leaves through an indirect transfer, optionally naming the functions it can
 * reach and optionally carrying work of its own before the transfer.
 */
function dispatch(
  options: {
    readonly targets?: readonly string[];
    readonly leading?: readonly MachineInstruction[];
  } = {},
): MachineBlock {
  return {
    label: "dispatch",
    instructions: [...(options.leading ?? []), indirectJump()],
    terminator: { kind: "unreachable" },
    ...(options.targets === undefined ? {} : { indirectTargets: options.targets }),
  };
}

/** Call the dispatch block, then consume the overflow flag with no local producer. */
function consumeThroughDispatch(block: MachineBlock, leading: readonly MachineInstruction[] = []) {
  return [
    {
      label: "entry",
      instructions: [
        ...leading,
        machineInstruction(NMOS_6510, "jsr", "absolute", { kind: "label", label: "dispatch" }),
      ],
      terminator: branch("exit", "exit"),
    },
    block,
    exit,
  ];
}

describe("machine flag data flow through a pointer dispatch", () => {
  it("relies on a fact every reachable function establishes", () => {
    // The caller consumes the overflow flag without producing it, so the program is legal only
    // because both functions the pointer can name leave that flag established. Discarding the
    // candidate facts, or substituting a fixed assumption for them, refuses this program.
    expect(
      validateMachineProgram(
        program(consumeThroughDispatch(dispatch({ targets: ["left", "right"] })), [
          candidate("left", [implied("clv")]),
          candidate("right", [implied("clv")]),
        ]),
      ),
    ).toBe(true);
  });

  it.each([true, false])(
    "requires every reachable function to establish the consumed fact: both produce it %s",
    (both) => {
      expect(
        validateMachineProgram(
          program(consumeThroughDispatch(dispatch({ targets: ["left", "right"] })), [
            candidate("left", [implied("clv")]),
            candidate("right", both ? [implied("clv")] : [implied("nop")]),
          ]),
        ),
      ).toBe(both);
    },
  );

  it("stops trusting a fact the caller established when a reachable function discards it", () => {
    // The caller establishes the flag before the call. One reachable function restores an opaque
    // status byte, so nothing can be said about the flag afterwards.
    expect(
      validateMachineProgram(
        program(
          consumeThroughDispatch(dispatch({ targets: ["left", "right"] }), [implied("clv")]),
          [
            candidate("left", [implied("nop")]),
            candidate("right", [implied("pha"), implied("plp")]),
          ],
        ),
      ),
    ).toBe(false);
  });

  it("keeps the conservative answer for an indirect transfer whose targets are unknown", () => {
    // Keyed on the recorded candidates, never on the absence of a returning path: an indirect
    // transfer that names nothing is still untrusted, exactly as before.
    expect(
      validateMachineProgram(
        program(consumeThroughDispatch(dispatch()), [
          candidate("left", [implied("clv")]),
          candidate("right", [implied("clv")]),
        ]),
      ),
    ).toBe(false);
  });

  it("keeps the conservative answer when the recorded set is empty", () => {
    expect(
      validateMachineProgram(
        program(consumeThroughDispatch(dispatch({ targets: [] })), [
          candidate("left", [implied("clv")]),
        ]),
      ),
    ).toBe(false);
  });

  it("keeps the conservative answer when the dispatch block carries work of its own", () => {
    // Composing the candidates' facts onto the block is only equal to calling a candidate while
    // the block is nothing but the transfer. Extra work means its own effects would matter.
    expect(
      validateMachineProgram(
        program(
          consumeThroughDispatch(
            dispatch({ targets: ["left", "right"], leading: [implied("sec")] }),
          ),
          [candidate("left", [implied("clv")]), candidate("right", [implied("clv")])],
        ),
      ),
    ).toBe(false);
  });

  it.each([false, true])(
    "terminates on a pointer that can reach its own caller, consumer: %s",
    (consume) => {
      // A function whose pointer may hold its own address must not send the proof into a cycle.
      // The candidate under analysis contributes nothing, which costs a later consumer its
      // producer without claiming the candidate itself is malformed.
      const blocks: MachineBlock[] = [
        {
          label: "entry",
          instructions: [
            machineInstruction(NMOS_6510, "jsr", "absolute", { kind: "label", label: "dispatch" }),
          ],
          terminator: consume ? branch("exit", "exit") : { kind: "fallthrough", target: "exit" },
        },
        dispatch({ targets: ["startup"] }),
        exit,
      ];
      expect(validateMachineProgram(program(blocks))).toBe(!consume);
    },
  );
});
