# Diagnostic Renderers: RD-11b

> **Document**: 03-03-diagnostic-renderers.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-11 R32–R35, R51, R52 · §3.7/§4.5 · AC-12, AC-13 · AR-76, AR-17, PF-007/PF-009/PF-010/PF-013 · presentation contract AR-105 (plan AR-Q8/Q9/Q10/Q14)

## Overview

Two pure renderers over the same policy-applied `Diagnostic[]` (R32 — renderers
never re-derive meaning): `renderTerminal` produces the Ch 14 §1 caret format
with conditional hand-rolled ANSI color; `renderJson` produces machine-readable
JSON with raw spans. Rendering lives in core but is *invoked* only by consumers
(CLI/LSP) — nothing in the compiler pipeline calls these (R37/AC-14).

## Architecture

### Proposed Changes

Three new files in `packages/core/src/diagnostics/`:

- `ansi.ts` — internal SGR constants (`RED`, `YELLOW`, `CYAN`, `BOLD`, `RESET`)
  + a `paint(text, ...codes)` helper. **Not exported** from the barrel — core
  keeps zero dependencies (PF-007: no chalk in core; chalk stays CLI-only).
- `render-terminal.ts` — `renderTerminal(diagnostics, sourceMap, { color })`.
- `render-json.ts` — `renderJson(diagnostics)`.

## Implementation Details

### Signatures (RD §4.5 verbatim)

```typescript
export function renderTerminal(
  diagnostics: readonly Diagnostic[],
  sourceMap: SourceMap,
  options: { color: boolean },
): string;

export function renderJson(diagnostics: readonly Diagnostic[]): string;
```

### Terminal format — per-diagnostic block (AR-Q8/Q14)

```
{severity}[{code}]: {message}
  --> {path}:{line}:{col}
   |
{n} | {sanitized line text}
   | {padding}{carets}
{secondary-span mini-blocks…}
   = note: {note}
   = help: {help}
```

Rules (each cites its source):

1. **Header** `{severity}[{code}]: {message}` — severity word from
   `d.severity`; a promoted warning renders `error[W10xxx]` with the code
   unchanged (AR-Q8).
2. **Location line** `  --> path:line:col` — path via `SourceMap.getPath`,
   line/col via `getLineMap(...).getLineCol(span.start)` (1-based, byte column;
   R35/PF-006).
3. **Gutter** — width = decimal digits of the line number, computed
   **per excerpt**: each mini-block (primary or secondary) derives its own
   width from its own line number — widths are never shared across sub-blocks
   (plan preflight PF-004). The bare `|` lines align to their excerpt's width; the
   `= note:`/`= help:` markers align to the **primary** excerpt's width. Line
   numbers, `-->`, `|`, `=` are the *gutter elements* (cyan when colored, AR-Q9).
4. **Excerpt** — `LineMap.getLineText(span.start)`, sanitized (see below).
5. **Caret line** — carets under the span: from the span-start column to
   `min(span.end, end of first line)` (multi-line spans underline only the
   first line, R33/PF-013); tabs render literally and count 1 byte each —
   byte-column caret math (R33/PF-007); an empty span renders **1** caret.
   **No trailing label** (AR-Q14 — carets only; the record has no primary label).
6. **Secondary spans** — each `LabeledSpan` renders as its own mini-block:
   `  --> path:line:col`, gutter, excerpt, caret line **with the label** after
   the carets (AR-Q8). Unresolvable secondary ids degrade to nothing (R51
   applies per-span).
7. **Notes/help** — `= note: {text}` per note, then `= help: {text}` if
   present, gutter-aligned (AR-Q8).
8. **Degradation (R51)** — `primarySpan === null` (span-less ICE) or
   `!sourceMap.has(span.sourceId)` (e.g. `CONFIG_SOURCE_ID = -2`, RD-16):
   render the header, notes, and help only — no `-->`, no excerpt — and never
   throw (RD-11 PF-009; degraded-path notes/help retention pinned by the
   AR-105 addendum). With no excerpt there is no gutter: `= note:`/`= help:`
   use a **fixed 3-space indent** — the R51 example below is normative
   (plan preflight PF-004).
9. **Composition** — blocks joined by one blank line; output ends with a
   trailing newline; empty input → empty string. **No summary footer** — the
   "N errors, M warnings" line is RD-15's (AR-Q8).

### Sanitization (R52, security-mandatory)

Echoed source lines strip C0 controls (except TAB `0x09`) and C1 controls
(`0x80–0x9F`) so a hostile source cannot inject terminal escapes (PF-010).
**Caret columns are computed against the sanitized line**: bytes stripped
before the span start don't count toward the caret indent, keeping alignment
correct. Message/note/help strings pass through unmodified — they are
compiler-authored, not source-echoed (R52's scope is *echoed source excerpts*).

### Color (AR-Q9, AR-17)

Applied only when `options.color === true`; `false` yields byte-identical
uncolored output (golden-locked both ways):

| Element | SGR |
| ------- | --- |
| `error[code]` header prefix | bold red |
| `warning[code]` header prefix | bold yellow |
| Caret run + secondary-span label | severity color (no bold) |
| Gutter (`-->`, line numbers, `\|`, `=`) | cyan |
| Message, path, excerpt, note/help text | uncolored |

### JSON format (AR-Q10)

Top-level **array**; each element mirrors the `Diagnostic` record exactly:
`{ code, severity, message, primarySpan, secondarySpans, notes, help? }` —
`help` omitted when absent; spans emitted **raw/verbatim** including
unresolvable ids (R51 — the JSON renderer never resolves paths, hence no
`sourceMap` parameter, §4.5). Serialized with `JSON.stringify(value, null, 2)`
plus a trailing newline. Order is the caller's (policy-applied, already
deterministic per R18).

## Code Examples

Ch 14 §1 reproduction (ST-12 golden, uncolored):

```
error[E10042]: 'poke()' expects 2 arguments — found 3
  --> player.blend:42:5
   |
42 |     poke($D020, 0, 1);
   |     ^^^^^^^^^^^^^^^^^
```

R51 degradation for a config diagnostic (sentinel source id):

```
error[E10243]: Invalid value for 'maxErrors': expected a positive integer
   = help: set "maxErrors" to a positive integer, e.g. 20
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Null primary span (ICE) | Header + notes/help only | R51/PF-009 |
| Unresolvable `sourceId` | Same degradation; JSON emits the raw span verbatim | R51, AR-Q10 |
| Span past end of line/file | `LineMap` clamps (shipped, total); caret run clamps to first-line end, min 1 caret | R33/PF-013 |
| Control chars in source | Stripped (TAB excepted); carets computed post-strip | R52/PF-010 |
| Empty diagnostics array | Empty string (no trailing newline) | AR-Q8 (composition) |

## Testing Requirements

- Spec tests ST-12..ST-21: `render-terminal.spec.test.ts` (golden blocks),
  `render-terminal.security.spec.test.ts` (R52 — mandatory security tier),
  `render-json.spec.test.ts`.
- Impl tests: gutter width at line ≥ 100, caret at EOF, empty span, CRLF
  sources, multi-byte UTF-8 in excerpts (byte-column carets), color/no-color
  byte-diff assertion.
