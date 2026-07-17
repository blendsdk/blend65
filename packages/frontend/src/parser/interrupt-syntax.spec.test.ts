/**
 * Specification tests for interrupt declaration syntax — frozen spec Ch 06
 * §7.2. The signature is always `(): void`: the bare form
 * `interrupt function name() { }` is canonical, an explicit `: void`
 * annotation is accepted and means the same thing, and any other annotated
 * type rejects with E10050 while the block still parses (error-tolerant
 * recovery keeps the tree complete).
 *
 * These tests derive from the frozen spec only — they are the immutable
 * oracle for the parser surface: a failure here means the parser is wrong,
 * never the test.
 */

import { describe, expect, it } from "vitest";
import { DiagCode, createDiagnosticBag } from "@blend65/core";
import type { DiagnosticBag, InterruptDeclNode } from "@blend65/core";
import { lex, parse } from "../index.js";

/** The synthetic source id used by every parse in this file. */
const SRC = 1;

/** Lexes `source` then parses it through the public `parse()` entry. */
function parseSource(source: string, bag: DiagnosticBag) {
  const { tokens } = lex(SRC, source, bag);
  return parse({ tokens, source, sourceId: SRC, bag });
}

/** The first top-level interrupt declaration, or a loud failure. */
function interruptOf(items: readonly { kind: string }[]): InterruptDeclNode {
  const decl = items.find((i) => i.kind === "InterruptDecl");
  if (decl === undefined) throw new Error("expected an InterruptDecl item");
  return decl as InterruptDeclNode;
}

describe("interrupt declaration syntax (ST-11..ST-13)", () => {
  it("ST-11: should parse the bare form `interrupt function h() { }`", () => {
    const bag = createDiagnosticBag();
    const { ast, hasErrors } = parseSource("module Main;\ninterrupt function h() { }\n", bag);
    expect(hasErrors).toBe(false);
    expect(bag.getAll()).toHaveLength(0);
    const decl = interruptOf(ast.items);
    expect(decl.name).toBe("h");
    expect(decl.body.statements).toHaveLength(0);
  });

  it("ST-12: should parse `interrupt function h(): void { }` identically — the annotation is consumed", () => {
    const bag = createDiagnosticBag();
    const { ast, hasErrors } = parseSource(
      "module Main;\ninterrupt function h(): void { poke($D019, $FF); }\n",
      bag,
    );
    expect(hasErrors).toBe(false);
    expect(bag.getAll()).toHaveLength(0);
    const decl = interruptOf(ast.items);
    expect(decl.name).toBe("h");
    expect(decl.body.statements).toHaveLength(1);
  });

  it("ST-13: should reject `interrupt function h(): word { }` with E10050 and still parse the block", () => {
    const bag = createDiagnosticBag();
    const { ast, hasErrors } = parseSource(
      "module Main;\ninterrupt function h(): word { poke($D019, $FF); }\n",
      bag,
    );
    expect(hasErrors).toBe(true);
    const codes = bag.getAll().map((d) => d.code);
    expect(codes).toContain(DiagCode.InterruptWrongSignature);
    const decl = interruptOf(ast.items);
    expect(decl.name).toBe("h");
    expect(decl.body.statements).toHaveLength(1);
  });
});
