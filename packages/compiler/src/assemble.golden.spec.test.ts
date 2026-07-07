/**
 * End-to-end integration golden — the real-plugin anchor.
 *
 * Package-boundary rule: the real `c64Plugin` × real `assembleProgram` golden
 * lives in `@blend65/compiler` — the integration layer that already depends on
 * both `@blend65/codegen` and `@blend65/platforms`. Putting it here avoids the
 * build cycle a `codegen → platforms` test edge would create: each package's
 * own tests stay within that package's dependency closure, and cross-package
 * integration tests live in the layer that already depends on everything
 * being integrated.
 *
 * This test drives a hand-built gate IL (`module Main; function main(): void {
 * let c: byte = 5; poke(0xD020, c); }`) through `assembleProgram(c64Plugin)` and
 * the whole-program serializer `serializeToAcme`, asserting the exact ACME
 * text.
 *
 * The expected text is composed independently of the code under test — never
 * by running `serializeToAcme` itself — from the frozen c64 `emitPreamble`
 * output plus the body with the entry function relabelled `_main`, wrapped in
 * the canonical whole-program structure (`!to` hoist, `; --- symbol
 * definitions ---` header, `; --- function: <symbol> ---` comment).
 *
 * `serializeToAcme` is the single whole-program rendering path, so
 * `--emit-asm` and the build feed can never drift. The expected text carries
 * the symbol-definitions header (empty for the gate) and the per-function
 * comment; every preamble/instruction byte matches the prior golden. The
 * identical text is asserted against a hand-built fixture in the serializer's
 * own test (`@blend65/codegen/src/instr/serialize-acme.spec.test.ts`).
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
  serializeToAcme,
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
 * Reproduces the shape used by the codegen-level equivalent test (the entry
 * function relabels to `_main`).
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
  // The c64 preamble + `_main` body, serialized by the canonical
  // `serializeToAcme` = exact header-bearing ACME.
  it("assembles the gate program to the canonical preamble + `_main` body (ST-AG1)", () => {
    // Arrange
    const bag = createDiagnosticBag();

    // Act — assemble with the real c64 plugin, then serialize the whole program with
    // the single canonical serializer.
    const program = assembleProgram(gateProgram(), c64Plugin, bag);
    const text = serializeToAcme(program);

    // Assert — the exact canonical golden: `!to` hoisted, empty symbol-definitions
    // header, the c64 preamble, then the `; --- function: Main.main ---` body.
    expect(text).toBe(
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
    expect(bag.hasErrors()).toBe(false);
  });
});
