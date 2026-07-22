/**
 * Implementation tests for the nested block scopes local collection builds, and
 * for the per-use name resolution they exist to make possible.
 *
 * Two sibling blocks may each declare the same name. Sharing one frame slot is
 * intended; resolving both declarations to whichever one was collected last is
 * not — a use in the first arm would then read the second arm's type and either
 * truncate a value or, as here, draw a diagnostic meant for another variable
 * entirely. These tests pin the resolution itself: each use sees its own
 * declaration, siblings stay silent, and nesting still reports.
 *
 * The scopes deliberately do NOT introduce block-scope lifetime — a use after
 * its declaring block still resolves, exactly as it did before — so that is
 * pinned here too, to catch it changing by accident.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, createScope, DEFAULT_PROFILE } from "@blend65/core";
import type { Diagnostic, ProgramNode, Scope } from "@blend65/core";
import { lex, parse, analyze } from "../index.js";
import { collectFunctions } from "./function-collection.js";

const SRC = 1;

/** Compiles `source` through the real frontend and returns its diagnostics. */
function diagnose(source: string): Diagnostic[] {
  const bag = createDiagnosticBag();
  const { tokens } = lex(SRC, source, bag);
  const { ast }: { ast: ProgramNode } = parse({ tokens, source, sourceId: SRC, bag });
  analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  return bag.getAll();
}

/** The diagnostic codes emitted for `source`. */
function codes(source: string): string[] {
  return diagnose(source).map((d) => d.code);
}

/** Runs Pass-1 collection over `source` and returns its tables. */
function collect(source: string): ReturnType<typeof collectFunctions> {
  const bag = createDiagnosticBag();
  const { tokens } = lex(SRC, source, bag);
  const { ast }: { ast: ProgramNode } = parse({ tokens, source, sourceId: SRC, bag });
  return collectFunctions([ast], createScope("global", null, null), bag);
}

/** Every local name reachable from `scope`, including its nested block scopes. */
function localNames(scope: Scope): string[] {
  const names: string[] = [];
  const visit = (s: Scope): void => {
    for (const sym of s.symbols.values()) if (sym.kind === "variable") names.push(sym.name);
    for (const child of s.children) visit(child);
  };
  visit(scope);
  return names;
}

describe("local collection — the flat function scope is unchanged", () => {
  it("registers every local in the function scope, in declaration order", () => {
    const tables = collect(
      "module Main;\nfunction main(): void { let a: byte = 1;\n" +
        "if (a) { let b: byte = 2; }\nfor (let i: byte = 0 to 3) { let d: byte = 4; }\n" +
        "let e: byte = 5; }\n",
    );
    const bodyScope = [...tables.scopeByNode.values()][0];
    expect(bodyScope).toBeDefined();

    // Declaration order — nested locals and the loop counter included — is what
    // the frame layout reads, and it must not depend on the block nesting.
    const flat = [...(bodyScope?.symbols.values() ?? [])]
      .filter((s) => s.kind === "variable")
      .map((s) => s.name);
    expect(flat).toEqual(["a", "b", "i", "d", "e"]);
  });

  it("keeps a repeated name at its first position in the flat scope", () => {
    const tables = collect(
      "module Main;\nfunction main(): void { let c: boolean = true;\n" +
        "if (c) { let t: word = 300; } else { let t: byte = 5; }\nlet u: byte = 7; }\n",
    );
    const bodyScope = [...tables.scopeByNode.values()][0];
    const flat = [...(bodyScope?.symbols.values() ?? [])]
      .filter((s) => s.kind === "variable")
      .map((s) => s.name);

    // One entry for the shared name, sitting where it was first declared.
    expect(flat).toEqual(["c", "t", "u"]);
  });
});

describe("local collection — nested block scopes", () => {
  it("gives each sibling arm its own scope holding its own declaration", () => {
    const tables = collect(
      "module Main;\nfunction main(): void { let c: boolean = true;\n" +
        "if (c) { let t: word = 300; } else { let t: byte = 5; } }\n",
    );
    const bodyScope = [...tables.scopeByNode.values()][0];
    expect(bodyScope).toBeDefined();
    if (bodyScope === undefined) return;

    // Both declarations survive collection — the widths the two arms need are
    // still distinguishable, which the flat scope alone cannot express.
    const ts = localNames(bodyScope).filter((n) => n === "t");
    expect(ts.length).toBeGreaterThanOrEqual(2);
  });

  it("indexes a scope for each block-introducing node", () => {
    const tables = collect(
      "module Main;\nfunction main(): void { let c: boolean = true;\n" +
        "if (c) { let t: byte = 1; } else { let t: byte = 2; }\n" +
        "for (let i: byte = 0 to 3) { let d: byte = 4; }\n" +
        "switch (t) { case 1: let s: byte = 1; default: let s: byte = 2; } }\n",
    );

    // The function body, both `if` arms, the loop and its body, and both switch
    // clauses each own a scope; the exact count is layout, the kinds are not.
    const kinds = [...tables.blockScopeByNode.values()].map((s) => s.kind);
    expect(kinds.length).toBeGreaterThanOrEqual(7);
    expect(new Set(kinds)).toEqual(new Set(["block"]));
  });
});

describe("per-use resolution — each use reads its own declaration", () => {
  it("does not judge a use in one loop against the counter of the next", () => {
    // Both loops name their counter `i`, at different widths. The byte loop's
    // `poke` is only legal against ITS counter; resolving through the word
    // counter would reject a program that is perfectly well-formed.
    const source =
      "module Main;\nfunction main(): void {\n" +
      "for (let i: byte = 0 to 9) { poke($D020, i); }\n" +
      "for (let i: word = 0 to 9) { pokew($D000, i); }\n}\n";
    expect(codes(source)).toEqual([]);
  });

  it("does not judge a use in one arm against the declaration in the other", () => {
    const source =
      "module Main;\nfunction main(): void { let c: boolean = true;\n" +
      "if (c) { let t: word = 300; pokew($D000, t); }\n" +
      "else { let t: byte = 5; poke($D020, t); } }\n";
    expect(codes(source)).toEqual([]);
  });

  it("still resolves a use that follows its declaring block", () => {
    // Block-scope LIFETIME is deliberately not introduced here: a name declared
    // inside a block stays visible after it, exactly as before.
    const source =
      "module Main;\nfunction main(): void { let c: boolean = true;\n" +
      "if (c) { let t: byte = 5; }\npoke($D020, t); }\n";
    expect(codes(source)).not.toContain("E10100");
  });
});

describe("reuse diagnostics — nesting reports, siblings do not", () => {
  it("reports a nested counter reusing its enclosing counter, not a sibling one", () => {
    const nested =
      "module Main;\nfunction main(): void {\n" +
      "for (let i: byte = 0 to 9) { for (let i: byte = 0 to 3) { poke($D020, i); } } }\n";
    const siblings =
      "module Main;\nfunction main(): void {\n" +
      "for (let i: byte = 0 to 9) { poke($D020, i); }\n" +
      "for (let i: byte = 0 to 3) { poke($D021, i); } }\n";

    expect(codes(nested)).toContain("E10062");
    expect(codes(siblings)).toEqual([]);
  });

  it("reports a second declaration in one scope but not one per arm", () => {
    const duplicate = "module Main;\nfunction main(): void { let t: byte = 1; let t: byte = 2; }\n";
    const siblings =
      "module Main;\nfunction main(): void { let c: boolean = true;\n" +
      "if (c) { let t: byte = 1; } else { let t: byte = 2; } }\n";

    expect(codes(duplicate)).toContain("E10003");
    expect(codes(siblings)).toEqual([]);
  });

  it("reports a local shadowing an enclosing block's local", () => {
    const source =
      "module Main;\nfunction main(): void { let c: boolean = true;\n" +
      "let t: byte = 1;\nif (c) { let t: byte = 2; poke($D020, t); } }\n";
    expect(codes(source)).toContain("E10101");
  });

  it("reports a local shadowing a parameter and one shadowing a module variable", () => {
    const param = "module Main;\nfunction f(a: byte): void { let a: byte = 1; }\n";
    const moduleVar =
      "module Main;\nlet g: byte = 1;\nfunction main(): void { let g: byte = 2; }\n";

    expect(codes(param)).toContain("E10101");
    expect(codes(moduleVar)).toContain("E10101");
  });

  it("stays silent on sibling clause bodies of one switch", () => {
    const source =
      "module Main;\nfunction main(): void { let k: byte = 1;\n" +
      "switch (k) { case 1: let t: byte = 1; poke($D020, t);\n" +
      "default: let t: word = 300; pokew($D000, t); } }\n";
    expect(codes(source)).toEqual([]);
  });

  it("reports every offender, not just the first, when siblings shadow one parameter", () => {
    // Each arm shadows the parameter independently, so each is its own error —
    // the check must not be answerable only once per name.
    const source =
      "module Main;\nfunction f(a: byte): void { let c: boolean = true;\n" +
      "if (c) { let a: byte = 1; } else { let a: byte = 2; } }\n";
    expect(codes(source).filter((code) => code === "E10101")).toHaveLength(2);
  });

  it("leaves a local named after a module function, constant, struct or enum alone", () => {
    // Only a module VARIABLE is storage a local can hide. Rejecting a local
    // that merely shares a name with a function or a type would outlaw
    // ordinary code and could not cause a shared-slot miscompile.
    const sources = [
      "module Main;\nfunction clear(): void { }\nfunction main(): void { let clear: byte = 1; }\n",
      "module Main;\nconst N: byte = 4;\nfunction main(): void { let N: byte = 1; }\n",
      "module Main;\nstruct P { x: byte; }\nfunction main(): void { let P: byte = 1; }\n",
      "module Main;\nenum C { Red = 1 }\nfunction main(): void { let C: byte = 1; }\n",
    ];
    for (const source of sources) expect(codes(source)).not.toContain("E10101");
  });
});
