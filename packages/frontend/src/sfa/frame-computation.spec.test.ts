/**
 * Specification tests for the SFA frame-computation pass (RD-05 §4.2, R1–R6).
 *
 * Expectations derive exclusively from plans/rd-05-sfa-frame-planner/
 * 07-testing-strategy.md (ST-F1..ST-F8) and 03-01-frame-model.md / spec Ch 11
 * §3.3 — NOT from implementation logic. Immutable oracle (testing.md Rule 10).
 *
 * Spec-tests-first: authored before `frame-computation.ts`; verified to FAIL (red).
 */

import { describe, expect, it } from "vitest";
import { primitive } from "@blend65/core";
import { slotSize, computeFrame } from "./frame-computation.js";
import { frameVar, structType, arrayType, makeFn } from "./test-fixtures.js";

describe("Specification: SFA frame computation (R1–R6, §3.3)", () => {
  // ST-F1 — byte local → 1 byte.
  it("should size a byte local as 1 (ST-F1)", () => {
    expect(slotSize(frameVar("b", primitive("byte")), "local")).toBe(1);
  });

  // ST-F2 — word local → 2 bytes.
  it("should size a word local as 2 (ST-F2)", () => {
    expect(slotSize(frameVar("w", primitive("word")), "local")).toBe(2);
  });

  // ST-F3 — struct param passed by-ref → 2-byte pointer (struct byteSize 4).
  it("should size a struct by-ref parameter as 2 (pointer) (ST-F3)", () => {
    const p = frameVar("p", structType("Big", 4), true);
    expect(slotSize(p, "parameter")).toBe(2);
  });

  // ST-F4 — struct local → full sizeof (struct byteSize 4).
  it("should size a struct local as its byteSize 4 (ST-F4)", () => {
    const q = frameVar("q", structType("Big", 4));
    expect(slotSize(q, "local")).toBe(4);
  });

  // ST-F5 — array T[3] local of byte elements → 3 bytes (elem×N).
  it("should size an array[3] of byte local as 3 (ST-F5)", () => {
    const a = frameVar("a", arrayType(primitive("byte"), 3));
    expect(slotSize(a, "local")).toBe(3);
  });

  // ST-F6 — computeFrame orders params before locals, offsets 0,2; totalSize 3.
  it("should order params before locals with running offsets (ST-F6)", () => {
    const fn = makeFn("M.f", {
      parameters: [frameVar("dx", primitive("sword"))],
      locals: [frameVar("i", primitive("byte"))],
    });
    const frame = computeFrame(fn);

    expect(frame.slots).toHaveLength(2);
    expect(frame.slots[0]?.name).toBe("dx");
    expect(frame.slots[0]?.kind).toBe("parameter");
    expect(frame.slots[0]?.offset).toBe(0);
    expect(frame.slots[0]?.size).toBe(2);
    expect(frame.slots[1]?.name).toBe("i");
    expect(frame.slots[1]?.kind).toBe("local");
    expect(frame.slots[1]?.offset).toBe(2);
    expect(frame.slots[1]?.size).toBe(1);
    expect(frame.totalSize).toBe(3);
  });

  // ST-F7 — function with no params/locals → empty slots, totalSize 0.
  it("should produce an empty frame for a function with no params/locals (ST-F7)", () => {
    const frame = computeFrame(makeFn("M.empty"));
    expect(frame.slots).toHaveLength(0);
    expect(frame.totalSize).toBe(0);
  });

  // ST-F8 — a slot whose type is void contributes 0 and never throws.
  it("should size a void slot as 0 without throwing (ST-F8)", () => {
    const v = frameVar("z", primitive("void"));
    expect(slotSize(v, "local")).toBe(0);
    const frame = computeFrame(makeFn("M.g", { locals: [v] }));
    expect(frame.totalSize).toBe(0);
  });

  // §4.2 — the always-live flags are carried through to the frame.
  it("should carry isInterrupt/isEscaped/isReachable onto the frame", () => {
    const fn = makeFn("M.irq", { isInterrupt: true, isEscaped: true });
    const frame = computeFrame(fn);
    expect(frame.isInterrupt).toBe(true);
    expect(frame.isEscaped).toBe(true);
    expect(frame.isReachable).toBe(true);
    expect(frame.functionName).toBe("M.irq");
  });
});
