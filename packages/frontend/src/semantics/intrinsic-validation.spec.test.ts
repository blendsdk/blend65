/**
 * Specification tests for the RD-17 intrinsic-validation pass (ST-8..ST-14, ST-17).
 *
 * Derived EXCLUSIVELY from RD-17 (R2/R19–R25/R39/R40), RD-04's deferred rule rows
 * (R59/R100), frozen spec Ch 12, and the plan's 03-02/07 docs — never from reading
 * the implementation (IMMUTABLE ORACLE RULE). Written BEFORE the pass exists (red
 * phase). Each case composes the REAL lexer + parser + analyzer through the public
 * barrels (prefer real objects).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { DiagnosticBag, ProgramNode } from "@blend65/core";
import type { PlatformProfile } from "@blend65/core/platform";
import { lex, parse, analyze } from "../index.js";

const SRC = 1;

/** Lexes + parses `source` through the public entry points, returning the AST. */
function parseSource(source: string, bag: DiagnosticBag): ProgramNode {
  const { tokens } = lex(SRC, source, bag);
  const { ast } = parse({ tokens, source, sourceId: SRC, bag });
  return ast;
}

/**
 * Analyze a single-file program and return the diagnostic bag. `targetProfile`
 * (canonical) is optional — availability checks (V4) run only when it is present.
 */
function analyzeSource(
  source: string,
  targetProfile?: PlatformProfile,
): DiagnosticBag {
  const bag = createDiagnosticBag();
  const ast = parseSource(source, bag);
  analyze({
    programs: [ast],
    bag,
    profile: DEFAULT_PROFILE,
    ...(targetProfile !== undefined ? { targetProfile } : {}),
  });
  return bag;
}

/** All diagnostic codes accumulated in `bag`, in deterministic order. */
function codes(bag: DiagnosticBag): string[] {
  return bag.getAll().map((d) => d.code);
}

/** A minimal canonical C64 profile (NMOS 6502) for availability checks (V4). */
const C64_CANONICAL: PlatformProfile = {
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
};

describe("Specification: RD-17 intrinsic validation (ST-8..ST-14, ST-17)", () => {
  it("ST-8: asm_sei(5) → E10040 (args to a parameterless intrinsic)", () => {
    const bag = analyzeSource(`module Main;\nfunction main(): void { asm_sei(5); }\n`);
    expect(codes(bag)).toContain("E10040");
  });

  it("ST-9: poke($D020) → E10041 (wrong arg count)", () => {
    const bag = analyzeSource(`module Main;\nfunction main(): void { poke($D020); }\n`);
    expect(codes(bag)).toContain("E10041");
  });

  it("ST-10: poke($D020, 300) → E10171 (byte literal 300 out of range)", () => {
    const bag = analyzeSource(`module Main;\nfunction main(): void { poke($D020, 300); }\n`);
    expect(codes(bag)).toContain("E10171");
  });

  it("ST-11: asm_wai() targeting c64 → E10043 naming required CPU and actual target", () => {
    const bag = analyzeSource(
      `module Main;\nfunction main(): void { asm_wai(); }\n`,
      C64_CANONICAL,
    );
    const diag = bag.getAll().find((d) => d.code === "E10043");
    expect(diag, "expected an E10043 diagnostic").toBeDefined();
    expect(diag?.message).toContain("asm_wai");
    // Names the required CPU (wdc65c02) and the actual target CPU (nmos6502) — R23.
    expect(diag?.message).toContain("wdc65c02");
    expect(diag?.message).toContain("nmos6502");
  });

  it("ST-12: function peek(): void {} → E10101 (shadows a reserved intrinsic)", () => {
    const bag = analyzeSource(
      `module Main;\nfunction peek(): void {}\nfunction main(): void {}\n`,
    );
    expect(codes(bag)).toContain("E10101");
  });

  it("ST-13: offsetof(Sprite, nosuch) → E10171 naming the missing field", () => {
    const bag = analyzeSource(
      `module Main;\nstruct Sprite { x: byte; y: byte; addr: word; }\n` +
        `function main(): void { let o: byte = offsetof(Sprite, nosuch); }\n`,
    );
    const diag = bag.getAll().find((d) => d.code === "E10171");
    expect(diag, "expected an E10171 diagnostic").toBeDefined();
    expect(diag?.message).toContain("nosuch");
  });

  it("ST-14: asm_sed() with no asm_cld() in the same function → W10120", () => {
    const bag = analyzeSource(`module Main;\nfunction main(): void { asm_sed(); }\n`);
    expect(codes(bag)).toContain("W10120");
  });

  it("ST-14 clean: asm_sed() followed by asm_cld() → no W10120", () => {
    const bag = analyzeSource(
      `module Main;\nfunction main(): void { asm_sed(); asm_cld(); }\n`,
    );
    expect(codes(bag)).not.toContain("W10120");
  });

  it("ST-17: the AR-43 gate program poke($D020, 5) → zero analyzer diagnostics", () => {
    const bag = analyzeSource(
      `module Main;\nfunction main(): void { poke($D020, 5); }\n`,
      C64_CANONICAL,
    );
    expect(bag.getAll()).toHaveLength(0);
  });
});
