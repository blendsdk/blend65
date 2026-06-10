/**
 * RD-07c end-to-end integration golden (ST-AG1) — the real-plugin anchor.
 *
 * D10 (package-boundary rule): the real `c64Plugin` × real `assembleProgram` golden
 * lives in `@blend65/compiler` — the integration layer that already depends on both
 * `@blend65/codegen` and `@blend65/platforms`. Putting it here avoids the build cycle
 * a `codegen → platforms` test edge would create, and is the natural long-term home
 * for full-pipeline goldens.
 *
 * This test drives a hand-built gate IL (`module Main; function main(): void {
 * let c: byte = 5; poke(0xD020, c); }`) through `assembleProgram(c64Plugin)` and
 * `printInstr`, asserting the exact ACME text.
 *
 * IMMUTABLE ORACLE RULE (testing.md Rule 10): the expected text is composed from the
 * frozen c64 `emitPreamble` output (ST-C64-2, green in `@blend65/platforms`) + the
 * RD-07b ST-G2 body with the entry function relabelled `_main` (D4). It is NOT
 * derived by running `assembleProgram`.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag } from "@blend65/core";
import type { AllocationPlan } from "@blend65/core";
import { c64Plugin } from "@blend65/platforms";
import {
  IL_BYTE,
  assembleProgram,
  imm,
  loc,
  printInstr,
  temp,
  type ILFunction,
  type ILProgram,
} from "@blend65/codegen";

/** A minimal `AllocationPlan` — the hand-built IL references symbols directly. */
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

/**
 * The gate entry function `Main.main`, hand-built to the slice-2 shape:
 *   const %0 = 5; store %0 → [__frame_Main_main_c];
 *   load %1 = [__frame_Main_main_c]; store %1 → [$D020]; ret.
 * Reproduces the RD-07b ST-G2 body (the entry function relabels to `_main`).
 */
function gateMainFn(): ILFunction {
  return {
    name: "Main.main",
    params: [],
    returnType: "void",
    blocks: [
      {
        label: "_entry",
        instructions: [
          { op: "const", dest: temp(0, IL_BYTE), src: imm(5, IL_BYTE) },
          { op: "store", a: temp(0, IL_BYTE), b: loc("__frame_Main_main_c", IL_BYTE) },
          { op: "load", a: temp(1, IL_BYTE), b: loc("__frame_Main_main_c", IL_BYTE) },
          { op: "store", a: temp(1, IL_BYTE), b: loc("$D020", IL_BYTE) },
        ],
        terminator: { kind: "ret" },
      },
    ],
    tempCount: 2,
    isInterrupt: false,
  };
}

function gateProgram(): ILProgram {
  return {
    functions: [gateMainFn()],
    initCode: [],
    constData: [],
    allocationPlan: emptyPlan(),
  };
}

describe("Specification: RD-07c end-to-end gate golden with real c64Plugin (ST-AG1)", () => {
  // ST-AG1 — c64 preamble (ST-C64-2) + `_main` body (ST-G2 relabelled) = exact ACME.
  it("assembles the gate program to the full preamble + `_main` body (ST-AG1)", () => {
    // Arrange
    const bag = createDiagnosticBag();

    // Act — assemble with the real c64 plugin, render preamble + entry body.
    const program = assembleProgram(gateProgram(), c64Plugin, bag);
    const preambleText = printInstr({
      symbol: "_pre",
      segment: "code",
      entries: [...program.preamble],
    });
    const bodyText = program.streams.map(printInstr).join("\n");
    const text = [preambleText, bodyText].join("\n");

    // Assert — the exact composed golden (c64 preamble + `_main` body).
    expect(text).toBe(
      [
        '!to "main.prg", cbm',
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
        "_main:",
        "    LDA #$05",
        "    STA __frame_Main_main_c",
        "    LDA __frame_Main_main_c",
        "    STA $D020",
        "    RTS",
      ].join("\n"),
    );
    expect(bag.hasErrors()).toBe(false);
  });
});
