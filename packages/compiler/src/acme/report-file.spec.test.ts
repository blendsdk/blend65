/**
 * Specification tests for the ACME report-file parser.
 *
 * Derived from ACME's `--report` output shape (line number, final hex
 * address, emitted hex bytes, source text) — validated against real ACME
 * output, not against the parser implementation. The defining property: the
 * addressing mode comes from the EMITTED BYTES, never from the operand text —
 * `lda some_sym` may be zeropage or absolute depending only on what ACME
 * encoded, and the two are indistinguishable in source.
 */

import { describe, expect, it } from "vitest";

import { parseReportFile } from "./report-file.js";

describe("Specification: ACME report parsing — modes come from bytes, not text", () => {
  it("should disambiguate zeropage from absolute on syntactically identical operands", () => {
    // Both operands are bare symbols — textually identical shapes. Only the
    // emitted opcode byte tells them apart: $A5 = LDA zeropage, $AD = LDA abs.
    const report = [
      "; ******** Source: main.asm",
      "     1                          zp_sym = $0002",
      "     2                          abs_sym = $0200",
      "     5  0801 a502                       lda zp_sym",
      "     6  0803 ad0002                     lda abs_sym",
      "     7  0806 60                         rts",
    ].join("\n");

    const records = parseReportFile(report, "main.report");
    expect(records).toHaveLength(3);

    expect(records[0]).toMatchObject({
      address: 0x0801,
      opcode: "LDA",
      mode: "ZeroPage",
      operand: 0x02,
    });
    expect(Array.from(records[0].bytes)).toEqual([0xa5, 0x02]);

    expect(records[1]).toMatchObject({
      address: 0x0803,
      opcode: "LDA",
      mode: "Absolute",
      operand: 0x0200,
    });
    expect(Array.from(records[1].bytes)).toEqual([0xad, 0x00, 0x02]);

    expect(records[2]).toMatchObject({ address: 0x0806, opcode: "RTS", mode: "Implied" });
  });

  it("should skip data lines and label-only lines without inventing instructions", () => {
    const report = [
      "     4                          start",
      "     5  0801 a900                       lda #$00",
      "    15  0803 010203             !byte $01, $02, $03",
      "    16  0806 eaeaeaea           !fill 4, $ea",
      "    17  080a 60                 done    rts",
    ].join("\n");

    const records = parseReportFile(report, "main.report");
    // Only the two instructions — the !byte/!fill bytes are data, and the
    // labeled RTS line still parses through its leading label.
    expect(records.map((r) => r.opcode)).toEqual(["LDA", "RTS"]);
    expect(records[1].address).toBe(0x080a);
  });

  it("should resolve a branch operand to its target address", () => {
    const report = [
      "    12  0814 ca                 loop    dex",
      "    13  0815 d0fd                       bne loop",
    ].join("\n");

    const records = parseReportFile(report, "main.report");
    // $FD = -3 from the byte after the branch: $0817 - 3 = $0814.
    expect(records[1]).toMatchObject({ opcode: "BNE", mode: "Relative", operand: 0x0814 });
  });

  it("should throw naming the file and line on an unparseable bytes column", () => {
    const report = [
      "     5  0801 a900                       lda #$00",
      "     6  0803 zq11                       lda zp_sym",
    ].join("\n");

    expect(() => parseReportFile(report, "broken.report")).toThrowError(/broken\.report.*line 6/s);
  });

  it("should throw naming the file and line when bytes and mnemonic disagree", () => {
    // $A9 is LDA immediate — a source column claiming STA is a corrupt report.
    const report = ["     5  0801 a900                       sta #$00"].join("\n");

    expect(() => parseReportFile(report, "broken.report")).toThrowError(/broken\.report.*line 5/s);
  });
});
