/**
 * Specification tests for `compile()`.
 *
 * Written from the requirements, never from the implementation. Immutable
 * oracles: never throws, never prints, returns the resolved config, injected
 * host used verbatim, two-bag merge + severity policy, and override-wins
 * config merge.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DiagCode } from "@blend65/core";
import { compile } from "./compile.js";
import { GATE_SRC, memHost } from "./test-fixtures.js";

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "b65-compile-"));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

describe("Specification: compile() clean gate program (ST-8)", () => {
  it("returns no errors and a populated model for the gate source (ST-8)", () => {
    const result = compile(
      { platform: "c64", cwd, sourceFiles: ["main.blend"] },
      memHost({ "main.blend": GATE_SRC }),
    );

    expect(result.hasErrors).toBe(false);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(result.config.platform).toBe("c64");
    expect(result.sourceMap.has(0)).toBe(true);
    expect(result.semanticModel).toBeDefined();
    expect(result.allocationPlan).toBeDefined();
  });
});

describe("Specification: compile() never throws on garbage (ST-9)", () => {
  it("returns a result with errors instead of throwing (ST-9)", () => {
    const result = compile(
      { platform: "c64", cwd, sourceFiles: ["main.blend"] },
      memHost({ "main.blend": "module ; garbage" }),
    );

    expect(result.hasErrors).toBe(true);
    expect(result.diagnostics.filter((d) => d.severity === "error").length).toBeGreaterThanOrEqual(1);
  });
});

describe("Specification: compile() never prints (ST-10)", () => {
  it("makes zero calls to stdout/stderr/console around a clean compile (ST-10)", () => {
    const outSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const errSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      compile(
        { platform: "c64", cwd, sourceFiles: ["main.blend"] },
        memHost({ "main.blend": GATE_SRC }),
      );
    } finally {
      const outCalls = outSpy.mock.calls.length;
      const errCalls = errSpy.mock.calls.length;
      const logCalls = logSpy.mock.calls.length;
      outSpy.mockRestore();
      errSpy.mockRestore();
      logSpy.mockRestore();
      expect(outCalls).toBe(0);
      expect(errCalls).toBe(0);
      expect(logCalls).toBe(0);
    }
  });
});

describe("Specification: compile() uses the injected host's file set verbatim (ST-11)", () => {
  it("interns both files from a two-file host when no sourceFiles are given (ST-11)", () => {
    const result = compile(
      { platform: "c64", cwd },
      memHost({ "a.blend": "module A;\n", "b.blend": "module B;\n" }),
    );

    // Two interned sources → ids 0 and 1 both present.
    expect(result.sourceMap.has(0)).toBe(true);
    expect(result.sourceMap.has(1)).toBe(true);
    expect(result.sourceMap.has(2)).toBe(false);
  });
});

describe("Specification: compile() config merge — override wins over file (ST-12)", () => {
  it("keeps the file's outDir and takes the override platform (ST-12)", () => {
    writeFileSync(join(cwd, "blend65.json"), JSON.stringify({ platform: "c64", outDir: "./out/" }), "utf8");

    const result = compile({ platform: "cx16", cwd });

    expect(result.config.outDir).toBe("./out/");
    expect(result.config.platform).toBe("cx16");
  });
});

describe("Specification: compile() warn-as-error promotion (ST-13)", () => {
  it("promotes a frontend warning to an error, preserving its W-code (ST-13)", () => {
    // `05` is a decimal literal with a leading zero → W10210 (NumericLeadingZeros).
    const src = "module Main;\nfunction main(): void { poke(0xD020, 05); }\n";
    const result = compile(
      { platform: "c64", cwd, sourceFiles: ["main.blend"], warnAsError: true },
      memHost({ "main.blend": src }),
    );

    const promoted = result.diagnostics.find((d) => d.code === DiagCode.NumericLeadingZeros);
    expect(promoted).toBeDefined();
    expect(promoted!.severity).toBe("error");
    expect(result.hasErrors).toBe(true);
  });
});

describe("Specification: compile() suppression wins over promotion (ST-14)", () => {
  it("drops a warning that is both suppressed and promoted (ST-14)", () => {
    const src = "module Main;\nfunction main(): void { poke(0xD020, 05); }\n";
    const result = compile(
      {
        platform: "c64",
        cwd,
        sourceFiles: ["main.blend"],
        warnAsError: true,
        suppressWarnings: [DiagCode.NumericLeadingZeros],
      },
      memHost({ "main.blend": src }),
    );

    expect(result.diagnostics.find((d) => d.code === DiagCode.NumericLeadingZeros)).toBeUndefined();
  });
});
