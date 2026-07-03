# Execution Plan: RD-11b — Diagnostics Remainder & Resource Reporter

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-03
> **Progress**: 24/39 tasks (62%)
> **CodeOps Skills Version**: 3.1.0

## Overview

Implement the RD-11b slice in `@blend65/core`: SourceMap → severity policy →
diagnostic renderers → resource report + closeout. Four phases, each with the
mandatory spec-tests → red → implement → green → impl-tests ordering. All work
is additive — no shipped file changes behavior.

**🚨 Update this document after EACH completed task!**

Commits reference **/gitcm** per the exec_plan skill's commit mode; scope
`feat(rd-11b): …` / `test(rd-11b): …`.

---

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
| ----- | ----- | -------- | --------- |
| 1 | SourceMap registry | 3 | ~2 h |
| 2 | Severity policy | 3 | ~2 h |
| 3 | Diagnostic renderers | 3 | ~4 h |
| 4 | Resource report + closeout | 3 | ~4 h |

**Total: 12 sessions, ~10–12 hours**

---

## Phase 1: SourceMap registry

### Session 1.1: Specification tests (red)
**Reference**: [03-01-sourcemap.md](03-01-sourcemap.md) · ST-1..ST-5
**Objective**: Spec tests exist and fail (module not implemented).

| # | Task | File |
| ----- | ---- | ---- |
| 1.1.1 | Write ST-1..ST-5 from 07-testing-strategy.md (do NOT read implementation — none exists) | `packages/core/src/diagnostics/source-map.spec.test.ts` |
| 1.1.2 | Run the file — verify all fail (red); record the red run in this doc | — |

> **Red run (2026-07-03):** `yarn vitest run src/diagnostics/source-map.spec.test.ts` →
> `FAIL … Failed to load url ./source-map.js … Does the file exist?` — 1 suite failed,
> 0 tests collected. Red confirmed (module not implemented).

### Session 1.2: Implementation (green)
| # | Task | File |
| ----- | ---- | ---- |
| 1.2.1 | Implement `SourceMap`/`createSourceMap` per 03-01 (path-keyed intern, `has`, throwing getters, LineMap cache) | `packages/core/src/diagnostics/source-map.ts` |
| 1.2.2 | Export from the diagnostics barrel | `packages/core/src/diagnostics/index.ts` |
| 1.2.3 | Run spec tests — verify ALL pass unmodified (green) | — |

### Session 1.3: Impl tests & hardening
| # | Task | File |
| ----- | ---- | ---- |
| 1.3.1 | Impl tests: cache identity/invalidation, empty content, id sequencing, fractional/negative ids | `packages/core/src/diagnostics/source-map.impl.test.ts` |
| 1.3.2 | Full verify (command below) | — |

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 2: Severity policy

### Session 2.1: Specification tests (red)
**Reference**: [03-02-severity-policy.md](03-02-severity-policy.md) · ST-6..ST-11

| # | Task | File |
| ----- | ---- | ---- |
| 2.1.1 | Write ST-6..ST-11 | `packages/core/src/diagnostics/severity-policy.spec.test.ts` |
| 2.1.2 | Red run verified & recorded | — |

### Session 2.2: Implementation (green)
| # | Task | File |
| ----- | ---- | ---- |
| 2.2.1 | Implement `SeverityPolicy`/`createSeverityPolicy`/`applySeverityPolicy` per 03-02 (R50 precedence, pure, order-preserving) | `packages/core/src/diagnostics/severity-policy.ts` |
| 2.2.2 | Barrel export; green run verified | `packages/core/src/diagnostics/index.ts` |

### Session 2.3: Impl tests & hardening
| # | Task | File |
| ----- | ---- | ---- |
| 2.3.1 | Impl tests: empty input, non-mutation, copy integrity, idempotence | `packages/core/src/diagnostics/severity-policy.impl.test.ts` |
| 2.3.2 | Full verify | — |

---

## Phase 3: Diagnostic renderers

### Session 3.1: Specification tests (red)
**Reference**: [03-03-diagnostic-renderers.md](03-03-diagnostic-renderers.md) · ST-12..ST-21

| # | Task | File |
| ----- | ---- | ---- |
| 3.1.1 | Write ST-12..ST-17, ST-19 (golden blocks transcribed from Ch 14 §1 + AR-105) | `packages/core/src/diagnostics/render-terminal.spec.test.ts` |
| 3.1.2 | Write ST-18 (R52 security — mandatory) | `packages/core/src/diagnostics/render-terminal.security.spec.test.ts` |
| 3.1.3 | Write ST-20..ST-21 | `packages/core/src/diagnostics/render-json.spec.test.ts` |
| 3.1.4 | Red run verified & recorded | — |

### Session 3.2: Implementation (green)
| # | Task | File |
| ----- | ---- | ---- |
| 3.2.1 | Internal SGR constants + `paint` helper (not exported from barrel) | `packages/core/src/diagnostics/ansi.ts` |
| 3.2.2 | Implement `renderTerminal` per 03-03 (block format, R51 degradation, R52 sanitize-then-caret, AR-Q9 color map) | `packages/core/src/diagnostics/render-terminal.ts` |
| 3.2.3 | Implement `renderJson` (array, raw spans, 2-space, trailing newline) | `packages/core/src/diagnostics/render-json.ts` |
| 3.2.4 | Barrel exports; green run verified | `packages/core/src/diagnostics/index.ts` |

### Session 3.3: Impl tests & hardening
| # | Task | File |
| ----- | ---- | ---- |
| 3.3.1 | Impl tests: gutter ≥100, EOF/empty-span carets, CRLF, multi-byte UTF-8, color/no-color byte diff | `packages/core/src/diagnostics/render-terminal.impl.test.ts` |
| 3.3.2 | Impl tests: empty array, field fidelity | `packages/core/src/diagnostics/render-json.impl.test.ts` |
| 3.3.3 | Full verify | — |

---

## Phase 4: Resource report + closeout

### Session 4.1: Specification tests (red)
**Reference**: [03-04-resource-report.md](03-04-resource-report.md) · ST-22..ST-28

| # | Task | File |
| ----- | ---- | ---- |
| 4.1.1 | Write ST-22..ST-23 (builder embedding, E10034 boundary trio) | `packages/core/src/report/resource-report.spec.test.ts` |
| 4.1.2 | Write ST-24..ST-26 (golden full/minimal/ZP-fold — layout transcribed from §4.7 + AR-Q11/Q16) | `packages/core/src/report/render-report-terminal.golden.spec.test.ts` |
| 4.1.3 | Write ST-27 | `packages/core/src/report/render-report-json.spec.test.ts` |
| 4.1.4 | Extend export-surface spec with ST-28 | `packages/core/src/index.spec.test.ts` |
| 4.1.5 | Red run verified & recorded | — |

### Session 4.2: Implementation (green)
| # | Task | File |
| ----- | ---- | ---- |
| 4.2.1 | Types: `SegmentRange`, `PeepholeStats`, `ResourceReport` per 03-04 (AR-103 shape) | `packages/core/src/report/resource-report.ts` |
| 4.2.2 | `BuildResourceReportInputs`, `buildResourceReport`, `checkBinaryBudget` | `packages/core/src/report/build-resource-report.ts` |
| 4.2.3 | `renderReportTerminal` (§4.7 verbatim geometry, zero/placeholder staging, grouping/pct helpers) | `packages/core/src/report/render-report-terminal.ts` |
| 4.2.4 | `renderReportJson` (mirror object, sorted `ruleHits` entries) | `packages/core/src/report/render-report-json.ts` |
| 4.2.5 | Report barrel + root-barrel export; green run verified (incl. ST-28) | `packages/core/src/report/index.ts`, `packages/core/src/index.ts` |

### Session 4.3: Impl tests, audits & closeout
| # | Task | File |
| ----- | ---- | ---- |
| 4.3.1 | Impl tests: grouping/pct boundaries, arg-block-only fold, embed identity, width overflow | `packages/core/src/report/resource-report.impl.test.ts` |
| 4.3.2 | Integration chain test: bag → policy → renderTerminal/renderJson (R36–R38) | `packages/core/src/diagnostics/pipeline.impl.test.ts` |
| 4.3.3 | AC audits with `file:line` evidence in this doc: AC-08/09 (sentinels + cascade, AR-Q12), AC-14 (no printing in core — data-only sweep for `console.*`/`process.stdout` under `packages/core/src`, `packages/frontend/src`), AC-17 pre-ACME half (shipped `budgets.ts`) | — |
| 4.3.4 | Tick RD-11 acceptance-criteria boxes owned by this plan (RD-11 §6) with ST evidence | `requirements/RD-11-diagnostics-reporting.md` |
| 4.3.5 | Full verify + roadmap/CLAUDE.md status sync (per exec_plan closeout) | — |

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> This checklist is the **single source of truth** for progress. The executing
> agent MUST: (1) mark each task `[x]` with a timestamp immediately on
> completion — never batched; (2) confirm all of a phase's tasks are ticked
> before leaving the phase; (3) update the `> **Progress**:` header after every
> update; (4) reconstruct this checklist from the phase tables above if it is
> ever missing.

### Phase 1: SourceMap registry
- [x] 1.1.1 ST-1..ST-5 spec tests written ✅ (completed: 2026-07-03)
- [x] 1.1.2 Red phase verified & recorded ✅ (completed: 2026-07-03)
- [x] 1.2.1 `source-map.ts` implemented ✅ (completed: 2026-07-03)
- [x] 1.2.2 Barrel export added ✅ (completed: 2026-07-03)
- [x] 1.2.3 Green phase verified ✅ (completed: 2026-07-03 — 5/5 pass unmodified)
- [x] 1.3.1 Impl tests written ✅ (completed: 2026-07-03)
- [x] 1.3.2 Full verify green ✅ (completed: 2026-07-03 — install/build/typecheck/lint/test all pass)

### Phase 2: Severity policy
- [x] 2.1.1 ST-6..ST-11 spec tests written ✅ (completed: 2026-07-03)
- [x] 2.1.2 Red phase verified & recorded ✅ (completed: 2026-07-03 — suite fails: `Failed to load url ./severity-policy.js`, module not implemented)
- [x] 2.2.1 `severity-policy.ts` implemented ✅ (completed: 2026-07-03)
- [x] 2.2.2 Barrel export + green phase verified ✅ (completed: 2026-07-03 — 6/6 pass unmodified)
- [x] 2.3.1 Impl tests written ✅ (completed: 2026-07-03)
- [x] 2.3.2 Full verify green ✅ (completed: 2026-07-03 — note: one flaky `frontend/parser.spec.test.ts` failure in the first parallel run, green on re-run and in isolation; unrelated to RD-11b)

### Phase 3: Diagnostic renderers
- [x] 3.1.1 ST-12..ST-17, ST-19 spec tests written ✅ (completed: 2026-07-03)
- [x] 3.1.2 ST-18 security spec test written ✅ (completed: 2026-07-03)
- [x] 3.1.3 ST-20..ST-21 spec tests written ✅ (completed: 2026-07-03)
- [x] 3.1.4 Red phase verified & recorded ✅ (completed: 2026-07-03 — all 3 suites fail: `Failed to load url ./render-terminal.js` / `./render-json.js`, modules not implemented)
- [x] 3.2.1 `ansi.ts` implemented ✅ (completed: 2026-07-03 — internal, not barrel-exported; also exported `utf8ByteLength` from `line-map.ts` for byte-column caret math, no behavior change)
- [x] 3.2.2 `render-terminal.ts` implemented ✅ (completed: 2026-07-03)
- [x] 3.2.3 `render-json.ts` implemented ✅ (completed: 2026-07-03)
- [x] 3.2.4 Barrel exports + green phase verified ✅ (completed: 2026-07-03 — 11/11 pass unmodified)
- [x] 3.3.1 Terminal impl tests written ✅ (completed: 2026-07-03)
- [x] 3.3.2 JSON impl tests written ✅ (completed: 2026-07-03)
- [x] 3.3.3 Full verify green ✅ (completed: 2026-07-03 — install/build/typecheck/lint/test all pass; core 220 tests)

### Phase 4: Resource report + closeout
- [ ] 4.1.1 ST-22..ST-23 spec tests written
- [ ] 4.1.2 ST-24..ST-26 golden spec tests written
- [ ] 4.1.3 ST-27 spec test written
- [ ] 4.1.4 ST-28 export-surface spec extended
- [ ] 4.1.5 Red phase verified & recorded
- [ ] 4.2.1 `resource-report.ts` types implemented
- [ ] 4.2.2 Builder + `checkBinaryBudget` implemented
- [ ] 4.2.3 `render-report-terminal.ts` implemented
- [ ] 4.2.4 `render-report-json.ts` implemented
- [ ] 4.2.5 Barrels + green phase verified (incl. ST-28)
- [ ] 4.3.1 Report impl tests written
- [ ] 4.3.2 Integration chain test written
- [ ] 4.3.3 AC-08/09/14/17(pre) audits recorded with evidence
- [ ] 4.3.4 RD-11 §6 acceptance boxes ticked with ST evidence
- [ ] 4.3.5 Full verify + roadmap/CLAUDE.md sync

---

## Dependencies

```
Phase 1 (SourceMap)
    ↓  (renderTerminal consumes SourceMap.has/getPath/getLineMap)
Phase 2 (Severity policy)   ← independent of Phase 1; ordered for pipeline narrative
    ↓  (renderers consume the policy-applied array)
Phase 3 (Diagnostic renderers)
    ↓  (report module is independent; closeout audits need everything)
Phase 4 (Resource report + closeout)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All 39 tasks completed, all phases green
2. ✅ Full workspace verify passing (build + typecheck + lint + test, incl. the R15 boundary tier)
3. ✅ No warnings/errors; no dead code (every export consumed by tests; `ansi.ts` internal)
4. ✅ Security: ST-18 (R52) passing; JSON via `JSON.stringify` only; total functions over hostile input
5. ✅ RD-11 §6 boxes AC-11..AC-13, AC-15, AC-17..AC-20 ticked with evidence; AC-08/09/14 audit-closed; AC-16 core-side noted (flag evidence → RD-15)
6. ✅ JSDoc on every exported symbol
7. ✅ Roadmap row moved to Done; CLAUDE.md status paragraph refreshed
8. ✅ Post-completion re-analysis (exec_plan skill)
