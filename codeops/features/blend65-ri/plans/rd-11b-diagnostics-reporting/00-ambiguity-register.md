# Ambiguity Register: RD-11b — Diagnostics Remainder & Resource Reporter

> **Status**: ✅ GATE PASSED — all 16 items resolved
> **Last Updated**: 2026-07-03
> **Feature**: blend65-ri · **Implements**: RD-11 (the RD-11b slice)
>
> Q1–Q13 were presented as one batch and resolved by the user's explicit
> "all as recommended" (2026-07-03). Q14–Q16 surfaced during authoring
> (surface-during-authoring rule) and were resolved via explicit per-item
> selection the same day. Q3–Q6, Q14–Q16 amend preflighted RD-11 text; the
> amendments are back-propagated to `requirements/RD-11-diagnostics-reporting.md`
> and recorded in the requirements register as AR-103/AR-104/AR-105.
>
> **Hardening disclosure** (per `_shared/recommendation-hardening.md`): one
> independent challenger was spawned for the ResourceReport cluster (Q3/Q4/Q5/Q6).
> Verdict: converged on Q3/Q4/Q5; **diverged on Q6** (challenger argued for real
> ZP data over strict-R47 zeros; reconciliation adopted the challenger's pick,
> both options were presented, user ratified). Confidence: High across the
> register after user ratification.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| Q1 | Naming | Plan folder name | `rd-11b-diagnostics-reporting` / alternatives | `rd-11b-diagnostics-reporting` (pairs with archived `rd-11a-diagnostics-core`) | ✅ Resolved |
| Q2 | Technical | Core module layout for the new files | all-in-`diagnostics/` vs. `diagnostics/` additions + new `report/` module | New files in `diagnostics/` (`source-map.ts`, `severity-policy.ts`, `render-terminal.ts`, `render-json.ts`); new sibling module `packages/core/src/report/` with its own barrel, re-exported from the root barrel | ✅ Resolved |
| Q3 | Integration | Report assembly ownership — RD §4.8 exports no builder, yet scope says "aggregator" (AR-79) and AC-15 needs an executable artifact | (a) pure `buildResourceReport()` in core; (b) defer wholly to RD-15; (c) also add serializer boundary labels | (a): pure `buildResourceReport(inputs)` in core taking `AllocationPlan` + pre-extracted ACME/plugin numbers; no I/O, no label parsing (no boundary labels exist — `packages/codegen/src/instr/serialize-acme.ts` verified); absent inputs → undefined → zeros (AR-102); RD-15 wires real values. (b) rejected: AC-15 degenerates to "the type compiles". (c) rejected: reopens shipped RD-09 for cosmetic lines | ✅ Resolved |
| Q4 | Behavioral | Who emits E10034 (binary budget, post-ACME half of AC-17)? | core pure helper vs. defer to RD-15 | Pure `checkBinaryBudget(report, bag)` in the report module — no-op when `binarySize` undefined; emits E10034 with the Ch 14 message when `binarySize > binaryBudget`; RD-15 calls it after `emitBinary` | ✅ Resolved |
| Q5 | Data & state | Ch 11 §6 layout needs Platform/Target/address-ranges; `ResourceReport` (§4.6) has no such fields | (a) add fields to the type; (b) options-bag on the terminal renderer; (c) placeholders + defer | (a): add required `platformName`/`targetName` + optional per-segment `SegmentRange` fields. Decisive argument: JSON parity — `renderReportJson(report)` is also single-arg; an options-bag would leave the machine-readable report without build identity. R48 ("shape complete from v1") argues for amending now | ✅ Resolved |
| Q6 | Scope | ZP category breakdown: strict-R47 zeros ("slice 2") vs. real data (shipped `AllocationPlan.zpAllocations`) | (a) strict zeros; (b) add optional `zpAllocations?: readonly ZpAllocation[]` and render real sums | (b): add the optional field now and render real category sums. R48's "complete from v1 … prevents later reshaping" — adding the field in slice 2 *is* that reshaping; AR-102's zero rule is conditioned on the source being offline, but this source shipped in RD-05. Sub-decision: `arg-block` (no line in the frozen layout) folds into "Compiler temps". Challenger diverged from the author's initial strict-zeros lean; reconciliation adopted (b); user ratified | ✅ Resolved |
| Q7 | Technical | `SourceMap.intern()` re-intern semantics; unknown-id behavior; how the renderer detects unresolvable ids (R51) | append-only ids vs. path-keyed; throw vs. undefined getters | Path-keyed: same path + same content → same id (no-op); same path + new content → same id, content replaced, cached `LineMap` invalidated (LSP-friendly). Getters throw on unknown id (programmer error). Add `has(id): boolean` (additive §4.2 amendment) as the renderer's non-throwing probe for R51 | ✅ Resolved |
| Q8 | UX | Terminal renderer composition | (composition alternatives) | One blank line between diagnostic blocks; **no** summary footer (RD-15 owns the "N errors" summary); `= note:` / `= help:` lines after the excerpt (gutter-aligned); each secondary span as its own mini-block (`--> file:line:col` + excerpt + carets + label); promoted warnings render `error[W10xxx]` — code string unchanged | ✅ Resolved |
| Q9 | UX | Color mapping (AR-17, hand-rolled SGR) | (scheme alternatives) | `error[code]` bold red / `warning[code]` bold yellow; carets (+ secondary-span labels) in severity color; gutter (`-->`, line numbers, `\|`, `=`) cyan; message and source text uncolored. Golden-locked in color and no-color modes | ✅ Resolved |
| Q10 | Data & state | JSON schemas for `renderJson` / `renderReportJson` | (schema alternatives) | `renderJson`: top-level **array** of Diagnostic-shaped objects, raw spans verbatim (R51), `help` omitted when absent, 2-space indent + trailing newline. `renderReportJson`: single object mirroring `ResourceReport`; `ruleHits` as name-sorted `[string, number][]` (PF-012); `zpAllocations` as a plain array; undefined optionals omitted | ✅ Resolved |
| Q11 | UX | Number formatting in the build summary | locale API vs. hand-rolled | Hand-rolled comma grouping (no `toLocaleString` — locale nondeterminism); `Math.round` percentages (`0%` when budget is 0); geometry transcribed verbatim from §4.7 with numbers right-aligned in the template's field widths (wider numbers extend rightward); startup line renders `0 bytes, 0 cycles` when undefined; `peepholeStats` **not** in the terminal layout (no line exists in Ch 11 §6) — JSON only | ✅ Resolved |
| Q12 | Scope | AC-08/AC-09/R16 disposition | re-implement vs. close by audit | Close by audit evidence: sentinels at `packages/core/src/ast/node-kind.ts:75-77` (RD-03), poison-type cascade (RD-04), `Instr.sourceSpan` (RD-07a). A verification task in the plan; no new implementation | ✅ Resolved |
| Q13 | Technical | Phase structure | (orderings) | 4 phases: ① SourceMap → ② Severity policy → ③ Diagnostic renderers → ④ ResourceReport + renderers + E2E/closeout; each with the mandatory spec-tests→red→implement→green→impl-tests ordering | ✅ Resolved |
| Q14 | UX | Ch 14 §1 example shows a primary-caret label ("extra argument") but the shipped `Diagnostic` record has no primary-label field | (a) carets only; (b) additive `primaryLabel?` on the record | (a) **Carets only** — primary caret line renders carets with no trailing label; keeps the shipped RD-11a record frozen; R33's enumerated elements don't include a label; producers use `notes[]` or a secondary span | ✅ Resolved |
| Q15 | Data & state | Hardware-stack block needs depth/overhead breakdown; `SfaResourceData` carries only totals — breakdown lives in shipped `AllocationPlan.stackAnalysis` | (a) embed `StackAnalysis`; (b) render depth lines as zeros | (a) **Embed StackAnalysis** — add optional `stackAnalysis?: StackAnalysis` to `ResourceReport`, embedded verbatim by `buildResourceReport` (the Q6/PF-002 pattern); depth/overhead lines render real values; zeros only for hand-built reports without it | ✅ Resolved |
| Q16 | UX | AC-18 "ranges when available" vs. AR-102 "values only, never geometry" — unpopulated range rendering | placeholder vs. conditional suffix | **Placeholder `($0000–$0000)`** — the range suffix always prints; unpopulated ranges render as `($0000–$0000)`; when RD-15 wires real ranges only values change, never line geometry; goldens stay layout-stable across slices | ✅ Resolved |

### Resolution Notes

**Q3/Q4/Q5/Q6 (the ResourceReport cluster):** These four amend preflighted RD-11
text (§4.6 type, §4.7/§4.8 signatures/exports, the R47 slice-2 note). Recorded in
the requirements register as **AR-103** and applied to the RD the same day. The
grounding facts: the ACME serializer emits no segment boundary labels, so code/data
segment sizes are not derivable in RD-11b (Q3's no-label-parsing consequence);
`AllocationPlan.zpAllocations` and `.stackAnalysis` shipped in RD-05 (Q6/Q15's
data-online premise).

**Q7 (SourceMap semantics):** Recorded as **AR-104**. The `has()` addition exists
specifically so `renderTerminal` can implement R51's graceful degradation (the
RD-16 `CONFIG_SOURCE_ID = -2` sentinel is the concrete case) without a throwing
probe.

**Q8/Q9/Q10/Q11/Q14/Q16 (presentation contract):** Recorded as **AR-105**. These
fix every renderer output detail the RD left open; the golden/spec tests in
`07-testing-strategy.md` transcribe them and become the enforcement mechanism.

**Q12:** No back-propagation needed — a disposition of existing acceptance
criteria, not an RD change.

**Q15/Q16:** Surfaced during authoring after the Q1–Q13 batch; folded into
AR-103 (Q15) and AR-105 (Q16) during back-propagation.
