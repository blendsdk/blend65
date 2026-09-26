import { describe, expect, it } from "vitest";
import { analyzeDiagnosticSource, diagnosticSpan } from "./diagnostic-fixture.js";

describe("canonical call-kind failures", () => {
  // A directly invoked handler is still an interrupt entry, so the call cannot use the ordinary ABI.
  it("should report E10051 at the direct interrupt call", async () => {
    const source =
      "module Game; interrupt function handler(): void {} function main(): void { handler(); }";
    const result = await analyzeDiagnosticSource(source);
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.kind).toBe("error");
    expect(errors.map(({ code }) => code)).toEqual(["E10051"]);
    expect(errors[0]).toMatchObject({
      code: "E10051",
      severity: "error",
      pointer: null,
      message:
        "Cannot call interrupt function 'handler' directly — use '&handler' for installation in an interrupt-entry sink",
      primarySpan: diagnosticSpan(source, "handler()", 1),
    });
    expect(errors[0]?.related.map(({ span }) => span)).toEqual([diagnosticSpan(source, "handler")]);
  });

  // Call syntax on an integer cannot be mistaken for a function-address conversion.
  it("should report E10175 at a call to a byte value", async () => {
    const source = "module Game; function main(): void { let value: byte = 1; value(); }";
    const result = await analyzeDiagnosticSource(source);
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.kind).toBe("error");
    expect(errors.map(({ code }) => code)).toEqual(["E10175"]);
    expect(errors[0]).toMatchObject({
      code: "E10175",
      severity: "error",
      pointer: null,
      message: "'value' is not a function — cannot call a 'byte' value",
      primarySpan: diagnosticSpan(source, "value()"),
    });
    expect(errors[0]?.related.map(({ span }) => span)).toEqual([diagnosticSpan(source, "value")]);
  });
});
