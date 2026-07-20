/**
 * Specification tests for the canonical ACME serializer.
 *
 * Derived EXCLUSIVELY from the ACME syntax conventions. These are immutable
 * oracles: the expected text is the documented ACME rendering, NOT whatever
 * the serializer happens to produce.
 *
 * Instruction lines render `<MNEMONIC>` or `<MNEMONIC> <operand-text>`;
 * labels sit at column 0 as `name:`. These tests assert the documented *operand
 * text* (the `.trim()`med line) per case, and separately assert the column-0
 * vs indented distinction. Exact byte-for-byte indentation is pinned by
 * the golden snapshots.
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

  it("should render Accumulator as the bare mnemonic (ST-S2)", () => {
    // ACME's accumulator addressing is the mnemonic alone; an earlier
    // revision pinned an explicit "A" operand, which ACME parses as an
    // undefined symbol — refuted the first time an accumulator op reached
    // the real assembler.
    expect(textOf(instr("ASL", "Accumulator", none()))).toBe("ASL");
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

describe("Specification: printInstr — the align directive (ST-C1..ST-C4)", () => {
  /** A page-alignment directive: 256-byte boundary, zero fill. */
  const pageAlign = directive({ kind: "align", boundary: 256, fill: 0 });

  it("should render page alignment as ACME's bitmask form !align 255, 0, 0 (ST-C1)", () => {
    // ACME's directive is `!align andValue, equalValue [, fill]` — a BITMASK,
    // not a modulus. `!align 256, 0` assembles cleanly and aligns nothing, so
    // the rendered mask must be boundary - 1. Verified against ACME 0.97.
    expect(textOf(pageAlign)).toBe("!align 255, 0, 0");
  });

  it("should size the align directive as 0 bytes (ST-C2)", () => {
    // The padding an alignment inserts depends on the address it lands at,
    // which is unknowable before the assembler resolves it. Sizing it 0 makes
    // whole-program size arithmetic a lower bound rather than a wrong number.
    expect(instrByteSize(pageAlign)).toBe(0);
  });

  it("should render the align directive at column 0, not instruction indent (ST-C3)", () => {
    // Conventionally unindented, like `* =`. Nothing in the type system forces
    // this: the column-0 predicate is a boolean expression over known kinds,
    // so an unhandled variant silently renders at instruction indent instead.
    expect(rawLineOf(pageAlign)).toBe("!align 255, 0, 0");
  });

  it("should give the align directive its own line at column 0 within a stream (ST-C4)", () => {
    const lines = printInstr({
      symbol: "__data_M_T",
      segment: "data",
      entries: [pageAlign, label("__data_M_T"), directive({ kind: "byte", values: [1, 2] })],
    }).split("\n");
    expect(lines).toContain("!align 255, 0, 0");
  });
});
