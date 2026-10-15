import { describe, expect, it } from "vitest";
import type { SemanticOperation, SemanticTerminator } from "../semantic/operations.js";
import { selectRegisterForwarding } from "./lower-register-forwarding.js";
import {
  BYTE,
  VOID,
  WORD,
  semanticBlock,
  sourceBinding,
  sourceSpan,
} from "./lowering-test-support.js";

const span = sourceSpan(905);
const root = sourceBinding(906);

/** Constant operand identities may be skipped because they emit no register-clobbering code. */
const mask: SemanticOperation = {
  kind: "constant",
  result: "mask",
  value: 0x7fn,
  type: BYTE,
  integer: null,
  span,
};

const destination: SemanticOperation = {
  ...mask,
  result: "destination",
  value: 0x3200n,
  type: WORD,
};

/** Each producer leaves exactly one byte in A, but that byte is disposable only with one use. */
const complement: Extract<SemanticOperation, { kind: "unary" }> = {
  kind: "unary",
  result: "value",
  operator: "~",
  operand: "input",
  type: BYTE,
  integer: null,
  span,
};

const bitwise: Extract<SemanticOperation, { kind: "binary" }> = {
  kind: "binary",
  result: "value",
  operator: "&",
  left: "input",
  right: "mask",
  type: BYTE,
  integer: null,
  span,
};

const read: Extract<SemanticOperation, { kind: "memory-read" }> = {
  kind: "memory-read",
  result: "value",
  address: "address",
  width: 1,
  byteOrder: "low-first",
  volatile: true,
  type: BYTE,
  integer: null,
  span,
};

const load: SemanticOperation = {
  kind: "load",
  result: "value",
  place: { root, rootType: BYTE, path: [] },
  type: BYTE,
  integer: null,
  span,
};

const write: Extract<SemanticOperation, { kind: "memory-write" }> = {
  kind: "memory-write",
  address: "destination",
  value: "value",
  width: 1,
  byteOrder: "low-first",
  volatile: true,
  span,
};

const store: Extract<SemanticOperation, { kind: "store" }> = {
  kind: "store",
  value: "value",
  place: { root, rootType: BYTE, path: [] },
  type: BYTE,
  span,
};

/** Ask the existing selector about one block without inferring additional use or range facts. */
function selects(
  producer: SemanticOperation,
  tail: readonly SemanticOperation[],
  singleUse = true,
  terminator: SemanticTerminator = { kind: "return", value: null },
): boolean {
  return selectRegisterForwarding(
    [semanticBlock("entry", [producer, ...tail], terminator)],
    new Set(singleUse ? ["value"] : []),
  ).forwardedRegisterValues.has("value");
}

describe("bounded adjacent byte delivery", () => {
  it.each(["&", "|", "^"] as const)(
    "should deliver each approved producer into adjacent constant-right byte %s",
    (operator) => {
      const consumer = { ...bitwise, result: "combined", operator, left: "value" };
      for (const producer of [load, read, complement, bitwise]) {
        expect(selects(producer, [mask, consumer])).toBe(true);
        expect(selects(producer, [mask, consumer], false)).toBe(false);
        expect(selects(producer, [{ ...consumer, right: "runtime" }])).toBe(false);
        expect(selects(producer, [mask, { ...consumer, left: "other" }])).toBe(false);
        expect(selects(producer, [mask, { ...consumer, type: WORD }])).toBe(false);
        expect(
          selects(producer, [mask, { kind: "cpu-control", control: "asm_nop", span }, consumer]),
        ).toBe(false);
      }
    },
  );

  it("should deliver byte reads and bitwise results into complement without extending other unary forms", () => {
    const consumer = { ...complement, result: "combined", operand: "value" };
    for (const producer of [load, read, bitwise]) {
      expect(selects(producer, [consumer])).toBe(true);
      expect(selects(producer, [consumer], false)).toBe(false);
      expect(selects(producer, [{ ...consumer, operand: "other" }])).toBe(false);
      expect(selects(producer, [{ ...consumer, type: WORD }])).toBe(false);
      expect(selects(producer, [{ ...consumer, operator: "-" }])).toBe(false);
    }
    expect(selects(complement, [consumer])).toBe(false);
  });

  it("should deliver computed byte values only to fixed or unselected byte stores", () => {
    for (const producer of [complement, bitwise]) {
      expect(selects(producer, [destination, write])).toBe(true);
      expect(selects(producer, [store])).toBe(true);
      expect(selects(producer, [destination, write], false)).toBe(false);
      expect(selects(producer, [write])).toBe(false);
      expect(selects(producer, [destination, { ...write, width: 2 }])).toBe(false);
      expect(selects(producer, [destination, { ...write, value: "other" }])).toBe(false);
      expect(selects(producer, [{ ...store, type: WORD }])).toBe(false);
      expect(selects(producer, [{ ...store, value: "other" }])).toBe(false);
      expect(
        selects(producer, [
          { ...store, place: { ...store.place, path: [{ kind: "index", value: "ordinal" }] } },
        ]),
      ).toBe(false);
      expect(
        selects(producer, [
          { ...store, place: { ...store.place, path: [{ kind: "field", name: "member" }] } },
        ]),
      ).toBe(false);
    }
  });

  it("should return only the sole byte result at the end of its producing block", () => {
    for (const producer of [complement, bitwise]) {
      const returns: SemanticTerminator = { kind: "return", value: "value" };
      expect(selects(producer, [], true, returns)).toBe(true);
      expect(selects(producer, [mask], true, returns)).toBe(true);
      expect(selects(producer, [], false, returns)).toBe(false);
      expect(selects(producer, [], true, { kind: "return", value: "other" })).toBe(false);
      expect(
        selects(producer, [{ kind: "cpu-control", control: "asm_nop", span }], true, returns),
      ).toBe(false);
      expect(selects(producer, [], true, { kind: "jump", target: "later" })).toBe(false);
    }
  });

  it("should not extend delivery to calls, platform operations, arithmetic, conversions or words", () => {
    const consumer = { ...complement, result: "combined", operand: "value" };
    const excluded: readonly SemanticOperation[] = [
      { ...complement, type: WORD },
      { ...complement, operator: "-" },
      { ...bitwise, type: WORD },
      { ...bitwise, operator: "+" },
      { ...read, width: 2, type: WORD },
      { ...load, type: WORD },
      { kind: "convert", result: "value", operand: "input", type: BYTE, span },
      { kind: "call", result: "value", callee: root, arguments: [], type: BYTE, span },
      {
        kind: "platform",
        result: "value",
        capability: "c64.cia2.readAndClearPendingSources",
        arguments: [],
        type: BYTE,
        effect: "volatile-read",
        span,
      },
    ];
    for (const producer of excluded) expect(selects(producer, [consumer])).toBe(false);
    for (const producer of [complement, bitwise]) {
      expect(selects(producer, [mask, { ...bitwise, operator: "+", left: "value" }])).toBe(false);
      expect(
        selects(producer, [
          { kind: "call", result: null, callee: root, arguments: [], type: VOID, span },
          consumer,
        ]),
      ).toBe(false);
    }
  });

  it("should skip only constant conversions while keeping runtime conversions as barriers", () => {
    const conversion: SemanticOperation = {
      kind: "convert",
      result: "converted",
      operand: "mask",
      type: BYTE,
      span,
    };
    const consumer = { ...bitwise, result: "combined", left: "value", right: "converted" };
    expect(selects(complement, [mask, conversion, consumer])).toBe(true);
    expect(selects(complement, [mask, { ...conversion, operand: "runtime" }, consumer])).toBe(
      false,
    );
  });
});
