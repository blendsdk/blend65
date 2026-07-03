/**
 * Demonstrating golden test (07 §Integration): compiles the gate program to ACME
 * source via `emitAsm` and `assertGolden`s it against a committed
 * `test/golden/gate.asm.golden`, proving the helper end-to-end in CI (no emulator,
 * no ACME — `emitAsm` stops before the assembler).
 *
 * Regenerate the golden after an intentional codegen change:
 *   UPDATE_GOLDEN=1 yarn workspace @blend65/test-harness test
 */

import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { emitAsm } from "@blend65/compiler";
import { assertGolden } from "./golden.js";
import { GATE_SRC } from "./testing/gate.js";

const GOLDEN = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "golden", "gate.asm.golden");

describe("Golden demo: gate program .asm snapshot (assertGolden end-to-end)", () => {
  it("emits the gate ACME source and matches the committed golden", () => {
    const cwd = mkdtempSync(join(tmpdir(), "b65-golden-asm-"));
    writeFileSync(join(cwd, "main.blend"), GATE_SRC, "utf8");
    try {
      const result = emitAsm({ platform: "c64", cwd, sourceFiles: ["main.blend"] });
      expect(result.hasErrors).toBe(false);
      expect(result.text).toBeDefined();
      assertGolden(result.text!, GOLDEN);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
