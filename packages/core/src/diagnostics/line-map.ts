import type { SourceId } from "./source-span.js";

/**
 * Returns the number of UTF-8 bytes used to encode a single Unicode code point.
 *
 * Computed directly from the code-point value (rather than via Node's `Buffer`)
 * so `@blend65/core` stays free of any runtime/platform dependency and works in
 * browser-hosted tooling (e.g. the language server) as well as Node.
 *
 * Exported for package-internal byte-column math (the RD-11b terminal
 * renderer's caret alignment); not part of the public barrel surface.
 *
 * @param codePoint A Unicode scalar value (0..0x10FFFF).
 * @returns 1, 2, 3, or 4 — the UTF-8 byte length of that code point.
 */
export function utf8ByteLength(codePoint: number): number {
  if (codePoint <= 0x7f) return 1;
  if (codePoint <= 0x7ff) return 2;
  if (codePoint <= 0xffff) return 3;
  return 4;
}

/**
 * Converts byte offsets within one source file to human/LSP positions.
 *
 * Spans (see {@link SourceSpan}) store raw UTF-8 byte offsets. A `LineMap` is
 * built once per file (O(n) construction) and answers position queries cheaply:
 * line/column lookups are O(log n) via binary search over precomputed line
 * starts. UTF-16 conversions walk only within the relevant line.
 *
 * Three coordinate systems are involved and kept rigorously distinct:
 *  - **byte offset** — what spans store and what every method accepts as input.
 *  - **byte column** — 1-based column counted in bytes ({@link getLineCol}).
 *  - **UTF-16 code-unit column** — 0-based, what LSP `Position.character`
 *    expects ({@link getUtf16Column}).
 *
 * Covers RD-11 §4.2 (FR-4..FR-8, FR-20) · AR-Q3/Q4/Q5.
 */
export class LineMap {
  /** The file this map describes. */
  readonly sourceId: SourceId;

  /**
   * The raw source text, exactly as provided (including any leading BOM).
   * `protected` rather than `private` per project coding standard (code.md
   * Rule 13): internal to the class hierarchy, never part of the public API.
   */
  protected readonly text: string;

  /**
   * Byte offset of the first byte of each line. `lineStarts[0]` is always 0.
   * A line terminator pushes the byte offset of the *next* line.
   */
  protected readonly lineStarts: readonly number[];

  /**
   * UTF-16 code-unit index of the first character of each line, parallel to
   * {@link lineStarts}. Lets UTF-16 column math start from the line head without
   * re-scanning from byte 0.
   */
  protected readonly lineStartsUtf16: readonly number[];

  /** Total UTF-8 byte length of {@link text}; the clamp ceiling for offsets. */
  protected readonly byteLength: number;

  /**
   * Builds the line-start tables in a single pass over the source.
   *
   * The walk advances a byte cursor and a UTF-16 code-unit cursor in lock-step,
   * recognising the three line terminators required by FR-8: `\n` (LF),
   * `\r\n` (CRLF, consumed as a single break), and bare `\r` (CR). A leading
   * BOM (FR-20) is treated as ordinary content of line 1 — the map never
   * crashes or miscounts on it; the lexer is responsible for skipping the BOM
   * during tokenisation.
   *
   * @param sourceId The id of the file this map describes.
   * @param text The full source text, including any BOM and terminators.
   */
  constructor(sourceId: SourceId, text: string) {
    this.sourceId = sourceId;
    this.text = text;

    const lineStarts: number[] = [0];
    const lineStartsUtf16: number[] = [0];

    let byte = 0; // running UTF-8 byte offset
    let cu = 0; // running UTF-16 code-unit index

    while (cu < text.length) {
      // codePointAt yields the full scalar value, transparently combining a
      // surrogate pair into a single astral code point.
      const codePoint = text.codePointAt(cu) as number;
      const cuLen = codePoint > 0xffff ? 2 : 1; // surrogate pair vs BMP
      const bLen = utf8ByteLength(codePoint);

      if (codePoint === 0x0a) {
        // LF — line break after this byte.
        byte += bLen;
        cu += cuLen;
        lineStarts.push(byte);
        lineStartsUtf16.push(cu);
        continue;
      }

      if (codePoint === 0x0d) {
        // CR — may be a lone CR or the CR of a CRLF pair.
        byte += bLen;
        cu += cuLen;
        if (cu < text.length && text.charCodeAt(cu) === 0x0a) {
          // CRLF: consume the LF as part of the same single break (1 byte,
          // 1 code unit) so it does not start a spurious blank line.
          byte += 1;
          cu += 1;
        }
        lineStarts.push(byte);
        lineStartsUtf16.push(cu);
        continue;
      }

      byte += bLen;
      cu += cuLen;
    }

    this.lineStarts = lineStarts;
    this.lineStartsUtf16 = lineStartsUtf16;
    this.byteLength = byte;
  }

  /**
   * Clamps an arbitrary byte offset into the valid `[0, byteLength]` range.
   *
   * Out-of-range offsets are clamped rather than rejected so position queries
   * are total (never throw) — a hard requirement for diagnostics that may point
   * at synthesized or recovered locations (FR-5).
   */
  protected clamp(offset: number): number {
    if (offset < 0) return 0;
    if (offset > this.byteLength) return this.byteLength;
    return offset;
  }

  /**
   * Finds the index of the line containing `offset` (already clamped).
   *
   * Binary-searches {@link lineStarts} for the greatest entry `<= offset`.
   * Runs in O(log n) over the number of lines.
   */
  protected findLineIndex(offset: number): number {
    let lo = 0;
    let hi = this.lineStarts.length - 1;
    let ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.lineStarts[mid] <= offset) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans;
  }

  /**
   * Returns the 1-based line and 1-based **byte** column of a byte offset.
   *
   * The column is measured in bytes from the start of the line, matching the
   * offset units spans use. For a UTF-16 column (LSP), use
   * {@link getUtf16Column}. Offsets are clamped, so this never throws.
   *
   * @param offset A UTF-8 byte offset (clamped to `[0, byteLength]`).
   * @returns `{ line, column }`, both 1-based.
   */
  getLineCol(offset: number): { line: number; column: number } {
    const clamped = this.clamp(offset);
    const lineIndex = this.findLineIndex(clamped);
    return {
      line: lineIndex + 1,
      column: clamped - this.lineStarts[lineIndex] + 1,
    };
  }

  /**
   * Returns the **0-based** UTF-16 code-unit column of a byte offset.
   *
   * LSP `Position.character` is a 0-based count of UTF-16 code units from the
   * line start, so an offset at the start of a line returns 0. The RD-14 LSP
   * adapter pairs this with `getLineCol().line - 1` to form a full 0-based LSP
   * position. The conversion walks only the scalars between the line start and
   * `offset`, accumulating UTF-16 lengths (FR-6, AR-Q4).
   *
   * @param offset A UTF-8 byte offset (clamped to `[0, byteLength]`).
   * @returns The 0-based UTF-16 column within the offset's line.
   */
  getUtf16Column(offset: number): number {
    const clamped = this.clamp(offset);
    const lineIndex = this.findLineIndex(clamped);

    let byteCursor = this.lineStarts[lineIndex];
    let cu = this.lineStartsUtf16[lineIndex];
    const lineStartCu = cu;

    // Advance scalar-by-scalar until the byte cursor reaches the target offset.
    while (byteCursor < clamped && cu < this.text.length) {
      const codePoint = this.text.codePointAt(cu) as number;
      byteCursor += utf8ByteLength(codePoint);
      cu += codePoint > 0xffff ? 2 : 1;
    }

    return cu - lineStartCu;
  }

  /**
   * Returns the full text of the line containing `offset`, terminator stripped.
   *
   * The trailing `\n`, `\r\n`, or `\r` (if any) is removed so callers receive
   * just the line's visible content — useful for rendering a caret underneath a
   * diagnostic span (FR-7, AR-Q5). Offsets are clamped, so this never throws.
   *
   * @param offset A UTF-8 byte offset (clamped to `[0, byteLength]`).
   * @returns The line text without its line terminator.
   */
  getLineText(offset: number): string {
    const clamped = this.clamp(offset);
    const lineIndex = this.findLineIndex(clamped);

    const startCu = this.lineStartsUtf16[lineIndex];
    const endCu =
      lineIndex + 1 < this.lineStartsUtf16.length
        ? this.lineStartsUtf16[lineIndex + 1]
        : this.text.length;

    // Slice in UTF-16 code-unit space, then strip a single trailing terminator
    // (CRLF must be tested before lone CR/LF so it is removed as one unit).
    const raw = this.text.slice(startCu, endCu);
    return raw.replace(/(?:\r\n|\r|\n)$/, "");
  }
}
