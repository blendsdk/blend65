/**
 * Implementation tests for the Instr model.
 *
 * These cover edge cases and internal invariants beyond the specification
 * oracles (instr-model.spec.test.ts): constructor optional-field omission,
 * tuple uniqueness/disjointness, and guard totality across every kind. Unlike
 * the specification tests, these are allowed to consult the implementation
 * itself, and they harden the model against silent regressions.
 */

import { describe, expect, it } from "vitest";
import { makeSpan } from "@blend65/core";

import { OPCODES, NMOS_OPCODES, W65C02_OPCODES } from "./opcode.js";
import { ADDRESSING_MODES } from "./addressing-mode.js";
import {
  none,
  imm8,
  symbolRef,
  labelRef,
  zpSlot,
  isImmediateOperand,
  isSymbolRef,
  isLabelRef,
  isZpSlot,
} from "./operand.js";
import {
  instr,
  label,
  directive,
  isInstr,
  isLabel,
  isDirective,
} from "./stream.js";
import type { InstrOperand } from "./operand.js";
import type { StreamEntry } from "./stream.js";

describe("opcode/addressing-mode tuples", () => {
  it("should keep NMOS and 65C02 opcode sets disjoint and union-complete", () => {
    const nmos = new Set<string>(NMOS_OPCODES);
    const cmos = new Set<string>(W65C02_OPCODES);
    // No overlap.
    for (const op of cmos) {
      expect(nmos.has(op)).toBe(false);
    }
    // OPCODES is exactly the concatenation, no extras/dupes.
    expect(OPCODES).toEqual([...NMOS_OPCODES, ...W65C02_OPCODES]);
    expect(new Set(OPCODES).size).toBe(OPCODES.length);
  });

  it("should keep addressing modes unique", () => {
    expect(new Set(ADDRESSING_MODES).size).toBe(ADDRESSING_MODES.length);
  });

  it("should keep ZeroPageIndirect distinct from Indirect", () => {
    expect(ADDRESSING_MODES).toContain("Indirect");
    expect(ADDRESSING_MODES).toContain("ZeroPageIndirect");
  });
});

describe("symbolRef optional-field handling", () => {
  it("should omit offset when offset is explicitly undefined", () => {
    const operand = symbolRef("a", { byteSelect: "low" });
    expect("offset" in operand).toBe(false);
  });

  it("should attach offset 0 when explicitly supplied", () => {
    // offset: 0 is a real, supplied value — it must be kept, not dropped.
    const operand = symbolRef("a", { offset: 0 });
    expect(operand).toEqual({ kind: "symbolRef", name: "a", offset: 0, byteSelect: "none" });
  });

  it("should default byteSelect to 'none' when only offset is supplied", () => {
    const operand = symbolRef("a", { offset: 3 });
    if (operand.kind === "symbolRef") {
      expect(operand.byteSelect).toBe("none");
    }
  });

  it("should preserve byteSelect 'high'", () => {
    expect(symbolRef("a", { byteSelect: "high" })).toEqual({
      kind: "symbolRef",
      name: "a",
      byteSelect: "high",
    });
  });
});

describe("imm8 stores values verbatim (no range check, H5)", () => {
  it("should store an out-of-range value verbatim", () => {
    // The model is total: imm8(300) must not throw or clamp (range is 07b's job).
    expect(imm8(300)).toEqual({ kind: "immediate", value: 300 });
  });

  it("should store negative values verbatim", () => {
    expect(imm8(-1)).toEqual({ kind: "immediate", value: -1 });
  });
});

describe("instr sourceSpan omission", () => {
  it("should omit sourceSpan when undefined", () => {
    const entry = instr("CLC", "Implied", none());
    expect("sourceSpan" in entry).toBe(false);
  });

  it("should compare equal for two spanless instrs with identical operands", () => {
    expect(instr("LDA", "Absolute", symbolRef("a"))).toEqual(
      instr("LDA", "Absolute", symbolRef("a")),
    );
  });

  it("should attach a supplied span", () => {
    const span = makeSpan(2, 10, 14);
    const entry = instr("LDA", "Absolute", symbolRef("a"), span);
    if (entry.type === "instr") {
      expect(entry.sourceSpan).toBe(span);
    }
  });
});

describe("operand guard totality", () => {
  // Every operand kind classified by every guard returns a boolean, exactly one true.
  const operands: InstrOperand[] = [
    none(),
    imm8(1),
    symbolRef("s"),
    labelRef("l"),
    zpSlot("z"),
  ];

  it("should return a boolean from every operand guard for every kind", () => {
    for (const o of operands) {
      for (const guard of [isImmediateOperand, isSymbolRef, isLabelRef, isZpSlot]) {
        expect(typeof guard(o)).toBe("boolean");
      }
    }
  });

  it("should have at most one operand guard match per operand", () => {
    for (const o of operands) {
      const matches = [isImmediateOperand, isSymbolRef, isLabelRef, isZpSlot].filter((g) =>
        g(o),
      ).length;
      // `none` matches no operand guard; the other four match exactly one.
      expect(matches).toBeLessThanOrEqual(1);
    }
  });
});

describe("stream-entry guard totality", () => {
  const entries: StreamEntry[] = [
    instr("RTS", "Implied", none()),
    label("x"),
    directive({ kind: "byte", values: [1] }),
  ];

  it("should match exactly one entry guard per entry", () => {
    for (const e of entries) {
      const matches = [isInstr, isLabel, isDirective].filter((g) => g(e)).length;
      expect(matches).toBe(1);
    }
  });
});
