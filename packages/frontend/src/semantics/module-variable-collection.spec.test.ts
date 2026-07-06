/**
 * Specification tests for RD-18 Slice 3b module-level scalar collection (Pass 1,
 * FR-4; AR-9). Expectations derive from the plan's testing strategy (ST-11,
 * ST-12), spec Ch 03 (module-level `let`), and RD-04 R9/R20 (duplicate decl) —
 * NOT from implementation logic. Immutable oracle. Exercised through the REAL
 * `analyze()` path; assertions read the model's module scope and the bag.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode, primitive } from "@blend65/core";
import type { Diagnostic, DiagnosticBag, ProgramNode, Scope } from "@blend65/core";
import { lex, parse, analyze } from "../index.js";

const SRC = 1;

function parseSource(source: string, bag: DiagnosticBag): ProgramNode {
  const { tokens } = lex(SRC, source, bag);
  const { ast } = parse({ tokens, source, sourceId: SRC, bag });
  return ast;
}

/** The first module scope under the model's global scope. */
function moduleScopeOf(children: readonly Scope[]): Scope {
  const scope = children.find((s) => s.kind === "module");
  if (scope === undefined) throw new Error("expected a module scope");
  return scope;
}

function errorCodes(bag: DiagnosticBag): string[] {
  return bag.getErrors().map((d: Diagnostic) => d.code);
}

describe("Specification: RD-18 Slice 3b module-variable collection (FR-4)", () => {
  // ST-11 — a top-level `let` becomes a `variable` symbol in the module scope, and
  // a function body reference resolves to it (no E10100).
  it("should collect a top-level let as a module-scope variable symbol (ST-11)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(
      "module Main;\nlet g: byte;\nfunction main(): void { g = 1; }\n",
      bag,
    );
    const model = analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });

    const moduleScope = moduleScopeOf(model.globalScope.children);
    const g = moduleScope.symbols.get("g");
    expect(g?.kind).toBe("variable");
    expect(g?.type).toEqual(primitive("byte"));

    // The body assignment `g = 1` resolves to the module var — no undeclared error.
    expect(errorCodes(bag)).not.toContain(DiagCode.UndeclaredIdentifier);
  });

  // ST-12 — a duplicate top-level declaration → E10003 (R9/R20).
  it("should report a duplicate top-level let with E10003 (ST-12)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource("module Main;\nlet g: byte;\nlet g: word;\n", bag);
    analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });

    expect(errorCodes(bag)).toContain(DiagCode.DuplicateDecl); // E10003
  });
});
