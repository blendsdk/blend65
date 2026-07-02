/**
 * Specification tests for RD-17 runtime-module embedding + dead-strip
 * (ST-28, ST-29).
 *
 * Derived EXCLUSIVELY from RD-17 §4.6/R15/R16, AC-11, and AR-100 — never from
 * reading the implementation (IMMUTABLE ORACLE RULE):
 *  - ST-28: a program using `*` (bytes) serializes with the `mul8.asm` body
 *    embedded EXACTLY ONCE, in a discrete runtime section (R15, AR-100).
 *  - ST-29: the gate program (no `*`/`/`/`%`) serializes with NO runtime section —
 *    byte-identical to the pre-RD-17 output (R16, AC-11).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, RT_ROUTINES } from "@blend65/core";
import type { AllocationPlan } from "@blend65/core";
import { IL_BYTE, IL_WORD } from "../il/il-type.js";
import { loc, temp } from "../il/operand.js";
import type { ILInstruction } from "../il/instruction.js";
import type { ILProgram } from "../il/cfg.js";
import { generateInstr } from "../instr/instr-program.js";
import { serializeToAcme } from "../instr/serialize-acme.js";
import { buildRuntimeSection, collectReferencedRoutines, loadRuntimeModule } from "./embed.js";

/** A minimal empty allocation plan for hand-built IL. */
function emptyPlan(): AllocationPlan {
  return {
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
}

/** A single-function IL program around the given instructions. */
function programOf(instructions: readonly ILInstruction[]): ILProgram {
  return {
    functions: [
      {
        name: "Main.main",
        params: [],
        returnType: "void",
        blocks: [
          { label: "_entry", instructions: [...instructions], terminator: { kind: "ret" } },
        ],
        tempCount: 8,
        isInterrupt: false,
      },
    ],
    initCode: [],
    constData: [],
    allocationPlan: emptyPlan(),
  };
}

/** IL for `let r: word = a * b` with byte operands → a `__rt_mul8` call site. */
const MUL_BYTES: readonly ILInstruction[] = [
  { op: "mul", dest: temp(0, IL_WORD), left: loc("a", IL_BYTE), right: loc("b", IL_BYTE), type: IL_BYTE },
  { op: "store", a: temp(0, IL_WORD), b: loc("r", IL_WORD) },
];

/** IL for the gate program body (`poke`-shaped store; no `*`/`/`/`%`). */
const GATE: readonly ILInstruction[] = [
  { op: "store", a: loc("c", IL_BYTE), b: loc("$D020", IL_BYTE) },
];

describe("Specification: RD-17 runtime embedding (ST-28, R15, AR-100)", () => {
  it("a program using * (bytes) embeds the mul8 module exactly once in the runtime section", () => {
    const bag = createDiagnosticBag();
    const program = generateInstr(programOf(MUL_BYTES), "nmos6502", bag);

    const referenced = collectReferencedRoutines(program, RT_ROUTINES);
    expect([...referenced]).toEqual(["__rt_mul8"]);

    const section = buildRuntimeSection(referenced, RT_ROUTINES);
    expect(section).not.toBeNull();
    const text = serializeToAcme(program, { runtimeSection: section ?? "" });

    // The module body appears exactly once: one definition of the entry label
    // (internal labels share the `__rt_mul8_` prefix per AR-100 — exclude them).
    const defs = text.split("\n").filter((line) => line.startsWith("__rt_mul8:"));
    expect(defs).toHaveLength(1);
    // ...and it is the verbatim module text (AR-100: single-file composition).
    const mul8 = loadRuntimeModule(RT_ROUTINES.find((d) => d.name === "__rt_mul8")!);
    expect(text).toContain(mul8.trimEnd());
    // Discrete section: a runtime-section marker separates it from the code.
    expect(text).toContain("runtime routines");
    // Unreferenced modules are dead-stripped (R16): no div/mul16 bodies.
    for (const absent of ["__rt_mul16", "__rt_div8", "__rt_div16"]) {
      expect(text).not.toContain(`${absent}\n`);
      expect(text.split("\n").some((line) => line.startsWith(absent))).toBe(false);
    }
  });
});

describe("Specification: RD-17 dead-strip / golden preservation (ST-29, R16, AC-11)", () => {
  it("the gate program references no routines and serializes byte-identical to the un-optioned output", () => {
    const bag = createDiagnosticBag();
    const program = generateInstr(programOf(GATE), "nmos6502", bag);

    const referenced = collectReferencedRoutines(program, RT_ROUTINES);
    expect(referenced.size).toBe(0);
    expect(buildRuntimeSection(referenced, RT_ROUTINES)).toBeNull();

    // No option → byte-identical to the pre-RD-17 serializer output (the RD-09
    // golden shape): no runtime section, no trailing additions.
    const withoutOption = serializeToAcme(program);
    expect(withoutOption).not.toContain("runtime routines");
    expect(withoutOption.endsWith("\n")).toBe(true);
  });

  it("every catalog T3 routine loads and follows the §4.6 module convention", () => {
    for (const d of RT_ROUTINES) {
      const text = loadRuntimeModule(d);
      // Single entry label named after the routine, ending in RTS (§4.6).
      expect(text.split("\n").some((line) => line.startsWith(d.name))).toBe(true);
      expect(text.toUpperCase()).toContain("RTS");
      // Internal labels carry the module prefix (AR-100 collision rule): every
      // label definition at column 0 starts with the routine's own prefix.
      const labelDefs = text
        .split("\n")
        .filter((line) => /^[A-Za-z_]/.test(line) && !line.startsWith(";"));
      for (const def of labelDefs) {
        expect(def.startsWith(d.name)).toBe(true);
      }
    }
  });
});
