/**
 * Implementation tests for the SFA stack-depth analysis pass (RD-05 §4.9).
 *
 * Edge cases and internals derived from the implementation (testing.md Rule 10
 * impl tier): multiple interrupts, diamond call graphs, no-main, and the
 * defensive cycle guard.
 */

import { describe, expect, it } from "vitest";
import { analyzeStack } from "./stack-analysis.js";
import { C64_FIXTURE_PROFILE, makeFn } from "./test-fixtures.js";

describe("analyzeStack internals", () => {
  it("should take the deepest of multiple interrupt handlers", () => {
    const fns = [
      makeFn("main", { callees: ["a"] }),
      makeFn("a"),
      makeFn("irq1", { isInterrupt: true, callees: ["x"] }), // depth 2
      makeFn("x"),
      makeFn("irq2", { isInterrupt: true, callees: ["y"] }), // depth 3
      makeFn("y", { callees: ["z"] }),
      makeFn("z"),
    ];
    const stack = analyzeStack(fns, C64_FIXTURE_PROFILE);

    // irq2 chain is deeper (3 levels → 6 bytes).
    expect(stack.maxIrqDepth).toBe(3);
    expect(stack.maxIrqStackBytes).toBe(6);
    // overhead added once even with two handlers.
    expect(stack.irqOverhead).toBe(6);
  });

  it("should compute the longest path through a diamond call graph", () => {
    // main → {a, b}; a → c; b → c. Longest chain is main→a→c (or main→b→c) = 3.
    const fns = [
      makeFn("main", { callees: ["a", "b"] }),
      makeFn("a", { callees: ["c"] }),
      makeFn("b", { callees: ["c"] }),
      makeFn("c"),
    ];
    const stack = analyzeStack(fns, C64_FIXTURE_PROFILE);
    expect(stack.maxMainDepth).toBe(3);
    expect(stack.maxMainStackBytes).toBe(6);
  });

  it("should treat a fully-qualified module.main as the entry point", () => {
    const fns = [makeFn("Game.main", { callees: ["Game.tick"] }), makeFn("Game.tick")];
    const stack = analyzeStack(fns, C64_FIXTURE_PROFILE);
    expect(stack.maxMainDepth).toBe(2);
  });

  it("should not loop forever on a malformed cyclic call graph", () => {
    // a → b → a (cycle). The guard bounds the walk; no throw, finite depth.
    const fns = [
      makeFn("main", { callees: ["a"] }),
      makeFn("a", { callees: ["b"] }),
      makeFn("b", { callees: ["a"] }),
    ];
    expect(() => analyzeStack(fns, C64_FIXTURE_PROFILE)).not.toThrow();
    const stack = analyzeStack(fns, C64_FIXTURE_PROFILE);
    expect(stack.maxMainDepth).toBeGreaterThanOrEqual(3);
  });

  it("should stay below threshold for a shallow program on a large budget", () => {
    const fns = [makeFn("main", { callees: ["a"] }), makeFn("a")];
    const stack = analyzeStack(fns, C64_FIXTURE_PROFILE); // budget 230
    expect(stack.exceedsWarningThreshold).toBe(false);
  });
});
