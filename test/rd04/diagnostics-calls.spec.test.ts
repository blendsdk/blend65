import { describe, expect, it } from "vitest";
import { analyzeDiagnosticSource, diagnosticSpan } from "./diagnostic-fixture.js";

describe("canonical call and name failures", () => {
  // A read-only struct cannot acquire a mutable alias merely by being passed to a function.
  it("should diagnose E10094 for a const struct passed to a mutable parameter", async () => {
    const source =
      "module Game; struct Pair { value: byte; } const ITEM: Pair = { value: 1 }; function update(item: Pair): void { item.value = 2; } function main(): void { update(ITEM); }";
    const result = await analyzeDiagnosticSource(source);
    expect(result.kind).toBe("error");
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(errors.map(({ code }) => code)).toEqual(["E10094"]);
    expect(errors[0]).toMatchObject({
      code: "E10094",
      severity: "error",
      pointer: null,
      message:
        "Cannot pass const struct 'ITEM' to a mutable parameter — declare the parameter as 'name: const Pair' or copy the value",
      primarySpan: diagnosticSpan(source, "ITEM", 1),
    });
  });

  // The offending argument is the primary location; the named parameter explains the required type.
  it("should diagnose E10172 at an incompatible argument and relate its parameter", async () => {
    const source =
      "module Game; function consume(value: byte): void { poke($0400, value); } function main(): void { consume(false); }";
    const result = await analyzeDiagnosticSource(source);
    expect(result.kind).toBe("error");
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(errors.map(({ code }) => code)).toEqual(["E10172"]);
    expect(errors[0]).toMatchObject({
      code: "E10172",
      severity: "error",
      pointer: null,
      message:
        "Argument type mismatch — parameter 'value' of 'consume()' expects 'byte', found 'boolean'",
      primarySpan: diagnosticSpan(source, "false"),
    });
    expect(errors[0]?.related.map(({ span }) => span)).toEqual([diagnosticSpan(source, "value")]);
  });

  // An enum-member lookup preserves the enum-specific diagnostic instead of an ordinary name error.
  it("should diagnose E10231 with the uniquely similar declared enum", async () => {
    const source =
      "module Game; enum Mode { On } function main(): void { let value: Mode = Mod.On; }";
    const result = await analyzeDiagnosticSource(source);
    expect(result.kind).toBe("error");
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(errors.map(({ code }) => code)).toEqual(["E10231"]);
    expect(errors[0]).toMatchObject({
      code: "E10231",
      severity: "error",
      pointer: null,
      message: "Enum member 'On' references unknown enum 'Mod' — did you mean 'Mode'?",
      primarySpan: diagnosticSpan(source, "Mod.On"),
    });
  });

  // An erased word cannot establish the ABI of a recognized handler-address sink.
  it("should diagnose E10247 when handler provenance is unknown", async () => {
    const source =
      "module Game; import { setIRQ } from c64.system; function main(): void { let address: word = peekw($0400); setIRQ(address); }";
    const result = await analyzeDiagnosticSource(source);
    expect(result.kind).toBe("error");
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(errors.map(({ code }) => code)).toEqual(["E10247"]);
    expect(errors[0]).toMatchObject({
      code: "E10247",
      severity: "error",
      pointer: null,
      message:
        "Cannot prove the entry ABI of the value passed to function-address sink 'c64.system.setIRQ' — pass a provenance-preserving function address or use an explicit raw hardware boundary",
      primarySpan: diagnosticSpan(source, "address", 1),
    });
  });
});
