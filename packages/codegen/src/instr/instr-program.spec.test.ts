/**
 * Specification tests for `InstrProgram` + `generateInstr`.
 *
 * Derived exclusively from the specification. Immutable oracles: if the
 * implementation disagrees, the implementation is wrong — not these tests.
 *
 * `generateInstr(ilProgram, cpuVariant, bag)` drives per-function translation,
 * validates each emitted stream against the CPU table, and assembles a frozen
 * `InstrProgram { preamble: [], streams, allocationPlan }`.
 */

import { describe, expect, it } from "vitest";
import {
  createDiagnosticBag,
  IceCode,
  type AllocationPlan,
  type ZpAllocation,
} from "@blend65/core";
import { loc, temp } from "../il/operand.js";

import { IL_BYTE } from "../il/il-type.js";
import type { ILInstruction, ILTerminator } from "../il/instruction.js";
import type { ILFunction, ILProgram } from "../il/cfg.js";
import { printInstr } from "./print-instr.js";
import { generateInstr, programByteSize } from "./instr-program.js";

function makePlan(): AllocationPlan {
  const zpAllocations: ZpAllocation[] = [];
  return {
    frames: new Map(),
    dataBase: 0,
    frameRegionBase: 0,
    frameRegionSize: 0,
    peakSimultaneous: 0,
    sharingSaved: 0,
    zpAllocations,
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

function fn(
  name: string,
  instructions: readonly ILInstruction[],
  terminator: ILTerminator,
  opts: { blocks?: ILFunction["blocks"] } = {},
): ILFunction {
  return {
    name,
    params: [],
    returnType: "void",
    blocks: opts.blocks ?? [{ label: "_entry", instructions, terminator }],
    tempCount: 4,
    isInterrupt: false,
  };
}

function program(functions: readonly ILFunction[], plan: AllocationPlan = makePlan()): ILProgram {
  return { functions, initCode: [], constData: [], allocationPlan: plan };
}

/** A simple `r = a + b` byte function. */
function addFn(name: string): ILFunction {
  return fn(
    name,
    [
      { op: "load", a: temp(0, IL_BYTE), b: loc("a", IL_BYTE) },
      { op: "load", a: temp(1, IL_BYTE), b: loc("b", IL_BYTE) },
      { op: "add", dest: temp(2, IL_BYTE), left: temp(0, IL_BYTE), right: temp(1, IL_BYTE), type: IL_BYTE },
      { op: "store", a: temp(2, IL_BYTE), b: loc("r", IL_BYTE) },
    ],
    { kind: "ret" },
  );
}

describe("Specification: generateInstr — program shape (ST-P1)", () => {
  it("returns one stream, empty preamble, and the carried plan (ST-P1)", () => {
    const plan = makePlan();
    const bag = createDiagnosticBag();
    const prog = generateInstr(program([addFn("M.f")], plan), "nmos6502", bag);

    expect(prog.streams).toHaveLength(1);
    expect(prog.preamble).toEqual([]);
    expect(prog.allocationPlan).toBe(plan);
    expect(prog.streams[0].symbol).toBe("M.f");
    expect(prog.streams[0].segment).toBe("code");
    expect(bag.hasErrors()).toBe(false);
  });
});

describe("Specification: generateInstr — skip IL-less functions (ST-P2)", () => {
  it("produces no stream for a function with no blocks, still translating others (ST-P2)", () => {
    const empty = fn("M.empty", [], { kind: "ret" }, { blocks: [] });
    const bag = createDiagnosticBag();
    const prog = generateInstr(program([empty, addFn("M.f")]), "nmos6502", bag);

    expect(prog.streams).toHaveLength(1);
    expect(prog.streams[0].symbol).toBe("M.f");
    expect(bag.hasErrors()).toBe(false);
  });
});

describe("Specification: generateInstr — error surfacing (ST-P3)", () => {
  it("surfaces an E90001 when a function carries an untranslatable op (ST-P3)", () => {
    // A deferred IL op reaches the translator's ICE default arm; generateInstr
    // surfaces the E90001 while still translating the clean function.
    const bad = fn(
      "M.bad",
      [{ op: "neg", dest: temp(1, IL_BYTE), src: temp(0, IL_BYTE), type: IL_BYTE } as ILInstruction],
      { kind: "ret" },
    );
    const bag = createDiagnosticBag();
    const prog = generateInstr(program([bad, addFn("M.f")]), "nmos6502", bag);

    expect(bag.hasErrors()).toBe(true);
    expect(bag.getErrors().some((d) => d.code === IceCode.Unexpected)).toBe(true);
    // The clean function still produced a stream (error tolerance).
    expect(prog.streams.some((s) => s.symbol === "M.f")).toBe(true);
  });
});

describe("Specification: generateInstr — determinism (ST-P4)", () => {
  it("produces byte-identical streams across two runs (ST-P4)", () => {
    const run = (): string => {
      const bag = createDiagnosticBag();
      const prog = generateInstr(program([addFn("M.f"), addFn("M.g")]), "nmos6502", bag);
      return prog.streams.map(printInstr).join("\n;;\n");
    };
    expect(run()).toBe(run());
  });
});

describe("Specification: generateInstr — stream order (ST-P5)", () => {
  it("orders streams to match ilProgram.functions (ST-P5)", () => {
    const bag = createDiagnosticBag();
    const prog = generateInstr(program([addFn("M.a"), addFn("M.b"), addFn("M.c")]), "nmos6502", bag);
    expect(prog.streams.map((s) => s.symbol)).toEqual(["M.a", "M.b", "M.c"]);
  });
});

describe("Specification: programByteSize (ST-P6)", () => {
  it("sums instrByteSize over every stream entry (ST-P6)", () => {
    const bag = createDiagnosticBag();
    // A single void-ret function: label (0 bytes) + RTS (1 byte) = 1.
    const prog = generateInstr(program([fn("M.v", [], { kind: "ret" })]), "nmos6502", bag);
    expect(programByteSize(prog)).toBe(1);

    // r = a + b → LDA(3) CLC(1) ADC(3) STA(3) RTS(1) = 11 bytes; label = 0.
    const bag2 = createDiagnosticBag();
    const prog2 = generateInstr(program([addFn("M.f")]), "nmos6502", bag2);
    expect(programByteSize(prog2)).toBe(11);
  });
});

describe("Specification: generateInstr — clean program (ST-P7)", () => {
  it("reports no errors or warnings for a clean live program (ST-P7)", () => {
    const bag = createDiagnosticBag();
    generateInstr(program([addFn("M.f"), fn("M.v", [], { kind: "ret" })]), "nmos6502", bag);
    expect(bag.hasErrors()).toBe(false);
    expect(bag.getWarnings()).toHaveLength(0);
  });
});
