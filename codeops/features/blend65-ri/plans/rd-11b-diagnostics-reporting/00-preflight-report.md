# Preflight Report: RD-11b — Diagnostics Remainder & Resource Reporter

> **Status**: ✅ PREFLIGHT PASSED WITH NOTES — 4 findings resolved & fixes applied (2026-07-03), 2 observations open (optional, non-blocking; user decision pending)
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/blend65-ri/plans/rd-11b-diagnostics-reporting/`
> **Codebase Grounded**: 14 source files + 3 spec/RD documents examined, 31 references verified (31 verified, 0 unverifiable)
> **Last Updated**: 2026-07-03
> **CodeOps Skills Version**: 3.1.0

> ⚠️ **SAME-DAY REVIEW**: This plan was authored 2026-07-03 (today) by the same model
> family in a prior session. Same-agent bias risk is elevated (though the reviewing
> session context is fresh). Mitigation applied: every external-standard claim was
> verified against the frozen spec text byte-level (Ch 14 §1 caret block, Ch 11 §6
> layout, E10034 message), not from memory.

> **PF numbering note**: `PF-NNN` below is THIS report's namespace. The plan documents
> cite `PF-001..PF-014` from RD-11's *requirements* preflight
> (`requirements/00-preflight-report.md`) — those are referenced here as "RD-11 PF-nnn".

## Codebase Context Summary

**Tech Stack:** TypeScript ESM/NodeNext, Yarn v1 workspaces + Turbo, Vitest; `@blend65/core` has zero runtime dependencies (verified: no `dependencies` key in `packages/core/package.json`).
**Architecture:** All RD-11b work is additive inside `@blend65/core` — `diagnostics/` gains 4 files + `ansi.ts`, new sibling `report/` module with barrel. No cross-package edges; R15 boundary untouched.
**Key Files Examined:**
- `packages/core/src/diagnostics/`: `source-span.ts` (registry deferral note at :16 ✓), `line-map.ts` (`getLineCol`/`getUtf16Column`/`getLineText`, total/clamping ✓), `diagnostic.ts` (frozen record, no primary-label field ✓), `diagnostic-bag.ts` (`createDiagnosticBag` at :103 ✓, pre-policy `hasErrors()` ✓, E10000 sentinel ✓), `diagnostic-codes.ts` (`BinaryTooLarge: "E10034"` at :40 ✓), `index.ts` barrel
- `packages/core/src/sfa/allocation-plan.ts`: `SfaResourceData` :125 ✓, `ZpAllocation` :49 (5 categories incl. `arg-block`) ✓, `StackAnalysis` :68 ✓, `AllocationPlan` :154 (carries `zpAllocations`/`stackAnalysis`/`resourceData`) ✓
- `packages/core/src/platform/platform-profile.ts`: `maxBinarySize` :78 ✓, `stackBudget` :84 ✓
- `packages/config/src/types.ts`: `CONFIG_SOURCE_ID = -2` :18 ✓, `warnAsError: boolean | string[]` / `suppressWarnings` :55–56 ✓, `LoadConfigOptions.sourceId` :104 ✓
- `packages/frontend/src/sfa/budgets.ts`: E10032/E10033 + W10030/W10033/W10180 emission shipped ✓
- `packages/compiler/src/acme/label-file.ts`: `parseLabelFile` :37 ✓; `packages/codegen/src/instr/serialize-acme.ts`: no segment boundary labels ✓
- `packages/core/src/ast/node-kind.ts`: `ErrorExpr`/`ErrorStmt`/`ErrorType` :75–77 ✓
- `packages/core/src/index.ts` (root barrel, `export *` pattern) + `index.spec.test.ts` (currently a VERSION smoke test — extendable)
- `spec/14-diagnostics.md` §1 (caret block, E10034 message :56) · `spec/11-memory-model.md` §6 (build-summary layout :201–230) · `RD-11-diagnostics-reporting.md` (R1–R52, §4.2–§4.8, AC-01..21) · requirements register AR-102..AR-105 ✓
- Golden naming precedent verified: `packages/compiler/src/assemble.golden.spec.test.ts` (RD-09)
- `grep PeepholeStats packages/` → no TS definition anywhere ✓ (RD-08 §4.8 prose only; shape `{totalApplications, ruleHits: Map, bytesSaved, cyclesSaved}` matches the plan's core-resident mirror)
- AC-14 baseline: `grep console./process.stdout/stderr packages/core/src` (non-test) → zero hits ✓

**Key Observations:**
- The plan's 16-item Ambiguity Register is exceptionally thorough; AR-103/104/105 back-propagation into RD-11 and the requirements register is confirmed present.
- Every `file:line` citation in `02-current-state.md` checked out — no phantom references, no stale assumptions found at the API level.
- The four findings below are all at the golden-transcription / doc-bookkeeping level; nothing touches the architecture or task ordering.

## Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | 1 (PF-004) | 🟡 |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | 1 (PF-003) | 🟡 |
| 4 | Completeness Gaps | 1 (PF-002, shared w/ 12) | 🟡 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 1 (PF-001) | 🟡 |
| 8 | Security Blind Spots | 1 (PF-005) | 🔵 |
| 9 | Edge Cases | 1 (PF-006) | 🔵 |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | (PF-002 co-located) | 🟡 |
| 13 | Codebase Alignment | 0 | — |

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 0 | — |
| MINOR | 4 | all resolved, fixes applied (2026-07-03) |
| OBSERVATION | 2 | open — optional, non-blocking (user away at decision time; re-ask before/at exec_plan) |

---

### PF-001: ST-12's described span contradicts its own golden (17 vs 18 carets) 🟡 MINOR

**Dimension:** Testability (7)
**Location:** `07-testing-strategy.md` ST-12 ("span covering `poke($D020, 0, 1);`"); same wording pattern feeds `03-03-diagnostic-renderers.md` §Code Examples
**Codebase Evidence:** `spec/14-diagnostics.md` §1 — the caret line is exactly 17 carets (`^^^^^^^^^^^^^^^^^`), covering `poke($D020, 0, 1)` *without* the trailing `;` (18 chars with it). Verified by character count against the frozen spec.
**The Problem:** ST-12 says the input span covers `poke($D020, 0, 1);` (18 bytes) while the expected output is "exactly the Ch 14 §1 block", which has 17 carets. A spec test authored from this description is self-contradictory: the correct renderer would emit 18 carets for the described span and "fail" the golden — and under the immutable-oracle rule the executor must stop and escalate rather than fix the test, costing a user round-trip mid-execution.

**Resolution:** Single viable fix — correct ST-12's input description to "span covering `poke($D020, 0, 1)` (excluding the `;`; bytes [4, 21) of the line)". Considered and dropped: changing the golden to 18 carets — it would deviate from the frozen Ch 14 §1 block that ST-12 explicitly transcribes (D3 forbids touching the spec, and the block is the normative format source).

**Recommendation:** Apply the input-description fix.
Confidence: High — verified against the spec text byte-level.
Hardening: no change (reframing prompts surfaced no alternative reading).

**User Decision:** Resolved — User accepted recommendation: fix ST-12/03-03 span description (span excludes the `;`, bytes [4, 21)) (2026-07-03). **Applied**: `07-testing-strategy.md` ST-12 input corrected.

---

### PF-002: Export-surface bookkeeping — `BuildResourceReportInputs` omitted; "8" vs 9 and "14" vs 15 counts 🟡 MINOR

**Dimension:** Consistency (12) + Completeness Gaps (4)
**Location:** `01-requirements.md` Should-Have export list (:31); `07-testing-strategy.md` ST-28 (:77); `02-current-state.md` relevant-files table (:44)
**Codebase Evidence:** `RD-11-diagnostics-reporting.md` §4.8 (:545) — `export { buildResourceReport, BuildResourceReportInputs, checkBinaryBudget };`. The RD's amended §4.8 surface totals **15** symbols (9 values + 6 types).
**The Problem:** Three related bookkeeping slips: (a) the plan's Should-Have export list names 14 symbols, omitting `BuildResourceReportInputs` — which RD §4.8 exports and which RD-15 needs to construct typed builder inputs (`03-04-resource-report.md` does declare it exported from its file, so only the barrel/checklist docs are wrong); (b) ST-28 says "all **8** new value exports" then lists **9** names; (c) `02-current-state.md` says "the **14** new exports" where §4.8 as amended has 15. As written, ST-28 would pass with `BuildResourceReportInputs` missing from the barrel, silently violating §4.8.

**Resolution:** Single viable fix — add `BuildResourceReportInputs` to the `01-requirements.md` export list and to ST-28's type-compile clause; correct "8" → 9 and "14" → 15. Considered and dropped: removing `BuildResourceReportInputs` from RD §4.8 instead — strictly worse (RD-15 is the named consumer; 03-04 already defines it as public).

**Recommendation:** Apply the three corrections.
Confidence: High — counted directly against RD §4.8.
Hardening: no change.

**User Decision:** Resolved — User accepted recommendation: add `BuildResourceReportInputs` to the export lists; correct 8→9 and 14→15 (2026-07-03). **Applied**: `01-requirements.md` Should-Have list, `07-testing-strategy.md` ST-28, `02-current-state.md` relevant-files table.

---

### PF-003: R51 degraded-block content — RD says "message only", plan/STs render notes + help 🟡 MINOR

**Dimension:** Logical Contradictions (3, cross-document)
**Location:** `03-03-diagnostic-renderers.md` rule 8 + the E10243 degradation example (renders `= help:`); `07-testing-strategy.md` ST-14/ST-15 ("header line (+notes/help if present) only")
**Codebase Evidence:** `RD-11-diagnostics-reporting.md` R51 (:152): "renders as **code + severity + message only** — no `-->` line, no source excerpt — and never throws." The requirements register's AR-105 pins composition/color/JSON details but is silent on degraded-path content — so this difference is *not* covered by the back-propagated amendments.
**The Problem:** The plan's spec tests (immutable oracles) enshrine header+notes+help for the degraded path, but the RD text they derive from says "message only". An executor deriving ST-14/15 strictly from R51 would write a different oracle than 07-testing-strategy specifies. The plan's behavior is the better one — the concrete R51 case is RD-16 config diagnostics, whose actionability lives in their `help` strings (see the plan's own E10243 example) — but RD text and plan currently disagree.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Amend RD R51 wording to "code + severity + message (plus notes/help — compiler-authored, not source-echoed); no `-->` line, no excerpt"; record as an addendum to AR-105 | Keeps the plan/ST behavior, which preserves fix hints for config diagnostics exactly where users need them; one-line doc change | Touches the preflighted RD again (routine — same mechanism as AR-103..105) |
| B | Align the plan to R51's literal text: degraded blocks render the header only | No RD change | Strictly worse UX — every RD-16 config diagnostic loses its `= help:` line; contradicts the plan's own example and AR-105's spirit |

**Recommendation:** Option A — the RD's "only" was written by RD-11 PF-009 to mean "no location/excerpt", not to strip compiler-authored notes/help; the plan's reading is the intended one and the concrete consumer (config band) depends on it.
Confidence: High — the RD-16 config codes carry help text as their primary actionability channel.
Hardening: no change (contrarian check: option B's strict-constructionist case was weighed and is named above).

**User Decision:** Resolved — User chose Option A: amend RD R51 wording (notes/help render in the degraded path); record as AR-105 addendum (2026-07-03). **Applied**: RD-11 R51 row + Last-Updated header; AR-105 addendum added to `requirements/00-ambiguity-register.md`; cross-referenced in `03-03` rule 8.

---

### PF-004: Gutter-width edge cases unpinned — mixed line-number widths and the no-excerpt indent 🟡 MINOR

**Dimension:** Ambiguities (1)
**Location:** `03-03-diagnostic-renderers.md` rules 3/6/7 ("width = decimal digits of the line number"; notes/help "gutter-aligned"); ST-19 in `07-testing-strategy.md`
**Codebase Evidence:** Requirements register AR-105 (:1122–1138) — pins "= note: / = help: gutter-aligned, secondary spans as own mini-blocks" but does not define (i) whether gutter width is per-excerpt or shared across a block whose primary and secondary excerpts have different line-number widths (e.g. line 9 vs line 120), or (ii) the notes/help indent when the block has **no** excerpt (R51 degraded path) — the plan's E10243 example shows 3 spaces (a 2-digit gutter), but nothing states that rule.
**The Problem:** The plan's own risk table (`02-current-state.md`) claims "AR-105 pins every open detail so goldens are decided, not discovered" — these two details are discoverable-at-authoring, which is exactly the failure mode that claim promises to prevent. ST-19's golden would pin whichever choice the author improvises.

**Resolution:** One dominant option — pin both rules in `03-03` (and mirror in ST-19's description): (i) gutter width is **per-excerpt** (each mini-block computes its own width from its own line number — consistent with the "own mini-block" composition already decided in AR-Q8); notes/help align to the **primary excerpt's** gutter; (ii) in the degraded no-excerpt path, notes/help use a **fixed 3-space indent**, transcribing the plan's existing E10243 example as normative. Considered and dropped: rustc-style shared max-width across the block — heavier to implement and contradicts the mini-block independence AR-Q8 chose.

**Recommendation:** Pin per-excerpt width + fixed 3-space degraded indent as above.
Confidence: Med — the per-excerpt choice is a judgment call; what would change it is a stated preference for rustc-style visual alignment.
Hardening: no change.

**User Decision:** Resolved — User accepted recommendation: pin per-excerpt gutter width; notes/help align to the primary excerpt's gutter; fixed 3-space indent in the no-excerpt path (2026-07-03). **Applied**: `03-03` rules 3/8 (R51 example made normative); `07-testing-strategy.md` ST-14/ST-19 mirrored.

---

### PF-005: `-->` path line and message text are outside R52's sanitization scope 🔵 OBSERVATION

**Dimension:** Security Blind Spots (8)
**Location:** `03-03-diagnostic-renderers.md` §Sanitization ("Message/note/help strings pass through unmodified"; path not mentioned)
**Codebase Evidence:** R52's scope ("echoed source excerpts") was set by RD-11 PF-010 — a preflighted decision, not re-litigated here. `SourceMap.getPath` returns whatever string was interned.
**The Problem (residual vector):** A hostile *filename* (e.g. containing `\x1b[2J`) interned into the SourceMap would be echoed unsanitized on the `--> {path}:{line}:{col}` line. Risk is low — paths come from the CLI/build config, not from compiled source — but the vector is adjacent to R52's threat model and costs one line to close.
**Suggestion (optional):** Run the same C0/C1 strip over the path segment in `renderTerminal` (and note it in ST-18 or an impl test). No RD change needed — it's an implementation detail within R52's spirit.
Confidence: High that the gap exists; Low that it matters in practice.

**User Decision:** Pending — optional/non-blocking (user away at decision time; recommendation: adopt the one-line path strip)

---

### PF-006: `checkBinaryBudget` inherits bag cap/dedup semantics silently 🔵 OBSERVATION

**Dimension:** Edge Cases (9)
**Location:** `03-04-resource-report.md` §Builder + budget check
**Codebase Evidence:** `packages/core/src/diagnostics/diagnostic-bag.ts:151–170` — `addError` is subject to the max-errors cap (suppressed once `errorCount >= maxErrors`, truncation sentinel emitted) and dedup key `E10034|-1|-1` (null span → `-1|-1`).
**The Problem (documentation nit):** E10034 emitted through `bag.addError` would be suppressed if the cap were already reached, and a second `checkBinaryBudget` call silently dedups. Both are unreachable/benign in the intended RD-15 flow (called post-`emitBinary`, which only runs on error-free builds), but the JSDoc should state that assumption so a future consumer calling it against a dirty bag isn't surprised.
**Suggestion (optional):** One JSDoc sentence on `checkBinaryBudget`: "Intended to be called on an error-free (post-emit) bag; emission is subject to the bag's cap/dedup like any diagnostic."
Confidence: High.

**User Decision:** Pending — optional/non-blocking (user away at decision time; recommendation: add the clarifying JSDoc note)

---

## Adversarial-question checklist (same-agent bias safeguard)

- *Assumption unconsciously confirmed?* The likeliest shared blind spot was golden transcription — so every golden source (Ch 14 §1, Ch 11 §6, E10034 message) was re-verified against the frozen spec text, which is where PF-001 surfaced.
- *External standard risk?* ANSI SGR usage is project-defined (AR-Q9), JSON via `JSON.stringify` — no external conformance to cite. UTF-8 byte math delegates to the shipped, tested `LineMap`.
- *What would a dissenting expert flag?* Literal-TAB caret alignment (terminals expand tabs; byte-1 caret math misaligns visually) — that is RD-11 PF-007/PF-013's ratified decision, golden-locked, not re-litigated. The path-sanitization vector became PF-005.
