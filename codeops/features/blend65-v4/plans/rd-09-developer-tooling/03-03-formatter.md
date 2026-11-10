# Canonical Formatter: RD-09 Developer Tooling

> **Document**: 03-03-formatter.md
> **Parent**: [Index](00-index.md)

## Overview

RD-09 adds one canonical full-document formatter. It is deterministic, idempotent, token-preserving,
and option-free. It is not a semantic rewriter, import organizer, or style framework.

## Architecture

### Current Architecture

The frontend lexer recognizes grammar tokens but skips comments and whitespace
(`packages/compiler/src/frontend/lexer.ts:420-470`). The parser produces `SyntaxUnit` records but
does not retain trivia. There is no formatter today.

### Proposed Changes

Add `packages/compiler/src/frontend/formatter.ts` with a small trivia-preserving scanner used only
by formatting. The scanner reuses the language's lexical categories but returns comments and
whitespace as trivia. The formatter builds a token/trivia stream and re-emits canonical text.

If the scanner encounters an unrecognized construct, or the caller supplies a document with a
syntax diagnostic, formatting returns `null` and the editor leaves the document unchanged.

## Implementation Details

### New Types

```ts
/** One lexical item retained for canonical formatting. */
export type FormatItem =
  | {
      readonly kind: "token";
      readonly tokenKind: "identifier" | "keyword" | "number" | "string" | "char" | "operator";
      readonly text: string;
    }
  | { readonly kind: "line-comment"; readonly text: string }
  | { readonly kind: "block-comment"; readonly text: string }
  | { readonly kind: "blank-line" };

/** Formatting result or a documented refusal. */
export type FormatResult =
  | { readonly kind: "formatted"; readonly text: string }
  | { readonly kind: "unsupported"; readonly reason: string };

/** Format one complete document. */
export function formatBlend65(sourceText: string): FormatResult;
```

The scanner recognizes:

- line comments `//` through end of line;
- block comments `/* ... */` (unterminated input is unsupported);
- double-quoted strings and single-quoted character literals, preserving escape spelling;
- decimal/`$`/`0x`/`0b` numbers with underscores;
- ASCII identifiers and keywords;
- the operator/punctuation set from `TokenKind`, longest match first;
- LF, CRLF, and tabs as trivia.

### Formatting Rules

| Construct | Rule |
| --------- | ---- |
| Indent | Four spaces per brace depth |
| Line endings | LF |
| Blank lines | Preserve at most one blank line between top-level items; drop elsewhere |
| `;` | End the line unless inside parentheses (for-loop header) |
| `{` | One space before; newline after; empty `{}` stays on one line |
| `}` | Newline before; newline after unless followed by `else`, `while` (do-while), `;`, `,`, `)` |
| `case` / `default` | One indent level less than the switch body; newline after `:` |
| `,` | No space before; one space after |
| `:` | No space before; one space after, except case labels |
| `.` / `(` / `[` | No space before; no space after |
| `)` / `]` | No space before |
| Binary operators | One space on both sides |
| Unary operators | No space after; determined by the previous significant token |
| Keywords and identifiers | One space between adjacent word-like tokens |
| Comments | Line comment keeps its line; block comment stays inline when it was inline, otherwise its own line |
| Trailing whitespace | Removed |
| Final newline | Exactly one |

The formatter does not reorder imports, rename anything, change literal spelling, change operator
precedence, or add/remove tokens. Comments are preserved verbatim except for indentation of a
comment that begins a line.

### Idempotence

Formatting an already formatted document must produce byte-identical text. The test suite runs the
formatter twice and compares bytes.

### Token Preservation

The test suite scans the original and formatted text with the same scanner, drops trivia, and
compares the token sequence (kind + exact text). This proves no non-trivia token was changed,
added, removed, or reordered.

### Invalid Input

The formatter is invoked only when the current analysis has no `PARSE_SYNTAX_ERROR` diagnostic.
The frontend function itself refuses on scanner failure (unterminated comment/string, unknown
character) with `{ kind: "unsupported", reason }`. The language server maps `unsupported` to `null`.

## Integration Points

- `packages/compiler/src/frontend/index.ts` exports `formatBlend65` and `FormatResult`.
- `packages/language-server/src/queries/formatting.ts` calls it and returns one full-document
  `TextEdit`, or `null`.
- No VS Code formatter extension, configuration section, or range formatter is added.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Syntax-invalid document | Return `unsupported`; server returns `null` | AR-19 |
| Unterminated comment/string | Return `unsupported` | AR-19 |
| Unknown character | Return `unsupported` | AR-19 |
| CRLF/mixed line endings | Normalize to LF; token comparison decodes values | AR-18 |
| Comment-only document | Preserve comments and final newline | AR-6 |
| Empty document | Return empty text | AR-6 |

## Testing Requirements

- Canonical output for representative complete documents: module/import, declarations, functions,
  control flow, switch, struct, enum, placement, zero-page, arrays, literals, comments.
- Idempotence byte equality on every fixture.
- Token-preservation comparison on every fixture.
- CRLF/LF, tabs, astral characters, and EOF.
- Invalid input returns `unsupported`.
- No formatter option surface or range mode exists.
