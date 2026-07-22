/**
 * Implementation tests for the poke value-width check — the value kinds the
 * spec ST-table does not enumerate but the same defect covers. A `poke` value
 * that is not a byte-width integer or enum (a struct, an array, a `void` call
 * result) is a multi-byte or non-value operand that would spill stores past the
 * target address just as a `word` would, so it is rejected as a kind mismatch
 * (E10152), never as an integer width narrowing (E10154). The boolean message
 * names the kind rather than suggesting a cast, because boolean↔integer casts
 * are themselves illegal.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { ProgramNode, Diagnostic } from "@blend65/core";
import { lex, parse, analyze } from "../index.js";

const SRC = 1;

/** Compiles `source` through the real frontend and returns all diagnostics. */
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

describe("poke value-width — non-integer value kinds are a kind mismatch (E10152)", () => {
  it("rejects a struct value, not as a width narrowing", () => {
    const source =
      "module Main;\nstruct P { x: byte; y: word; }\n" +
      "function main(): void { let p: P; poke($D020, p); }\n";
    const cs = codes(source);
    expect(cs).toContain("E10152");
    // a struct is a kind mismatch, not an integer that got narrowed.
    expect(cs).not.toContain("E10154");
  });

  it("rejects an array value", () => {
    const source =
      "module Main;\nfunction main(): void { let a: byte[2] = [1, 2]; poke($D020, a); }\n";
    expect(codes(source)).toContain("E10152");
  });

  it("rejects a void call result as a poke value", () => {
    const source =
      "module Main;\nfunction f(): void {}\nfunction main(): void { poke($D020, f()); }\n";
    expect(codes(source)).toContain("E10152");
  });

  it("names the kind and does not suggest an illegal cast for a boolean value", () => {
    const msg =
      diagnose("module Main;\nfunction main(): void { poke($D020, true); }\n").find(
        (d) => d.code === "E10152",
      )?.message ?? "";
    expect(msg).toContain("boolean");
    // boolean<->integer casts are illegal — the message must not send the user there.
    expect(msg.toLowerCase()).not.toContain("cast");
  });
});
