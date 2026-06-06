/**
 * Specification tests for the RD-07a canonical ACME serializer (ST-S1..S23).
 *
 * Derived EXCLUSIVELY from `requirements/RD-07-codegen-instr.md` (R52–R54, R58,
 * R13), the component spec `03-03-serializer.md`, ACME syntax conventions, and
 * the Ambiguity Register (D8). These are immutable oracles (testing.md Rule 10):
 * the expected text is the ACME rendering documented in 03-03, NOT whatever the
 * serializer happens to produce.
 *
 * Per 03-03: instruction lines render `<MNEMONIC>` or `<MNEMONIC> <operand-text>`;
 * labels sit at column 0 as `name:`. These tests assert the documented *operand
 * text* (the `.trim()`med line) per ST case, and separately assert the column-0
 * vs indented distinction (ST-S13). Exact byte-for-byte indentation is pinned by
 * the Phase-4 golden snapshots.
 */

import { describe, expect, it } from "vitest";
import type { StreamEntry } from "./stream.js";
import { instr, label, directive } from "./stream.js";
import { none, imm8, symbolRef, labelRef, zpSlot } from "./operand.js";
import { printInstr, instrByteSize } from "./print-instr.js";

/** Render a single entry and return its trimmed line text. */
function textOf(entry: StreamEntry): string {
  return printInstr({ symbol: "t", segment: "code", entries: [entry] }).trim();
}

/** Render a single entry and return its raw (untrimmed) line. */
function rawLineOf(entry: StreamEntry): string {
  return printInstr({ symbol: "t", segment: "code", entries: [entry] });
}

describe("Specification: printInstr — addressing-mode operand text (ST-S1..S12b)", () => {
  it("should render Implied with no operand text (ST-S1)", () => {
    expect(textOf(instr("RTS", "Implied", none()))).toBe("RTS");
  });

  it("should render Accumulator as 'A' (ST-S2)", () => {
    expect(textOf(instr("ASL", "Accumulator", none()))).toBe("ASL A");
  });

  it("should render Immediate hex with # prefix (ST-S3)", () => {
    expect(textOf(instr("LDA", "Immediate", imm8(0x42)))).toBe("LDA #$42");
  });

  it("should render Immediate low-byte select as #<sym (ST-S4)", () => {
    expect(textOf(instr("LDA", "Immediate", symbolRef("buf", { byteSelect: "low" })))).toBe(
      "LDA #<buf",
    );
  });

  it("should render Immediate high-byte select as #>sym (ST-S5)", () => {
    expect(textOf(instr("LDA", "Immediate", symbolRef("buf", { byteSelect: "high" })))).toBe(
      "LDA #>buf",
    );
  });

  it("should render Absolute as a bare symbol (ST-S6)", () => {
    expect(textOf(instr("LDA", "Absolute", symbolRef("scr")))).toBe("LDA scr");
  });

  it("should render AbsoluteX with ,X (ST-S7)", () => {
    expect(textOf(instr("LDA", "AbsoluteX", symbolRef("scr")))).toBe("LDA scr,X");
  });

  it("should render IndirectY as (ptr),Y (ST-S8)", () => {
    expect(textOf(instr("LDA", "IndirectY", zpSlot("ptr")))).toBe("LDA (ptr),Y");
  });

  it("should render IndirectX as (ptr,X) (ST-S9)", () => {
    expect(textOf(instr("LDA", "IndirectX", zpSlot("ptr")))).toBe("LDA (ptr,X)");
  });

  it("should render Indirect as (vec) (ST-S10)", () => {
    expect(textOf(instr("JMP", "Indirect", symbolRef("vec")))).toBe("JMP (vec)");
  });

  it("should render a symbolRef offset as name+N (ST-S11)", () => {
    expect(textOf(instr("LDA", "Absolute", symbolRef("player", { offset: 2 })))).toBe(
      "LDA player+2",
    );
  });

  it("should render Relative as a bare label (ST-S12)", () => {
    expect(textOf(instr("BNE", "Relative", labelRef("loop")))).toBe("BNE loop");
  });

  it("should render 65C02 ZeroPageIndirect as (ptr), distinct from Indirect (ST-S12b)", () => {
    expect(textOf(instr("LDA", "ZeroPageIndirect", zpSlot("ptr")))).toBe("LDA (ptr)");
  });
});

describe("Specification: printInstr — labels & directives (ST-S13..S20)", () => {
  it("should render a label at column 0 with a colon (ST-S13)", () => {
    expect(rawLineOf(label("loop"))).toBe("loop:");
  });

  it("should render a byte directive as !byte with 2-digit hex (ST-S14)", () => {
    expect(textOf(directive({ kind: "byte", values: [0, 1, 2, 3] }))).toBe(
      "!byte $00, $01, $02, $03",
    );
  });

  it("should render a word directive as !word with 4-digit hex (ST-S15)", () => {
    expect(textOf(directive({ kind: "word", values: [0x0801] }))).toBe("!word $0801");
  });

  it("should render an origin directive as * = $XXXX (ST-S16)", () => {
    expect(textOf(directive({ kind: "origin", address: 0x0801 }))).toBe("* = $0801");
  });

  it("should render a symbolDef directive as name = $XXXX (ST-S17)", () => {
    expect(textOf(directive({ kind: "symbolDef", name: "vic", value: 0xd000 }))).toBe(
      "vic = $D000",
    );
  });

  it("should render a fill directive as !fill count, $XX (ST-S18)", () => {
    expect(textOf(directive({ kind: "fill", count: 256, value: 0 }))).toBe("!fill 256, $00");
  });

  it("should render a text directive as !text \"...\" (ST-S19)", () => {
    expect(textOf(directive({ kind: "text", text: "HI" }))).toBe('!text "HI"');
  });

  it("should render an outputFile directive as !to \"name\", format (ST-S20)", () => {
    expect(textOf(directive({ kind: "outputFile", name: "out.prg", format: "cbm" }))).toBe(
      '!to "out.prg", cbm',
    );
  });
});

describe("Specification: printInstr — determinism (ST-S21)", () => {
  it("should produce byte-identical output across repeated calls (ST-S21)", () => {
    const stream = {
      symbol: "add",
      segment: "code" as const,
      entries: [
        instr("LDA", "Absolute", symbolRef("a")),
        instr("CLC", "Implied", none()),
        instr("ADC", "Absolute", symbolRef("b")),
        instr("STA", "Absolute", symbolRef("dest")),
      ],
    };
    expect(printInstr(stream)).toBe(printInstr(stream));
  });
});

describe("Specification: instrByteSize (ST-S22..S23)", () => {
  it("should size Immediate=2, Absolute=3, Implied=1 (ST-S22)", () => {
    expect(instrByteSize(instr("LDA", "Immediate", imm8(1)))).toBe(2);
    expect(instrByteSize(instr("LDA", "Absolute", symbolRef("a")))).toBe(3);
    expect(instrByteSize(instr("RTS", "Implied", none()))).toBe(1);
  });

  it("should size ZeroPageIndirect=2 and Indirect=3 (ST-S22b)", () => {
    expect(instrByteSize(instr("LDA", "ZeroPageIndirect", zpSlot("ptr")))).toBe(2);
    expect(instrByteSize(instr("JMP", "Indirect", symbolRef("vec")))).toBe(3);
  });

  it("should size directives and labels by payload (ST-S23)", () => {
    expect(instrByteSize(directive({ kind: "byte", values: [1, 2, 3] }))).toBe(3);
    expect(instrByteSize(directive({ kind: "word", values: [1, 2] }))).toBe(4);
    expect(instrByteSize(directive({ kind: "fill", count: 256, value: 0 }))).toBe(256);
    expect(instrByteSize(label("x"))).toBe(0);
  });
});
