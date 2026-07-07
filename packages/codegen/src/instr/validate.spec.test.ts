/**
 * Specification tests for the CPU validator.
 *
 * These are immutable oracles: if the implementation disagrees, the
 * implementation is wrong.
 *
 * The expected legal/illegal pairs are transcribed from the canonical NMOS 6502
 * opcode matrix; the ICE code/message are fixed accordingly.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, makeSpan, IceCode } from "@blend65/core";
import type { InstrStream } from "./stream.js";

import { instr } from "./stream.js";
import { symbolRef, none } from "./operand.js";
import { validateStream, isLegalMode } from "./validate.js";

/** Build a single-entry code stream for a (opcode, mode, operand) under test. */
function streamOf(entries: InstrStream["entries"]): InstrStream {
  return { symbol: "test", segment: "code", entries };
}

describe("Specification: validateStream — legal NMOS streams (ST-V1, ST-V6)", () => {
  // the canonical 8-bit add validates clean on NMOS
  it("should accept the LDA/CLC/ADC/STA add sequence on nmos6502 (ST-V1)", () => {
    const bag = createDiagnosticBag();
    validateStream(
      streamOf([
        instr("LDA", "Absolute", symbolRef("a")),
        instr("CLC", "Implied", none()),
        instr("ADC", "Absolute", symbolRef("b")),
        instr("STA", "Absolute", symbolRef("dest")),
      ]),
      "nmos6502",
      bag,
    );
    expect(bag.hasErrors()).toBe(false);
  });

  // non-instr entries have no opcode and are skipped
  it("should emit no diagnostics for a labels+directives-only stream (ST-V6)", () => {
    const bag = createDiagnosticBag();
    validateStream(
      {
        symbol: "data",
        segment: "data",
        entries: [
          { type: "label", name: "palette" },
          { type: "directive", directive: { kind: "byte", values: [0, 1, 2] } },
        ],
      },
      "nmos6502",
      bag,
    );
    expect(bag.hasErrors()).toBe(false);
  });
});

describe("Specification: validateStream — illegal pairs raise E90001 (ST-V2..V4)", () => {
  // illegal opcode+mode is an E90001 ICE with a named message
  it("should raise E90001 with a descriptive message for JSR ZeroPage (ST-V2)", () => {
    const bag = createDiagnosticBag();
    validateStream(
      streamOf([instr("JSR", "ZeroPage", symbolRef("f"))]),
      "nmos6502",
      bag,
    );
    const errors = bag.getErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe(IceCode.Unexpected);
    expect(errors[0].message).toBe("illegal opcode+mode for nmos6502: JSR ZeroPage");
  });

  // LDA has no Implied mode
  it("should raise an E90001 ICE for LDA Implied (ST-V3)", () => {
    const bag = createDiagnosticBag();
    validateStream(streamOf([instr("LDA", "Implied", none())]), "nmos6502", bag);
    expect(bag.hasErrors()).toBe(true);
    expect(bag.getErrors()[0].code).toBe(IceCode.Unexpected);
  });

  // STZ is a 65C02-only opcode, illegal on NMOS
  it("should raise an E90001 ICE for STZ Absolute on nmos6502 (ST-V4)", () => {
    const bag = createDiagnosticBag();
    validateStream(streamOf([instr("STZ", "Absolute", symbolRef("scr"))]), "nmos6502", bag);
    expect(bag.hasErrors()).toBe(true);
    expect(bag.getErrors()[0].code).toBe(IceCode.Unexpected);
  });
});

describe("Specification: validateStream — variant gating & span (ST-V5, ST-V7)", () => {
  // STZ is legal on 65C02
  it("should accept STZ Absolute on wdc65c02 (ST-V5)", () => {
    const bag = createDiagnosticBag();
    validateStream(streamOf([instr("STZ", "Absolute", symbolRef("scr"))]), "wdc65c02", bag);
    expect(bag.hasErrors()).toBe(false);
  });

  // the ICE carries the offending instruction's source span
  it("should attach the instruction's sourceSpan to the emitted ICE (ST-V7)", () => {
    const span = makeSpan(0, 4, 8);
    const bag = createDiagnosticBag();
    validateStream(
      streamOf([instr("JSR", "ZeroPage", symbolRef("f"), span)]),
      "nmos6502",
      bag,
    );
    expect(bag.getErrors()[0].primarySpan).toEqual(span);
  });
});

describe("Specification: isLegalMode predicate (ST-V8..V10)", () => {
  // legal/illegal pair predicate
  it("should classify LDA Immediate legal and JSR ZeroPage illegal on NMOS (ST-V8)", () => {
    expect(isLegalMode("LDA", "Immediate", "nmos6502")).toBe(true);
    expect(isLegalMode("JSR", "ZeroPage", "nmos6502")).toBe(false);
  });

  // BRA is 65C02-only
  it("should gate BRA Relative to wdc65c02 (ST-V9)", () => {
    expect(isLegalMode("BRA", "Relative", "nmos6502")).toBe(false);
    expect(isLegalMode("BRA", "Relative", "wdc65c02")).toBe(true);
  });

  // the 65C02 (zp) ZeroPageIndirect mode is gated
  it("should gate LDA ZeroPageIndirect to wdc65c02 (ST-V10)", () => {
    expect(isLegalMode("LDA", "ZeroPageIndirect", "nmos6502")).toBe(false);
    expect(isLegalMode("LDA", "ZeroPageIndirect", "wdc65c02")).toBe(true);
  });
});
