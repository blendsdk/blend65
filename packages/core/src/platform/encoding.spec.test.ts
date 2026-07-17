/**
 * Specification tests for the core character encoders.
 *
 * Byte oracles derive from the frozen spec (Ch 01 §7.2 escape semantics,
 * Ch 15 §3.2 platform encodings) — never from running the implementation.
 * Every encoder is fallible: it maps a Unicode code point to one target
 * byte or returns null when the code point has no representation.
 */

import { describe, expect, it } from "vitest";

import { encoderFor } from "./index.js";

/** The first code point of a one-character string. */
function cp(char: string): number {
  const value = char.codePointAt(0);
  if (value === undefined) throw new Error("empty test character");
  return value;
}

const LF = 0x0a;
const CR = 0x0d;
const TAB = 0x09;

describe("Specification: PETSCII encoder", () => {
  const petscii = encoderFor("petscii");

  it("maps letters, digits, and space per the PETSCII table", () => {
    expect(petscii.encodeCodePoint(cp("A"))).toBe(0x41);
    expect(petscii.encodeCodePoint(cp("a"))).toBe(0xc1);
    expect(petscii.encodeCodePoint(cp("1"))).toBe(0x31);
    expect(petscii.encodeCodePoint(cp(" "))).toBe(0x20);
  });

  it("maps LF and CR to PETSCII carriage return $0D and TAB to $09", () => {
    expect(petscii.encodeCodePoint(LF)).toBe(0x0d);
    expect(petscii.encodeCodePoint(CR)).toBe(0x0d);
    expect(petscii.encodeCodePoint(TAB)).toBe(0x09);
  });

  it("passes printable ASCII punctuation through unchanged", () => {
    expect(petscii.encodeCodePoint(cp("!"))).toBe(0x21);
    expect(petscii.encodeCodePoint(cp("@"))).toBe(0x40);
  });
});

describe("Specification: ATASCII encoder", () => {
  const atascii = encoderFor("atascii");

  it("maps printable ASCII identically, including lowercase", () => {
    expect(atascii.encodeCodePoint(cp("A"))).toBe(0x41);
    expect(atascii.encodeCodePoint(cp("z"))).toBe(0x7a);
  });

  it("maps LF and CR to the ATASCII end-of-line byte $9B", () => {
    expect(atascii.encodeCodePoint(LF)).toBe(0x9b);
    expect(atascii.encodeCodePoint(CR)).toBe(0x9b);
  });

  it("reports TAB and the non-ATASCII printables as unmappable", () => {
    expect(atascii.encodeCodePoint(TAB)).toBeNull();
    expect(atascii.encodeCodePoint(cp("`"))).toBeNull();
    expect(atascii.encodeCodePoint(cp("{"))).toBeNull();
    expect(atascii.encodeCodePoint(cp("}"))).toBeNull();
    expect(atascii.encodeCodePoint(cp("~"))).toBeNull();
  });
});

describe("Specification: ASCII encoder", () => {
  const ascii = encoderFor("ascii");

  it("maps printable ASCII identically", () => {
    expect(ascii.encodeCodePoint(cp("A"))).toBe(0x41);
    expect(ascii.encodeCodePoint(cp("~"))).toBe(0x7e);
  });

  it("maps LF to $0A, CR to $0D, and TAB to $09", () => {
    expect(ascii.encodeCodePoint(LF)).toBe(0x0a);
    expect(ascii.encodeCodePoint(CR)).toBe(0x0d);
    expect(ascii.encodeCodePoint(TAB)).toBe(0x09);
  });

  it("reports code point $80 as unmappable", () => {
    expect(ascii.encodeCodePoint(0x80)).toBeNull();
  });
});

describe("Specification: unmappable code points across every encoder", () => {
  const encoders = [
    encoderFor("petscii"),
    encoderFor("atascii"),
    encoderFor("ascii"),
    encoderFor(undefined),
  ];

  it("reports every code point above $FF as unmappable", () => {
    for (const encoder of encoders) {
      expect(encoder.encodeCodePoint(0x100)).toBeNull();
      expect(encoder.encodeCodePoint(cp("💾"))).toBeNull();
    }
  });

  it("raw default: printable ASCII maps identically, everything else is unmappable", () => {
    const raw = encoderFor(undefined);
    expect(raw.encodeCodePoint(cp("A"))).toBe(0x41);
    expect(raw.encodeCodePoint(cp("é"))).toBeNull();
  });
});

describe("Specification: encoder selection by profile encoding", () => {
  it("an absent profile encoding selects the raw encoder", () => {
    expect(encoderFor(undefined).name).toBe("raw");
  });

  it("each named profile encoding selects the encoder of that name", () => {
    expect(encoderFor("petscii").name).toBe("petscii");
    expect(encoderFor("atascii").name).toBe("atascii");
    expect(encoderFor("ascii").name).toBe("ascii");
  });
});
