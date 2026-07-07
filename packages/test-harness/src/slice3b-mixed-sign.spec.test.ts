/**
 * Specification test for the Slice 3b mixed-signedness negative case. A
 * `byte + sbyte` expression must be rejected with **E10081**, set `hasErrors`,
 * emit **no binary**, and never throw — asserted through the frontend-only
 * `compile()` facade (CI-runnable, no ACME).
 *
 * This is derived directly from the documented mixed-sign arithmetic rule
 * (mixed-sign operands reject with E10081), not from reading the
 * implementation.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DiagCode } from "@blend65/core";
import { compile } from "@blend65/compiler";

/** The mixed-sign negative fixture. */
const MIXED_SIGN_SRC = `module Main;
function main(): void {
    let a: byte = 5;
    let s: sbyte = -1;
    let r: byte = a + s;
}
`;

describe("Specification: Slice 3b mixed-signedness negative (ST-19, AC-4)", () => {
  it("rejects byte + sbyte with E10081, no binary, never throwing", () => {
    const cwd = mkdtempSync(join(tmpdir(), "b65-slice3b-mixed-"));
    writeFileSync(join(cwd, "main.blend"), MIXED_SIGN_SRC, "utf8");
    try {
      let result!: ReturnType<typeof compile>;
      expect(() => {
        result = compile({ platform: "c64", cwd, sourceFiles: ["main.blend"] });
      }).not.toThrow();

      expect(result.hasErrors).toBe(true);
      expect(result.diagnostics.map((d) => d.code)).toContain(
        DiagCode.MixedSignedUnsignedOperands, // E10081
      );
      // `compile()` is the frontend-only path — it never produces a binary.
      expect(result).not.toHaveProperty("binary");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
