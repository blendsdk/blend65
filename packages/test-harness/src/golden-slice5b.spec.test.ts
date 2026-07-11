/**
 * CI golden test for the Slice 5b fixture: emits the fixture's ACME source via
 * `emitAsm` and `assertGolden`s it against the committed
 * `test/golden/slice5b.asm.golden`, proving the module system's emission stays
 * byte-exact — the generated init routine serialized first, the shim's call to
 * it, the module-variable equates, the qualified-call labels, and the inlined
 * const (which owns NO storage symbol). Runs in CI (no emulator, no ACME —
 * `emitAsm` stops before the assembler).
 *
 * The golden pins the exact bytes; the assertion is byte-exact equality.
 *
 * Regenerate after an intentional codegen change (inspect the diff first):
 *   UPDATE_GOLDEN=1 yarn workspace @blend65/test-harness test golden-slice5b
 */

import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertGolden } from "./golden.js";
import { emitAsmSlice5b } from "./testing/slice5b.js";

const GOLDEN = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "test",
  "golden",
  "slice5b.asm.golden",
);

describe("Golden: Slice 5b fixture .asm snapshot", () => {
  it("emits the Slice 5b ACME source and matches the committed golden", () => {
    const result = emitAsmSlice5b();
    expect(result.hasErrors).toBe(false);
    expect(result.text).toBeDefined();
    assertGolden(result.text!, GOLDEN);
  });

  it("carries the module-system landmarks in the emitted source", () => {
    const text = emitAsmSlice5b().text!;

    // The generated init routine exists, is called from the shim, and its
    // stream is serialized before the entry function.
    expect(text).toContain("__init:");
    expect(text).toContain("JSR __init");
    expect(text.indexOf("__init:")).toBeLessThan(text.indexOf("_main:"));

    // Module variables own equates; the const is inlined and owns nothing.
    expect(text).toContain("__var_Math_base");
    expect(text).toContain("__var_Math_scaled");
    expect(text).toContain("__var_Main_combo");
    expect(text).not.toContain("__var_Math_SCALE");

    // Qualified and imported calls both land as ordinary labeled routines.
    expect(text).toContain("Math_add:");
    expect(text).toContain("Math_twice:");
    expect(text).toContain("JSR Math_add");
    expect(text).toContain("JSR Math_twice");
  });
});
