import { describe, expect, it } from "vitest";
import { analyzeDiagnosticSource } from "./diagnostic-fixture.js";

describe("compile-time diagnostic recovery", () => {
  it("keeps a poisoned callee's root error through another compile-time function", async () => {
    const result = await analyzeDiagnosticSource(
      "module Game; let state: byte = 1; comptime function bad(): byte { return state; } comptime function wrap(): byte { return bad(); } const VALUE: byte = wrap(); function main(): void {}",
    );
    expect(result.kind).toBe("error");
    expect(
      result.diagnostics.filter(({ severity }) => severity === "error").map(({ code }) => code),
    ).toEqual(["E10191"]);
  });

  it("does not suppress an independent error after abandoning a dependent root", async () => {
    const result = await analyzeDiagnosticSource(
      "module Game; comptime function bad(): byte { asm_nop(); return 1; } const VALUE: byte = bad(); function main(): void { missing; }",
    );
    expect(result.kind).toBe("error");
    expect(
      result.diagnostics.filter(({ severity }) => severity === "error").map(({ code }) => code),
    ).toEqual(["E10191", "E10239"]);
  });

  it("leaves indirect compile-time recursion to the ordered call-graph diagnostic", async () => {
    const result = await analyzeDiagnosticSource(
      "module Game; comptime function first(): byte { return second(); } comptime function second(): byte { return first(); } const VALUE: byte = first(); function main(): void {}",
    );
    expect(result.kind).toBe("error");
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(errors.map(({ code }) => code)).toEqual(["E10181"]);
    expect(errors[0]?.related).toHaveLength(2);
  });
});
