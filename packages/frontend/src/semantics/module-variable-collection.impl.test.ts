/**
 * Implementation tests for module-level scalar collection + projection,
 * exercised through the full `analyze()` → `modelToModuleVars` path.
 * Covers declaration ordering, per-scalar byteSize, mixed local+module name
 * resolution, and assignment to a module `const` (E10191, now reachable once
 * module constants are collected).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode, primitive } from "@blend65/core";
import type { Diagnostic, DiagnosticBag, ProgramNode } from "@blend65/core";
import { lex, parse, analyze, modelToModuleVars } from "../index.js";

const SRC = 1;

function parseSource(source: string, bag: DiagnosticBag): ProgramNode {
  const { tokens } = lex(SRC, source, bag);
  const { ast } = parse({ tokens, source, sourceId: SRC, bag });
  return ast;
}

function errorCodes(bag: DiagnosticBag): string[] {
  return bag.getErrors().map((d: Diagnostic) => d.code);
}

describe("module variables — collection + projection (full path)", () => {
  it("projects module vars in declaration order with per-scalar byteSize", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(
      "module Main;\nlet accB: byte;\nlet accW: word;\nfunction main(): void { }\n",
      bag,
    );
    const model = analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });

    expect(modelToModuleVars(model)).toEqual([
      { moduleName: "Main", variableName: "accB", type: primitive("byte"), size: 1 },
      { moduleName: "Main", variableName: "accW", type: primitive("word"), size: 2 },
    ]);
  });

  it("resolves both a local and a module var from one function body", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(
      "module Main;\nlet g: byte;\nfunction main(): void { let x: byte = 5; g = x; }\n",
      bag,
    );
    analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });

    // g (module) and x (local) both resolve; g = x is same-type → no diagnostics.
    expect(bag.hasErrors()).toBe(false);
  });

  it("reports assignment to a module constant with E10191", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(
      "module Main;\nconst K: byte = 5;\nfunction main(): void { K = 1; }\n",
      bag,
    );
    analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });

    expect(errorCodes(bag)).toContain(DiagCode.AssignToConst); // E10191
  });

  it("excludes a module constant from the RAM-backed module-var projection", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(
      "module Main;\nconst K: byte = 5;\nlet v: byte;\nfunction main(): void { }\n",
      bag,
    );
    const model = analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });

    // Only the `let` variable gets a `__var_*` slot; the `const` is excluded.
    expect(modelToModuleVars(model)).toEqual([
      { moduleName: "Main", variableName: "v", type: primitive("byte"), size: 1 },
    ]);
  });
});
