# Execution Plan: RD-11a Diagnostics Core

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Commit mode**: `--no-commit` (AR-Q8) — implement, verify, update this plan; the user performs all git operations.
> **Progress**: 5/5 phases complete (100%) — Phases 1–5 ✅ — ready for user commit
> **Last Updated**: 2026-06-02 01:58

## Overview

Implement the RD-11 diagnostics core in `@blend65/core`, spec-tests-first, in five phases.
Each phase ends green against the verify command. No git operations are performed.

**Verify command (run at the end of every phase):**

```bash
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```

## Open Micro-Decision (confirm on execute)

- **MD-1 (truncation code):** ✅ **RESOLVED (2026-06-02)** — user confirmed the default.
  The `--max-errors` truncation diagnostic uses the reserved `E10000` / `DiagCode.TooManyErrors`
  sentinel (03-02). Ch 14 does not assign a code to this message.

---

## Phase 1 — Span & Source Model

**Goal:** `SourceId`, `SourceSpan`, `LabeledSpan`, `LineMap` implemented and unit-green.

- [x] **1.1** Create `packages/core/src/diagnostics/source-span.ts` (FR-1..FR-3, `makeSpan`). ✅ (2026-06-02 00:01)
- [x] **1.2** Widen `packages/core/src/vitest.config.ts` `include` to
  `src/**/*.{spec,impl}.test.ts` (02 Gap 2). *(per-package config per AR-P8)* ✅ (2026-06-02 00:01)
- [x] **1.3** Write `source-span.impl.test.ts` (ST-1) — **fails first**. ✅ (2026-06-02 00:01)
- [x] **1.4** Create `line-map.ts` per 03-01 (ctor, `getLineCol`, `getUtf16Column`,
  `getLineText`; LF/CRLF/CR; BOM) (FR-4..FR-8, FR-20). ✅ (2026-06-02 00:01)
- [x] **1.5** Write `line-map.impl.test.ts` (ST-2..ST-12) — fails first, then green. ✅ (2026-06-02 00:01)
- [x] **1.6** Run verify. **Phase gate:** build + tests green. ✅ (2026-06-02 00:01 — 29 core tests + R15 tier green)

## Phase 2 — Diagnostic Record & Code Namespace

**Goal:** `Diagnostic`, `DiagnosticOptions`, full `DiagCode`/`IceCode` namespace, `isIceCode`.

- [x] **2.1** Create `diagnostic.ts` (FR-9, FR-10). ✅ (2026-06-02 00:14)
- [x] **2.2** Create `diagnostic-codes.ts` with every Ch 14 code + ICE band + `isIceCode`
  (FR-17). ✅ (2026-06-02 00:14)
- [x] **2.3** Write `diagnostic-codes.impl.test.ts` (ST-13, ST-14) — fails first, then green. ✅ (2026-06-02 00:14)
- [x] **2.4** Run verify. **Phase gate:** green. ✅ (2026-06-02 00:14 — 38 core tests + R15 tier green)

## Phase 3 — DiagnosticBag

**Goal:** complete `DiagnosticBag` + `createDiagnosticBag` with ordering, dedup, max-errors.

- [x] **3.1** Confirm MD-1 (default `E10000`) — user confirmed; added `DiagCode.TooManyErrors`. ✅ (2026-06-02 00:24)
- [x] **3.2** Create `diagnostic-bag.ts` per 03-02 (FR-11..FR-16, FR-18); precedence
  dedup → cap → store. *(closure-factory; no class fields, so Rule 13 `private`/`protected` n/a)* ✅ (2026-06-02 00:28)
- [x] **3.3** Write `diagnostic-bag.impl.test.ts` (ST-15..ST-27) — fails first, then green. ✅ (2026-06-02 00:28)
- [x] **3.4** Run verify. **Phase gate:** green. ✅ (2026-06-02 00:28 — 58 core tests + R15 tier green)

## Phase 4 — Barrel & Public Export

**Goal:** everything exported from `@blend65/core`; behavioral spec passes.

- [x] **4.1** Create `diagnostics/index.ts` re-exporting span, line-map, diagnostic, codes, bag. ✅ (2026-06-02 00:28)
- [x] **4.2** Wire `export * from "./diagnostics/index.js";` into `packages/core/src/index.ts`
  (keep `VERSION`) (FR-19). ✅ (2026-06-02 00:28)
- [x] **4.3** Write `diagnostics.spec.test.ts` (ST-20, ST-21, ST-22, ST-28; AC-1..AC-8
  end-to-end). ✅ (2026-06-02 00:28)
- [x] **4.4** Run verify. **Phase gate:** green. ✅ (2026-06-02 00:28 — 58 core tests + R15 tier green)

## Phase 5 — Acceptance & Plan Closeout

**Goal:** confirm all ACs; mark plan complete.

- [x] **5.1** Walk AC-1..AC-10 (01-requirements) against the green test suite; tick each. ✅ (2026-06-02 01:58 — AC-1..AC-10 ticked)
- [x] **5.2** Confirm `git status --porcelain spec/` is empty (spec untouched). ✅ (2026-06-02 01:58 — empty)
- [x] **5.3** Confirm `frontend`/`language-server` R15 boundary unaffected (no new edges;
  core has no `@blend65/*` deps). ✅ (2026-06-02 01:58 — R15 tier green; core has no `@blend65/*` deps)
- [x] **5.4** Tick FR-1..FR-20 in 01-requirements; update Index status to "Implemented". ✅ (2026-06-02 01:58)
- [x] **5.5** Final verify run; record result here. **STOP** — hand off to user for commit
  (`--no-commit`). ✅ (2026-06-02 01:58 — FULL TURBO, 58 core tests + 3 R15 boundary tests green; spec/ untouched)

---

## Master Task Checklist

- [x] Phase 1 — span & source model (1.1–1.6) ✅
- [x] Phase 2 — diagnostic record & codes (2.1–2.4) ✅
- [x] Phase 3 — diagnostic bag (3.1–3.4) ✅
- [x] Phase 4 — barrel & export (4.1–4.4) ✅
- [x] Phase 5 — acceptance & closeout (5.1–5.5) ✅

## Notes

- **No stubs (AR-Q2):** every component is built complete to RD-11. RD-11's later plan
  *extends* this (adds `SourceMap`, `SeverityPolicy`, renderers, `ResourceReport` — the
  "11b" set) and must not refactor anything built here.
- **Spec-tests-first:** each phase writes failing tests before implementation, per
  testing.md.
- **No git ops:** `--no-commit` — the agent stops at Phase 5.5 for user commit.
- **Runtime ambiguities:** if one surfaces, STOP, log as the next `AR-Q#` (runtime) in
  `00-ambiguity-register.md`, resolve with the user, back-propagate, resume.
