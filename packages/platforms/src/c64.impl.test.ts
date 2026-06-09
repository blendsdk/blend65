/**
 * Implementation tests for the C64 plugin (written AFTER `c64.ts`).
 *
 * Covers behaviour beyond the spec-test oracle: PETSCII encode edge cases
 * (empty string, boundary letters/digits, non-table pass-through, upper-range
 * lower-case) and the `needsBssZero`/`needsDataInit` preamble flags (which are
 * the RD-09 seam — they must not alter the emitted stream in this slice).
 */

import { describe, expect, it } from "vitest";

import { c64Plugin } from "./c64.js";

describe("C64 encodeString — edge cases", () => {
  it("encodes the empty string to []", () => {
    expect(c64Plugin.encodeString("")).toEqual([]);
  });

  it("encodes a full alphanumeric mix", () => {
    // "Az9 " → A=$41, z=$7A+$60=$DA, 9=$39, space=$20
    expect(c64Plugin.encodeString("Az9 ")).toEqual([0x41, 0xda, 0x39, 0x20]);
  });
});

describe("C64 encodeChar — boundaries & pass-through", () => {
  it("maps the upper-case range boundaries", () => {
    expect(c64Plugin.encodeChar("Z")).toBe(0x5a);
  });

  it("maps the lower-case range boundaries (offset +$60)", () => {
    expect(c64Plugin.encodeChar("z")).toBe(0xda);
  });

  it("maps digit boundaries", () => {
    expect(c64Plugin.encodeChar("0")).toBe(0x30);
    expect(c64Plugin.encodeChar("9")).toBe(0x39);
  });

  it("passes through a non-table character unchanged", () => {
    // '!' (0x21) is outside every mapped range → verbatim
    expect(c64Plugin.encodeChar("!")).toBe(0x21);
  });
});

describe("C64 emitPreamble — needsBssZero/needsDataInit flags (RD-09 seam)", () => {
  it("the flags do not change the emitted stream in this slice", () => {
    const base = c64Plugin.emitPreamble({
      projectName: "main",
      shimVariant: "terminating",
      needsBssZero: false,
      needsDataInit: false,
    });
    const flagged = c64Plugin.emitPreamble({
      projectName: "main",
      shimVariant: "terminating",
      needsBssZero: true,
      needsDataInit: true,
    });
    expect(flagged).toEqual(base);
  });
});

describe("C64 emitStartupShim — bare variant", () => {
  it("emits no entries", () => {
    expect(c64Plugin.emitStartupShim("bare")).toEqual([]);
  });
});
