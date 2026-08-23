/**
 * Specification tests for folded compile-time memory addresses.
 *
 * An address expression made entirely from scalar compile-time constants has
 * no runtime identity. It must therefore lower exactly like the equivalent
 * numeric literal, while expressions that depend on runtime data remain
 * invalid memory-intrinsic addresses.
 */

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
import { describe, expect, it } from "vitest";

import { lowerToIL } from "./il/lower.js";
import { printIL } from "./il/print-il.js";
import { generateInstr } from "./instr/instr-program.js";
import { serializeToAcme } from "./instr/serialize-acme.js";

interface CompilationResult {
  /** Canonical IL emitted by the complete frontend and lowering pipeline. */
  readonly il: string;
  /** Canonical ACME source emitted by instruction selection. */
  readonly assembly: string;
  /** Diagnostics accumulated by parsing, analysis, allocation, and lowering. */
  readonly diagnostics: readonly Diagnostic[];
  /** Module declarations that received runtime storage. */
  readonly moduleVariables: readonly string[];
}

/** Compiles one source file through the real frontend, IL, and assembly pipeline. */
function compile(source: string): CompilationResult {
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

/** Returns the executable instruction lines from canonical ACME source. */
function instructions(assembly: string): string[] {
  return assembly
    .split("\n")
    .filter((line) => /^\s+[A-Z]{3}\b/.test(line))
    .map((line) => line.trim());
}

/**
 * Proves that a folded address is indistinguishable from its literal spelling
 * throughout lowering and instruction selection.
 */
function expectLiteralParity(foldedSource: string, literalSource: string): CompilationResult {
  const folded = compile(foldedSource);
  const literal = compile(literalSource);

  expect(folded.diagnostics).toEqual([]);
  expect(literal.diagnostics).toEqual([]);
  expect(folded.moduleVariables).toEqual([]);
  expect(folded.il).toBe(literal.il);
  expect(folded.assembly).toBe(literal.assembly);
  expect(folded.il).not.toContain("BASE");
  expect(folded.assembly).not.toContain("BASE");

  return folded;
}

/** Requires a runtime-dependent address expression to fail with the public diagnostic. */
function expectRuntimeAddressRejected(source: string): void {
  const result = compile(source);
  const codes = result.diagnostics.map(({ code }) => code);

  expect(codes).toContain("E10045");
  expect(codes.filter((code) => code.startsWith("E9"))).toEqual([]);
  expect(result.assembly).toBe("");
}

const FOLDED_PREFIX = ["module Main;", "const BASE: word = $D020;"].join("\n");
const LITERAL_PREFIX = "module Main;";
const EMPTY_MAIN = "function main(): void { }";

describe("Specification: folded compile-time memory addresses", () => {
  it("should lower a folded peek address with exact literal parity", () => {
    const result = expectLiteralParity(
      [FOLDED_PREFIX, "function read(): byte { return peek(BASE + 1); }", EMPTY_MAIN].join("\n"),
      [LITERAL_PREFIX, "function read(): byte { return peek($D021); }", EMPTY_MAIN].join("\n"),
    );

    expect(instructions(result.assembly).filter((line) => line.includes("$D02"))).toEqual([
      "LDA $D021",
    ]);
  });

  it("should lower a folded peekw address with exact literal parity and ordered reads", () => {
    const result = expectLiteralParity(
      [FOLDED_PREFIX, "function read(): word { return peekw(BASE + 1); }", EMPTY_MAIN].join("\n"),
      [LITERAL_PREFIX, "function read(): word { return peekw($D021); }", EMPTY_MAIN].join("\n"),
    );

    expect(instructions(result.assembly).filter((line) => line.includes("$D02"))).toEqual([
      "LDA $D021",
      "LDX $D021+1",
    ]);
  });

  it("should lower a folded poke address with exact literal parity", () => {
    const result = expectLiteralParity(
      [FOLDED_PREFIX, "function main(): void { poke(BASE + 1, $34); }"].join("\n"),
      [LITERAL_PREFIX, "function main(): void { poke($D021, $34); }"].join("\n"),
    );

    expect(instructions(result.assembly)).toEqual(["LDA #$34", "STA $D021", "RTS"]);
  });

  it("should lower a folded pokew address with exact literal parity and ordered writes", () => {
    const result = expectLiteralParity(
      [FOLDED_PREFIX, "function main(): void { pokew(BASE + 1, $1234); }"].join("\n"),
      [LITERAL_PREFIX, "function main(): void { pokew($D021, $1234); }"].join("\n"),
    );

    expect(instructions(result.assembly)).toEqual([
      "LDA #$34",
      "STA $D021",
      "LDA #$12",
      "STA $D022",
      "RTS",
    ]);
  });

  it("should reject a module variable used in a computed address", () => {
    expectRuntimeAddressRejected(
      [
        "module Main;",
        "let address: word = $D020;",
        "function read(): byte { return peek(address + 1); }",
        EMPTY_MAIN,
      ].join("\n"),
    );
  });

  it("should reject a local variable used in a computed address", () => {
    expectRuntimeAddressRejected(
      [
        "module Main;",
        "function read(): byte {",
        "  let address: word = $D020;",
        "  return peek(address + 1);",
        "}",
        EMPTY_MAIN,
      ].join("\n"),
    );
  });

  it("should reject a parameter used in a computed address", () => {
    expectRuntimeAddressRejected(
      [
        "module Main;",
        "function read(address: word): byte { return peek(address + 1); }",
        EMPTY_MAIN,
      ].join("\n"),
    );
  });
});
