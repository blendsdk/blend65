/**
 * Implementation tests for the interrupt declaration surface: the standing
 * rejections stay wired (`export interrupt` → E10311; a direct handler call
 * → E10051), a named annotated type reports its own name, and a malformed
 * annotation type keeps one root cause (its own parse diagnostic, no
 * signature error on top).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type { Diagnostic, DiagnosticBag, ProgramNode } from "@blend65/core";
import { analyze, lex, parse } from "../index.js";

/** Lexes + parses + analyzes one source through the public entries. */
function analyzeOne(source: string): Diagnostic[] {
  const bag: DiagnosticBag = createDiagnosticBag();
  const { tokens } = lex(1, source, bag);
  const ast: ProgramNode = parse({ tokens, source, sourceId: 1, bag }).ast;
  analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  return bag.getAll();
}

/** Parse-only diagnostics for one source. */
function parseOne(source: string): Diagnostic[] {
  const bag: DiagnosticBag = createDiagnosticBag();
  const { tokens } = lex(1, source, bag);
  parse({ tokens, source, sourceId: 1, bag });
  return bag.getAll();
}

describe("interrupt declaration internals", () => {
  it("keeps rejecting `export interrupt` with E10311", () => {
    const codes = parseOne("module Main;\nexport interrupt function h() { }\n").map((d) => d.code);
    expect(codes).toContain(DiagCode.ExportNotAllowed);
  });

  it("keeps rejecting a direct handler call with E10051", () => {
    const codes = analyzeOne(
      [
        "module Main;",
        "interrupt function h() { }",
        "function main(): void { h(); }",
      ].join("\n"),
    ).map((d) => d.code);
    expect(codes).toContain(DiagCode.CallToInterruptFunction);
  });

  it("names the annotated type in the signature rejection", () => {
    const diags = parseOne("module Main;\ninterrupt function h(): byte { }\n");
    const sig = diags.find((d) => d.code === DiagCode.InterruptWrongSignature);
    expect(sig).toBeDefined();
    expect(sig!.message).toContain("'byte'");
    expect(sig!.message).toContain("(): void");
  });

  it("reports one root cause for a malformed annotation type", () => {
    const diags = parseOne("module Main;\ninterrupt function h(): { }\n");
    expect(diags.length).toBeGreaterThan(0);
    expect(diags.map((d) => d.code)).not.toContain(DiagCode.InterruptWrongSignature);
  });
});
