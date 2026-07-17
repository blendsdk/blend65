/**
 * Specification tests for the literal escape decoder.
 *
 * Oracles derive from the frozen spec's escape semantics (Ch 01 §7.2, with
 * the backslash escape pinned to byte $5C): decoding raw inter-quote text
 * yields a segment list where hex/NUL/backslash escapes are raw bytes that
 * bypass any character encoder, and everything else is a Unicode code point
 * that resolves through one. Never derived from the implementation.
 */

import { describe, expect, it } from "vitest";

import { decodeLiteral } from "./literal-decode.js";

describe("Specification: escape decoding into code-point and raw-byte segments", () => {
  it("decodes hex, NUL, and backslash escapes as raw bytes between plain code points", () => {
    expect(decodeLiteral("H\\xFF\\0\\\\I")).toEqual([
      { kind: "codePoint", cp: 0x48 },
      { kind: "rawByte", value: 0xff },
      { kind: "rawByte", value: 0x00 },
      { kind: "rawByte", value: 0x5c },
      { kind: "codePoint", cp: 0x49 },
    ]);
  });

  it("decodes the newline escape as the LF code point", () => {
    expect(decodeLiteral("\\n")).toEqual([{ kind: "codePoint", cp: 0x0a }]);
  });

  it("decodes the carriage-return escape as the CR code point", () => {
    expect(decodeLiteral("\\r")).toEqual([{ kind: "codePoint", cp: 0x0d }]);
  });

  it("decodes the tab escape as the TAB code point", () => {
    expect(decodeLiteral("\\t")).toEqual([{ kind: "codePoint", cp: 0x09 }]);
  });

  it("decodes the quote escapes as the quote code points", () => {
    expect(decodeLiteral('\\"')).toEqual([{ kind: "codePoint", cp: 0x22 }]);
    expect(decodeLiteral("\\'")).toEqual([{ kind: "codePoint", cp: 0x27 }]);
  });

  it("decodes an astral character as one code-point segment, never surrogate halves", () => {
    expect(decodeLiteral("💾")).toEqual([{ kind: "codePoint", cp: 0x1f4be }]);
  });
});
