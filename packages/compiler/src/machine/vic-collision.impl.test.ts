import { describe, expect, it } from "vitest";
import type { PlatformOperation, SemanticOperation } from "../semantic/operations.js";
import type { ValueLifetime } from "../semantic/whole-program.js";
import { lowerC64Operation, type C64LoweringSupport } from "./lower-c64.js";
import { selectRegisterForwarding } from "./lower-register-forwarding.js";
import {
  BYTE,
  VOID,
  WORD,
  lowerFunctions,
  semanticBlock,
  semanticFunction,
  selectedProfile,
  sourceSpan,
} from "./lowering-test-support.js";

const operations = [
  { capability: "c64.vic.readAndClearSpriteSpriteCollisions", address: 0xd01e },
  { capability: "c64.vic.readAndClearSpriteBackgroundCollisions", address: 0xd01f },
] as const;
const span = sourceSpan(100);

/** Collision samples must not allocate a helper, scratch home or software shadow. */
const noScratch: C64LoweringSupport = {
  requestScratch: () => {
    throw new Error("A direct collision read must not allocate scratch storage");
  },
};

/** Represent an already admitted consuming byte observation, including discarded results. */
function sample(capability: string, result: string | null = "sample"): PlatformOperation {
  return Object.freeze({
    kind: "platform",
    capability,
    result,
    arguments: Object.freeze([]),
    type: BYTE,
    effect: "volatile-read",
    span,
  });
}

/** A fixed address emits no accumulator-clobbering setup between a sample and its store. */
const destination: SemanticOperation = {
  kind: "constant",
  result: "destination",
  value: 0x0400n,
  type: WORD,
  integer: null,
  span,
};

/** The destination store consumes the sampled byte, never the hardware latch itself. */
const write: Extract<SemanticOperation, { kind: "memory-write" }> = {
  kind: "memory-write",
  address: "destination",
  value: "sample",
  width: 1,
  byteOrder: "low-first",
  volatile: true,
  span,
};

/** Query the existing forwarding selector using its actual sole-use and block boundaries. */
function forwards(items: readonly SemanticOperation[], singleUse = true): boolean {
  return selectRegisterForwarding(
    [semanticBlock("entry", items, { kind: "return", value: null })],
    new Set(singleUse ? ["sample"] : []),
  ).forwardedRegisterValues.has("sample");
}

/** Lower a retained sample with a declared lifetime through ordinary function storage closure. */
function lowerSample(capability: string, interveningRead: boolean) {
  const items: SemanticOperation[] = [sample(capability), destination];
  if (interveningRead) items.push(sample(capability, null));
  items.push(write);
  const fn = semanticFunction(90, "sample-collisions", [], VOID, [
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
  if (result.kind !== "complete") throw new Error("Expected finite collision result lowering");
  return result.program;
}

describe.each(operations)("collision lowering for $capability", ({ capability, address }) => {
  it("should emit one volatile absolute load with exact flags and cost when a byte is sampled", () => {
    const lowered = lowerC64Operation(sample(capability), new Map(), selectedProfile(), noScratch);
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

  it("should retain the consuming instruction when the semantic result is discarded", () => {
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
  });

  it("should forward A when only constant setup separates the sample from its sole byte store", () => {
    expect(forwards([sample(capability), destination, write])).toBe(true);
    const program = lowerSample(capability, false);
    expect(
      program.functions[0]!.blocks[0]!.instructions.map(({ opcode, operand }) => [opcode, operand]),
    ).toEqual([
      ["lda", { kind: "absolute", value: address }],
      ["sta", { kind: "absolute", value: 0x0400 }],
    ]);
    expect(program.requiredStorage).toEqual([]);
    expect(program.data.map(({ id }) => id)).toEqual(["platform.startup-state"]);
  });

  it("should keep the original sample in a stable home when another collision read clobbers A", () => {
    const items = [sample(capability), destination, sample(capability, null), write];
    expect(forwards(items)).toBe(false);
    const program = lowerSample(capability, true);
    const home = program.requiredStorage.find(({ id }) => id.endsWith("retained-value:sample"));
    expect(home).toMatchObject({ bytes: 1, storageClass: "temporary" });
    expect(program.requiredStorage).toHaveLength(1);
    const instructions = program.functions[0]!.blocks[0]!.instructions;
    expect(instructions.map(({ opcode }) => opcode)).toEqual(["lda", "sta", "lda", "lda", "sta"]);
    expect(instructions[1]?.operand).toMatchObject({
      kind: "storage",
      requestId: home?.id,
      offset: 0,
    });
    expect(instructions[3]?.operand).toMatchObject({
      kind: "storage",
      requestId: home?.id,
      offset: 0,
    });
    expect(
      instructions
        .flatMap(({ memory }) => memory)
        .filter(({ address: place }) => place.kind === "absolute" && place.value === address),
    ).toHaveLength(2);
  });

  it("should reject forwarding when the destination needs dynamic-address setup", () => {
    expect(forwards([sample(capability), write])).toBe(false);
  });

  it("should reject forwarding when the sampled value has more than one consumer", () => {
    expect(forwards([sample(capability), destination, write], false)).toBe(false);
  });

  it("should reject forwarding when the adjacent store consumes another value or writes a word", () => {
    expect(forwards([sample(capability), destination, { ...write, value: "other" }])).toBe(false);
    expect(forwards([sample(capability), destination, { ...write, width: 2 }])).toBe(false);
  });

  it("should reject forwarding when the destination store is in another block", () => {
    const blocks = [
      semanticBlock("entry", [sample(capability), destination], {
        kind: "jump",
        target: "next",
      }),
      semanticBlock("next", [write], { kind: "return", value: null }),
    ];
    expect(
      selectRegisterForwarding(blocks, new Set(["sample"])).forwardedRegisterValues.has("sample"),
    ).toBe(false);
  });
});

describe("collision forwarding admission", () => {
  it("should preserve the old stable path when another platform producer is encountered", () => {
    expect(forwards([sample("c64.input.readJoystick2"), destination, write])).toBe(false);
    expect(forwards([sample("c64.cia1.readAndClearPendingSources"), destination, write])).toBe(
      false,
    );
  });
});
