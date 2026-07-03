/**
 * Implementation tests for `optionsToOverrides` — the full mapping table (03-02).
 *
 * Covers: every overridable BlendConfig key maps 1:1; the three routing options
 * (`configPath`/`sourceFiles`/`cwd`) are NOT emitted as config keys; and absent
 * options produce explicit-undefined values ("not set, never overrides").
 */

import { describe, expect, it } from "vitest";
import { optionsToOverrides, type CompilerOptions } from "./options.js";

describe("optionsToOverrides: routing options are not config keys", () => {
  it("omits configPath, sourceFiles, and cwd from the overrides", () => {
    const overrides = optionsToOverrides({
      platform: "c64",
      configPath: "/x/blend65.json",
      sourceFiles: ["a.blend"],
      cwd: "/proj",
    });

    expect("configPath" in overrides).toBe(false);
    expect("sourceFiles" in overrides).toBe(false);
    expect("cwd" in overrides).toBe(false);
    expect(overrides.platform).toBe("c64");
  });
});

describe("optionsToOverrides: absent options map to explicit undefined", () => {
  it("copies platform and leaves every other config key undefined", () => {
    const overrides = optionsToOverrides({ platform: "cx16" });

    expect(overrides.platform).toBe("cx16");
    for (const key of [
      "include",
      "exclude",
      "outDir",
      "outName",
      "acmePath",
      "maxErrors",
      "warnAsError",
      "suppressWarnings",
      "diagnosticsFormat",
      "optimize",
      "quiet",
      "startup",
    ] as const) {
      expect(overrides[key]).toBeUndefined();
    }
  });
});

describe("optionsToOverrides: full mapping table", () => {
  it("copies every overridable key through 1:1", () => {
    const options: CompilerOptions = {
      platform: "c64",
      include: ["src/**/*.blend"],
      exclude: ["gen/**"],
      outDir: "./out/",
      outName: "game",
      acmePath: "/usr/bin/acme",
      maxErrors: 5,
      warnAsError: ["W10210"],
      suppressWarnings: ["W10191"],
      diagnosticsFormat: "json",
      optimize: false,
      quiet: true,
      startup: "bare",
    };

    expect(optionsToOverrides(options)).toEqual({
      platform: "c64",
      include: ["src/**/*.blend"],
      exclude: ["gen/**"],
      outDir: "./out/",
      outName: "game",
      acmePath: "/usr/bin/acme",
      maxErrors: 5,
      warnAsError: ["W10210"],
      suppressWarnings: ["W10191"],
      diagnosticsFormat: "json",
      optimize: false,
      quiet: true,
      startup: "bare",
    });
  });
});
