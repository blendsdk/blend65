# Requirements: RD-11b — Diagnostics Remainder & Resource Reporter

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-11](../../requirements/RD-11-diagnostics-reporting.md) (preflighted ✅ 2026-07-03, PF-001..PF-014 applied; RD-11b amendments AR-103/104/105 applied 2026-07-03)

## Feature Overview

Implement the RD-11b slice of RD-11 in `@blend65/core`: the `SourceMap` registry
(§4.2), the severity-policy layer (§3.6/§4.4), the diagnostic renderers
(§3.7/§4.5), and the resource report with its renderers (§3.9–§3.11/§4.6–§4.7).
RD-11a (span model, `LineMap`, `Diagnostic`, `DiagnosticBag`, code registry)
shipped and is the foundation; nothing in it is reopened (AR-Q14 explicitly
keeps the `Diagnostic` record frozen).

## Functional Requirements

### Must Have

RD requirement rows owned by this plan (numbering is RD-11's):

- [ ] **R13 (completion)** `SourceId` → path via the `SourceMap` registry; **R14** `SourceMap.getLineMap` builds and caches one `LineMap` per source; **R35** renderers resolve line/column via it (PF-006)
- [ ] **R27–R31, R50** Severity policy: central layer, blanket + selective promotion, suppression, applied exactly once post-collection, suppression wins over promotion (PF-011/PF-014), consumers derive build success from the policy-applied array (PF-005)
- [ ] **R32–R35, R51, R52** Diagnostic rendering: multi-renderer over the same `Diagnostic[]`, Ch 14 caret format with conditional hand-rolled ANSI color (PF-007/PF-013), JSON emitter, graceful degradation for unresolvable spans, control-character sanitization (mandatory security test)
- [ ] **R39–R42** `ResourceReport` data model: structured record, one owner per number (SFA data embedded verbatim, PF-002), budget-diagnostic timing split (E10034 post-ACME via `checkBinaryBudget`, AR-Q4)
- [ ] **R43–R46** Report rendering: Ch 11 §6 layout (normative, PF-003), AR-102 zero-value staging with `($0000–$0000)` range placeholders (AR-Q16), default-on/quiet posture documented for RD-15, `renderReportJson` (flag surfacing per RD-15 R24/R36, PF-001)
- [ ] **R47–R49** MVP scope: code+binary+budgets; shape complete from v1 — including the AR-103 additions (`platformName`, `targetName`, `SegmentRange` fields, `zpAllocations?`, `stackAnalysis?`); report warnings ride the AR-75 policy layer (already emitted by shipped `frontend/src/sfa/budgets.ts` — no new emission)

### Should Have

- [ ] Root-barrel export surface exactly per RD §4.8 (as amended by AR-103/104): `SourceMap`, `createSourceMap`, `SeverityPolicy`, `applySeverityPolicy`, `createSeverityPolicy`, `renderTerminal`, `renderJson`, `ResourceReport`, `PeepholeStats`, `SegmentRange`, `buildResourceReport`, `BuildResourceReportInputs`, `checkBinaryBudget`, `renderReportTerminal`, `renderReportJson` (15 symbols: 9 values + 6 types — plan preflight PF-002)
- [ ] AC-08/AC-09/R16 closed by audit with `file:line` evidence (AR-Q12); AC-14 (no printing in core) closed by a data-only audit sweep

### Won't Have (Out of Scope)

- CLI flags / wiring (`--warn-as-error`, `--diagnostics-format`, `--quiet`, `--emit-report`, `--report=json`) → **RD-15**
- `blend65.json` diagnostic settings → **RD-16** (shipped; `createSeverityPolicy` accepts its `BlendConfig` fields as-is)
- Per-phase diagnostic codes → RD-02..RD-09 (shipped)
- ACME segment-size *extraction* (no boundary labels exist; `codeSize`/`dataSize`/ranges arrive per AR-102 when a later slice adds them) → deferred, render-as-zero
- Per-function frame-size columns → RD-11 slice 2 (R47; the ZP breakdown moved into v1 per AR-Q6)
- Emulator verification → RD-12

## Technical Requirements

### Performance

- `SourceMap.getLineMap` caching (R14): O(n) `LineMap` construction happens once per source, not per diagnostic.
- Renderers are pure `data → string`; no I/O anywhere in core.

### Compatibility

- `@blend65/core` keeps **zero runtime dependencies** — ANSI via hand-rolled SGR constants (PF-007), number grouping hand-rolled (AR-Q11, no `toLocaleString`).
- ESM/NodeNext, intra-package imports carry `.js`; `import type` for type-only imports.
- R15/AR-20 boundary untouched: everything lands in core; no new cross-package edges.

### Security

- **R52**: `renderTerminal` strips C0/C1 control characters (tab excepted, R33) from echoed source lines — a hostile source file must not inject terminal escape sequences. Mandatory security spec test (ST-18); caret columns are computed against the sanitized line so alignment survives stripping.
- JSON emitters use `JSON.stringify` exclusively (no string-built JSON) — output is parseable and injection-safe by construction.
- All entry points are total over hostile input: unknown `SourceId` degrades per R51 (never throws in renderers); `checkBinaryBudget` is a no-op on absent data.

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
| -------- | ------------------ | ------ | --------- | ------ |
| Report assembly ownership | core builder / defer to RD-15 / serializer labels | core builder | AC-15 needs an executable artifact; ownership encoded in the signature | AR-Q3 |
| E10034 emission | core helper / RD-15 | core `checkBinaryBudget` | AC-17's post-ACME half unit-testable now | AR-Q4 |
| Missing renderer inputs | type fields / options-bag / defer | type fields | JSON parity; R48 shape-complete | AR-Q5 |
| ZP breakdown in v1 | strict-R47 zeros / embed shipped data | embed `zpAllocations?` | R48 anti-reshaping; source online since RD-05 | AR-Q6 |
| Stack block breakdown | embed `StackAnalysis` / zeros | embed `stackAnalysis?` | Q6-parity (PF-002 pattern) | AR-Q15 |
| Primary caret label | carets only / new record field | carets only | RD-11a record stays frozen | AR-Q14 |
| Range suffix staging | placeholder / conditional | `($0000–$0000)` placeholder | AR-102 geometry stability | AR-Q16 |

> **Traceability:** Every scope decision references the Ambiguity Register entry
> (AR-Q#) that resolved it — see `00-ambiguity-register.md`. RD-amending decisions
> additionally trace to requirements-register entries AR-103/104/105.

## Acceptance Criteria

RD-11 acceptance criteria owned or closed by this plan:

1. [ ] AC-11: `SeverityPolicy` correctly promotes and suppresses warnings
2. [ ] AC-12: Terminal renderer produces the Ch 14 caret format with conditional color
3. [ ] AC-13: JSON renderer produces parseable diagnostic JSON
4. [ ] AC-15: `ResourceReport` aggregates ZP/RAM/stack/binary data from correct owners
5. [ ] AC-16: Build summary default-on/quiet posture — core side delivered (renderers + report); flag wiring evidence deferred to RD-15
6. [ ] AC-17: Budget diagnostics fire at correct timing — pre-ACME half audited as shipped (RD-05), post-ACME half via `checkBinaryBudget`
7. [ ] AC-18: Terminal report renders the Ch 11 §6 layout (used/budget %, byte counts, range placeholders)
8. [ ] AC-19: `renderReportJson` produces parseable report JSON
9. [ ] AC-20: Unit tests cover ordering, dedup, max-errors (shipped RD-11a), severity policy (this plan)
10. [ ] AC-08/AC-09/AC-14: closed by audit with evidence (AR-Q12)
11. [ ] All tests pass (full workspace verify)
12. [ ] Documentation: JSDoc on every exported symbol; RD/roadmap sync complete
