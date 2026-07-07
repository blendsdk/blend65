/**
 * Specification tests for the Instr model.
 *
 * Derived exclusively from the specification. These are immutable oracles:
 * if the implementation disagrees, the implementation is wrong — not these
 * tests.
 *
 * The expected record shapes are transcribed directly from the specification;
 * no implementation logic was consulted to derive them.
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
  // OPCODES = 56 NMOS + 9 65C02, no duplicates. The 65C02 set includes `WAI`,
  // bringing the total to 65 (previously 64, with 8 65C02-only opcodes).
  it("should expose 65 unique opcodes (56 NMOS + 9 65C02) (ST-M1)", () => {
    expect(OPCODES).toHaveLength(65);
    expect(new Set(OPCODES).size).toBe(65);
  });

  // The NMOS/65C02 partitions are 56/9, disjoint; STZ/BRA are 65C02-only.
  // The 65C02 partition grew from 8 to 9 opcodes when `WAI` was added.
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

  // Exactly 14 addressing modes, in the documented order.
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
  it("should build an immediate operand verbatim (ST-M4)", () => {
    expect(imm8(0x42)).toEqual({ kind: "immediate", value: 0x42 });
  });

  // A bare symbolRef has no `offset` key; byteSelect defaults to "none".
  it("should build a bare symbolRef with byteSelect 'none' and no offset key (ST-M5)", () => {
    const operand = symbolRef("a");
    expect(operand).toEqual({ kind: "symbolRef", name: "a", byteSelect: "none" });
    expect("offset" in operand).toBe(false);
  });

  it("should attach offset when supplied, keeping byteSelect 'none' (ST-M6)", () => {
    expect(symbolRef("p", { offset: 2 })).toEqual({
      kind: "symbolRef",
      name: "p",
      offset: 2,
      byteSelect: "none",
    });
  });

  it("should record byteSelect 'low' when requested (ST-M7)", () => {
    expect(symbolRef("b", { byteSelect: "low" })).toEqual({
      kind: "symbolRef",
      name: "b",
      byteSelect: "low",
    });
  });

  it("should build none, labelRef and zpSlot records (ST-M8)", () => {
    expect(none()).toEqual({ kind: "none" });
    expect(labelRef("loop")).toEqual({ kind: "labelRef", label: "loop" });
    expect(zpSlot("ptr")).toEqual({ kind: "zpSlot", name: "ptr" });
  });
});

describe("Specification: Instr model — stream entries (ST-M9..M11)", () => {
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

  it("should build label and directive entries (ST-M11)", () => {
    expect(label("x")).toEqual({ type: "label", name: "x" });
    expect(directive({ kind: "byte", values: [1] })).toEqual({
      type: "directive",
      directive: { kind: "byte", values: [1] },
    });
  });
});

describe("Specification: Instr model — type guards (ST-M12)", () => {
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
