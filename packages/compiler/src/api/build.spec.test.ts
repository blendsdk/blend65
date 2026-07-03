/**
 * Specification tests for `build()` — ST-17..ST-21.
 *
 * Derived EXCLUSIVELY from RD-15 R6/R25, RD-16 R21/R22, RD-11 AC-17, and the plan
 * (03-02, AR-V5/V7). Immutable oracles: the full-pipeline result shape (ST-17),
 * the platform-named E10034 via `checkBinaryBudget` (ST-18), unknown-platform
 * config abort (ST-19), config-first two-bag merge (ST-20), and the maxErrors
 * cap (ST-21). ACME is faked (AR-V4).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DiagCode } from "@blend65/core";
import { build } from "./build.js";
import { fakeBuildDeps, GATE_SRC, memHost } from "./test-fixtures.js";

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "b65-build-"));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

describe("Specification: build() full pipeline success (ST-17)", () => {
  it("returns paths, a binary, a symbol map, and a sized report on ACME success (ST-17)", async () => {
    const result = await build(
      { platform: "c64", cwd, sourceFiles: ["main.blend"] },
      memHost({ "main.blend": GATE_SRC }),
      fakeBuildDeps({ binarySize: 100 }),
    );

    expect(result.asmPath).toBeDefined();
    expect(result.binaryPath).toBeDefined();
    expect(result.binary).toBeInstanceOf(Uint8Array);
    expect(result.symbolMap).toBeInstanceOf(Map);
    expect(result.resourceReport?.binarySize).toBe(100);
    expect(result.hasErrors).toBe(false);
  });
});

describe("Specification: build() over-budget binary → E10034 (ST-18)", () => {
  it("emits the platform-named E10034 when the binary exceeds the c64 budget (ST-18)", async () => {
    // c64 maxBinarySize is 26623; 30000 exceeds it.
    const result = await build(
      { platform: "c64", cwd, sourceFiles: ["main.blend"] },
      memHost({ "main.blend": GATE_SRC }),
      fakeBuildDeps({ binarySize: 30000 }),
    );

    const budget = result.diagnostics.find((d) => d.code === DiagCode.BinaryTooLarge);
    expect(budget).toBeDefined();
    expect(budget!.message).toContain("platform 'c64'");
    expect(result.hasErrors).toBe(true);
  });
});

describe("Specification: build() unknown platform aborts at config (ST-19)", () => {
  it("returns a config-band error and no semantic model for an unknown platform (ST-19)", async () => {
    const result = await build({ platform: "nope", cwd }, undefined, fakeBuildDeps());

    expect(result.diagnostics.some((d) => d.code === DiagCode.ConfigUnknownPlatform)).toBe(true);
    expect(result.semanticModel).toBeUndefined();
  });
});

describe("Specification: build() config-first two-bag merge (ST-20)", () => {
  it("orders a config warning before a source error (ST-20)", async () => {
    // An unknown blend65.json key → W10240 (ConfigUnknownKey), a non-aborting warning.
    writeFileSync(join(cwd, "blend65.json"), JSON.stringify({ platform: "c64", bogusKey: 1 }), "utf8");

    const result = await build(
      { platform: "c64", cwd, sourceFiles: ["main.blend"] },
      memHost({ "main.blend": "module ; garbage" }),
      fakeBuildDeps(),
    );

    expect(result.diagnostics[0]!.code).toBe(DiagCode.ConfigUnknownKey);
    expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
  });
});

describe("Specification: build() maxErrors cap (ST-21)", () => {
  it("caps error-severity diagnostics at maxErrors (ST-21)", async () => {
    // Five stray '@' characters → five UnexpectedCharacter (E10210) errors.
    const src = "module Main;\nfunction main(): void {\n@\n@\n@\n@\n@\n}\n";
    const result = await build(
      { platform: "c64", cwd, sourceFiles: ["main.blend"], maxErrors: 3 },
      memHost({ "main.blend": src }),
      fakeBuildDeps(),
    );

    const realErrors = result.diagnostics.filter(
      (d) => d.severity === "error" && d.code !== DiagCode.TooManyErrors,
    );
    expect(realErrors).toHaveLength(3);
  });
});
