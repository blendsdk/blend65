# Execution Plan: RD-16 Compiler Configuration (`blend65.json`)

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-02
> **Progress**: 17/36 tasks (47%)
> **CodeOps Skills Version**: 3.1.0

## Overview

Implement `@blend65/config`: the config diagnostic band in `@blend65/core` (AR-P3), then
the seven package modules (AR-P6) bottom-up — foundations → discovery/parse →
validate/merge → `loadConfig()` orchestrator — each phase in the mandatory
spec-tests-first ordering. Commits go through **/gitcm** per the exec_plan skill's
commit mode; the frozen `spec/` directory is never touched (D3).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
| ----- | -------------------------------------------- | -------- | --------- |
| 1 | Foundations: diag codes, dependency, types/defaults | 2 | 90–120 min |
| 2 | Discovery & JSONC parse | 3 | 150–180 min |
| 3 | Validation & merge | 3 | 180–240 min |
| 4 | `loadConfig()` orchestrator, E2E & closeout | 3 | 180–240 min |

**Total: 11 sessions, ~10–13 hours**

---

## Phase 1: Foundations

### Session 1.1: Config diagnostic band in `@blend65/core`

**Reference**: [03-01-config-loader.md](03-01-config-loader.md) §Diagnostic codes (AR-P3)
**Objective**: E10240–E10246 + W10240/W10241 exist in `DiagCode`, spec-tested.

**Tasks**:

| # | Task | File |
| ----- | ------------------ | -------------- |
| 1.1.1 | Write spec test for the 9 config codes (ST-32) — do NOT read/modify `diagnostic-codes.ts` first | `packages/core/src/diagnostics/config-codes.spec.test.ts` |
| 1.1.2 | Run it — verify it FAILS (red) | — |
| 1.1.3 | Add the config band to `DiagCode` with an RD-16 claim comment (RD-09/E10035 precedent style) | `packages/core/src/diagnostics/diagnostic-codes.ts` |
| 1.1.4 | Run spec test — verify it PASSES (green); run the core package suite for regressions | — |

**Deliverables**:
- [ ] 9 codes registered, ST-32 green, no core regressions

**Verify**: `yarn workspace @blend65/core test` (targeted; full verify at 4.3.3)

### Session 1.2: Dependency + package foundations

**Reference**: [03-01-config-loader.md](03-01-config-loader.md) §Types / §Schema descriptor (AR-P1, AR-P2, AR-P6)
**Objective**: `jsonc-parser` resolves under NodeNext; `types.ts` + `defaults.ts` compile.

**Tasks**:

| # | Task | File |
| ----- | ------------------ | -------------- |
| 1.2.1 | Add `jsonc-parser` (exact-pinned latest 3.x) to the config package; `yarn install`; **checkpoint**: (a) a named ESM import typechecks under NodeNext — if not, adopt the namespace-import fallback and note it in this plan; (b) confirm `ParseError.offset`/`Node.offset` are UTF-16 code-unit string indices (the PF-017 conversion prerequisite) and note the confirmation here | `packages/config/package.json` |
| 1.2.2 | Create `types.ts`: `BlendConfig`, `LoadConfigOptions`, `LoadConfigResult`, `CONFIG_SOURCE_ID = -2` — verbatim RD-16 §4.2 + AR-P2 additions, full JSDoc | `packages/config/src/types.ts` |
| 1.2.3 | Create `defaults.ts`: `CONFIG_DEFAULTS` (RD §4.1 verbatim; NO `platform` default — R31) + `CONFIG_SCHEMA` descriptor table (type/enum/range/W-code rules) | `packages/config/src/defaults.ts` |
| 1.2.4 | Typecheck + lint the package | — |

**Deliverables**:
- [ ] Dependency resolves; foundations compile clean

**Verify**: `yarn workspace @blend65/config typecheck && yarn workspace @blend65/config lint`

---

## Phase 2: Discovery & JSONC parse

### Session 2.1: Specification tests (BEFORE implementation)

**Reference**: [07-testing-strategy.md](07-testing-strategy.md) ST-5..ST-9
**Objective**: red spec tests for `discovery.ts` and `parse.ts`.

**Tasks**:

| # | Task | File |
| ----- | ------------------ | -------------- |
| 2.1.1 | Write discovery spec tests (ST-5: pure `findConfigUpwards` with injected predicate, hit/miss/root cases) — from ST-cases only, no implementation reading | `packages/config/src/discovery.spec.test.ts` |
| 2.1.2 | Write parse spec tests — **parse-level column only** (07 §JSONC parsing, PF-015): ST-6 zero `parseErrors` + recovered `value.platform`; ST-7 recovered `value` + ≥1 `parseErrors` entry with in-file byte offset; ST-8 two `parseErrors` with distinct offsets; ST-9 recovered top-level array/string value. NO `E10241`/`E10242`/`CONFIG_SOURCE_ID`/dedup assertions here — those are loader-level (Phase 4, task 4.1.1) | `packages/config/src/parse.spec.test.ts` |
| 2.1.3 | Run both — verify they FAIL (red); document any pre-passing test with justification | — |

### Session 2.2: Implementation

**Reference**: [03-01-config-loader.md](03-01-config-loader.md) §New Functions, §Algorithm step 2
**Tasks**:

| # | Task | File |
| ----- | ------------------ | -------------- |
| 2.2.1 | Implement `findConfigUpwards(startDir, fileExists)` — walk to filesystem root inclusive (R4) | `packages/config/src/discovery.ts` |
| 2.2.2 | Implement `parseJsoncFile` wrapping `jsonc-parser` (recovered value + `tree` + `parseErrors` with code-unit→byte-converted offsets, PF-017/PF-021) plus `createOffsetConverter`; line/col for F9 messages comes from core's `LineMap`, NOT a local newline-scan helper (PF-018) | `packages/config/src/parse.ts` |
| 2.2.3 | Run spec tests — verify they PASS (green); if any fails, fix the implementation, never the test | — |

### Session 2.3: Implementation tests & hardening

**Tasks**:

| # | Task | File |
| ----- | ------------------ | -------------- |
| 2.3.1 | Discovery impl tests: root-dir boundary, deep nesting, trailing separators | `packages/config/src/discovery.impl.test.ts` |
| 2.3.2 | Parse impl tests: UTF-8 BOM, empty file, offset conversion on non-ASCII content (PF-017), F9 message-format smoke via `LineMap` | `packages/config/src/parse.impl.test.ts` |
| 2.3.3 | Package verify | — |

**Verify**: `yarn workspace @blend65/config test && yarn workspace @blend65/config typecheck && yarn workspace @blend65/config lint`

---

## Phase 3: Validation & merge

### Session 3.1: Specification tests (BEFORE implementation)

**Reference**: [07-testing-strategy.md](07-testing-strategy.md) ST-10..ST-27
**Tasks**:

| # | Task | File |
| ----- | ------------------ | -------------- |
| 3.1.1 | Write validate spec tests: shape (ST-10..ST-17) + semantics (ST-18..ST-24) incl. span-distinctness (ST-11) and AR-P5 traversal cases (ST-21) | `packages/config/src/validate.spec.test.ts` |
| 3.1.2 | Write merge spec tests (ST-25 override wins; ST-26 `undefined` ignored; ST-27 arrays replace) | `packages/config/src/merge.spec.test.ts` |
| 3.1.3 | Run both — verify they FAIL (red) | — |

### Session 3.2: Implementation

**Reference**: [03-01-config-loader.md](03-01-config-loader.md) §Algorithm steps 3–5, §AR-P5 rule, §Span strategy
**Tasks**:

| # | Task | File |
| ----- | ------------------ | -------------- |
| 3.2.1 | Implement `validateShape` (tree-walk: W10240 per unknown key, E10243 per wrong type, spans from nodes via `toByteOffset` — PF-017) and `validateSemantics` (E10244/E10245/E10246/E10243-range/W10241; negative-ordinal synthetic spans with per-entry stride for file-position-less values — PF-019) incl. `isPatternInsideRoot` | `packages/config/src/validate.ts` |
| 3.2.2 | Implement `mergeConfig` (defaults ← file ← non-`undefined` overrides; arrays replace; `projectRoot`/`configPath` resolution) | `packages/config/src/merge.ts` |
| 3.2.3 | Run spec tests — verify they PASS (green) | — |

### Session 3.3: Implementation tests & hardening

**Tasks**:

| # | Task | File |
| ----- | ------------------ | -------------- |
| 3.3.1 | Validate impl tests: ordinal-span stability, `\` normalization, win32 absolute/UNC forms, `warnAsError` boolean-vs-array narrowing | `packages/config/src/validate.impl.test.ts` |
| 3.3.2 | Package verify | — |

**Verify**: `yarn workspace @blend65/config test && yarn workspace @blend65/config typecheck && yarn workspace @blend65/config lint`

---

## Phase 4: `loadConfig()` orchestrator, E2E & closeout

### Session 4.1: Specification tests (BEFORE implementation)

**Reference**: [07-testing-strategy.md](07-testing-strategy.md) ST-1..ST-4, ST-28..ST-31
**Tasks**:

| # | Task | File |
| ----- | ------------------ | -------------- |
| 4.1.1 | Write loader spec tests over real temp trees (AR-P7): discovery integration ST-1..ST-4; loader-level ST-7..ST-9; API/E2E ST-28..ST-31 (incl. the RD §4.4 full-example E2E) | `packages/config/src/load-config.spec.test.ts` |
| 4.1.2 | Replace the stub smoke test with a public-API surface spec test (exports: `loadConfig`, types, `CONFIG_SOURCE_ID`, `CONFIG_DEFAULTS`) | `packages/config/src/index.spec.test.ts` |
| 4.1.3 | Run both — verify they FAIL (red) | — |

### Session 4.2: Implementation

**Reference**: [03-01-config-loader.md](03-01-config-loader.md) §Algorithm (all 6 steps)
**Tasks**:

| # | Task | File |
| ----- | ------------------ | -------------- |
| 4.2.1 | Implement `loadConfig` orchestrator: path resolution (E10240 on explicit miss), read+parse, shape → merge (with `origin` — PF-021) → semantics, `hasErrors` via local emission tracking (PF-020, NOT before/after bag counts) | `packages/config/src/load-config.ts` |
| 4.2.2 | Implement the public entry (re-exports only; delete the `VERSION` stub) | `packages/config/src/index.ts` |
| 4.2.3 | Run spec tests — verify they PASS (green) | — |

### Session 4.3: Implementation tests, audits & closeout

**Tasks**:

| # | Task | File |
| ----- | ------------------ | -------------- |
| 4.3.1 | Loader impl tests: pre-populated-bag `hasErrors` matrix incl. at-cap case (PF-020), unreadable-file I/O path, override-sourced E10243 synthetic spans (PF-019), AR-P9 post-error values | `packages/config/src/load-config.impl.test.ts` |
| 4.3.2 | AC-13 data-only audit: no `require(`/dynamic `import(` of config content anywhere in the package; security checklist from 07 §Security | — |
| 4.3.3 | FULL workspace verify: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`; confirm `git status --porcelain spec/` is empty | — |
| 4.3.4 | AC audit: walk AC-01..AC-14 in [01-requirements.md](01-requirements.md) and RD-16 §6, tick each with its evidencing ST/test run | — |
| 4.3.5 | Roadmap update: RD-16 → exec complete in the feature roadmap + portfolio rollup (roadmap skill Update Protocol) | `codeops/features/blend65-ri/00-roadmap.md`, `codeops/00-roadmap.md` |

**Deliverables**:
- [ ] All 32 ST cases green; impl tiers green; full verify green; roadmap synced

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> This checklist is the **single source of truth** for tracking progress across all phases.
> The executing agent MUST:
>
> 1. **After completing each task:** mark it `[x]` with a timestamp — e.g., `- [x] 1.1.1 Task description ✅ (completed: YYYY-MM-DD HH:MM)`
> 2. **After completing each phase:** confirm every completed task in that phase is marked `[x]` with a timestamp
> 3. **Update the Progress header** (`> **Progress**: X/Y tasks (Z%)`) after every update
> 4. **This checklist MUST exist** — if missing or incomplete, reconstruct it from the phase details above before executing any task
> 5. **Never batch updates** — update immediately after each task, not at the end of a session
>
> Failure to maintain this checklist means progress is invisible after crashes, context resets, or session handoffs.

### Phase 1: Foundations
- [x] 1.1.1 Write ST-32 spec test for the 9 config diag codes ✅ (completed: 2026-07-02 10:05)
- [x] 1.1.2 Red phase: verify ST-32 fails ✅ (completed: 2026-07-02 10:06 — 2/2 tests fail, codes undefined)
- [x] 1.1.3 Add E10240–E10246 + W10240/W10241 to `DiagCode` ✅ (completed: 2026-07-02 10:08)
- [x] 1.1.4 Green phase: ST-32 passes; core suite regression-free ✅ (completed: 2026-07-02 10:09 — 178/178 core tests green)
- [x] 1.2.1 Add `jsonc-parser` dep; NodeNext import checkpoint ✅ (completed: 2026-07-02 10:15)
  > **Checkpoint notes (AR-P1):** `jsonc-parser@3.3.1` pinned exact. (a) Named ESM
  > imports (`import { parseTree, visit, type Node, type ParseError } from "jsonc-parser"`)
  > typecheck under NodeNext AND resolve at runtime (`node --input-type=module` smoke) —
  > no namespace-import fallback needed; the package has no `exports` field, so NodeNext
  > falls back to `main` (UMD/CJS) whose named exports Node's CJS interop detects fine.
  > (b) Offset semantics CONFIRMED as UTF-16 code-unit string indices: for
  > `{"a☕b": }` (9 code units / 11 UTF-8 bytes) the ParseError offset is 8 — the string
  > index of `}` — not the byte offset 10. PF-017 code-unit→byte conversion is required.
- [x] 1.2.2 Create `types.ts` (incl. `CONFIG_SOURCE_ID`, `SYNTHETIC_SPAN_STRIDE`) ✅ (completed: 2026-07-02 10:18)
- [x] 1.2.3 Create `defaults.ts` (`CONFIG_DEFAULTS` + `CONFIG_SCHEMA`; `entryRule` added to `SchemaEntry` for per-entry W-code checks — within AR-P6/PF-019 intent) ✅ (completed: 2026-07-02 10:20)
- [x] 1.2.4 Package typecheck + lint ✅ (completed: 2026-07-02 10:21 — both clean)

### Phase 2: Discovery & JSONC parse
- [x] 2.1.1 Write discovery spec tests (ST-5) ✅ (completed: 2026-07-02 10:24)
- [x] 2.1.2 Write parse spec tests (ST-6..ST-9, parse-level column only) ✅ (completed: 2026-07-02 10:24)
- [x] 2.1.3 Red phase: verify both fail ✅ (completed: 2026-07-02 10:25 — both files fail: target modules do not exist)
- [x] 2.2.1 Implement `discovery.ts` ✅ (completed: 2026-07-02 10:28)
- [x] 2.2.2 Implement `parse.ts` (+ offset converter; byte-offset conversion of parse errors — PF-017) ✅ (completed: 2026-07-02 10:28)
- [x] 2.2.3 Green phase: spec tests pass ✅ (completed: 2026-07-02 10:29 — 11/11 config tests green)
- [x] 2.3.1 Discovery impl tests ✅ (completed: 2026-07-02 10:35)
- [x] 2.3.2 Parse impl tests (incl. AR-P10 BOM strip — see register; `JsoncParseResult.text` added so consumers share the normalized offset base) ✅ (completed: 2026-07-02 10:36)
- [x] 2.3.3 Package verify ✅ (completed: 2026-07-02 10:37 — 24/24 tests, typecheck + lint clean; vitest include widened to the impl tier per the core RD-11a precedent)

### Phase 3: Validation & merge
- [ ] 3.1.1 Write validate spec tests (ST-10..ST-24)
- [ ] 3.1.2 Write merge spec tests (ST-25..ST-27)
- [ ] 3.1.3 Red phase: verify both fail
- [ ] 3.2.1 Implement `validate.ts` (shape + semantics + AR-P5 rule)
- [ ] 3.2.2 Implement `merge.ts`
- [ ] 3.2.3 Green phase: spec tests pass
- [ ] 3.3.1 Validate impl tests
- [ ] 3.3.2 Package verify

### Phase 4: `loadConfig()`, E2E & closeout
- [ ] 4.1.1 Write loader spec tests (ST-1..ST-4, ST-7..ST-9, ST-28..ST-31)
- [ ] 4.1.2 Replace stub `index.spec.test.ts` with public-API surface test
- [ ] 4.1.3 Red phase: verify both fail
- [ ] 4.2.1 Implement `load-config.ts`
- [ ] 4.2.2 Implement `index.ts` public entry
- [ ] 4.2.3 Green phase: spec tests pass
- [ ] 4.3.1 Loader impl tests
- [ ] 4.3.2 AC-13 data-only audit + security checklist
- [ ] 4.3.3 Full workspace verify + `spec/` untouched check
- [ ] 4.3.4 AC-01..AC-14 audit
- [ ] 4.3.5 Roadmap update (feature + portfolio)

---

## Dependencies

```
Phase 1 (codes, dep, types/defaults)
    ↓
Phase 2 (discovery.ts, parse.ts — consume types/defaults, jsonc-parser)
    ↓
Phase 3 (validate.ts, merge.ts — consume parse trees for spans, schema table)
    ↓
Phase 4 (load-config.ts orchestrates all modules; index.ts; audits; roadmap)
```

No cross-phase cycles; within a phase, spec-test sessions strictly precede
implementation sessions (specification-first ordering, non-negotiable).

---

## Success Criteria

**Feature is complete when:**

1. ✅ All 4 phases / 36 tasks completed
2. ✅ Full verify green: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`
3. ✅ No warnings/errors; `spec/` untouched (D3)
4. ✅ No dead code — the `VERSION` stub is gone; every export consumed or public API
5. ✅ Security hardened — schema allowlist, R29 traversal rejection, data-only config (AC-13), acmePath trust note honored
6. ✅ RD-16 AC-01..AC-14 all ticked with evidence
7. ✅ JSDoc on every exported symbol
8. ✅ Roadmap synced; post-completion re-analysis (exec_plan skill)
