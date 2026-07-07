/**
 * Golden-snapshot tests for the canonical ACME serializer.
 *
 * Pins the byte-exact `printInstr` output of three canonical streams (the
 * 8-bit add, the pointer-setup + branch, and the palette data block) as
 * Vitest inline snapshots. Any unintended change to the serializer is caught
 * as a snapshot diff; a deliberate change requires an intentional snapshot
 * update — the output must stay deterministic.
 *
 * The fixtures are validated clean before serialization — this is the
 * "model → validate → serialize" mini-pipeline later stages will drive from
 * real IL.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag } from "@blend65/core";

import { validateStream } from "./validate.js";
import { printInstr } from "./print-instr.js";
import { add8Stream, ptrSetupStream, paletteStream } from "./test-fixtures.js";

describe("Golden: RD-07a printInstr canonical streams (AC-18)", () => {
  it("8-bit add stream — ST-G1", () => {
    const bag = createDiagnosticBag();
    validateStream(add8Stream, "nmos6502", bag);
    expect(bag.hasErrors()).toBe(false);
    expect(printInstr(add8Stream)).toMatchInlineSnapshot(`
      "add:
          LDA a
          CLC
          ADC b
          STA dest"
    `);
  });

  it("pointer-setup + branch stream — ST-G2", () => {
    const bag = createDiagnosticBag();
    validateStream(ptrSetupStream, "nmos6502", bag);
    expect(bag.hasErrors()).toBe(false);
    expect(printInstr(ptrSetupStream)).toMatchInlineSnapshot(`
      "    LDA #<buffer
          STA ptr
          LDA #>buffer
          STA ptr+1
      loop:
          LDA (ptr),Y
          BNE loop"
    `);
  });

  it("palette data block — ST-G3", () => {
    const bag = createDiagnosticBag();
    validateStream(paletteStream, "nmos6502", bag);
    expect(bag.hasErrors()).toBe(false);
    expect(printInstr(paletteStream)).toMatchInlineSnapshot(`
      "palette:
          !byte $00, $01, $02, $03"
    `);
  });
});
