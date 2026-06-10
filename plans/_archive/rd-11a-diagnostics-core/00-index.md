# RD-11a Diagnostics Core — Implementation Plan

> **Feature**: Build the diagnostics-engine *core* in `@blend65/core` — the span model, `LineMap`, structured `Diagnostic` record, accumulating `DiagnosticBag`, and the diagnostic-code namespace — fully per RD-11, as the prerequisite for the lexer (RD-02)
> **Status**: Implemented (all 5 phases green — 2026-06-02)
> **Created**: 2026-06-01
> **CodeOps Version**: (unstamped — no `codeops-mcp` dependency in this repo; consistent with RD-01)
> **Source**: [RD-11](../../requirements/RD-11-diagnostics-reporting.md) (scoped to the "11a" subset — see AR-Q1)

## Overview

This plan implements **RD-11a** — the subset of the RD-11 diagnostics engine that the
rest of the compiler frontend depends on. It is sequenced **ahead of RD-02 (the lexer)**
because the lexer is a *producer* of diagnostics and a *builder* of `LineMap`s: it cannot
be written, let alone tested, until those types exist. Per the user's "infra-first, no
shortcuts" decision (AR-Q1), we build the diagnostics core first, in its owning package,
to its complete specification.

The scope is deliberately the **data-model and accumulation layer** of RD-11: the
`SourceSpan`/`SourceId`/`LabeledSpan` span model (RD-11 §4.2), the `LineMap` byte-offset →
line/column/UTF-16 converter (RD-11 §4.2), the structured `Diagnostic` record (RD-11 §4.1),
the `DiagnosticBag` accumulator with its full deterministic ordering, deduplication, and
`--max-errors` semantics (RD-11 §4.3), and the `E10xxx`/`W10xxx`/`E9xxxx` code namespace
(RD-11 §3.1, Ch 14). Everything here is built **completely** — no stubs (AR-Q2) — so that
the eventual full RD-11 plan *extends* this work (adding `SourceMap`, `SeverityPolicy`,
renderers, and `ResourceReport`) without ever refactoring it.

The components RD-11 owns but the lexer does **not** need — the `SourceMap` registry,
the severity-policy layer, the terminal/JSON renderers, and the entire resource-reporter
(`ResourceReport`) — are explicitly **deferred to "11b"** (AR-Q1). The resource reporter in
particular consumes SFA (RD-05) and ACME (RD-09) data that does not yet exist; RD-11 R48
already designs its shape to be populated per slice, so that work belongs with its
producers, not here.

## Document Index

| #   | Document                                                            | Description                                          |
| --- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)                      | Plan-level Zero-Ambiguity Gate decisions (AR-Q1..Q8) |
| 00  | [Index](00-index.md)                                                | This document — overview and navigation              |
| 01  | [Requirements](01-requirements.md)                                  | Feature requirements and scope (cross-refs RD-11)    |
| 02  | [Current State](02-current-state.md)                                | Analysis of the current (empty) `@blend65/core`      |
| 03-01 | [Span & Source Model](03-01-span-and-source-model.md)             | `SourceId`, `SourceSpan`, `LabeledSpan`, `LineMap`   |
| 03-02 | [Diagnostic Record & Bag](03-02-diagnostic-record-and-bag.md)     | `Diagnostic`, `DiagnosticBag`, code namespace        |
| 07  | [Testing Strategy](07-testing-strategy.md)                          | Spec test cases (ST-*) from RD-11 AC-01..AC-07, AC-10 |
| 99  | [Execution Plan](99-execution-plan.md)                              | Phases, sessions, and master task checklist          |

## Quick Reference

### Key Decisions

| Decision                                        | Outcome                                                                        | Ref          |
| ----------------------------------------------- | ------------------------------------------------------------------------------ | ------------ |
| Sequencing                                      | RD-11a (diagnostics core) before RD-02 (lexer)                                 | AR-Q1        |
| Scope split                                     | 11a: span/LineMap/Diagnostic/DiagnosticBag/codes; 11b deferred                  | AR-Q1        |
| Completeness                                    | Full owner-spec implementations — **no stubs**                                  | AR-Q2        |
| Owning package                                  | `@blend65/core` (no `@blend65/*` deps)                                          | RD-11 §2     |
| `LineMap` line/col method                       | `getLineCol(offset): { line, column }` (1-based) — RD-11 owner API              | AR-Q3        |
| `LineMap` UTF-16 method                          | `getUtf16Column(offset): number`; LineMap holds its own text                    | AR-Q4        |
| `LineMap` line-text method                       | `getLineText(offset): string` — included now                                    | AR-Q5        |
| `DiagnosticBag` API                             | `addError`/`addWarning`/`addICE` + query methods — RD-11 owner API              | AR-Q6        |
| `SourceId` representation                       | `type SourceId = number` (index assigned by deferred `SourceMap`)               | AR-Q7        |
| Diagnostic ordering                             | Deterministic: `sourceId` → `start` → `code`                                    | RD-11 R18    |
| Duplicate suppression                           | Drop second of identical `(code, sourceId, start)`                              | RD-11 R19    |
| `--max-errors`                                  | Default 20; stops new *errors* after limit (+truncation diag); warnings kept     | RD-11 R20    |
| Code namespace                                  | `E10xxx`/`W10xxx` user, `E9xxxx` ICE                                            | RD-11 R1–R3  |
| Commit mode                                     | `--no-commit`                                                                   | AR-Q8        |

### Public API surface added to `@blend65/core` (11a only)

```typescript
// Span model
export type SourceId = number;
export interface SourceSpan { sourceId: SourceId; start: number; end: number; }
export interface LabeledSpan { span: SourceSpan; label: string; }

// Line map
export class LineMap {
  constructor(sourceId: SourceId, text: string);
  getLineCol(offset: number): { line: number; column: number };
  getUtf16Column(offset: number): number;
  getLineText(offset: number): string;
}

// Diagnostic record
export type Severity = 'error' | 'warning';
export interface Diagnostic {
  code: string; severity: Severity; message: string;
  primarySpan: SourceSpan | null; secondarySpans: LabeledSpan[];
  notes: string[]; help?: string;
}
export interface DiagnosticOptions { secondarySpans?: LabeledSpan[]; notes?: string[]; help?: string; }

// Accumulator
export interface DiagnosticBag {
  addError(code: string, span: SourceSpan | null, message: string, options?: DiagnosticOptions): void;
  addWarning(code: string, span: SourceSpan | null, message: string, options?: DiagnosticOptions): void;
  addICE(code: string, span: SourceSpan | null, message: string): void;
  hasErrors(): boolean;
  getAll(): Diagnostic[];
  getErrors(): Diagnostic[];
  getWarnings(): Diagnostic[];
  count(): number;
  isErrorLimitReached(): boolean;
}
export function createDiagnosticBag(options?: { maxErrors?: number }): DiagnosticBag;
```

## Related Files

Created/modified by this plan, all under `@blend65/core`:
`packages/core/src/diagnostics/source-span.ts`, `line-map.ts`, `diagnostic.ts`,
`diagnostic-codes.ts`, `diagnostic-bag.ts`, an `index.ts` barrel, the matching
`*.spec.test.ts` / `*.impl.test.ts` files, and re-exports wired through
`packages/core/src/index.ts`.
