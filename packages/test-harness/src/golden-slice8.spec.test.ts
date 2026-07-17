/**
 * CI golden test for the Slice 8 fixture: emits the fixture's ACME source
 * via `emitAsm` and `assertGolden`s it against the committed
 * `test/golden/slice8.asm.golden`, proving the hardware surface's emission
 * stays byte-exact — the zeropage variable defines as a 2-digit zero-page
 * equate, the handlers open with the register save and close every exit
 * with the restore + RTI, the vector installs materialize the handler
 * labels as `#<`/`#>` byte selects, and the non-terminating shim enters
 * `main` with `JMP` (no restore tail). Runs in CI (no emulator, no ACME —
 * `emitAsm` stops before the assembler).
 *
 * The golden pins the exact bytes; the assertion is byte-exact equality.
 *
 * Regenerate after an intentional codegen change (inspect the diff first):
 *   UPDATE_GOLDEN=1 yarn workspace @blend65/test-harness test golden-slice8
 */

import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertGolden } from "./golden.js";
import { emitAsmSlice8 } from "./testing/slice8.js";

const GOLDEN = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "test",
  "golden",
  "slice8.asm.golden",
);

describe("Golden: Slice 8 fixture .asm snapshot", () => {
  it("emits the Slice 8 ACME source and matches the committed golden", () => {
    const result = emitAsmSlice8();
    expect(result.hasErrors).toBe(false);
    expect(result.text).toBeDefined();
    assertGolden(result.text!, GOLDEN);
  });

  it("carries the hardware-surface landmarks in the emitted source (ST-40)", () => {
    const text = emitAsmSlice8().text!;

    // The zeropage variable defines as a 2-digit zero-page equate (the
    // assembler sizes symbols by digit count).
    expect(text).toMatch(/__zp_Main_frameCount = \$[0-9A-F]{2}\n/);

    // Both handlers save all three registers on entry and restore them in
    // reverse order before RTI — every exit, no RTS anywhere in a handler.
    expect(text).toContain("Main_onIRQ:");
    expect(text).toContain("Main_onNMI:");
    const save = "    PHA\n    TXA\n    PHA\n    TYA\n    PHA\n";
    const restore = "    PLA\n    TAY\n    PLA\n    TAX\n    PLA\n    RTI\n";
    expect(text).toContain(save);
    expect(text).toContain(restore);

    // The vector installs materialize the handler labels as byte selects.
    expect(text).toContain("LDA #<Main_onIRQ");
    expect(text).toContain("LDA #>Main_onIRQ");
    expect(text).toContain("LDA #<Main_onNMI");

    // The non-terminating shim enters main with JMP — no JSR, no restore tail.
    expect(text).toContain("JMP _main");
    expect(text).not.toContain("JSR _main");
  });
});
