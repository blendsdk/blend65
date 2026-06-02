# Execution Plan: RD-02 Lexer

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Commit mode**: `--no-commit` — implement, verify, update this plan; the user performs all git operations.
> **Progress**: 6/6 phases complete (100%) — all phases GREEN; RD-02 implemented
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

- [x] **1.1** Create `packages/core/src/tokens/token-kind.ts` — `TokenKind` (79 members,
  string-valued) + `TokenKindValue` (FR-1, FR-2; AR-L6). ✅ (completed: 2026-06-02 10:32)
- [x] **1.2** Create `packages/core/src/tokens/token.ts` — `Token` embedding `SourceSpan`
  (FR-3, FR-4; AR-L3). ✅ (completed: 2026-06-02 10:32)
- [x] **1.3** Create `packages/core/src/tokens/index.ts` barrel; wire
  `export * from "./tokens/index.js";` into `packages/core/src/index.ts` (FR-38). ✅ (completed: 2026-06-02 10:33)
- [x] **1.4** Extend `packages/core/src/diagnostics/diagnostic-codes.ts` with the lexer
  codes (E10210, E10211, E10213–E10224, W10210); **not** E10212 (FR-37; AR-L5). ✅ (completed: 2026-06-02 10:33)
- [x] **1.5** Write `token-kind.impl.test.ts` (ST-L1) and extend
  `diagnostic-codes.impl.test.ts` (ST-L2) — fail first, then green. ✅ (completed: 2026-06-02 10:34)
- [x] **1.6** Widen `packages/frontend/vitest.config.ts` include to
  `src/**/*.{spec,impl}.test.ts` (Gap 1, AR-P8). ✅ (completed: 2026-06-02 10:34)
- [x] **1.7** Run verify. **Phase gate:** build + tests green; core has no `@blend65/*` deps;
  R15 tier green. ✅ (completed: 2026-06-02 10:43) — build 10/10, typecheck 17/17, lint 10/10,
  core tests 67/67 (incl. ST-L1 6/6, ST-L2 in diagnostic-codes 12/12), R15 boundary 3/3;
  `git status --porcelain spec/` empty (D3 intact).

> **Phase 1 note (count correction):** ST-L1 initially asserted 77 `TokenKind` members per
> the plan's reconciliation table, but the enumerated set is **79**. Root cause: spec Ch 01
> §12's operator sub-header reads "(29)" while enumerating **32** names (`PLUS`…`QUESTION`);
> the "76 token types" prose inherits the same slip. The **enumerated names are
> authoritative** (spec frozen — not edited, D3). Corrected `token-kind.ts` comment (29→32),
> ST-L1 (77→79, plus a 32-name operator-block guard), and back-propagated the reconciliation
> table in [03-01-token-model.md](03-01-token-model.md). No new runtime ambiguity raised —
> this was a documentation arithmetic fix, not a design decision.

## Phase 2 — Scanner skeleton (frontend)

**Goal:** `lex()` exists; whitespace, comments, BOM, `Eof`, spans, `LineMap` work; lone
operators/punctuation tokenize. Numerics/strings/chars stubbed to follow in later phases.

- [x] **2.1** Create `packages/frontend/src/lexer/keyword-map.ts` — `KEYWORD_MAP` (FR-5). ✅ (completed: 2026-06-02 11:09)
- [x] **2.2** Create `packages/frontend/src/lexer/lexer.ts` — `lex`, `LexResult`, scanner
  state, main loop, `skipWhitespace`, `skipLineComment`, `skipBlockComment`, BOM, `Eof`,
  `scanIdentifier`, `scanOperatorOrPunctuation` (FR-6..9, FR-20..31; AR-L1/L2). ✅ (completed: 2026-06-02 11:11)
- [x] **2.3** Create `packages/frontend/src/lexer/index.ts`; wire into
  `packages/frontend/src/index.ts` (FR-38). ✅ (completed: 2026-06-02 11:11)
- [x] **2.4** Write `lexer.impl.test.ts` for ST-L3..L10, ST-L26..L34 (identifiers,
  keywords, comments, operators, punctuation, spans, BOM, line map) — fail first, then green. ✅ (completed: 2026-06-02 11:13)
- [x] **2.5** Run verify. **Phase gate:** green; R15 tier green. ✅ (completed: 2026-06-02 11:13) —
  build 10/10, typecheck 17/17, lint 10/10, frontend tests 18/18 (ST-L3..L10, ST-L26..L34
  = 17 lexer cases + smoke), R15 boundary 3/3; `git status --porcelain spec/` empty (D3),
  no `frontend → codegen` edge.

> **Phase 2 note (operator-set scope):** ST-L28 asserts all **32** operator lexemes (the
> spec §12 enumerated set incl. `Question`), not "29" as the §12 sub-header reads — same
> frozen-spec slip reconciled in Phase 1. ST-L29 covers all 10 punctuation lexemes.
> Numeric/string/char dispatch slots (markers in `lexer.ts`) are intentionally empty until
> Phases 3–4; `emitUnexpectedChar` (E10210) is already wired so the loop is total (no hang),
> though its dedicated case (ST-L35) lands in Phase 5.


## Phase 3 — Numeric literals

**Goal:** decimal/`$`hex/`0x`hex/`0b`binary with underscores, overflow, leading-zero, and
bare-prefix recovery.

- [x] **3.1** Implement `scanDecimal`, `scanHexDollar`, `scanHex0x`, `scanBinary`, and the
  shared `scanDigitRun` underscore validator (FR-11..16; spec §6). ✅ (completed: 2026-06-02 11:32)
- [x] **3.2** Emit E10213/E10214/E10215/E10216 + W10210 with recovery values per
  [03-03 §2](03-03-error-recovery.md) (FR-15/16, AR-L5). ✅ (completed: 2026-06-02 11:32)
- [x] **3.3** Write ST-L11..L19 — fail first, then green. ✅ (completed: 2026-06-02 11:33)
- [x] **3.4** Run verify. **Phase gate:** green. ✅ (completed: 2026-06-02 11:34) —
  build/typecheck/lint 30/30 (frontend cache-miss rebuilt clean), frontend tests 27/27
  (18 prior + ST-L11..L19 = 9 numeric cases), R15 boundary 3/3; `git status --porcelain spec/`
  empty (D3), no `frontend → codegen` edge.

> **Phase 3 note (recovery & dispatch):** Numeric dispatch is inserted in the main loop
> **before** identifier scanning, ordered `$`→`scanHexDollar`, `0x`/`0X`→`scanHex0x`,
> `0b`/`0B`→`scanBinary`, else digit→`scanDecimal` (§11.2). `scanDigitRun` accepts a leading
> `_` after a prefix into the run (so `$_FF` still parses to a `Number`) while flagging a
> single E10213 — matching the recovery table (03-03 §2 row 3: "continue the digit run").
> ST-L19 (`0bytes`) confirms the bare-`0b` prefix yields `Number` value 0 (E10215) and the
> trailing `ytes` lexes as a separate `Identifier`. No new runtime ambiguity raised.


## Phase 4 — Strings, characters, escapes

**Goal:** string & char literals with raw-text capture and shared escape validation.

- [x] **4.1** Implement `scanString`, `scanChar`, and shared `validateEscape` (FR-17..19;
  spec §7, §8). ✅ (completed: 2026-06-02 11:44)
- [x] **4.2** Emit E10217–E10223 with recovery per [03-03 §2/§4](03-03-error-recovery.md). ✅ (completed: 2026-06-02 11:44)
- [x] **4.3** Write ST-L20..L25 — fail first, then green. ✅ (completed: 2026-06-02 11:45)
- [x] **4.4** Run verify. **Phase gate:** green. ✅ (completed: 2026-06-02 11:46) —
  build/typecheck/lint 30/30, frontend tests 33/33 (27 prior + ST-L20..L25 = 6 string/char
  cases), R15 boundary 3/3; `git status --porcelain spec/` empty (D3), no `frontend → codegen` edge.

> **Phase 4 note (raw-value capture & recovery):** String/char dispatch is inserted in the
> main loop after numeric and before identifier scanning (§11.2 steps 1–2). `Token.value`
> holds the **raw** content with escapes kept literally (`"a\nb"` → value `a\nb`) — byte
> resolution is deferred to RD-04, which needs the platform encoding profile (RD-10).
> `validateEscape` is shared: `\?` → E10219 and short `\x` → E10220 both keep the offending
> text raw and continue scanning to the delimiter (no early termination). A literal newline
> ends a string with E10217 (newline left for `skipWhitespace`); EOF ends it with E10218.
> Char recovery: `''` → E10221 (value `""`), `'AB'` → E10222 (value = first unit), no
> closing `'` → E10223. Every path still emits a `String`/`Char` token, preserving the
> always-complete-stream invariant (FR-33). No new runtime ambiguity raised.


## Phase 5 — Error tolerance, unexpected chars, determinism

**Goal:** the never-throws + recovery + determinism guarantees are pinned end-to-end.

- [x] **5.1** Implement `emitUnexpectedChar` (E10210, skip-one-unit) and confirm every
  recovery path advances `pos` (FR-30, FR-32, FR-34). ✅ (completed: 2026-06-02 11:48) —
  `emitUnexpectedChar` was already wired in Phase 2; Phase 5 confirms every recovery path
  advances `pos` ≥1 (verified by ST-L38 no-hang).
- [x] **5.2** Confirm block-comment cascade suppression (FR-35) and the always-one-`Eof`
  invariant (FR-33). ✅ (completed: 2026-06-02 11:48) — cascade pinned by ST-L27 (Phase 2);
  one-`Eof` invariant pinned by ST-L38.
- [x] **5.3** Write ST-L35..L38 (unexpected char, mixed-error tolerance, determinism,
  no-hang) — fail first, then green. ✅ (completed: 2026-06-02 11:48)
- [x] **5.4** Run verify. **Phase gate:** green. ✅ (completed: 2026-06-02 11:48) —
  build/typecheck/lint 30/30, frontend tests 37/37 (33 prior + ST-L35..L38 = 4 cases),
  R15 boundary 3/3; `git status --porcelain spec/` empty (D3), no `frontend → codegen` edge.

> **Phase 5 note (recovery already total):** The never-throws + skip-≥1 recovery machinery
> was built incrementally in Phases 2–4, so Phase 5 is primarily a *pinning* phase: ST-L35
> (E10210 + resume), ST-L36 (three independent errors in one source all reported, stream
> still ends in `Eof`), ST-L37 (determinism — same source lexed twice is deep-equal in both
> tokens and `bag.getAll()`), ST-L38 (pathological inputs `€€€€`, `''''`, `""""`, `\\\`,
> `$$$`, `0b0b0b`, `/*/` each terminate with exactly one `Eof`). ST-L36's source uses
> `$ 0b "oops` (string unterminated at EOF → E10218); a newline inside the string would
> instead trip E10217 (per ST-L22), so the EOF form is used to exercise E10218 specifically.
> No new runtime ambiguity raised.


## Phase 6 — Behavioral spec, golden snapshots, acceptance & closeout

**Goal:** public API spec + golden snapshots; walk all ACs; mark plan complete.

- [x] **6.1** Write `lexer.spec.test.ts`: ST-L39 (exports), ST-L40 (golden token list for a
  representative `.blend`), ST-L41 (golden tokens + ordered diagnostics) (AC-1, AC-15). ✅ (completed: 2026-06-02 11:56)
- [x] **6.2** Walk AC-1..AC-16 ([01-requirements §3](01-requirements.md)) against the green
  suite; tick each. ✅ (completed: 2026-06-02 11:57) — all 16 ACs ticked.
- [x] **6.3** Tick FR-1..FR-39 ([01-requirements §2](01-requirements.md)); set Index status
  to "Implemented". ✅ (completed: 2026-06-02 11:57) — 39 FRs ticked; Index → "Implemented".
- [x] **6.4** Confirm `git status --porcelain spec/` is empty (spec untouched, D3) and the
  R15 boundary is unaffected (no `frontend → codegen` edge; ST-R15a/b/c green). ✅ (completed: 2026-06-02 11:57) —
  `git status --porcelain spec/` empty; ST-R15a/b/c green.
- [x] **6.5** Final verify run; record result here. **STOP** — hand off to the user for
  commit (`--no-commit`). ✅ (completed: 2026-06-02 11:57) — build/typecheck/lint 30/30,
  frontend tests 44/44 (7 spec incl. ST-L39..L41 + 36 impl + 1 smoke), 3 golden snapshots
  written, R15 boundary 3/3; `git status --porcelain spec/` empty (D3 intact).

> **Phase 6 note (golden format & error fixture):** The canonical token-list snapshot uses
> `<Kind> <start>..<end> [value]` (string-valued `TokenKind`, AR-L6, keeps it readable) — the
> foundation for a future `--emit-tokens` flag. ST-L40 confirms `0xD020`→53280 and a
> well-formed program emits zero diagnostics; ST-L41 pins three independent recovery paths in
> one source (`$`→E10214 value 0, `99999`→E10216 saturated 65535, `"oops`→E10218 String value
> `"oops"`) in diagnostic order, plus a determinism re-lex. ST-L39 imports `lex` through the
> package's public `../index.js` entry, pinning the `@blend65/frontend` re-export (FR-38).
> No new runtime ambiguity raised.

---

## Master Task Checklist

- [x] Phase 1 — token vocabulary & code registry (1.1–1.7)
- [x] Phase 2 — scanner skeleton (2.1–2.5)
- [x] Phase 3 — numeric literals (3.1–3.4)
- [x] Phase 4 — strings, characters, escapes (4.1–4.4)
- [x] Phase 5 — error tolerance & determinism (5.1–5.4)
- [x] Phase 6 — spec, golden, acceptance & closeout (6.1–6.5)


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
