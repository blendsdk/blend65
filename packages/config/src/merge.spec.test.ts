/**
 * Specification tests for config merging (ST-25..ST-27).
 *
 * Traceability: RD-16 R23/R24/R25, AC-08, via 07-testing-strategy.md — the
 * precedence chain is defaults ← file ← overrides; only explicitly-set
 * (non-`undefined`) override values apply; arrays replace, never concatenate.
 * Written before the implementation exists (immutable-oracle rule).
 */

import { describe, expect, it } from "vitest";
import { mergeConfig } from "./merge.js";

const ORIGIN = { configPath: "/proj/blend65.json", projectRoot: "/proj" };

describe("mergeConfig (ST-25..ST-27 / R23-R25)", () => {
  it("ST-25: an override wins over the file; untouched file values are kept (AC-08)", () => {
    const config = mergeConfig(
      { platform: "c64", maxErrors: 50 },
      { platform: "cx16" },
      ORIGIN,
    );
    expect(config.platform).toBe("cx16");
    expect(config.maxErrors).toBe(50);
  });

  it("ST-26: an explicitly-undefined override does NOT override the file value (R25)", () => {
    const config = mergeConfig(
      { outDir: "./dist/" },
      { platform: "c64", outDir: undefined },
      ORIGIN,
    );
    expect(config.outDir).toBe("./dist/");
    expect(config.platform).toBe("c64");
  });

  it("ST-27: array overrides replace file arrays, never concatenate (R25)", () => {
    const config = mergeConfig({ include: ["a/**"] }, { include: ["b/**"] }, ORIGIN);
    expect(config.include).toEqual(["b/**"]);
  });

  it("fills every unsupplied key from the RD §4.1 defaults and records the origin", () => {
    const config = mergeConfig({ platform: "c64" }, undefined, ORIGIN);
    expect(config.configPath).toBe("/proj/blend65.json");
    expect(config.projectRoot).toBe("/proj");
    expect(config.include).toEqual(["**/*.blend"]);
    expect(config.exclude).toEqual(["node_modules/**"]);
    expect(config.outDir).toBe("./build/");
    expect(config.outName).toBe("");
    expect(config.acmePath).toBe("");
    expect(config.maxErrors).toBe(20);
    expect(config.warnAsError).toBe(false);
    expect(config.suppressWarnings).toEqual([]);
    expect(config.diagnosticsFormat).toBe("terminal");
    expect(config.optimize).toBe(true);
    expect(config.quiet).toBe(false);
    expect(config.startup).toBe("auto");
  });

  it("records a null configPath on a discovery miss (R3 path)", () => {
    const config = mergeConfig({}, { platform: "c64" }, { configPath: null, projectRoot: "/cwd" });
    expect(config.configPath).toBeNull();
    expect(config.projectRoot).toBe("/cwd");
  });
});
