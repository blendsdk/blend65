/**
 * Specification tests for the whole-program ACME serializer (`serializeToAcme`).
 *
 * Derived exclusively from the ACME emitter requirements and worked example,
 * and the live `printInstr` format.
 *
 * These are immutable oracles: the expected text is the ACME rendering
 * documented in the worked example plus the live `printInstr` format — NOT
 * whatever `serializeToAcme` happens to produce. The canonical output carries
 * the `; --- symbol definitions ---` header and a
 * `; --- function: <symbol> ---` comment before each code stream.
 */

import { describe, expect, it } from "vitest";
import type { AllocationPlan, SymbolDefinition } from "@blend65/core";
import type { InstrProgram } from "./instr-program.js";
import type { InstrStream, StreamEntry } from "./stream.js";
import { directive, instr, label } from "./stream.js";
import { imm8, none, symbolRef } from "./operand.js";
import { serializeToAcme } from "./serialize-acme.js";

/**
 * A minimal {@link AllocationPlan} carrying only the `symbolDefinitions` the
 * serializer reads; every other field is a benign zero/empty value.
 */
function planWith(symbolDefinitions: readonly SymbolDefinition[]): AllocationPlan {
  return {
    frames: new Map(),
    dataBase: 0,
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

/** Build an {@link InstrProgram} from preamble + streams + symbol defs. */
function programOf(
  preamble: readonly StreamEntry[],
  streams: readonly InstrStream[],
  symbolDefinitions: readonly SymbolDefinition[] = [],
): InstrProgram {
  return { preamble, streams, allocationPlan: planWith(symbolDefinitions) };
}

/** The `!to "main.prg", cbm` output-file directive entry. */
const toDirective: StreamEntry = directive({
  kind: "outputFile",
  name: "main.prg",
  format: "cbm",
});

describe("Specification: serializeToAcme — output-file hoist & symbol header (ST-S1..S3)", () => {
  it("should hoist the !to output-file directive to the first line (ST-S1)", () => {
    const program = programOf([toDirective], []);
    const lines = serializeToAcme(program).split("\n");
    expect(lines[0]).toBe('!to "main.prg", cbm');
  });

  it("should emit symbolDefinitions verbatim, in array order, under one header (ST-S2)", () => {
    const program = programOf([], [], [
      { name: "__zp_a", value: 2 },
      { name: "__frame_main", value: 0x0820 },
    ]);
    expect(serializeToAcme(program)).toBe(
      [
        "; --- symbol definitions ---",
        "__zp_a = $0002",
        "__frame_main = $0820",
        "",
      ].join("\n"),
    );
  });

  it("should still emit the symbol-definitions header when symbolDefinitions is empty (ST-S3)", () => {
    const program = programOf([], [], []);
    expect(serializeToAcme(program)).toBe("; --- symbol definitions ---\n");
  });
});

describe("Specification: serializeToAcme — segment ordering & comments (ST-S4..S6)", () => {
  it("should precede a code stream with a `; --- function: <symbol> ---` comment (ST-S4)", () => {
    const stream: InstrStream = {
      symbol: "_main",
      segment: "code",
      entries: [label("_main"), instr("RTS", "Implied", none())],
    };
    const text = serializeToAcme(programOf([], [stream]));
    expect(text).toBe(
      [
        "; --- symbol definitions ---",
        "; --- function: _main ---",
        "_main:",
        "    RTS",
        "",
      ].join("\n"),
    );
  });

  it("should emit all code streams before any data stream, data under its own header (ST-S5)", () => {
    const codeStream: InstrStream = {
      symbol: "_main",
      segment: "code",
      entries: [label("_main"), instr("RTS", "Implied", none())],
    };
    const dataStream: InstrStream = {
      symbol: "msg",
      segment: "data",
      entries: [label("msg"), directive({ kind: "byte", values: [1, 2] })],
    };
    const text = serializeToAcme(programOf([], [dataStream, codeStream]));
    expect(text).toBe(
      [
        "; --- symbol definitions ---",
        "; --- function: _main ---",
        "_main:",
        "    RTS",
        "; --- const data: msg ---",
        "msg:",
        "    !byte $01, $02",
        "",
      ].join("\n"),
    );
  });

  it("should skip a zp-segment stream body entirely (ST-S6)", () => {
    const zpStream: InstrStream = {
      symbol: "__zp_block",
      segment: "zp",
      entries: [label("__zp_block"), directive({ kind: "byte", values: [0] })],
    };
    const text = serializeToAcme(programOf([], [zpStream]));
    expect(text).toBe("; --- symbol definitions ---\n");
    expect(text).not.toContain("__zp_block");
  });
});

describe("Specification: serializeToAcme — determinism (ST-S7)", () => {
  it("should end with exactly one trailing newline and be deterministic (ST-S7)", () => {
    const stream: InstrStream = {
      symbol: "_main",
      segment: "code",
      entries: [instr("RTS", "Implied", none())],
    };
    const program = programOf([toDirective], [stream]);
    const text = serializeToAcme(program);
    expect(text.endsWith("\n")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(false);
    expect(serializeToAcme(program)).toBe(text);
  });
});

describe("Specification: serializeToAcme — full gate program golden (ST-S8)", () => {
  it("should render the c64 gate program to the header-bearing §4.8 golden (ST-S8)", () => {
    // Hand-built fixture mirroring the real c64 preamble + `_main` body. The
    // identical text is asserted against the REAL plugin in the migrated golden
    // test (`@blend65/compiler/src/assemble.golden.spec.test.ts`).
    const preamble: StreamEntry[] = [
      directive({ kind: "outputFile", name: "main.prg", format: "cbm" }),
      directive({ kind: "origin", address: 0x0801 }),
      directive({ kind: "word", values: [0x080b] }),
      directive({ kind: "word", values: [0x000a] }),
      directive({ kind: "byte", values: [0x9e] }),
      directive({ kind: "text", text: "2061" }),
      directive({ kind: "byte", values: [0x00] }),
      directive({ kind: "word", values: [0x0000] }),
      label("__startup"),
      instr("LDA", "Immediate", imm8(0x36)),
      instr("STA", "ZeroPage", symbolRef("$01")),
      instr("JSR", "Absolute", symbolRef("_main")),
      instr("LDA", "Immediate", imm8(0x37)),
      instr("STA", "ZeroPage", symbolRef("$01")),
      instr("RTS", "Implied", none()),
    ];
    const mainStream: InstrStream = {
      symbol: "Main.main",
      segment: "code",
      entries: [
        label("_main"),
        instr("LDA", "Immediate", imm8(0x05)),
        instr("STA", "Absolute", symbolRef("__frame_Main_main_c")),
        instr("LDA", "Absolute", symbolRef("__frame_Main_main_c")),
        instr("STA", "Absolute", symbolRef("$D020")),
        instr("RTS", "Implied", none()),
      ],
    };

    expect(serializeToAcme(programOf(preamble, [mainStream]))).toBe(
      [
        '!to "main.prg", cbm',
        "; --- symbol definitions ---",
        "* = $0801",
        "    !word $080B",
        "    !word $000A",
        "    !byte $9E",
        '    !text "2061"',
        "    !byte $00",
        "    !word $0000",
        "__startup:",
        "    LDA #$36",
        "    STA $01",
        "    JSR _main",
        "    LDA #$37",
        "    STA $01",
        "    RTS",
        "; --- function: Main.main ---",
        "_main:",
        "    LDA #$05",
        "    STA __frame_Main_main_c",
        "    LDA __frame_Main_main_c",
        "    STA $D020",
        "    RTS",
        "",
      ].join("\n"),
    );
  });
});
