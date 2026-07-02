/**
 * Specification tests for the RD-17 core intrinsic catalog (ST-5, ST-7).
 *
 * Derived EXCLUSIVELY from RD-17 §4.3 (the catalog table + internal T3 table),
 * frozen spec Ch 12, and R2/AR-98/AR-99 — never from reading the implementation
 * (IMMUTABLE ORACLE RULE). Written BEFORE `catalog.ts` exists (red phase).
 */

import { describe, expect, it } from "vitest";

import { RESERVED_BUILTINS } from "../ast/reserved-builtins.js";
import { W65C02_OPCODES } from "../instr-model/opcode.js";
import { CORE_INTRINSICS, RT_ROUTINES } from "./catalog.js";

/** The 13 CPU-control T1 names (spec Ch 12 §2). */
const CPU_CONTROL = [
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

/** The 9 memory T2 names (spec Ch 12 §3). */
const MEMORY = ["peek", "poke", "peekw", "pokew", "lo", "hi", "sizeof", "offsetof", "length"];

/** The full user-visible catalog: 22 Ch 12 names + the 65C02-gated `asm_wai`. */
const USER_VISIBLE = [...CPU_CONTROL, ...MEMORY, "asm_wai"];

/** The four internal operator-backing T3 routine symbols (AR-98). */
const RT_SYMBOLS = ["__rt_mul8", "__rt_mul16", "__rt_div8", "__rt_div16"];

describe("Specification: RD-17 core intrinsic catalog (ST-5)", () => {
  it("ST-5: CORE_INTRINSICS is exactly the 22 Ch 12 names + asm_wai (user-visible)", () => {
    const names = CORE_INTRINSICS.map((d) => d.name).sort();
    expect(names).toEqual([...USER_VISIBLE].sort());
  });

  it("ST-5: RT_ROUTINES is exactly the four __rt_* operator-backing symbols (AR-98)", () => {
    const names = RT_ROUTINES.map((d) => d.name).sort();
    expect(names).toEqual([...RT_SYMBOLS].sort());
    // No separate mod routine exists — `%` consumes the div remainder (AR-98).
    expect(names).not.toContain("__rt_mod8");
    expect(names).not.toContain("__rt_mod16");
  });

  it("ST-5: the four T3 routines are tier T3, 'call' lowering, with an asmModulePath", () => {
    for (const d of RT_ROUTINES) {
      expect(d.tier, d.name).toBe("T3");
      expect(d.loweringStrategy, d.name).toBe("call");
      expect(d.asmModulePath, d.name).toBeDefined();
    }
  });
});

describe("Specification: RD-17 reserved-name / opcode deltas (ST-7)", () => {
  it("ST-7: RESERVED_BUILTINS contains asm_wai and has size 23 (R2)", () => {
    expect(RESERVED_BUILTINS.has("asm_wai")).toBe(true);
    expect(RESERVED_BUILTINS.size).toBe(23);
  });

  it("ST-7: W65C02_OPCODES contains WAI (R2)", () => {
    expect((W65C02_OPCODES as readonly string[]).includes("WAI")).toBe(true);
  });
});
