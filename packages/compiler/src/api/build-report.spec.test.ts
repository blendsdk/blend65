/**
 * Specification tests for the build-level resource-report cost fields:
 * per-function straight-line estimates and the plugin-costed startup
 * figures thread through a real `build()`, appear in both renderers, and a
 * non-NMOS target build carries the explicit no-timing-data label instead
 * of cycle figures.
 *
 * The c64 case builds the committed balloon example; the wdc65c02 case
 * builds a minimal staged fixture for the Commander X16 target. Real ACME
 * (present in CI); no emulator.
 */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTiming, isInstr } from "@blend65/core/platform";
import type { NmosOpcode } from "@blend65/core/platform";
import { renderReportJson, renderReportTerminal } from "@blend65/core";
import { loadPlatform } from "@blend65/platforms";

import { build } from "./build.js";

const BALLOON_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "examples",
  "balloon",
);

/** Whether real ACME is on PATH. */
function hasAcme(): boolean {
  try {
    return execFileSync("which", ["acme"], { encoding: "utf8" }).trim().length > 0;
  } catch {
    return false;
  }
}

describe.skipIf(!hasAcme())("Specification: build-level function costs and startup cost", () => {
  it("should report per-function estimates and a timing-table-exact startup cost for a c64 build", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "b65-report-c64-"));
    try {
      copyFileSync(join(BALLOON_DIR, "main.blend"), join(cwd, "main.blend"));
      copyFileSync(join(BALLOON_DIR, "balloon.bin"), join(cwd, "balloon.bin"));
      const result = await build({
        platform: "c64",
        cwd,
        sourceFiles: ["main.blend"],
        outDir: join(cwd, "out"),
      });
      expect(result.hasErrors).toBe(false);
      const report = result.resourceReport!;

      // Per-function straight-line estimates: the entry function is present
      // (by its source-level name) with a real byte size and min ≤ max.
      const costs = report.functionCosts!;
      const main = costs.find((c) => c.name === "Main.main")!;
      expect(main).toBeDefined();
      expect(main.bytes).toBeGreaterThan(0);
      expect(main.minCycles).toBeGreaterThan(0);
      expect(main.maxCycles).toBeGreaterThanOrEqual(main.minCycles);

      // The terminal summary renders the section; the JSON mirrors the data.
      const terminal = renderReportTerminal(report);
      expect(terminal).toContain("straight-line");
      expect(terminal).toContain("Main.main");
      const json = JSON.parse(renderReportJson(report));
      expect(json.functionCosts).toEqual(costs.map((c) => ({ ...c })));

      // Startup cost: non-zero, and exactly the timing-table sum over the
      // shim the platform emits for this build's configuration (the balloon's
      // main never returns → the non-terminating shim; __init presence is
      // read off the emitted source).
      const plugin = loadPlatform("c64");
      const hasInit = result.asmText!.includes("JSR __init");
      let expectedCycles = 0;
      let expectedBytes = 0;
      for (const entry of plugin.emitStartupShim("non-terminating", hasInit)) {
        if (!isInstr(entry)) continue;
        const timing = getTiming(entry.opcode as NmosOpcode, entry.mode);
        expectedCycles += timing.baseCycles;
        expectedBytes += timing.bytes;
      }
      expect(report.startupCycles).toBeGreaterThan(0);
      expect(report.startupCycles).toBe(expectedCycles);
      expect(report.startupSize).toBe(expectedBytes);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  }, 120000);

  it("should label a wdc65c02 build's costs as lacking timing data, keeping byte sizes", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "b65-report-cx16-"));
    try {
      writeFileSync(
        join(cwd, "main.blend"),
        ["module Main;", "", "function main(): void {", "  poke($9F20, 1);", "}", ""].join("\n"),
        "utf8",
      );
      const result = await build({
        platform: "cx16",
        cwd,
        sourceFiles: ["main.blend"],
        outDir: join(cwd, "out"),
      });
      const report = result.resourceReport!;

      expect(report.cycleEstimatesUnavailable).toBe("no timing data for this CPU variant");
      const costs = report.functionCosts!;
      expect(costs.length).toBeGreaterThan(0);
      for (const cost of costs) {
        expect(cost.bytes).toBeGreaterThan(0);
      }
      const terminal = renderReportTerminal(report);
      expect(terminal).toContain("no timing data for this CPU variant");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  }, 120000);
});
