import { describe, expect, it } from "vitest";
import { analyzeDiagnosticSource, diagnosticSpan } from "./diagnostic-fixture.js";

const cases = [
  {
    code: "E10095",
    declarations: "struct Pair { first: byte; }",
    body: "let left: Pair = { first: 1 }; let right: Pair = { first: 2 }; if (left == right) {}",
    proof: "left == right",
    message: "Cannot compare structs with '==' — compare individual fields",
  },
  {
    code: "E10115",
    declarations: "",
    body: "let values: byte[3] = [1; true]; poke($0400, values[0]);",
    proof: "true",
    message: "Fill value has type 'boolean' but array element type is 'byte'",
  },
  {
    code: "E10152",
    declarations: "",
    body: "void(1);",
    proof: "void(1)",
    message: "Cannot cast to or from 'void'",
  },
  {
    code: "E10153",
    declarations: "struct Pair { first: byte; }",
    body: "let value: Pair = { first: 1 }; poke($0400, byte(value));",
    proof: "byte(value)",
    message:
      "Cannot cast 'Pair' to 'byte' — casts support integer/enum conversions and one-way function/handler conversion to word only",
  },
  {
    code: "E10161",
    declarations: "",
    body: "poke($0400, byte(1) << sbyte(1));",
    proof: "sbyte(1)",
    message: "Shift amount must have unsigned type 'byte' or 'word' — found 'sbyte'",
  },
  {
    code: "E10162",
    declarations: "",
    body: "let value: byte = true ? byte(1) : false;",
    proof: "true ? byte(1) : false",
    message: "Conditional arms have incompatible types 'byte' and 'boolean'",
  },
  {
    code: "E10200",
    declarations: "",
    body: "let value: byte = 7; sizeof(value);",
    proof: "value",
    occurrence: 1,
    message: "'sizeof' requires a type name — found 'value'",
  },
  {
    code: "E10201",
    declarations: "",
    body: "offsetof(byte, missing);",
    proof: "byte",
    message: "'offsetof' requires a struct type — found 'byte'",
  },
  {
    code: "E10202",
    declarations: "struct Pair { first: byte; }",
    body: "offsetof(Pair, missing);",
    proof: "missing",
    message: "Field 'missing' is not present in struct 'Pair' — available fields: first",
  },
  {
    code: "E10266",
    declarations: "",
    body: "sizeof(byte[]);",
    proof: "byte[]",
    message:
      "'sizeof' requires a fixed-size type — unsized array type 'byte[]' has no standalone extent",
  },
] as const;

describe("canonical rejected value operations", () => {
  // Each rejected operation has its own canonical source error and its smallest proving expression.
  it.each(cases)("should diagnose $code at its exact value operation", async (testCase) => {
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
    expect(errors[0]?.related).toEqual([]);
    expect(errors[0]?.help === null || typeof errors[0]?.help === "string").toBe(true);
  });
});
