/**
 * Specification tests for `collectFunctions` — the Pass-1 function + local
 * collector.
 *
 * Expectations derive exclusively from the requirements, the component spec,
 * and the `Scope`/`Symbol` contracts in `@blend65/core` — NOT from
 * implementation logic. Immutable oracle.
 *
 * The programs are lexed + parsed through the real frontend entry points (prefer
 * real objects); `collectFunctions` is exercised directly with a fresh global
 * scope.
 *
 * Red-vs-green-guard: one case is **expected-red** (the collector does not
 * exist yet); another is a **green-guard** invariant (a body-less-of-locals
 * function still registers with zero variable symbols).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, createScope } from "@blend65/core";
import type {
  AstNode,
  DiagnosticBag,
  FunctionDeclNode,
  ModuleDeclNode,
  ProgramNode,
  Scope,
} from "@blend65/core";
import { lex, parse } from "../index.js";
import { collectFunctions } from "./function-collection.js";

/** The synthetic source id used by every parse in this file. */
const SRC = 1;

/** Fixture: one `main` with a single local `byte`. */
const FIXTURE_SOURCE = `module Main;\nfunction main(): void { let x: byte = 5; poke(0xD020, x); }\n`;

/** A `main` with a body but no locals. */
const NO_LOCALS_SOURCE = `module Main;\nfunction main(): void { poke(0xD020, 5); }\n`;

/** Lexes + parses `source` through the public entry points, returning the AST. */
function parseSource(source: string, bag: DiagnosticBag): ProgramNode {
  const { tokens } = lex(SRC, source, bag);
  const { ast } = parse({ tokens, source, sourceId: SRC, bag });
  return ast;
}

/** Narrows a scope's introducing node to a {@link ModuleDeclNode}. */
function isModuleDecl(node: AstNode | null): node is ModuleDeclNode {
  return node !== null && node.kind === "ModuleDecl";
}

/** The `main` `FunctionDecl` in a parsed program. */
function mainDeclOf(program: ProgramNode): FunctionDeclNode {
  const decl = program.items.find(
    (item): item is FunctionDeclNode => item.kind === "FunctionDecl" && item.name === "main",
  );
  if (decl === undefined) throw new Error("test fixture must declare main");
  return decl;
}

describe("Specification: collectFunctions (RD-18 Slice 3a, FR-1)", () => {
  // The fixture yields the FunctionTables shape: main in a module scope,
  // mainFunction set, and the body scope holding `x` as an ordered variable symbol.
  it("should collect main (module Main) with the ordered local x (ST-2)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(FIXTURE_SOURCE, bag);
    const globalScope: Scope = createScope("global", null, null);

    const tables = collectFunctions([program], globalScope);

    // functions == { main }; mainFunction == main
    expect(tables.functions.size).toBe(1);
    const main = [...tables.functions][0];
    expect(main?.name).toBe("main");
    expect(main?.kind).toBe("function");
    expect(tables.mainFunction).toBe(main);

    // main.scope is a kind:"module" scope whose node.name === "Main"
    expect(main?.scope.kind).toBe("module");
    const modNode = main?.scope.node ?? null;
    expect(isModuleDecl(modNode) ? modNode.name : null).toBe("Main");

    // scopeByNode.get(mainDecl) is the body scope holding `x` as a variable symbol
    const bodyScope = tables.scopeByNode.get(mainDeclOf(program));
    expect(bodyScope?.kind).toBe("function");
    const xSym = bodyScope?.symbols.get("x");
    expect(xSym?.kind).toBe("variable");
    expect(xSym?.type).toEqual({ kind: "primitive", name: "byte" });
    // insertion order == declaration order: x is the sole, first variable
    expect([...(bodyScope?.symbols.values() ?? [])].map((s) => s.name)).toEqual(["x"]);
  });

  // A function with a body but no locals still registers with zero variables.
  it("should register a body-with-no-locals main with an empty variable set (ST-4b)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(NO_LOCALS_SOURCE, bag);
    const globalScope: Scope = createScope("global", null, null);

    const tables = collectFunctions([program], globalScope);

    expect(tables.functions.size).toBe(1);
    const bodyScope = tables.scopeByNode.get(mainDeclOf(program));
    expect(bodyScope).toBeDefined();
    const vars = [...(bodyScope?.symbols.values() ?? [])].filter((s) => s.kind === "variable");
    expect(vars).toHaveLength(0);
  });
});
