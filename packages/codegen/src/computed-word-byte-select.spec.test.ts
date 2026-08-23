/**
 * Specification test for selecting the high byte of a computed word.
 *
 * Memory-mapped reads are observable, so selecting the high byte of a word
 * read must still read both little-endian bytes exactly once. The unused low
 * byte may be discarded immediately, while the high byte should remain in the
 * byte-return register without shifts, scratch storage, or a runtime helper.
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
import { generateInstr } from "./instr/instr-program.js";
import { serializeToAcme } from "./instr/serialize-acme.js";

interface CompilationResult {
  /** Canonical ACME source emitted by the complete compiler pipeline. */
  readonly assembly: string;
  /** Diagnostics accumulated by the complete compiler pipeline. */
  readonly diagnostics: readonly Diagnostic[];
}

/** Compiles one source file through the real frontend, IL, and assembly pipeline. */
function compile(source: string): CompilationResult {
  const bag = createDiagnosticBag();
  const { tokens } = lex(1, source, bag);
  const { ast }: { ast: ProgramNode } = parse({ tokens, source, sourceId: 1, bag });
  const programs = [ast];
  const model = analyze({ programs, bag, profile: DEFAULT_PROFILE });
  const plan = planAllocation(
    {
      functions: modelToFunctionInfo(model),
      moduleVars: modelToModuleVars(model),
      zpUserVars: [],
      upstreamErrors: bag.hasErrors(),
      needsPointerScratch: modelNeedsPointerScratch(model),
    },
    DEFAULT_PROFILE,
    bag,
  );
  const il = lowerToIL({ program: programs, model, plan }, bag);
  const assembly = bag.hasErrors() ? "" : serializeToAcme(generateInstr(il, "nmos6502", bag));

  return { assembly, diagnostics: bag.getAll() };
}

/** Returns executable instruction lines from canonical ACME source. */
function instructions(assembly: string): string[] {
  return assembly
    .split("\n")
    .filter((line) => /^\s+[A-Z]{3}\b/.test(line))
    .map((line) => line.trim());
}

const PROGRAM_PREFIX = ["module Main;", "function read(): byte {"].join("\n");
const PROGRAM_SUFFIX = ["}", "function main(): void { }"].join("\n");

describe("Specification: high byte of a computed word", () => {
  // A volatile word read must preserve both bus reads while returning its high byte directly.
  it("should return the high byte of a volatile word read with direct-read parity", () => {
    const computed = compile(
      [PROGRAM_PREFIX, "  return hi(peekw($D020));", PROGRAM_SUFFIX].join("\n"),
    );
    const manual = compile(
      [PROGRAM_PREFIX, "  peek($D020);", "  return peek($D021);", PROGRAM_SUFFIX].join("\n"),
    );

    expect(computed.diagnostics.map(({ code }) => code)).not.toContain("E90001");
    expect(computed.diagnostics).toEqual([]);
    expect(manual.diagnostics).toEqual([]);
    expect(instructions(computed.assembly)).toEqual(["LDA $D020", "LDA $D021", "RTS", "RTS"]);
    expect(computed.assembly).toBe(manual.assembly);
  });
});
