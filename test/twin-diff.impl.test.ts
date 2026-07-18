/**
 * Implementation tests for twin-diff's divergence classifier: the
 * category-assignment rules over constructed instruction streams — X/Y
 * register-family imbalances, mnemonic-count differences, mode-mix
 * differences, and the structural size rows.
 */

import { describe, expect, it } from "vitest";

import { classifyDivergences } from "../scripts/twin-diff.mjs";

/** Construct a minimal classified-instruction record. */
function instr(opcode: string, mode: string, size = 3): Record<string, unknown> {
  return { opcode, mode, address: 0x0801, bytes: new Uint8Array(size), operand: 0, line: 1 };
}

/** Repeat an instruction `n` times. */
function times(n: number, opcode: string, mode: string, size = 3): Record<string, unknown>[] {
  return Array.from({ length: n }, () => instr(opcode, mode, size));
}

describe("Implementation: divergence classifier", () => {
  it("should classify an opposite-direction X/Y family imbalance as register usage", () => {
    const generated = times(3, "LDX", "ZeroPage", 2);
    const hand = times(3, "LDY", "ZeroPage", 2);
    const rows = classifyDivergences(generated, hand, 6, 6);

    const registerRows = rows.filter((r: { category: string }) => r.category === "register usage");
    expect(registerRows).toHaveLength(1);
    // The family imbalance must NOT double-report as instruction selection.
    const selectionRows = rows.filter(
      (r: { category: string; detail: string }) =>
        r.category === "instruction selection" && /LD[XY]/.test(r.detail),
    );
    expect(selectionRows).toHaveLength(0);
  });

  it("should classify differing mnemonic counts as instruction selection", () => {
    const generated = times(5, "JMP", "Absolute");
    const hand = times(1, "JMP", "Absolute");
    const rows = classifyDivergences(generated, hand, 15, 3);
    expect(rows).toContainEqual(
      expect.objectContaining({
        category: "instruction selection",
        detail: expect.stringContaining("JMP"),
      }),
    );
  });

  it("should classify equal-count mnemonics with differing mode mixes as addressing modes", () => {
    const generated = [instr("LDA", "Absolute", 3), instr("LDA", "Absolute", 3)];
    const hand = [instr("LDA", "ZeroPage", 2), instr("LDA", "Absolute", 3)];
    const rows = classifyDivergences(generated, hand, 6, 5);
    const modeRows = rows.filter((r: { category: string }) => r.category === "addressing modes");
    expect(modeRows.length).toBeGreaterThan(0);
  });

  it("should report structural size differences as layout and data placement", () => {
    const generated = times(2, "NOP", "Implied", 1);
    const hand = times(1, "NOP", "Implied", 1);
    // generated: 2 code bytes in a 10-byte PRG (8 data); hand: 1 in 3 (2 data).
    const rows = classifyDivergences(generated, hand, 10, 3);
    expect(rows).toContainEqual(expect.objectContaining({ category: "layout" }));
    expect(rows).toContainEqual(expect.objectContaining({ category: "data placement" }));
  });

  it("should report nothing for identical streams and sizes", () => {
    const generated = [instr("LDA", "Absolute"), instr("RTS", "Implied", 1)];
    const hand = [instr("LDA", "Absolute"), instr("RTS", "Implied", 1)];
    expect(classifyDivergences(generated, hand, 4, 4)).toHaveLength(0);
  });
});
