import { describe, expect, it } from "vitest";
import { LineMap } from "./line-map.js";

/**
 * Implementation tests for {@link LineMap}.
 *
 * Covers FR-4..FR-8 and FR-20 via the enumerated edge cases in
 * 03-01-span-and-source-model.md and the spec test cases ST-2..ST-12 in
 * 07-testing-strategy.md. All inputs are deterministic literals; the multi-byte
 * and astral cases pin down the byte-vs-UTF-16 column distinction.
 */
describe("LineMap.getLineCol", () => {
  // Source: 07-testing-strategy.md — ST-2 (FR-5)
  it("should report line 1 column 1 at offset 0 (ST-2)", () => {
    const lm = new LineMap(0, "abc");
    expect(lm.getLineCol(0)).toEqual({ line: 1, column: 1 });
  });

  // Source: ST-3 (FR-5, FR-8)
  it("should report line 2 column 1 immediately after an LF (ST-3)", () => {
    const text = "ab\ncd";
    const offsetOfC = text.indexOf("c"); // byte offset == cu index (all ASCII)
    expect(lm(text).getLineCol(offsetOfC)).toEqual({ line: 2, column: 1 });
  });

  // Source: ST-4 (FR-8) — CRLF is a single break.
  it("should treat CRLF as one break (ST-4)", () => {
    const text = "a\r\nb";
    const offsetOfB = 3; // 'a'(0) '\r'(1) '\n'(2) 'b'(3)
    expect(lm(text).getLineCol(offsetOfB)).toEqual({ line: 2, column: 1 });
  });

  // Source: ST-5 (FR-8) — bare CR is a break.
  it("should treat a bare CR as a break (ST-5)", () => {
    const text = "a\rb";
    const offsetOfB = 2; // 'a'(0) '\r'(1) 'b'(2)
    expect(lm(text).getLineCol(offsetOfB)).toEqual({ line: 2, column: 1 });
  });

  // Source: ST-6 (FR-5) — multi-byte char advances byte column by 2.
  it("should advance the byte column by 2 across a 2-byte char (ST-6)", () => {
    // "é=2bytes": é is U+00E9 (2 UTF-8 bytes, 1 UTF-16 unit). '=' is the next.
    const lineMap = lm("é=2bytes");
    const byteOffsetOfEquals = 2; // é occupies bytes 0..1, '=' starts at byte 2
    expect(lineMap.getLineCol(byteOffsetOfEquals)).toEqual({ line: 1, column: 3 });
  });

  // Source: ST-10 (FR-5) — past end clamps, never throws.
  it("should clamp an offset past end to the last position (ST-10)", () => {
    const lineMap = lm("abc");
    expect(() => lineMap.getLineCol(9999)).not.toThrow();
    expect(lineMap.getLineCol(9999)).toEqual({ line: 1, column: 4 });
  });

  it("should clamp a negative offset to line 1 column 1", () => {
    expect(lm("abc").getLineCol(-5)).toEqual({ line: 1, column: 1 });
  });

  // Source: ST-12 (FR-4) — trailing LF makes a final empty line addressable.
  it("should expose a final empty line after a trailing LF (ST-12)", () => {
    const lineMap = lm("ab\n");
    // Offset 3 is past the LF: the start of the (empty) final line.
    expect(lineMap.getLineCol(3)).toEqual({ line: 2, column: 1 });
  });

  it("should report line 1 column 1 at offset 0 of empty text", () => {
    expect(lm("").getLineCol(0)).toEqual({ line: 1, column: 1 });
  });
});

describe("LineMap.getUtf16Column", () => {
  // Source: ST-8 (FR-6, AR-Q4) — 0-based; start of line is 0.
  it("should return 0 at the start of a line (ST-8)", () => {
    expect(lm("abc").getUtf16Column(0)).toBe(0);
  });

  // Source: ST-6 (FR-6) — é is 1 UTF-16 unit even though it is 2 bytes.
  it("should count the UTF-16 column as 1 after a 2-byte char (ST-6)", () => {
    const lineMap = lm("é=2bytes");
    expect(lineMap.getUtf16Column(2)).toBe(1); // '=' is the 2nd UTF-16 unit (index 1)
  });

  // Source: ST-7 (FR-6) — astral char is 2 UTF-16 units, 4 bytes.
  it("should account for surrogate pairs in the UTF-16 column (ST-7)", () => {
    // "😀x": 😀 is U+1F600 (4 UTF-8 bytes, 2 UTF-16 units). 'x' starts at byte 4.
    const lineMap = lm("😀x");
    expect(lineMap.getLineCol(4)).toEqual({ line: 1, column: 5 }); // byte column 5
    expect(lineMap.getUtf16Column(4)).toBe(2); // UTF-16 column 2 (surrogate pair)
  });

  it("should reset the UTF-16 column to 0 on a new line", () => {
    const text = "é\nx";
    // é = 2 bytes, '\n' = 1 byte → 'x' at byte offset 3, start of line 2.
    expect(lm(text).getUtf16Column(3)).toBe(0);
  });
});

describe("LineMap.getLineText", () => {
  // Source: ST-9 (FR-7) — terminator stripped for LF, CRLF, and CR.
  it("should return the line without an LF terminator (ST-9)", () => {
    expect(lm("hello\nworld").getLineText(0)).toBe("hello");
  });

  it("should strip a CRLF terminator as one unit (ST-9)", () => {
    expect(lm("hello\r\nworld").getLineText(0)).toBe("hello");
  });

  it("should strip a bare CR terminator (ST-9)", () => {
    expect(lm("hello\rworld").getLineText(0)).toBe("hello");
  });

  it("should return the last line (no terminator) for an offset within it", () => {
    const text = "a\nbc";
    expect(lm(text).getLineText(2)).toBe("bc");
  });

  it("should return an empty string for empty text", () => {
    expect(lm("").getLineText(0)).toBe("");
  });

  it("should return an empty string for the final empty line after a trailing LF", () => {
    expect(lm("ab\n").getLineText(3)).toBe("");
  });
});

describe("LineMap BOM handling (FR-20)", () => {
  // Source: ST-11 (FR-20) — leading BOM does not crash or shift the line.
  it("should keep a leading BOM on line 1 (ST-11)", () => {
    const bom = "\uFEFF"; // U+FEFF: 3 UTF-8 bytes, 1 UTF-16 unit
    const lineMap = lm(bom + "abc");
    const bomByteLen = 3;
    expect(() => lineMap.getLineCol(bomByteLen)).not.toThrow();
    expect(lineMap.getLineCol(bomByteLen).line).toBe(1);
  });

  it("should include the BOM in the first line's text", () => {
    const bom = "\uFEFF";
    expect(lm(bom + "abc").getLineText(0)).toBe(bom + "abc");
  });
});

/**
 * Small constructor helper to keep the test bodies terse. Always uses sourceId 0
 * since these tests never compare across files.
 */
function lm(text: string): LineMap {
  return new LineMap(0, text);
}
