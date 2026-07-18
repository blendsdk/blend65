/**
 * Implementation tests for the ACME report parser: format edge cases
 * (truncated data lines, continuation lines, case-insensitivity), the
 * cycle-range math (branch page-cross exactness, indexed-read variance),
 * and a live round-trip against real ACME when it is installed.
 */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { cycleRange, parseReportFile } from "./report-file.js";

/** Whether real ACME is on PATH (gates the round-trip suite). */
function hasAcme(): boolean {
  try {
    return execFileSync("which", ["acme"], { encoding: "utf8" }).trim().length > 0;
  } catch {
    return false;
  }
}

describe("Implementation: report parsing edge cases", () => {
  it("should skip a truncated data line but reject a truncated instruction line", () => {
    const truncatedData = ['    15  0818 48454c4c4f204336...  !text "HELLO C64!"'].join("\n");
    expect(parseReportFile(truncatedData, "r.report")).toHaveLength(0);

    const truncatedInstr = ["    15  0818 a9454c4c4f204336...          lda #$45"].join("\n");
    expect(() => parseReportFile(truncatedInstr, "r.report")).toThrowError(/r\.report.*line 15/s);
  });

  it("should skip continuation lines that carry bytes but no source", () => {
    const report = ["    16  081b eaeaeaea           !fill 4, $ea", "    16  081f eaeaeaea"].join("\n");
    expect(parseReportFile(report, "r.report")).toHaveLength(0);
  });

  it("should parse mnemonics and hex case-insensitively", () => {
    const report = ["     5  0801 AD0002                     LDA abs_sym"].join("\n");
    const [record] = parseReportFile(report, "r.report");
    expect(record).toMatchObject({ opcode: "LDA", mode: "Absolute", operand: 0x0200 });
  });

  it("should reject an instruction whose byte count disagrees with its mode", () => {
    // $AD is LDA absolute (3 bytes) — a 2-byte line is corrupt.
    const report = ["     5  0801 ad02                       lda abs_sym"].join("\n");
    expect(() => parseReportFile(report, "r.report")).toThrowError(/r\.report.*line 5/s);
  });
});

describe("Implementation: cycle-range math", () => {
  it("should charge the branch page-cross penalty only when the target crosses", () => {
    // BNE at $08FD: fall-through $08FF (page $08), target $08F0 — same page.
    const samePage = parseReportFile(["    9  08fd d0f1                       bne loop"].join("\n"), "r")[0];
    expect(cycleRange(samePage)).toEqual({ min: 2, max: 3 });

    // BNE at $08FE: fall-through $0900 (page $09), target $08F1 — crosses.
    const crossing = parseReportFile(["    9  08fe d0f1                       bne loop"].join("\n"), "r")[0];
    expect(cycleRange(crossing)).toEqual({ min: 2, max: 4 });
  });

  it("should keep the indexed-read penalty as max-only and fixed writes fixed", () => {
    const indexedRead = parseReportFile(["    5  0801 bd0004                     lda table,x"].join("\n"), "r")[0];
    expect(cycleRange(indexedRead)).toEqual({ min: 4, max: 5 });

    const fixedWrite = parseReportFile(["    6  0804 9d0004                     sta table,x"].join("\n"), "r")[0];
    expect(cycleRange(fixedWrite)).toEqual({ min: 5, max: 5 });
  });
});

describe.skipIf(!hasAcme())("Implementation: round-trip against real ACME", () => {
  it("should classify a real report across addressing-mode families", () => {
    const dir = mkdtempSync(join(tmpdir(), "b65-report-rt-"));
    try {
      const asmPath = join(dir, "rt.asm");
      const reportPath = join(dir, "rt.report");
      writeFileSync(
        asmPath,
        [
          // Two hex digits: ACME's leading-zeros convention makes the symbol
          // 8-bit, so the zeropage and (zp),y encodings are actually chosen.
          "zp_var = $02",
          "abs_var = $0200",
          "* = $0801",
          "start  lda #$05",
          "       lda zp_var",
          "       lda abs_var",
          "       sta abs_var,x",
          "       lda (zp_var),y",
          "loop   dex",
          "       bne loop",
          "       jmp (abs_var)",
          "!byte $01, $02",
        ].join("\n"),
        "utf8",
      );
      execFileSync(
        "acme",
        ["--cpu", "6510", "--format", "cbm", "--report", reportPath, "-o", join(dir, "rt.prg"), asmPath],
        { stdio: "pipe" },
      );
      const records = parseReportFile(readFileSync(reportPath, "utf8"), reportPath);
      expect(records.map((r) => `${r.opcode} ${r.mode}`)).toEqual([
        "LDA Immediate",
        "LDA ZeroPage",
        "LDA Absolute",
        "STA AbsoluteX",
        "LDA IndirectY",
        "DEX Implied",
        "BNE Relative",
        "JMP Indirect",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
