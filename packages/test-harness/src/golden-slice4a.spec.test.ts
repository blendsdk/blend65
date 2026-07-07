/**
 * CI golden test for the Slice 4a fixture: emits the fixture's ACME source via
 * `emitAsm` and `assertGolden`s it against the committed
 * `test/golden/slice4a.asm.golden`, proving the multi-block loop labels, the
 * Pattern-A compare/increment, the break/continue branches, and the two-armed
 * if/else stay byte-exact. Runs in CI (no emulator, no ACME — `emitAsm` stops
 * before the assembler).
 *
 * The golden pins the exact bytes; the assertion is byte-exact equality.
 *
 * Regenerate after an intentional codegen change (inspect the diff first):
 *   UPDATE_GOLDEN=1 yarn workspace @blend65/test-harness test golden-slice4a
 */

import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertGolden } from "./golden.js";
import { emitAsmSlice4a } from "./testing/slice4a.js";

const GOLDEN = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "test",
  "golden",
  "slice4a.asm.golden",
);

describe("Golden: Slice 4a fixture .asm snapshot (ST-20)", () => {
  it("emits the Slice 4a ACME source and matches the committed golden", () => {
    const result = emitAsmSlice4a();
    expect(result.hasErrors).toBe(false);
    expect(result.text).toBeDefined();
    assertGolden(result.text!, GOLDEN);
  });
});
