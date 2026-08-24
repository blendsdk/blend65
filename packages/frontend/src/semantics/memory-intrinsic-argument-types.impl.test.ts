import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { Diagnostic, ProgramNode } from "@blend65/core";
import { describe, expect, it } from "vitest";

import { analyze, lex, parse } from "../index.js";

/** Analyzes one complete program and returns its diagnostics. */
function diagnosticsFor(body: string): readonly Diagnostic[] {
  const source = `module Main;\nfunction main(): void { ${body} }\n`;
  const bag = createDiagnosticBag();
  const { tokens } = lex(1, source, bag);
  const { ast }: { ast: ProgramNode } = parse({ tokens, source, sourceId: 1, bag });
  analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  return bag.getAll();
}

/** Returns only the emitted diagnostic codes. */
function codesFor(body: string): readonly string[] {
  return diagnosticsFor(body).map(({ code }) => code);
}

describe("direct-memory intrinsic boolean arguments", () => {
  it.each(["peek(true);", "peekw(true);", "poke(true, 1);", "pokew(true, 1);"])(
    "should emit sole E10172 for a boolean address in %s",
    (body) => {
      expect(codesFor(body)).toEqual(["E10172"]);
    },
  );

  it("should emit sole E10172 for a boolean pokew value", () => {
    const diagnostics = diagnosticsFor("pokew($D020, false);");

    expect(diagnostics.map(({ code }) => code)).toEqual(["E10172"]);
    expect(diagnostics[0]?.message).toContain("parameter 'val'");
    expect(diagnostics[0]?.message).toContain("expects 'word'");
  });

  it("should preserve the established poke boolean-value diagnostic", () => {
    expect(codesFor("poke($D020, false);")).toEqual(["E10152"]);
  });

  it("should keep wrong arity as the sole root cause", () => {
    expect(codesFor("peek();")).toEqual(["E10041"]);
    expect(codesFor("pokew($D020);")).toEqual(["E10041"]);
    expect(codesFor("poke($D020, false, 1);")).toEqual(["E10041"]);
    expect(codesFor("pokew($D020, false, 1);")).toEqual(["E10041"]);
  });
});
