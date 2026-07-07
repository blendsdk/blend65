/**
 * CI golden test for the Slice 4b fixture: emits the fixture's ACME source via
 * `emitAsm` and `assertGolden`s it against the committed
 * `test/golden/slice4b.asm.golden`, proving the `brcond` dispatch chain (per-case
 * `eq`+`brcond`, the multi-value shared body, the `fallthrough` `br` into the next
 * body, and the `default` tail) stays byte-exact. Runs in CI (no emulator, no ACME
 * — `emitAsm` stops before the assembler).
 *
 * The golden pins the exact bytes; the assertion is byte-exact equality.
 *
 * Regenerate after an intentional codegen change (inspect the diff first):
 *   UPDATE_GOLDEN=1 yarn workspace @blend65/test-harness test golden-slice4b
 */

import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertGolden } from "./golden.js";
import { emitAsmSlice4b } from "./testing/slice4b.js";

const GOLDEN = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "test",
  "golden",
  "slice4b.asm.golden",
);

describe("Golden: Slice 4b fixture .asm snapshot (ST-20)", () => {
  it("emits the Slice 4b ACME source and matches the committed golden", () => {
    const result = emitAsmSlice4b();
    expect(result.hasErrors).toBe(false);
    expect(result.text).toBeDefined();
    assertGolden(result.text!, GOLDEN);
  });
});
