import { describe, expect, it } from "vitest";
import type { MemoryReadOperation, MemoryWriteOperation } from "../semantic/operations.js";
import { WORD, selectedProfile, sourceBinding, sourceSpan } from "./lowering-test-support.js";
import { lowerMemoryRead, lowerMemoryWrite } from "./lower-memory.js";

describe("fixed volatile memory addresses", () => {
  it("uses direct low-first byte accesses at the 16-bit wrap instead of a pointer", () => {
    const span = sourceSpan(300);
    const read: MemoryReadOperation = Object.freeze({
      kind: "memory-read",
      result: "read",
      address: "address",
      width: 2,
      byteOrder: "low-first",
      volatile: true,
      type: WORD,
      integer: null,
      span,
    });
    const write: MemoryWriteOperation = Object.freeze({
      kind: "memory-write",
      address: "address",
      value: "value",
      width: 2,
      byteOrder: "low-first",
      volatile: true,
      span,
    });
    const context = {
      cpu: selectedProfile().cpu,
      owner: sourceBinding(301),
      values: new Map([
        ["address", Object.freeze({ kind: "constant" as const, value: 0xffff, bytes: 2 })],
        ["value", Object.freeze({ kind: "constant" as const, value: 0x1234, bytes: 2 })],
      ]),
      pointerRequest: () => {
        throw new Error("A fixed address must not request a dynamic pointer");
      },
      lowByteRequest: () => {
        throw new Error("A fixed word read must not request a low-byte staging home");
      },
    };
    const loaded = lowerMemoryRead(read, context);
    expect(loaded.map(({ opcode, operand }) => [opcode, operand])).toEqual([
      ["lda", { kind: "absolute", value: 0xffff }],
      ["ldx", { kind: "absolute", value: 0x0000 }],
    ]);
    expect(loaded.flatMap(({ memory }) => memory.map(({ order }) => order))).toEqual([0, 1]);

    const stored = lowerMemoryWrite(write, context);
    expect(stored.map(({ opcode, operand }) => [opcode, operand])).toEqual([
      ["lda", { kind: "immediate", value: 0x34 }],
      ["sta", { kind: "absolute", value: 0xffff }],
      ["lda", { kind: "immediate", value: 0x12 }],
      ["sta", { kind: "absolute", value: 0x0000 }],
    ]);
    expect(stored.flatMap(({ memory }) => memory.map(({ order }) => order))).toEqual([0, 1]);
  });
});
