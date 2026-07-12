import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { ProgramNode } from "@blend65/core";
import {
  analyze,
  lex,
  modelNeedsPointerScratch,
  modelToFunctionInfo,
  modelToModuleVars,
  parse,
  planAllocation,
} from "@blend65/frontend";
import { printIL } from "./print-il.js";
import { lowerToIL } from "./lower.js";

/**
 * Implementation tests for the indirect lowering internals: the fused
 * word-store shape of the formation sequence (every word intermediate is
 * consumed by the immediately-following store into the scratch home), the
 * byte/word index-domain classification split between direct and pair bases,
 * lowering determinism, and the scratch-reservation backstop.
 */

/** Lowers sources end-to-end; `withScratch` controls the pool reservation. */
function lowerWith(sources: string[], withScratch: boolean) {
  const bag = createDiagnosticBag();
  const programs: ProgramNode[] = sources.map((source, i) => {
    const { tokens } = lex(i + 1, source, bag);
    return parse({ tokens, source, sourceId: i + 1, bag }).ast;
  });
  const model = analyze({ programs, bag, profile: DEFAULT_PROFILE });
  const plan = planAllocation(
    {
      functions: modelToFunctionInfo(model),
      moduleVars: modelToModuleVars(model),
      zpUserVars: [],
      upstreamErrors: bag.hasErrors(),
      needsPointerScratch: withScratch ? modelNeedsPointerScratch(model) : false,
    },
    DEFAULT_PROFILE,
    bag,
  );
  const il = lowerToIL({ program: programs, model, plan }, bag);
  return { text: printIL(il), hasErrors: bag.hasErrors(), diags: bag.getAll() };
}

const TIER2 = [
  "module Main;",
  "let big: byte[300];",
  "function main(): void { let w: word = 260; poke($C000, big[w]); }",
].join("\n");

describe("formation shape (fused word stores)", () => {
  it("stores every word add/shl result to scratch on the immediately following line", () => {
    const { text, hasErrors } = lowerWith([TIER2], true);
    expect(hasErrors).toBe(false);
    const lines = text.split("\n").map((l) => l.trim());
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i]!.match(/^%(\d+) = (add|shl) i16u/);
      if (m === null) continue;
      expect(
        lines[i + 1],
        `word ${m[2]} result %${m[1]} must be consumed by the adjacent store`,
      ).toBe(`store %${m[1]}, __zp_ptr_scratch`);
    }
    // The sequence really contains a word add (the base+index formation).
    expect(lines.some((l) => /= add i16u/.test(l))).toBe(true);
  });
});

describe("index-domain classification", () => {
  it("keeps the 7a byte-domain scaler for direct tier-1 multi-byte elements", () => {
    const { text, hasErrors } = lowerWith(
      [
        [
          "module Main;",
          "struct Point { x: byte; y: byte; }",
          "function main(): void {",
          "  let pts: Point[2] = [Point { x: 1, y: 2 }, Point { x: 3, y: 4 }];",
          "  let i: byte = 1; pts[i].x = 5;",
          "}",
        ].join("\n"),
      ],
      true,
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("mul"); // byte-domain ×2
    expect(text).toContain("store_indexed");
    expect(text).not.toContain("__zp_ptr_scratch");
  });

  it("routes pair-base multi-byte elements word-domain even for byte indexes", () => {
    const { text, hasErrors } = lowerWith(
      [
        [
          "module Main;",
          "function f(d: word[]): void { let b: byte = 3; d[b] = 1; }",
          "function main(): void { let a: word[4]; f(a); }",
        ].join("\n"),
      ],
      true,
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("zext");
    expect(text).toContain("shl");
    expect(text).not.toContain("store_indexed");
  });
});

describe("determinism & backstop", () => {
  it("produces byte-identical IL across runs", () => {
    const one = lowerWith([TIER2], true);
    const two = lowerWith([TIER2], true);
    expect(two.text).toBe(one.text);
  });

  it("rejects loudly when formation is demanded without the scratch reservation", () => {
    const { hasErrors, diags } = lowerWith([TIER2], false);
    expect(hasErrors).toBe(true);
    expect(
      diags.some((d) => d.code.startsWith("E9") && d.message.includes("scratch")),
    ).toBe(true);
  });
});
