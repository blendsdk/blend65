/**
 * Implementation tests for `collectFunctions` — internals and edge cases
 * beyond the spec oracles: multi-local declaration order, an empty body, a
 * function-free program, and an interrupt declaration.
 *
 * Programs are lexed + parsed through the real frontend entry points (prefer real
 * objects). These import `collectFunctions` directly (it is internal to `analyze`
 * and not re-exported from the package barrel).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, createScope } from "@blend65/core";
import type { DiagnosticBag, ProgramNode, Scope } from "@blend65/core";
import { lex, parse } from "../index.js";
import { collectFunctions } from "./function-collection.js";

const SRC = 1;

/** Lexes + parses `source` through the public entry points, returning the AST. */
function parseSource(source: string, bag: DiagnosticBag): ProgramNode {
  const { tokens } = lex(SRC, source, bag);
  const { ast } = parse({ tokens, source, sourceId: SRC, bag });
  return ast;
}

/** A fresh global scope for each collection. */
function freshGlobal(): Scope {
  return createScope("global", null, null);
}

describe("collectFunctions — internals & edges (Slice 3a)", () => {
  it("collects two locals in declaration order with their primitive types", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(
      `module Main;\nfunction main(): void { let a: byte = 1; let b: word = 2; }\n`,
      bag,
    );

    const tables = collectFunctions([program], freshGlobal());
    const main = [...tables.functions][0];
    const body = tables.scopeByNode.get(main!.decl);
    const locals = [...(body?.symbols.values() ?? [])];

    expect(locals.map((s) => s.name)).toEqual(["a", "b"]);
    expect(locals.map((s) => s.type)).toEqual([
      { kind: "primitive", name: "byte" },
      { kind: "primitive", name: "word" },
    ]);
  });

  it("registers a function with an empty body and no locals", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(`module Main;\nfunction main(): void { }\n`, bag);

    const tables = collectFunctions([program], freshGlobal());

    expect(tables.functions.size).toBe(1);
    const main = [...tables.functions][0];
    expect(tables.scopeByNode.get(main!.decl)?.symbols.size).toBe(0);
    expect(tables.mainFunction).toBe(main);
  });

  it("yields empty tables for a function-free program", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(`module Data;\nstruct Point { x: byte; y: byte; }\n`, bag);

    const tables = collectFunctions([program], freshGlobal());

    expect(tables.functions.size).toBe(0);
    expect(tables.mainFunction).toBeNull();
  });

  it("registers an interrupt declaration with kind 'interrupt' (not the entry)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(`module Main;\ninterrupt vblank() { let t: byte = 0; }\n`, bag);

    const tables = collectFunctions([program], freshGlobal());

    expect(tables.functions.size).toBe(1);
    const sym = [...tables.functions][0];
    expect(sym?.kind).toBe("interrupt");
    expect(tables.mainFunction).toBeNull(); // an interrupt is never the entry
    expect(tables.scopeByNode.get(sym!.decl)?.symbols.get("t")?.kind).toBe("variable");
  });
});
