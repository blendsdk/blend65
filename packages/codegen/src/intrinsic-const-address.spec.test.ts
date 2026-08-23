/**
 * Specification tests for module constants used as intrinsic addresses.
 *
 * A module constant is resolved at compile time and owns no runtime storage.
 * Therefore using one as the address of a memory intrinsic must produce the
 * same IL and 6502 instructions as spelling the address as a literal. A
 * module variable remains runtime data and cannot satisfy this contract.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { Diagnostic, ProgramNode } from "@blend65/core";
import {
  analyze,
  lex,
  modelNeedsPointerScratch,
  modelToFunctionInfo,
  modelToModuleVars,
  parse,
  planAllocation,
} from "@blend65/frontend";
import { lowerToIL } from "./il/lower.js";
import { printIL } from "./il/print-il.js";
import { generateInstr } from "./instr/instr-program.js";
import { serializeToAcme } from "./instr/serialize-acme.js";

interface LoweredProgram {
  /** Canonical IL used to prove that a named constant adds no runtime work. */
  readonly il: string;
  /** Canonical ACME source emitted by the complete backend pipeline. */
  readonly assembly: string;
  /** Diagnostics accumulated by parsing, analysis, allocation, and lowering. */
  readonly diagnostics: readonly Diagnostic[];
  /** Names of module declarations that received runtime storage. */
  readonly moduleVariables: readonly string[];
}

/**
 * Runs one source file through the real frontend and backend.
 *
 * Instruction generation is intentionally skipped when lowering reports an
 * error because a rejected source has no valid assembly contract.
 */
function lowerSource(source: string): LoweredProgram {
  const bag = createDiagnosticBag();
  const { tokens } = lex(1, source, bag);
  const { ast }: { ast: ProgramNode } = parse({ tokens, source, sourceId: 1, bag });
  const programs = [ast];
  const model = analyze({ programs, bag, profile: DEFAULT_PROFILE });
  const moduleVars = modelToModuleVars(model);
  const plan = planAllocation(
    {
      functions: modelToFunctionInfo(model),
      moduleVars,
      zpUserVars: [],
      upstreamErrors: bag.hasErrors(),
      needsPointerScratch: modelNeedsPointerScratch(model),
    },
    DEFAULT_PROFILE,
    bag,
  );
  const lowered = lowerToIL({ program: programs, model, plan }, bag);
  const assembly = bag.hasErrors() ? "" : serializeToAcme(generateInstr(lowered, "nmos6502", bag));

  return {
    il: printIL(lowered),
    assembly,
    diagnostics: bag.getAll(),
    moduleVariables: moduleVars.map(
      ({ moduleName, variableName }) => `${moduleName}.${variableName}`,
    ),
  };
}

/** Returns only executable 6502 instruction lines from canonical ACME text. */
function instructions(assembly: string): string[] {
  return assembly
    .split("\n")
    .filter((line) => /^\s+[A-Z]{3}\b/.test(line))
    .map((line) => line.trim());
}

/**
 * Proves a named constant is indistinguishable from its literal spelling
 * throughout lowering and instruction selection.
 */
function expectLiteralParity(constSource: string, literalSource: string): LoweredProgram {
  const named = lowerSource(constSource);
  const literal = lowerSource(literalSource);

  expect(named.diagnostics).toEqual([]);
  expect(literal.diagnostics).toEqual([]);
  expect(named.moduleVariables).toEqual([]);
  expect(named.il).toBe(literal.il);
  expect(named.assembly).toBe(literal.assembly);

  return named;
}

describe("Specification: module constants as intrinsic addresses", () => {
  it("should lower peek with a direct module constant exactly like the address literal", () => {
    const result = expectLiteralParity(
      [
        "module Main;",
        "const BORDER: word = $D020;",
        "function read(): byte { return peek(BORDER); }",
        "function main(): void { }",
      ].join("\n"),
      [
        "module Main;",
        "function read(): byte { return peek($D020); }",
        "function main(): void { }",
      ].join("\n"),
    );

    expect(instructions(result.assembly)).toContain("LDA $D020");
  });

  it("should lower peekw with a folded module constant exactly like the address literal", () => {
    const result = expectLiteralParity(
      [
        "module Main;",
        "const BASE: word = $D020;",
        "const SCREEN: word = BASE + 1;",
        "function read(): word { return peekw(SCREEN); }",
        "function main(): void { }",
      ].join("\n"),
      [
        "module Main;",
        "function read(): word { return peekw($D021); }",
        "function main(): void { }",
      ].join("\n"),
    );

    expect(instructions(result.assembly)).toContain("LDA $D021");
    expect(instructions(result.assembly)).toContain("LDX $D021+1");
  });

  it("should lower poke with a direct module constant exactly like the address literal", () => {
    const result = expectLiteralParity(
      [
        "module Main;",
        "const BORDER: word = $D020;",
        "function main(): void { poke(BORDER, 5); }",
      ].join("\n"),
      ["module Main;", "function main(): void { poke($D020, 5); }"].join("\n"),
    );

    expect(instructions(result.assembly)).toEqual(["LDA #$05", "STA $D020", "RTS"]);
  });

  it("should lower pokew with a folded module constant exactly like the address literal", () => {
    const result = expectLiteralParity(
      [
        "module Main;",
        "const BASE: word = $D020;",
        "const SCREEN: word = BASE + 1;",
        "function main(): void { pokew(SCREEN, $1234); }",
      ].join("\n"),
      ["module Main;", "function main(): void { pokew($D021, $1234); }"].join("\n"),
    );

    expect(instructions(result.assembly)).toEqual([
      "LDA #$34",
      "STA $D021",
      "LDA #$12",
      "STA $D022",
      "RTS",
    ]);
  });

  it("should reject a module variable as an intrinsic address", () => {
    const result = lowerSource(
      [
        "module Main;",
        "let address: word = $D020;",
        "function main(): void { poke(address, 5); }",
      ].join("\n"),
    );
    const codes = result.diagnostics.map(({ code }) => code);

    expect(codes).toContain("E10045");
    expect(codes.filter((code) => code.startsWith("E9"))).toEqual([]);
  });
});
