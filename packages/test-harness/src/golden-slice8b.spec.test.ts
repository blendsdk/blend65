/**
 * CI golden test for the Slice 8b fixture: emits the fixture's ACME source
 * via `emitAsm` and `assertGolden`s it against the committed
 * `test/golden/slice8b.asm.golden`, proving the data surface's emission
 * stays byte-exact — the string const bakes its PETSCII bytes and the
 * embedded file bakes its bytes verbatim under their data labels, the
 * banner initialises through the init stream, and the terminating shim
 * enters `main` with `JSR`. Runs in CI (no emulator, no ACME — `emitAsm`
 * stops before the assembler).
 *
 * The ten prior slice goldens plus the gate golden stay byte-exact through
 * their own suites in the same run — nothing here may change them.
 *
 * Regenerate after an intentional codegen change (inspect the diff first):
 *   UPDATE_GOLDEN=1 yarn workspace @blend65/test-harness test golden-slice8b
 */

import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertGolden } from "./golden.js";
import { emitAsmSlice8b } from "./testing/slice8b.js";

const GOLDEN = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "test",
  "golden",
  "slice8b.asm.golden",
);

describe("Golden: Slice 8b fixture .asm snapshot", () => {
  it("emits the Slice 8b ACME source and matches the committed golden", () => {
    const result = emitAsmSlice8b();
    expect(result.hasErrors).toBe(false);
    expect(result.text).toBeDefined();
    assertGolden(result.text!, GOLDEN);
  });

  it("carries the data-surface landmarks in the emitted source", () => {
    const text = emitAsmSlice8b().text!;

    // The string const bakes its PETSCII bytes under its data label.
    expect(text).toContain("__data_Main_TITLE:");
    expect(text).toContain("!byte $48, $45, $4C, $4C, $4F, $20, $43, $36, $34, $21");

    // The embedded file bakes its bytes verbatim under its data label.
    expect(text).toContain("__data_Main_TABLE:");
    expect(text).toContain("!byte $01, $02, $04, $08, $10, $20, $40, $80");

    // The banner is a mutable module variable initialised through the init
    // stream (expanded string + char fill), not baked const data.
    expect(text).toContain("__var_Main_banner");
    expect(text).toContain("JSR __init");

    // The fixture's main terminates — the terminating shim calls it.
    expect(text).toContain("JSR _main");
  });
});
