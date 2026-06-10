/**
 * Implementation/edge-case tests for RD-08 peephole optimizer (passthrough v1).
 *
 * Written AFTER the spec tests (`peephole.spec.test.ts`) and the implementation —
 * these probe internals, boundaries, and edge cases the spec oracles do not pin
 * down: empty programs, single/multi-stream ordering, mixed entry kinds, the
 * explicit-`enabled` equivalence, and CPU-variant invariance in v1.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, type AllocationPlan, type ZpAllocation } from "@blend65/core";

import { IL_BYTE } from "../il/il-type.js";
import { loc, temp } from "../il/operand.js";
import type { ILInstruction, ILTerminator } from "../il/instruction.js";
import type { ILFunction, ILProgram } from "../il/cfg.js";
import { directive, instr, label } from "./stream.js";
import { symbolRef } from "./operand.js";
import type { InstrProgram } from "./instr-program.js";
import { generateInstr, programByteSize } from "./instr-program.js";
import { printInstr } from "./print-instr.js";
import { optimizeInstr } from "./peephole.js";

// ---------------------------------------------------------------------------
// Fixtures (shared shape with the spec tests; Rule 7 — reuse existing patterns).
// ---------------------------------------------------------------------------

function makePlan(): AllocationPlan {
  const zpAllocations: ZpAllocation[] = [];
  return {
    frames: new Map(),
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

function ilProgram(functions: readonly ILFunction[]): ILProgram {
  return { functions, initCode: [], constData: [], allocationPlan: makePlan() };
}

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

function buildProgram(...names: string[]): InstrProgram {
  const bag = createDiagnosticBag();
  return generateInstr(ilProgram(names.map(addFn)), "nmos6502", bag);
}

function serialize(program: InstrProgram): string {
  return program.streams.map(printInstr).join("\n;;\n");
}

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("optimizeInstr — empty program edge case", () => {
  it("passes an empty-streams program through unchanged with no diagnostics", () => {
    const empty: InstrProgram = { preamble: [], streams: [], allocationPlan: makePlan() };
    const bag = createDiagnosticBag();

    const result = optimizeInstr(empty, "nmos6502", bag);

    expect(result.streams).toHaveLength(0);
    expect(programByteSize(result)).toBe(0);
    expect(bag.count()).toBe(0);
  });
});

describe("optimizeInstr — single vs multi-stream", () => {
  it("preserves a single stream verbatim", () => {
    const program = buildProgram("M.f");
    const bag = createDiagnosticBag();

    const result = optimizeInstr(program, "nmos6502", bag);

    expect(result.streams).toHaveLength(1);
    expect(serialize(result)).toBe(serialize(program));
  });

  it("preserves multi-stream ordering exactly", () => {
    const program = buildProgram("M.a", "M.b", "M.c");
    const bag = createDiagnosticBag();

    const result = optimizeInstr(program, "nmos6502", bag);

    expect(result.streams.map((s) => s.symbol)).toEqual(["M.a", "M.b", "M.c"]);
    expect(serialize(result)).toBe(serialize(program));
  });
});

describe("optimizeInstr — mixed instr/label/directive stream", () => {
  it("passes a stream mixing all three entry kinds through unchanged", () => {
    const mixed: InstrProgram = {
      preamble: [],
      streams: [
        {
          symbol: "M.mixed",
          segment: "code",
          entries: [
            label("M.mixed"),
            instr("LDA", "Absolute", symbolRef("a")),
            directive({ kind: "byte", values: [0xff] }),
          ],
        },
      ],
      allocationPlan: makePlan(),
    };
    const bag = createDiagnosticBag();

    const result = optimizeInstr(mixed, "nmos6502", bag);

    expect(printInstr(result.streams[0])).toBe(printInstr(mixed.streams[0]));
    expect(bag.count()).toBe(0);
  });
});

describe("optimizeInstr — options equivalence", () => {
  it("treats explicit { enabled: true } and omitted options identically", () => {
    const program = buildProgram("M.f");
    const bagA = createDiagnosticBag();
    const bagB = createDiagnosticBag();

    const explicit = optimizeInstr(program, "nmos6502", bagA, { enabled: true });
    const omitted = optimizeInstr(program, "nmos6502", bagB);

    expect(serialize(explicit)).toBe(serialize(omitted));
    expect(bagA.count()).toBe(bagB.count());
  });

  it("treats an empty options object as enabled (runs validation)", () => {
    const program = buildProgram("M.f");
    const bag = createDiagnosticBag();

    const result = optimizeInstr(program, "nmos6502", bag, {});

    expect(serialize(result)).toBe(serialize(program));
    expect(bag.count()).toBe(0);
  });
});

describe("optimizeInstr — cpuVariant invariance in v1", () => {
  it("produces identical output for nmos6502 and wdc65c02 (no rules to filter)", () => {
    const program = buildProgram("M.f");
    const bagNmos = createDiagnosticBag();
    const bagWdc = createDiagnosticBag();

    const nmos = optimizeInstr(program, "nmos6502", bagNmos);
    const wdc = optimizeInstr(program, "wdc65c02", bagWdc);

    expect(serialize(nmos)).toBe(serialize(wdc));
  });
});
