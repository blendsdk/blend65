# Testing Strategy: RD-11b — Diagnostics Remainder & Resource Reporter

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- Unit tests: every exported function's happy path, edge/boundary, and error/invalid-input behavior (AR-22 tier 1, AC-20)
- Integration: the bag → policy → renderTerminal chain (library-first pipeline, R36–R38)
- Golden snapshots: renderer output byte-locked in color and no-color modes (R26/H5 determinism; PF-007/PF-013 "golden-locked")

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived EXCLUSIVELY from RD-11 (as amended by AR-103/104/105), spec Ch 14 §1,
> spec Ch 11 §6, and the Ambiguity Register — never from implementation.
> **IMMUTABLE ORACLE RULE:** if an implementation disagrees with an ST case, the
> implementation is wrong. Every case carries its source.

### SourceMap (`source-map.spec.test.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-1 | `intern('a.blend', A)` then `intern('b.blend', B)` | ids `0` then `1`; `getPath`/`getContent` round-trip both | §4.2, AR-Q7 |
| ST-2 | `getLineMap(id).getLineCol(offset)` on interned content | correct 1-based line/byte-column; two `getLineMap(id)` calls return the **same instance** (cache) | R14/PF-006 |
| ST-3 | Re-intern same path + same content | same id returned; no new id consumed (next new path still gets sequential id) | AR-Q7 |
| ST-4 | Re-intern same path + different content | same id; `getContent` returns new content; `getLineMap` returns a **new** instance resolving new offsets | AR-Q7 |
| ST-5 | `has(0)`→true after intern; `has(-2)`→false; `getPath(-2)`/`getContent(99)`/`getLineMap(99)` | `has` never throws; all three getters throw `Error` containing `"Unknown SourceId"` | AR-Q7/AR-104, R51 |

### Severity policy (`severity-policy.spec.test.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-6 | `createSeverityPolicy({warnAsError: true, suppressWarnings: []})` over `[error, warning]` | warning becomes `severity:'error'` with **code string unchanged** (`W…`); error untouched | R28, AR-Q8 |
| ST-7 | `warnAsError: ['W10030']` over `[W10030-warning, W10191-warning]` | only W10030 promoted; W10191 stays a warning | R29 |
| ST-8 | `suppressWarnings: ['W10191']` over `[W10191-warning, error]` | W10191 **removed** from output; error untouched | R30 |
| ST-9 | Same code in both `warnAsError:['W10030']` and `suppressWarnings:['W10030']`; also blanket `warnAsError:true` + `suppressWarnings:['W10030']` | suppressed in both cases — suppression wins | R50/PF-011 |
| ST-10 | Mixed input incl. an ICE (`E90001`) and the E10000 sentinel | errors/ICEs/sentinel pass through untouched; input order preserved; input array and records not mutated | R27/R31 |
| ST-11 | 25 warnings under blanket promotion (bag cap default 20) | all 25 appear as errors — promotion is exempt from `--max-errors` | R31/PF-014 |

### Terminal renderer (`render-terminal.spec.test.ts` + `render-terminal.security.spec.test.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-12 | E10042 at `player.blend:42:5`, span covering `poke($D020, 0, 1)` — **excluding** the `;` (bytes [4, 21) of the line; the §1 block has exactly 17 carets, plan preflight PF-001), color:false | golden: exactly the Ch 14 §1 block — header, `  --> player.blend:42:5`, gutter, excerpt, caret run, **no caret label** | Ch 14 §1, R33, AR-Q14 |
| ST-13 | Same diagnostic, color:true | golden with SGR: bold-red `error[E10042]`, cyan gutter, red carets; stripping SGR yields the ST-12 output byte-for-byte | AR-Q9/AR-17 |
| ST-14 | ICE with `primarySpan: null` | header line (+notes/help if present) only; no `-->`; notes/help at the fixed 3-space indent (plan preflight PF-004); no throw | R51/PF-009 |
| ST-15 | Diagnostic with `sourceId: -2` (config sentinel) not interned | same degradation as ST-14; no throw | R51/PF-009, RD-16 AR-P2 |
| ST-16 | Span crossing a line break | carets from span start to end of **first** line only | R33/PF-013 |
| ST-17 | Line containing a TAB before the span | TAB rendered literally; caret indent counts the TAB as 1 byte | R33/PF-007 |
| ST-18 | **Security**: source line containing `ESC[31m` (0x1B), C1 bytes, and a TAB | ESC and C1 stripped from the excerpt; TAB preserved; carets still align (computed post-strip); output contains no 0x1B from the *source* | R52/PF-010 |
| ST-19 | Diagnostic with a secondary span (other file, line-number width differing from the primary's), two notes, help | secondary mini-block with `-->`, excerpt, carets + label, using its **own** gutter width; `= note:` ×2 then `= help:` aligned to the **primary** excerpt's gutter (plan preflight PF-004); blocks separated by one blank line; trailing newline; no summary footer | R9–R11, AR-Q8, plan preflight PF-004 |

### JSON renderer (`render-json.spec.test.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-20 | Two diagnostics, one with the `-2` sentinel span | `JSON.parse` succeeds; top-level array of 2; spans verbatim (incl. `sourceId: -2`); fields mirror the record | AC-13, R51, AR-Q10 |
| ST-21 | Diagnostic without `help` | `"help"` key absent (not `null`); 2-space indent; trailing newline | AR-Q10 |

### Resource report (`resource-report.spec.test.ts`, `render-report-terminal.golden.spec.test.ts`, `render-report-json.spec.test.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-22 | `buildResourceReport` from a constructed `AllocationPlan` + numbers | `report.sfa === plan.resourceData`, `report.zpAllocations === plan.zpAllocations`, `report.stackAnalysis === plan.stackAnalysis` (embedded, not copied); scalars copied through | R40/R41/PF-002, AR-Q3/Q6/Q15 |
| ST-23 | `checkBinaryBudget`: size 40961 vs budget 40960 / 40960 vs 40960 / undefined size | over → exactly one E10034, null span, message `Output binary (40961 bytes) exceeds platform 'c64' maximum binary size (40960 bytes)`; equal → nothing; undefined → nothing | R42/AC-17, Ch 14 E10034, AR-Q4 |
| ST-24 | Fully-populated report, `renderReportTerminal` | golden: the complete Ch 11 §6 layout — `=== Blend65 Build Summary ===`, Platform/Target, 4 segment lines with ranges + literal suffixes, ZP block, stack block, startup, total binary; comma grouping (`1,247`); `Math.round` percentages | AC-18/PF-003, AR-Q11 |
| ST-25 | Minimal report (only `sfa` + identity + budget; every optional absent) | golden: **identical line set/geometry** to ST-24 — zeros and `($0000–$0000)` placeholders; zero budgets render `0%` | AR-102, AR-Q16/Q11 |
| ST-26 | `zpAllocations` with all 5 categories incl. `arg-block` | User/pointer/irq-temp sums on their lines; `arg-block` bytes **added to Compiler temps**; ZP Total from `zpUsed/zpBudget` (not the category sum) | AR-Q6 |
| ST-27 | Report with `peepholeStats` (unsorted Map), `renderReportJson` | parseable; `ruleHits` as name-sorted `[string, number][]`; absent optionals omitted; `peepholeStats` absent from the **terminal** output | AC-19, PF-012, AR-Q10/Q11 |

### Export surface (`packages/core/src/index.spec.test.ts` — extend)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-28 | `import * as core from '@blend65/core'` | all 9 new value exports defined (`createSourceMap`, `applySeverityPolicy`, `createSeverityPolicy`, `renderTerminal`, `renderJson`, `buildResourceReport`, `checkBinaryBudget`, `renderReportTerminal`, `renderReportJson`); the 6 new type exports (`SourceMap`, `SeverityPolicy`, `ResourceReport`, `PeepholeStats`, `SegmentRange`, `BuildResourceReportInputs`) compile (plan preflight PF-002) | §4.8 (AR-103/104) |

> **⚠️ AUTHORING RULE:** every expectation above is transcribed from the RD/spec/AR
> sources cited — none from implementation. New gaps found while writing tests
> go to the Ambiguity Register first (surface-during-authoring).

## Test Categories

### Specification Tests (files, per phase)

| Test File | ST Cases | Component |
| --------- | -------- | --------- |
| `diagnostics/source-map.spec.test.ts` | ST-1..5 | SourceMap |
| `diagnostics/severity-policy.spec.test.ts` | ST-6..11 | Severity policy |
| `diagnostics/render-terminal.spec.test.ts` | ST-12..17, ST-19 | Terminal renderer |
| `diagnostics/render-terminal.security.spec.test.ts` | ST-18 | R52 security (mandatory) |
| `diagnostics/render-json.spec.test.ts` | ST-20..21 | JSON renderer |
| `report/resource-report.spec.test.ts` | ST-22..23 | Builder + budget check |
| `report/render-report-terminal.golden.spec.test.ts` | ST-24..26 | Report table (golden) |
| `report/render-report-json.spec.test.ts` | ST-27 | Report JSON |
| `index.spec.test.ts` (extended) | ST-28 | Export surface |

### Implementation Tests (after green phase)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `diagnostics/source-map.impl.test.ts` | cache identity/invalidation, empty file, id sequencing, fractional ids | High |
| `diagnostics/severity-policy.impl.test.ts` | empty/all-suppressed input, non-mutation, copy integrity, idempotence | High |
| `diagnostics/render-terminal.impl.test.ts` | gutter ≥100, EOF caret, empty span (1 caret), CRLF, multi-byte UTF-8 | High |
| `diagnostics/render-json.impl.test.ts` | empty array, deep-field fidelity | Med |
| `report/resource-report.impl.test.ts` | grouping 999/1000/1e6, pct boundaries, arg-block-only fold, width overflow | High |

### Integration Tests

| Test | Components | Description |
| ---- | ---------- | ----------- |
| bag→policy→render chain (`diagnostics/pipeline.impl.test.ts`) | DiagnosticBag + SeverityPolicy + renderTerminal/renderJson | Populate a bag (errors, warnings, ICE, sentinel-span config diag), apply policy, render both formats — proves the R36–R38 library-first flow with zero printing inside core |

### End-to-End Tests

Full-pipeline E2E (source → diagnostics → rendered output via the CLI) is RD-15's;
this plan's chain test above is the core-side E2E per AR-77 (the compiler facade
returns `Diagnostic[]`; rendering happens in the consumer).

## Test Data

### Fixtures Needed
- Ch 14 §1 sample source line (`    poke($D020, 0, 1);`) and the §4.7 build-summary values (both transcribed into golden strings inside the spec files — no fixture files; matches the RD-09 golden precedent).
- A hand-built `AllocationPlan` literal (all sub-records) for ST-22/24/26.

### Mock Requirements
None — everything is pure data → string. Real `DiagnosticBag`, real `LineMap` (project standard: real objects over mocks).

## Verification Checklist
- [ ] All ST cases defined with concrete input/output pairs
- [ ] Every ST case traces to an RD row, spec section, or AR entry
- [ ] Spec tests written BEFORE implementation; red phase documented
- [ ] Green phase: all spec tests pass unmodified
- [ ] Impl tests cover edge cases and internals
- [ ] Security test ST-18 present and passing (R52 mandatory)
- [ ] Full workspace verify green (`yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`)
