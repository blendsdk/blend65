/**
 * Specification tests for the Slice 8 acceptance-bar negatives, all through
 * the public `compile()` facade: the address-of rejection surface (an
 * inlined scalar constant has no storage, a parameter has no stable home,
 * element/field address-of stays deferred, arbitrary expressions have no
 * address), the interrupt signature and usage rules (non-void annotation,
 * direct calls, `export interrupt`), the zeropage budget, the zeropage
 * string-initializer boundary (strings land with the data slice), and the
 * block-keyword parse errors. CI-runnable (no ACME). The formerly-rejected
 * runtime-computed by-ref argument places now compile — their positive
 * facade pins live in the pointer-surface negatives suite.
 *
 * These tests derive from the frozen spec chapters (Ch 03, Ch 04 §8, Ch 06
 * §7) — never from the implementation.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compile } from "@blend65/compiler";

/** Compiles one `main.blend` (frontend-only) in a scratch dir. */
function compileMain(source: string): ReturnType<typeof compile> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-slice8-neg-"));
  writeFileSync(join(cwd, "main.blend"), source, "utf8");
  try {
    let result!: ReturnType<typeof compile>;
    expect(() => {
      result = compile({ platform: "c64", cwd, sourceFiles: ["main.blend"] });
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

const MAIN = "function main(): void { }";

describe("Specification: address-of rejections through the facade (ST-45)", () => {
  it("rejects &constScalar with E10047", () => {
    const result = compileMain(
      ["module Main;", "const K: byte = 5;", "function main(): void { let a: word = &K; }"].join("\n"),
    );
    expect(codes(result)).toContain("E10047");
  });

  it("rejects &parameter with E10048", () => {
    const result = compileMain(
      [
        "module Main;",
        "function f(p: byte): void { let w: word = &p; }",
        "function main(): void { f(1); }",
      ].join("\n"),
    );
    expect(codes(result)).toContain("E10048");
  });

  it("rejects &element with E10042 (deferred surface)", () => {
    const result = compileMain(
      [
        "module Main;",
        "let arr: byte[4];",
        "function main(): void { let a: word = &arr[1]; }",
      ].join("\n"),
    );
    expect(codes(result)).toContain("E10042");
  });

  it("rejects &(expression) with E10049", () => {
    const result = compileMain(
      [
        "module Main;",
        "function main(): void { let x: byte = 1; let a: word = &(x + 1); }",
      ].join("\n"),
    );
    expect(codes(result)).toContain("E10049");
  });
});

describe("Specification: interrupt rules through the facade (ST-45, ST-16 re-pins)", () => {
  it("rejects a non-void interrupt annotation with E10050", () => {
    const result = compileMain(
      ["module Main;", "interrupt function h(): word { }", MAIN].join("\n"),
    );
    expect(codes(result)).toContain("E10050");
  });

  it("rejects a direct handler call with E10051", () => {
    const result = compileMain(
      ["module Main;", "interrupt function h() { }", "function main(): void { h(); }"].join("\n"),
    );
    expect(codes(result)).toContain("E10051");
  });

  it("rejects `export interrupt` with E10311", () => {
    const result = compileMain(
      ["module Main;", "export interrupt function h() { }", MAIN].join("\n"),
    );
    expect(codes(result)).toContain("E10311");
  });
});

describe("Specification: zeropage rejections through the facade (ST-45)", () => {
  it("rejects a zeropage program past the ZP budget with E10032", () => {
    const result = compileMain(
      ["module Main;", "zeropage { big: byte[64]; }", MAIN].join("\n"),
    );
    expect(codes(result)).toContain("E10032");
  });

  it("compiles a string-initialized zeropage field end-to-end (retired rejection row)", () => {
    // Originally pinned the loud not-yet-supported rejection; string
    // initialisers now desugar into encoded bytes and flow through the
    // zeropage init path like any other array initialiser.
    const result = compileMain(
      ["module Main;", 'zeropage { msg: byte[6] = "HELLO\\0"; }', MAIN].join("\n"),
    );
    expect(result.hasErrors).toBe(false);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("rejects export / let / const keywords inside a zeropage block at parse", () => {
    for (const bad of [
      "zeropage { export x: byte; }",
      "zeropage { let x: byte; }",
      "zeropage { const x: byte = 1; }",
    ]) {
      const result = compileMain(["module Main;", bad, MAIN].join("\n"));
      expect(result.hasErrors, bad).toBe(true);
    }
  });
});
