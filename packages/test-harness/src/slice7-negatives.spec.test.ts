/**
 * Specification tests for the Slice 7 acceptance-bar negatives: invalid
 * aggregate programs must be rejected through the public `compile()` facade
 * — set `hasErrors`, emit the expected code (ONE path-carrying diagnostic
 * per definition cycle), and never throw — the two advisory shapes must
 * compile WITH their warnings, and the historical cross-module struct-name
 * collision must stay fixed (two modules' same-named structs both usable).
 * CI-runnable (no ACME).
 *
 * These tests are derived from the frozen spec's aggregate rules (Ch
 * 07/08/09), not from reading the implementation.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compile } from "@blend65/compiler";

/** Compiles named sources (frontend-only) in a scratch dir. */
function compileFiles(files: Record<string, string>): ReturnType<typeof compile> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-slice7-neg-"));
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

/** The `main` fixture wrapper. */
function inMain(decls: string, body: string): string {
  return `module Main;\n${decls}\nfunction main(): void { ${body} }\n`;
}

/** All error codes of a compile result. */
function codes(result: ReturnType<typeof compile>): string[] {
  return result.diagnostics.map((d) => d.code);
}

describe("Specification: Slice 7 negatives via compile() (ST-62, ST-63)", () => {
  it("rejects a struct-field cycle with ONE E10165 carrying the path", () => {
    const result = compileMain(inMain("struct A { b: B; }\nstruct B { a: A; }", ""));
    expect(result.hasErrors).toBe(true);
    const cycles = result.diagnostics.filter((d) => d.code === "E10165");
    expect(cycles).toHaveLength(1);
    expect(cycles[0]!.message).toContain("A");
    expect(cycles[0]!.message).toContain("B");
  });

  it("rejects a const↔layout cycle with ONE E10194 carrying the path", () => {
    const result = compileMain(
      inMain("const N: byte = sizeof(S);\nstruct S { a: byte[N]; }", ""),
    );
    expect(result.hasErrors).toBe(true);
    const cycles = result.diagnostics.filter((d) => d.code === "E10194");
    expect(cycles).toHaveLength(1);
    expect(cycles[0]!.message).toContain("N");
    expect(cycles[0]!.message).toContain("S");
  });

  it("rejects struct-literal shape errors: missing E10161, extra E10162, order E10097", () => {
    const P = "struct Point { x: byte; y: byte; }";
    expect(codes(compileMain(inMain(P, "let p: Point = Point { x: 1 };")))).toContain("E10161");
    expect(
      codes(compileMain(inMain(P, "let p: Point = Point { x: 1, y: 2, z: 3 };"))),
    ).toContain("E10162");
    expect(codes(compileMain(inMain(P, "let p: Point = Point { y: 2, x: 1 };")))).toContain(
      "E10097",
    );
  });

  it("rejects whole-array assignment (E10119) and array comparison (E10121)", () => {
    const A = "let a: byte[3];\nlet b: byte[3];";
    expect(codes(compileMain(inMain(A, "a = b;")))).toContain("E10119");
    expect(codes(compileMain(inMain(A, "let e: boolean = a == b;")))).toContain("E10121");
  });

  it("rejects a word index on a direct-tier array (E10117) and a static OOB index (E10115)", () => {
    const A = "let a: byte[10];";
    expect(codes(compileMain(inMain(A, "let w: word = 1; let v: byte = a[w];")))).toContain(
      "E10117",
    );
    expect(codes(compileMain(inMain(A, "let v: byte = a[12];")))).toContain("E10115");
  });

  it("rejects size errors: runtime size E10110 and zero size E10111", () => {
    expect(codes(compileMain(inMain("", "let n: byte = 3; let a: byte[n];")))).toContain(
      "E10110",
    );
    expect(codes(compileMain(inMain("let a: byte[0];", "")))).toContain("E10111");
  });

  it("rejects enum misuse: byte→enum E10152 and cross-enum comparison E10080", () => {
    const E = "enum Dir { UP, DOWN }\nenum Other { A }";
    expect(codes(compileMain(inMain(E, "let d: Dir = 0;")))).toContain("E10152");
    expect(
      codes(
        compileMain(
          inMain(E, "let d: Dir = Dir.UP; let o: Other = Other.A; let e: boolean = d == o;"),
        ),
      ),
    ).toContain("E10080");
  });

  it("rejects aggregate returns permanently (E10093/E10120); params compile (by-ref)", () => {
    const P = "struct Point { x: byte; }";
    expect(
      codes(compileFiles({ "main.blend": `module Main;\n${P}\nfunction f(): Point { }\nfunction main(): void { }\n` })),
    ).toContain("E10093");
    expect(
      codes(compileFiles({ "main.blend": "module Main;\nfunction f(): byte[2] { }\nfunction main(): void { }\n" })),
    ).toContain("E10120");
    // RETIRED SUB-ROW, superseded: the parameter assertion originally pinned
    // the interim loud rejection of aggregate parameters. By-reference
    // parameters now exist (FN-3), so a struct parameter compiles cleanly.
    const param = compileFiles({
      "main.blend": `module Main;\n${P}\nfunction f(p: Point): void { p.x = 1; }\nfunction main(): void { }\n`,
    });
    expect(param.hasErrors).toBe(false);
    expect(codes(param).some((c) => c.startsWith("E9"))).toBe(false);
  });

  it("rejects enum declaration errors: non-const member E10230 and range E10143", () => {
    expect(codes(compileMain(inMain("let x: byte = 1;\nenum E { A = x }", "")))).toContain(
      "E10230",
    );
    expect(codes(compileMain(inMain("enum E { A = 255, B }", "")))).toContain("E10143");
  });

  it("rejects a non-member case on an enum switch (E10077)", () => {
    const result = compileMain(
      inMain(
        "enum Dir { UP, DOWN = 3 }",
        "let d: Dir = Dir.DOWN; let x: byte = 0; switch (d) { case 3: x = 1; default: x = 2; }",
      ),
    );
    expect(codes(result)).toContain("E10077");
  });

  it("rejects const-array coverage/constant errors: E10113 and E10126/E10156", () => {
    expect(codes(compileMain(inMain("const T: byte[4] = [1, 2];", "")))).toContain("E10113");
    expect(codes(compileMain(inMain("", "let a: byte[] = [1; 0];")))).toContain("E10126");
    expect(codes(compileMain(inMain("struct S { v: void; }", "")))).toContain("E10156");
  });

  it("rejects a statement-position aggregate literal (E10157) and a string array init (loudly)", () => {
    const stmt = compileMain(
      inMain("struct Point { x: byte; y: byte; }", "Point { x: 1, y: 2 };"),
    );
    expect(codes(stmt)).toContain("E10157");

    const str = compileMain(inMain("", 'let a: byte[10] = "HELLO";'));
    expect(str.hasErrors).toBe(true);
    expect(codes(str).some((c) => c.startsWith("E9"))).toBe(true);
  });

  it("rejects a same-module type/value collision (E10003); a >256-byte array compiles with W10142", () => {
    expect(codes(compileMain(inMain("struct S { x: byte; }\nlet S: byte;", "")))).toContain(
      "E10003",
    );
    // RETIRED SUB-ROW, superseded: the >256-byte assertion originally pinned
    // the interim loud rejection ("needs pointer-tier indexing"). The
    // pointer tier now exists: the declaration is legal and carries the
    // tier-overhead advisory instead.
    const big = compileMain(inMain("let big: byte[300];", ""));
    expect(big.hasErrors).toBe(false);
    expect(codes(big).some((c) => c.startsWith("E9"))).toBe(false);
    expect(codes(big)).toContain("W10142");
  });
});

describe("Specification: Slice 7 advisories compile WITH warnings (ST-66)", () => {
  it("compiles a partial array init with W10140 and a missing init with W10141", () => {
    const partial = compileMain(inMain("", "let a: byte[5] = [1, 2]; poke($C000, a[0]);"));
    expect(partial.hasErrors).toBe(false);
    expect(codes(partial)).toContain("W10140");

    const missing = compileMain(inMain("", "let a: byte[5]; poke($C000, a[0]);"));
    expect(missing.hasErrors).toBe(false);
    expect(codes(missing)).toContain("W10141");
  });
});

describe("Specification: the cross-module struct-name regression (ST-64)", () => {
  it("compiles two modules that each declare `struct Point`, both usable", () => {
    const result = compileFiles({
      "a.blend":
        "module A;\nexport struct Point { x: byte; }\nexport let pa: Point;\n",
      "b.blend":
        "module B;\nexport struct Point { x: word; y: word; }\nexport let pb: Point;\n",
      "main.blend":
        "module Main;\nfunction main(): void { A.pa.x = 1; B.pb.y = 2; }\n",
    });
    expect(result.hasErrors).toBe(false);
  });
});
