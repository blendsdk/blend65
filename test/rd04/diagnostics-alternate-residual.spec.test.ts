import { describe, expect, it } from "vitest";
import { analyzeDiagnosticSource, diagnosticSpan } from "./diagnostic-fixture.js";

describe("canonical diagnostics from remaining reachable producers", () => {
  it("reports bad packed digits at the operand evaluated through a compile-time parameter", async () => {
    const source =
      "module Game; comptime function calculate(digits: byte): byte { return bcd_add(digits, byte(1)); } const RESULT: byte = calculate(26); function main(): void {}";
    const result = await analyzeDiagnosticSource(source);
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.kind).toBe("error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10254",
      severity: "error",
      pointer: null,
      message:
        "Packed-BCD operand 'digits' contains a non-decimal digit — every nibble must be 0 through 9",
      primarySpan: diagnosticSpan(source, "digits", 1),
    });
    expect(errors[0]?.help === null || typeof errors[0]?.help === "string").toBe(true);
  });

  it("reports extra embed arguments as arity instead of a malformed path literal", async () => {
    const call = 'embed("data.bin", "raw", "extra")';
    const source = `module Game; const DATA: byte[] = ${call}; function main(): void {}`;
    const result = await analyzeDiagnosticSource(source);
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.kind).toBe("error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10171",
      severity: "error",
      pointer: null,
      message: "Wrong argument count — 'embed()' expects 1 or 2 parameters, got 3",
      primarySpan: diagnosticSpan(source, call),
      related: [],
    });
    expect(errors[0]?.help === null || typeof errors[0]?.help === "string").toBe(true);
  });
});
