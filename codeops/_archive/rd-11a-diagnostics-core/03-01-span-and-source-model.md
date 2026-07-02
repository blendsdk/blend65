# Design: Span & Source Model

> **Document**: 03-01-span-and-source-model.md
> **Parent**: [Index](00-index.md)
> **Covers**: FR-1..FR-8, FR-20 · RD-11 §4.2 · AR-Q3/Q4/Q5/Q7

## Files

- `packages/core/src/diagnostics/source-span.ts` — `SourceId`, `SourceSpan`, `LabeledSpan`
- `packages/core/src/diagnostics/line-map.ts` — `LineMap`

## `source-span.ts`

```typescript
/** Index identifying a source file. Assigned by the (deferred) SourceMap registry. */
export type SourceId = number;

/**
 * A half-open byte range within a source file.
 * `start` is inclusive, `end` is exclusive; both are UTF-8 byte offsets.
 * No line/column is stored — those are derived on demand via LineMap (RD-11 AC-02).
 */
export interface SourceSpan {
  readonly sourceId: SourceId;
  readonly start: number;
  readonly end: number;
}

/** A secondary span carrying an explanatory label (used by multi-span diagnostics). */
export interface LabeledSpan {
  readonly span: SourceSpan;
  readonly label: string;
}

/** Convenience constructor (keeps call sites terse and offsets ordered). */
export function makeSpan(sourceId: SourceId, start: number, end: number): SourceSpan {
  return { sourceId, start, end: end < start ? start : end };
}
```

**Design notes**

- **Byte offsets, not code units.** Spans store UTF-8 byte offsets (RD-11 §4.2). This is
  what the lexer naturally produces while scanning bytes; UTF-16 conversion for LSP is a
  `LineMap` concern (FR-6).
- **`end` clamped to `>= start`** in `makeSpan` so a degenerate span can never invert; the
  raw `SourceSpan` interface still allows direct construction by trusted producers.
- All fields `readonly` — spans are value objects, freely shareable.

## `line-map.ts`

```typescript
import type { SourceId } from "./source-span.js";

/**
 * Converts byte offsets within one source file to human/LSP positions.
 * Built once per file (O(n)); lookups are O(log n) via binary search.
 */
export class LineMap {
  readonly sourceId: SourceId;
  private readonly text: string;
  /** Byte offset of the first character of each line. lineStarts[0] === 0. */
  private readonly lineStarts: readonly number[];
  /** UTF-8 byte length of the text (end sentinel for clamping). */
  private readonly byteLength: number;

  constructor(sourceId: SourceId, text: string);

  /** 1-based line, 1-based column measured in BYTES from the line start. */
  getLineCol(offset: number): { line: number; column: number };

  /** 0-based... no — 1-based line is via getLineCol; this returns the UTF-16
   *  code-unit column (0-based) of `offset` within its line, for LSP. */
  getUtf16Column(offset: number): number;

  /** The full text of the line containing `offset`, without its line terminator. */
  getLineText(offset: number): string;
}
```

### Construction algorithm (FR-4, FR-8, FR-20)

1. Store `sourceId` and `text`. Compute `byteLength` via `Buffer.byteLength(text, "utf8")`.
2. **BOM handling (FR-20):** if `text[0]` is `U+FEFF`, the BOM occupies byte offset 0..2.
   `LineMap` treats it as part of line 1 (column math counts from byte 0). The lexer skips
   the BOM for tokenization (RD-02 §4.10), but `LineMap` is given the raw text and must not
   crash or miscount; documented behavior: BOM is column 1 of line 1.
3. Walk the string by **byte offset** building `lineStarts`. Because offsets are bytes, the
   walk tracks a running byte cursor while iterating Unicode scalar values; each scalar
   contributes its UTF-8 byte length. A line terminator pushes the *next* byte offset into
   `lineStarts`.
4. **Line terminators (FR-8):** recognize `\n` (LF), `\r\n` (CRLF, consumed as one break),
   and bare `\r` (CR). `lineStarts[0] = 0` always.

### `getLineCol(offset)` (FR-5, AR-Q3)

1. Clamp `offset` into `[0, byteLength]`.
2. Binary-search `lineStarts` for the greatest entry `<= offset` → `lineIndex`.
3. `line = lineIndex + 1` (1-based). `column = offset - lineStarts[lineIndex] + 1` (1-based,
   in bytes). Returns `{ line, column }`.

### `getUtf16Column(offset)` (FR-6, AR-Q4)

1. Find the line start byte offset as above.
2. Convert both the line-start byte offset and `offset` to UTF-16 code-unit indices into
   `text` (a single forward pass over the line's scalars, accumulating `.length` of each
   character's UTF-16 representation). Return `utf16(offset) - utf16(lineStart)` — a
   **0-based** UTF-16 column, which is what LSP `Position.character` expects (RD-14 §4.4
   performs the 0-based line conversion; `LineMap` returns 1-based lines from `getLineCol`,
   and the LSP adapter subtracts 1).

> **Why 0-based here:** LSP positions are 0-based UTF-16. Keeping `getUtf16Column` 0-based
> means the RD-14 adapter is a trivial `{ line: getLineCol().line - 1, character:
> getUtf16Column() }`. This matches RD-11 §4.2's "UTF-16 column for LSP" intent (AR-Q4).

### `getLineText(offset)` (FR-7, AR-Q5)

1. Determine `lineIndex` as above; line spans bytes `[lineStarts[i], lineStarts[i+1])` (or
   `byteLength` for the last line).
2. Slice the corresponding substring from `text` (converting the byte bounds to code-unit
   bounds with the same forward-scan helper), strip a trailing `\n`, `\r\n`, or `\r`.
3. Return the line text.

## Edge Cases (enumerated for tests — see 07)

| Case                                   | Expected                                                            |
| -------------------------------------- | ------------------------------------------------------------------- |
| `offset = 0` on empty text             | `{ line: 1, column: 1 }`; `getLineText` = `""`                      |
| `offset` past end                      | clamped to `byteLength`; last line position                         |
| Offset exactly at a `lineStart`        | column 1 of that line                                               |
| CRLF newline                           | one line break; CR and LF do not produce a blank line               |
| Bare CR newline                        | recognized as a break (FR-8)                                        |
| Multi-byte char (é, 2 bytes) before    | byte column advances by 2; UTF-16 column advances by 1              |
| Astral char (😀, 4 bytes / 2 UTF-16)   | byte column +4; UTF-16 column +2 (surrogate pair)                   |
| Leading BOM                            | BOM is part of line 1; column 1 = BOM (FR-20)                       |
| Trailing newline at EOF                | a final empty line exists with its own `lineStart`                  |

## Traceability

| Element            | Requirement | Spec / AR              |
| ------------------ | ----------- | ---------------------- |
| `SourceId = number`| FR-1        | RD-11 §4.2; AR-Q7      |
| `SourceSpan`       | FR-2        | RD-11 §4.2 (R12)       |
| `LabeledSpan`      | FR-3        | RD-11 §4.1/§4.2 (R9)   |
| `LineMap` ctor     | FR-4        | RD-11 §4.2; RD-02 §4.8 |
| `getLineCol`       | FR-5        | RD-11 §4.2 (R14); AR-Q3 |
| `getUtf16Column`   | FR-6        | RD-11 §4.2 (R15); AR-Q4 |
| `getLineText`      | FR-7        | RD-11 §4.2; AR-Q5      |
| Line terminators   | FR-8        | Ch 01 §3.1; RD-02 R4   |
| BOM handling       | FR-20       | RD-02 §4.10            |
