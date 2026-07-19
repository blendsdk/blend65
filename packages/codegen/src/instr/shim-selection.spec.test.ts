/**
 * Specification tests for startup shim selection under `startup: "auto"`. A
 * `main` that can never return — its IL control-flow graph reaches no `ret`,
 * with a constant-condition branch following only its taken edge (the
 * `while (true)` idiom) — selects the non-terminating shim; a returning
 * `main` keeps the terminating shim. The analysis is deliberately
 * conservative: a non-literal loop condition counts as returnable (wrongly
 * choosing non-terminating would strand the final RTS on a wild stack, so
 * uncertainty resolves toward terminating). An explicit driver override
 * always wins, and a platform whose policy says `main` cannot return forces
 * the non-terminating shim regardless of the analysis.
 *
 * Derived exclusively from the specification — never from reading the
 * implementation (immutable oracle rule). The fake plugin surfaces the
 * chosen variant as a preamble label; the byte-level shim shapes are the
 * platform layer's contract, pinned by the emitter goldens.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { Diagnostic, ProgramNode } from "@blend65/core";
import type {
  AcmeDirective,
  MainTerminationPolicy,
  PlatformPlugin,
  PlatformProfile,
  PreambleOptions,
  ShimVariant,
  StreamEntry,
  ValidationError,
} from "@blend65/core/platform";
import { isLabel, label } from "@blend65/core/platform";
import {
  analyze,
  lex,
  modelNeedsPointerScratch,
  modelToFunctionInfo,
  modelToModuleVars,
  modelToZpUserVars,
  parse,
  planAllocation,
} from "@blend65/frontend";
import { lowerToIL } from "../il/lower.js";
import { assembleProgram } from "./instr-program.js";

const fakeProfile = { cpu: "nmos6502" } as unknown as PlatformProfile;

/** A spy plugin surfacing the selected shim variant as a preamble label. */
function spyPlugin(canReturn: boolean): PlatformPlugin {
  return {
    id: "fake",
    displayName: "Fake Test Platform",
    profile: fakeProfile,
    intrinsics: [],
    runtimeModules: [],
    emitPreamble: (options: PreambleOptions): StreamEntry[] => [
      label(`__shim_${options.shimVariant}`),
    ],
    emitStartupShim: (_variant: ShimVariant): StreamEntry[] => [],
    getOutputDirective: (projectName: string): AcmeDirective => ({
      kind: "outputFile",
      name: `${projectName}.prg`,
      format: "cbm",
    }),
    encodeString: (text: string): number[] => [...text].map((c) => c.charCodeAt(0)),
    encodeChar: (char: string): number => char.charCodeAt(0),
    getMainTerminationPolicy: (): MainTerminationPolicy => ({ canReturn }),
    validateProfile: (): ValidationError[] => [],
  };
}

/** Lowers + assembles one program; returns the selected shim variant. */
function selectedShim(
  source: string,
  opts?: { canReturn?: boolean; override?: ShimVariant },
): string {
  const bag = createDiagnosticBag();
  const programs: ProgramNode[] = [source].map((src, i) => {
    const { tokens } = lex(i + 1, src, bag);
    return parse({ tokens, source: src, sourceId: i + 1, bag }).ast;
  });
  const model = analyze({ programs, bag, profile: DEFAULT_PROFILE });
  const plan = planAllocation(
    {
      functions: modelToFunctionInfo(model),
      moduleVars: modelToModuleVars(model),
      zpUserVars: modelToZpUserVars(model),
      upstreamErrors: bag.hasErrors(),
      needsPointerScratch: modelNeedsPointerScratch(model),
    },
    DEFAULT_PROFILE,
    bag,
  );
  const il = lowerToIL({ program: programs, model, plan }, bag);
  const errors: Diagnostic[] = bag.getAll().filter((d) => d.severity === "error");
  expect(errors).toEqual([]);
  const program = assembleProgram(
    il,
    spyPlugin(opts?.canReturn ?? true),
    bag,
    opts?.override !== undefined ? { shimVariant: opts.override } : undefined,
  );
  const first = program.preamble[0];
  if (first === undefined || !isLabel(first)) throw new Error("expected the shim label");
  return first.name;
}

describe("startup shim selection (ST-34..ST-37)", () => {
  it("ST-34: a while(true) main selects the non-terminating shim under auto", () => {
    const shim = selectedShim(
      [
        "module Main;",
        "let n: byte = 0;",
        "function main(): void {",
        "  while (true) { n = n + 1; }",
        "}",
      ].join("\n"),
    );
    expect(shim).toBe("__shim_non-terminating");
  });

  // The same idiom with an MMIO-only body — the shape a raster poll wraps.
  // How the loop's constant condition is represented in the IL is free to
  // change; which shim it selects is not.
  it("a while(true) main whose body only pokes hardware still selects the non-terminating shim", () => {
    const shim = selectedShim(
      [
        "module Main;",
        "function main(): void {",
        "  while (true) { poke($D020, 1); }",
        "}",
      ].join("\n"),
    );
    expect(shim).toBe("__shim_non-terminating");
  });

  it("ST-35: a returning main keeps the terminating shim under auto", () => {
    const shim = selectedShim(
      ["module Main;", "let n: byte = 0;", "function main(): void { n = 1; }"].join("\n"),
    );
    expect(shim).toBe("__shim_terminating");
  });

  it("ST-36: a non-literal loop condition stays terminating (conservative — the analysis must not guess)", () => {
    const shim = selectedShim(
      [
        "module Main;",
        "let flag: boolean = true;",
        "function main(): void {",
        "  while (flag) { flag = flag; }",
        "}",
      ].join("\n"),
    );
    expect(shim).toBe("__shim_terminating");
  });

  it("ST-37: an explicit terminating override beats the analysis on a while(true) main", () => {
    const shim = selectedShim(
      [
        "module Main;",
        "let n: byte = 0;",
        "function main(): void {",
        "  while (true) { n = n + 1; }",
        "}",
      ].join("\n"),
      { override: "terminating" },
    );
    expect(shim).toBe("__shim_terminating");
  });

  it("a platform whose main cannot return forces the non-terminating shim regardless of analysis", () => {
    const shim = selectedShim(
      ["module Main;", "let n: byte = 0;", "function main(): void { n = 1; }"].join("\n"),
      { canReturn: false },
    );
    expect(shim).toBe("__shim_non-terminating");
  });
});
