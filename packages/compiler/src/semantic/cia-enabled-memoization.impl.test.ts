import { describe, expect, it } from "vitest";
import { analyze, diamond, withIrqHandlers } from "../../test/cia-memoization-fixture.js";

describe("CIA call sharing with selected IRQ handlers", () => {
  for (const mode of ["enabled", "asm_cli", "asm_plp"] as const) {
    it.each([8, 16, 24])(
      `should use linear key evaluations at depth %i with ${mode} and an ordinary handler`,
      (depth) => {
        for (const indirect of [false, true]) {
          const fixture = withIrqHandlers(
            diamond(depth, mode === "enabled" ? "none" : mode, indirect, mode !== "enabled"),
          );
          const result = analyze(fixture.program, fixture.targets, fixture.routes);
          expect(result.diagnostics).toEqual([]);
          expect(result.evaluations).toBe(mode === "enabled" ? 5 * depth + 3 : 2 * depth + 3);
        }
      },
    );
  }

  for (const restore of ["direct", "helper", "indirect"] as const) {
    it.each(["enabled", "asm_cli", "asm_plp"] as const)(
      `should retain exact histories for ${restore} handler restores with %s`,
      (mode) => {
        const fixture = withIrqHandlers(
          diamond(6, mode === "enabled" ? "none" : mode, true, mode !== "enabled"),
          restore,
        );
        const result = analyze(fixture.program, fixture.targets, fixture.routes);
        expect(result.diagnostics).toEqual([]);
        expect(result.evaluations).toBeGreaterThanOrEqual(128);
      },
    );
  }

  it("should retain exact histories when a selected handler body is unproved", () => {
    const fixture = withIrqHandlers(diamond(6, "none", false, false), "missing");
    const result = analyze(fixture.program, fixture.targets, fixture.routes);
    expect(result.diagnostics).toEqual([]);
    expect(result.evaluations).toBe(128);
  });
});
