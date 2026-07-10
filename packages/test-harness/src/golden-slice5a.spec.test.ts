/**
 * CI golden test for the Slice 5a fixture: emits the fixture's ACME source via
 * `emitAsm` and `assertGolden`s it against the committed
 * `test/golden/slice5a.asm.golden`, proving the calling convention (argument
 * stores into callee frame slots, bare `JSR Module_function` transfers, A /
 * A:X result binding, cross-module labels) stays byte-exact. Runs in CI (no
 * emulator, no ACME — `emitAsm` stops before the assembler).
 *
 * The golden pins the exact bytes; the assertion is byte-exact equality.
 *
 * Regenerate after an intentional codegen change (inspect the diff first):
 *   UPDATE_GOLDEN=1 yarn workspace @blend65/test-harness test golden-slice5a
 */

import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertGolden } from "./golden.js";
import { emitAsmSlice5a } from "./testing/slice5a.js";

const GOLDEN = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "test",
  "golden",
  "slice5a.asm.golden",
);

describe("Golden: Slice 5a fixture .asm snapshot", () => {
  it("emits the Slice 5a ACME source and matches the committed golden", () => {
    const result = emitAsmSlice5a();
    expect(result.hasErrors).toBe(false);
    expect(result.text).toBeDefined();
    assertGolden(result.text!, GOLDEN);
  });
});
