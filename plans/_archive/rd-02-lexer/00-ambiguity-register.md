# RD-02 Lexer — Ambiguity Register

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Purpose**: Plan-level Zero-Ambiguity Gate. Every decision in the RD-02 lexer plan that
> is *not* already fixed by the frozen `spec/` or by `requirements/RD-02-lexer.md` is
> recorded here, with its resolution, before any document or code depends on it.

## Scope of this register

RD-02 (`requirements/RD-02-lexer.md`) was authored **2026-05-31**, *before* the RD-11a
diagnostics core was actually built and frozen (2026-06-02). Several illustrative type
signatures in RD-02 therefore predate — and do not match — the as-built `@blend65/core`
API. The entries below (`AR-L1`..`AR-L6`) reconcile RD-02's intent with the **frozen**
core, so that:

- the frozen `spec/` is never touched (decision D3), and
- the frozen RD-11a code is **extended, never refactored** (AR-Q2 of the RD-11a plan).

All six were reviewed with the user and confirmed before authoring.

---

## AR-L1 — `LineMap` API: use the as-built core type

| | |
|---|---|
| **Question** | RD-02 §4.8 sketches `LineMap` with `getLineAndColumn()`, a public `lineStarts[]`, and `getUtf16Column(offset, sourceText)`. The frozen core ships a different shape. Which wins? |
| **Frozen core (RD-11a)** | `new LineMap(sourceId, text)` with `getLineCol(offset): { line, column }`, `getUtf16Column(offset): number` (LineMap holds its own text), `getLineText(offset): string`. |
| **Resolution** | **Use the as-built core `LineMap` verbatim.** `lex()` builds it with `new LineMap(sourceId, text)` and returns it in `LexResult`. RD-02's signatures are treated as superseded illustration, not contract. |
| **Why this is best** | D3 freezes `spec/`; AR-Q2 forbids refactoring RD-11a. There is no competing option — the core type already exists, is tested, and is exported. |
| **Impact** | `03-01`, `03-02`. No core change. |

## AR-L2 — `LineMap` construction: once, from full text

| | |
|---|---|
| **Question** | RD-02 §4.8 says the lexer builds the `LineMap` *incrementally* during the whitespace pass. The frozen `LineMap` computes line-starts in its constructor. |
| **Resolution** | **Construct the `LineMap` once** via `new LineMap(sourceId, text)` after (or before) tokenizing; do **not** build it incrementally inside the scan loop. |
| **Why this is best** | The constructor already derives line-starts from the full text (LF/CRLF/CR + BOM). Re-deriving them incrementally would duplicate frozen logic for zero benefit on a modern host. Identical result, less code, no core change. |
| **Impact** | `03-02` (algorithm), `07` (tests assert identical line/col either way). |

## AR-L3 — `Token` carries a `SourceSpan` (not flat fields)

| | |
|---|---|
| **Question** | RD-02 §4.2 shows `Token` with flat `{ source: SourceId, start, end }`. The core span model is `SourceSpan { sourceId, start, end }`. |
| **Resolution** | **`Token` embeds a `SourceSpan`** as `token.span`. The lexeme is recovered lazily via `text.slice(token.span.start, token.span.end)`. |
| **Alternatives rejected** | (a) Flat `{ source, start, end }` as the doc shows — forces re-wrapping a `SourceSpan` at every `bag.addError` site. (b) Stream-level `sourceId` + per-token `{start,end}` to save one field — irrelevant micro-optimization on a modern host; breaks the clean "pass the span" ergonomics. |
| **Why this is best** | A token drops straight into `bag.addError(code, token.span, …)` with zero re-construction, and stays consistent with the one span model the whole compiler shares. |
| **Impact** | `03-01` (Token shape), `03-02`, `03-03`. |

## AR-L4 — Token vocabulary in `@blend65/core`; lexer logic in `@blend65/frontend`

| | |
|---|---|
| **Question** | RD-02 §4.1 says `TokenKind`/`Token` are "exported from `@blend65/core`"; §4.3 shows `KEYWORD_MAP` beside the lexer. Where does each piece live? |
| **Resolution** | Split by **data vs. logic**: <br>• **core** owns the *vocabulary*: `TokenKind` and `Token` (a new `packages/core/src/tokens/` module). `Token` embeds the core `SourceSpan`, so locality is natural. <br>• **frontend** owns the *logic*: `KEYWORD_MAP`, `lex()`, `LexResult`, and all scanners. |
| **Corrected rationale** | RD-02's stated reason for putting tokens in core — "so `codegen` can reference them" — is **weak**: codegen consumes IL, never tokens. The real justifications are (1) span-locality (Token embeds the core `SourceSpan`) and (2) a single shared token vocabulary for **frontend** *and* **language-server** (which, per R15, must never import codegen). This corrected rationale is recorded rather than the doc's. |
| **Why this is best** | Keeps `@blend65/core` as the dependency-free vocabulary layer (R15/AR-20 intact), and keeps `KEYWORD_MAP`/scanners — pure lexer logic — out of the shared core. |
| **Impact** | `03-01` (core), `03-02` (frontend). |

## AR-L5 — Lexer diagnostic codes added to the single core registry

| | |
|---|---|
| **Question** | RD-02 needs E10210–E10224 + W10210. Where are they declared? |
| **Resolution** | **Add them to `packages/core/src/diagnostics/diagnostic-codes.ts`** — the one registry — as named `DiagCode` members. **Exception:** `E10212` (redeclare reserved built-in) is **deferred to RD-04** (semantic analyzer owns it; RD-02 §2 scopes it out), so it is *not* added by this plan. |
| **Why this is best** | That file's own docstring states the intent verbatim: *"When a future requirement (e.g. RD-02's lexer) needs a code, it is added here — the one registry."* Adding members is **extending**, not refactoring — AR-Q2 is satisfied. No scattering of literals across frontend. |
| **Codes added** | E10210, E10211, E10213, E10214, E10215, E10216, E10217, E10218, E10219, E10220, E10221, E10222, E10223, E10224 (errors) and W10210 (warning). |
| **Impact** | `03-03`, Phase 1 of `99`. Touches frozen-core *file* by **addition only**; the existing RD-11a entries are unchanged. |

## AR-L6 — `TokenKind` is a string-valued `const` map (not a numeric enum)

| | |
|---|---|
| **Question** | RD-02 §4.1 shows `TokenKind` as a numeric `enum` but calls the representation "implementation choice." Numeric enum, `const enum`, or string union? |
| **Resolution** | **String-valued `const` object + derived union**, mirroring the established core style: `export const TokenKind = { Number: "Number", … } as const;` with `export type TokenKindValue = (typeof TokenKind)[keyof typeof TokenKind];`. |
| **Why this is best** | (1) The AC list requires **golden token-list snapshots**; numeric enums serialize as integers — unreadable, brittle diffs. String values produce readable, stable golden files. (2) It matches the exact convention the diagnostics core already set for `DiagCode`/`Severity` (`const … as const` + derived string-union), so the core stays internally consistent. A numeric enum would be the worst choice on both counts. |
| **Impact** | `03-01` (definition), `07` (golden snapshots). |

---

## Surface-during-authoring rule

Discovery is **closed** for RD-02 (RD-02 §7 Open Questions: *None*). If authoring or
implementation surfaces a *new* ambiguity, **STOP**, add it here as the next `AR-L#`
(tagged `(runtime)`), resolve it with the user, back-propagate the resolution into the
affected plan documents, then resume. Do not fill gaps by guessing.
