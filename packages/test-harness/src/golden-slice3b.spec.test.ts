/**
 * CI golden test for the Slice 3b fixture: emits the fixture's ACME source via
 * `emitAsm` and `assertGolden`s it against the committed
 * `test/golden/slice3b.asm.golden`, proving the `__var_Main_accB`/`accW` addresses
 * and the `__rt_mul8`/`__rt_mul16` call sites stay byte-exact. Runs in CI (no
 * emulator, no ACME — `emitAsm` stops before the assembler).
 *
 * The golden pins the exact bytes; the assertion is byte-exact equality.
 *
 * Regenerate after an intentional codegen change (inspect the diff first):
 *   UPDATE_GOLDEN=1 yarn workspace @blend65/test-harness test golden-slice3b
 */

import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertGolden } from "./golden.js";
import { emitAsmSlice3b } from "./testing/slice3b.js";

const GOLDEN = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "test",
  "golden",
  "slice3b.asm.golden",
);

describe("Golden: Slice 3b fixture .asm snapshot (ST-17)", () => {
  it("emits the Slice 3b ACME source and matches the committed golden", () => {
    const result = emitAsmSlice3b();
    expect(result.hasErrors).toBe(false);
    expect(result.text).toBeDefined();
    assertGolden(result.text!, GOLDEN);
  });
});
