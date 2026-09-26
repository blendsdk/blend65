import { describe, expect, it } from "vitest";
import { NMOS_6510 } from "../target/nmos6510.js";
import { repairMachineBranches } from "./block-layout.js";
import { validateMachineProgram } from "./bind.js";
import type { MachineFunction, MachineInstruction, MachineProgram } from "./machine-types.js";
import { validateMachineInstruction } from "./validate.js";

/** A fully described immediate load is the control for independently invalid mutations. */
function load(overrides: Partial<MachineInstruction> = {}): MachineInstruction {
  return {
    opcode: "lda",
    mode: "immediate",
    operand: { kind: "immediate", value: 7 },
    uses: { registers: [], flags: [] },
    defines: { registers: ["a"], flags: ["n", "z"] },
    memory: [],
    cost: { bytes: 2, minCycles: 2, maxCycles: 2 },
    source: { sourceId: "src/game.blend", start: 10, end: 11 },
    ...overrides,
  };
}

describe("terminal machine legality", () => {
  // Entry flags are unknown until a real producer establishes them on the executed path.
  it.each([false, true])("should require an overflow producer before a branch: %s", (produce) => {
    const program: MachineProgram = {
      functions: [],
      data: [],
      requiredStorage: [],
      startup: {
        id: "entry",
        blocks: [
          {
            label: "entry",
            instructions: [
              load({
                opcode: produce ? "clv" : "nop",
                mode: "implied",
                operand: null,
                defines: { registers: [], flags: produce ? ["v"] : [] },
                cost: { bytes: 1, minCycles: 2, maxCycles: 2 },
              }),
            ],
            terminator: {
              kind: "branch",
              opcode: "bvs",
              target: "taken",
              fallthrough: "exit",
              uses: { registers: [], flags: ["v"] },
              cost: { bytes: 2, minCycles: 2, maxCycles: 4 },
            },
          },
          { label: "exit", instructions: [], terminator: { kind: "unreachable" } },
          { label: "taken", instructions: [], terminator: { kind: "unreachable" } },
        ],
      },
    };
    expect(validateMachineProgram(program)).toBe(produce);
  });

  // Validation must preserve the exact source association and selected form.
  it("should accept a fully bound official instruction without changing its evidence", () => {
    const instruction = load();
    expect(validateMachineInstruction(instruction, NMOS_6510, [])).toEqual({
      kind: "complete",
      instruction,
    });
  });

  // Encodable operands are finite integral bytes, not values silently truncated by assembly.
  it.each([-1, 256, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "should reject the non-byte immediate %s",
    (value) => {
      expect(
        validateMachineInstruction(load({ operand: { kind: "immediate", value } }), NMOS_6510, []),
      ).toMatchObject({ kind: "error" });
    },
  );

  // Every final instruction owns exact register/flag effects and encoded byte/cycle costs.
  it.each([
    ["missing accumulator definition", { defines: { registers: [], flags: ["n", "z"] } }],
    ["missing zero flag definition", { defines: { registers: ["a"], flags: ["n"] } }],
    ["invented carry dependency", { uses: { registers: [], flags: ["c"] } }],
    ["incorrect byte count", { cost: { bytes: 3, minCycles: 2, maxCycles: 2 } }],
    ["incorrect minimum cycles", { cost: { bytes: 2, minCycles: 1, maxCycles: 2 } }],
    ["incorrect maximum cycles", { cost: { bytes: 2, minCycles: 2, maxCycles: 3 } }],
  ] satisfies readonly (readonly [string, Partial<MachineInstruction>])[])(
    "should reject %s",
    (_name, overrides) => {
      expect(validateMachineInstruction(load(overrides), NMOS_6510, ["c"])).toMatchObject({
        kind: "error",
      });
    },
  );

  // A terminal instruction cannot defer its operand's storage home until after closure.
  it("should reject an unbound storage operand even when its physical mode is legal", () => {
    expect(
      validateMachineInstruction(
        load({
          mode: "absolute",
          operand: { kind: "storage", requestId: "missing-home" },
          cost: { bytes: 3, minCycles: 4, maxCycles: 4 },
        }),
        NMOS_6510,
        [],
      ),
    ).toMatchObject({ kind: "error" });
  });

  // The high byte of an ordinary indirect pointer must never wrap into the CPU port.
  it.each([0xfe, 0xff])("should enforce the final zero-page pointer boundary at %s", (value) => {
    const instruction = load({
      mode: "indirect-indexed-y",
      operand: { kind: "absolute", value },
      uses: { registers: ["y"], flags: [] },
      cost: { bytes: 2, minCycles: 5, maxCycles: 6 },
    });
    expect(validateMachineInstruction(instruction, NMOS_6510, []).kind).toBe(
      value === 0xfe ? "complete" : "error",
    );
  });

  // Backward branches use the post-operand PC, so -128 fits and -129 needs a long branch.
  it.each([
    [126, "branch", 128],
    [127, "long-branch", 132],
  ] as const)("should repair the backward boundary with %s padding bytes", (count, kind, bytes) => {
    const fn: MachineFunction = {
      id: "backward",
      blocks: [
        {
          label: "head",
          instructions: Array.from({ length: count }, () =>
            load({
              opcode: "nop",
              mode: "implied",
              operand: null,
              defines: { registers: [], flags: [] },
              cost: { bytes: 1, minCycles: 2, maxCycles: 2 },
            }),
          ),
          terminator: {
            kind: "branch",
            opcode: "bne",
            target: "head",
            fallthrough: "exit",
            uses: { registers: [], flags: ["z"] },
            cost: { bytes: 2, minCycles: 2, maxCycles: 4 },
          },
        },
        { label: "exit", instructions: [], terminator: { kind: "unreachable" } },
      ],
    };
    const result = repairMachineBranches(fn, 0x2000);
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected complete branch layout");
    expect(result.function.blocks[0]?.terminator.kind).toBe(kind);
    expect(result.byteLength).toBe(bytes);
    if (kind === "long-branch") {
      expect(result.function.blocks[0]?.terminator).toMatchObject({
        opcode: "beq",
        jump: { opcode: "jmp", target: "head" },
      });
    }
  });
});
