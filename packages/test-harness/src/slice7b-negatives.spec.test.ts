/**
 * Specification tests for the Slice 7b acceptance-bar negatives: invalid
 * pointer-surface programs must be rejected through the public `compile()`
 * facade — const arguments to mutable by-ref parameters, writes through
 * const parameters (direct, nested, and compound), the strict index-width
 * tier rules on both tiers, `length()` on unsized parameters, sized-binding
 * mismatches, the two non-inferable unsized declaration forms, and the
 * deferred argument shapes (loud, never silent) — while the advisory shapes
 * compile WITH their warnings. CI-runnable (no ACME).
 *
 * These tests are derived from the frozen spec's parameter and array rules
 * (Ch 06 §3, Ch 07 §4.7, Ch 08 §7/§8/AR-3), not from the implementation.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compile, emitIl } from "@blend65/compiler";

/** Compiles named sources (frontend-only) in a scratch dir. */
function compileFiles(files: Record<string, string>): ReturnType<typeof compile> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-slice7b-neg-"));
  for (const [name, source] of Object.entries(files)) {
    writeFileSync(join(cwd, name), source, "utf8");
  }
  try {
    let result!: ReturnType<typeof compile>;
    expect(() => {
      result = compile({ platform: "c64", cwd, sourceFiles: Object.keys(files) });
    }).not.toThrow();
    return result;
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

/** Compiles one `main.blend`. */
function compileMain(source: string): ReturnType<typeof compile> {
  return compileFiles({ "main.blend": source });
}

/** Emits IL for one `main.blend` (reaches the lowering ICEs). */
function emitIlMain(source: string): ReturnType<typeof emitIl> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-slice7b-il-"));
  writeFileSync(join(cwd, "main.blend"), source, "utf8");
  try {
    let result!: ReturnType<typeof emitIl>;
    expect(() => {
      result = emitIl({ platform: "c64", cwd, sourceFiles: ["main.blend"] });
    }).not.toThrow();
    return result;
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

/** All diagnostic codes of a result. */
function codes(result: { diagnostics: readonly { code: string }[] }): string[] {
  return result.diagnostics.map((d) => d.code);
}

const ENEMY = "struct Enemy { hp: byte; }";

describe("Specification: Slice 7b negatives via compile() (ST-62)", () => {
  it("rejects a const argument to a mutable by-ref param (E10122) — const value and forwarded const param", () => {
    const constArg = [
      "module Main;",
      "const TABLE: byte[3] = [1, 2, 3];",
      "function f(t: byte[3]): void { t[0] = 1; }",
      "function main(): void { f(TABLE); }",
    ].join("\n");
    expect(codes(compileMain(constArg))).toContain("E10122");

    const forwarded = [
      "module Main;",
      "function inner(t: byte[3]): void { t[0] = 1; }",
      "function outer(t: const byte[3]): void { inner(t); }",
      "function main(): void { let a: byte[3] = [1, 2, 3]; outer(a); }",
    ].join("\n");
    expect(codes(compileMain(forwarded))).toContain("E10122");
  });

  it("rejects writes through const params (E10123): direct, nested chain, and compound", () => {
    const direct = [
      "module Main;",
      ENEMY,
      "function f(e: const Enemy): void { e.hp = 0; }",
      "function main(): void { let x: Enemy; f(x); }",
    ].join("\n");
    expect(codes(compileMain(direct))).toContain("E10123");

    const nested = [
      "module Main;",
      "struct Pos { x: byte; y: byte; }",
      "struct Enemy { pos: Pos; hp: byte; }",
      "function f(e: const Enemy): void { e.pos.x = 1; }",
      "function main(): void { let x: Enemy; f(x); }",
    ].join("\n");
    expect(codes(compileMain(nested))).toContain("E10123");

    const compound = [
      "module Main;",
      "function f(t: const byte[4]): void { let i: byte = 1; t[i] += 1; }",
      "function main(): void { let a: byte[4] = [1, 2, 3, 4]; f(a); }",
    ].join("\n");
    expect(codes(compileMain(compound))).toContain("E10123");
  });

  it("enforces the index-width tiers: E10117 on tier-1 word indexes, E10118 on tier-2 byte indexes", () => {
    expect(
      codes(
        compileMain(
          "module Main;\nlet a: byte[100];\nfunction main(): void { let w: word = 1; a[w] = 1; }\n",
        ),
      ),
    ).toContain("E10117");
    expect(
      codes(
        compileMain(
          "module Main;\nlet big: byte[300];\nfunction main(): void { let i: byte = 1; big[i] = 1; }\n",
        ),
      ),
    ).toContain("E10118");
  });

  it("rejects length() on an unsized param (E10080) and a sized-binding mismatch (E10171)", () => {
    const len = [
      "module Main;",
      "function f(d: byte[]): void { let n: byte = length(d); }",
      "function main(): void { let a: byte[4] = [1, 2, 3, 4]; f(a); }",
    ].join("\n");
    expect(codes(compileMain(len))).toContain("E10080");

    const mismatch = [
      "module Main;",
      "function f(t: byte[40]): void { t[0] = 1; }",
      "function main(): void { let small: byte[10]; f(small); }",
    ].join("\n");
    expect(codes(compileMain(mismatch))).toContain("E10171");
  });

  it("rejects both non-inferable unsized declaration forms with E10126", () => {
    expect(
      codes(compileMain("module Main;\nfunction main(): void { let a: byte[] = [1; 0]; a[0] = 1; }\n")),
    ).toContain("E10126");
    const noInit = compileMain("module Main;\nfunction main(): void { let b: byte[]; b[0] = 1; }\n");
    expect(codes(noInit)).toContain("E10126");
    const diag = noInit.diagnostics.find((d) => d.code === "E10126");
    expect(diag!.message).toContain("function parameter");
  });
});

describe("Specification: the deferred argument shapes stay loud (ST-63)", () => {
  it("ICEs on a runtime-indexed by-ref argument and a pair-relative by-ref argument via emitIl", () => {
    const runtimeIndexed = emitIlMain(
      [
        "module Main;",
        ENEMY,
        "function f(e: Enemy): void { e.hp = 0; }",
        "function main(): void { let enemies: Enemy[4]; let i: byte = 1; f(enemies[i]); }",
      ].join("\n"),
    );
    expect(runtimeIndexed.hasErrors).toBe(true);
    const ice1 = runtimeIndexed.diagnostics.find((d) => d.code.startsWith("E9"));
    expect(ice1).toBeDefined();
    expect(ice1!.message).toContain("address");

    const pairRelative = emitIlMain(
      [
        "module Main;",
        "struct Pos { x: byte; y: byte; }",
        "struct Enemy { pos: Pos; hp: byte; }",
        "function g(p: Pos): void { p.x = 1; }",
        "function f(e: Enemy): void { g(e.pos); }",
        "function main(): void { let boss: Enemy; f(boss); }",
      ].join("\n"),
    );
    expect(pairRelative.hasErrors).toBe(true);
    expect(pairRelative.diagnostics.some((d) => d.code.startsWith("E9"))).toBe(true);
  });
});

describe("Specification: Slice 7b advisories compile WITH warnings (ST-64)", () => {
  it("warns W10112 when one variable feeds two by-ref args of a call — and compiles", () => {
    const result = compileMain(
      [
        "module Main;",
        "struct P { x: byte; }",
        "function two(a: P, b: P): void { a.x = 1; }",
        "function main(): void { let s: P; two(s, s); }",
      ].join("\n"),
    );
    expect(result.hasErrors).toBe(false);
    expect(codes(result)).toContain("W10112");
  });

  it("warns W10142 on a tier-2 declaration — and compiles", () => {
    const result = compileMain(
      "module Main;\nlet big: byte[300];\nfunction main(): void { big[0] = 1; }\n",
    );
    expect(result.hasErrors).toBe(false);
    expect(codes(result)).toContain("W10142");
  });

  it("warns W10143 when one array consumes ≥25% of the platform's RAM budget — and compiles", () => {
    const result = compileMain(
      "module Main;\nlet huge: byte[7000];\nfunction main(): void { huge[0] = 1; }\n",
    );
    expect(result.hasErrors).toBe(false);
    expect(codes(result)).toContain("W10143");
  });
});
