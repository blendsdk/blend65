import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode, isIceCode } from "@blend65/core";
import type { Diagnostic, SemanticModel } from "@blend65/core";
import type { PlatformProfile } from "@blend65/core/platform";
import { lex, parse, analyze } from "../index.js";

/**
 * Specification tests for the by-reference parameter surface (frozen spec
 * Ch 06 §3 FN-2/FN-3, Ch 07 SR-3/§4.7, Ch 08 §7 CP-1..5, §8 sized/unsized
 * params, §10.3 + AR-3 index tiers, §9 length rules): aggregate/unsized
 * parameter types, const-parameter enforcement, the strict index-width tier
 * rules on both tiers, size inference for unsized declarations, and the
 * aliasing/size advisories.
 *
 * Expectations derive from the frozen spec chapters — never from the
 * implementation. Exercised through the real public path
 * (`lex`→`parse`→`analyze`).
 */

/** Lexes + parses each source (ids 1..n) + analyzes them together. */
function analyzeMulti(
  sources: readonly string[],
  targetProfile?: PlatformProfile,
): { diags: Diagnostic[]; model: SemanticModel } {
  const bag = createDiagnosticBag();
  const programs = sources.map((source, i) => {
    const { tokens } = lex(i + 1, source, bag);
    return parse({ tokens, source, sourceId: i + 1, bag }).ast;
  });
  const model = analyze({
    programs,
    bag,
    profile: DEFAULT_PROFILE,
    ...(targetProfile !== undefined ? { targetProfile } : {}),
  });
  return { diags: bag.getAll(), model };
}

/** The codes of all error-severity diagnostics. */
function errorCodes(diags: readonly Diagnostic[]): string[] {
  return diags.filter((d) => d.severity === "error").map((d) => d.code);
}

/** The codes of all warning-severity diagnostics. */
function warningCodes(diags: readonly Diagnostic[]): string[] {
  return diags.filter((d) => d.severity === "warning").map((d) => d.code);
}

/** A canonical platform profile with a c64-sized RAM budget (26623 bytes). */
function c64Profile(): PlatformProfile {
  return {
    platformId: "c64",
    codeStart: 0x0801,
    codeEnd: 0xcfff,
    dataStart: 0x2000,
    dataEnd: 0xcfff,
    ramStart: 0x0801,
    ramEnd: 0x67ff,
    zpStart: 0x02,
    zpEnd: 0x8f,
    stackReserve: 16,
    maxBinarySize: 0xc7ff,
    maxRam: 26623,
    maxZp: 142,
    stackBudget: 240,
    outputFormat: "prg",
    loadAddress: 0x0801,
    cpu: "nmos6502",
    zpArgBlockSize: 8,
  };
}

describe("Specification: aggregate & tier-2 declarations become legal (ST-6, ST-7)", () => {
  it("ST-6: a struct parameter compiles and the callee can write through it (by-ref, mutable)", () => {
    const src = [
      "module Main;",
      "struct Enemy { hp: byte; }",
      "function damage(e: Enemy): void { e.hp = 0; }",
      "function main(): void { let boss: Enemy; damage(boss); }",
    ].join("\n");
    const { diags } = analyzeMulti([src]);
    expect(errorCodes(diags)).toEqual([]);
    expect(diags.some((d) => isIceCode(d.code))).toBe(false);
  });

  it("ST-7: a >256-byte array declaration compiles WITH W10142 — no loud rejection remains", () => {
    const src = "module Main;\nlet big: byte[300];\nfunction main(): void { big[0] = 1; }\n";
    const { diags } = analyzeMulti([src]);
    expect(errorCodes(diags)).toEqual([]);
    expect(diags.some((d) => isIceCode(d.code))).toBe(false);
    expect(warningCodes(diags)).toContain(DiagCode.Tier2Overhead);
  });
});

describe("Specification: the CP-2 const-argument matrix (ST-8..ST-12)", () => {
  const ENEMY = "struct Enemy { hp: byte; }";

  it("ST-8: a `let` aggregate argument to a mutable by-ref parameter is legal", () => {
    const src = [
      "module Main;",
      ENEMY,
      "function f(e: Enemy): void { e.hp = 1; }",
      "function main(): void { let x: Enemy; f(x); }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([src]).diags)).toEqual([]);
  });

  it("ST-9: a `let` aggregate argument to a const parameter is legal (safe direction)", () => {
    const src = [
      "module Main;",
      ENEMY,
      "function f(e: const Enemy): byte { return e.hp; }",
      "function main(): void { let x: Enemy; poke($C000, f(x)); }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([src]).diags)).toEqual([]);
  });

  it("ST-10: a const aggregate argument to a MUTABLE by-ref parameter is E10122", () => {
    const src = [
      "module Main;",
      "const TABLE: byte[3] = [1, 2, 3];",
      "function f(t: byte[3]): void { t[0] = 1; }",
      "function main(): void { f(TABLE); }",
    ].join("\n");
    const { diags } = analyzeMulti([src]);
    expect(errorCodes(diags)).toContain(DiagCode.ConstToMutableParam);
    const e = diags.find((d) => d.code === DiagCode.ConstToMutableParam);
    expect(e!.message).toContain("const");
  });

  it("ST-11: a const aggregate argument to a const parameter is legal", () => {
    const src = [
      "module Main;",
      "const TABLE: byte[3] = [1, 2, 3];",
      "function f(t: const byte[3]): byte { return t[0]; }",
      "function main(): void { poke($C000, f(TABLE)); }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([src]).diags)).toEqual([]);
  });

  it("ST-12: forwarding a const PARAM to a mutable by-ref parameter is E10122 (CP-5 propagation)", () => {
    const src = [
      "module Main;",
      "function inner(t: byte[3]): void { t[0] = 1; }",
      "function outer(t: const byte[3]): void { inner(t); }",
      "function main(): void { let a: byte[3] = [1, 2, 3]; outer(a); }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([src]).diags)).toContain(DiagCode.ConstToMutableParam);
  });
});

describe("Specification: writes through const parameters (ST-13..ST-15)", () => {
  it("ST-13: a direct field write through a const struct param is E10123", () => {
    const src = [
      "module Main;",
      "struct Enemy { hp: byte; }",
      "function f(e: const Enemy): void { e.hp = 0; }",
      "function main(): void { let x: Enemy; f(x); }",
    ].join("\n");
    const { diags } = analyzeMulti([src]);
    expect(errorCodes(diags)).toContain(DiagCode.ModifyConstParam);
    const e = diags.find((d) => d.code === DiagCode.ModifyConstParam);
    expect(e!.message).toContain("e");
  });

  it("ST-14: nested chains, indexed elements, and compound assignment through const params are each E10123", () => {
    const nested = [
      "module Main;",
      "struct Pos { x: byte; y: byte; }",
      "struct Enemy { pos: Pos; hp: byte; }",
      "function f(e: const Enemy): void { e.pos.x = 1; }",
      "function main(): void { let v: Enemy; f(v); }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([nested]).diags)).toContain(DiagCode.ModifyConstParam);

    const indexed = [
      "module Main;",
      "function f(t: const byte[4]): void { t[0] = 1; }",
      "function main(): void { let a: byte[4] = [1, 2, 3, 4]; f(a); }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([indexed]).diags)).toContain(DiagCode.ModifyConstParam);

    const compound = [
      "module Main;",
      "function f(t: const byte[4]): void { let i: byte = 1; t[i] += 1; }",
      "function main(): void { let a: byte[4] = [1, 2, 3, 4]; f(a); }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([compound]).diags)).toContain(DiagCode.ModifyConstParam);
  });

  it("ST-15: a const SCALAR param rejects writes (E10123) but reads freely", () => {
    const write = [
      "module Main;",
      "function f(x: const byte): void { x = 1; }",
      "function main(): void { f(2); }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([write]).diags)).toContain(DiagCode.ModifyConstParam);

    const read = [
      "module Main;",
      "function f(x: const byte): byte { return x + 1; }",
      "function main(): void { poke($C000, f(2)); }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([read]).diags)).toEqual([]);
  });
});

describe("Specification: index-width tier rules (ST-16..ST-19)", () => {
  it("ST-16: a word index on a ≤256-byte array or sized param is E10117", () => {
    const onVar = [
      "module Main;",
      "let a: byte[100];",
      "function main(): void { let w: word = 1; a[w] = 1; }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([onVar]).diags)).toContain(DiagCode.WordIndexOnSmallArray);

    const onParam = [
      "module Main;",
      "function f(t: byte[100]): void { let w: word = 1; t[w] = 1; }",
      "function main(): void { let a: byte[100]; f(a); }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([onParam]).diags)).toContain(DiagCode.WordIndexOnSmallArray);
  });

  it("ST-17: a byte index on a >256-byte array is E10118 with the word-cast remedy", () => {
    const src = [
      "module Main;",
      "let big: byte[300];",
      "function main(): void { let i: byte = 1; big[i] = 1; }",
    ].join("\n");
    const { diags } = analyzeMulti([src]);
    expect(errorCodes(diags)).toContain(DiagCode.ByteIndexOnLargeArray);
    const e = diags.find((d) => d.code === DiagCode.ByteIndexOnLargeArray);
    expect(e!.message).toContain("word");
  });

  it("ST-18: a word index on a >256-byte array, and BOTH widths on an unsized param, are legal", () => {
    const tier2 = [
      "module Main;",
      "let big: byte[300];",
      "function main(): void { let w: word = 260; big[w] = 1; }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([tier2]).diags)).toEqual([]);

    const unsized = [
      "module Main;",
      "function f(d: byte[]): void { let b: byte = 1; let w: word = 300; d[b] = 1; d[w] = 2; }",
      "function main(): void { let a: byte[4] = [1, 2, 3, 4]; f(a); }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([unsized]).diags)).toEqual([]);
  });

  it("ST-18a: literal indexes adapt to the tier — `big[4]` and `big[260]` need no cast", () => {
    const src = [
      "module Main;",
      "let big: byte[300];",
      "function main(): void { big[4] = 1; big[260] = 2; }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([src]).diags)).toEqual([]);
  });

  it("ST-19: the 256-BYTE boundary counts bytes, not elements — word[128] is tier-1, word[129] tier-2", () => {
    const tier1 = [
      "module Main;",
      "let wa: word[128];",
      "function main(): void { let i: byte = 1; wa[i] = 1; }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([tier1]).diags)).toEqual([]);

    const tier2 = [
      "module Main;",
      "let wa: word[129];",
      "function main(): void { let i: byte = 1; wa[i] = 1; }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([tier2]).diags)).toContain(DiagCode.ByteIndexOnLargeArray);
  });
});

describe("Specification: sized & unsized parameter binding (ST-20, ST-21)", () => {
  it("ST-20: a sized-param size mismatch is E10171", () => {
    const src = [
      "module Main;",
      "function sum(t: byte[40]): void { t[0] = 1; }",
      "function main(): void { let small: byte[10]; sum(small); }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([src]).diags)).toContain(DiagCode.ArgTypeMismatch);
  });

  it("ST-21: `T[N] → T[]` binds for any N and element type; element-type mismatch is E10171", () => {
    const ok = [
      "module Main;",
      "function fb(d: byte[]): void { d[0] = 1; }",
      "function fw(d: word[]): void { d[0] = 1; }",
      "function main(): void {",
      "  let a3: byte[3] = [1, 2, 3];",
      "  let a9: byte[9];",
      "  let w4: word[4];",
      "  fb(a3); fb(a9); fw(w4);",
      "}",
    ].join("\n");
    expect(errorCodes(analyzeMulti([ok]).diags)).toEqual([]);

    const mismatch = [
      "module Main;",
      "function fb(d: byte[]): void { d[0] = 1; }",
      "function main(): void { let s: sbyte[3] = [1, 2, 3]; fb(s); }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([mismatch]).diags)).toContain(DiagCode.ArgTypeMismatch);
  });
});

describe("Specification: unsized-declaration size inference (ST-21a..ST-21c)", () => {
  it("ST-21a: `let a: byte[] = [1, 2, 3];` infers byte[3] — locally and at module level", () => {
    const local = [
      "module Main;",
      "function main(): void { let a: byte[] = [1, 2, 3]; a[2] = 9; poke($C000, a[2]); }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([local]).diags)).toEqual([]);

    const moduleLevel = [
      "module Main;",
      "let m: byte[] = [4, 5, 6];",
      "function main(): void { poke($C000, m[2]); }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([moduleLevel]).diags)).toEqual([]);

    // The inferred size is REAL: index 3 on the inferred byte[3] is out of bounds.
    const outOfBounds = [
      "module Main;",
      "function main(): void { let a: byte[] = [1, 2, 3]; poke($C000, a[3]); }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([outOfBounds]).diags)).toContain(
      DiagCode.StaticIndexOutOfBounds,
    );
  });

  it("ST-21b: `export const TABLE: byte[] = [3, 5, 7];` compiles with a 3-byte image and length 3", () => {
    const src = [
      "module Main;",
      "export const TABLE: byte[] = [3, 5, 7];",
      "function main(): void { poke($C000, TABLE[2]); poke($C001, length(TABLE)); }",
    ].join("\n");
    const { diags, model } = analyzeMulti([src]);
    expect(errorCodes(diags)).toEqual([]);
    const images = [...model.constValues.values()].filter((v) => v.bytes !== undefined);
    expect(images).toHaveLength(1);
    expect(images[0]!.bytes).toHaveLength(3);
    expect([...images[0]!.bytes!]).toEqual([3, 5, 7]);
  });

  it("ST-21c: the fill form and the no-initialiser form under an unsized annotation are each E10126", () => {
    const fill = [
      "module Main;",
      "function main(): void { let a: byte[] = [1; 0]; a[0] = 1; }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([fill]).diags)).toContain(DiagCode.FillRequiresExplicitSize);

    const noInit = ["module Main;", "function main(): void { let b: byte[]; b[0] = 1; }"].join(
      "\n",
    );
    const { diags } = analyzeMulti([noInit]);
    expect(errorCodes(diags)).toContain(DiagCode.FillRequiresExplicitSize);
    const e = diags.find((d) => d.code === DiagCode.FillRequiresExplicitSize);
    expect(e!.message).toContain("function parameter");
  });
});

describe("Specification: length() over parameters (ST-22, ST-23)", () => {
  it("ST-22: length(sizedParam) folds to the declared count in const position", () => {
    const src = [
      "module Main;",
      "function f(t: byte[10]): void {",
      "  let a: byte[length(t)];",
      "  a[9] = 1;",
      "}",
      "function main(): void { let x: byte[10]; f(x); }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([src]).diags)).toEqual([]);
  });

  it("ST-23: length(unsizedParam) is E10080 with the explicit-length remedy; sizeof(T[]) too", () => {
    const len = [
      "module Main;",
      "function f(d: byte[]): void { let n: byte = length(d); }",
      "function main(): void { let a: byte[4] = [1, 2, 3, 4]; f(a); }",
    ].join("\n");
    const { diags } = analyzeMulti([len]);
    expect(errorCodes(diags)).toContain(DiagCode.InvalidOperandType);
    const e = diags.find((d) => d.code === DiagCode.InvalidOperandType);
    expect(e!.message).toContain("explicit length");

    const size = [
      "module Main;",
      "function main(): void { let n: byte = sizeof(byte[]); }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([size]).diags)).toContain(DiagCode.InvalidOperandType);
  });
});

describe("Specification: advisories (ST-24, ST-24a)", () => {
  it("ST-24: the same root symbol feeding two by-ref arguments of ONE call is W10112, once", () => {
    const src = [
      "module Main;",
      "struct P { x: byte; }",
      "function two(a: P, b: P): void { a.x = 1; }",
      "function main(): void { let s: P; two(s, s); }",
    ].join("\n");
    const { diags } = analyzeMulti([src]);
    expect(errorCodes(diags)).toEqual([]);
    const hits = warningCodes(diags).filter((c) => c === DiagCode.PossibleAliasing);
    expect(hits).toHaveLength(1);
  });

  it("ST-24a: W10143 fires at ≥25% of targetProfile.maxRam, not below, and never without a profile", () => {
    // 7000 B ≥ 6656 B (25% of the c64's 26623) → W10143 alongside W10142.
    const big = "module Main;\nlet big: byte[7000];\nfunction main(): void { }\n";
    const withProfile = analyzeMulti([big], c64Profile());
    expect(errorCodes(withProfile.diags)).toEqual([]);
    expect(warningCodes(withProfile.diags)).toContain(DiagCode.LargeArrayOnPlatform);
    expect(warningCodes(withProfile.diags)).toContain(DiagCode.Tier2Overhead);

    // 300 B is tier-2 but nowhere near the platform budget → W10142 only.
    const medium = "module Main;\nlet a: byte[300];\nfunction main(): void { }\n";
    const mediumDiags = analyzeMulti([medium], c64Profile()).diags;
    expect(warningCodes(mediumDiags)).toContain(DiagCode.Tier2Overhead);
    expect(warningCodes(mediumDiags)).not.toContain(DiagCode.LargeArrayOnPlatform);

    // No target profile → the platform advisory is skipped entirely.
    const noProfile = analyzeMulti([big]).diags;
    expect(warningCodes(noProfile)).not.toContain(DiagCode.LargeArrayOnPlatform);
    expect(warningCodes(noProfile)).toContain(DiagCode.Tier2Overhead);
  });
});
