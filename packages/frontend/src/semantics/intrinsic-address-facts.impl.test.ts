/**
 * Implementation tests for constant-address facts attached to memory calls.
 *
 * The backend consumes these facts by call-node identity. These tests keep the
 * frontend seam independent: only fully typed, scalar-integer expressions in
 * the hardware address range receive a fact, while every ambiguous or invalid
 * expression remains absent without this analysis adding a diagnostic.
 */

import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { Diagnostic, ProgramNode, SemanticModel } from "@blend65/core";
import { describe, expect, it } from "vitest";

import { analyze, lex, parse } from "../index.js";

/** Parses and analyzes one source file through the real frontend. */
function analyzeSource(source: string): {
  readonly diagnostics: readonly Diagnostic[];
  readonly model: SemanticModel;
  readonly program: ProgramNode;
} {
  const bag = createDiagnosticBag();
  const { tokens } = lex(1, source, bag);
  const { ast } = parse({ tokens, source, sourceId: 1, bag });
  const model = analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  return { diagnostics: bag.getAll(), model, program: ast };
}

/** Returns the recorded `(intrinsic name, address)` pairs in source order. */
function addressFacts(model: SemanticModel): readonly (readonly [string, number])[] {
  return [...model.constantIntrinsicAddresses].map(([call, address]) => [call.name, address]);
}

describe("constant memory-intrinsic address facts", () => {
  it("should record composed addresses for every direct-memory intrinsic", () => {
    const source = [
      "module Main;",
      "const BASE: word = $D020;",
      "function read(): byte { return peek(BASE + 1); }",
      "function readWord(): word { return peekw(BASE + 2); }",
      "function main(): void { poke(BASE + 3, 4); pokew(BASE + 4, $1234); }",
    ].join("\n");
    const { diagnostics, model } = analyzeSource(source);

    expect(diagnostics).toEqual([]);
    expect(addressFacts(model)).toEqual([
      ["peek", 0xd021],
      ["peekw", 0xd022],
      ["poke", 0xd023],
      ["pokew", 0xd024],
    ]);
  });

  it("should record literal, named, and composed spellings at their exact call sites", () => {
    const source = [
      "module Main;",
      "const BASE: word = $D020;",
      "function main(): void {",
      "  peek($D020);",
      "  peek(BASE);",
      "  peek(BASE + 1);",
      "}",
    ].join("\n");
    const { diagnostics, model } = analyzeSource(source);

    expect(diagnostics).toEqual([]);
    expect(addressFacts(model)).toEqual([
      ["peek", 0xd020],
      ["peek", 0xd020],
      ["peek", 0xd021],
    ]);
    expect([...model.constantIntrinsicAddresses.keys()][0]).not.toBe(
      [...model.constantIntrinsicAddresses.keys()][1],
    );
  });

  it.each([
    [
      "runtime data",
      [
        "module Main;",
        "function main(): void { let address: word = $D020; peek(address + 1); }",
      ].join("\n"),
      [],
    ],
    [
      "a poisoned reference",
      [
        "module Main;",
        "const BAD: word = missing;",
        "function main(): void { peek(BAD + 1); }",
      ].join("\n"),
      ["E10100"],
    ],
    ["constant division by zero", "module Main;\nfunction main(): void { peek(1 / 0); }", []],
    ["a boolean", "module Main;\nfunction main(): void { peek(true); }", []],
    [
      "an aggregate constant",
      [
        "module Main;",
        "const BYTES: byte[2] = [1, 2];",
        "function main(): void { peek(BYTES); }",
      ].join("\n"),
      [],
    ],
    [
      "an out-of-range result",
      [
        "module Main;",
        "const BASE: word = $FFFF;",
        "function main(): void { peek(BASE + 1); }",
      ].join("\n"),
      [],
    ],
  ])("should omit a fact for %s", (_description, source, expectedCodes) => {
    const { diagnostics, model } = analyzeSource(source);
    expect(model.constantIntrinsicAddresses.size).toBe(0);
    expect(diagnostics.map(({ code }) => code)).toEqual(expectedCodes);
  });

  it("should omit a fact when the call has not satisfied its full arity", () => {
    const { model } = analyzeSource("module Main;\nfunction main(): void { poke($D020); }");
    expect(model.constantIntrinsicAddresses.size).toBe(0);
  });
});
