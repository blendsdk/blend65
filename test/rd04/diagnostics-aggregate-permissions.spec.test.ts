import { describe, expect, it } from "vitest";
import { analyzeDiagnosticSource, diagnosticSpan } from "./diagnostic-fixture.js";

const cases = [
  {
    code: "E10091",
    source: "module Game; struct Node { next: Node; } function main(): void {}",
    proof: "Node",
    occurrence: 1,
    message: "Struct 'Node' cannot contain a field of its own type",
    related: ["Node"],
  },
  {
    code: "E10122",
    source:
      "module Game; const DATA: byte[2] = [1, 2]; function change(items: byte[2]): void { items[0] = 3; } function main(): void { change(DATA); }",
    proof: "DATA",
    occurrence: 1,
    message:
      "Cannot pass const 'DATA' to mutable parameter 'items' — make the parameter const or copy the value",
    related: ["items"],
  },
  {
    code: "E10123",
    source:
      "module Game; export function change(items: const byte[2]): void { items[0] = 3; } function main(): void {}",
    proof: "items[0]",
    message: "Cannot modify through read-only origin 'items'",
    related: ["items"],
  },
  {
    code: "E10125",
    source: "module Game; const VALUE: byte = atascii('H'); function main(): void {}",
    proof: "atascii('H')",
    message: expect.stringMatching(
      /^Encoding or character map 'atascii' is unavailable for platform 'c64-pal-prg-kernal-6581' — available: (?:petscii, screen_codes|screen_codes, petscii)$/u,
    ),
    related: [],
  },
  {
    code: "E10249",
    source: "module Game; const VALUE: byte = 'é'; function main(): void {}",
    proof: "'é'",
    message:
      "Encoding 'screen_codes' cannot represent literal character or escape 'é' as the required byte on platform 'c64-pal-prg-kernal-6581' — select an available named encoding or use '\\xNN' for an exact byte",
    related: [],
  },
  {
    code: "E10251",
    source:
      "module Game; const MAP: byte = 1; const VALUE: byte = screen_codes('H', MAP); function main(): void {}",
    proof: "MAP",
    occurrence: 1,
    message: expect.stringMatching(
      /^Character-map argument must be a string literal — available maps for 'screen_codes' on 'c64-pal-prg-kernal-6581': (?:upper_graphics, lower_upper|lower_upper, upper_graphics)$/u,
    ),
    related: [],
  },
  {
    code: "E10253",
    source: "module Game; let values: byte[]; function main(): void {}",
    proof: "byte[]",
    message: expect.stringMatching(
      /^Array use at '[^']+' has no compile-time-known extent — add '\[N\]', use an extent-inferencing initializer, or keep 'T\[\]' as an outermost parameter form$/u,
    ),
    related: [],
  },
] as const;

describe("canonical aggregate permission and encoding records", () => {
  // Aggregate shape, mutability, and encoding failures cannot disappear into generic type errors.
  it.each(cases)("should report $code with its exact proving source", async (testCase) => {
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
    expect(errors[0]?.related.map(({ span }) => span)).toEqual(
      testCase.related.map((proof) => diagnosticSpan(testCase.source, proof)),
    );
  });

  // Each containment edge participates in the ordered cycle, including the edge back to the start.
  it("should report E10092 with the ordered circular struct dependency", async () => {
    const source =
      "module Game; struct First { second: Second; } struct Second { first: First; } function main(): void {}";
    const result = await analyzeDiagnosticSource(source);
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.kind).toBe("error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10092",
      severity: "error",
      pointer: null,
      message: "Circular struct dependency: First contains Second which contains First",
      primarySpan: diagnosticSpan(source, "Second"),
    });
    expect(errors[0]?.related.map(({ span }) => span)).toEqual([
      diagnosticSpan(source, "Second"),
      diagnosticSpan(source, "First", 1),
    ]);
  });

  // The partial initializer leaves one element undefined; the declaration owns the advisory.
  it("should report W10140 with the exact initialized and declared element counts", async () => {
    const source =
      "module Game; let values: byte[2] = [1]; function main(): void { poke($0400, values[0]); }";
    const result = await analyzeDiagnosticSource(source);
    expect(result.kind).toBe("complete");
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: "W10140",
      severity: "warning",
      pointer: null,
      message: "Array 'values' is partially initialized — 1/2 elements have defined values",
      primarySpan: diagnosticSpan(source, "values"),
      related: [],
    });
  });
});
