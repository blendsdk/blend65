/**
 * Implementation tests for the semantic-analysis pass seams.
 *
 * RD-17 fills in Pass 1 (`collectDeclarations` → struct/enum tables) and Pass 3
 * (`checkBodies` → intrinsic validation); Pass 2/4 remain deferred no-ops. These
 * tests verify the four seams exist, are callable, and stay silent on empty input.
 * They import directly from `passes.ts` (the seams are not re-exported from the
 * package barrel).
 */

import { describe, expect, it } from "vitest";
import {
  createDiagnosticBag,
  createEmptyModel,
  createIntrinsicRegistry,
  DEFAULT_PROFILE,
} from "@blend65/core";
import type { AnalyzeInput } from "./analyze.js";
import { collectDeclarations, resolveTypes, checkBodies, postCheck } from "./passes.js";

/** A minimal `AnalyzeInput` with no programs. */
function makeInput(): AnalyzeInput {
  return { programs: [], bag: createDiagnosticBag(), profile: DEFAULT_PROFILE };
}

describe("pass seams — existence and empty-input behavior (§4.1)", () => {
  it("should export all four pass functions", () => {
    expect(typeof collectDeclarations).toBe("function");
    expect(typeof resolveTypes).toBe("function");
    expect(typeof checkBodies).toBe("function");
    expect(typeof postCheck).toBe("function");
  });

  it("collectDeclarations returns empty tables for empty input", () => {
    const tables = collectDeclarations(makeInput());
    expect(tables.structTypes.size).toBe(0);
    expect(tables.enumTypes.size).toBe(0);
  });

  it("checkBodies adds no diagnostics for empty input", () => {
    const input = makeInput();
    const tables = collectDeclarations(input);
    expect(() => checkBodies(input, tables, createIntrinsicRegistry())).not.toThrow();
    expect(input.bag.count()).toBe(0);
  });

  it("resolveTypes / postCheck run as no-ops without throwing", () => {
    const input = makeInput();
    const model = createEmptyModel();
    expect(() => resolveTypes(input, model)).not.toThrow();
    expect(() => postCheck(input, model)).not.toThrow();
    expect(model.hasErrors).toBe(false);
    expect(model.typeMap.size).toBe(0);
  });
});
