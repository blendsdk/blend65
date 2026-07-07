/**
 * Specification test for the RD-18 Slice 4a all-paths-return negative (acceptance
 * bar part 4, ST-22, FR-13). A non-void function that returns on only one path
 * must be rejected with **E10102**, set `hasErrors`, emit **no binary**, and never
 * throw — asserted through the frontend-only `compile()` facade (CI-runnable, no
 * ACME).
 *
 * Derived EXCLUSIVELY from `03-04-acceptance-fixtures.md` (ST-22) + the AR-4 code
 * decision (all-paths-return = E10102) — never from reading the implementation
 * (IMMUTABLE ORACLE). Uses a local `x` (not a parameter — params are not yet in
 * scope until Slice 5, so a param reference would raise a spurious E10100).
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DiagCode } from "@blend65/core";
import { compile } from "@blend65/compiler";

/** The missing-return negative fixture (03-04 §4). */
const MISSING_RETURN_SRC = `module Main;
function f(): byte {
    let x: byte = 5;
    if (x > 0) {
        return 1;
    }
    // falls through with no return → E10102
}
function main(): void { }
`;

describe("Specification: Slice 4a all-paths-return negative (ST-22, FR-13)", () => {
  it("rejects a non-void function missing a return path with E10102, no binary, never throwing", () => {
    const cwd = mkdtempSync(join(tmpdir(), "b65-slice4a-missing-return-"));
    writeFileSync(join(cwd, "main.blend"), MISSING_RETURN_SRC, "utf8");
    try {
      let result!: ReturnType<typeof compile>;
      expect(() => {
        result = compile({ platform: "c64", cwd, sourceFiles: ["main.blend"] });
      }).not.toThrow();

      expect(result.hasErrors).toBe(true);
      expect(result.diagnostics.map((d) => d.code)).toContain(
        DiagCode.NotAllPathsReturn, // E10102
      );
      // `compile()` is the frontend-only path — it never produces a binary.
      expect(result).not.toHaveProperty("binary");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
