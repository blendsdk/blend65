# Requirements: RD-11a Diagnostics Core

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-11](../../requirements/RD-11-diagnostics-reporting.md) — diagnostics-engine subset (see AR-Q1)

## Feature Overview

Build the **diagnostics core** in `@blend65/core`: the structured `Diagnostic` record, the
`SourceSpan`/`SourceId`/`LabeledSpan` span model, the `LineMap` byte-offset converter, the
`DiagnosticBag` accumulator, and the `E10xxx`/`W10xxx`/`E9xxxx` diagnostic-code namespace.
These are the cross-cutting types every later compiler phase produces into, and the
immediate prerequisite for the lexer (RD-02). They are built to RD-11's complete
specification — no stubs (AR-Q2).

## Functional Requirements

### Must Have

- [x] **FR-1** `SourceId` is `type SourceId = number` (RD-11 §4.2, R13; AR-Q7).
- [x] **FR-2** `SourceSpan { sourceId, start, end }` with byte offsets, `start` inclusive,
      `end` exclusive (RD-11 §4.2, R12).
- [x] **FR-3** `LabeledSpan { span, label }` (RD-11 §4.1/§4.2, R9).
- [x] **FR-4** `LineMap` constructed from `(sourceId, text)`; precomputes line-start byte
      offsets; `lineStarts[0] === 0` (RD-11 §4.2; RD-02 §4.8).
- [x] **FR-5** `LineMap.getLineCol(offset): { line, column }` — 1-based line and 1-based
      column (byte offset from line start) (RD-11 §4.2, R14; AR-Q3).
- [x] **FR-6** `LineMap.getUtf16Column(offset): number` — UTF-16 code-unit column for LSP,
      computed from the retained text (RD-11 §4.2, R15; AR-Q4; consumed by RD-14 §4.4).
- [x] **FR-7** `LineMap.getLineText(offset): string` — the source line text containing the
      offset, without its trailing newline (RD-11 §4.2; AR-Q5).
- [x] **FR-8** `LineMap` recognizes line breaks `LF`, `CR+LF`, and bare `CR` (RD-02 R4 —
      the lexer builds `LineMap`s and Ch 01 §3.1 defines all three as line terminators).
- [x] **FR-9** `Diagnostic { code, severity, message, primarySpan, secondarySpans, notes,
      help? }` exactly per RD-11 §4.1 (R4–R11); `severity` is `'error' | 'warning'` (R6);
      `primarySpan` may be `null` for ICEs (R8).
- [x] **FR-10** `DiagnosticOptions { secondarySpans?, notes?, help? }` (RD-11 §4.3).
- [x] **FR-11** `DiagnosticBag` with `addError`, `addWarning`, `addICE`, `hasErrors`,
      `getAll`, `getErrors`, `getWarnings`, `count`, `isErrorLimitReached` (RD-11 §4.3,
      R21; AR-Q6).
- [x] **FR-12** `createDiagnosticBag(options?: { maxErrors?: number })` factory; default
      `maxErrors` is 20 (RD-11 R20; Ch 14 §4).
- [x] **FR-13** Deterministic ordering from `getAll`/`getErrors`/`getWarnings`: by
      `sourceId`, then `start` offset, then `code` (RD-11 R18). `null` primary spans sort
      after all spanned diagnostics (deterministic tie-break defined in 03-02).
- [x] **FR-14** Duplicate suppression: a second diagnostic with the same
      `(code, sourceId, start)` triple is silently dropped (RD-11 R19).
- [x] **FR-15** `--max-errors`: after `maxErrors` error-severity diagnostics are accepted,
      further *errors* are rejected and one truncation diagnostic is appended; warnings are
      still accepted; `isErrorLimitReached()` returns `true` (RD-11 R20).
- [x] **FR-16** `addICE(code, span, message)` records an `E9xxxx` diagnostic with severity
      `'error'`; ICEs are **not** subject to the `--max-errors` cap (they indicate compiler
      bugs and must always surface) (RD-11 R2; 03-02 design note).
- [x] **FR-17** Diagnostic-code namespace constants for every code defined in Ch 14 §2–§3,
      grouped by area, plus the ICE band convention `E9xxxx` (RD-11 R1–R3, §3.1; Ch 14).
- [x] **FR-18** The bag never throws on `add*` — it accumulates (RD-11 R17; AR-15).
- [x] **FR-19** All new symbols are re-exported from `@blend65/core`'s public entry
      (`packages/core/src/index.ts`) (RD-11 §4.8, scoped to 11a).

### Should Have

- [x] **FR-20** `LineMap` handles a leading UTF-8 BOM transparently for column math (the
      lexer skips the BOM per RD-02 §4.10; `LineMap` must not miscount columns if given the
      raw text). Behavior defined in 03-01.

### Won't Have (Out of Scope — deferred to "11b", AR-Q1)

- `SourceMap` registry / interning (RD-11 §4.2) — built when a producer needs interning.
- `SeverityPolicy` + `applySeverityPolicy` (RD-11 §4.4).
- `renderTerminal` / `renderJson` diagnostic renderers (RD-11 §4.5).
- `ResourceReport`, `ZpAllocationEntry`, `renderReportTerminal`, `renderReportJson`
  (RD-11 §4.6–4.7) — depends on RD-05/RD-09 data.
- The lexer itself (`lex()`, token types) — RD-02.

## Technical Requirements

### Performance

- `LineMap` construction is O(n) in source length; lookups are O(log n) via binary search
  over `lineStarts` (RD-11 §4.2 intent — "computed once per file, reused").

### Compatibility

- ESM, NodeNext, ES2023, `strict` — consistent with the RD-01 toolchain (AR-P1).
- `@blend65/core` has **no** `@blend65/*` dependencies (RD-01 dependency graph).
- LSP-ready: byte-offset spans + on-demand UTF-16 conversion so RD-14 needs no rewrite
  (RD-11 R38, R15; RD-14 §4.4).

### Security

- Not applicable — pure in-process data structures, no I/O, no user-controlled execution
  paths. (`LineMap` does not read files; it is given text.)

## Scope Decisions

| Decision                         | Options Considered                         | Chosen                                   | Rationale                                              | AR Ref |
| -------------------------------- | ------------------------------------------ | ---------------------------------------- | ------------------------------------------------------ | ------ |
| Sequencing                       | RD-02-first / full-RD-11 / 11a-first hybrid | 11a-first hybrid                         | Infra-first purity for lexer deps; defer un-verifiable report | AR-Q1  |
| Completeness of built types      | full owner-spec / partial stubs            | full owner-spec, no stubs                | RD-11 must extend, never refactor                      | AR-Q2  |
| `LineMap` line/col API           | `getLineAndColumn` (RD-02) / `getLineCol` (RD-11) | `getLineCol`                       | RD-11 is the owning RD                                  | AR-Q3  |
| `getUtf16Column` signature       | with `sourceText` / offset-only            | offset-only (LineMap holds text)         | Matches RD-11/RD-14 call sites                          | AR-Q4  |
| `getLineText`                    | include now / defer                        | include now                              | Owner-mandated; cheap; avoids reshape                  | AR-Q5  |
| `DiagnosticBag` API              | `bag.add` (RD-02) / `addError`/`addWarning` (RD-11) | RD-11 owner API                  | RD-11 is the owning RD                                  | AR-Q6  |
| `SourceId` type                  | branded opaque / plain `number`            | plain `number`                           | Exactly RD-11 §4.2                                      | AR-Q7  |
| ICE vs max-errors                | capped / uncapped                          | ICEs uncapped                            | Compiler bugs must always surface (RD-11 R2)            | AR-Q6  |
| Commit mode                      | ask / auto / no-commit                     | no-commit                                | User directive                                          | AR-Q8  |

> **Traceability:** Every decision references the Ambiguity Register (`AR-Q#`) or a frozen
> spec / owning-RD requirement. See `00-ambiguity-register.md`.

## Acceptance Criteria

Mapped to RD-11's own acceptance criteria (the 11a-relevant subset):

1. [x] **AC-1** `Diagnostic` has `code`, `severity`, `message`, `primarySpan`,
   `secondarySpans`, `notes`, `help` (RD-11 AC-01).
2. [x] **AC-2** `SourceSpan` uses interned `SourceId` + byte offsets; no line/col stored
   (RD-11 AC-02).
3. [x] **AC-3** `LineMap` converts byte offsets to line/column and UTF-16 columns on
   demand; `getLineText` returns the containing line (RD-11 AC-03).
4. [x] **AC-4** `DiagnosticBag` accumulates without throwing; `hasErrors()` correct
   (RD-11 AC-04).
5. [x] **AC-5** Diagnostic ordering is deterministic: same input → same order (RD-11 AC-05).
6. [x] **AC-6** Duplicate diagnostics (same code + location) suppressed (RD-11 AC-06).
7. [x] **AC-7** `--max-errors` limits error count with a truncation message (RD-11 AC-07).
8. [x] **AC-8** User codes use `E10xxx`/`W10xxx`; ICE codes use `E9xxxx` — no overlap
   (RD-11 AC-10).
9. [x] **AC-9** All new symbols exported from `@blend65/core`; `yarn build`, `typecheck`,
   `lint`, `test` all green; `spec/` untouched.
10. [x] **AC-10** All decisions trace to an `AR-Q#`, an upstream `AR-NN`, a Ch 14 section,
    or an RD-11 requirement (RD-11 AC-21).
