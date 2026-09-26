import { describe, expect, it } from "vitest";
import { analyzeDiagnosticSource, diagnosticSpan } from "./diagnostic-fixture.js";

const cases = [
  {
    code: "E10063",
    source: "module Game; function main(): void { break; }",
    proof: "break",
    message: "'break' can only be used inside a loop body",
  },
  {
    code: "E10090",
    source: "module Game; struct Empty {} function main(): void {}",
    proof: "struct Empty {}",
    message: "Struct 'Empty' must have at least one field",
  },
  {
    code: "E10110",
    source:
      "module Game; let count: byte = peek($0400); let values: byte[count]; function main(): void {}",
    proof: "count",
    occurrence: 1,
    message: "Array size must be a compile-time constant expression — found 'count'",
  },
  {
    code: "E10134",
    source: 'module Game; let DATA: byte[] = embed("data.bin"); function main(): void {}',
    proof: 'let DATA: byte[] = embed("data.bin");',
    message:
      "'embed()' can only initialize an ordinary or loadable const declaration — found 'let'",
  },
  {
    code: "E10135",
    source: 'module Game; function main(): void { const DATA: byte[] = embed("data.bin"); }',
    proof: 'embed("data.bin")',
    message:
      "'embed()' can only appear in a module-level ordinary const or a loadable const initializer",
  },
  {
    code: "E10140",
    source: 'module Game; const DATA: byte[3] = embed("data.bin"); function main(): void {}',
    proof: 'embed("data.bin")',
    message: "Embedded data size mismatch — expected 3 elements, got 2",
  },
  {
    code: "E10176",
    source: "module Game; function main(): void { function nested(): void {} }",
    proof: "function nested(): void {}",
    message: "Cannot define function 'nested' inside function 'main' — move it to module level",
  },
  {
    code: "E10192",
    source: "module Game; const LIMIT: byte = 1; function main(): void { LIMIT = 3; }",
    proof: "LIMIT",
    occurrence: 1,
    related: "LIMIT",
    message: "Cannot assign to const 'LIMIT'",
  },
  {
    code: "E10230",
    source: "module Game; enum Level { Low = peek($0400) } function main(): void {}",
    proof: "peek($0400)",
    message: "Enum member value must be a compile-time byte constant — found 'peek($0400)'",
  },
  {
    code: "E10232",
    source: "module Game; enum Mode { On, On } function main(): void {}",
    proof: "On",
    occurrence: 1,
    related: "On",
    message: "Duplicate enum member 'On' in enum 'Mode'",
  },
  {
    code: "E10233",
    source: "module Game; enum Mode { On = 300 } function main(): void {}",
    proof: "300",
    message: "Enum member value 300 is out of range — expected 0–255",
  },
  {
    code: "E10237",
    source: "let value: byte = 1; module Game; function main(): void { poke($0400, value); }",
    proof: "module Game;",
    message: "Module declaration must be the first source item after leading comments",
  },
] as const;

describe("canonical rejected declarations", () => {
  // Rejected declarations retain their own exact diagnostic instead of leaking downstream errors.
  it.each(cases)("should diagnose $code at its proving declaration", async (testCase) => {
    const result = await analyzeDiagnosticSource(testCase.source);
    expect(result.kind).toBe("error");
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(errors.map(({ code }) => code)).toEqual([testCase.code]);
    expect(errors[0]).toMatchObject({
      code: testCase.code,
      severity: "error",
      message: testCase.message,
      pointer: null,
      primarySpan: diagnosticSpan(
        testCase.source,
        testCase.proof,
        "occurrence" in testCase ? testCase.occurrence : 0,
      ),
    });
    expect(errors[0]?.related.map(({ span }) => span)).toEqual(
      "related" in testCase ? [diagnosticSpan(testCase.source, testCase.related)] : [],
    );
    expect(errors[0]?.help === null || typeof errors[0]?.help === "string").toBe(true);
  });
});
