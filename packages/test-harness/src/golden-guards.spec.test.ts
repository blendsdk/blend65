/**
 * CI golden test for the guards fixture: emits the fixture's ACME source via
 * `emitAsm` and `assertGolden`s it against the committed
 * `test/golden/guards.asm.golden`. The fixture's update body is a small
 * catalogue of branch hazards — a compound unsigned window check, a negated
 * boolean, a signed velocity compare, and a short-circuit whose right clause
 * reads a hardware port — so its golden is where the emitted branch idiom is
 * read as a whole. Runs in CI (no emulator, no ACME — `emitAsm` stops before
 * the assembler).
 *
 * The landmark assertions below hold for any correct lowering of this
 * program: they pin what the source mandates (which registers are touched,
 * how many times, and in which block), never the shape of the surrounding
 * branch code. The committed golden carries the shape.
 *
 * The thirteen prior goldens stay byte-exact through their own suites in the
 * same run — nothing here may change them.
 *
 * Regenerate after an intentional codegen change (inspect the diff first):
 *   UPDATE_GOLDEN=1 yarn workspace @blend65/test-harness test golden-guards
 */

import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertGolden } from "./golden.js";
import { emitAsmGuards } from "./testing/guards.js";

const GOLDEN = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "test",
  "golden",
  "guards.asm.golden",
);

/** Count non-overlapping occurrences of a literal in the emitted source. */
function countOf(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

describe("Golden: guards fixture .asm snapshot", () => {
  it("emits the guards ACME source and matches the committed golden", () => {
    const result = emitAsmGuards();
    expect(result.hasErrors).toBe(false);
    expect(result.text).toBeDefined();
    assertGolden(result.text!, GOLDEN);
  });

  it("carries the four guard landmarks in the emitted source", () => {
    const text = emitAsmGuards().text!;

    // The frame lock reads the raster register; the update body writes the
    // border and the four verdict cells (the emitter prints $0400 without
    // its leading zero).
    expect(text).toContain("LDA $D012");
    expect(text).toContain("STA $D020");
    for (const cell of ["$400", "$401", "$402", "$403"]) {
      expect(text).toContain(`STA ${cell}`);
    }

    // The compound window guard compares against both bounds, in order.
    expect(text.indexOf("CMP #$08")).toBeGreaterThan(-1);
    expect(text.indexOf("CMP #$28")).toBeGreaterThan(text.indexOf("CMP #$08"));

    // The signed velocity compare uses the N-xor-V correction, not a bare
    // unsigned CMP: subtract, and fix N up when the subtraction overflowed.
    expect(text).toMatch(/SEC\n\s+SBC [^\n]+\n\s+BVC (\S+)\n\s+EOR #\$80\n\1:/);

    // The startup shim enters main (JSR for a terminating main, JMP when the
    // compiler knows it never returns — either way it must be entered).
    expect(text).toMatch(/J(SR|MP) _main/);
  });

  it("reads the input port exactly once, after the guard that admits it", () => {
    const text = emitAsmGuards().text!;

    // The short-circuit's right clause owns the port read: one load in the
    // whole program, and it cannot precede the test of the left clause. A
    // read hoisted out of that clause would poll hardware the source never
    // asked to poll.
    expect(countOf(text, "LDA $DC00")).toBe(1);
    expect(text.indexOf("LDA $DC00")).toBeGreaterThan(text.indexOf("LDA __frame_Main_main_armed"));

    // The poll loop reads the raster register once per iteration — the same
    // MMIO discipline, on the fixture's other polled register.
    expect(countOf(text, "LDA $D012")).toBe(1);
  });
});
