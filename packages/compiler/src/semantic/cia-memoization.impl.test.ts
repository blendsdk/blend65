import { describe, expect, it } from "vitest";
import { analyze, diamond, returningHelper } from "../../test/cia-memoization-fixture.js";

describe("CIA call-cache context sharing", () => {
  it.each([8, 16, 24])(
    "should check a masked depth-%i mutation diamond with linear key evaluations",
    (depth) => {
      const { program, targets } = diamond(depth);
      const result = analyze(program, targets);
      expect(result.diagnostics).toEqual([]);
      expect(result.evaluations).toBe(2 * depth + 2);
    },
  );

  it("should share nonreturning finite indirect helper contexts", () => {
    const { program, targets } = diamond(16, "none", true);
    const result = analyze(program, targets);
    expect(result.diagnostics).toEqual([]);
    expect(result.evaluations).toBe(34);
  });

  it.each([false, true])(
    "should preserve the current caller prefix when the helper pops it %s",
    (popsCaller) => {
      for (const mutation of ["clean", "typed", "raw"] as const) {
        const { program, finalSpan } = returningHelper(mutation, popsCaller);
        const result = analyze(program);
        if (mutation === "clean") {
          expect(result.diagnostics).toEqual([]);
          expect(result.handbacks.size).toBe(1);
        } else {
          expect(result.diagnostics).toMatchObject([{ code: "E10278", primarySpan: finalSpan }]);
        }
      }
    },
  );

  it.each(["asm_cli", "asm_plp"] as const)(
    "should share unused histories when a transitive helper uses %s",
    (unmask) => {
      for (const indirect of [false, true]) {
        const { program, targets } = diamond(6, unmask, indirect);
        const result = analyze(program, targets);
        expect(result.diagnostics).toEqual([]);
        expect(result.evaluations).toBe(14);
      }
    },
  );

  it("should share unused histories while IRQ entry is already allowed", () => {
    const { program, targets } = diamond(6, "none", false, false);
    const result = analyze(program, targets);
    expect(result.diagnostics).toEqual([]);
    expect(result.evaluations).toBe(14);
  });
});
