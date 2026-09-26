import { describe, expect, it } from "vitest";
import { analyzeDiagnosticSource, diagnosticSpan } from "./diagnostic-fixture.js";

const cases = [
  {
    code: "E10020",
    source: "module Game; export function helper(): void {}",
    proof: "module Game;",
    message: "No entry point found — define 'function main(): void' in any module",
    related: [],
  },
  {
    code: "E10022",
    source: "module Game; function main(value: byte): void {}",
    proof: "function main(value: byte): void {}",
    message:
      "Entry point 'main' must have signature 'function main(): void' — found 'function main(value: byte): void'",
    related: [],
  },
  {
    code: "E10023",
    source: "module Game; function main(): void { main(); }",
    proof: "main()",
    occurrence: 1,
    message: "Cannot call 'main()' — it is the program entry point, not a callable function",
    related: ["main"],
  },
  {
    code: "E10050",
    source:
      "module Game; interrupt function handler(value: byte): void {} function main(): void {}",
    proof: "interrupt function handler(value: byte): void {}",
    message: expect.stringMatching(
      /^Interrupt function 'handler' must have signature '\(\): void' — found '[^']*byte[^']*'$/u,
    ),
    related: [],
  },
  {
    code: "E10102",
    source:
      "module Game; export function choose(flag: boolean): byte { if (flag) { return 1; } } function main(): void {}",
    proof: "export function choose(flag: boolean): byte { if (flag) { return 1; } }",
    message: "Not all code paths return a value in function 'choose'",
    related: [],
  },
  {
    code: "E10173",
    source: "module Game; function main(): void { return 1; }",
    proof: "1",
    message: "Cannot return a value from void function 'main'",
    related: ["main"],
  },
  {
    code: "E10174",
    source: "module Game; export function value(): byte { return; } function main(): void {}",
    proof: "return",
    message:
      "Missing return value — function 'value' returns 'byte' but this 'return' has no expression",
    related: ["value"],
  },
  {
    code: "E10180",
    source: "module Game; function again(): void { again(); } function main(): void { again(); }",
    proof: "again()",
    occurrence: 1,
    message:
      "Direct recursion — function 'again' calls itself; use iteration or an explicit fixed-capacity work structure",
    related: ["again();"],
  },
] as const;

describe("canonical function declaration and exit records", () => {
  // Function errors retain the signature, call, or return that proves the violation.
  it.each(cases)("should report $code with its complete source record", async (testCase) => {
    const result = await analyzeDiagnosticSource(testCase.source);
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.kind).toBe("error");
    expect(errors.map(({ code }) => code)).toEqual([testCase.code]);
    expect(errors[0]).toMatchObject({
      code: testCase.code,
      severity: "error",
      pointer: null,
      message: testCase.message,
      primarySpan: diagnosticSpan(
        testCase.source,
        testCase.proof,
        "occurrence" in testCase ? testCase.occurrence : 0,
      ),
    });
    const related =
      testCase.code === "E10180"
        ? [diagnosticSpan(testCase.source, "again()", 1)]
        : testCase.related.map((proof) => diagnosticSpan(testCase.source, proof));
    expect(errors[0]?.related.map(({ span }) => span)).toEqual(related);
  });

  // Every call edge in the cycle appears once, in traversal order, starting at the primary edge.
  it("should report E10181 with the complete ordered two-function cycle", async () => {
    const source =
      "module Game; function first(): void { second(); } function second(): void { first(); } function main(): void { first(); }";
    const result = await analyzeDiagnosticSource(source);
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.kind).toBe("error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10181",
      severity: "error",
      pointer: null,
      message: "Indirect recursion detected — cycle: first → second → first",
      primarySpan: diagnosticSpan(source, "second()"),
    });
    expect(errors[0]?.related.map(({ span }) => span)).toEqual([
      diagnosticSpan(source, "second()"),
      diagnosticSpan(source, "first()", 1),
    ]);
  });
});
