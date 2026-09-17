/** Locate a lone UTF-16 surrogate before an encoder could replace it with U+FFFD. */
export function firstUnpairedSurrogate(text: string): string | null {
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return text[index]!;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return text[index]!;
    }
  }
  return null;
}

/**
 * Convert a raw UTF-8 boundary to zero-based LSP line/UTF-16 coordinates.
 * CRLF is one break; its intermediate boundary maps to the previous content end.
 * A BOM remains part of the raw text. No input is normalized.
 * @throws RangeError for ill-formed text, noninteger/out-of-range or mid-scalar offsets.
 * @example byteOffsetToPosition("Aé🎮", 7) // { line: 0, character: 4 }
 */
export function byteOffsetToPosition(
  text: string,
  offset: number,
): {
  /** Zero-based line, treating CRLF as one break. */
  readonly line: number;
  /** Zero-based UTF-16 offset within line content. */
  readonly character: number;
} {
  if (!Number.isInteger(offset) || offset < 0 || firstUnpairedSurrogate(text) !== null) {
    throw new RangeError("Expected a valid UTF-8 byte boundary");
  }
  let bytes = 0;
  let line = 0;
  let character = 0;
  for (let index = 0; index < text.length; ) {
    if (bytes === offset) return { line, character };
    const scalar = String.fromCodePoint(text.codePointAt(index)!);
    const width = Buffer.byteLength(scalar);
    if (scalar === "\r" && text[index + 1] === "\n") {
      if (offset === bytes + 1) return { line, character };
      bytes += 2;
      index += 2;
      line += 1;
      character = 0;
      continue;
    }
    if (offset > bytes && offset < bytes + width) {
      throw new RangeError("Offset is inside a UTF-8 scalar");
    }
    bytes += width;
    index += scalar.length;
    if (scalar === "\r" || scalar === "\n") {
      line += 1;
      character = 0;
    } else {
      character += scalar.length;
    }
  }
  if (bytes === offset) return { line, character };
  throw new RangeError("Offset is outside the input");
}

/**
 * Map JSONC's UTF-16 offsets to raw-byte bounds in linear time.
 * Parser recovery may identify one half of an astral scalar; widen such spans
 * rather than exposing a byte boundary that splits a UTF-8 sequence.
 */
export function utf16ByteBounds(text: string): {
  /** Raw-byte starts, widened toward the start of a split scalar. */
  readonly starts: Uint32Array;
  /** Raw-byte ends, widened toward the end of a split scalar. */
  readonly ends: Uint32Array;
} {
  const starts = new Uint32Array(text.length + 1);
  const ends = new Uint32Array(text.length + 1);
  let bytes = 0;
  for (let index = 0; index < text.length; ) {
    const scalar = String.fromCodePoint(text.codePointAt(index)!);
    starts[index] = bytes;
    ends[index] = bytes;
    if (scalar.length === 2) {
      starts[index + 1] = bytes;
      ends[index + 1] = bytes + 4;
    }
    bytes += Buffer.byteLength(scalar);
    index += scalar.length;
    starts[index] = bytes;
    ends[index] = bytes;
  }
  return { starts, ends };
}
