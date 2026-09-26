import { describe, expect, it } from "vitest";
import { analyzeDiagnosticSource, diagnosticSpan } from "./diagnostic-fixture.js";

const cases = [
  {
    name: "a compile-time function reading module runtime storage",
    source:
      "module Game; let state: byte = 7; comptime function sample(): byte { return state; } const VALUE: byte = sample(); function main(): void {}",
    code: "E10191",
    proof: "state",
    occurrence: 1,
    message: /^Expression must be compile-time evaluable — .+$/u,
    related: ["state"],
  },
  {
    name: "a compile-time function invoking an ordered CPU operation",
    source:
      "module Game; comptime function sample(): byte { asm_nop(); return 1; } const VALUE: byte = sample(); function main(): void {}",
    code: "E10191",
    proof: "asm_nop()",
    message: /^Expression must be compile-time evaluable — .+$/u,
    related: [],
  },
  {
    name: "a compile-time function calling a runtime function",
    source:
      "module Game; function runtime(): byte { return 1; } comptime function sample(): byte { return runtime(); } const VALUE: byte = sample(); function main(): void {}",
    code: "E10191",
    proof: "runtime()",
    occurrence: 1,
    message: /^Expression must be compile-time evaluable — .+$/u,
    related: ["runtime"],
  },
  {
    name: "direct compile-time recursion",
    source:
      "module Game; comptime function again(): byte { return again(); } const VALUE: byte = again(); function main(): void {}",
    code: "E10180",
    proof: "again()",
    occurrence: 1,
    message:
      /^Direct recursion — function 'again' calls itself; use iteration or an explicit fixed-capacity work structure$/u,
    related: ["again()"],
    relatedOccurrence: 1,
  },
  {
    name: "an array whose aggregate element size makes its byte size overflow",
    source:
      "module Game; struct Pair { first: byte; second: byte; } let values: Pair[32768]; function main(): void {}",
    code: "E10265",
    proof: "Pair[32768]",
    message:
      /^Type 'Pair\[32768\]' requires 65536 bytes — fixed array and struct types are limited to 65535 bytes$/u,
    related: [],
  },
  {
    name: "a compile-time function address",
    source:
      "module Game; comptime function value(): byte { return 1; } function main(): void { let address: word = &value; }",
    code: "E10043",
    proof: "&value",
    message:
      /^Address-of requires an addressable storage place or target function — 'value' has no target address$/u,
    related: ["value"],
  },
  {
    name: "an unsized parameter returned as a complete fixed array",
    source:
      "module Game; export function copy(items: const byte[]): byte[2] { return items; } function main(): void {}",
    code: "E10253",
    proof: "items",
    occurrence: 1,
    message:
      /^Array use at '[^']+' has no compile-time-known extent — add '\[N\]', use an extent-inferencing initializer, or keep 'T\[\]' as an outermost parameter form$/u,
    related: ["items"],
  },
  {
    name: "a function cast to a byte instead of a word",
    source:
      "module Game; function helper(): void {} function main(): void { let address: byte = byte(&helper); }",
    code: "E10153",
    proof: "byte(&helper)",
    message:
      /^Cannot cast 'fn\(\): void' to 'byte' — casts support integer\/enum conversions and one-way function\/handler conversion to word only$/u,
    related: [],
  },
  {
    name: "a string prefix used to initialize a non-byte array",
    source: 'module Game; function main(): void { let values: word[4] = ["HI"; word(0)]; }',
    code: "E10080",
    proof: '"HI"',
    message: /^Cannot implicitly convert 'byte\[2\]' to 'word\[4\]' — .+$/u,
    related: [],
  },
  {
    name: "a string used where the array fill requires one byte",
    source: 'module Game; function main(): void { let values: byte[5] = [1, 2; "HI"]; }',
    code: "E10115",
    proof: '"HI"',
    message: /^Fill value has type 'byte\[2\]' but array element type is 'byte'$/u,
    related: [],
  },
] as const;

describe("canonical diagnostics from alternate value producers", () => {
  it.each([
    ["lo", "word"],
    ["hi", "word"],
    ["sin8", "byte"],
    ["cos8", "byte"],
    ["sin16", "word"],
    ["cos16", "word"],
  ])("rejects boolean-to-integer conversion consistently in %s", async (name, target) => {
    const source = `module Game; function main(): void { ${name}(true); }`;
    const result = await analyzeDiagnosticSource(source);
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10086",
      severity: "error",
      pointer: null,
      message: `Cannot cast 'boolean' to '${target}' — boolean is not convertible to or from an integer`,
      primarySpan: diagnosticSpan(source, "true"),
      related: [],
    });
  });

  it.each(cases)("reports the canonical record for $name", async (testCase) => {
    const result = await analyzeDiagnosticSource(testCase.source);
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.kind).toBe("error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: testCase.code,
      severity: "error",
      pointer: null,
      message: expect.stringMatching(testCase.message),
      primarySpan: diagnosticSpan(
        testCase.source,
        testCase.proof,
        "occurrence" in testCase ? testCase.occurrence : 0,
      ),
    });
    expect(errors[0]?.related.map(({ span }) => span)).toEqual(
      testCase.related.map((proof) =>
        diagnosticSpan(
          testCase.source,
          proof,
          "relatedOccurrence" in testCase ? testCase.relatedOccurrence : 0,
        ),
      ),
    );
    expect(errors[0]?.help === null || typeof errors[0]?.help === "string").toBe(true);
  });
});
