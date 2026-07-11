/**
 * Specification tests for the peephole optimizer (passthrough v1).
 *
 * Every expectation below is derived exclusively from the specification,
 * never from reading the implementation. These are immutable oracles — if
 * the implementation disagrees, the implementation is wrong, not the test.
 *
 * v1 contract: `optimizeInstr(program, cpuVariant, bag, options?)` validates the
 * program's structure and returns it unchanged (preamble/streams/allocationPlan
 * verbatim). `options.enabled === false` is a guaranteed passthrough that skips
 * even validation. `validateProgramStructure` reports structural violations as an
 * ICE (E90001) and never a user-band diagnostic.
 */

import { describe, expect, it } from "vitest";
import {
  createDiagnosticBag,
  IceCode,
  type AllocationPlan,
  type ZpAllocation,
} from "@blend65/core";
import type { StreamEntry } from "./stream.js";

import { IL_BYTE } from "../il/il-type.js";
import { loc, temp } from "../il/operand.js";
import type { ILInstruction, ILTerminator } from "../il/instruction.js";
import type { ILFunction, ILProgram } from "../il/cfg.js";
import { directive, instr, label } from "./stream.js";
import { symbolRef } from "./operand.js";
import type { InstrProgram } from "./instr-program.js";
import { generateInstr, programByteSize } from "./instr-program.js";
import { printInstr } from "./print-instr.js";

// The module under test (does not exist yet — red phase).
import {
  optimizeInstr,
  validateProgramStructure,
  V1_RULES,
  type PeepholeRule,
} from "./peephole.js";

// ---------------------------------------------------------------------------
// Fixtures — build a real InstrProgram via generateInstr (reusing the
// existing spec-test shape and patterns).
// ---------------------------------------------------------------------------

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
): ILFunction {
  return {
    name,
    params: [],
    returnType: "void",
    blocks: [{ label: "_entry", instructions, terminator }],
    tempCount: 4,
    isInterrupt: false,
  };
}

function ilProgram(functions: readonly ILFunction[], plan: AllocationPlan = makePlan()): ILProgram {
  return { functions, initCode: [], initTempCount: 0, constData: [], allocationPlan: plan };
}

/** A simple `r = a + b` byte function (lowers to LDA/CLC/ADC/STA/RTS + label). */
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

/** Build a well-formed InstrProgram from one or more functions. */
function buildProgram(...names: string[]): InstrProgram {
  const bag = createDiagnosticBag();
  const prog = generateInstr(ilProgram(names.map(addFn)), "nmos6502", bag);
  if (bag.hasErrors()) {
    throw new Error("fixture build produced diagnostics — fixture is wrong");
  }
  return prog;
}

/** Serialize an entire program (preamble + every stream) to a comparable string. */
function serializeProgram(program: InstrProgram): string {
  const parts: string[] = [
    printInstr({ symbol: "_pre", segment: "code", entries: [...program.preamble] }),
    ...program.streams.map(printInstr),
  ];
  return parts.join("\n;;\n");
}

// ---------------------------------------------------------------------------
// Feature: optimizeInstr passthrough contract
// ---------------------------------------------------------------------------

describe("Specification: optimizeInstr — passthrough contract (ST-1..ST-8)", () => {
  it("returns an InstrProgram with identical stream count and byte size (ST-1)", () => {
    const program = buildProgram("M.f");
    const bag = createDiagnosticBag();

    const result = optimizeInstr(program, "nmos6502", bag);

    expect(result.streams.length).toBe(program.streams.length);
    expect(programByteSize(result)).toBe(programByteSize(program));
  });

  it("produces byte-identical serialized output (ST-2)", () => {
    const program = buildProgram("M.f", "M.g");
    const bag = createDiagnosticBag();

    const result = optimizeInstr(program, "nmos6502", bag);

    expect(serializeProgram(result)).toBe(serializeProgram(program));
  });

  it("returns the SAME reference and runs no validation when disabled (ST-3)", () => {
    const program = buildProgram("M.f");
    const bag = createDiagnosticBag();

    const result = optimizeInstr(program, "nmos6502", bag, { enabled: false });

    expect(result).toBe(program);
    expect(bag.count()).toBe(0);
  });

  it("runs the validate-then-return path when enabled explicitly or omitted (ST-4)", () => {
    const program = buildProgram("M.f");
    const bagExplicit = createDiagnosticBag();
    const bagOmitted = createDiagnosticBag();

    const explicit = optimizeInstr(program, "nmos6502", bagExplicit, { enabled: true });
    const omitted = optimizeInstr(program, "nmos6502", bagOmitted);

    expect(serializeProgram(explicit)).toBe(serializeProgram(omitted));
    expect(bagExplicit.count()).toBe(0);
    expect(bagOmitted.count()).toBe(0);
  });

  it("passes preamble and allocationPlan through verbatim (ST-5)", () => {
    const base = buildProgram("M.f");
    // A program with a non-empty preamble (modeled directly; assembleProgram would
    // produce one via a plugin, but the passthrough only needs a populated field).
    const withPreamble: InstrProgram = {
      preamble: [directive({ kind: "byte", values: [0x01, 0x02] })],
      streams: base.streams,
      allocationPlan: base.allocationPlan,
    };
    const bag = createDiagnosticBag();

    const result = optimizeInstr(withPreamble, "nmos6502", bag);

    expect(result.preamble).toEqual(withPreamble.preamble);
    expect(result.allocationPlan).toBe(withPreamble.allocationPlan);
  });

  it("exposes the PeepholeRule contract and an empty V1_RULES (ST-6)", () => {
    const sampleRule: PeepholeRule = {
      name: "noop",
      windowSize: 1,
      priority: 0,
      cpuCompat: ["nmos6502"],
      match: () => false,
      replace: (window) => [...window],
    };

    expect(sampleRule.name).toBe("noop");
    expect(sampleRule.windowSize).toBe(1);
    expect(sampleRule.priority).toBe(0);
    expect(sampleRule.cpuCompat).toEqual(["nmos6502"]);
    expect(typeof sampleRule.match).toBe("function");
    expect(typeof sampleRule.replace).toBe("function");
    expect(V1_RULES).toHaveLength(0);
  });

  it("is deterministic: same input yields structurally identical output (ST-7)", () => {
    const program = buildProgram("M.f", "M.g");
    const bag1 = createDiagnosticBag();
    const bag2 = createDiagnosticBag();

    const first = optimizeInstr(program, "nmos6502", bag1);
    const second = optimizeInstr(program, "nmos6502", bag2);

    expect(serializeProgram(first)).toBe(serializeProgram(second));
  });

  it("preserves label and directive entries in place (ST-8)", () => {
    const base = buildProgram("M.f");
    const dataStream = {
      symbol: "palette",
      segment: "data" as const,
      entries: [label("palette"), directive({ kind: "byte", values: [0, 1, 2, 3] })],
    };
    const program: InstrProgram = {
      preamble: [],
      streams: [...base.streams, dataStream],
      allocationPlan: base.allocationPlan,
    };
    const bag = createDiagnosticBag();

    const result = optimizeInstr(program, "nmos6502", bag);

    const resultData = result.streams[result.streams.length - 1];
    expect(printInstr(resultData)).toBe(printInstr(dataStream));
  });
});

// ---------------------------------------------------------------------------
// Feature: validateProgramStructure (structural well-formedness)
// ---------------------------------------------------------------------------

describe("Specification: validateProgramStructure (ST-9..ST-12)", () => {
  it("records zero diagnostics for a well-formed program (ST-9)", () => {
    const program = buildProgram("M.f");
    const bag = createDiagnosticBag();

    validateProgramStructure(program, bag);

    expect(bag.count()).toBe(0);
  });

  it("records an E90001 ICE for a null entry, no user-band diagnostic (ST-10)", () => {
    const base = buildProgram("M.f");
    const malformed: InstrProgram = {
      preamble: [],
      streams: [
        {
          symbol: "bad",
          segment: "code",
          entries: [null as unknown as StreamEntry],
        },
      ],
      allocationPlan: base.allocationPlan,
    };
    const bag = createDiagnosticBag();

    validateProgramStructure(malformed, bag);

    const all = bag.getAll();
    expect(all.some((d) => d.code === IceCode.Unexpected)).toBe(true);
    // No user-band (E10xxx/W10xxx) diagnostics.
    expect(all.every((d) => d.code === IceCode.Unexpected)).toBe(true);
  });

  it("records an E90001 ICE when streams is not an array, without throwing (ST-11)", () => {
    const base = buildProgram("M.f");
    const malformed: InstrProgram = {
      preamble: [],
      streams: null as unknown as InstrProgram["streams"],
      allocationPlan: base.allocationPlan,
    };
    const bag = createDiagnosticBag();

    expect(() => validateProgramStructure(malformed, bag)).not.toThrow();
    expect(bag.getAll().some((d) => d.code === IceCode.Unexpected)).toBe(true);
  });

  it("surfaces the structural ICE through optimizeInstr default options (ST-12)", () => {
    const base = buildProgram("M.f");
    const malformed: InstrProgram = {
      preamble: [],
      streams: [
        {
          symbol: "bad",
          segment: "code",
          entries: [instr("LDA", "Absolute", symbolRef("a")), null as unknown as StreamEntry],
        },
      ],
      allocationPlan: base.allocationPlan,
    };
    const bag = createDiagnosticBag();

    optimizeInstr(malformed, "nmos6502", bag);

    expect(bag.getAll().some((d) => d.code === IceCode.Unexpected)).toBe(true);
  });
});
