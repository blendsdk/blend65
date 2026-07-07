/**
 * Implementation tests for the whole-program ACME serializer
 * (`serializeToAcme`). Written AFTER the implementation — these cover edge cases,
 * internals, and boundary conditions that the spec oracles
 * (`serialize-acme.spec.test.ts`) do not pin: preamble-only programs, data-only
 * programs, multi-stream ordering, hex padding/masking, and ordering stability
 * regardless of input stream order.
 */

import { describe, expect, it } from "vitest";
import type { AllocationPlan, SymbolDefinition } from "@blend65/core";
import type { InstrProgram } from "./instr-program.js";
import type { InstrStream, StreamEntry } from "./stream.js";
import { directive, instr, label } from "./stream.js";
import { none } from "./operand.js";
import { serializeToAcme } from "./serialize-acme.js";

/** A minimal plan carrying only `symbolDefinitions`; other fields are benign. */
function planWith(symbolDefinitions: readonly SymbolDefinition[]): AllocationPlan {
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
    symbolDefinitions,
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

/** Build an {@link InstrProgram} from its three parts. */
function programOf(
  preamble: readonly StreamEntry[],
  streams: readonly InstrStream[],
  symbolDefinitions: readonly SymbolDefinition[] = [],
): InstrProgram {
  return { preamble, streams, allocationPlan: planWith(symbolDefinitions) };
}

describe("serializeToAcme — preamble handling", () => {
  it("emits only the symbol header for a fully empty program", () => {
    expect(serializeToAcme(programOf([], []))).toBe("; --- symbol definitions ---\n");
  });

  it("renders a preamble with no !to directive directly after the symbol header", () => {
    const preamble: StreamEntry[] = [directive({ kind: "origin", address: 0x0801 })];
    expect(serializeToAcme(programOf(preamble, []))).toBe(
      ["; --- symbol definitions ---", "* = $0801", ""].join("\n"),
    );
  });

  it("hoists !to above the symbol header even when more preamble follows", () => {
    const preamble: StreamEntry[] = [
      directive({ kind: "origin", address: 0x0801 }),
      directive({ kind: "outputFile", name: "main.prg", format: "cbm" }),
    ];
    const lines = serializeToAcme(programOf(preamble, [])).split("\n");
    expect(lines[0]).toBe('!to "main.prg", cbm');
    expect(lines[1]).toBe("; --- symbol definitions ---");
    expect(lines[2]).toBe("* = $0801");
  });
});

describe("serializeToAcme — symbol definitions", () => {
  it("masks and pads symbol values to 4-digit uppercase hex", () => {
    const program = programOf([], [], [
      { name: "__zp_a", value: 0x02 },
      { name: "__var_big", value: 0x1abcd }, // masked to 16 bits → $ABCD
      { name: "__frame_x", value: 0xd020 },
    ]);
    const text = serializeToAcme(program);
    expect(text).toContain("__zp_a = $0002");
    expect(text).toContain("__var_big = $ABCD");
    expect(text).toContain("__frame_x = $D020");
  });

  it("preserves verbatim array order (no re-grouping)", () => {
    const program = programOf([], [], [
      { name: "__zp_z", value: 1 },
      { name: "__frame_a", value: 2 },
      { name: "__var_m", value: 3 },
    ]);
    const body = serializeToAcme(program).split("\n");
    expect(body.slice(0, 4)).toEqual([
      "; --- symbol definitions ---",
      "__zp_z = $0001",
      "__frame_a = $0002",
      "__var_m = $0003",
    ]);
  });
});

describe("serializeToAcme — segment ordering", () => {
  const code = (symbol: string): InstrStream => ({
    symbol,
    segment: "code",
    entries: [label(symbol), instr("RTS", "Implied", none())],
  });
  const data = (symbol: string): InstrStream => ({
    symbol,
    segment: "data",
    entries: [label(symbol), directive({ kind: "byte", values: [0] })],
  });

  it("emits multiple code streams before multiple data streams, preserving each group's order", () => {
    const program = programOf([], [data("d1"), code("c1"), data("d2"), code("c2")]);
    const text = serializeToAcme(program);
    const iC1 = text.indexOf("; --- function: c1 ---");
    const iC2 = text.indexOf("; --- function: c2 ---");
    const iD1 = text.indexOf("; --- const data: d1 ---");
    const iD2 = text.indexOf("; --- const data: d2 ---");
    // All code before all data; within each group, declaration order preserved.
    expect(iC1).toBeGreaterThanOrEqual(0);
    expect(iC1).toBeLessThan(iC2);
    expect(iC2).toBeLessThan(iD1);
    expect(iD1).toBeLessThan(iD2);
  });

  it("is data-only safe: a program with only data streams still has the symbol header first", () => {
    const text = serializeToAcme(programOf([], [data("only")]));
    expect(text.startsWith("; --- symbol definitions ---\n")).toBe(true);
    expect(text).toContain("; --- const data: only ---");
  });

  it("skips every zp-segment stream regardless of position", () => {
    const zp: InstrStream = {
      symbol: "__zp_run",
      segment: "zp",
      entries: [label("__zp_run")],
    };
    const text = serializeToAcme(programOf([], [zp, code("c1"), zp]));
    expect(text).not.toContain("__zp_run");
    expect(text).toContain("; --- function: c1 ---");
  });
});

describe("serializeToAcme — determinism", () => {
  it("produces byte-identical output across repeated calls for a non-trivial program", () => {
    const program = programOf(
      [directive({ kind: "outputFile", name: "main.prg", format: "cbm" })],
      [
        {
          symbol: "Main.main",
          segment: "code",
          entries: [label("_main"), instr("RTS", "Implied", none())],
        },
      ],
      [{ name: "__frame_Main_main", value: 0x0820 }],
    );
    expect(serializeToAcme(program)).toBe(serializeToAcme(program));
  });
});
