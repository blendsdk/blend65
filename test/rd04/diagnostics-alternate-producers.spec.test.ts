import { describe, expect, it } from "vitest";
import { analyzeDiagnosticSource, diagnosticSpan } from "./diagnostic-fixture.js";

describe("canonical diagnostics from alternate intrinsic producers", () => {
  it.each([
    ["sin8", 1, 0, "sin8()"],
    ["cos8", 1, 2, "cos8(0, 1)"],
    ["sin16", 1, 0, "sin16()"],
    ["cos16", 1, 2, "cos16(0, 1)"],
    ["lo", 1, 0, "lo()"],
    ["hi", 1, 2, "hi(0, 1)"],
    ["bcd_add", 2, 1, "bcd_add(0)"],
    ["bcd_sub", 2, 3, "bcd_sub(0, 1, 2)"],
    ["peek", 1, 0, "peek()"],
    ["poke", 2, 3, "poke($0400, 1, 2)"],
  ] as const)("uses canonical arity framing for %s", async (name, count, actual, call) => {
    const source = `module Game; function main(): void { ${call}; }`;
    const result = await analyzeDiagnosticSource(source);
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.kind).toBe("error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10171",
      severity: "error",
      pointer: null,
      message: `Wrong argument count — '${name}()' expects ${count} parameters, got ${actual}`,
      primarySpan: diagnosticSpan(source, call),
      related: [],
    });
  });

  it.each(["petscii", "screen_codes"])(
    "reports both supported arities when %s has too many arguments",
    async (name) => {
      const call = `${name}('A', "upper_graphics", "lower_upper")`;
      const source = `module Game; function main(): void { ${call}; }`;
      const result = await analyzeDiagnosticSource(source);
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        code: "E10171",
        severity: "error",
        pointer: null,
        message: `Wrong argument count — '${name}()' expects 1 or 2 parameters, got 3`,
        primarySpan: diagnosticSpan(source, call),
        related: [],
      });
    },
  );

  it.each(["sin8", "cos8", "sin16", "cos16"])(
    "reports compile-time evaluability for a runtime %s phase",
    async (name) => {
      const read = name.endsWith("16") ? "peekw($0400)" : "peek($0400)";
      const call = `${name}(${read})`;
      const source = `module Game; function main(): void { ${call}; }`;
      const result = await analyzeDiagnosticSource(source);
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        code: "E10191",
        severity: "error",
        pointer: null,
        message: expect.stringMatching(/^Expression must be compile-time evaluable — .+$/u),
        primarySpan: diagnosticSpan(source, call),
        related: [],
      });
    },
  );

  it.each([
    ["lo", "word", '"A"', "byte[1]"],
    ["hi", "word", '"A"', "byte[1]"],
    ["sin8", "byte", "sbyte(1)", "sbyte"],
    ["cos8", "byte", "sbyte(1)", "sbyte"],
    ["sin16", "word", "sword(1)", "sword"],
    ["cos16", "word", "sword(1)", "sword"],
  ])("reports the incompatible argument conversion in %s", async (name, target, proof, actual) => {
    const source = `module Game; function main(): void { ${name}(${proof}); }`;
    const result = await analyzeDiagnosticSource(source);
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10080",
      severity: "error",
      pointer: null,
      message: expect.stringContaining(`Cannot implicitly convert '${actual}' to '${target}' — `),
      primarySpan: diagnosticSpan(source, proof),
      related: [],
    });
    expect(errors[0]?.message).toMatch(/^Cannot implicitly convert '[^']+' to '[^']+' — .+$/u);
  });

  it.each(["petscii", "screen_codes"])(
    "names the unavailable map and actual alternatives for %s",
    async (name) => {
      const call = `${name}('A', "missing_map")`;
      const source = `module Game; const TEXT: byte = ${call}; function main(): void {}`;
      const result = await analyzeDiagnosticSource(source);
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
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
    },
  );

  it.each(["poke", "pokew"])(
    "retains the read-only origin through an address passed to %s",
    async (name) => {
      const call = `${name}(address, 1)`;
      const source = `module Game; const DATA: byte[2] = [1, 2]; function main(): void { let address: word = &DATA[0]; ${call}; }`;
      const result = await analyzeDiagnosticSource(source);
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        code: "E10123",
        severity: "error",
        pointer: null,
        message: "Cannot modify through read-only origin 'DATA'",
        primarySpan: diagnosticSpan(source, "address", 1),
      });
      expect(errors[0]?.related.map(({ span }) => span)).toEqual([diagnosticSpan(source, "DATA")]);
    },
  );

  it.each([
    ["bcd_add", "byte(1), word(1)", "right", "byte", "word", "word(1)"],
    ["bcd_sub", "sbyte(1), byte(1)", "left", "byte", "sbyte", "sbyte(1)"],
  ])(
    "reports typed parameter expectations for %s",
    async (name, args, parameter, expected, actual, proof) => {
      const source = `module Game; function main(): void { ${name}(${args}); }`;
      const result = await analyzeDiagnosticSource(source);
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        code: "E10172",
        severity: "error",
        pointer: null,
        message: `Argument type mismatch — parameter '${parameter}' of '${name}()' expects '${expected}', found '${actual}'`,
        primarySpan: diagnosticSpan(source, proof),
        related: [],
      });
    },
  );

  it.each(["sin8", "cos8", "sin16", "cos16"])(
    "rejects an address for compile-time intrinsic %s",
    async (name) => {
      const source = `module Game; function main(): void { let address: word = &${name}; }`;
      const result = await analyzeDiagnosticSource(source);
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        code: "E10043",
        severity: "error",
        pointer: null,
        message: `Address-of requires an addressable storage place or target function — '${name}' has no target address`,
        primarySpan: diagnosticSpan(source, `&${name}`),
        related: [],
      });
    },
  );
});
