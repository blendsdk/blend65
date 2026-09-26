import { describe, expect, it } from "vitest";
import { analyzeDiagnosticSource, diagnosticSpan } from "./diagnostic-fixture.js";

const operandCases = [
  { type: "byte", declarations: "", initializer: "7" },
  { type: "sbyte", declarations: "", initializer: "-7" },
  { type: "word", declarations: "", initializer: "300" },
  { type: "sword", declarations: "", initializer: "-300" },
  { type: "Direction", declarations: "enum Direction { Up, Down }", initializer: "Direction.Up" },
  { type: "Pair", declarations: "struct Pair { value: byte; }", initializer: "{ value: 7 }" },
  { type: "byte[2]", declarations: "", initializer: "[7, 8]" },
  {
    type: "fn(): byte",
    declarations: "function sample(): byte { return 7; }",
    initializer: "&sample",
  },
] as const;

const logicalForms = [
  { operator: "!", expression: "!operand" },
  { operator: "&&", expression: "operand && true" },
  { operator: "&&", expression: "true && operand" },
  { operator: "||", expression: "operand || false" },
  { operator: "||", expression: "false || operand" },
] as const;

describe("logical operand diagnostic identity", () => {
  // Logical operators require Boolean values, including on either side of a binary operator.
  describe.each(operandCases)("$type operands", (operand) => {
    it.each(logicalForms)("should reject $expression at the offending operand", async (form) => {
      const source = `module Game; ${operand.declarations} /* £ */ function main(): void { let operand: ${operand.type} = ${operand.initializer}; ${form.expression}; }`;
      const result = await analyzeDiagnosticSource(source);
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(result.kind).toBe("error");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        code: "E10280",
        severity: "error",
        pointer: null,
        message: `Logical operator '${form.operator}' requires Boolean operands — found '${operand.type}'`,
        primarySpan: diagnosticSpan(source, "operand", 1),
        related: [],
      });
    });
  });

  // Boolean logic remains legal; a diagnostic identity does not change language acceptance.
  it.each(["!true", "true && false", "false || true"])(
    "should accept Boolean expression %s",
    async (expression) => {
      const source = `module Game; function main(): void { let result: boolean = ${expression}; }`;
      const result = await analyzeDiagnosticSource(source);
      expect(result.kind).toBe("complete");
      expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    },
  );

  // Boolean arithmetic and bitwise misuse retain their separate existing diagnostic.
  it.each(["true + false", "true & false"])(
    "should preserve the Boolean arithmetic diagnostic for %s",
    async (expression) => {
      const source = `module Game; function main(): void { ${expression}; }`;
      const result = await analyzeDiagnosticSource(source);
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(result.kind).toBe("error");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        code: "E10151",
        severity: "error",
        message: "Cannot use 'boolean' in an arithmetic or bitwise expression",
        primarySpan: diagnosticSpan(source, expression),
        related: [],
      });
    },
  );
});

describe.each(["petscii", "screen_codes"])("%s literal-input diagnostic", (encoding) => {
  // Encodings consume source literals, not values that happen to have the same byte representation.
  it.each([
    { name: "character-valued variable", setup: "let character: byte = 'A';", input: "character" },
    { name: "numeric literal", setup: "", input: "7" },
    { name: "computed byte array", setup: "", input: 'true ? "AB" : "CD"' },
  ])("should reject a $name at the complete first argument", async (testCase) => {
    const call = `${encoding}(${testCase.input})`;
    const source = `module Game; /* £ */ function main(): void { ${testCase.setup} ${call}; }`;
    const result = await analyzeDiagnosticSource(source);
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.kind).toBe("error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10281",
      severity: "error",
      pointer: null,
      message: `Encoding '${encoding}' requires a character or string literal as its first argument — found '${testCase.input}'`,
      primarySpan: diagnosticSpan(source, testCase.input, testCase.setup === "" ? 0 : 1),
      related: [],
    });
  });

  // Both supported literal shapes remain accepted without a runtime encoding operation.
  it.each(["'A'", '"AB"'])("should accept literal %s", async (input) => {
    const source = `module Game; function main(): void { ${encoding}(${input}); }`;
    const result = await analyzeDiagnosticSource(source);
    expect(result.kind).toBe("complete");
    expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
  });

  // An unavailable map is not a malformed first argument and keeps its established identity.
  it("should preserve the unavailable-map diagnostic", async () => {
    const source = `module Game; function main(): void { ${encoding}('A', "missing_map"); }`;
    const result = await analyzeDiagnosticSource(source);
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.kind).toBe("error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10125",
      severity: "error",
      pointer: null,
      message: expect.stringMatching(
        /^Encoding or character map 'missing_map' is unavailable for platform 'c64-pal-prg-kernal-6581' — available: (?:upper_graphics, lower_upper|lower_upper, upper_graphics)$/u,
      ),
      primarySpan: diagnosticSpan(source, '"missing_map"'),
      related: [],
    });
  });
});
