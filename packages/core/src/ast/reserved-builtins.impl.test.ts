/**
 * Unit tests for {@link RESERVED_BUILTINS} (RD-03 FR-49, AR-3).
 *
 * Covers spec case ST-P2 from plans/rd-03-parser-ast/07-testing-strategy.md: the
 * set holds exactly the 22 universal intrinsic names from spec Ch 12 — 13 CPU
 * control (§2) + 9 memory (§3) — and excludes platform encoders (Ch 15), which are
 * not universal and parse as ordinary calls.
 */

import { describe, expect, it } from "vitest";
import { RESERVED_BUILTINS } from "./reserved-builtins.js";

describe("RESERVED_BUILTINS (ST-P2)", () => {
  const cpuControl = [
    "asm_sei",
    "asm_cli",
    "asm_pha",
    "asm_pla",
    "asm_php",
    "asm_plp",
    "asm_clc",
    "asm_sec",
    "asm_cld",
    "asm_sed",
    "asm_clv",
    "asm_nop",
    "asm_brk",
  ];
  const memory = ["peek", "poke", "peekw", "pokew", "lo", "hi", "sizeof", "offsetof", "length"];

  it("contains exactly 22 names (13 CPU control + 9 memory)", () => {
    expect(cpuControl.length).toBe(13);
    expect(memory.length).toBe(9);
    expect(RESERVED_BUILTINS.size).toBe(22);
  });

  it("contains every CPU-control intrinsic (spec Ch 12 §2)", () => {
    for (const name of cpuControl) {
      expect(RESERVED_BUILTINS.has(name), name).toBe(true);
    }
  });

  it("contains every memory intrinsic (spec Ch 12 §3)", () => {
    for (const name of memory) {
      expect(RESERVED_BUILTINS.has(name), name).toBe(true);
    }
  });

  it("excludes non-universal / unknown callees (parse as CallExpr)", () => {
    expect(RESERVED_BUILTINS.has("set_border")).toBe(false);
    expect(RESERVED_BUILTINS.has("main")).toBe(false);
    expect(RESERVED_BUILTINS.has("")).toBe(false);
  });
});
