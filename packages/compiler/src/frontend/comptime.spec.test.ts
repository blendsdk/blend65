import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { analyzeModules } from "./analyzer.js";
import { indexModules, resolveModules } from "./modules.js";

function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Reduced internal limits let small fixtures exercise the same boundary as production. */
interface BudgetLimits {
  readonly maxSteps: number;
  readonly maxLiveBytes: number;
  readonly maxActiveCalls: number;
}

/** Resolve one source module and analyze it with optional test-only resource limits. */
function analyze(text: string, budgetLimits?: BudgetLimits): ReturnType<typeof analyzeModules> {
  const manifestText = "{}";
  const source: SourceRecord = {
    sourceId: "game.blend",
    text,
    sha256: hash(text),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: "/checkout/game.blend",
  };
  const project: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "comptime-spec",
      sourceRoot: "src",
      entry: "Game",
      target: "test.target",
      assetPaths: [],
      outDir: "out",
      optimization: "none",
      boundsCheck: true,
      divisionZeroCheck: true,
    },
    manifestSource: {
      sourceId: "blend65.json",
      text: manifestText,
      sha256: hash(manifestText),
      byteLength: Buffer.byteLength(manifestText, "utf8"),
      resolvedPath: "/checkout/blend65.json",
    },
    sources: [source],
    inputSha256: hash(text),
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: [],
    outDir: "/checkout/out",
    overrides: { target: null, entry: null },
    effectiveTarget: "test.target",
    effectiveEntry: "Game",
  };
  const indexed = indexModules(project);
  const resolved = resolveModules(project, indexed.index);
  expect(indexed.diagnostics).toEqual([]);
  expect(resolved.graph).not.toBeNull();
  if (resolved.graph === null) throw new Error("Expected a resolved Game module");
  return analyzeModules(project, resolved.graph, null, undefined, budgetLimits);
}

/** Read a scalar constant when a declaration remains valid after analysis. */
function findConstant(
  result: ReturnType<typeof analyzeModules>,
  qualifiedName: string,
): bigint | undefined {
  const binding = result.bindings.find((candidate) => candidate.qualifiedName === qualifiedName);
  if (binding === undefined) return undefined;
  const declaration = result.declarations.find(
    (candidate) =>
      candidate.kind === "typed" &&
      candidate.binding.sourceId === binding.id.sourceId &&
      candidate.binding.span.start === binding.id.span.start,
  );
  return declaration?.kind === "typed" ? declaration.initializer?.constant : undefined;
}

/** Require a scalar constant for successful-evaluation cases. */
function constant(result: ReturnType<typeof analyzeModules>, qualifiedName: string): bigint {
  const found = findConstant(result, qualifiedName);
  expect(found, `Missing constant ${qualifiedName}`).toBeDefined();
  if (found === undefined) throw new Error(`Missing constant ${qualifiedName}`);
  return found;
}

describe("compile-time functions", () => {
  // Direct calls, local mutation, and typed parameters produce one constant result.
  it("should evaluate nested acyclic functions with mutable local values", () => {
    const result = analyze(
      [
        "module Game;",
        "comptime function double(value: byte): byte { return value + value; }",
        "comptime function addThree(value: byte): byte {",
        "  let result: byte = double(value);",
        "  result += 3;",
        "  return result;",
        "}",
        "const ANSWER: byte = addThree(7);",
        "function main(): void {}",
      ].join("\n"),
    );

    expect(result.diagnostics).toEqual([]);
    expect(constant(result, "Game.ANSWER")).toBe(17n);
  });

  // An unreachable infinite loop performs no evaluation and consumes no compile-time budget.
  it("should skip an infinite loop in an unselected branch", () => {
    const result = analyze(
      [
        "module Game;",
        "comptime function choose(): byte {",
        "  if (false) { for (; true; ) {} }",
        "  return 7;",
        "}",
        "const ANSWER: byte = choose();",
        "function main(): void {}",
      ].join("\n"),
    );
    expect(result.diagnostics).toEqual([]);
    expect(constant(result, "Game.ANSWER")).toBe(7n);
  });

  // A compile-time call cannot depend on a runtime variable, even when its body is pure.
  it("should reject a runtime argument to a compile-time function", () => {
    const result = analyze(
      "module Game; let live: byte = 3; comptime function identity(value: byte): byte { return value; } function main(): void { let answer: byte = identity(live); }",
    );
    expect(result.diagnostics.map(({ code }) => code)).toContain("E10191");
  });

  // Compile-time evaluation has no target function address or volatile memory access.
  it("should reject taking the address of a compile-time function", () => {
    const result = analyze(
      "module Game; comptime function answer(): byte { return 1; } let address: word = &answer; function main(): void {}",
    );
    expect(result.diagnostics.map(({ code }) => code)).toContain("E10043");
  });

  // The prohibited operation itself, not a later use of the result, owns the error.
  it("should reject a volatile read inside a compile-time function", () => {
    const text =
      "module Game; comptime function answer(): byte { return peek($D020); } const VALUE: byte = answer(); function main(): void {}";
    const result = analyze(text);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "E10191",
        primarySpan: expect.objectContaining({ start: text.indexOf("peek($D020)") }),
      }),
    );
  });

  // Static recursion remains forbidden inside compile-time functions.
  it("should reject a directly recursive compile-time function", () => {
    const result = analyze(
      "module Game; comptime function again(): byte { return again(); } const VALUE: byte = again(); function main(): void {}",
    );
    expect(result.diagnostics.map(({ code }) => code)).toContain("E10180");
  });
});

describe("compile-time resource budget", () => {
  // Each selected literal expression consumes one step, and roots share one counter.
  it("should accept the exact step limit and reject the next selected root before evaluation", () => {
    const text = "module Game; const B: byte = 2; const A: byte = 1; function main(): void {}";
    const budget = { maxLiveBytes: 16_777_216, maxActiveCalls: 512 };
    const exact = analyze(text, { ...budget, maxSteps: 2 });
    expect(exact.diagnostics).toEqual([]);
    expect(constant(exact, "Game.A")).toBe(1n);
    expect(constant(exact, "Game.B")).toBe(2n);

    const over = analyze(text, { ...budget, maxSteps: 1 });
    const rejected = over.diagnostics.find(({ code }) => code === "E10269");
    expect(rejected).toBeDefined();
    expect(rejected?.message).toContain("comptime-budget-v1");
    expect(rejected?.message).toContain("2");
    expect(rejected?.primarySpan.start).toBe(text.indexOf("= 2;") + 2);
    expect(constant(over, "Game.A")).toBe(1n);
    expect(findConstant(over, "Game.B")).toBeUndefined();
  });

  // The literal temporary overlaps its one-byte retained constant until the expression ends.
  it("should accept two live bytes and reject the second when limited to one", () => {
    const text = "module Game; const VALUE: byte = 1; function main(): void {}";
    const budget = { maxSteps: 16_777_216, maxActiveCalls: 512 };
    const exact = analyze(text, { ...budget, maxLiveBytes: 2 });
    expect(exact.diagnostics).toEqual([]);
    expect(constant(exact, "Game.VALUE")).toBe(1n);

    const over = analyze(text, { ...budget, maxLiveBytes: 1 });
    const rejected = over.diagnostics.find(({ code }) => code === "E10270");
    expect(rejected).toBeDefined();
    expect(rejected?.message).toContain("comptime-budget-v1");
    expect(rejected?.message).toContain("allows 1 live logical bytes");
    expect(rejected?.message).toContain("would require 2");
    expect(findConstant(over, "Game.VALUE")).toBeUndefined();
  });

  // A nested direct call enters depth two; the rejected call never starts its body.
  it("should accept the exact call depth and reject entry at depth two", () => {
    const text = [
      "module Game;",
      "comptime function inner(): byte { return 7; }",
      "comptime function outer(): byte { return inner(); }",
      "const VALUE: byte = outer();",
      "function main(): void {}",
    ].join("\n");
    const budget = { maxSteps: 16_777_216, maxLiveBytes: 16_777_216 };
    const exact = analyze(text, { ...budget, maxActiveCalls: 2 });
    expect(exact.diagnostics).toEqual([]);
    expect(constant(exact, "Game.VALUE")).toBe(7n);

    const over = analyze(text, { ...budget, maxActiveCalls: 1 });
    const rejected = over.diagnostics.find(({ code }) => code === "E10271");
    expect(rejected).toBeDefined();
    expect(rejected?.message).toContain("comptime-budget-v1");
    expect(rejected?.message).toContain("2");
    expect(rejected?.primarySpan.start).toBe(text.indexOf("inner();"));
    expect(rejected?.related).toContainEqual(
      expect.objectContaining({
        span: expect.objectContaining({ start: text.indexOf("outer();") }),
      }),
    );
    expect(findConstant(over, "Game.VALUE")).toBeUndefined();
  });
});

describe("compile-time integer trigonometry", () => {
  // Exact specified phase samples include both positive and negative extrema.
  it.each([
    ["sin8(0)", 0n],
    ["cos8(0)", 127n],
    ["sin8(32)", 90n],
    ["sin8(64)", 127n],
    ["sin8(128)", 0n],
    ["sin8(192)", -127n],
    ["sin16(8192)", 23170n],
    ["sin16(16384)", 32767n],
    ["sin16(32768)", 0n],
    ["sin16(49152)", -32767n],
    ["cos16(0)", 32767n],
    ["cos16(16384)", 0n],
  ])("should evaluate %s exactly", (expression, expected) => {
    const type = expression.includes("16(") ? "sword" : "sbyte";
    const result = analyze(
      `module Game; const VALUE: ${type} = ${expression}; function main(): void {}`,
    );
    expect(result.diagnostics).toEqual([]);
    expect(constant(result, "Game.VALUE")).toBe(expected);
  });

  // The complete byte-width wave is a canonical integer stream, not host floating-point output.
  it("should produce the canonical 256-phase sine byte stream", () => {
    const declarations = Array.from(
      { length: 256 },
      (_, phase) => `const VALUE_${phase}: sbyte = sin8(${phase});`,
    );
    const result = analyze(
      ["module Game;", ...declarations, "function main(): void {}"].join("\n"),
    );
    expect(result.diagnostics).toEqual([]);
    const values = Array.from({ length: 256 }, (_, phase) => {
      const value = constant(result, `Game.VALUE_${phase}`);
      expect(value).toBeDefined();
      return Number(value) & 0xff;
    });
    expect(createHash("sha256").update(Buffer.from(values)).digest("hex")).toBe(
      "fec3247a063767c499a18d6efdb1e5f86f96f859e2e98a859d621e93af013259",
    );
  });

  // Reserved intrinsic names have no callable target entry point.
  it("should reject taking the address of a trigonometry intrinsic", () => {
    const result = analyze("module Game; let address: word = &sin8; function main(): void {}");
    expect(result.diagnostics.map(({ code }) => code)).toContain("E10043");
  });
});
