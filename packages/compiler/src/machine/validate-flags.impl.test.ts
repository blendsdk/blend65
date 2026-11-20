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
import {
  branchTerminator as branch,
  exitBlock as exit,
  impliedInstruction as implied,
  machineTestProgram as program,
} from "./machine-program-test-support.js";

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

/** Exact cost of a structured absolute jump, required for a valid jump terminator. */
const jumpCost = machineCost(NMOS_6510, "jmp", "absolute");

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

  it("ignores a reachable function that never comes back", () => {
    // A function that loops forever is not one of the caller's incoming paths, so its empty
    // facts must not be intersected in. Before this was separated from "returns but guarantees
    // nothing", one such candidate cost every later consumer its producer.
    const looping: MachineFunction = {
      id: "right",
      blocks: [
        {
          label: "right.entry",
          instructions: [],
          terminator: { kind: "jump", opcode: "jmp", target: "right.entry", cost: jumpCost },
        },
      ],
    };
    expect(
      validateMachineProgram(
        program(consumeThroughDispatch(dispatch({ targets: ["left", "right"] })), [
          candidate("left", [implied("clv")]),
          looping,
        ]),
      ),
    ).toBe(true);
  });

  it("keeps the conservative answer when no reachable function comes back", () => {
    const looping = (id: string): MachineFunction => ({
      id,
      blocks: [
        {
          label: `${id}.entry`,
          instructions: [],
          terminator: { kind: "jump", opcode: "jmp", target: `${id}.entry`, cost: jumpCost },
        },
      ],
    });
    expect(
      validateMachineProgram(
        program(consumeThroughDispatch(dispatch({ targets: ["left", "right"] })), [
          looping("left"),
          looping("right"),
        ]),
      ),
    ).toBe(false);
  });

  it.each([
    ["no fact of its own", [] as readonly MachineInstruction[], [implied("clv")], true],
    ["a fact the caller established", [implied("clv")], [implied("pha"), implied("plp")], false],
  ])(
    "keeps the conservative answer for a marked block with a structured exit, consuming %s",
    (_name, leading, rightBody) => {
      // The candidates describe where control goes, not what the block does on the way, so they
      // answer for the block only while it owns no exit of its own. A marked block that fails
      // that shape must not fall back to reading its own exit either: doing so would describe a
      // transfer that never comes back as though it returned, which is more permissive than
      // trusting the candidates. The second row is the case that distinguishes the two: the
      // caller establishes the flag itself, and one reachable function discards it.
      const exiting: MachineBlock = {
        label: "dispatch",
        instructions: [indirectJump()],
        terminator: { kind: "return" },
        indirectTargets: ["left", "right"],
      };
      expect(
        validateMachineProgram(
          program(consumeThroughDispatch(exiting, leading), [
            candidate("left", [implied("nop")]),
            candidate("right", rightBody),
          ]),
        ),
      ).toBe(false);
    },
  );

  it("intersects across more than two reachable functions", () => {
    expect(
      validateMachineProgram(
        program(consumeThroughDispatch(dispatch({ targets: ["left", "middle", "right"] })), [
          candidate("left", [implied("clv")]),
          candidate("middle", [implied("clv")]),
          candidate("right", [implied("nop")]),
        ]),
      ),
    ).toBe(false);
  });

  it("stops trusting a fact a reachable function openly overwrites", () => {
    // Distinct from the opaque-restore case: here the flag has a real producer in the callee,
    // so `preserved` is cleared while `flags` stays set. That isolates the preserves
    // intersection from a callee that wipes both fields at once.
    expect(
      validateMachineProgram(
        program(
          consumeThroughDispatch(dispatch({ targets: ["left", "right"] }), [implied("clv")]),
          [
            candidate("left", [implied("nop")]),
            candidate("right", [
              machineInstruction(NMOS_6510, "lda", "immediate", { kind: "immediate", value: 0 }),
            ]),
          ],
        ),
      ),
    ).toBe(true);
  });

  it("is deliberately weaker than examining each reachable function separately", () => {
    // Every execution leaves the flag defined — the caller produced it and one function
    // re-produces it — yet intersecting `preserves` and `returns` separately loses it. This
    // records the documented conservative boundary rather than a defect.
    expect(
      validateMachineProgram(
        program(
          consumeThroughDispatch(dispatch({ targets: ["left", "right"] }), [implied("clv")]),
          [candidate("left", [implied("nop")]), candidate("right", [implied("clv")])],
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
