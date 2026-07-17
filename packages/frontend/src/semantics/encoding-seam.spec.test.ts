/**
 * Specification tests for the analyzer's encoding seam: the character
 * encoder is derived from the target profile's `defaultEncoding`, and an
 * absent profile falls back to deterministic raw-ASCII bytes.
 *
 * Oracle (frozen spec Ch 01 §7.2 + Ch 15 §3.2): the same source folds
 * `'a'` to PETSCII `$C1` under a c64-shaped profile and to ASCII `$61`
 * with no target profile at all. Exercised through the real public path
 * (`lex`→`parse`→`analyze`); never derived from the implementation.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { ConstValue, DiagnosticBag, SemanticModel } from "@blend65/core";
import type { PlatformProfile } from "@blend65/core/platform";
import { lex, parse, analyze } from "../index.js";

/** A c64-shaped canonical profile whose literals encode as PETSCII. */
const C64_PROFILE: PlatformProfile = {
  platformId: "c64",
  codeStart: 0x0801,
  codeEnd: 0xcfff,
  dataStart: 0xc000,
  dataEnd: 0xcfff,
  ramStart: 0x0801,
  ramEnd: 0xcfff,
  zpStart: 0x02,
  zpEnd: 0x8f,
  stackReserve: 16,
  maxBinarySize: 0xc7ff,
  maxRam: 0xc7ff,
  maxZp: 142,
  stackBudget: 240,
  outputFormat: "prg",
  loadAddress: 0x0801,
  cpu: "nmos6502",
  zpArgBlockSize: 8,
  defaultEncoding: "petscii",
};

/** Analyzes one source, optionally against a target profile. */
function analyzeWith(source: string, targetProfile?: PlatformProfile): SemanticModel {
  const bag: DiagnosticBag = createDiagnosticBag();
  const { tokens } = lex(1, source, bag);
  const { ast } = parse({ tokens, source, sourceId: 1, bag });
  const base = { programs: [ast], bag, profile: DEFAULT_PROFILE };
  return analyze(targetProfile === undefined ? base : { ...base, targetProfile });
}

/** Looks up a folded constant's value by symbol name. */
function constValueOf(model: SemanticModel, name: string): ConstValue | undefined {
  for (const [sym, value] of model.constValues) {
    if (sym.name === name) return value;
  }
  return undefined;
}

const SRC = "module Main;\nconst X: byte = 'a';\nfunction main(): void {}\n";

describe("Specification: encoder derivation from the target profile", () => {
  it("folds 'a' to PETSCII $C1 under a c64-shaped profile", () => {
    expect(constValueOf(analyzeWith(SRC, C64_PROFILE), "X")?.value).toBe(0xc1);
  });

  it("folds 'a' to raw-ASCII $61 with no target profile", () => {
    expect(constValueOf(analyzeWith(SRC), "X")?.value).toBe(0x61);
  });
});
