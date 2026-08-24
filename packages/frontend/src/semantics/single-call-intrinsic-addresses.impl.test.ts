import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { Diagnostic, ProgramNode, SemanticModel } from "@blend65/core";
import { describe, expect, it } from "vitest";

import { analyze, lex, parse } from "../index.js";

/** Parses and analyzes a complete source set through the public frontend. */
function analyzeSources(sources: readonly string[]): {
  readonly diagnostics: readonly Diagnostic[];
  readonly model: SemanticModel;
} {
  const bag = createDiagnosticBag();
  const programs: ProgramNode[] = sources.map((source, index) => {
    const { tokens } = lex(index + 1, source, bag);
    return parse({ tokens, source, sourceId: index + 1, bag }).ast;
  });
  const model = analyze({ programs, bag, profile: DEFAULT_PROFILE });
  return { diagnostics: bag.getAll(), model };
}

/** Returns propagated/direct facts in deterministic address order. */
function addressFacts(model: SemanticModel): readonly (readonly [string, number])[] {
  return [...model.constantIntrinsicAddresses]
    .map(([call, address]) => [call.name, address] as const)
    .sort((left, right) => left[1] - right[1]);
}

describe("single-call memory-address specialization", () => {
  it("should specialize all direct-memory forms from sole constant call sites", () => {
    const source = [
      "module Main;",
      "function readByte(address: word): byte { return peek(address); }",
      "function readWord(address: word): word { return peekw(address + 1); }",
      "function writeByte(address: word): void { poke(address + 2, 32); }",
      "function writeWord(address: word): void { pokew(address + 3, 8192); }",
      "function main(): void {",
      "  readByte($D020);",
      "  readWord($D020);",
      "  writeByte($D020);",
      "  writeWord($D020);",
      "}",
    ].join("\n");
    const { diagnostics, model } = analyzeSources([source]);

    expect(diagnostics).toEqual([]);
    expect(addressFacts(model)).toEqual([
      ["peek", 0xd020],
      ["peekw", 0xd021],
      ["poke", 0xd022],
      ["pokew", 0xd023],
    ]);
  });

  it("should fold a named constant passed to a parameter expression", () => {
    const source = [
      "module Main;",
      "const SCREEN: word = $0400;",
      "function read(address: word): byte { return peek(address + 7); }",
      "function main(): void { read(SCREEN); }",
    ].join("\n");
    const { diagnostics, model } = analyzeSources([source]);

    expect(diagnostics).toEqual([]);
    expect(addressFacts(model)).toEqual([["peek", 0x0407]]);
  });

  it("should fail closed when a reachable callee has two call sites", () => {
    const source = [
      "module Main;",
      "function read(address: word): byte { return peek(address); }",
      "function main(): void { read($D020); read($D021); }",
    ].join("\n");
    const { diagnostics, model } = analyzeSources([source]);

    expect(diagnostics).toEqual([]);
    expect(addressFacts(model)).toEqual([]);
  });

  it("should ignore an extra call site in an unreachable function", () => {
    const source = [
      "module Main;",
      "function read(address: word): byte { return peek(address); }",
      "function dead(): byte { return read($D021); }",
      "function main(): void { read($D020); }",
    ].join("\n");
    const { diagnostics, model } = analyzeSources([source]);

    expect(diagnostics).toEqual([]);
    expect(addressFacts(model)).toEqual([["peek", 0xd020]]);
  });

  it("should fail closed for a recursive callee", () => {
    const source = [
      "module Main;",
      "function read(address: word): byte {",
      "  if (address == 0) { return peek(address); }",
      "  return read(address);",
      "}",
      "function main(): void { read($D020); }",
    ].join("\n");
    const { diagnostics, model } = analyzeSources([source]);

    expect(diagnostics.map(({ code }) => code)).toContain("E10174");
    expect(addressFacts(model)).toEqual([]);
  });

  it("should fail closed when the callee address escapes the visible graph", () => {
    const source = [
      "module Main;",
      "function read(address: word): byte { return peek(address); }",
      "function main(): void { pokew($0314, &read); read($D020); }",
    ].join("\n");
    const { diagnostics, model } = analyzeSources([source]);

    expect(diagnostics).toEqual([]);
    expect(addressFacts(model)).toEqual([["pokew", 0x0314]]);
  });

  it("should not propagate a caller parameter transitively", () => {
    const source = [
      "module Main;",
      "function read(address: word): byte { return peek(address); }",
      "function wrapper(address: word): byte { return read(address); }",
      "function main(): void { wrapper($D020); }",
    ].join("\n");
    const { diagnostics, model } = analyzeSources([source]);

    expect(diagnostics).toEqual([]);
    expect(addressFacts(model)).toEqual([]);
  });

  it("should fail closed for a sole imported call", () => {
    const library = [
      "module Memory;",
      "export function read(address: word): byte { return peek(address); }",
    ].join("\n");
    const main = [
      "module Main;",
      "import { read } from Memory;",
      "function main(): void { read($D020); }",
    ].join("\n");
    const { diagnostics, model } = analyzeSources([main, library]);

    expect(diagnostics).toEqual([]);
    expect(addressFacts(model)).toEqual([]);
  });

  it("should fail closed when the callee writes the address parameter", () => {
    const source = [
      "module Main;",
      "function read(address: word): byte { address = $D021; return peek(address); }",
      "function main(): void { read($D020); }",
    ].join("\n");
    const { diagnostics, model } = analyzeSources([source]);

    expect(diagnostics).toEqual([]);
    expect(addressFacts(model)).toEqual([]);
  });

  it("should count calls reachable from an address-taken interrupt root", () => {
    const source = [
      "module Main;",
      "function read(address: word): byte { return peek(address); }",
      "interrupt function handler() { read($D021); }",
      "function main(): void { pokew($0314, &handler); read($D020); }",
    ].join("\n");
    const { diagnostics, model } = analyzeSources([source]);

    expect(diagnostics).toEqual([]);
    expect(addressFacts(model)).toEqual([["pokew", 0x0314]]);
  });

  it("should not fold through a potentially wrapping intermediate expression", () => {
    const source = [
      "module Main;",
      "function read(address: word): byte { return peek((address + 1) / 256); }",
      "function main(): void { read($FFFF); }",
    ].join("\n");
    const { diagnostics, model } = analyzeSources([source]);

    expect(diagnostics).toEqual([]);
    expect(addressFacts(model)).toEqual([]);
  });

  it("should not fold parameter comparisons or conditional addresses", () => {
    const source = [
      "module Main;",
      "function read(address: word): byte {",
      "  return peek((address + 1) == 0 ? $D020 : $D021);",
      "}",
      "function main(): void { read($FFFF); }",
    ].join("\n");
    const { diagnostics, model } = analyzeSources([source]);

    expect(diagnostics).toEqual([]);
    expect(addressFacts(model)).toEqual([]);
  });

  it("should not fold a caller actual with wrapping intermediate arithmetic", () => {
    const source = [
      "module Main;",
      "function read(address: word): byte { return peek(address); }",
      "function main(): void { read(($FFFF + 1) / 256); }",
    ].join("\n");
    const { diagnostics, model } = analyzeSources([source]);

    expect(diagnostics).toEqual([]);
    expect(addressFacts(model)).toEqual([]);
  });

  it("should not fold a caller conditional actual", () => {
    const source = [
      "module Main;",
      "function read(address: word): byte { return peek(address); }",
      "function main(): void { read(($FFFF + 1) == 0 ? $D020 : $D021); }",
    ].join("\n");
    const { diagnostics, model } = analyzeSources([source]);

    expect(diagnostics).toEqual([]);
    expect(addressFacts(model)).toEqual([]);
  });

  it("should not specialize arithmetic performed in a narrow parameter type", () => {
    const source = [
      "module Main;",
      "function read(address: byte): byte { return peek(address + 200); }",
      "function main(): void { read(100); }",
    ].join("\n");
    const { diagnostics, model } = analyzeSources([source]);

    expect(diagnostics).toEqual([]);
    expect(addressFacts(model)).toEqual([]);
  });
});
