/**
 * Specification test for the `@blend65/config` public API surface.
 *
 * Traceability: RD-16 §4.2 (exported contract) + AR-P6 (index.ts re-exports
 * only: `loadConfig`, the types, `CONFIG_SOURCE_ID`, `CONFIG_DEFAULTS`).
 * Replaces the RD-01 scaffolding smoke test (execution plan task 4.1.2).
 */

import { describe, expect, it } from "vitest";
import { CONFIG_DEFAULTS, CONFIG_SOURCE_ID, loadConfig } from "./index.js";
import type { BlendConfig, LoadConfigOptions, LoadConfigResult } from "./index.js";

describe("@blend65/config public API surface (RD-16 §4.2 / AR-P6)", () => {
  it("exports loadConfig as a function", () => {
    expect(typeof loadConfig).toBe("function");
  });

  it("exports the CONFIG_SOURCE_ID sentinel (-2, AR-P2)", () => {
    expect(CONFIG_SOURCE_ID).toBe(-2);
  });

  it("exports the §4.1 defaults table (no platform default — R31)", () => {
    expect(CONFIG_DEFAULTS.outDir).toBe("./build/");
    expect(CONFIG_DEFAULTS.maxErrors).toBe(20);
    expect("platform" in CONFIG_DEFAULTS).toBe(false);
  });

  it("exports the §4.2 types (compile-time check via usage)", () => {
    // Type-only exports have no runtime footprint; using them in annotations
    // makes `tsc` the assertion. A signature mismatch fails the build.
    const useTypes = (
      options: LoadConfigOptions,
      result: LoadConfigResult,
      config: BlendConfig,
    ): number => options.bag.count() + Number(result.hasErrors) + config.maxErrors;
    expect(typeof useTypes).toBe("function");
  });
});
