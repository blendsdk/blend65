/**
 * CI golden test for the rasterpoll fixture: emits the fixture's ACME source
 * via `emitAsm` and `assertGolden`s it against the committed
 * `test/golden/rasterpoll.asm.golden`. The fixture is the minimal
 * frame-locked idiom — poll `$D012` for a target raster line, run a small
 * frame-update body, loop forever — and its emitted shape anchors the
 * per-iteration cycle budget window. Runs in CI (no emulator, no ACME —
 * `emitAsm` stops before the assembler).
 *
 * The twelve prior goldens stay byte-exact through their own suites in the
 * same run — nothing here may change them.
 *
 * Regenerate after an intentional codegen change (inspect the diff first):
 *   UPDATE_GOLDEN=1 yarn workspace @blend65/test-harness test golden-rasterpoll
 */

import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertGolden } from "./golden.js";
import { emitAsmRasterpoll } from "./testing/rasterpoll.js";

const GOLDEN = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "test",
  "golden",
  "rasterpoll.asm.golden",
);

describe("Golden: rasterpoll fixture .asm snapshot", () => {
  it("emits the rasterpoll ACME source and matches the committed golden", () => {
    const result = emitAsmRasterpoll();
    expect(result.hasErrors).toBe(false);
    expect(result.text).toBeDefined();
    assertGolden(result.text!, GOLDEN);
  });

  it("carries the raster-poll landmarks in the emitted source", () => {
    const text = emitAsmRasterpoll().text!;

    // The poll reads the raster register — the fixture's defining landmark.
    expect(text).toContain("$D012");

    // The frame-update body writes the border colour and a screen heartbeat
    // (the emitter prints $0400 without its leading zero).
    expect(text).toContain("STA $D020");
    expect(text).toContain("STA $400");

    // The loop labels the cycle-budget windows anchor to (frame loop + poll
    // loop), in the established Module_function_LN naming scheme.
    expect(text).toMatch(/Main_main_L\d+:/);

    // The startup shim enters main (JSR for a terminating main, JMP when the
    // compiler knows it never returns — either way it must be entered).
    expect(text).toMatch(/J(SR|MP) _main/);
  });
});
