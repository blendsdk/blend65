# Execution Plan: RD-02 Lexer

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Commit mode**: `--no-commit` — implement, verify, update this plan; the user performs all git operations.
> **Progress**: 0/6 phases complete (0%) — planning documents authored; implementation pending
> **Last Updated**: 2026-06-02

## Overview

Implement the Chapter 01 lexer, spec-tests-first, in six phases. The token vocabulary
(`TokenKind`, `Token`) and the lexer diagnostic codes are added to `@blend65/core`
(addition-only — frozen RD-11a code is never refactored, AR-Q2/D3); the lexer logic
(`lex`, scanners, `KEYWORD_MAP`) is built in `@blend65/frontend`. Each phase ends green
against the verify command. No git operations are performed.

**Verify command (run at the end of every phase):**

```bash
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```

## Pre-flight (confirmed before execution)

- **AR-L1..L6** ([00-ambiguity-register](00-ambiguity-register.md)) confirmed with the user.
- No open micro-decisions. If a runtime ambiguity surfaces, STOP and log it as the next
  `AR-L#` (runtime), resolve with the user, back-propagate, resume.

---

## Phase 1 — Token vocabulary & code registry (core)

**Goal:** `TokenKind`/`Token` exist in `@blend65/core`; lexer codes added to the registry;
frontend impl-test glob widened. Core stays dependency-free.

- [ ] **1.1** Create `packages/core/src/tokens/token-kind.ts` — `TokenKind` (77 members,
  string-valued) + `TokenKindValue` (FR-1, FR-2; AR-L6).
- [ ] **1.2** Create `packages/core/src/tokens/token.ts` — `Token` embedding `SourceSpan`
  (FR-3, FR-4; AR-L3).
- [ ] **1.3** Create `packages/core/src/tokens/index.ts` barrel; wire
  `export * from "./tokens/index.js";` into `packages/core/src/index.ts` (FR-38).
- [ ] **1.4** Extend `packages/core/src/diagnostics/diagnostic-codes.ts` with the lexer
  codes (E10210, E10211, E10213–E10224, W10210); **not** E10212 (FR-37; AR-L5).
- [ ] **1.5** Write `token-kind.impl.test.ts` (ST-L1) and extend
  `diagnostic-codes.impl.test.ts` (ST-L2) — fail first, then green.
- [ ] **1.6** Widen `packages/frontend/vitest.config.ts` include to
  `src/**/*.{spec,impl}.test.ts` (Gap 1, AR-P8).
- [ ] **1.7** Run verify. **Phase gate:** build + tests green; core has no `@blend65/*` deps;
  R15 tier green.

## Phase 2 — Scanner skeleton (frontend)

**Goal:** `lex()` exists; whitespace, comments, BOM, `Eof`, spans, `LineMap` work; lone
operators/punctuation tokenize. Numerics/strings/chars stubbed to follow in later phases.

- [ ] **2.1** Create `packages/frontend/src/lexer/keyword-map.ts` — `KEYWORD_MAP` (FR-5).
- [ ] **2.2** Create `packages/frontend/src/lexer/lexer.ts` — `lex`, `LexResult`, scanner
  state, main loop, `skipWhitespace`, `skipLineComment`, `skipBlockComment`, BOM, `Eof`,
  `scanIdentifier`, `scanOperatorOrPunctuation` (FR-6..9, FR-20..31; AR-L1/L2).
- [ ] **2.3** Create `packages/frontend/src/lexer/index.ts`; wire into
  `packages/frontend/src/index.ts` (FR-38).
- [ ] **2.4** Write `lexer.impl.test.ts` for ST-L3..L10, ST-L26..L34 (identifiers,
  keywords, comments, operators, punctuation, spans, BOM, line map) — fail first, then green.
- [ ] **2.5** Run verify. **Phase gate:** green; R15 tier green.

## Phase 3 — Numeric literals

**Goal:** decimal/`$`hex/`0x`hex/`0b`binary with underscores, overflow, leading-zero, and
bare-prefix recovery.

- [ ] **3.1** Implement `scanDecimal`, `scanHexDollar`, `scanHex0x`, `scanBinary`, and the
  shared `scanDigitRun` underscore validator (FR-11..16; spec §6).
- [ ] **3.2** Emit E10213/E10214/E10215/E10216 + W10210 with recovery values per
  [03-03 §2](03-03-error-recovery.md) (FR-15/16, AR-L5).
- [ ] **3.3** Write ST-L11..L19 — fail first, then green.
- [ ] **3.4** Run verify. **Phase gate:** green.

## Phase 4 — Strings, characters, escapes

**Goal:** string & char literals with raw-text capture and shared escape validation.

- [ ] **4.1** Implement `scanString`, `scanChar`, and shared `validateEscape` (FR-17..19;
  spec §7, §8).
- [ ] **4.2** Emit E10217–E10223 with recovery per [03-03 §2/§4](03-03-error-recovery.md).
- [ ] **4.3** Write ST-L20..L25 — fail first, then green.
- [ ] **4.4** Run verify. **Phase gate:** green.

## Phase 5 — Error tolerance, unexpected chars, determinism

**Goal:** the never-throws + recovery + determinism guarantees are pinned end-to-end.

- [ ] **5.1** Implement `emitUnexpectedChar` (E10210, skip-one-unit) and confirm every
  recovery path advances `pos` (FR-30, FR-32, FR-34).
- [ ] **5.2** Confirm block-comment cascade suppression (FR-35) and the always-one-`Eof`
  invariant (FR-33).
- [ ] **5.3** Write ST-L35..L38 (unexpected char, mixed-error tolerance, determinism,
  no-hang) — fail first, then green.
- [ ] **5.4** Run verify. **Phase gate:** green.

## Phase 6 — Behavioral spec, golden snapshots, acceptance & closeout

**Goal:** public API spec + golden snapshots; walk all ACs; mark plan complete.

- [ ] **6.1** Write `lexer.spec.test.ts`: ST-L39 (exports), ST-L40 (golden token list for a
  representative `.blend`), ST-L41 (golden tokens + ordered diagnostics) (AC-1, AC-15).
- [ ] **6.2** Walk AC-1..AC-16 ([01-requirements §3](01-requirements.md)) against the green
  suite; tick each.
- [ ] **6.3** Tick FR-1..FR-39 ([01-requirements §2](01-requirements.md)); set Index status
  to "Implemented".
- [ ] **6.4** Confirm `git status --porcelain spec/` is empty (spec untouched, D3) and the
  R15 boundary is unaffected (no `frontend → codegen` edge; ST-R15a/b/c green).
- [ ] **6.5** Final verify run; record result here. **STOP** — hand off to the user for
  commit (`--no-commit`).

---

## Master Task Checklist

- [ ] Phase 1 — token vocabulary & code registry (1.1–1.7)
- [ ] Phase 2 — scanner skeleton (2.1–2.5)
- [ ] Phase 3 — numeric literals (3.1–3.4)
- [ ] Phase 4 — strings, characters, escapes (4.1–4.4)
- [ ] Phase 5 — error tolerance & determinism (5.1–5.4)
- [ ] Phase 6 — spec, golden, acceptance & closeout (6.1–6.5)

## Notes

- **Frozen baselines:** `spec/` is read-only (D3); RD-11a code is extended-not-refactored
  (AR-Q2) — only `diagnostic-codes.ts` is edited, by addition. `git status --porcelain spec/`
  must stay empty.
- **R15/AR-20 (load-bearing):** `@blend65/frontend` imports `@blend65/core` only; it must
  never import `@blend65/codegen`. The root boundary tier guards this every phase.
- **Spec-tests-first:** each phase writes failing tests before implementation, per
  testing.md.
- **No git ops:** `--no-commit` — the agent stops at Phase 6.5 for the user's commit.
- **Runtime ambiguities:** if one surfaces, STOP, log it as the next `AR-L#` (runtime) in
  `00-ambiguity-register.md`, resolve with the user, back-propagate, resume.
- **Coding standards (code.md):** no `private` — use `protected` if any class is introduced
  (the lexer is function-based, so this is unlikely to apply); 2-space indent; ESM `.js`
  relative imports; kebab-case filenames; `*.impl.test.ts` for logic, `*.spec.test.ts` for
  behavioral/spec tiers.
```
