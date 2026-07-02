/**
 * Specification tests for the RD-07a Instr model (ST-M1..M12).
 *
 * Derived EXCLUSIVELY from `requirements/RD-07-codegen-instr.md` (R2–R13),
 * the component spec `03-01-instr-model.md`, and the Ambiguity Register
 * (D3/D8/D9). These are immutable oracles (testing.md Rule 10): if the
 * implementation disagrees, the implementation is wrong — not these tests.
 *
 * The expected record shapes are transcribed from RD-07 §4.1–§4.3 as documented
 * in 03-01; no implementation logic was consulted to derive them.
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

describe("Specification: Instr model — opcode/mode tuples (ST-M1..M3)", () => {
  // Source: RD-07 R3 / 03-01 — OPCODES = 56 NMOS + 9 65C02, no duplicates.
  // RD-17 R2 added `WAI` to the 65C02 set (65 total; was 64/8 pre-RD-17).
  it("should expose 65 unique opcodes (56 NMOS + 9 65C02) (ST-M1)", () => {
    expect(OPCODES).toHaveLength(65);
    expect(new Set(OPCODES).size).toBe(65);
  });

  // Source: RD-07 R3 / AR D3 — partitions are 56/9, disjoint; STZ/BRA gated.
  // RD-17 R2 grew the 65C02 partition from 8 to 9 (WAI).
  it("should partition opcodes into disjoint 56/9 NMOS/65C02 sets (ST-M2)", () => {
    expect(NMOS_OPCODES).toHaveLength(56);
    expect(W65C02_OPCODES).toHaveLength(9);

    // Disjoint: no opcode appears in both sets.
    const nmos = new Set<string>(NMOS_OPCODES);
    for (const op of W65C02_OPCODES) {
      expect(nmos.has(op)).toBe(false);
    }

    // 65C02-only mnemonics are absent from the NMOS set, present in the 65C02 set.
    expect(nmos.has("STZ")).toBe(false);
    expect(nmos.has("BRA")).toBe(false);
    expect(new Set<string>(W65C02_OPCODES).has("STZ")).toBe(true);
    expect(new Set<string>(W65C02_OPCODES).has("BRA")).toBe(true);
  });

  // Source: RD-07 R4 / AR D8 — exactly 14 modes in the documented order
  it("should list exactly the 14 addressing modes in documented order (ST-M3)", () => {
    expect(ADDRESSING_MODES).toEqual([
      "Implied",
      "Accumulator",
      "Immediate",
      "ZeroPage",
      "ZeroPageX",
      "ZeroPageY",
      "Absolute",
      "AbsoluteX",
      "AbsoluteY",
      "Indirect",
      "IndirectX",
      "IndirectY",
      "Relative",
      "ZeroPageIndirect",
    ]);
  });
});

describe("Specification: Instr model — operand constructors (ST-M4..M8)", () => {
  // Source: RD-07 R9 / 03-01
  it("should build an immediate operand verbatim (ST-M4)", () => {
    expect(imm8(0x42)).toEqual({ kind: "immediate", value: 0x42 });
  });

  // Source: RD-07 R10 / 03-01 — bare symbolRef has no `offset` key, byteSelect defaults "none"
  it("should build a bare symbolRef with byteSelect 'none' and no offset key (ST-M5)", () => {
    const operand = symbolRef("a");
    expect(operand).toEqual({ kind: "symbolRef", name: "a", byteSelect: "none" });
    expect("offset" in operand).toBe(false);
  });

  // Source: RD-07 R10 — offset is attached when supplied
  it("should attach offset when supplied, keeping byteSelect 'none' (ST-M6)", () => {
    expect(symbolRef("p", { offset: 2 })).toEqual({
      kind: "symbolRef",
      name: "p",
      offset: 2,
      byteSelect: "none",
    });
  });

  // Source: RD-07 R13 — byte-select low/high
  it("should record byteSelect 'low' when requested (ST-M7)", () => {
    expect(symbolRef("b", { byteSelect: "low" })).toEqual({
      kind: "symbolRef",
      name: "b",
      byteSelect: "low",
    });
  });

  // Source: RD-07 R8/R11/R12 — none/labelRef/zpSlot records
  it("should build none, labelRef and zpSlot records (ST-M8)", () => {
    expect(none()).toEqual({ kind: "none" });
    expect(labelRef("loop")).toEqual({ kind: "labelRef", label: "loop" });
    expect(zpSlot("ptr")).toEqual({ kind: "zpSlot", name: "ptr" });
  });
});

describe("Specification: Instr model — stream entries (ST-M9..M11)", () => {
  // Source: RD-07 R2 / 03-01 — instr entry, no sourceSpan key when omitted (D9 field names)
  it("should build an instr entry with no sourceSpan key when omitted (ST-M9)", () => {
    const entry = instr("LDA", "Absolute", symbolRef("a"));
    expect(entry).toEqual({
      type: "instr",
      opcode: "LDA",
      mode: "Absolute",
      operand: { kind: "symbolRef", name: "a", byteSelect: "none" },
    });
    expect("sourceSpan" in entry).toBe(false);
  });

  // Source: RD-07 R2/R50 — sourceSpan attached when supplied
  it("should attach sourceSpan when supplied (ST-M10)", () => {
    const span = makeSpan(0, 4, 8);
    const entry = instr("LDA", "Absolute", symbolRef("a"), span);
    expect(entry).toEqual({
      type: "instr",
      opcode: "LDA",
      mode: "Absolute",
      operand: { kind: "symbolRef", name: "a", byteSelect: "none" },
      sourceSpan: span,
    });
  });

  // Source: RD-07 R5/R6 — label and directive entries
  it("should build label and directive entries (ST-M11)", () => {
    expect(label("x")).toEqual({ type: "label", name: "x" });
    expect(directive({ kind: "byte", values: [1] })).toEqual({
      type: "directive",
      directive: { kind: "byte", values: [1] },
    });
  });
});

describe("Specification: Instr model — type guards (ST-M12)", () => {
  // Source: 03-01 — guards narrow correctly and return boolean for every kind
  it("should narrow StreamEntry guards correctly (ST-M12)", () => {
    const i = instr("RTS", "Implied", none());
    const l = label("x");
    const d = directive({ kind: "byte", values: [1] });

    expect(isInstr(i)).toBe(true);
    expect(isInstr(l)).toBe(false);
    expect(isInstr(d)).toBe(false);

    expect(isLabel(l)).toBe(true);
    expect(isLabel(i)).toBe(false);
    expect(isLabel(d)).toBe(false);

    expect(isDirective(d)).toBe(true);
    expect(isDirective(i)).toBe(false);
    expect(isDirective(l)).toBe(false);
  });

  // Source: 03-01 — operand guards narrow correctly across all operand kinds
  it("should narrow InstrOperand guards correctly (ST-M12)", () => {
    expect(isImmediateOperand(imm8(1))).toBe(true);
    expect(isImmediateOperand(none())).toBe(false);

    expect(isSymbolRef(symbolRef("a"))).toBe(true);
    expect(isSymbolRef(imm8(1))).toBe(false);

    expect(isLabelRef(labelRef("l"))).toBe(true);
    expect(isLabelRef(zpSlot("z"))).toBe(false);

    expect(isZpSlot(zpSlot("z"))).toBe(true);
    expect(isZpSlot(labelRef("l"))).toBe(false);
  });
});
