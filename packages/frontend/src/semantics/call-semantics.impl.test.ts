/**
 * Implementation tests for the call-semantics internals — signature-cache
 * reuse, poison-cascade discipline at argument positions, constant-argument
 * range checking, the user-module-wins import precedence edge, and import
 * resolution against the one merged scope of a module that spans files.
 */

import { describe, expect, it } from "vitest";
import {
  createDiagnosticBag,
  createScope,
  DEFAULT_PROFILE,
  DiagCode,
} from "@blend65/core";
import type {
  AstNode,
  Diagnostic,
  DiagnosticBag,
  ExprNode,
  SourceSpan,
  Symbol,
  Type,
} from "@blend65/core";
import { lex, parse, analyze } from "../index.js";
import { collectFunctions } from "./function-collection.js";
import { typeCheckPrograms } from "./type-check/statement-typing.js";
import type { FnSignature } from "./type-check/context.js";

/** Lexes + parses each source (ids 1..n) + analyzes them together. */
function analyzeMulti(sources: readonly string[]): Diagnostic[] {
  const bag: DiagnosticBag = createDiagnosticBag();
  const programs = sources.map((source, i) => {
    const { tokens } = lex(i + 1, source, bag);
    return parse({ tokens, source, sourceId: i + 1, bag }).ast;
  });
  analyze({ programs, bag, profile: DEFAULT_PROFILE });
  return bag.getAll();
}

describe("call typing internals", () => {
  it("caches one signature per callee across multiple call sites", () => {
    const bag = createDiagnosticBag();
    const source =
      "module Main;\n" +
      "function add(a: byte, b: byte): byte { return a + b; }\n" +
      "function main(): void { let r: byte = add(1, 2); let s: byte = add(3, 4); }\n";
    const { tokens } = lex(1, source, bag);
    const program = parse({ tokens, source, sourceId: 1, bag }).ast;
    const globalScope = createScope("global", null, null);
    const tables = collectFunctions([program], globalScope, bag);

    const signatures = new Map<Symbol, FnSignature>();
    typeCheckPrograms([program], tables.scopeByNode, {
      bag,
      typeMap: new Map<ExprNode, Type>(),
      symbolMap: new Map<AstNode, Symbol>(),
      signatures,
      mainFunction: tables.mainFunction,
      callEdges: new Map<Symbol, Set<Symbol>>(),
      callSiteSpans: new Map<Symbol, Map<Symbol, SourceSpan>>(),
      moduleScopes: tables.moduleScopeByName,
    });

    // Two call sites, one cached signature (for `add`).
    expect(signatures.size).toBe(1);
    const [sig] = signatures.values();
    expect(sig.params.map((p) => p.name)).toEqual(["a", "b"]);
  });

  it("suppresses the per-argument mismatch for a poisoned argument (one root cause)", () => {
    const codes = analyzeMulti([
      "module Main;\n" +
        "function add(a: byte, b: byte): byte { return a + b; }\n" +
        "function main(): void { let r: byte = add(nope, 1); }\n",
    ]).map((d) => d.code);
    expect(codes.filter((c) => c === DiagCode.UndeclaredIdentifier)).toHaveLength(1);
    expect(codes).not.toContain(DiagCode.ArgTypeMismatch);
  });

  it("range-checks a constant argument against its parameter type", () => {
    const codes = analyzeMulti([
      "module Main;\n" +
        "function add(a: byte, b: byte): byte { return a + b; }\n" +
        "function main(): void { let r: byte = add(300, 1); }\n",
    ]).map((d) => d.code);
    expect(codes).toContain(DiagCode.ValueOutOfRange);
  });
});

describe("import precedence and module-name collision", () => {
  it("resolves an import from a user module named like a platform id (user wins)", () => {
    const diags = analyzeMulti([
      "module Main;\n" +
        "import { probe } from c64;\n" +
        "function main(): void { probe(); }\n",
      "module c64;\n" + "export function probe(): void {}\n",
    ]);
    expect(diags).toEqual([]);
  });

  it("resolves imports against the ONE merged scope when a module spans files", () => {
    // Both Math files contribute exports to the same module scope, so a single
    // import statement can name declarations from either file.
    const diags = analyzeMulti([
      "module Main;\n" +
        "import { add, mul } from Math;\n" +
        "function main(): void { add(); mul(); }\n",
      "module Math;\n" + "export function add(): void {}\n",
      "module Math;\n" + "export function mul(): void {}\n",
    ]);
    expect(diags).toEqual([]);
  });
});
