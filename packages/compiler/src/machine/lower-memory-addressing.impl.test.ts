import { describe, expect, it } from "vitest";
import type { MemoryReadOperation, MemoryWriteOperation } from "../semantic/operations.js";
import type { LoweredValue } from "./lower-control.js";
import { BYTE, WORD, selectedProfile, sourceBinding, sourceSpan } from "./lowering-test-support.js";
import { lowerMemoryRead, lowerMemoryWrite } from "./lower-memory.js";
import type { RawMemoryLoweringContext } from "./lower-memory.js";

/** Fixed addresses must never allocate a pointer or low-byte staging home. */
function context(
  address: number,
  value: LoweredValue = { kind: "constant", value: 0x1234, bytes: 2 },
): RawMemoryLoweringContext {
  return {
    cpu: selectedProfile().cpu,
    owner: sourceBinding(0),
    values: new Map<string, LoweredValue>([
      ["address", { kind: "constant", value: address, bytes: 2 }],
      ["value", value],
    ]),
    pointerRequest: () => {
      throw new Error("Fixed address requested pointer storage");
    },
    lowByteRequest: () => {
      throw new Error("Fixed address requested staging storage");
    },
  };
}

/** A low-first volatile read at an already evaluated fixed address. */
function read(width: 1 | 2): MemoryReadOperation {
  return {
    kind: "memory-read",
    result: "read",
    address: "address",
    width,
    byteOrder: "low-first",
    volatile: true,
    type: width === 1 ? BYTE : WORD,
    integer: null,
    span: sourceSpan(1),
  };
}

/** A low-first volatile write whose value was evaluated before instruction selection. */
function write(width: 1 | 2): MemoryWriteOperation {
  return {
    kind: "memory-write",
    address: "address",
    value: "value",
    width,
    byteOrder: "low-first",
    volatile: true,
    span: sourceSpan(2),
  };
}

describe("fixed-address byte selection", () => {
  it.each([
    { address: 1, locations: [1, 2], modes: ["zero-page", "zero-page"], bytes: 4, cycles: 6 },
    {
      address: 0xff,
      locations: [0xff, 0x100],
      modes: ["zero-page", "absolute"],
      bytes: 5,
      cycles: 7,
    },
    {
      address: 0x100,
      locations: [0x100, 0x101],
      modes: ["absolute", "absolute"],
      bytes: 6,
      cycles: 8,
    },
    {
      address: 0xffff,
      locations: [0xffff, 0],
      modes: ["absolute", "zero-page"],
      bytes: 5,
      cycles: 7,
    },
    { address: -1, locations: [0xffff, 0], modes: ["absolute", "zero-page"], bytes: 5, cycles: 7 },
    { address: 0x10000, locations: [0, 1], modes: ["zero-page", "zero-page"], bytes: 4, cycles: 6 },
  ])("should select each byte independently at $address without extra storage", (expected) => {
    const selected = context(expected.address);
    const loaded = lowerMemoryRead(read(2), selected);
    const stored = lowerMemoryWrite(write(2), selected);
    const stores = stored.filter(({ opcode }) => opcode === "sta");
    expect(loaded.map(({ mode }) => mode)).toEqual(expected.modes);
    expect(stores.map(({ mode }) => mode)).toEqual(expected.modes);
    for (const instructions of [loaded, stores]) {
      expect(instructions.map(({ operand }) => operand)).toEqual(
        expected.locations.map((value) => ({ kind: "absolute", value })),
      );
      expect(instructions.flatMap(({ memory }) => memory)).toEqual(
        expected.locations.map((value, order) => ({
          kind: instructions === loaded ? "read" : "write",
          address: { kind: "absolute", value },
          width: 1,
          volatile: true,
          order,
        })),
      );
      expect(instructions.reduce((sum, instruction) => sum + instruction.cost.bytes, 0)).toBe(
        expected.bytes,
      );
      expect(instructions.reduce((sum, instruction) => sum + instruction.cost.minCycles, 0)).toBe(
        expected.cycles,
      );
      expect(instructions.reduce((sum, instruction) => sum + instruction.cost.maxCycles, 0)).toBe(
        expected.cycles,
      );
    }
    expect(stored.reduce((sum, instruction) => sum + instruction.cost.bytes, 0)).toBe(
      expected.bytes + 4,
    );
    expect(stored.reduce((sum, instruction) => sum + instruction.cost.minCycles, 0)).toBe(
      expected.cycles + 4,
    );
  });

  it("should keep a fixed byte in X using its direct zero-page load", () => {
    const loaded = lowerMemoryRead(read(1), { ...context(0xff), byteRegister: "x" });
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({
      opcode: "ldx",
      mode: "zero-page",
      operand: { kind: "absolute", value: 0xff },
      cost: { bytes: 2, minCycles: 3, maxCycles: 3 },
    });
    expect(loaded[0]!.defines.flags).toEqual(["n", "z"]);
  });

  it("should write a live accumulator byte directly without reloading or changing flags", () => {
    const stored = lowerMemoryWrite(
      write(1),
      context(0xff, { kind: "register", registers: "a", bytes: 1 }),
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      opcode: "sta",
      mode: "zero-page",
      operand: { kind: "absolute", value: 0xff },
      cost: { bytes: 2, minCycles: 3, maxCycles: 3 },
    });
    expect(stored[0]!.defines.flags).toEqual([]);
    expect(stored[0]!.memory).toEqual([
      {
        kind: "write",
        address: { kind: "absolute", value: 0xff },
        width: 1,
        volatile: true,
        order: 0,
      },
    ]);
  });
});
