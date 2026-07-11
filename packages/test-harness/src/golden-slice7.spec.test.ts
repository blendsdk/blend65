/**
 * CI golden test for the Slice 7 fixture: emits the fixture's ACME source via
 * `emitAsm` and `assertGolden`s it against the committed
 * `test/golden/slice7.asm.golden`, proving the aggregate surface's emission
 * stays byte-exact — the const table is an in-image `__data_Gfx_TABLE`
 * `!byte` block after the code, runtime indexes ride `abs,X` addressing, the
 * 2-byte struct-element scale strength-reduces to a shift (no runtime
 * multiply routine), and the module initializer stream exists for the
 * module-level declarations. Runs in CI (no emulator, no ACME — `emitAsm`
 * stops before the assembler).
 *
 * The golden pins the exact bytes; the assertion is byte-exact equality.
 *
 * Regenerate after an intentional codegen change (inspect the diff first):
 *   UPDATE_GOLDEN=1 yarn workspace @blend65/test-harness test golden-slice7
 */

import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertGolden } from "./golden.js";
import { emitAsmSlice7 } from "./testing/slice7.js";

const GOLDEN = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "test",
  "golden",
  "slice7.asm.golden",
);

describe("Golden: Slice 7 fixture .asm snapshot", () => {
  it("emits the Slice 7 ACME source and matches the committed golden", () => {
    const result = emitAsmSlice7();
    expect(result.hasErrors).toBe(false);
    expect(result.text).toBeDefined();
    assertGolden(result.text!, GOLDEN);
  });

  it("carries the aggregate-surface landmarks in the emitted source", () => {
    const text = emitAsmSlice7().text!;

    // The const table is an in-image data block, labeled and byte-emitted.
    expect(text).toContain("__data_Gfx_TABLE:");
    expect(text).toContain("!byte");

    // Runtime indexes ride absolute,X addressing.
    expect(text).toMatch(/LDA [^\n]*,X/);

    // The 2-byte struct-element scale is a shift, never a runtime multiply.
    expect(text).toContain("ASL");
    expect(text).not.toContain("__rt_mul");
  });
});
