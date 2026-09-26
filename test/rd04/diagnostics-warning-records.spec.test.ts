import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { analyzeDiagnosticSource, diagnosticSpan } from "./diagnostic-fixture.js";

const sourceCases = [
  {
    code: "W10101",
    declaration: "",
    body: "poke($0400, byte(4660));",
    proof: "byte(4660)",
    message: "Narrowing cast from 'word' to 'byte' truncates 4660 to 52",
    related: [],
  },
  {
    code: "W10141",
    declaration: "let values: byte[2];",
    body: "poke($0400, values[0]);",
    proof: "values",
    message: "Array 'values' is uninitialized — all 2 elements are indeterminate",
    related: [],
  },
  {
    code: "W10161",
    declaration: "",
    body: "let value: word = byte(255) + byte(1); pokew($0400, value);",
    proof: "byte(255) + byte(1)",
    message:
      "Runtime expression 'byte(255) + byte(1)' is known to wrap to 0 at 'byte' width before widening to 'word'",
    related: [],
  },
  {
    code: "W10174",
    declaration: "",
    body: "poke($0400, byte(1) << 8);",
    proof: "8",
    message:
      "Shift amount 8 is at least the 8-bit width — '<<' yields 0; signed negative '>>' yields -1, otherwise '>>' yields 0",
    related: [],
  },
  {
    code: "W10190",
    declaration: "",
    body: "let value: byte; poke($0400, value);",
    proof: "value",
    occurrence: 1,
    message: "Variable 'value' may be read before initialization — its value is indeterminate",
    related: ["value"],
  },
] as const;

/** Reach selected arithmetic, deduplicated assets, and cross-domain effects through real builds. */
async function build(source: string) {
  const root = await mkdtemp(join(tmpdir(), "blend65-warning-records-"));
  try {
    await mkdir(join(root, "src"));
    await mkdir(join(root, "assets"));
    await writeFile(join(root, "src/game.blend"), source);
    await writeFile(join(root, "assets/data.bin"), Uint8Array.of(7, 8));
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "warning-records",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        assetPaths: ["assets"],
        outDir: "out",
        optimization: "none",
      }),
    );
    return await buildProject({ project: join(root, "blend65.json"), optimization: "none" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("canonical scalar and initialization warning fields", () => {
  // A warning retains its precise source expression without rejecting legal source behavior.
  it.each(sourceCases)(
    "should report $code with its canonical source and related fields",
    async (testCase) => {
      const source = `module Game; ${testCase.declaration} function main(): void { ${testCase.body} }`;
      const result = await analyzeDiagnosticSource(source);
      expect(result.kind).toBe("complete");
      const warnings = result.diagnostics.filter(({ code }) => code === testCase.code);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({
        code: testCase.code,
        severity: "warning",
        pointer: null,
        message: testCase.message,
        primarySpan: diagnosticSpan(
          source,
          testCase.proof,
          "occurrence" in testCase ? testCase.occurrence : 0,
        ),
      });
      expect(warnings[0]?.related.map(({ span }) => span)).toEqual(
        testCase.related.map((proof) => diagnosticSpan(source, proof)),
      );
    },
  );
});

const arithmeticCases = [
  {
    code: "W10170",
    expression: "left * right",
    message:
      /^Runtime multiply uses a software sequence of about [1-9]\d* cycles for 8-bit operands$/u,
  },
  {
    code: "W10171",
    expression: "left / right",
    message:
      /^Runtime division or remainder uses a software sequence of about [1-9]\d* cycles for 8-bit operands$/u,
  },
  {
    code: "W10172",
    expression: "left * byte(3)",
    message:
      /^Multiply by 3 uses a shift-and-add sequence of about [1-9]\d* cycles — consider a power-of-two stride when practical$/u,
  },
] as const;

describe("canonical selected arithmetic warning fields", () => {
  // The source site and canonical cost framing are stable while the selected legal sequence may improve.
  it.each(arithmeticCases)(
    "should report $code at its exact arithmetic expression",
    async (testCase) => {
      const source = `module Game; function main(): void { let left: byte = peek($0400); let right: byte = peek($0401); poke($0402, ${testCase.expression}); }`;
      const result = await build(source);
      expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
      const warnings = result.diagnostics.filter(({ code }) => code === testCase.code);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({
        code: testCase.code,
        severity: "warning",
        pointer: null,
        message: expect.stringMatching(testCase.message),
        primarySpan: diagnosticSpan(source, testCase.expression),
        related: [],
      });
    },
    60_000,
  );

  // A variable divisor is not proven nonzero merely by being byte-typed.
  it("should report W10173 at the unchecked runtime divisor", async () => {
    const source =
      "module Game; function main(): void { let divisor: byte = peek($0400); poke($0402, peek($0401) / divisor); }";
    const result = await build(source);
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
    const warnings = result.diagnostics.filter(({ code }) => code === "W10173");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      code: "W10173",
      severity: "warning",
      pointer: null,
      message:
        "Runtime divisor 'divisor' is not proven nonzero — zero has an unspecified valid-width result; guard it or use '--division-zero-check'",
      primarySpan: diagnosticSpan(source, "divisor", 1),
      related: [],
    });
  }, 60_000);
});

describe("canonical shared data warning fields", () => {
  // Two identical raw requests name a single emitted object; the second declaration completes the pair.
  it("should report W10151 with both aliasing embedded declarations", async () => {
    const source =
      'module Game; const FIRST: byte[] = embed("data.bin"); const SECOND: byte[] = embed("data.bin"); function main(): void { poke($0400, FIRST[0]); poke($0401, SECOND[0]); }';
    const result = await build(source);
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
    const warnings = result.diagnostics.filter(({ code }) => code === "W10151");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      code: "W10151",
      severity: "warning",
      pointer: null,
      message: expect.stringMatching(
        /^2 declarations share embedded output 'data\.bin' selector '[^']*' at one address$/u,
      ),
      primarySpan: diagnosticSpan(source, "SECOND"),
    });
    expect(warnings[0]?.related.map(({ span }) => span)).toEqual([diagnosticSpan(source, "FIRST")]);
  }, 60_000);

  // Both exact conflicting operations must be shown; choosing either as primary must retain the other.
  it("should report W10211 with the two cross-domain byte updates", async () => {
    const source =
      "module Game; import { setIRQ, restoreIRQ } from c64.system; let count: byte = 0; interrupt function handler(): void { count += 1; } function main(): void { setIRQ(&handler); count += peek($0401); restoreIRQ(); }";
    const result = await build(source);
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
    const warnings = result.diagnostics.filter(({ code }) => code === "W10211");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      code: "W10211",
      severity: "warning",
      pointer: null,
      message:
        "Shared 'count' has an unprotected cross-domain read-modify-write that can lose an update",
    });
    const sites = [
      warnings[0]?.primarySpan,
      ...(warnings[0]?.related.map(({ span }) => span) ?? []),
    ];
    expect(sites).toHaveLength(2);
    expect(sites).toEqual(
      expect.arrayContaining([
        diagnosticSpan(source, "count += 1"),
        diagnosticSpan(source, "count += peek($0401)"),
      ]),
    );
  }, 60_000);

  // A word write and a concurrent word read expose a tear even without read-modify-write arithmetic.
  it("should report W10212 with the cross-domain word write and read", async () => {
    const source =
      "module Game; import { setIRQ, restoreIRQ } from c64.system; let position: word = 0; interrupt function handler(): void { position = peekw($0402); } function main(): void { setIRQ(&handler); pokew($0400, position); restoreIRQ(); }";
    const result = await build(source);
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
    const warnings = result.diagnostics.filter(({ code }) => code === "W10212");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      code: "W10212",
      severity: "warning",
      pointer: null,
      message: expect.stringMatching(
        /^Shared multi-byte 'position' can tear across '(?:mainline|irq)' and '(?:mainline|irq)' access$/u,
      ),
    });
    const sites = [
      warnings[0]?.primarySpan,
      ...(warnings[0]?.related.map(({ span }) => span) ?? []),
    ];
    expect(sites).toHaveLength(2);
    expect(sites).toEqual(
      expect.arrayContaining([
        diagnosticSpan(source, "position = peekw($0402)"),
        diagnosticSpan(source, "position", 2),
      ]),
    );
    expect(warnings[0]?.message).toContain("'mainline'");
    expect(warnings[0]?.message).toContain("'irq'");
  }, 60_000);
});
