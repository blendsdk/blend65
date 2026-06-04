/**
 * Implementation tests for the RD-04 pass seams (skeleton).
 *
 * Where `analyze.spec.test.ts` pins the end-to-end passthrough contract, these
 * tests verify the four internal pass functions exist and are callable no-ops
 * (seam existence, FR-S14 / §4.1). They import directly from `passes.ts` (the
 * seams are intentionally NOT re-exported from the package barrel).
 *
 * Written AFTER implementation; filed as `*.impl.test.ts` (testing.md Rule 10).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, createEmptyModel, DEFAULT_PROFILE } from "@blend65/core";
import type { AnalyzeInput } from "./analyze.js";
import { collectDeclarations, resolveTypes, checkBodies, postCheck } from "./passes.js";

/** A minimal `AnalyzeInput` with no programs (the seams ignore it anyway). */
function makeInput(): AnalyzeInput {
  return { programs: [], bag: createDiagnosticBag(), profile: DEFAULT_PROFILE };
}

describe("pass seams — existence and no-op behavior (§4.1)", () => {
  it("should export all four pass functions", () => {
    expect(typeof collectDeclarations).toBe("function");
    expect(typeof resolveTypes).toBe("function");
    expect(typeof checkBodies).toBe("function");
    expect(typeof postCheck).toBe("function");
  });

  it("should run each pass as a no-op without throwing", () => {
    const input = makeInput();
    const model = createEmptyModel();
    expect(() => collectDeclarations(input, model)).not.toThrow();
    expect(() => resolveTypes(input, model)).not.toThrow();
    expect(() => checkBodies(input, model)).not.toThrow();
    expect(() => postCheck(input, model)).not.toThrow();
  });

  it("should not observably mutate the model (passthrough)", () => {
    const input = makeInput();
    const model = createEmptyModel();
    collectDeclarations(input, model);
    resolveTypes(input, model);
    checkBodies(input, model);
    postCheck(input, model);
    // The empty model's observable shape is unchanged by the no-op passes.
    expect(model.hasErrors).toBe(false);
    expect(model.mainFunction).toBeNull();
    expect(model.typeMap.size).toBe(0);
    expect(model.symbolMap.size).toBe(0);
  });
});
