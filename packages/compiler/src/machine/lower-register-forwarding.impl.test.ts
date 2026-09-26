import { describe, expect, it } from "vitest";
import type { SemanticOperation } from "../semantic/operations.js";
import { selectRegisterForwarding } from "./lower-register-forwarding.js";
import { BYTE, WORD, semanticBlock, sourceSpan } from "./lowering-test-support.js";

const span = sourceSpan(901);

/** A fixed destination identity emits no setup between the producer and consumer. */
const destination: SemanticOperation = {
  kind: "constant",
  result: "destination",
  value: 0x0450n,
  type: WORD,
  integer: null,
  span,
};

/** Ordered source read used to test the selector independently from instruction generation. */
const read: Extract<SemanticOperation, { kind: "memory-read" }> = {
  kind: "memory-read",
  result: "value",
  address: "source",
  width: 1,
  byteOrder: "low-first",
  volatile: true,
  type: BYTE,
  integer: null,
  span,
};

/** The sole consumer can use A only when its destination needs no register-clobbering setup. */
const write: Extract<SemanticOperation, { kind: "memory-write" }> = {
  kind: "memory-write",
  address: "destination",
  value: "value",
  width: 1,
  byteOrder: "low-first",
  volatile: true,
  span,
};

/** Query one bounded selection window without inventing another lowering path. */
function forwarded(operations: readonly SemanticOperation[], singleUse = true): boolean {
  return selectRegisterForwarding(
    [semanticBlock("entry", operations, { kind: "return", value: null, span })],
    new Set(singleUse ? ["value"] : []),
  ).forwardedRegisterValues.has("value");
}

describe("adjacent register ownership", () => {
  it("forwards a single byte through zero-instruction constant setup", () => {
    expect(forwarded([read, destination, write])).toBe(true);
  });

  it("keeps a value with more than one consumer stable", () => {
    expect(forwarded([read, destination, write], false)).toBe(false);
  });

  it("does not forward through another ordered read", () => {
    expect(forwarded([read, { ...read, result: "other" }, destination, write])).toBe(false);
  });

  it("does not forward into dynamic-address setup", () => {
    expect(forwarded([read, write])).toBe(false);
  });

  it("does not mistake a different consumed value for the loaded one", () => {
    expect(forwarded([read, destination, { ...write, value: "other" }])).toBe(false);
  });

  it("keeps both bytes of a word on the existing stable path", () => {
    expect(
      forwarded([{ ...read, width: 2, type: WORD }, destination, { ...write, width: 2 }]),
    ).toBe(false);
  });
});
