/**
 * CI golden test for the Slice 7b fixture: emits the fixture's ACME source
 * via `emitAsm` and `assertGolden`s it against the committed
 * `test/golden/slice7b.asm.golden`, proving the pointer surface's emission
 * stays byte-exact — the by-ref pair symbols define as zero-page equates,
 * accesses go through `(pair),Y`, argument addresses marshal as `#<`/`#>`
 * byte selects into the callee frame homes, the entry prologue copies
 * frame→pair, and the tier-2 runtime-index access runs the pointer-formation
 * sequence through the scratch pair. Runs in CI (no emulator, no ACME —
 * `emitAsm` stops before the assembler).
 *
 * The golden pins the exact bytes; the assertion is byte-exact equality.
 *
 * Regenerate after an intentional codegen change (inspect the diff first):
 *   UPDATE_GOLDEN=1 yarn workspace @blend65/test-harness test golden-slice7b
 */

import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertGolden } from "./golden.js";
import { emitAsmSlice7b } from "./testing/slice7b.js";

const GOLDEN = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "test",
  "golden",
  "slice7b.asm.golden",
);

describe("Golden: Slice 7b fixture .asm snapshot", () => {
  it("emits the Slice 7b ACME source and matches the committed golden", () => {
    const result = emitAsmSlice7b();
    expect(result.hasErrors).toBe(false);
    expect(result.text).toBeDefined();
    assertGolden(result.text!, GOLDEN);
  });

  it("carries the pointer-surface landmarks in the emitted source (ST-60)", () => {
    const text = emitAsmSlice7b().text!;

    // Pair symbols define as ZERO-PAGE equates (2-digit — the assembler
    // sizes symbols by digit count, and `(zp),Y` demands an 8-bit one).
    expect(text).toMatch(/__zp_ptr_Game_resetEnemy_e = \$[0-9A-F]{2}\n/);
    expect(text).toMatch(/__zp_ptr_scratch = \$[0-9A-F]{2}\n/);

    // Accesses go through the pair.
    expect(text).toContain("(__zp_ptr_Game_resetEnemy_e),Y");
    expect(text).toContain("(__zp_ptr_Game_sum_data),Y");

    // Argument addresses marshal as byte selects into the callee frame home.
    expect(text).toContain("LDA #<__var_Main_boss");
    expect(text).toContain("LDA #>__var_Main_boss");
    expect(text).toContain("LDA #<__data_Game_TABLE");

    // The entry prologue copies the frame home into the pair.
    expect(text).toContain("STA __zp_ptr_Game_resetEnemy_e");
    expect(text).toContain("STA __zp_ptr_Game_resetEnemy_e+1");

    // The pass-through relay owns NO pair — it forwards its frame word.
    expect(text).not.toContain("__zp_ptr_Game_relay_e");

    // The tier-2 runtime index runs the formation: the base address enters
    // the word add as byte selects and the sum homes in the scratch pair,
    // which the access then dereferences.
    expect(text).toContain("ADC #<__var_Main_big");
    expect(text).toContain("ADC #>__var_Main_big");
    expect(text).toContain("STA __zp_ptr_scratch");
    expect(text).toContain("STA __zp_ptr_scratch+1");
    expect(text).toContain("(__zp_ptr_scratch),Y");

    // The const-indexed coexistence access stays absolute — no formation.
    expect(text).toContain("STA __var_Main_big+4");
  });
});
