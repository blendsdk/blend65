/**
 * CI golden test for the Slice 3a fixture: emits the fixture's ACME source via
 * `emitAsm` and `assertGolden`s it against the committed
 * `test/golden/slice3a.asm.golden`, proving the `__frame_Main_main` /
 * `__frame_Main_main_x` addresses stay byte-exact. Runs in CI (no emulator, no
 * ACME — `emitAsm` stops before the assembler).
 *
 * The golden pins the exact bytes; the spec assertion is byte-exact equality.
 *
 * Regenerate after an intentional codegen change (inspect the diff first):
 *   UPDATE_GOLDEN=1 yarn workspace @blend65/test-harness test golden-slice3a
 */

import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertGolden } from "./golden.js";
import { emitAsmSlice3a } from "./testing/slice3a.js";

const GOLDEN = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "test",
  "golden",
  "slice3a.asm.golden",
);

describe("Golden: Slice 3a fixture .asm snapshot (ST-6)", () => {
  it("emits the Slice 3a ACME source and matches the committed golden", () => {
    const result = emitAsmSlice3a();
    expect(result.hasErrors).toBe(false);
    expect(result.text).toBeDefined();
    assertGolden(result.text!, GOLDEN);
  });
});
