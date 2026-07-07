import { describe, expect, it } from "vitest";
import { VERSION } from "./index.js";
import type { EmitBinaryResult } from "./index.js";

describe("@blend65/compiler smoke", () => {
  it("exposes VERSION 0.1.0", () => {
    expect(VERSION).toBe("0.1.0");
  });
});

/**
 * Specification test for the acme-layer rename.
 *
 * Confirms that the acme-layer aggregate is exported as `EmitBinaryResult`
 * (carrying `success`/`symbols`), freeing the `BuildResult` name for the
 * facade result type (validated in build.spec.test.ts).
 */
describe("Specification: PF-002 acme-layer rename (ST-7)", () => {
  it("exports the acme aggregate as EmitBinaryResult with its original shape (ST-7)", () => {
    // Type-level assertion: an EmitBinaryResult value keeps the acme aggregate
    // shape (`success`, optional `symbols`). This fails to compile if the
    // rename is reverted (the name would no longer be exported).
    const sample: EmitBinaryResult = {
      success: true,
      diagnostics: [],
      symbols: new Map<string, number>(),
    };
    expect(sample.success).toBe(true);
    expect(sample.symbols).toBeInstanceOf(Map);
  });
});
