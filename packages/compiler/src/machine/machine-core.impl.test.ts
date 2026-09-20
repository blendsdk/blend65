import { describe, expect, it } from "vitest";
import type { StorageClosureCertificate, StorageRequest } from "../storage/storage-types.js";
import { bindMachineProgram } from "./bind.js";
import { repairMachineBranches } from "./block-layout.js";
import type { MachineInstruction, MachineProgram } from "./machine-types.js";
import { selectedProfile, state, nop } from "./lowering-test-support.js";
import { validateMachineInstruction } from "./validate.js";

describe("NMOS legality and resource binding", () => {
  it("should accept only an exact documented opcode form and cost", () => {
    const instruction: MachineInstruction = Object.freeze({
      opcode: "lda",
      mode: "absolute-x",
      operand: Object.freeze({ kind: "absolute", value: 0x2000 }),
      uses: state(["x"]),
      defines: state(["a"], ["n", "z"]),
      memory: Object.freeze([]),
      cost: Object.freeze({ bytes: 3, minCycles: 4, maxCycles: 5 }),
      source: null,
    });

    expect(validateMachineInstruction(instruction, selectedProfile().cpu, [])).toEqual({
      kind: "complete",
      instruction,
    });
    expect(
      validateMachineInstruction(
        Object.freeze({
          ...instruction,
          cost: Object.freeze({ bytes: 3, minCycles: 4, maxCycles: 4 }),
        }),
        selectedProfile().cpu,
        [],
      ),
    ).toEqual({ kind: "error", reason: "cost" });
  });

  it("should bind a certified zero-page home and recompute its exact cost", () => {
    const source = Object.freeze({ sourceId: "src/test.blend", start: 0, end: 1 });
    const owner = Object.freeze({ sourceId: source.sourceId, span: source });
    const request: StorageRequest = Object.freeze({
      id: "spill",
      storageClass: "spill",
      owner,
      binding: null,
      value: "value",
      type: null,
      bytes: 1,
      alignment: 1,
      region: "zero-page-required",
      lifetime: Object.freeze({
        function: owner,
        value: "value",
        definition: Object.freeze({ block: "entry", operation: 0 }),
        liveAt: Object.freeze([]),
        callsCrossed: Object.freeze([]),
      }),
      source,
      reason: "Test spill",
    });
    const program: MachineProgram = Object.freeze({
      functions: Object.freeze([
        Object.freeze({
          id: "main",
          blocks: Object.freeze([
            Object.freeze({
              label: "main.entry",
              instructions: Object.freeze([
                Object.freeze({
                  opcode: "lda",
                  mode: "storage",
                  operand: Object.freeze({ kind: "storage", requestId: request.id }),
                  uses: state(),
                  defines: state(["a"], ["n", "z"]),
                  memory: Object.freeze([]),
                  cost: Object.freeze({ bytes: 3, minCycles: 4, maxCycles: 4 }),
                  source: null,
                }),
              ]),
              terminator: Object.freeze({ kind: "return" }),
            }),
          ]),
        }),
      ]),
      data: Object.freeze([]),
      startup: Object.freeze({ id: "startup", blocks: Object.freeze([]) }),
      requiredStorage: Object.freeze([request]),
    });
    const certificate = Object.freeze({
      inventoryHash: "inventory",
      graphHash: "graph",
      profileId: "c64-pal-prg-kernal-6581",
      homes: Object.freeze([
        Object.freeze({
          requestId: request.id,
          address: 0x20,
          bytes: 1,
          region: "zero-page" as const,
        }),
      ]),
      interference: Object.freeze([]),
      helperCalls: Object.freeze([]),
      staticBytes: Object.freeze({ ram: 0, zeroPage: 1 }),
      peakBytes: Object.freeze({ ram: 0, zeroPage: 1 }),
      hardwareStackPeak: 0,
      closed: true,
    }) satisfies StorageClosureCertificate;

    const result = bindMachineProgram(program, certificate);
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected certified binding");
    expect(result.program.functions[0]!.blocks[0]!.instructions[0]).toEqual(
      expect.objectContaining({
        mode: "zero-page",
        operand: { kind: "absolute", value: 0x20 },
        cost: { bytes: 2, minCycles: 3, maxCycles: 3 },
      }),
    );
  });
});

describe("branch repair", () => {
  it("should be deterministic and never expand an already repaired branch again", () => {
    const fn = Object.freeze({
      id: "long",
      blocks: Object.freeze([
        Object.freeze({
          label: "entry",
          instructions: Object.freeze([]),
          terminator: Object.freeze({
            kind: "branch" as const,
            opcode: "beq",
            target: "target",
            fallthrough: "padding",
            uses: state([], ["z"]),
            cost: Object.freeze({ bytes: 2, minCycles: 2, maxCycles: 4 }),
          }),
        }),
        Object.freeze({
          label: "padding",
          instructions: Object.freeze(Array.from({ length: 130 }, nop)),
          terminator: Object.freeze({ kind: "fallthrough" as const, target: "target" }),
        }),
        Object.freeze({
          label: "target",
          instructions: Object.freeze([]),
          terminator: Object.freeze({ kind: "return" as const }),
        }),
      ]),
    });

    const first = repairMachineBranches(fn, 0x2000);
    expect(first.kind).toBe("complete");
    if (first.kind !== "complete") throw new Error("Expected repair");
    const second = repairMachineBranches(first.function, 0x2000);
    expect(second).toEqual(first);
  });
});
