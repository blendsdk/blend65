import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { analyzeModules } from "./analyzer.js";
import { indexModules, resolveModules } from "./modules.js";

/** Hash one in-memory fixture exactly as the project loader would. */
function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Build one immutable source record for a focused analyzer test. */
function source(text: string): SourceRecord {
  return {
    sourceId: "game.blend",
    text,
    sha256: hash(text),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: "/checkout/game.blend",
  };
}

/** Analyze one source through the real module index and graph boundary. */
function analyze(text: string): ReturnType<typeof analyzeModules> {
  const manifestText = "{}";
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "scalar-implementation",
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
    sources: [source(text)],
    inputSha256: hash(text),
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: [],
    outDir: "/checkout/out",
    overrides: { target: null, entry: null },
    effectiveTarget: "test.target",
    effectiveEntry: "Game",
  };
  const indexed = indexModules(snapshot);
  const resolved = resolveModules(snapshot, indexed.index);
  expect(indexed.diagnostics).toEqual([]);
  expect(resolved.graph).not.toBeNull();
  if (resolved.graph === null) throw new Error("Expected a resolved Game module");
  return analyzeModules(snapshot, resolved.graph);
}

/** Return a checked declaration by its module-qualified binding name. */
function typedDeclaration(result: ReturnType<typeof analyzeModules>, qualifiedName: string) {
  const binding = result.bindings.find((candidate) => candidate.qualifiedName === qualifiedName);
  if (binding === undefined) throw new Error(`Missing binding ${qualifiedName}`);
  const declaration = result.declarations.find(
    (candidate) =>
      candidate.binding.sourceId === binding.id.sourceId &&
      candidate.binding.span.start === binding.id.span.start &&
      candidate.binding.span.end === binding.id.span.end,
  );
  if (declaration?.kind !== "typed") throw new Error(`Expected typed ${qualifiedName}`);
  return declaration;
}

describe("scalar analysis implementation", () => {
  it("retains exact values at every scalar integer boundary", () => {
    const result = analyze(
      [
        "module Game;",
        "const b0: byte = 0; const b1: byte = 255;",
        "const s0: sbyte = -128; const s1: sbyte = 127;",
        "const w0: word = 0; const w1: word = 65535;",
        "const sw0: sword = -32768; const sw1: sword = 32767;",
        "function main(): void {}",
      ].join("\n"),
    );
    expect(result.diagnostics).toEqual([]);
    expect(
      ["b0", "b1", "s0", "s1", "w0", "w1", "sw0", "sw1"].map(
        (name) => typedDeclaration(result, `Game.${name}`).initializer?.constant,
      ),
    ).toEqual([0n, 255n, -128n, 127n, 0n, 65535n, -32768n, 32767n]);
  });

  it("drops reaching values conservatively at a branch join", () => {
    const result = analyze(
      "module Game; function f(flag: boolean): void { let a: byte = 200; let b: byte = 100; if (flag) { a = 1; } let r: word = a + b; } function main(): void {}",
    );
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["W10160"]);
    expect(typedDeclaration(result, "Game.f").body).toMatchObject({
      statements: [{}, {}, {}, { initializer: { constant: null, conversion: "zero-extend" } }],
    });
  });

  it("uses one unmodified reaching assignment to prove narrow wrap", () => {
    const result = analyze(
      "module Game; function f(): void { let a: byte = 1; a = 200; let b: byte = 100; let r: word = a + b; } function main(): void {}",
    );
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["W10161"]);
    expect(typedDeclaration(result, "Game.f").body).toMatchObject({
      statements: [{}, {}, {}, { initializer: { constant: 44n, conversion: "zero-extend" } }],
    });
  });

  it("reports a proved signed wrap when the result stays at its signed width", () => {
    const result = analyze(
      "module Game; function f(): void { let a: sbyte = 100; let b: sbyte = 50; let r: sbyte = a + b; } function main(): void {}",
    );
    expect(result.diagnostics).toMatchObject([
      {
        code: "W10100",
        severity: "warning",
        message:
          "Signed runtime expression 'a + b' is known to overflow at 'sbyte' width and wraps to -106",
      },
    ]);
    expect(typedDeclaration(result, "Game.f").body).toMatchObject({
      statements: [{}, {}, { initializer: { constant: -106n, type: { name: "sbyte" } } }],
    });
  });

  it("applies binary signedness and unsigned shift-count rules to compound assignments", () => {
    const mixed = analyze(
      "module Game; function f(): void { let pos: byte = 100; let delta: sbyte = -3; pos += delta; } function main(): void {}",
    );
    expect(mixed.diagnostics).toMatchObject([{ code: "E10081" }]);

    const shifted = analyze(
      "module Game; function f(): void { let value: sbyte = -128; value >>= 1; } function main(): void {}",
    );
    expect(shifted.diagnostics).toEqual([]);
  });

  it("keeps poisoned declarations separate from immutable checked siblings", () => {
    const result = analyze(
      "module Game; const bad: byte = 1 / 0; const good: word = 65535; function main(): void {}",
    );
    expect(result.complete).toBe(false);
    expect(result.declarations.filter(({ kind }) => kind === "poison")).toHaveLength(1);
    expect(typedDeclaration(result, "Game.good").initializer?.constant).toBe(65535n);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.declarations)).toBe(true);
    expect(Object.isFrozen(typedDeclaration(result, "Game.good"))).toBe(true);
  });

  it("declines the bounded-loop proof when the body contains a call", () => {
    const result = analyze(
      "module Game; function touch(): void {} function f(): void { for (let i: byte = 0; i < 256; i += 1) { touch(); } } function main(): void {}",
    );
    expect(result.diagnostics).toEqual([]);
  });

  it("rejects invalid value forms without crashing or publishing typed functions", () => {
    const voidValue = analyze(
      "module Game; function clear(): void {} function f(): void { let x: byte = clear() + 1; } function main(): void {}",
    );
    expect(voidValue.diagnostics).toMatchObject([{ code: "SEMANTIC_ERROR" }]);
    expect(voidValue.declarations.find(({ kind }) => kind === "poison")).toBeDefined();

    for (const expression of ["clear", "1 = 2", "~true"]) {
      const result = analyze(
        `module Game; function clear(): void {} function f(): void { ${expression}; } function main(): void {}`,
      );
      expect(result.complete).toBe(false);
      expect(result.declarations.some(({ kind }) => kind === "poison")).toBe(true);
    }
  });

  it("separates compile-time eligibility from known runtime values", () => {
    const ordered = analyze(
      "module Game; const later: word = earlier + 1; const earlier: word = 2; function main(): void {}",
    );
    expect(ordered.diagnostics).toEqual([]);
    expect(typedDeclaration(ordered, "Game.later").initializer?.constant).toBe(3n);

    const local = analyze(
      "module Game; function read(): byte { return 1; } function f(): void { const x: byte = read(); } function main(): void {}",
    );
    expect(local.diagnostics).toMatchObject([{ code: "E10191" }]);

    const runtimeZero = analyze(
      "module Game; function f(): void { let divisor: byte = 0; let value: byte = 1 / divisor; } function main(): void {}",
    );
    expect(runtimeZero.diagnostics.some(({ code }) => code === "E10160")).toBe(false);
  });

  it("keeps branch, short-circuit, function, and call-visible facts isolated", () => {
    const result = analyze(
      [
        "module Game; let global: byte = 1; function touch(): void { global = 2; }",
        "function f(flag: boolean): void {",
        "  let branch: byte = 1; if (flag) { branch = 200; } else { let seen: word = branch + 100; }",
        "  let short: byte = 1; false && ((short = 2) == 2); let afterShort: byte = short;",
        "  let selected: byte = 1; flag ? (selected = 2) : (selected = 3); let afterSelected: byte = selected;",
        "  let beforeCall: byte = 1; touch(); let afterCall: byte = beforeCall;",
        "}",
        "function inspect(): void { let observed: byte = global; } function main(): void {}",
      ].join("\n"),
    );
    expect(result.diagnostics).toEqual([]);
    const body = typedDeclaration(result, "Game.f").body;
    expect(body?.statements[1]).toMatchObject({
      otherwise: { statements: [{ initializer: { constant: 101n } }] },
    });
    expect(body?.statements[4]).toMatchObject({ initializer: { constant: 1n } });
    expect(body?.statements[7]).toMatchObject({ initializer: { constant: null } });
    expect(body?.statements[10]).toMatchObject({ initializer: { constant: 1n } });
    expect(typedDeclaration(result, "Game.inspect").body).toMatchObject({
      statements: [{ initializer: { constant: null } }],
    });
  });

  it("uses wrapped child values and records same-sign operand widening", () => {
    const result = analyze(
      "module Game; function f(): void { let a: byte = 200; let b: byte = 100; let total: word = (a + b) + 1000; } function main(): void {}",
    );
    const initializer = typedDeclaration(result, "Game.f").body?.statements[2];
    expect(initializer).toMatchObject({
      initializer: {
        constant: 1044n,
        left: { type: { name: "word" }, conversion: "zero-extend", constant: 44n },
      },
    });
  });

  it("does not create call edges or typed bodies for invalid calls", () => {
    const result = analyze(
      "module Game; function target(value: byte): void {} function bad(): void { target(); } function main(): void {}",
    );
    expect(result.diagnostics).toMatchObject([{ code: "E10171" }]);
    expect(result.calls).toEqual([]);
    expect(result.declarations).toContainEqual(expect.objectContaining({ kind: "poison" }));
  });

  it("keeps declarations with unsupported body forms unchecked", () => {
    const result = analyze(
      "module Game; function pending(): void { switch (1) { default: break; } } function main(): void {}",
    );
    expect(result.obligations).not.toEqual([]);
    expect(result.declarations).toContainEqual(expect.objectContaining({ kind: "unchecked" }));
  });

  it("proves infinite returns and exact byte-loop repetition", () => {
    const returns = analyze(
      "module Game; function value(): byte { while (true) { return 1; } } function main(): void {}",
    );
    expect(returns.diagnostics).toEqual([]);

    const stride = analyze(
      "module Game; function f(): void { for (let i: byte = 0; i < 255; i += 2) {} } function main(): void {}",
    );
    expect(stride.diagnostics).toMatchObject([{ code: "E10262" }]);

    const nestedBreak = analyze(
      "module Game; function f(): void { for (let i: byte = 0; i < 256; i += 1) { while (true) { break; } } } function main(): void {}",
    );
    expect(nestedBreak.diagnostics).toMatchObject([{ code: "E10262" }]);
  });

  it("emits compound overflow and wide-shift warnings", () => {
    const result = analyze(
      "module Game; function f(): void { let signed: sbyte = 100; signed += 50; let shifted: byte = 1; shifted <<= 8; } function main(): void {}",
    );
    expect(result.diagnostics).toMatchObject([{ code: "W10100" }, { code: "W10174" }]);
  });

  it("keeps short-circuit facts only when the right side executes", () => {
    const result = analyze(
      [
        "module Game; function f(flag: boolean): void {",
        "  let value: byte = 1; true && ((value = 2) == 2); let afterTrue: byte = value;",
        "  true || ((value = 4) == 4); let afterSkippedOr: byte = value;",
        "  false || ((value = 5) == 5); let afterRunOr: byte = value;",
        "  flag && ((value = 3) == 3); let afterMaybe: byte = value;",
        "} function main(): void {}",
      ].join("\n"),
    );
    expect(result.diagnostics).toEqual([]);
    expect(typedDeclaration(result, "Game.f").body).toMatchObject({
      statements: [
        {},
        {},
        { initializer: { constant: 2n } },
        {},
        { initializer: { constant: 2n } },
        {},
        { initializer: { constant: 5n } },
        {},
        { initializer: { constant: null } },
      ],
    });
  });

  it("does not treat mutable true loop conditions as invariant", () => {
    for (const loop of ["while (flag) { flag = false; }", "for (; flag; ) { flag = false; }"]) {
      const result = analyze(
        `module Game; function value(): byte { let flag: boolean = true; ${loop} } function main(): void {}`,
      );
      expect(result.diagnostics).toMatchObject([{ code: "E10102" }]);
      expect(result.declarations).toContainEqual(expect.objectContaining({ kind: "poison" }));
    }
  });

  it("widens both compatible conditional arms", () => {
    const result = analyze(
      "module Game; function f(flag: boolean): void { let narrow: byte = 1; let wide: word = 2; let chosen: word = flag ? narrow : wide; } function main(): void {}",
    );
    expect(result.diagnostics).toEqual([]);
    expect(typedDeclaration(result, "Game.f").body?.statements[2]).toMatchObject({
      initializer: {
        type: { name: "word" },
        whenTrue: { type: { name: "word" }, conversion: "zero-extend" },
        whenFalse: { type: { name: "word" } },
      },
    });
  });

  it("keeps constant intermediates exact until the initializer boundary", () => {
    const result = analyze(
      "module Game; const reduced: byte = 300 - 256; function main(): void {}",
    );
    expect(result.diagnostics).toEqual([]);
    expect(typedDeclaration(result, "Game.reduced").initializer).toMatchObject({
      type: { name: "byte" },
      constant: 44n,
    });
  });

  it("retains function address-of while completing scalar-place address-of", () => {
    const result = analyze(
      "module Game; function target(): void {} function functionAddress(): void { &target; } function scalarAddress(): void { let value: byte = 1; &value; } function main(): void {}",
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.obligations).toHaveLength(1);
    expect(result.declarations.filter(({ kind }) => kind === "unchecked")).toHaveLength(1);
  });
});
