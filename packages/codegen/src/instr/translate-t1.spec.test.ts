/**
 * Specification test for T1 opcode-intrinsic translation.
 *
 * Derived EXCLUSIVELY from the T1 catalog + opcode column — never from reading
 * the implementation (IMMUTABLE ORACLE RULE). Each T1 intrinsic must translate
 * to EXACTLY ONE Implied-mode `Instr` with the matching 6502 mnemonic. `asm_wai`
 * is 65C02-gated, so it is exercised on `wdc65c02`.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, createIntrinsicRegistry } from "@blend65/core";
import type { AllocationPlan } from "@blend65/core";
import type { CpuVariant } from "./stream.js";
import { isInstr } from "./stream.js";
import type { ILFunction } from "../il/cfg.js";
import type { ILInstruction } from "../il/instruction.js";
import { translateFunction } from "./translate.js";

/** A minimal empty allocation plan (T1 intrinsics need no frame/ZP state). */
const EMPTY_PLAN: AllocationPlan = {
  frames: new Map(),
  frameRegionBase: 0,
  frameRegionSize: 0,
  peakSimultaneous: 0,
  sharingSaved: 0,
  zpAllocations: [],
  zpUsed: 0,
  zpBudget: 256,
  moduleVariables: [],
  moduleVariablesSize: 0,
  stackAnalysis: {
    maxMainDepth: 0,
    maxMainStackBytes: 0,
    maxIrqDepth: 0,
    maxIrqStackBytes: 0,
    irqOverhead: 0,
    totalWorstCase: 0,
    platformBudget: 256,
    exceedsWarningThreshold: false,
  },
  symbolDefinitions: [],
  resourceData: {
    frameRegionBytes: 0,
    frameRegionPeak: 0,
    frameSharingSaved: 0,
    zpUsed: 0,
    zpBudget: 256,
    ramUsed: 0,
    ramBudget: 0,
    stackWorstCase: 0,
    stackBudget: 256,
  },
  hasErrors: false,
};

const REGISTRY = createIntrinsicRegistry();

/** Build a single-block IL function containing one `intrinsic` op for `name`. */
function fnWithIntrinsic(name: string): ILFunction {
  const descriptor = REGISTRY.get(name);
  if (descriptor === undefined) throw new Error(`no descriptor for ${name}`);
  const ins: ILInstruction = { op: "intrinsic", name, args: [], descriptor };
  return {
    name: "M.f",
    params: [],
    returnType: "void",
    blocks: [{ label: "_entry", instructions: [ins], terminator: { kind: "ret" } }],
    tempCount: 0,
    isInterrupt: false,
  };
}

/** The 13 ambient T1 names and their expected 6502 mnemonics. */
const T1_CASES: ReadonlyArray<readonly [string, string]> = [
  ["asm_sei", "SEI"],
  ["asm_cli", "CLI"],
  ["asm_pha", "PHA"],
  ["asm_pla", "PLA"],
  ["asm_php", "PHP"],
  ["asm_plp", "PLP"],
  ["asm_clc", "CLC"],
  ["asm_sec", "SEC"],
  ["asm_cld", "CLD"],
  ["asm_sed", "SED"],
  ["asm_clv", "CLV"],
  ["asm_nop", "NOP"],
  ["asm_brk", "BRK"],
];

describe("Specification: RD-17 T1 opcode translation (ST-18, AC-07)", () => {
  it.each(T1_CASES)(
    "%s translates to exactly one Implied %s instruction",
    (name, opcode) => {
      const bag = createDiagnosticBag();
      const stream = translateFunction(fnWithIntrinsic(name), EMPTY_PLAN, "nmos6502", bag);
      // Exclude the function's own `RTS` terminator — only the T1 op is checked here.
      const opInstrs = stream.entries.filter(isInstr).filter((e) => e.opcode !== "RTS");
      expect(opInstrs).toHaveLength(1);
      expect(opInstrs[0]?.opcode).toBe(opcode);
      expect(opInstrs[0]?.mode).toBe("Implied");
      expect(bag.getAll().filter((d) => d.code.startsWith("E9"))).toHaveLength(0);
    },
  );

  it("asm_wai translates to exactly one Implied WAI instruction on 65C02", () => {
    const bag = createDiagnosticBag();
    const cpu: CpuVariant = "wdc65c02";
    const stream = translateFunction(fnWithIntrinsic("asm_wai"), EMPTY_PLAN, cpu, bag);
    const opInstrs = stream.entries.filter(isInstr).filter((e) => e.opcode !== "RTS");
    expect(opInstrs).toHaveLength(1);
    expect(opInstrs[0]?.opcode).toBe("WAI");
    expect(opInstrs[0]?.mode).toBe("Implied");
  });
});
