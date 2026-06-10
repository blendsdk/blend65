# RD-02 Lexer — Implementation Plan

> **Feature**: Build the **lexer** (tokenizer) — the first compiler pipeline stage — in
> `@blend65/frontend`, on top of the frozen RD-11a diagnostics core. Implements `spec-v3.0`
> Chapter 01 (Lexical Structure), evaluation F021.
> **Status**: Implemented (all 6 phases complete; FR-1..FR-39 & AC-1..AC-16 satisfied; suite green)
> **Created**: 2026-06-02
> **CodeOps Version**: (unstamped — no `codeops-mcp` dependency in this repo; consistent with RD-01/RD-11a)
> **Source**: [RD-02](../../requirements/RD-02-lexer.md) · [spec Ch 01](../../spec/01-lexical-structure.md)

## Overview

This plan implements **RD-02** — the lexer that turns UTF-8 `.blend` source text into a
flat, typed `Token[]` stream ending in `EOF`. It is the first *producer* built on the
RD-11a diagnostics core (sequenced deliberately after it): the lexer **builds** a
`LineMap` and **appends** structured `Diagnostic`s to a `DiagnosticBag` while never
throwing (AR-15/AR-73). A malformed construct yields a diagnostic *and* a well-defined
recovery token, so the parser (RD-03) always receives a complete stream.

The lexer logic lives in `@blend65/frontend`. The **token vocabulary** (`TokenKind`,
`Token`) is added to `@blend65/core` so both `frontend` and `language-server` share one
definition without either importing `codegen` (R15/AR-20). All lexer diagnostic codes are
added to the single core registry (`diagnostic-codes.ts`) — the documented "one registry"
pattern. The frozen `spec/` and the frozen RD-11a code are **never refactored**, only
extended by addition (D3, AR-Q2).

Scope is exactly Chapter 01: 77 token kinds, the 32-keyword table, contextual keywords as
`IDENTIFIER`, all numeric/string/char literal formats, comments, maximal-munch operators,
byte-offset spans, error-tolerant recovery, and codes E10210–E10224 + W10210. Explicitly
**out of scope** (and owned elsewhere): reserved-built-in enforcement E10212 and escape→byte
encoding (RD-04), the parser/AST (RD-03), `DiagnosticBag`/span types (RD-11a, consumed
here), and `CompilerHost`/file discovery (RD-14/RD-15/RD-16).

## Document Index

| #     | Document                                                | Description                                                        |
| ----- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| AR    | [Ambiguity Register](00-ambiguity-register.md)          | Plan-level Zero-Ambiguity Gate decisions (AR-L1..L6)              |
| 00    | [Index](00-index.md)                                    | This document — overview and navigation                           |
| 01    | [Requirements](01-requirements.md)                      | Functional requirements (FR-*), scope, acceptance criteria (AC-*) |
| 02    | [Current State](02-current-state.md)                    | Empty `@blend65/frontend`; available frozen core API              |
| 03-01 | [Token Model](03-01-token-model.md)                     | `TokenKind`, `Token` (embeds `SourceSpan`) in core; `KEYWORD_MAP` |
| 03-02 | [Lexer Algorithm](03-02-lexer-algorithm.md)             | Scan loop, §11.2 disambiguation, scanners, `lex()` API            |
| 03-03 | [Error Recovery & Codes](03-03-error-recovery.md)       | E10210–E10224/W10210, recovery actions, cascade, determinism      |
| 07    | [Testing Strategy](07-testing-strategy.md)              | Spec/impl test cases (ST-*) + golden token-list snapshots         |
| 99    | [Execution Plan](99-execution-plan.md)                  | Phases, sessions, and master task checklist                       |

## Quick Reference

### Key Decisions

| Decision                               | Outcome                                                                     | Ref            |
| -------------------------------------- | --------------------------------------------------------------------------- | -------------- |
| Owning package (logic)                 | `@blend65/frontend` (`lex`, scanners, `KEYWORD_MAP`)                         | RD-02 R34, AR-L4 |
| Token vocabulary home                  | `@blend65/core` (`TokenKind`, `Token`) — new `tokens/` module               | AR-L4          |
| `TokenKind` representation             | String-valued `const … as const` + derived union (not numeric enum)         | AR-L6          |
| `Token` position                       | Embeds core `SourceSpan` as `token.span`                                     | AR-L3          |
| `LineMap` usage                        | As-built core `new LineMap(sourceId, text)`; constructed once               | AR-L1, AR-L2   |
| Diagnostic codes                       | Added to core `diagnostic-codes.ts` (one registry); E10212 deferred to RD-04 | AR-L5          |
| Error tolerance                        | Never throws; append to `DiagnosticBag`; always end stream in `EOF`         | RD-02 R30, R31 |
| Determinism                            | Same input → identical tokens + identical diagnostics                       | RD-02 R33 (H5) |
| Source input                           | `text` passed in (read by `CompilerHost`); lexer never touches disk         | RD-02 R32      |
| Commit mode                            | `--no-commit`                                                               | (RD-11a AR-Q8) |

### Public API surface added by this plan

```typescript
// @blend65/core — token vocabulary (new tokens/ module)
export const TokenKind = { /* 77 members: "Number", "String", …, "Eof" */ } as const;
export type TokenKindValue = (typeof TokenKind)[keyof typeof TokenKind];
export interface Token {
  readonly kind: TokenKindValue;
  readonly span: SourceSpan;          // { sourceId, start, end }
  readonly value?: number | string;   // NUMBER → number; STRING/CHAR → raw text; else undefined
}

// @blend65/frontend — lexer logic
export interface LexResult {
  readonly tokens: readonly Token[];   // always non-empty; ends in EOF
  readonly lineMap: LineMap;
}
export function lex(sourceId: SourceId, text: string, bag: DiagnosticBag): LexResult;
```

### Diagnostic codes added to the core registry (AR-L5)

`E10210` (unexpected char), `E10211` (unterminated block comment), `E10213` (bad underscore),
`E10214` (bad hex), `E10215` (bad binary), `E10216` (numeric overflow), `E10217` (newline in
string), `E10218` (unterminated string), `E10219` (unknown escape), `E10220` (incomplete `\x`),
`E10221` (empty char), `E10222` (multi-char), `E10223` (unterminated char), `E10224` (reserved
`type`), and warning `W10210` (leading zeros). **E10212 is NOT added here** — RD-04 owns it.

## Related Files

Created/modified by this plan:

- **New (core vocabulary):** `packages/core/src/tokens/token-kind.ts`,
  `packages/core/src/tokens/token.ts`, `packages/core/src/tokens/index.ts`, wired through
  `packages/core/src/index.ts`.
- **Modified (core registry, addition-only):** `packages/core/src/diagnostics/diagnostic-codes.ts`
  (+ matching `*.impl.test.ts` updates).
- **New (frontend lexer):** `packages/frontend/src/lexer/keyword-map.ts`,
  `packages/frontend/src/lexer/lexer.ts`, `packages/frontend/src/lexer/index.ts`, the matching
  `*.impl.test.ts` / `*.spec.test.ts` files and golden snapshots, wired through
  `packages/frontend/src/index.ts`.
