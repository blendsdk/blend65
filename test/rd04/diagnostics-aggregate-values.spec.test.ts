import { describe, expect, it } from "vitest";
import { analyzeDiagnosticSource, diagnosticSpan } from "./diagnostic-fixture.js";

const cases = [
  {
    code: "E10096",
    declarations: "struct Pair { first: byte; second: byte; }",
    body: "let item: Pair = { first: 1 };",
    proof: "{ first: 1 }",
    message: "Struct literal must initialize all fields — missing 'second'",
  },
  {
    code: "E10097",
    declarations: "struct Pair { first: byte; second: byte; }",
    body: "let item: Pair = { second: 2, first: 1 };",
    proof: "second",
    occurrence: 1,
    message:
      "Struct literal fields must follow declaration order — expected 'first', found 'second'",
  },
  {
    code: "E10112",
    declarations: "",
    body: "let values: byte[1] = [1, 2];",
    proof: "[1, 2]",
    message: "Array initializer has 2 elements but the declared size is 1",
  },
  {
    code: "E10113",
    declarations: "",
    body: "const values: byte[2] = [1];",
    proof: "[1]",
    message:
      "Const array must be fully initialized — 1 elements provided for size 2; use '[values; fill]'",
  },
  {
    code: "E10114",
    declarations: "",
    body: "let values: byte[] = [1; 0];",
    proof: "[1; 0]",
    message: "Fill syntax '[...; fill]' requires an explicit array size",
  },
  {
    code: "E10116",
    declarations: "",
    body: 'let values: byte[] = ["hi", 1];',
    proof: '["hi", 1]',
    message: "Cannot mix string literals with value elements in an array initializer",
  },
  {
    code: "E10121",
    declarations: "",
    body: "let left: byte[1] = [1]; let right: byte[1] = [1]; if (left == right) {}",
    proof: "left == right",
    message: "Cannot compare arrays with '==' — compare individual elements",
  },
  {
    code: "E10124",
    declarations: "",
    body: 'let text: byte[1] = "HI";',
    proof: '"HI"',
    message: "String literal (2 bytes) exceeds array size (1)",
  },
  {
    code: "E10240",
    declarations: "",
    body: "let values: byte[2] = [1, 2]; poke($0400, values[2]);",
    proof: "2",
    occurrence: 2,
    message: "Index 2 is provably outside array 'values' with extent 2",
  },
  {
    code: "E10242",
    declarations: "struct Pair { first: byte; }",
    body: "let item: Pair = { first: 1 }; poke($0400, item.missing);",
    proof: "item.missing",
    message: "Struct 'Pair' has no field 'missing'",
  },
  {
    code: "E10243",
    declarations: "struct Pair { first: byte; }",
    body: "let item: Pair = { first: 1, missing: 2 };",
    proof: "missing",
    message: "Struct initializer for 'Pair' contains unknown field 'missing'",
  },
  {
    code: "E10263",
    declarations: "",
    body: "let values: byte[2] = [1, 2]; poke($0400, values[true]);",
    proof: "true",
    message: "Array index must have an integer type — found 'boolean'",
  },
] as const;

describe("canonical aggregate value diagnostics", () => {
  // Aggregate failures retain their dedicated canonical messages and the smallest proving construct.
  it.each(cases)("should produce the exact $code source record", async (testCase) => {
    const source = `module Game; ${testCase.declarations} /* £ */ function main(): void { ${testCase.body} }`;
    const result = await analyzeDiagnosticSource(source);
    expect(result.kind).toBe("error");
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(errors.map(({ code }) => code)).toEqual([testCase.code]);
    expect(errors[0]).toMatchObject({
      code: testCase.code,
      severity: "error",
      message: testCase.message,
      pointer: null,
      primarySpan: diagnosticSpan(
        source,
        testCase.proof,
        "occurrence" in testCase ? testCase.occurrence : 0,
      ),
    });
    expect(errors[0]?.help === null || typeof errors[0]?.help === "string").toBe(true);
  });
});
