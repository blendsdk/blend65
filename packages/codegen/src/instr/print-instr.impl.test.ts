/**
 * Implementation tests for the RD-07a canonical serializer.
 *
 * These cover edge cases and internals beyond the specification oracles
 * (print-instr.spec.test.ts): the empty stream, labels/directives-only streams,
 * multi-line joining, byte-select on bare symbols, and full-coverage byte sizing
 * across every addressing mode (exercising the exhaustive `never` arms).
 */

import { describe, expect, it } from "vitest";
import { ADDRESSING_MODES } from "./addressing-mode.js";
import type { AddressingMode } from "./addressing-mode.js";
import { instr, label, directive } from "./stream.js";
import { none, imm8, symbolRef, zpSlot } from "./operand.js";
import { printInstr, instrByteSize } from "./print-instr.js";

describe("printInstr edge cases", () => {
  it("should render an empty stream to the empty string", () => {
    expect(printInstr({ symbol: "empty", segment: "code", entries: [] })).toBe("");
  });

  it("should render a labels+directives-only stream", () => {
    const text = printInstr({
      symbol: "palette",
      segment: "data",
      entries: [label("palette"), directive({ kind: "byte", values: [0, 255] })],
    });
    expect(text).toBe("palette:\n    !byte $00, $FF");
  });

  it("should join multiple entries with newlines and no trailing newline", () => {
    const text = printInstr({
      symbol: "t",
      segment: "code",
      entries: [instr("CLC", "Implied", none()), instr("RTS", "Implied", none())],
    });
    expect(text).toBe("    CLC\n    RTS");
    expect(text.endsWith("\n")).toBe(false);
  });

  it("should mask immediate values to 8-bit hex deterministically", () => {
    const text = printInstr({
      symbol: "t",
      segment: "code",
      entries: [instr("LDA", "Immediate", imm8(0x1234))],
    });
    // 0x1234 & 0xFF === 0x34
    expect(text.trim()).toBe("LDA #$34");
  });

  it("should render byte-select on a bare absolute symbol with offset", () => {
    const text = printInstr({
      symbol: "t",
      segment: "code",
      entries: [instr("LDA", "Immediate", symbolRef("buf", { byteSelect: "high", offset: 4 }))],
    });
    expect(text.trim()).toBe("LDA #>buf+4");
  });
});

describe("instrByteSize across all modes", () => {
  // Documented operand-byte counts per mode (03-03 / Ch 11 §6); total = 1 + this.
  const expectedTotal: Record<AddressingMode, number> = {
    Implied: 1,
    Accumulator: 1,
    Immediate: 2,
    ZeroPage: 2,
    ZeroPageX: 2,
    ZeroPageY: 2,
    Absolute: 3,
    AbsoluteX: 3,
    AbsoluteY: 3,
    Indirect: 3,
    IndirectX: 2,
    IndirectY: 2,
    Relative: 2,
    ZeroPageIndirect: 2,
  };

  it("should size every addressing mode per the documented table", () => {
    for (const mode of ADDRESSING_MODES) {
      // Use a neutral operand; size depends only on the mode.
      const operand = mode === "Implied" || mode === "Accumulator" ? none() : zpSlot("p");
      expect(instrByteSize(instr("NOP", mode, operand)), `mode ${mode}`).toBe(
        expectedTotal[mode],
      );
    }
  });

  it("should size a text directive by its character length", () => {
    expect(instrByteSize(directive({ kind: "text", text: "HELLO" }))).toBe(5);
  });

  it("should size origin/symbolDef/outputFile directives as 0", () => {
    expect(instrByteSize(directive({ kind: "origin", address: 0x0801 }))).toBe(0);
    expect(instrByteSize(directive({ kind: "symbolDef", name: "x", value: 1 }))).toBe(0);
    expect(instrByteSize(directive({ kind: "outputFile", name: "o.prg", format: "cbm" }))).toBe(0);
  });
});
