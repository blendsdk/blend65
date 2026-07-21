/**
 * Implementation tests for `instr-program.ts` (edge cases & internals).
 *
 * Written after the implementation, unlike the specification tests: empty IL
 * program → empty `streams`; frozen output; multi-function ordering with byte
 * sizing; preamble emptiness; and the const-data stream's alignment directive
 * against the entry's own demand. They complement `instr-program.spec.test.ts`.
 */

import { describe, expect, it } from "vitest";
import {
  createDiagnosticBag,
  type AllocationPlan,
  type ZpAllocation,
} from "@blend65/core";
import { loc, temp } from "../il/operand.js";
import { IL_BYTE } from "../il/il-type.js";
import type { ILInstruction, ILTerminator } from "../il/instruction.js";
import type { ConstDataEntry, ILFunction, ILProgram } from "../il/cfg.js";
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

function program(
  functions: readonly ILFunction[],
  constData: readonly ConstDataEntry[] = [],
): ILProgram {
  return { functions, initCode: [], initTempCount: 0, constData, allocationPlan: makePlan() };
}

/** The data stream generated for one const-data entry. */
function dataStreamOf(entry: ConstDataEntry) {
  const prog = generateInstr(program([], [entry]), "nmos6502", createDiagnosticBag());
  const stream = prog.streams.find((s) => s.symbol === entry.symbol);
  expect(stream, `no stream generated for ${entry.symbol}`).toBeDefined();
  return stream!;
}

describe("generateInstr — empty IL program", () => {
  it("produces an empty stream list and a 0 byte size", () => {
    const bag = createDiagnosticBag();
    const prog = generateInstr(program([]), "nmos6502", bag);
    expect(prog.streams).toEqual([]);
    expect(prog.preamble).toEqual([]);
    expect(programByteSize(prog)).toBe(0);
    expect(bag.hasErrors()).toBe(false);
  });
});

describe("generateInstr — frozen output", () => {
  it("freezes the program and its streams list", () => {
    const bag = createDiagnosticBag();
    const prog = generateInstr(program([fn("M.v", [], { kind: "ret" })]), "nmos6502", bag);
    expect(Object.isFrozen(prog)).toBe(true);
    expect(Object.isFrozen(prog.streams)).toBe(true);
  });
});

describe("generateInstr — multi-function byte sizing", () => {
  it("sums byte sizes across several functions", () => {
    const bag = createDiagnosticBag();
    // Two void-ret functions: each is one RTS (1 byte) → total 2 bytes.
    const prog = generateInstr(
      program([fn("M.a", [], { kind: "ret" }), fn("M.b", [], { kind: "ret" })]),
      "nmos6502",
      bag,
    );
    expect(prog.streams.map((s) => s.symbol)).toEqual(["M.a", "M.b"]);
    expect(programByteSize(prog)).toBe(2);
  });

  it("includes a byte-store function in the size sum", () => {
    const bag = createDiagnosticBag();
    // store-only: const t0=#$01 (LDA #imm, 2) + STA r (Absolute, 3) + RTS (1) = 6.
    const prog = generateInstr(
      program([
        fn(
          "M.s",
          [
            { op: "const", dest: temp(0, IL_BYTE), src: { kind: "immediate", value: 1, type: IL_BYTE } },
            { op: "store", a: temp(0, IL_BYTE), b: loc("r", IL_BYTE) },
          ],
          { kind: "ret" },
        ),
      ]),
      "nmos6502",
      bag,
    );
    expect(programByteSize(prog)).toBe(6);
  });
});

describe("constDataStream — the alignment directive follows the entry's demand", () => {
  const bytes = new Uint8Array([1, 2, 3]);

  it("opens an entry that demands a boundary with the directive, immediately ahead of its label", () => {
    // Order is the point: the padding has to land before the data, so the
    // directive travels inside the same stream rather than being reconstructed
    // when the stream is serialized.
    const stream = dataStreamOf({
      symbol: "__data_M_T",
      data: bytes,
      type: "array",
      boundary: 256,
    });
    expect(stream.entries[0]).toEqual({
      type: "directive",
      directive: { kind: "align", boundary: 256, fill: 0 },
    });
    expect(stream.entries[1]).toEqual({ type: "label", name: "__data_M_T" });
  });

  it("carries the entry's own boundary rather than a fixed one", () => {
    const stream = dataStreamOf({
      symbol: "__data_M_SPRITE",
      data: bytes,
      type: "array",
      boundary: 64,
    });
    expect(stream.entries[0]).toEqual({
      type: "directive",
      directive: { kind: "align", boundary: 64, fill: 0 },
    });
  });

  it("opens an entry that demands nothing with the label — no directive at all", () => {
    const stream = dataStreamOf({ symbol: "__data_M_U", data: bytes, type: "array" });
    expect(stream.entries[0]).toEqual({ type: "label", name: "__data_M_U" });
    expect(stream.entries.some((e) => e.type === "directive" && e.directive.kind === "align")).toBe(
      false,
    );
  });
});
