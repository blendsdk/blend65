import { describe, expect, it } from "vitest";
import { analyzeDiagnosticSource, diagnosticSpan } from "./diagnostic-fixture.js";

const cases = [
  {
    code: "E10071",
    body: "switch (value) { case value: return; }",
    proof: "value",
    occurrence: 2,
    message:
      "Case value must be a compile-time constant — 'value' cannot be evaluated at compile time",
  },
  {
    code: "E10073",
    body: "switch (value) { case 1: fallthrough; }",
    proof: "fallthrough",
    message: "'fallthrough' has no effect in the last case of a switch",
  },
  {
    code: "E10074",
    body: "switch (value) { case 1: fallthrough; poke($0400, 2); case 2: return; }",
    proof: "fallthrough",
    message:
      "'fallthrough' must be the last statement in a case body and cannot be nested in another control-flow block",
  },
  {
    code: "E10075",
    body: "switch (true) { default: return; }",
    proof: "true",
    message: "Cannot switch on type 'boolean' — use an integer or enum expression",
  },
  {
    code: "E10076",
    body: "switch (value) { default: poke($0400, 1); default: poke($0400, 2); }",
    proof: "default",
    occurrence: 1,
    related: "default",
    message: "Only one 'default' clause is allowed per switch statement",
  },
] as const;

describe("canonical switch source records", () => {
  // Each invalid switch retains the smallest proving construct and its dedicated public message.
  it.each(cases)("should report $code with exact source fields", async (testCase) => {
    const source = `module Game; function main(): void { let value: byte = peek($0400); ${testCase.body} }`;
    const result = await analyzeDiagnosticSource(source);
    expect(result.kind).toBe("error");
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(errors.map(({ code }) => code)).toEqual([testCase.code]);
    expect(errors[0]).toMatchObject({
      code: testCase.code,
      severity: "error",
      pointer: null,
      message: testCase.message,
      primarySpan: diagnosticSpan(
        source,
        testCase.proof,
        "occurrence" in testCase ? testCase.occurrence : 0,
      ),
    });
    expect(errors[0]?.related.map(({ span }) => span)).toEqual(
      "related" in testCase ? [diagnosticSpan(source, testCase.related)] : [],
    );
  });

  // A duplicate constant is explained by the earlier value, in source order, even after UTF-8 text.
  it("should report E10070 with the first case as the exact related location", async () => {
    const source = [
      "module Game;",
      "/* £ */ function main(): void {",
      "  switch (peek($0400)) {",
      "    case 1: poke($0400, 2);",
      "    case 1: poke($0400, 3);",
      "  }",
      "}",
    ].join("\n");
    const result = await analyzeDiagnosticSource(source);
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.kind).toBe("error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10070",
      severity: "error",
      pointer: null,
      message: "Duplicate case value 1 — already used at src/game.blend:4:10",
      primarySpan: diagnosticSpan(source, "1", 1),
    });
    expect(errors[0]?.related.map(({ span }) => span)).toEqual([diagnosticSpan(source, "1")]);
  });

  // Nominal enum identity survives into the case diagnostic rather than becoming a byte value.
  it("should report E10072 at the incompatible enum case", async () => {
    const source =
      "module Game; enum First { Ready } enum Second { Ready } function main(): void { let value: First = First.Ready; switch (value) { case Second.Ready: return; } }";
    const result = await analyzeDiagnosticSource(source);
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.kind).toBe("error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10072",
      severity: "error",
      pointer: null,
      message: "Case value type 'Second' does not match switch expression type 'First'",
      primarySpan: diagnosticSpan(source, "Second.Ready"),
      related: [],
    });
  });
});
