import { describe, expect, it } from "vitest";
import type { SemanticType } from "../frontend/semantic-types.js";
import type { SemanticOperation } from "../semantic/operations.js";
import type { ValueLifetime } from "../semantic/whole-program.js";
import { allocateStorage } from "../storage/allocate.js";
import { closeStorage } from "../storage/closure.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { bindMachineProgram } from "./bind.js";
import { repairMachineBranches } from "./block-layout.js";
import { machineInstruction, machineState } from "./lower-control.js";
import { lowerMachineProgram } from "./lower.js";
import {
  BYTE,
  VOID,
  WORD,
  loadOperation,
  lowerFunctions,
  semanticBlock,
  semanticFunction,
  selectedProfile,
  sourceBinding,
  sourceParameter,
  sourceSpan,
  state,
  wholeProgramFor,
} from "./lowering-test-support.js";
import type { MachineFunction } from "./machine-types.js";
import { validateMachineInstruction } from "./validate.js";

const SBYTE: SemanticType = Object.freeze({ kind: "scalar", name: "sbyte" });

describe("machine contract corrections", () => {
  it("orders declared fallthroughs physically and inverts a branch when its fallthrough is placed", () => {
    const cost = Object.freeze({ bytes: 2, minCycles: 2, maxCycles: 4 });
    const fn: MachineFunction = Object.freeze({
      id: "ordered",
      blocks: Object.freeze([
        Object.freeze({
          label: "entry",
          instructions: Object.freeze([]),
          terminator: Object.freeze({ kind: "fallthrough" as const, target: "false" }),
        }),
        Object.freeze({
          label: "false",
          instructions: Object.freeze([]),
          terminator: Object.freeze({
            kind: "jump" as const,
            opcode: "jmp" as const,
            target: "test",
            cost: Object.freeze({ bytes: 3, minCycles: 3, maxCycles: 3 }),
          }),
        }),
        Object.freeze({
          label: "test",
          instructions: Object.freeze([]),
          terminator: Object.freeze({
            kind: "branch" as const,
            opcode: "beq",
            target: "true",
            fallthrough: "false",
            uses: machineState([], ["z"]),
            cost,
          }),
        }),
        Object.freeze({
          label: "true",
          instructions: Object.freeze([]),
          terminator: Object.freeze({ kind: "return" as const }),
        }),
      ]),
    });

    const result = repairMachineBranches(fn, 0x2000);
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected ordered function");
    const testIndex = result.function.blocks.findIndex(({ label }) => label === "test");
    const test = result.function.blocks[testIndex]!;
    expect(test.terminator).toEqual(
      expect.objectContaining({ opcode: "bne", fallthrough: "true", target: "false" }),
    );
    expect(result.function.blocks[testIndex + 1]?.label).toBe("true");
  });

  it("marshals arguments to callee homes and uses A-low/X-high for scalar word returns", () => {
    const argument = sourceParameter(100, WORD);
    const parameter = sourceParameter(200, WORD);
    const callee = semanticFunction(190, "callee", [parameter], WORD, [
      semanticBlock(
        "callee.entry",
        [loadOperation("value", parameter, 201)],
        Object.freeze({ kind: "return" as const, value: "value" }),
      ),
    ]);
    const main = semanticFunction(90, "main", [argument], WORD, [
      semanticBlock(
        "main.entry",
        [
          loadOperation("argument", argument, 101),
          Object.freeze({
            kind: "call" as const,
            result: "called",
            callee: callee.id,
            arguments: Object.freeze(["argument"]),
            type: WORD,
            span: sourceSpan(102),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: "called" }),
      ),
    ]);
    const result = lowerFunctions([main, callee]);
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected call lowering");
    const caller = result.program.functions[0]!;
    const calleeMachine = result.program.functions[1]!;
    const instructions = caller.blocks[0]!.instructions;
    const jsr = instructions.findIndex(({ opcode }) => opcode === "jsr");
    expect(jsr).toBeGreaterThanOrEqual(4);
    expect(instructions[jsr]!.operand).toEqual({ kind: "label", label: calleeMachine.id });
    expect(instructions.slice(jsr - 4, jsr).map(({ opcode }) => opcode)).toEqual([
      "lda",
      "sta",
      "lda",
      "sta",
    ]);
    expect(calleeMachine.blocks[0]!.instructions.slice(-3).map(({ opcode }) => opcode)).toEqual([
      "lda",
      "tax",
      "lda",
    ]);
    const inventory = inventoryStorage(wholeProgramFor([main, callee]));
    const closure = closeStorage(inventory, selectedProfile().storage, result.binder);
    expect(closure.kind).toBe("complete");
    if (closure.kind !== "complete") throw new Error("Expected call-aware storage closure");
    expect(bindMachineProgram(result.program, closure.certificate).kind).toBe("complete");
  });

  it("retains a live accumulator value in SFA storage across an intervening MMIO store", () => {
    const address = sourceParameter(300, WORD);
    const color = sourceParameter(310, BYTE);
    const main = semanticFunction(290, "retained", [address, color], BYTE, [
      semanticBlock(
        "retained.entry",
        [
          loadOperation("address", address, 301),
          Object.freeze({
            kind: "memory-read" as const,
            result: "read",
            type: BYTE,
            integer: Object.freeze({ width: 8 as const, signed: false, wrap: true }),
            address: "address",
            width: 1 as const,
            byteOrder: "low-first" as const,
            volatile: true as const,
            span: sourceSpan(302),
          }),
          loadOperation("color", color, 303),
          Object.freeze({
            kind: "platform" as const,
            result: null,
            capability: "c64.vic.setBorderColor",
            arguments: Object.freeze(["color"]),
            type: VOID,
            effect: "volatile-write" as const,
            span: sourceSpan(304),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: "read" }),
      ),
    ]);
    const lifetime: ValueLifetime = Object.freeze({
      function: main.id,
      value: "read",
      definition: Object.freeze({ block: "retained.entry", operation: 1 }),
      liveAt: Object.freeze([Object.freeze({ block: "retained.entry", operation: 4 })]),
      callsCrossed: Object.freeze([]),
    });
    const result = lowerFunctions([main], [lifetime]);
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected retained value lowering");
    const retained = result.program.requiredStorage.find(({ id }) =>
      id.includes("retained-value:read"),
    );
    expect(retained).toBeDefined();
    const instructions = result.program.functions[0]!.blocks[0]!.instructions;
    expect(instructions.at(-1)?.operand).toEqual(
      expect.objectContaining({ kind: "storage", requestId: retained!.id }),
    );
  });

  it("keeps one indirect pointer base and returns a word in A-low/X-high", () => {
    const address = sourceParameter(400, WORD);
    const main = semanticFunction(390, "peek-word", [address], WORD, [
      semanticBlock(
        "peek.entry",
        [
          loadOperation("address", address, 401),
          Object.freeze({
            kind: "memory-read" as const,
            result: "read",
            type: WORD,
            integer: Object.freeze({ width: 16 as const, signed: false, wrap: true }),
            address: "address",
            width: 2 as const,
            byteOrder: "low-first" as const,
            volatile: true as const,
            span: sourceSpan(402),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: "read" }),
      ),
    ]);
    const result = lowerFunctions([main]);
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected word read lowering");
    const instructions = result.program.functions[0]!.blocks[0]!.instructions;
    const indirect = instructions.filter(({ mode }) => mode === "indirect-indexed-y");
    expect(indirect.map(({ operand }) => operand)).toEqual([
      expect.objectContaining({ kind: "indirect-y", offset: 0 }),
      expect.objectContaining({ kind: "indirect-y", offset: 0 }),
    ]);
    expect(instructions.slice(-2).map(({ opcode }) => opcode)).toEqual(["tax", "lda"]);
    expect(instructions.some(({ opcode }) => opcode === "pha" || opcode === "pla")).toBe(false);
    const inventory = inventoryStorage(wholeProgramFor([main]));
    const profile = selectedProfile();
    const stackBoundary = Object.freeze({
      ...profile.storage,
      hardwareStackCapacity:
        profile.storage.hardwareStackReserve! +
        profile.storage.interruptStackBytes! +
        profile.storage.startupStackBytes!,
    });
    const closure = closeStorage(inventory, stackBoundary, result.binder);
    if (closure.kind !== "complete") throw new Error("Expected word-read closure");
    expect(closure.certificate.hardwareStackPeak).toBe(16);
    const bound = bindMachineProgram(result.program, closure.certificate);
    if (bound.kind !== "complete") throw new Error("Expected word-read binding");
    const effects = bound.program.functions[0]!.blocks[0]!.instructions.flatMap(
      ({ memory }) => memory,
    );
    expect(effects.map(({ address: effectAddress }) => effectAddress)).toEqual([
      expect.objectContaining({ kind: "indirect-y-bound", displacement: 0 }),
      expect.objectContaining({ kind: "indirect-y-bound", displacement: 1 }),
    ]);
    expect(
      new Set(
        effects.map(({ address: effectAddress }) =>
          effectAddress.kind === "indirect-y-bound" ? effectAddress.pointer : -1,
        ),
      ).size,
    ).toBe(1);
  });

  it("marks machine-created scratch as crossing every direct call in its function", () => {
    const address = sourceParameter(500, WORD);
    const callee = semanticFunction(550, "callee", [], VOID, [
      semanticBlock("callee.entry", [], Object.freeze({ kind: "return" as const, value: null })),
    ]);
    const callSpan = sourceSpan(502);
    const main = semanticFunction(490, "scratch-calls", [address], BYTE, [
      semanticBlock(
        "scratch.entry",
        [
          loadOperation("address", address, 501),
          Object.freeze({
            kind: "call" as const,
            result: null,
            callee: callee.id,
            arguments: Object.freeze([]),
            type: VOID,
            span: callSpan,
          }),
          Object.freeze({
            kind: "memory-read" as const,
            result: "read",
            type: BYTE,
            integer: Object.freeze({ width: 8 as const, signed: false, wrap: true }),
            address: "address",
            width: 1 as const,
            byteOrder: "low-first" as const,
            volatile: true as const,
            span: sourceSpan(503),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: "read" }),
      ),
    ]);
    const result = lowerFunctions([main, callee]);
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected scratch lowering");
    const pointer = result.program.requiredStorage.find(
      ({ storageClass }) => storageClass === "pointer",
    );
    expect(pointer?.lifetime.callsCrossed).toEqual([callSpan]);
  });

  it("sign-extends every boundary sbyte index before packed address scaling", () => {
    const index = sourceParameter(600, SBYTE);
    const root = sourceBinding(610);
    const array: SemanticType = Object.freeze({ kind: "array", element: BYTE, length: 4, size: 4 });
    const operation: SemanticOperation = Object.freeze({
      kind: "load",
      result: "selected",
      type: BYTE,
      integer: null,
      place: Object.freeze({
        root,
        rootType: array,
        path: Object.freeze([Object.freeze({ kind: "index" as const, value: "index" })]),
      }),
      span: sourceSpan(612),
    });
    const main = semanticFunction(590, "signed-index", [index], BYTE, [
      semanticBlock(
        "signed.entry",
        [loadOperation("index", index, 601), operation],
        Object.freeze({ kind: "return" as const, value: "selected" }),
      ),
    ]);
    const result = lowerFunctions([main]);
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected signed index lowering");
    expect(
      result.program.functions[0]!.blocks[0]!.instructions.map(({ opcode }) => opcode).join(" "),
    ).toContain("cmp lda sbc eor sta");
    const extend = (raw: number) => (((0 - 0 - (raw >= 0x80 ? 0 : 1)) & 0xff) ^ 0xff) & 0xff;
    expect([-128, -1, 0, 1, 127].map((value) => extend(value & 0xff))).toEqual([
      0xff, 0xff, 0, 0, 0,
    ]);
  });

  it("tracks form-sensitive index, accumulator and decimal-state facts and rejects bad ranges", () => {
    const cpu = selectedProfile().cpu;
    const indexed = machineInstruction(
      cpu,
      "lda",
      "absolute-x",
      Object.freeze({ kind: "absolute", value: 0x2000 }),
    );
    const shifted = machineInstruction(
      cpu,
      "asl",
      "zero-page-x",
      Object.freeze({ kind: "absolute", value: 0x20 }),
    );
    const added = machineInstruction(
      cpu,
      "adc",
      "immediate",
      Object.freeze({ kind: "immediate", value: 1 }),
    );
    expect(indexed.uses.registers).toEqual(["x"]);
    expect(shifted.uses.registers).toEqual(["x"]);
    expect(shifted.defines.registers).toEqual([]);
    expect(added.uses.flags).toEqual(["d", "c"]);
    expect(
      validateMachineInstruction(
        Object.freeze({
          ...added,
          operand: Object.freeze({ kind: "immediate" as const, value: 256 }),
        }),
        cpu,
        ["d", "c"],
      ),
    ).toEqual({ kind: "error", reason: "operand" });
  });

  it("rejects a certificate whose inventory identity or home width differs", () => {
    const parameter = sourceParameter(700, BYTE);
    const main = semanticFunction(690, "binding", [parameter], BYTE, [
      semanticBlock(
        "binding.entry",
        [loadOperation("value", parameter, 701)],
        Object.freeze({ kind: "return" as const, value: "value" }),
      ),
    ]);
    const whole = wholeProgramFor([main]);
    const profile = selectedProfile();
    const inventory = inventoryStorage(whole);
    const allocation = allocateStorage(inventory, buildInterference(inventory), profile.storage);
    if (allocation.kind !== "complete") throw new Error("Expected provisional allocation");
    const lowered = lowerMachineProgram({
      program: whole,
      placement: allocation.placement,
      profile,
    });
    if (lowered.kind !== "complete") throw new Error("Expected lowering");
    const closure = closeStorage(inventory, profile.storage, lowered.binder);
    if (closure.kind !== "complete") throw new Error("Expected closure");
    expect(
      bindMachineProgram(
        lowered.program,
        Object.freeze({ ...closure.certificate, inventoryHash: "wrong" }),
      ),
    ).toEqual({ kind: "error", reason: "invalid-storage", requestId: null });
    const firstHome = closure.certificate.homes[0]!;
    const badHomes = [
      Object.freeze({ ...firstHome, bytes: firstHome.bytes + 1 }),
      Object.freeze({ ...firstHome, address: 0xbfff }),
    ];
    for (const badHome of badHomes) {
      expect(
        bindMachineProgram(
          lowered.program,
          Object.freeze({
            ...closure.certificate,
            homes: Object.freeze([badHome, ...closure.certificate.homes.slice(1)]),
          }),
        ),
      ).toEqual(
        expect.objectContaining({
          kind: "error",
          reason: "invalid-storage",
          requestId: inventory.requests[0]!.id,
        }),
      );
    }
    expect(
      bindMachineProgram(
        Object.freeze({ ...lowered.program, storageProfileId: "different-profile" }),
        closure.certificate,
      ),
    ).toEqual({ kind: "error", reason: "invalid-storage", requestId: null });
    const firstRequest = lowered.program.certifiedStorage![0]!;
    for (const replacement of [
      Object.freeze({ ...firstRequest, alignment: 5 }),
      Object.freeze({ ...firstRequest, region: "zero-page-required" as const }),
    ]) {
      expect(
        bindMachineProgram(
          Object.freeze({
            ...lowered.program,
            certifiedStorage: Object.freeze([
              replacement,
              ...lowered.program.certifiedStorage!.slice(1),
            ]),
          }),
          closure.certificate,
        ),
      ).toEqual(
        expect.objectContaining({
          kind: "error",
          reason: "invalid-storage",
          requestId: firstRequest.id,
        }),
      );
    }

    const invalidFunction = Object.freeze({
      ...lowered.program.functions[0]!,
      blocks: Object.freeze([
        Object.freeze({
          ...lowered.program.functions[0]!.blocks[0]!,
          terminator: Object.freeze({
            kind: "jump" as const,
            opcode: "jmp" as const,
            target: "missing",
            cost: Object.freeze({ bytes: 3, minCycles: 3, maxCycles: 3 }),
          }),
        }),
      ]),
    });
    expect(
      bindMachineProgram(
        Object.freeze({
          ...lowered.program,
          functions: Object.freeze([invalidFunction]),
        }),
        closure.certificate,
      ),
    ).toEqual({ kind: "error", reason: "invalid-storage", requestId: null });
  });
});
