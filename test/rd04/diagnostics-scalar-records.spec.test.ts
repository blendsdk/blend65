import { describe, expect, it } from "vitest";
import { analyzeDiagnosticSource, diagnosticSpan } from "./diagnostic-fixture.js";

const cases = [
  {
    code: "E10040",
    declarations: "const LIMIT: byte = 3;",
    body: "pokew($0400, &LIMIT);",
    proof: "&LIMIT",
    message:
      "Cannot take address of constant 'LIMIT' — an inlined scalar constant has no storage address",
    related: ["LIMIT"],
  },
  {
    code: "E10043",
    declarations: "",
    body: "pokew($0400, &42);",
    proof: "&42",
    message:
      "Address-of requires an addressable storage place or target function — '42' has no target address",
    related: [],
  },
  {
    code: "E10080",
    declarations: "",
    body: "let value: byte = sbyte(peek($0400)); poke($0401, value);",
    proof: "sbyte(peek($0400))",
    message: expect.stringMatching(/^Cannot implicitly convert 'sbyte' to 'byte' — .+$/u),
    related: [],
  },
  {
    code: "E10081",
    declarations: "",
    body: "peek($0400) + sbyte(peek($0401));",
    proof: "peek($0400) + sbyte(peek($0401))",
    message: "Cannot mix signed type 'sbyte' with unsigned type 'byte' — cast one operand",
    related: [],
  },
  {
    code: "E10082",
    declarations: "",
    body: "let value: byte = peekw($0400); poke($0402, value);",
    proof: "peekw($0400)",
    message: "Cannot implicitly narrow 'word' to 'byte' — use 'byte(peekw($0400))'",
    related: [],
  },
  {
    code: "E10083",
    declarations: "",
    body: "-peek($0400);",
    proof: "-peek($0400)",
    message: "Cannot negate unsigned type 'byte' — use 'sbyte' or 'sword' for signed arithmetic",
    related: [],
  },
  {
    code: "E10084",
    declarations: "",
    body: "let value: byte = 300; poke($0400, value);",
    proof: "300",
    message: "Value 300 is out of range for type 'byte' (0–255)",
    related: [],
  },
  {
    code: "E10086",
    declarations: "",
    body: "byte(true);",
    proof: "byte(true)",
    message: "Cannot cast 'boolean' to 'byte' — boolean is not convertible to or from an integer",
    related: [],
  },
  {
    code: "E10100",
    declarations: "",
    body: "if (1) { poke($0400, 2); }",
    proof: "1",
    message: "Condition must have type 'boolean' — found 'byte'; use an explicit comparison",
    related: [],
  },
  {
    code: "E10151",
    declarations: "",
    body: "true + byte(1);",
    proof: "true + byte(1)",
    message: "Cannot use 'boolean' in an arithmetic or bitwise expression",
    related: [],
  },
  {
    code: "E10190",
    declarations: "const LIMIT: byte;",
    body: "",
    proof: "const LIMIT: byte;",
    message: "Const declaration 'LIMIT' requires an initializer",
    related: [],
  },
  {
    code: "E10191",
    declarations: "const LIMIT: byte = peek($0400);",
    body: "",
    proof: "peek($0400)",
    message: expect.stringMatching(/^Expression must be compile-time evaluable — .*peek.*$/u),
    related: [],
  },
  {
    code: "E10234",
    declarations: "enum Empty {}",
    body: "",
    proof: "enum Empty {}",
    message: "Enum 'Empty' must declare at least one member",
    related: [],
  },
  {
    code: "E10235",
    declarations: "enum Mode { Ready }",
    body: "let value: Mode = peek($0400);",
    proof: "peek($0400)",
    message: "Cannot assign 'byte' to enum 'Mode' — use 'Mode(peek($0400))'",
    related: [],
  },
  {
    code: "E10236",
    declarations: "enum First { Ready } enum Second { Ready }",
    body: "First.Ready == Second.Ready;",
    proof: "First.Ready == Second.Ready",
    message: "Cannot compare enum 'First' with enum 'Second' — cast one to 'byte'",
    related: [],
  },
  {
    code: "E10241",
    declarations: "let value: Missing;",
    body: "",
    proof: "Missing",
    message: "Unknown type 'Missing'",
    related: [],
  },
] as const;

describe("canonical scalar and constant source records", () => {
  // A rejected value carries its own source record; poison cannot add a dependent type failure.
  it.each(cases)("should report $code at its proving scalar construct", async (testCase) => {
    const source = `module Game; ${testCase.declarations} /* £ */ function main(): void { ${testCase.body} }`;
    const result = await analyzeDiagnosticSource(source);
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.kind).toBe("error");
    expect(errors.map(({ code }) => code)).toEqual([testCase.code]);
    expect(errors[0]).toMatchObject({
      code: testCase.code,
      severity: "error",
      pointer: null,
      message: testCase.message,
      primarySpan: diagnosticSpan(source, testCase.proof),
    });
    expect(errors[0]?.related.map(({ span }) => span)).toEqual(
      testCase.related.map((proof) => diagnosticSpan(source, proof)),
    );
  });
});
