/**
 * Implementation tests for module-initializer internals — const-of-const
 * chains (including `lo`/`hi` folding over evaluated consts), the
 * importer→imported edge map import resolution returns, cycle-member behavior
 * (dropped from the init order; consts in a definition cycle evaluate no
 * value while their acyclic siblings still do), the initializer-less-variable
 * non-edge, and mixed byte/word declaration ordering.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, createScope, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type {
  Diagnostic,
  DiagnosticBag,
  ModuleDeclNode,
  ProgramNode,
  Scope,
  SemanticModel,
} from "@blend65/core";
import { lex, parse, analyze } from "../index.js";
import { collectFunctions } from "./function-collection.js";
import { resolveImports } from "./import-resolution.js";

/** Lexes + parses each source (ids 1..n); optionally analyzes them together. */
function parseAll(sources: readonly string[], bag: DiagnosticBag): ProgramNode[] {
  return sources.map((source, i) => {
    const { tokens } = lex(i + 1, source, bag);
    return parse({ tokens, source, sourceId: i + 1, bag }).ast;
  });
}

/** Full analysis over the sources, returning diagnostics + model. */
function analyzeMulti(sources: readonly string[]): {
  diags: Diagnostic[];
  model: SemanticModel;
} {
  const bag: DiagnosticBag = createDiagnosticBag();
  const programs = parseAll(sources, bag);
  const model = analyze({ programs, bag, profile: DEFAULT_PROFILE });
  return { diags: bag.getAll(), model };
}

/** The module scope named `name` hanging off the model's global scope. */
function moduleScopeOf(model: SemanticModel, name: string): Scope {
  const scope = model.globalScope.children.find(
    (c) =>
      c.kind === "module" &&
      c.node?.kind === "ModuleDecl" &&
      (c.node as ModuleDeclNode).name === name,
  );
  if (scope === undefined) throw new Error(`model has no module scope '${name}'`);
  return scope;
}

/** The evaluated const value of `name` in module `moduleName`, or undefined. */
function constValueOf(
  model: SemanticModel,
  moduleName: string,
  name: string,
): number | boolean | undefined {
  const sym = moduleScopeOf(model, moduleName).symbols.get(name);
  return sym === undefined ? undefined : model.constValues.get(sym)?.value;
}

describe("module-init internals", () => {
  it("evaluates const-of-const chains including lo/hi over evaluated consts", () => {
    const { diags, model } = analyzeMulti([
      "module Main;\n" +
        "const ADDR: word = $0407;\n" +
        "const HIGH: byte = hi(ADDR);\n" +
        "const LOW: byte = lo(ADDR);\n" +
        "const SUM: byte = HIGH + LOW;\n" +
        "function main(): void {}\n",
    ]);
    expect(diags).toEqual([]);
    expect(constValueOf(model, "Main", "ADDR")).toBe(0x0407);
    expect(constValueOf(model, "Main", "HIGH")).toBe(0x04);
    expect(constValueOf(model, "Main", "LOW")).toBe(0x07);
    expect(constValueOf(model, "Main", "SUM")).toBe(0x0b);
  });

  it("returns the importer→imported module relation from import resolution", () => {
    const bag = createDiagnosticBag();
    const programs = parseAll(
      [
        "module Main;\nimport { f } from Math;\nfunction main(): void { f(); }\n",
        "module Math;\nexport function f(): void {}\n",
        // A second Math file importing from its own module: self-imports
        // resolve against the same merged scope and record no edge.
        "module Math;\nimport { f } from Math;\nexport function g(): void { f(); }\n",
      ],
      bag,
    );
    // A fresh global scope is enough — import resolution only needs the
    // module scopes the collector creates.
    const tables = collectFunctions(programs, createScope("global", null, null), bag);
    const importEdges = resolveImports(
      programs,
      tables.moduleScopeByProgram,
      tables.moduleScopeByName,
      bag,
    );
    expect([...(importEdges.get("Main") ?? [])]).toEqual(["Math"]);
    expect(importEdges.has("Math")).toBe(false);
  });

  it("drops let-cycle members from the init order while siblings keep theirs", () => {
    const { diags, model } = analyzeMulti([
      "module Main;\n" +
        "let a: byte = b;\n" +
        "let b: byte = a;\n" +
        "let c: byte = 5;\n" +
        "function main(): void {}\n",
    ]);
    expect(diags.filter((d) => d.code === DiagCode.CircularInit)).toHaveLength(1);
    expect(model.initOrder.map((s) => s.name)).toEqual(["c"]);
    expect(model.hasErrors).toBe(true);
  });

  it("poisons const-cycle members (no value) while acyclic consts still evaluate", () => {
    const { diags, model } = analyzeMulti([
      "module Main;\n" +
        "const A: byte = B;\n" +
        "const B: byte = A;\n" +
        "const C: byte = 7;\n" +
        "function main(): void {}\n",
    ]);
    expect(diags.filter((d) => d.code === DiagCode.CircularInit)).toHaveLength(1);
    expect(constValueOf(model, "Main", "A")).toBeUndefined();
    expect(constValueOf(model, "Main", "B")).toBeUndefined();
    expect(constValueOf(model, "Main", "C")).toBe(7);
  });

  it("treats a read of an initializer-less variable as a non-edge", () => {
    const { diags, model } = analyzeMulti([
      "module Main;\n" +
        "let u: byte;\n" +
        "let x: byte = u + 1;\n" +
        "function main(): void {}\n",
    ]);
    // Legal (the value is indeterminate until assigned); `u` has no init
    // position, so only `x` appears — and no cycle machinery is involved.
    expect(diags).toEqual([]);
    expect(model.initOrder.map((s) => s.name)).toEqual(["x"]);
  });

  it("keeps declaration order across mixed byte/word initializers", () => {
    const { diags, model } = analyzeMulti([
      "module Main;\n" +
        "let w: word = $0102;\n" +
        "let b: byte = 3;\n" +
        "let c: word = w + 1;\n" +
        "function main(): void {}\n",
    ]);
    expect(diags).toEqual([]);
    expect(model.initOrder.map((s) => s.name)).toEqual(["w", "b", "c"]);
  });
});
