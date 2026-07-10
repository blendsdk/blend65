/**
 * Specification test for the driver's pre-planning error gate: a program the
 * analyzer rejected (here: recursion, which static frame allocation can never
 * compile) must never reach frame planning — coloring over a cyclic call
 * graph is meaningless, so no allocation plan (and no binary) may exist.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DiagCode } from "@blend65/core";
import { compile } from "./compile.js";
import { memHost } from "./test-fixtures.js";

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "b65-gate-"));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

describe("Specification: frontend errors gate frame planning", () => {
  it("should reject recursion with E10174 and produce NO allocation plan", () => {
    const result = compile(
      { platform: "c64", cwd, sourceFiles: ["main.blend"] },
      memHost({
        "main.blend":
          "module Main;\n" +
          "function f(n: byte): byte { return f(n); }\n" +
          "function main(): void {}\n",
      }),
    );

    expect(result.diagnostics.map((d) => d.code)).toContain(DiagCode.RecursionDetected);
    expect(result.hasErrors).toBe(true);
    expect(result.allocationPlan).toBeUndefined();
  });

  it("should still plan allocation for a clean program", () => {
    const result = compile(
      { platform: "c64", cwd, sourceFiles: ["main.blend"] },
      memHost({
        "main.blend": "module Main;\nfunction main(): void { let x: byte = 1; }\n",
      }),
    );

    expect(result.hasErrors).toBe(false);
    expect(result.allocationPlan).toBeDefined();
  });
});
