import { describe, expect, it } from "vitest";
import { analyzeDiagnosticSource, diagnosticSpan } from "./diagnostic-fixture.js";

const cases = [
  {
    code: "E10264",
    declaration: "let values: byte[-1];",
    proof: "-1",
    message: "Array extent '-1' must be a compile-time integer in 0..65535 — found -1",
  },
  {
    code: "E10264",
    declaration: "let values: byte[65535 + 1];",
    proof: "65535 + 1",
    message: "Array extent '65535 + 1' must be a compile-time integer in 0..65535 — found 65536",
  },
  {
    code: "E10264",
    declaration: "let values: byte[true];",
    proof: "true",
    message: "Array extent 'true' must be a compile-time integer in 0..65535 — found boolean",
  },
  {
    code: "E10265",
    declaration: "let values: word[32768];",
    proof: "word[32768]",
    message:
      "Type 'word[32768]' requires 65536 bytes — fixed array and struct types are limited to 65535 bytes",
  },
  {
    code: "E10246",
    declaration: "export function consume(value: const byte): void { poke($0400, value); }",
    proof: "value: const byte",
    message:
      "Parameter 'value' uses 'const' with non-aggregate type 'byte' — const parameters require an array or struct",
  },
] as const;

describe("canonical type representation boundaries", () => {
  // Full-precision extents and parameter qualifiers fail at the exact source that proves the rule.
  it.each(cases)("should report $code for $declaration", async (testCase) => {
    const source = `module Game; ${testCase.declaration} function main(): void {}`;
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
      related: [],
    });
  });

  // A packed decimal literal with an A nibble is invalid even though it is an ordinary legal byte.
  it("should report E10254 at the invalid packed decimal operand", async () => {
    const source = "module Game; function main(): void { poke($0400, bcd_add(26, 1)); }";
    const result = await analyzeDiagnosticSource(source);
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.kind).toBe("error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10254",
      severity: "error",
      pointer: null,
      message:
        "Packed-BCD operand '26' contains a non-decimal digit — every nibble must be 0 through 9",
      primarySpan: diagnosticSpan(source, "26"),
      related: [],
    });
  });
});
