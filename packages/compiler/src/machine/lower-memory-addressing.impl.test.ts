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

/** One proved `constant + byte index` address with no allocated word temporary. */
function ordinalContext(
  index: LoweredValue,
  options: { base?: number; observerEvidence?: boolean } = {},
): RawMemoryLoweringContext {
  return {
    cpu: selectedProfile().cpu,
    owner: sourceBinding(0),
    values: new Map<string, LoweredValue>([
      [
        "address",
        {
          kind: "ordinal-address",
          base: options.base ?? 0xc110,
          index,
          bytes: 2,
          signed: false,
        },
      ],
    ]),
    pointerRequest: () => {
      throw new Error("Ordinal address requested pointer storage");
    },
    ...(options.observerEvidence === false ? {} : { observerEvidence: true }),
  };
}

describe("proved ordinal-address byte reads", () => {
  it("should load the retained byte home into X and use one absolute,X read", () => {
    const index: LoweredValue = { kind: "storage", requestId: "counter", bytes: 1 };
    const loaded = lowerMemoryRead(read(1), ordinalContext(index));
    expect(loaded.map(({ opcode }) => opcode)).toEqual(["ldx", "lda"]);
    expect(loaded.map(({ mode }) => mode)).toEqual(["storage", "absolute-x"]);
    expect(loaded[1]!.operand).toEqual({ kind: "absolute", value: 0xc110 });
    expect(loaded.flatMap(({ memory }) => memory)).toEqual([
      {
        kind: "read",
        address: { kind: "absolute", value: 0xc110 },
        width: 1,
        volatile: true,
        order: 0,
      },
    ]);
    expect(loaded[1]!.observerOrigins?.[0]).toMatchObject({
      kind: "raw",
      recipe: "raw-indexed",
      position: 1,
      length: 2,
      byte: 0,
      addressInput: index,
    });
    expect(loaded[0]!.observerOrigins?.[0]).toMatchObject({
      recipe: "raw-indexed",
      position: 0,
      byte: null,
      addressInput: index,
    });
  });

  it("should keep an X-held ordinal index in place without reloading it", () => {
    const index: LoweredValue = { kind: "register", registers: "x", bytes: 1, signed: false };
    const loaded = lowerMemoryRead(read(1), ordinalContext(index));
    expect(loaded.map(({ opcode }) => opcode)).toEqual(["lda"]);
    expect(loaded[0]!.mode).toBe("absolute-x");
    expect(loaded[0]!.operand).toEqual({ kind: "absolute", value: 0xc110 });
    expect(loaded[0]!.memory).toEqual([
      {
        kind: "read",
        address: { kind: "absolute", value: 0xc110 },
        width: 1,
        volatile: true,
        order: 0,
      },
    ]);
    expect(loaded[0]!.observerOrigins?.[0]).toMatchObject({
      kind: "raw",
      recipe: "raw-indexed",
      position: 0,
      length: 1,
      byte: 0,
      addressInput: index,
    });
  });

  it("should take an immediate index or a live accumulator index without loading memory", () => {
    const immediate = lowerMemoryRead(
      read(1),
      ordinalContext({ kind: "constant", value: 3, bytes: 1 }),
    );
    expect(immediate.map(({ opcode }) => opcode)).toEqual(["ldx", "lda"]);
    expect(immediate[0]!.operand).toEqual({ kind: "immediate", value: 3 });

    const accumulator = lowerMemoryRead(
      read(1),
      ordinalContext({ kind: "register", registers: "a", bytes: 1 }),
    );
    expect(accumulator.map(({ opcode }) => opcode)).toEqual(["tax", "lda"]);
    expect(accumulator[1]!.mode).toBe("absolute-x");
  });

  it("should leave the canonical sequence free of observer associations", () => {
    const index: LoweredValue = { kind: "storage", requestId: "counter", bytes: 1 };
    const loaded = lowerMemoryRead(read(1), ordinalContext(index, { observerEvidence: false }));
    expect(loaded.map(({ opcode }) => opcode)).toEqual(["ldx", "lda"]);
    expect(loaded.every(({ observerOrigins }) => observerOrigins === undefined)).toBe(true);
  });

  it("should reject a word read because the rule only proves one byte", () => {
    const index: LoweredValue = { kind: "storage", requestId: "counter", bytes: 1 };
    expect(() => lowerMemoryRead(read(2), ordinalContext(index))).toThrow(
      "Proved ordinal raw address is only selected for byte reads",
    );
  });
});

describe("static raw-address writes", () => {
  /** Build a write context for one already-evaluated static address. */
  function staticContext(address: LoweredValue): RawMemoryLoweringContext {
    return {
      cpu: selectedProfile().cpu,
      owner: sourceBinding(0),
      values: new Map<string, LoweredValue>([
        ["address", address],
        ["value", { kind: "constant", value: 0x5a, bytes: 1 }],
      ]),
      pointerRequest: () => {
        throw new Error("Static address requested pointer storage");
      },
    };
  }

  it("should store directly through an asset symbol address", () => {
    const stored = lowerMemoryWrite(
      write(1),
      staticContext({ kind: "symbol-address", label: "asset.S", bytes: 2 }),
    );
    expect(stored.map(({ opcode }) => opcode)).toEqual(["lda", "sta"]);
    expect(stored[1]!.mode).toBe("absolute");
    expect(stored[1]!.operand).toEqual({ kind: "label", label: "asset.S", offset: 0 });
    expect(stored[1]!.memory).toEqual([
      {
        kind: "write",
        address: { kind: "symbolic", label: "asset.S", offset: 0 },
        width: 1,
        volatile: true,
        order: 0,
      },
    ]);
    expect(stored.reduce((sum, instruction) => sum + instruction.cost.bytes, 0)).toBe(5);
    expect(stored.reduce((sum, instruction) => sum + instruction.cost.minCycles, 0)).toBe(6);
  });

  it("should use zero-page mode for a proved static label home", () => {
    const stored = lowerMemoryWrite(
      write(1),
      staticContext({
        kind: "static-address",
        label: "global.g",
        offset: 0,
        bytes: 2,
        signed: false,
        zeroPage: true,
      }),
    );
    expect(stored[1]!.mode).toBe("zero-page");
    expect(stored.reduce((sum, instruction) => sum + instruction.cost.bytes, 0)).toBe(4);
    expect(stored.reduce((sum, instruction) => sum + instruction.cost.minCycles, 0)).toBe(5);
  });

  it("should store directly through a certified static home", () => {
    const stored = lowerMemoryWrite(
      write(1),
      staticContext({
        kind: "static-address",
        requestId: "local",
        offset: 0,
        bytes: 2,
        signed: false,
      }),
    );
    expect(stored[1]!.mode).toBe("storage");
    expect(stored[1]!.operand).toEqual({ kind: "storage", requestId: "local", offset: 0 });
    expect(stored[1]!.memory).toEqual([
      {
        kind: "write",
        address: { kind: "storage", requestId: "local", offset: 0 },
        width: 1,
        volatile: true,
        order: 0,
      },
    ]);
  });
});

describe("proved ordinal-address byte writes", () => {
  /** Add one already-evaluated value to the ordinal write context. */
  function writeContext(index: LoweredValue, value: LoweredValue): RawMemoryLoweringContext {
    const base = ordinalContext(index);
    return { ...base, values: new Map([...base.values, ["value", value]]) };
  }

  it("should write through one absolute,X store with a storage index", () => {
    const index: LoweredValue = { kind: "storage", requestId: "counter", bytes: 1 };
    const stored = lowerMemoryWrite(
      write(1),
      writeContext(index, { kind: "constant", value: 0x5a, bytes: 1 }),
    );
    expect(stored.map(({ opcode }) => opcode)).toEqual(["ldx", "lda", "sta"]);
    expect(stored.map(({ mode }) => mode)).toEqual(["storage", "immediate", "absolute-x"]);
    expect(stored[2]!.operand).toEqual({ kind: "absolute", value: 0xc110 });
    expect(stored[2]!.memory).toEqual([
      {
        kind: "write",
        address: { kind: "absolute", value: 0xc110 },
        width: 1,
        volatile: true,
        order: 0,
      },
    ]);
    expect(stored[2]!.observerOrigins?.[0]).toMatchObject({
      kind: "raw",
      recipe: "raw-indexed",
      position: 1,
      length: 2,
      byte: 0,
      addressInput: index,
    });
    expect(stored.reduce((sum, instruction) => sum + instruction.cost.bytes, 0)).toBe(8);
    expect(stored.reduce((sum, instruction) => sum + instruction.cost.minCycles, 0)).toBe(11);
  });

  it("should write a live accumulator value with an X-held index in one store", () => {
    const index: LoweredValue = { kind: "register", registers: "x", bytes: 1, signed: false };
    const stored = lowerMemoryWrite(
      write(1),
      writeContext(index, { kind: "register", registers: "a", bytes: 1, signed: false }),
    );
    expect(stored.map(({ opcode }) => opcode)).toEqual(["sta"]);
    expect(stored[0]!.mode).toBe("absolute-x");
  });

  it("should reject a word write because the rule only proves one byte", () => {
    const index: LoweredValue = { kind: "storage", requestId: "counter", bytes: 1 };
    expect(() =>
      lowerMemoryWrite(write(2), writeContext(index, { kind: "constant", value: 1, bytes: 2 })),
    ).toThrow("Proved ordinal raw address is only selected for byte writes");
  });
});
