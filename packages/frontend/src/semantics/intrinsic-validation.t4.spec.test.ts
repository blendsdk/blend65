/**
 * Specification tests for the T4 import-boundary validation.
 *
 * Derived EXCLUSIVELY from the requirements and acceptance criteria — never from
 * implementation (IMMUTABLE ORACLE RULE). Uses a test-local T4 fixture
 * descriptor (a test-local factory is allowed; the plugin-shaped fixture
 * lives in `@blend65/platforms`).
 *
 * Expected behaviour (distinct codes per failure mode):
 * - a T4 intrinsic (`fix_probe`) called on its owning platform (c64) WITHOUT
 *   `import { fix_probe } from c64;` → E10046 (IntrinsicNotImported), message
 *   `"'fix_probe' requires 'import { fix_probe } from c64;'"`.
 * - the same T4 intrinsic targeting a different platform (a7800), with or
 *   without the import → E10043 (IntrinsicUnavailable — wrong platform).
 * - Clean path: import present on the owning platform → no E10046/E10043.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, createIntrinsicRegistry, DEFAULT_PROFILE } from "@blend65/core";
import type { DiagnosticBag, IntrinsicDescriptor } from "@blend65/core";
import type { PlatformProfile } from "@blend65/core/platform";
import { lex } from "../lexer/index.js";
import { parse } from "../parser/index.js";
import { analyze } from "./analyze.js";

const SRC = 1;

/** Test-local T4 fixture descriptor: `fix_probe(): void`, call lowering. */
const FIX_PROBE: IntrinsicDescriptor = {
  name: "fix_probe",
  tier: "T4",
  signature: { params: [], returnType: "void" },
  availability: () => true, // platform gating comes from the merge wrapper
  loweringStrategy: "call",
  costMetadata: { cycles: "varies", bytes: "varies", zpBytes: 0 },
  clobberList: ["A", "status"],
  description: "test fixture",
};

/** A canonical profile with the given platform id (availability keys on it). */
function profileOf(platformId: string): PlatformProfile {
  return {
    platformId,
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
}

/** Analyze `source` with the c64-merged fixture registry against `target`. */
function analyzeT4(source: string, target: PlatformProfile): DiagnosticBag {
  const bag = createDiagnosticBag();
  const { tokens } = lex(SRC, source, bag);
  const { ast } = parse({ tokens, source, sourceId: SRC, bag });
  analyze({
    programs: [ast],
    bag,
    profile: DEFAULT_PROFILE,
    registry: createIntrinsicRegistry([FIX_PROBE], "c64"),
    targetProfile: target,
  });
  return bag;
}

describe("Specification: RD-17 T4 import-boundary validation (ST-15, ST-16)", () => {
  it("ST-15: fix_probe() on c64 without import → E10046 with the exact import hint", () => {
    const bag = analyzeT4(
      `module Main;\nfunction main(): void { fix_probe(); }\n`,
      profileOf("c64"),
    );
    const diag = bag.getAll().find((d) => d.code === "E10046");
    expect(diag, "expected an E10046 diagnostic").toBeDefined();
    expect(diag?.message).toContain("'import { fix_probe } from c64;'");
  });

  it("ST-16: fix_probe() targeting a7800 WITHOUT import → E10043 (wrong platform)", () => {
    const bag = analyzeT4(
      `module Main;\nfunction main(): void { fix_probe(); }\n`,
      profileOf("a7800"),
    );
    expect(bag.getAll().some((d) => d.code === "E10043")).toBe(true);
  });

  it("ST-16: fix_probe() targeting a7800 WITH the import → still E10043 (wrong platform)", () => {
    const bag = analyzeT4(
      `module Main;\nimport { fix_probe } from c64;\nfunction main(): void { fix_probe(); }\n`,
      profileOf("a7800"),
    );
    expect(bag.getAll().some((d) => d.code === "E10043")).toBe(true);
  });

  it("clean path (AC-05): import present on the owning platform → no boundary diagnostics", () => {
    const bag = analyzeT4(
      `module Main;\nimport { fix_probe } from c64;\nfunction main(): void { fix_probe(); }\n`,
      profileOf("c64"),
    );
    const boundary = bag.getAll().filter((d) => d.code === "E10046" || d.code === "E10043");
    expect(boundary).toEqual([]);
  });
});
