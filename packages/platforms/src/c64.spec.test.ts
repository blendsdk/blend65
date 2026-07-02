/**
 * Specification tests for the C64 platform plugin — ST-C64-1..10
 * (07-testing-strategy.md, derived from 03-02-c64-plugin-and-hooks.md + the
 * frozen appendix-c64 + the verified `printInstr` rendering rules).
 *
 * 🚨 IMMUTABLE ORACLE RULE (testing.md Rule 10): the golden ACME strings below
 * are derived **purely** from each hook's documented `StreamEntry`/`AcmeDirective`
 * values (03-02) + `printInstr`'s documented rendering — NOT by running
 * `emitPreamble`. Written BEFORE `c64.ts` exists; verified RED first.
 */

import { describe, expect, it } from "vitest";
import { printInstr } from "@blend65/codegen";

import { c64Plugin } from "./c64.js";

describe("C64 plugin — getOutputDirective (ST-C64-1)", () => {
  it("returns the cbm PRG output-file directive", () => {
    expect(c64Plugin.getOutputDirective("main")).toEqual({
      kind: "outputFile",
      name: "main.prg",
      format: "cbm",
    });
  });
});

describe("C64 plugin — emitPreamble goldens (ST-C64-2/3/4)", () => {
  it("terminating shim preamble renders the exact ACME text — ST-C64-2", () => {
    const text = printInstr({
      symbol: "_pre",
      segment: "code",
      entries: c64Plugin.emitPreamble({
        projectName: "main",
        shimVariant: "terminating",
        needsBssZero: false,
        needsDataInit: false,
      }),
    });
    expect(text).toBe(
      [
        `!to "main.prg", cbm`,
        `* = $0801`,
        `    !word $080B`,
        `    !word $000A`,
        `    !byte $9E`,
        `    !text "2061"`,
        `    !byte $00`,
        `    !word $0000`,
        `__startup:`,
        `    LDA #$36`,
        `    STA $01`,
        `    JSR _main`,
        `    LDA #$37`,
        `    STA $01`,
        `    RTS`,
      ].join("\n"),
    );
  });

  it("non-terminating shim ends with JMP _main, no RTS/restore — ST-C64-3", () => {
    const text = printInstr({
      symbol: "_pre",
      segment: "code",
      entries: c64Plugin.emitPreamble({
        projectName: "main",
        shimVariant: "non-terminating",
        needsBssZero: false,
        needsDataInit: false,
      }),
    });
    expect(text).toBe(
      [
        `!to "main.prg", cbm`,
        `* = $0801`,
        `    !word $080B`,
        `    !word $000A`,
        `    !byte $9E`,
        `    !text "2061"`,
        `    !byte $00`,
        `    !word $0000`,
        `__startup:`,
        `    LDA #$36`,
        `    STA $01`,
        `    JMP _main`,
      ].join("\n"),
    );
  });

  it("bare shim renders preamble head only — ST-C64-4", () => {
    const text = printInstr({
      symbol: "_pre",
      segment: "code",
      entries: c64Plugin.emitPreamble({
        projectName: "main",
        shimVariant: "bare",
        needsBssZero: false,
        needsDataInit: false,
      }),
    });
    expect(text).toBe(
      [
        `!to "main.prg", cbm`,
        `* = $0801`,
        `    !word $080B`,
        `    !word $000A`,
        `    !byte $9E`,
        `    !text "2061"`,
        `    !byte $00`,
        `    !word $0000`,
      ].join("\n"),
    );
  });
});

describe("C64 plugin — PETSCII encoding (ST-C64-5/6)", () => {
  it("encodeChar maps the §4.5 table cases — ST-C64-5", () => {
    expect(c64Plugin.encodeChar("A")).toBe(0x41);
    expect(c64Plugin.encodeChar("a")).toBe(0xc1);
    expect(c64Plugin.encodeChar("0")).toBe(0x30);
    expect(c64Plugin.encodeChar(" ")).toBe(0x20);
    expect(c64Plugin.encodeChar("\n")).toBe(0x0d);
  });

  it("encodeString encodes 'Hi' → [0x48, 0xC9] — ST-C64-6", () => {
    expect(c64Plugin.encodeString("Hi")).toEqual([0x48, 0xc9]);
  });
});

describe("C64 plugin — termination policy (ST-C64-7)", () => {
  it("main may return on C64", () => {
    expect(c64Plugin.getMainTerminationPolicy()).toEqual({ canReturn: true });
  });
});

describe("C64 plugin — validateProfile (ST-C64-8)", () => {
  it("returns [] for the internally consistent C64 profile", () => {
    expect(c64Plugin.validateProfile()).toEqual([]);
  });
});

describe("C64 plugin — profile fields (ST-C64-9)", () => {
  it("matches appendix-c64", () => {
    expect(c64Plugin.profile.codeStart).toBe(0x0801);
    expect(c64Plugin.profile.zpEnd).toBe(0x8f);
    expect(c64Plugin.profile.maxZp).toBe(142);
    expect(c64Plugin.profile.outputFormat).toBe("prg");
    expect(c64Plugin.profile.cpu).toBe("nmos6502");
    expect(c64Plugin.profile.defaultEncoding).toBe("petscii");
  });
});

describe("C64 plugin — intrinsics / runtimeModules (ST-C64-10)", () => {
  it("intrinsics is empty (T4 contributions arrive with future platform work)", () => {
    expect(c64Plugin.intrinsics).toEqual([]);
  });

  // DELIBERATE ORACLE UPDATE (RD-17 Phase 4, AR-98): the mul/div operator-backing
  // routines migrated to codegen-owned T3 modules (`@blend65/codegen/runtime/*.asm`)
  // — they were never platform contributions. `runtimeModules` now carries only
  // genuine T4 platform modules, of which the c64 has none yet.
  it("runtimeModules is empty (mul/div are codegen-owned T3 — AR-98)", () => {
    expect(c64Plugin.runtimeModules).toEqual([]);
  });
});
