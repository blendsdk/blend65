import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import * as constantBytes from "./constant-bytes.js";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { analyzeModules } from "./analyzer.js";
import { ComptimeBudget, ComptimeBudgetFailure } from "./comptime-budget.js";
import type { ComptimeBudgetLimits } from "./comptime-budget.js";
import { indexModules, resolveModules } from "./modules.js";
import { evaluateIntegerTrigonometry } from "./trigonometry.js";

/** Run one in-memory program through the real module and semantic frontends. */
function analyze(text: string, limits?: ComptimeBudgetLimits): ReturnType<typeof analyzeModules> {
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const source: SourceRecord = {
    sourceId: "game.blend",
    text,
    sha256: hash(text),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: "/checkout/game.blend",
  };
  const manifestText = "{}";
  const project: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "comptime-implementation",
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
  if (resolved.graph === null) throw new Error("Expected a Game module");
  return analyzeModules(project, resolved.graph, null, undefined, limits);
}

/** Read one successfully folded scalar constant by source name. */
function scalar(result: ReturnType<typeof analyzeModules>, name: string): bigint | boolean | null {
  const binding = result.bindings.find((candidate) => candidate.qualifiedName === `Game.${name}`);
  const declaration = result.declarations.find(
    (candidate) =>
      candidate.kind === "typed" &&
      candidate.binding.sourceId === binding?.id.sourceId &&
      candidate.binding.span.start === binding.id.span.start,
  );
  return declaration?.kind === "typed" ? (declaration.initializer?.constant ?? null) : null;
}

describe("compile-time aggregate implementation edges", () => {
  it("evaluates calls nested in a function-local constant aggregate", () => {
    const result = analyze(`module Game;
      comptime function value(): byte { return 5; }
      function main(): void { const DATA: byte[1] = [value()]; }`);
    expect(result.diagnostics).toMatchObject([
      {
        code: "W10191",
        severity: "warning",
        message: "Variable 'DATA' is declared but never used",
      },
    ]);
    const body = result.declarations.find(
      (item) =>
        item.kind === "typed" &&
        item.body?.statements.some((statement) => statement.kind === "variable"),
    );
    const local = body?.kind === "typed" ? body.body?.statements[0] : null;
    expect(local?.kind === "variable" ? local.initializer?.encodedBytes : null).toEqual([5]);
  });

  it.each([
    ["make()[0]", "byte", "byte[1]", "[Z]", [7]],
    ["[make()]", "byte[1]", "byte", "Z", [7]],
    ["[make(), 9]", "byte[2]", "byte", "Z", [7, 9]],
    ["{ item: make() }", "Box", "byte", "Z", [7]],
    ["[; make()]", "byte[2]", "byte", "Z", [7, 7]],
  ])(
    "evaluates forward dependencies within %s",
    (initializer, type, returnType, returned, bytes) => {
      const result = analyze(`module Game;
      struct Box { item: byte; }
      const A: ${type} = ${initializer};
      const Z: byte = 7;
      comptime function make(): ${returnType} { return ${returned}; }
      function main(): void {}`);
      expect(result.diagnostics).toMatchObject([
        { code: "W10191", severity: "warning", message: "Variable 'A' is declared but never used" },
      ]);
      const declaration = result.declarations.find(
        (item) =>
          item.kind === "typed" &&
          result.bindings.some(
            (binding) => binding.qualifiedName === "Game.A" && binding.id === item.binding,
          ),
      );
      if (declaration?.kind !== "typed" || declaration.initializer === null)
        throw new Error("Missing constant");
      expect(constantBytes.initializerBytes(declaration.initializer, declaration.type)).toEqual(
        bytes,
      );
    },
  );

  it.each([
    ["byte", "2", "+=", "1", 3n],
    ["byte", "255", "+=", "1", 0n],
    ["sbyte", "-8", "/=", "2", -4n],
    ["word", "256", ">>=", "1", 128n],
  ])(
    "applies indexed and field compound assignment for %s %s %s %s",
    (type, initial, operator, rhs, expected) => {
      for (const place of ["a[0]", "b.item"]) {
        const result = analyze(`module Game;
        struct Box { item: ${type}; }
        comptime function make(): ${type} {
          let a: ${type}[1] = [${initial}];
          let b: Box = { item: ${initial} };
          ${place} ${operator} ${rhs}; return ${place};
        }
        const RESULT: ${type} = make(); function main(): void {}`);
        expect(result.diagnostics).toMatchObject([
          {
            code: "W10191",
            severity: "warning",
            message: `Variable '${place === "a[0]" ? "b" : "a"}' is declared but never used`,
          },
          {
            code: "W10191",
            severity: "warning",
            message: "Variable 'RESULT' is declared but never used",
          },
        ]);
        expect(scalar(result, "RESULT")).toBe(expected);
      }
    },
  );

  it("captures the index and old element before a mutating compound RHS", () => {
    const result = analyze(`module Game;
      comptime function make(): byte {
        let a: byte[2] = [2, 9]; let i: byte = 0;
        a[i] += (a[i = 1] = 3); return a[0] + a[1];
      }
      const RESULT: byte = make(); function main(): void {}`);
    expect(result.diagnostics).toMatchObject([
      {
        code: "W10191",
        severity: "warning",
        message: "Variable 'RESULT' is declared but never used",
      },
    ]);
    expect(scalar(result, "RESULT")).toBe(8n);
  });

  it("encodes an immutable table once across repeated compile-time reads", () => {
    const encode = vi.spyOn(constantBytes, "initializerBytes");
    try {
      const result = analyze(`module Game;
        const TABLE: byte[8192] = [; 7];
        comptime function sum(): word {
          let total: word = 0;
          for (let i: word = 0; i < 100; i += 1) { total += TABLE[i]; }
          return total;
        }
        const A: word = sum(); function main(): void {}`);
      expect(result.diagnostics).toMatchObject([
        { code: "W10191", severity: "warning", message: "Variable 'A' is declared but never used" },
      ]);
      expect(scalar(result, "A")).toBe(700n);
      expect(encode.mock.calls.filter(([, type]) => type.kind === "array")).toHaveLength(1);
    } finally {
      encode.mockRestore();
    }
  });

  it("retains signed element width when a compile-time read is widened", () => {
    const result = analyze(`module Game;
      const TABLE: sbyte[2] = [-2, 7];
      comptime function read(): sword { return TABLE[0]; }
      const RESULT: sword = read(); function main(): void {}`);
    expect(result.diagnostics).toMatchObject([
      {
        code: "W10191",
        severity: "warning",
        message: "Variable 'RESULT' is declared but never used",
      },
    ]);
    expect(scalar(result, "RESULT")).toBe(-2n);
  });

  it("rejects a runtime fill instead of treating it as a deferred constant", () => {
    const result = analyze(`module Game;
      let source: byte = 1;
      const TABLE: byte[2] = [; source]; function main(): void {}`);
    expect(result.diagnostics.map(({ code }) => code)).toContain("E10191");
  });

  it("should write nested scalar fields and array elements at their full byte offset", () => {
    const result = analyze(
      [
        "module Game;",
        "struct Inner { left: byte; right: byte; }",
        "struct Outer { prefix: byte; inner: Inner; }",
        "comptime function make(): byte {",
        "  let value: Outer = { prefix: 9, inner: { left: 1, right: 2 } };",
        "  value.inner.right = 7;",
        "  return value.prefix + value.inner.right;",
        "}",
        "const RESULT: byte = make();",
        "function main(): void {}",
      ].join("\n"),
    );
    expect(result.diagnostics).toMatchObject([
      {
        code: "W10191",
        severity: "warning",
        message: "Variable 'RESULT' is declared but never used",
      },
    ]);
    expect(scalar(result, "RESULT")).toBe(16n);
  });

  it("should assign a nested fixed array without overwriting its neighboring field", () => {
    const result = analyze(
      [
        "module Game;",
        "struct Outer { prefix: byte; data: byte[2]; suffix: byte; }",
        "comptime function make(): byte {",
        "  let value: Outer = { prefix: 8, data: [1, 2], suffix: 9 };",
        "  value.data = [4, 5];",
        "  return value.prefix + value.data[1] + value.suffix;",
        "}",
        "const RESULT: byte = make();",
        "function main(): void {}",
      ].join("\n"),
    );
    expect(result.diagnostics).toMatchObject([
      {
        code: "W10191",
        severity: "warning",
        message: "Variable 'RESULT' is declared but never used",
      },
    ]);
    expect(scalar(result, "RESULT")).toBe(22n);
  });
});

describe("compile-time packed-BCD implementation", () => {
  it("should evaluate typed decimal arithmetic inside a compile-time function", () => {
    const result = analyze(
      [
        "module Game;",
        "comptime function add(value: word): word { return bcd_add(value, word($0001)); }",
        "const RESULT: word = add(word($0099));",
        "function main(): void {}",
      ].join("\n"),
    );
    expect(result.diagnostics).toMatchObject([
      {
        code: "W10191",
        severity: "warning",
        message: "Variable 'RESULT' is declared but never used",
      },
    ]);
    expect(scalar(result, "RESULT")).toBe(0x0100n);
  });

  it("should reject an invalid digit that becomes known during compile-time evaluation", () => {
    const result = analyze(
      [
        "module Game;",
        "comptime function add(value: byte): byte { return bcd_add(value, byte(1)); }",
        "const RESULT: byte = add(byte($1A));",
        "function main(): void {}",
      ].join("\n"),
    );
    expect(result.diagnostics.map(({ code }) => code)).toContain("E10254");
  });
});

describe("compile-time budget implementation", () => {
  const span = Object.freeze({ sourceId: "game.blend", start: 0, end: 1 });

  it.each([
    "if (false) { return 0; } else if (true) { return 1; } return 0;",
    "for (let i: byte = 0; false; i += 1) {} return 1;",
  ])("charges selected nested statements before execution: %s", (body) => {
    const source = `module Game; comptime function F(): byte { ${body} }
      const RESULT: byte = F(); function main(): void {}`;
    const limits = { maxSteps: 9, maxLiveBytes: 1024, maxActiveCalls: 10 };
    const exact = analyze(source, limits);
    expect(exact.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    expect(scalar(exact, "RESULT")).toBe(1n);
    const over = analyze(source, { ...limits, maxSteps: 8 });
    expect(
      over.diagnostics.filter(({ severity }) => severity === "error").map(({ code }) => code),
    ).toEqual(["E10269"]);
    expect(scalar(over, "RESULT")).toBeNull();
  });

  it("should leave a failed byte charge unapplied and release a completed value once", () => {
    const budget = new ComptimeBudget({ maxSteps: 4, maxLiveBytes: 2, maxActiveCalls: 2 });
    const checkpoint = budget.liveCheckpoint();
    budget.allocate(1, span, span);

    expect(() => budget.allocate(2, span, span)).toThrow(ComptimeBudgetFailure);
    expect(budget.liveCheckpoint()).toBe(1);
    budget.release(1);
    budget.allocate(2, span, span);
    expect(budget.liveCheckpoint()).toBe(2);
    budget.abandonRoot(checkpoint);
    expect(budget.liveCheckpoint()).toBe(0);
    expect(() => budget.release(1)).toThrow("released twice");
  });

  it("should preserve active-call and step counters after a rejected entry", () => {
    const budget = new ComptimeBudget({ maxSteps: 2, maxLiveBytes: 4, maxActiveCalls: 1 });
    budget.enterCall(span, span);
    expect(() => budget.enterCall(span, span)).toThrow(ComptimeBudgetFailure);
    budget.leaveCall();
    budget.enterCall(span, span);
    budget.leaveCall();
    expect(() => budget.step(span, span)).toThrow(ComptimeBudgetFailure);
  });
});

describe("compile-time host boundary implementation", () => {
  it.each([
    ["runtime storage", "let live: byte = 3;", "live"],
    ["volatile memory", "", "peek($D020)"],
    ["CPU control", "", "asm_nop()"],
  ])("should reject %s inside a compile-time function", (_name, declaration, expression) => {
    const result = analyze(
      `module Game; ${declaration} comptime function value(): byte { return ${expression}; } const VALUE: byte = value(); function main(): void {}`,
    );
    expect(result.diagnostics.map(({ code }) => code)).toContain("E10191");
    expect(scalar(result, "VALUE")).toBeNull();
  });
});

describe("compile-time trigonometry implementation", () => {
  it("should match the full canonical little-endian sine word stream", () => {
    const stream = Buffer.alloc(65_536 * 2);
    for (let phase = 0; phase < 65_536; phase += 1) {
      stream.writeInt16LE(Number(evaluateIntegerTrigonometry("sin16", BigInt(phase))), phase * 2);
    }
    expect(createHash("sha256").update(stream).digest("hex")).toBe(
      "e0313f89310605acaa740fa67cf9fb157e363c9bd4af10fea66d8846735c5a50",
    );
  });
});
