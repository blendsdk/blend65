/**
 * Implementation tests for module-merging internals — the merged scope's
 * representative node (the FIRST file's module declaration, deterministic by
 * program order), variable insertion order across a merged module's files
 * (file discovery order × declaration order — the ordinal basis for module
 * initialization ordering), a three-file merge, and a self-import written in
 * a later file of the same module (skipped silently — the names already live
 * in the one shared scope).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type {
  Diagnostic,
  DiagnosticBag,
  ModuleDeclNode,
  ProgramNode,
  Scope,
  SemanticModel,
} from "@blend65/core";
import { lex, parse, analyze } from "../index.js";

/** Lexes + parses each source (ids 1..n) + analyzes them together. */
function analyzeMulti(sources: readonly string[]): {
  diags: Diagnostic[];
  model: SemanticModel;
  programs: ProgramNode[];
} {
  const bag: DiagnosticBag = createDiagnosticBag();
  const programs = sources.map((source, i) => {
    const { tokens } = lex(i + 1, source, bag);
    return parse({ tokens, source, sourceId: i + 1, bag }).ast;
  });
  const model = analyze({ programs, bag, profile: DEFAULT_PROFILE });
  return { diags: bag.getAll(), model, programs };
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

const MAIN_EMPTY = "module Main;\nfunction main(): void {}\n";

describe("module merging internals", () => {
  it("keeps the FIRST file's module declaration as the merged scope's node", () => {
    const { diags, model, programs } = analyzeMulti([
      "module Math;\nexport function f(): byte { return 1; }\n",
      "module Math;\nexport function g(): byte { return 2; }\n",
      MAIN_EMPTY,
    ]);
    expect(diags).toEqual([]);
    const mathScope = moduleScopeOf(model, "Math");
    expect(mathScope.node).toBe(programs[0].moduleDecl);
    expect(mathScope.node).not.toBe(programs[1].moduleDecl);
  });

  it("orders a merged module's variables by file discovery order × declaration order", () => {
    const { diags, model } = analyzeMulti([
      "module Math;\nexport let alpha: byte;\nexport let bravo: byte;\n",
      "module Math;\nexport let charlie: byte;\n",
      MAIN_EMPTY,
    ]);
    expect(diags).toEqual([]);
    const variables = [...moduleScopeOf(model, "Math").symbols.values()]
      .filter((s) => s.kind === "variable")
      .map((s) => s.name);
    expect(variables).toEqual(["alpha", "bravo", "charlie"]);
  });

  it("merges three files into one scope with cross-file bare calls resolving", () => {
    const { diags, model } = analyzeMulti([
      "module M;\nexport function a(): byte { return 1; }\n",
      "module M;\nexport function b(): byte { return a() + 1; }\n",
      "module M;\nexport function c(): byte { return b() + a(); }\n",
      MAIN_EMPTY,
    ]);
    expect(diags).toEqual([]);
    const mScope = moduleScopeOf(model, "M");
    expect([...mScope.symbols.keys()]).toEqual(["a", "b", "c"]);
    // Exactly one module scope named M exists.
    const mScopes = model.globalScope.children.filter(
      (s) =>
        s.kind === "module" &&
        s.node?.kind === "ModuleDecl" &&
        (s.node as ModuleDeclNode).name === "M",
    );
    expect(mScopes).toHaveLength(1);
  });

  it("skips a self-import written in a later file of the same module silently", () => {
    const { diags } = analyzeMulti([
      "module Math;\nexport function f(): byte { return 1; }\n",
      // Importing from the module this file itself belongs to: the names
      // already live in the shared scope, so nothing is aliased and nothing
      // collides.
      "module Math;\nimport { f } from Math;\nexport function g(): byte { return f(); }\n",
      MAIN_EMPTY,
    ]);
    expect(diags).toEqual([]);
  });
});
