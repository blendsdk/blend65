import { describe, expect, it } from "vitest";
import { analyzeDiagnosticSource, diagnosticSpan } from "./diagnostic-fixture.js";

const cases = [
  {
    code: "W10070",
    declarations: "",
    body: "let value: word = peekw($0400); switch (value) { case 1: poke($0401, 1); case 2: poke($0401, 2); }",
    proof: "value",
    occurrence: 1,
    message:
      "Switch expression is 'word' but every case fits in 'byte' — a byte value is cheaper to compare",
  },
  {
    code: "W10100",
    declarations: "",
    body: "let value: sbyte = sbyte(127) + sbyte(1); poke($0400, byte(value));",
    proof: "sbyte(127) + sbyte(1)",
    message:
      "Signed runtime expression 'sbyte(127) + sbyte(1)' is known to overflow at 'sbyte' width and wraps to -128",
  },
  {
    code: "W10111",
    declarations:
      "struct Triple { a: byte; b: byte; c: byte; } let values: Triple[2] = [{ a: 1, b: 2, c: 3 }, { a: 4, b: 5, c: 6 }];",
    body: "let index: byte = peek($0400); poke($0401, values[index].a);",
    proof: "values[index]",
    message:
      "Variable indexing of struct array 'values' requires multiplication by non-power-of-two size 3",
  },
  {
    code: "W10112",
    declarations:
      "struct Pair { value: byte; } function update(a: Pair, b: Pair): void { a.value = 1; b.value = 2; }",
    body: "let item: Pair = { value: 0 }; update(item, item);",
    proof: "update(item, item)",
    message: "Parameters 'a' and 'b' may alias the same struct",
  },
  {
    code: "W10130",
    declarations: "",
    body: "if (false) { poke($0400, 1); }",
    proof: "false",
    message: "Condition is always false — this block cannot execute",
  },
  {
    code: "W10131",
    declarations: "",
    body: "return; poke($0400, 1);",
    proof: "poke($0400, 1);",
    message: "Unreachable code — statements after 'return' cannot execute",
  },
  {
    code: "W10160",
    declarations: "",
    body: "let input: byte = peek($0400); let value: word = input + 1; pokew($0402, value);",
    proof: "input + 1",
    message: "'byte' arithmetic may overflow before widening to 'word'",
  },
  {
    code: "W10181",
    declarations: "function unused(): void {}",
    body: "",
    proof: "unused",
    message: "Function 'unused' is never called and not exported",
  },
  {
    code: "W10191",
    declarations: "",
    body: "let unused: byte = 1;",
    proof: "unused",
    message: "Variable 'unused' is declared but never used",
  },
] as const;

describe("canonical source advisories", () => {
  // Advisories preserve legal source behavior while describing the exact source condition.
  it.each(cases)("should report $code with its canonical warning record", async (testCase) => {
    const source = `module Game; ${testCase.declarations} function main(): void { ${testCase.body} }`;
    const result = await analyzeDiagnosticSource(source);
    expect(result.kind).toBe("complete");
    expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    const matching = result.diagnostics.filter(({ code }) => code === testCase.code);
    expect(matching).toHaveLength(1);
    expect(matching[0]).toMatchObject({
      code: testCase.code,
      severity: "warning",
      message: testCase.message,
      pointer: null,
      primarySpan: diagnosticSpan(
        source,
        testCase.proof,
        "occurrence" in testCase ? testCase.occurrence : 0,
      ),
    });
    expect(matching[0]?.help === null || typeof matching[0]?.help === "string").toBe(true);
  });
});
