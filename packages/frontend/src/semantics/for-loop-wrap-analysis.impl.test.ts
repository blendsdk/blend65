/**
 * Implementation tests for the `for`-loop wrap analysis the type checker stamps
 * into the model (`ForLoopInfo`). Lowering consults this to decide whether a
 * counted loop needs a runtime wrap guard; here we pin the analysis at the
 * frontend seam, independent of any codegen. A loop is wrap-safe only when its
 * bound folds to a constant AND stepping once past it stays in range — and the
 * bound must fold through the resolver-backed engine, so a named-constant bound
 * is recognised as interior rather than treated as unknown.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { ForLoopInfo } from "@blend65/core";
import { lex, parse, analyze } from "../index.js";

const SRC = 1;

/** Analyzes a single-loop program and returns that loop's stamped wrap analysis. */
function wrapInfoOf(loopHeader: string, prelude = ""): ForLoopInfo {
  const bag = createDiagnosticBag();
  const source = `module Main;\n${prelude}function main(): void { ${loopHeader} { poke(0xC000, 1); } }\n`;
  const { tokens } = lex(SRC, source, bag);
  const { ast } = parse({ tokens, source, sourceId: SRC, bag });
  const model = analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  const infos = [...model.forLoopInfo.values()];
  if (infos.length !== 1) {
    throw new Error(`fixture must have exactly one for-loop (found ${infos.length})`);
  }
  return infos[0];
}

describe("for-loop wrap analysis (ForLoopInfo stamp)", () => {
  it("marks an ordinary interior ascending loop wrap-safe", () => {
    const info = wrapInfoOf("for (let i: byte = 0 to 9)");
    expect(info.wrapSafe).toBe(true);
    expect(info.evaluatedBound).toBe(9);
  });

  it("marks a full-range ascending loop wrap-unsafe (bound + step escapes the range)", () => {
    const info = wrapInfoOf("for (let i: byte = 0 to 255)");
    expect(info.wrapSafe).toBe(false);
    expect(info.evaluatedBound).toBe(255);
  });

  it("marks a countdown to the type minimum wrap-unsafe", () => {
    const info = wrapInfoOf("for (let i: byte = 9 downto 0)");
    expect(info.wrapSafe).toBe(false);
    expect(info.evaluatedBound).toBe(0);
  });

  it("resolves a named-constant interior bound as wrap-safe (resolver-backed fold)", () => {
    // The load-bearing case: a bare const-evaluation with no resolver would
    // return non-const for `N` and wrongly mark this provably-interior loop
    // unsafe. The stamp must fold `N` through the scope-aware engine.
    const info = wrapInfoOf("for (let i: byte = 0 to N)", "const N: byte = 10;\n");
    expect(info.wrapSafe).toBe(true);
    expect(info.evaluatedBound).toBe(10);
  });

  it("marks a named-constant full-range bound wrap-unsafe", () => {
    const info = wrapInfoOf("for (let i: byte = 0 to MAX)", "const MAX: byte = 255;\n");
    expect(info.wrapSafe).toBe(false);
    expect(info.evaluatedBound).toBe(255);
  });

  it("never marks a runtime bound wrap-safe, and records no evaluated bound", () => {
    // A module `let` is a runtime variable, not a compile-time constant, so its
    // value cannot be known — the loop can never be proven wrap-safe.
    const info = wrapInfoOf("for (let i: byte = 0 to limit)", "let limit: byte = 255;\n");
    expect(info.wrapSafe).toBe(false);
    expect(info.evaluatedBound).toBeUndefined();
  });

  it("accounts for the step when deciding wrap safety (interior-escape)", () => {
    // 0 to 254 stays interior at step 1, but step 2 lands on the bound and the
    // NEXT step wraps — so it is not wrap-safe.
    expect(wrapInfoOf("for (let i: byte = 0 to 254)").wrapSafe).toBe(true);
    expect(wrapInfoOf("for (let i: byte = 0 to 254 step 2)").wrapSafe).toBe(false);
  });
});
