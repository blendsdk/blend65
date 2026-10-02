import { describe, expect, it } from "vitest";
import type { PlatformOperation, SemanticOperation } from "../semantic/operations.js";
import type { ValueLifetime } from "../semantic/whole-program.js";
import { lowerC64Operation, type C64LoweringSupport } from "./lower-c64.js";
import type { LoweredValue } from "./lower-control.js";
import { selectRegisterForwarding } from "./lower-register-forwarding.js";
import {
  BOOLEAN,
  BYTE,
  VOID,
  WORD,
  lowerFunctions,
  semanticBlock,
  semanticFunction,
  selectedProfile,
  sourceSpan,
} from "./lowering-test-support.js";

const ports = [
  { capability: "c64.input.readJoystick1", other: "c64.input.readJoystick2", address: 0xdc01 },
  { capability: "c64.input.readJoystick2", other: "c64.input.readJoystick1", address: 0xdc00 },
] as const;
const predicates = [
  { capability: "c64.input.joystickUp", mask: 0x01 },
  { capability: "c64.input.joystickDown", mask: 0x02 },
  { capability: "c64.input.joystickLeft", mask: 0x04 },
  { capability: "c64.input.joystickRight", mask: 0x08 },
  { capability: "c64.input.joystickFire", mask: 0x10 },
] as const;
const span = sourceSpan(100);

/** Direct pin observations and saved-byte tests need no helper or execution scratch. */
const noScratch: C64LoweringSupport = {
  requestScratch: () => {
    throw new Error("Joystick selection must not request scratch storage");
  },
};

/** Construct an admitted volatile byte read, including an intentionally unused result. */
function sample(capability: string, result: string | null = "sample"): PlatformOperation {
  return {
    kind: "platform",
    capability,
    result,
    arguments: [],
    type: BYTE,
    effect: "volatile-read",
    span,
  };
}

/** A constant destination does not disturb the accumulator before its byte store. */
const destination: SemanticOperation = {
  kind: "constant",
  result: "destination",
  value: 0x0400n,
  type: WORD,
  integer: null,
  span,
};
const write: Extract<SemanticOperation, { kind: "memory-write" }> = {
  kind: "memory-write",
  address: "destination",
  value: "sample",
  width: 1,
  byteOrder: "low-first",
  volatile: true,
  span,
};

/** Ask the real selector about sole use without bypassing its block/adjacency proof. */
function forwards(items: readonly SemanticOperation[], singleUse = true): boolean {
  return selectRegisterForwarding(
    [semanticBlock("entry", items, { kind: "return", value: null })],
    new Set(singleUse ? ["sample"] : []),
  ).forwardedRegisterValues.has("sample");
}

/** Exercise storage closure when the original byte must survive another hardware read. */
function lowerSample(capability: string, interveningCapability?: string) {
  const items: SemanticOperation[] = [sample(capability), destination];
  if (interveningCapability !== undefined) items.push(sample(interveningCapability, null));
  items.push(write);
  const fn = semanticFunction(90, "sample-joystick", [], VOID, [
    semanticBlock("entry", items, { kind: "return", value: null }),
  ]);
  const lifetime: ValueLifetime = {
    function: fn.id,
    value: "sample",
    definition: { block: "entry", operation: 0 },
    liveAt: items.slice(1).map((_, index) => ({ block: "entry", operation: index + 1 })),
    callsCrossed: [],
  };
  const result = lowerFunctions([fn], [lifetime]);
  expect(result.kind).toBe("complete");
  if (result.kind !== "complete") throw new Error("Expected finite joystick result lowering");
  return result.program;
}

describe.each(ports)(
  "joystick read selection for $capability",
  ({ capability, other, address }) => {
    it("emits exactly one volatile absolute load, preserving the full byte and exact CPU effects", () => {
      const lowered = lowerC64Operation(
        sample(capability),
        new Map(),
        selectedProfile(),
        noScratch,
      );
      expect(lowered.instructions).toHaveLength(1);
      expect(lowered.instructions[0]).toMatchObject({
        opcode: "lda",
        mode: "absolute",
        operand: { kind: "absolute", value: address },
        defines: { registers: ["a"], flags: ["n", "z"] },
        uses: { registers: [], flags: [] },
        memory: [
          {
            kind: "read",
            address: { kind: "absolute", value: address },
            width: 1,
            volatile: true,
            order: 0,
          },
        ],
        cost: { bytes: 3, minCycles: 4, maxCycles: 4 },
        source: span,
      });
      expect(lowered.result).toEqual({ kind: "register", registers: "a", bytes: 1, signed: false });
      expect(lowered.data).toEqual([]);
      expect(Object.isFrozen(lowered.instructions)).toBe(true);
      expect(Object.isFrozen(lowered.instructions[0]?.memory)).toBe(true);
      expect(Object.isFrozen(lowered.result)).toBe(true);
    });

    it("retains the hardware read when its result is discarded", () => {
      const lowered = lowerC64Operation(
        sample(capability, null),
        new Map(),
        selectedProfile(),
        noScratch,
      );
      expect(lowered.instructions.map(({ opcode, operand }) => [opcode, operand])).toEqual([
        ["lda", { kind: "absolute", value: address }],
      ]);
      expect(lowered.data).toEqual([]);
      expect(forwards([sample(capability, null), destination, write])).toBe(false);
    });

    it("forwards the sole adjacent fixed byte store without a save/reload home", () => {
      expect(forwards([sample(capability), destination, write])).toBe(true);
      const program = lowerSample(capability);
      expect(
        program.functions[0]!.blocks[0]!.instructions.map(({ opcode, operand }) => [
          opcode,
          operand,
        ]),
      ).toEqual([
        ["lda", { kind: "absolute", value: address }],
        ["sta", { kind: "absolute", value: 0x0400 }],
      ]);
      expect(program.requiredStorage).toEqual([]);
      expect(program.data.map(({ id }) => id)).toEqual(["platform.startup-state"]);
    });

    it("keeps the first sample stable across a later read of the other port", () => {
      expect(forwards([sample(capability), destination, sample(other, null), write])).toBe(false);
      const program = lowerSample(capability, other);
      const home = program.requiredStorage.find(({ id }) => id.endsWith("retained-value:sample"));
      expect(home).toMatchObject({ bytes: 1, storageClass: "temporary" });
      expect(program.requiredStorage).toHaveLength(1);
      const instructions = program.functions[0]!.blocks[0]!.instructions;
      expect(instructions.map(({ opcode }) => opcode)).toEqual(["lda", "sta", "lda", "lda", "sta"]);
      for (const index of [1, 3]) {
        expect(instructions[index]?.operand).toMatchObject({
          kind: "storage",
          requestId: home?.id,
          offset: 0,
        });
      }
      expect(instructions[0]?.operand).toEqual({ kind: "absolute", value: address });
      expect(instructions[2]?.operand).toEqual({
        kind: "absolute",
        value: address === 0xdc01 ? 0xdc00 : 0xdc01,
      });
      expect(
        instructions
          .flatMap(({ memory }) => memory)
          .filter(({ volatile, kind }) => volatile && kind === "read"),
      ).toHaveLength(2);
    });

    it("rejects forwarding when the destination requires runtime address setup", () => {
      expect(forwards([sample(capability), write])).toBe(false);
    });

    it("rejects forwarding for multiple uses, a different stored value or a word store", () => {
      expect(forwards([sample(capability), destination, write], false)).toBe(false);
      expect(forwards([sample(capability), destination, { ...write, value: "other" }])).toBe(false);
      expect(forwards([sample(capability), destination, { ...write, width: 2 }])).toBe(false);
      expect(forwards([{ ...sample(capability), type: WORD }, destination, write])).toBe(false);
    });

    it("rejects forwarding across basic blocks", () => {
      const blocks = [
        semanticBlock("entry", [sample(capability), destination], { kind: "jump", target: "next" }),
        semanticBlock("next", [write], { kind: "return", value: null }),
      ];
      expect(
        selectRegisterForwarding(blocks, new Set(["sample"])).forwardedRegisterValues.has("sample"),
      ).toBe(false);
    });
  },
);

describe.each(predicates)(
  "saved-byte predicate selection for $capability",
  ({ capability, mask }) => {
    it("uses the active-low zero condition without another hardware read or Boolean home", () => {
      const operation: PlatformOperation = {
        kind: "platform",
        capability,
        result: "pressed",
        arguments: ["sample"],
        type: BOOLEAN,
        effect: "pure",
        span,
      };
      const values = new Map<string, LoweredValue>([
        ["sample", { kind: "register", registers: "a", bytes: 1, signed: false }],
      ]);
      const lowered = lowerC64Operation(operation, values, selectedProfile(), noScratch);
      expect(lowered.instructions).toHaveLength(1);
      expect(lowered.instructions[0]).toMatchObject({
        opcode: "and",
        mode: "immediate",
        operand: { kind: "immediate", value: mask },
        uses: { registers: ["a"], flags: [] },
        defines: { registers: ["a"], flags: ["n", "z"] },
        memory: [],
        cost: { bytes: 2, minCycles: 2, maxCycles: 2 },
        source: span,
      });
      expect(lowered.result).toEqual({ kind: "condition", whenTrue: "beq", usesFlag: "z" });
      expect(lowered.data).toEqual([]);
      expect(Object.isFrozen(lowered.result)).toBe(true);
    });
  },
);
