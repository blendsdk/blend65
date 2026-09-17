import { describe, expect, it } from "vitest";
import { byteOffsetToPosition } from "../index.js";

describe("UTF-8 diagnostic offsets to host positions", () => {
  // Byte boundaries must become UTF-16 columns, including the two code units of an astral scalar.
  it.each([
    { text: "", offset: 0, line: 0, character: 0 },
    { text: "abc", offset: 0, line: 0, character: 0 },
    { text: "abc", offset: 3, line: 0, character: 3 },
    { text: "Aé🎮Z", offset: 1, line: 0, character: 1 },
    { text: "Aé🎮Z", offset: 3, line: 0, character: 2 },
    { text: "Aé🎮Z", offset: 7, line: 0, character: 4 },
    { text: "Aé🎮Z", offset: 8, line: 0, character: 5 },
    { text: "\ufeffé🎮x", offset: 3, line: 0, character: 1 },
    { text: "\ufeffé🎮x", offset: 9, line: 0, character: 4 },
    { text: "a\né🎮z", offset: 2, line: 1, character: 0 },
    { text: "a\né🎮z", offset: 8, line: 1, character: 3 },
    { text: "a\r\né🎮z", offset: 3, line: 1, character: 0 },
    { text: "a\r\né🎮z", offset: 2, line: 0, character: 1 },
    { text: "a\r\né🎮z", offset: 9, line: 1, character: 3 },
    { text: "a\ré🎮z", offset: 2, line: 1, character: 0 },
    { text: "a\ré🎮z", offset: 8, line: 1, character: 3 },
    { text: "a\r\nb\rc\nd", offset: 7, line: 3, character: 0 },
  ])(
    "should convert byte $offset in $text to line $line character $character",
    ({ text, offset, line, character }) => {
      expect(byteOffsetToPosition(text, offset)).toEqual({ line, character });
    },
  );

  // Invalid programmer offsets are rejected instead of clamped or rounded into another scalar.
  it.each([-1, 9, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 2, 4, 5, 6])(
    "should reject invalid or mid-scalar byte offset %s",
    (offset) => {
      expect(() => byteOffsetToPosition("Aé🎮Z", offset)).toThrow(RangeError);
    },
  );
});
