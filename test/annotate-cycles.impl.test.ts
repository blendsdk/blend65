/**
 * Implementation tests for annotate-cycles' block construction and listing
 * rendering, using the real report parser + cycle-range math on canned
 * report text.
 */

import { describe, expect, it } from "vitest";
import { cycleRange, parseReportFile } from "@blend65/compiler";

import { blocksOf, renderAnnotated } from "../scripts/annotate-cycles.mjs";

/** A small stream: entry block, a loop (branch target), and a tail block. */
const REPORT = [
  "     4  0801 a205                       ldx #$05",
  "     5  0803 ca                 loop    dex",
  "     6  0804 d0fd                       bne loop",
  "     7  0806 60                         rts",
].join("\n");

describe("Implementation: block construction", () => {
  it("should start blocks at branch targets and end them at transfers", () => {
    const instructions = parseReportFile(REPORT, "r.report");
    const blocks = blocksOf(instructions);
    expect(blocks.map((b: { address: number }[]) => b.map((i) => i.address))).toEqual([
      [0x0801],
      [0x0803, 0x0804],
      [0x0806],
    ]);
  });

  it("should keep a trailing straight-line block open until the stream ends", () => {
    const instructions = parseReportFile(
      ["     4  0801 a205                       ldx #$05", "     5  0803 ca                 dex"].join("\n"),
      "r.report",
    );
    // No transfers at all: one block covering the whole stream.
    expect(blocksOf(instructions)).toHaveLength(1);
  });
});

describe("Implementation: listing rendering", () => {
  it("should annotate fixed costs as single numbers and variable costs as ranges", () => {
    const instructions = parseReportFile(REPORT, "r.report");
    const listing = renderAnnotated(instructions, cycleRange);

    expect(listing).toMatch(/\$0801\s+LDX #\$05\s+2\b/);
    expect(listing).toMatch(/\$0804\s+BNE \$0803\s+2-3/);
    // Loop block: dex (2) + bne (2-3) = 4-5; tail block: rts = 6.
    expect(listing).toContain("block total: 4-5");
    expect(listing).toContain("block total: 6-6");
  });
});
