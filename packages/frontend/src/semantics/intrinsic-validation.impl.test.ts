/**
 * Implementation tests for the RD-17 intrinsic-validation pass.
 *
 * Unlike the spec tier, these MAY read the implementation. They cover internals and
 * edges: type-table resolution (nested/forward struct refs, enums), literal-range
 * boundaries, availability skip when no profile is supplied, multi-program input,
 * per-function decimal-mode grouping, and no-throw behaviour on error-laden ASTs.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { DiagnosticBag, ProgramNode } from "@blend65/core";
import type { PlatformProfile } from "@blend65/core/platform";
import { lex, parse, analyze } from "../index.js";

const SRC = 1;

function parseSource(source: string, bag: DiagnosticBag, sourceId = SRC): ProgramNode {
  const { tokens } = lex(sourceId, source, bag);
  const { ast } = parse({ tokens, source, sourceId, bag });
  return ast;
}

function analyzeSource(source: string, targetProfile?: PlatformProfile): DiagnosticBag {
  const bag = createDiagnosticBag();
  const ast = parseSource(source, bag);
  analyze({
    programs: [ast],
    bag,
    profile: DEFAULT_PROFILE,
    ...(targetProfile !== undefined ? { targetProfile } : {}),
  });
  return bag;
}

function codes(bag: DiagnosticBag): string[] {
  return bag.getAll().map((d) => d.code);
}

const C64_CANONICAL: PlatformProfile = {
  platformId: "c64",
  codeStart: 0x0801,
  codeEnd: 0xcfff,
  dataStart: 0xc000,
  dataEnd: 0xcfff,
  ramStart: 0x0801,
  ramEnd: 0xcfff,
  zpStart: 0x02,
  zpEnd: 0x8f,
  stackReserve: 16,
  maxBinarySize: 0xc7ff,
  maxRam: 0xc7ff,
  maxZp: 142,
  stackBudget: 240,
  outputFormat: "prg",
  loadAddress: 0x0801,
  cpu: "nmos6502",
  zpArgBlockSize: 8,
};

describe("intrinsic validation — literal-range boundaries (V3)", () => {
  it("accepts a byte literal at the 255 boundary", () => {
    const bag = analyzeSource(`module M;\nfunction main(): void { poke($D020, 255); }\n`);
    expect(codes(bag)).not.toContain("E10171");
  });

  it("rejects a byte literal at 256 (just over range)", () => {
    const bag = analyzeSource(`module M;\nfunction main(): void { poke($D020, 256); }\n`);
    expect(codes(bag)).toContain("E10171");
  });

  it("passes a non-literal argument through without a range check", () => {
    // `foo` is an identifier (general name resolution is deferred) — V3 skips it.
    const bag = analyzeSource(`module M;\nfunction main(): void { poke($D020, foo); }\n`);
    expect(codes(bag)).not.toContain("E10171");
  });
});

describe("intrinsic validation — type-table edges (V7)", () => {
  it("resolves a valid offsetof field with no diagnostic", () => {
    const bag = analyzeSource(
      `module M;\nstruct Sprite { x: byte; y: byte; addr: word; }\n` +
        `function main(): void { let o: byte = offsetof(Sprite, y); }\n`,
    );
    expect(codes(bag)).not.toContain("E10171");
  });

  it("resolves nested/forward struct references during collection", () => {
    // `Outer` references `Inner` declared later; offsetof(Outer, inner) must resolve.
    const bag = analyzeSource(
      `module M;\nstruct Outer { a: byte; inner: Inner; }\nstruct Inner { p: word; q: byte; }\n` +
        `function main(): void { let o: byte = offsetof(Outer, inner); }\n`,
    );
    expect(codes(bag)).not.toContain("E10171");
  });

  it("flags sizeof of an unknown type", () => {
    const bag = analyzeSource(
      `module M;\nfunction main(): void { let s: byte = sizeof(Nope); }\n`,
    );
    expect(codes(bag)).toContain("E10171");
  });

  it("accepts sizeof of a primitive type", () => {
    const bag = analyzeSource(
      `module M;\nfunction main(): void { let s: byte = sizeof(byte); }\n`,
    );
    expect(codes(bag)).not.toContain("E10171");
  });

  it("accepts sizeof of an enum type", () => {
    const bag = analyzeSource(
      `module M;\nenum Color { Red, Green, Blue }\n` +
        `function main(): void { let s: byte = sizeof(Color); }\n`,
    );
    expect(codes(bag)).not.toContain("E10171");
  });

  it("rejects offsetof against an enum (not a struct)", () => {
    const bag = analyzeSource(
      `module M;\nenum Color { Red, Green, Blue }\n` +
        `function main(): void { let o: byte = offsetof(Color, Red); }\n`,
    );
    expect(codes(bag)).toContain("E10171");
  });
});

describe("intrinsic validation — availability (V4)", () => {
  it("skips availability when no target profile is supplied", () => {
    const bag = analyzeSource(`module M;\nfunction main(): void { asm_wai(); }\n`);
    expect(codes(bag)).not.toContain("E10043");
  });

  it("emits E10043 for asm_wai on an NMOS target", () => {
    const bag = analyzeSource(
      `module M;\nfunction main(): void { asm_wai(); }\n`,
      C64_CANONICAL,
    );
    expect(codes(bag)).toContain("E10043");
  });

  it("accepts asm_wai on a 65C02 target", () => {
    const bag = analyzeSource(`module M;\nfunction main(): void { asm_wai(); }\n`, {
      ...C64_CANONICAL,
      platformId: "cx16",
      cpu: "wdc65c02",
    });
    expect(codes(bag)).not.toContain("E10043");
  });
});

describe("intrinsic validation — reserved-name shadowing (V5)", () => {
  it("flags a let binding shadowing a reserved name", () => {
    const bag = analyzeSource(`module M;\nlet lo: byte = 0;\nfunction main(): void {}\n`);
    expect(codes(bag)).toContain("E10101");
  });

  it("flags a struct shadowing a reserved name", () => {
    const bag = analyzeSource(
      `module M;\nstruct sizeof { x: byte; }\nfunction main(): void {}\n`,
    );
    expect(codes(bag)).toContain("E10101");
  });

  it("flags a function parameter shadowing a reserved name", () => {
    const bag = analyzeSource(`module M;\nfunction main(peek: byte): void {}\n`);
    expect(codes(bag)).toContain("E10101");
  });
});

describe("intrinsic validation — decimal-mode grouping (V8)", () => {
  it("warns on asm_sed without asm_cld in an interrupt function", () => {
    const bag = analyzeSource(`module M;\ninterrupt function isr() { asm_sed(); }\n`);
    expect(codes(bag)).toContain("W10120");
  });

  it("does not warn when a different function clears decimal mode", () => {
    // asm_cld lives in a separate function — the warning is per-function, so the
    // asm_sed function still warns.
    const bag = analyzeSource(
      `module M;\nfunction a(): void { asm_sed(); }\nfunction b(): void { asm_cld(); }\n`,
    );
    expect(codes(bag)).toContain("W10120");
  });
});

describe("intrinsic validation — multi-program & robustness", () => {
  it("validates intrinsic calls across multiple programs", () => {
    const bag = createDiagnosticBag();
    const a = parseSource(`module A;\nfunction fa(): void { poke($D020); }\n`, bag, 1);
    const b = parseSource(`module B;\nfunction fb(): void { asm_sei(5); }\n`, bag, 2);
    analyze({ programs: [a, b], bag, profile: DEFAULT_PROFILE });
    const cs = codes(bag);
    expect(cs).toContain("E10041"); // from program A
    expect(cs).toContain("E10040"); // from program B
  });

  it("never throws on an error-laden AST", () => {
    const bag = createDiagnosticBag();
    const ast = parseSource(`module Broken;\n+\nfunction good(): void { let x: 123 = 0; }\n`, bag);
    expect(() => analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE })).not.toThrow();
  });
});
