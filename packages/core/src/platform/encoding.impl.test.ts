/**
 * Implementation tests for the core character encoders: the narrowed
 * passthrough tail and exact boundary code points. The specification suite
 * pins the mapped table; these tests pin the edges of the unmappable region.
 */

import { describe, expect, it } from "vitest";

import { encoderFor } from "./index.js";

describe("PETSCII passthrough-tail narrowing", () => {
  const petscii = encoderFor("petscii");

  it("maps the boundary code points $20 and $7E, rejects $1F and $7F", () => {
    expect(petscii.encodeCodePoint(0x1f)).toBeNull();
    expect(petscii.encodeCodePoint(0x20)).toBe(0x20);
    expect(petscii.encodeCodePoint(0x7e)).toBe(0x7e);
    expect(petscii.encodeCodePoint(0x7f)).toBeNull();
  });

  it("rejects the high-half code points the old passthrough leaked", () => {
    expect(petscii.encodeCodePoint(0x80)).toBeNull();
    expect(petscii.encodeCodePoint(0xa0)).toBeNull();
    expect(petscii.encodeCodePoint(0xff)).toBeNull();
  });

  it("keeps the shifted lowercase range inside the letter band", () => {
    expect(petscii.encodeCodePoint(0x61)).toBe(0xc1);
    expect(petscii.encodeCodePoint(0x7a)).toBe(0xda);
  });
});

describe("ATASCII and ASCII boundary code points", () => {
  it("atascii maps $20/$7C, rejects $1F/$7F and its four missing printables", () => {
    const atascii = encoderFor("atascii");
    expect(atascii.encodeCodePoint(0x1f)).toBeNull();
    expect(atascii.encodeCodePoint(0x20)).toBe(0x20);
    expect(atascii.encodeCodePoint(0x7c)).toBe(0x7c);
    expect(atascii.encodeCodePoint(0x7f)).toBeNull();
  });

  it("ascii rejects the control region outside LF/CR/TAB", () => {
    const ascii = encoderFor("ascii");
    expect(ascii.encodeCodePoint(0x00)).toBeNull();
    expect(ascii.encodeCodePoint(0x08)).toBeNull();
    expect(ascii.encodeCodePoint(0x0b)).toBeNull();
    expect(ascii.encodeCodePoint(0x1f)).toBeNull();
    expect(ascii.encodeCodePoint(0x7f)).toBeNull();
  });
});

describe("raw default equivalence with the ASCII encoder", () => {
  it("produces identical results across the single-byte domain", () => {
    const raw = encoderFor(undefined);
    const ascii = encoderFor("ascii");
    for (let cp = 0; cp <= 0xff; cp++) {
      expect(raw.encodeCodePoint(cp)).toBe(ascii.encodeCodePoint(cp));
    }
  });
});
