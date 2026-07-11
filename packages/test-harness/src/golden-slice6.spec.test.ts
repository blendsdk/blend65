/**
 * CI golden test for the Slice 6 fixture: emits the fixture's ACME source via
 * `emitAsm` and `assertGolden`s it against the committed
 * `test/golden/slice6.asm.golden`, proving the expression system's emission
 * stays byte-exact — the synthetic short-circuit/conditional result slots own
 * frame equates, the short-circuit diamonds branch to real block labels, the
 * helper is an ordinary JSR target, and nothing in the fixture needs a
 * runtime arithmetic routine. Runs in CI (no emulator, no ACME — `emitAsm`
 * stops before the assembler).
 *
 * The golden pins the exact bytes; the assertion is byte-exact equality.
 *
 * Regenerate after an intentional codegen change (inspect the diff first):
 *   UPDATE_GOLDEN=1 yarn workspace @blend65/test-harness test golden-slice6
 */

import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertGolden } from "./golden.js";
import { emitAsmSlice6 } from "./testing/slice6.js";

const GOLDEN = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "test",
  "golden",
  "slice6.asm.golden",
);

describe("Golden: Slice 6 fixture .asm snapshot", () => {
  it("emits the Slice 6 ACME source and matches the committed golden", () => {
    const result = emitAsmSlice6();
    expect(result.hasErrors).toBe(false);
    expect(result.text).toBeDefined();
    assertGolden(result.text!, GOLDEN);
  });

  it("carries the expression-system landmarks in the emitted source", () => {
    const text = emitAsmSlice6().text!;

    // Synthetic short-circuit/conditional result slots are real frame slots.
    expect(text).toContain("__frame_Main_main_0sc");

    // The short-circuit helper is an ordinary labeled routine, called only
    // through the diamond's rhs blocks.
    expect(text).toContain("Main_bump:");
    expect(text).toContain("JSR Main_bump");

    // Nothing in the fixture multiplies or divides — no runtime routines.
    expect(text).not.toContain("__rt_");
  });
});
