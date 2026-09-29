# Preflight Report: RD-05 CIA1 Return to BASIC Plan

> **Status**: ✅ PASSED — CLEAN; all four accepted findings fixed and verified
> **Iteration**: 2 (re-scan after accepted plan fixes)
> **Previous Iteration**: 4 findings — all resolved
> **This Iteration**: 0 new findings
> **Carried Forward**: None
> **Audit target**: Full implementation plan at `codeops/features/blend65-v4/plans/rd-05-cia-basic-return/` — the same seven documents as iteration 1, with accepted fixes and final status metadata; exact current blob identities recorded below
> **Iteration 1 target tree identity**: `bb8d0c62cf4897cabc54577000cc6466902a0b65` at `bf018afc`
> **Scope mode**: Strict; approved AR-P1–AR-P5 and the minimum-sufficient baseline in `00-index.md`
> **Last Updated**: 2026-09-29

**SAME-SESSION REVIEW:** This plan was authored in the same continuing conversation. Independent clustered review and a blind recommendation challenger reduce, but do not eliminate, that bias. Consider a human domain review before activating the corrected frozen authority.

## Codebase Context Summary

| Item | Grounded context |
|---|---|
| Stack | TypeScript 7.0.2, Node 22, Yarn 1, Vitest, ACME 0.97, VICE 3.10 (`package.json`, `AGENTS.md`). |
| Current compiler | CIA ownership uses one `dirty` fact and rejects dirty `restoreIRQ()` and BASIC return (`packages/compiler/src/semantic/cia-ownership.ts:205-220,396-408`). Vector lowering already has the masked `PHP; PHA; SEI` and exact saved-CINV transaction (`packages/compiler/src/machine/lower-c64-interrupt.ts:166-271`). Four PRG facts live in `packages/compiler/src/profile/c64-kernal.ts:1-89`. |
| Tests | Existing real-project CIA specification tests and sequential VICE helpers live in `test/rd05/cia-ownership.spec.test.ts`, `test/rd05/cia-vice.spec.test.ts`, and `test/rd05/profile-fixture.ts`. |
| Authority | Frozen `spec/appendix-c64.md:233-239`, RD-05 R5.4/AC-04, and the active expert baseline must be corrected/qualified before compiler work. Expert lineage: `skillVersion=2.0.0`, content commit `c9e70fab6039e9ced3108e88f0ea9730d4fd3007`, `c64-hardware.md#timers-and-control` / `#interrupt-control`, `c64-memory-and-runtime.md#interrupt-entry-and-exit-contracts`; source keys `MOS-6526-1981`, `CBM-C64-KERNAL-03`. |
| Primary hardware check | The [MOS 6526 data sheet](https://myoldcomputer.nl/Files/mos_6526_cia.pdf) makes the timer latch and ICR mask write-only. The pinned [KERNAL init](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/init) and [PIOKEY](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/irqfile) support the proposed PAL/NTSC stock handback order. This is a plan feasibility check, not emitted-code or silicon proof. |

**Context documents, not audit targets:** `AGENTS.md`; RD-05 requirements; `spec/appendix-c64.md` and `spec/06-functions.md`; the earlier CIA and IRQ plans; expert release/governance documents; primary MOS/KERNAL sources. No finding below expands the product scope. The current exit sequence's bytes/cycles remain **Unknown** until Phase 2 emits and measures it. No compiler implementation was run or changed during this audit.

Deterministic plan parsing found 19 tasks and no structural problem; all local Markdown links resolve. The plan has the required authority-first and specification-test → red → implementation → green ordering. The semantic scan below found four issues that those checks cannot detect.

## Iteration 1 Findings by Dimension

| # | Dimension | Findings | Highest severity |
|---:|---|---:|---|
| 1 | Ambiguities | 1 | 🟡 Minor |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | 0 | — |
| 4 | Completeness Gaps | 0 | — |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 1 | 🟠 Major |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 0 | — |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 1 | 🟡 Minor |
| 12 | Consistency | 0 | — |
| 13 | Codebase Alignment | 1 | 🟠 Major |

| Severity | Count | State |
|---|---:|---|
| 🔴 Critical | 0 | — |
| 🟠 Major | 2 | Resolved; accepted fixes verified in iteration 2 |
| 🟡 Minor | 2 | Resolved; accepted fixes verified in iteration 2 |
| 🔵 Observation | 0 | — |

## Findings

### PF-001: Old CIA specification tests contradict the approved handback 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment / Test Impact

**Location:** `99-execution-plan.md:63,68-84` omits the existing specification file from Phase 2's modification set and test-author tasks.

**Codebase evidence:** `test/rd05/cia-ownership.spec.test.ts:318-325,329-336,382-395` expects E10278 on three final exclusive restores after CIA1 mutation. The approved design requires those restores to hand back and compile (`03-cia-basic-return.md:8-10`).

Those three old expectations will fail the required complete test suite once the compiler follows the corrected authority. The raw-write, unsafe inner-restore, and unreleased-handler negative cases remain valid; this finding does not authorize weakening them.

**Recommended — Option A:** Include this existing specification file in Phase 2. Have the implementation-blind spec author supersede only those three obsolete expectations before compiler changes, preserving their fixtures and recording the corrected authority. This keeps the regression evidence visible.

**Viable alternative — Option B:** Remove those three obsolete cases and replace their coverage in the new spec file; this has more churn and loses the direct historical comparison.

**User Decision:** Resolved — user accepted Option A and authorized the plan fixes and re-scan: “i accept” on 2026-09-29. The existing spec file, exact three-case boundary, authority trail, and red verification are now included in Phase 2.

Confidence: High — the three assertions and corrected contract conflict directly. Hardening: no change. Challenger: converged on Option A; its strongest objection is that test changes need an explicit authority trail.

### PF-002: ST-1 can fail for the wrong reason 🟠 MAJOR

**Dimension:** 7 — Testability

**Location:** `07-testing-strategy.md:16` (ST-1); `99-execution-plan.md:68` gives its author only ST rows and public signatures.

**Codebase evidence:** An exclusive install makes the CIA1 mask unknown (`packages/compiler/src/semantic/cia-ownership.ts:188-198`); enabling Timer A then fails unless all five sources were disabled first (`:263-285`). The existing qualified source handoff does this explicitly (`test/rd05/cia-ownership.spec.test.ts:55-67`).

“Source-visible masked handoff” does not tell an implementation-blind test author to disable `sourceAll` and read pending sources once. A red ST-1 could therefore prove only an incomplete entry setup, not the missing return handback.

**Recommended — Option A:** Make ST-1 input self-contained: `asm_php(); asm_sei();` → exclusive install → `disableInterruptSources(sourceAll)` → one `readAndClearPendingSources()` → `asm_plp()` at the qualified safe point → timer enable/use → final `restoreIRQ()`. Have ST-8 and ST-10 reuse that valid setup. Require the expected-red observation to be at final restore.

**Viable alternative — Option B:** Add the prior complete CIA handoff contract to the spec-author packet and name it in ST-1. This is shorter on the ST row but easier to omit when dispatching.

**User Decision:** Resolved — user accepted Option A and authorized the plan fixes and re-scan: “i accept” on 2026-09-29. ST-1 now names the complete entry sequence and final-restore red diagnostic; ST-8 and ST-10 reuse that setup.

Confidence: High — current ownership code rejects the omitted setup. Hardening: corrected the proposed CPU-status order against the existing fixture. Challenger: converged on a self-contained ST-1.

### PF-003: “Counter-observation-only route” obscures the final-exclusive rule 🟡 MINOR

**Dimension:** 1 — Ambiguities

**Location:** `03-cia-basic-return.md:10`; ST-2 in `07-testing-strategy.md:17`.

**Codebase evidence:** Exclusive installation is legal without a CIA1 write (`packages/compiler/src/semantic/cia-ownership.ts:173-204`), and counter reads are nonmutating (`packages/compiler/src/semantic/cia-ownership-facts.ts:74-80`).

The design says every final exclusive pop handbacks even without a typed write, then says a counter-observation-only route never does. An exclusive route that only observes a counter fits both phrases. ST-2 resolves the likely intent but the design sentence remains ambiguous.

**Recommended — only viable clarification:** Say that counter observation alone creates no exclusive lease; when a source installs and finally pops an exclusive route, handback occurs even if its CIA1 work consisted only of counter reads. This changes no approved behavior.

**User Decision:** Resolved — user accepted the clarification and authorized the plan fixes and re-scan: “i accept” on 2026-09-29. The design now distinguishes counter observation alone from an installed exclusive route.

### PF-004: Spell out the two release commits 🟡 MINOR

**Dimension:** 11 — Ordering & Sequencing

**Location:** `99-execution-plan.md:13,45-56`.

**Governing context:** The existing expert [release procedure](../../../blend65-expert-skillset/plans/blend65-expert-skillset/03-07-qualification-and-release.md#immutable-content-checkpoint) requires a qualified immutable content commit, then a release-record commit binding its ID (`:253-290`). The current active record already follows that shape (`.agents/skills/blend65-domain-expert/qualification/release.md:20-23`).

The plan invokes the existing procedure, so this is not a new process defect. But its singular “green authority checkpoint” after the activation task could be mistaken for one commit; a release record cannot bind its own commit ID. The independent challenger correctly downgraded this from a blocking ordering claim to a clarity issue.

**Recommended — only viable clarification:** State the existing substeps explicitly in tasks 1.3.1–1.3.2: approved byte-identical candidate migration, qualified content commit, following release-record binding commit, then final identity/qualification verification. Do not start Phase 2 until both commits are complete. No new release layer or extra qualification is proposed.

**User Decision:** Resolved — user accepted the clarification and authorized the plan fixes and re-scan: “i accept” on 2026-09-29. Tasks 1.3.1–1.3.2 now spell out the immutable content commit and the following release-record binding commit.

Confidence: High — the governing two-commit procedure is explicit. Hardening: downgraded from Major to Minor after challenge; the procedure is already incorporated by reference. Challenger: diverged on severity, not remedy.

## Verdict and next gate

**Passed — Clean:** The user accepted all four recommendations and authorized applying the plan fixes and re-scan. Each finding is fixed and independently verified; no finding remains open. The unchanged seven-document target was re-scanned across all 13 dimensions. Final index/status metadata and the report link were checked directly after the scan. The simplicity check found no unjustified support machinery.

| Iteration 2 cluster | Dimensions | Independent audit result |
|---|---|---|
| Document soundness | 1, 3, 12 | No findings; PF-003 and cross-document consistency verified |
| Grounding | 2, 13 | No findings; PF-001 exact three-case boundary verified against existing tests |
| Delivery | 4, 5, 11 | No findings; PF-004 verified against the existing release procedure |
| Risk | 6, 8, 9 | No findings; bounded interrupt, hardware and ownership contracts remain feasible |
| Fit | 7, 10 | No findings; PF-002 valid setup and final-restore red observation verified |

Two independent auditor threads covered the five separate cluster packets because further thread allocation was unavailable. The iteration-1 challenger already hardened the accepted major remedies; the fixes introduced no new major finding or changed recommendation. Lead verification confirmed plan structure (19 unstarted tasks), targeted formatting, local links, and the accepted modification boundary. Compiler tests were not run for this plan-document checkpoint.

DEF-14 advances to Plan Preflighted; RD-05 remains Executing and no task is marked complete. Portfolio cascade remains deferred on `feature/v4-rebuild` under the existing non-integration-branch rule. Phase 1 prepares and qualifies the approved narrow authority correction. Its final candidate/evidence activation approval remains required before either release commit or Phase 2. This pass qualifies the plan, not compiler behavior, emitted costs, runtime operation, or physical hardware.

## Iteration 2 Target Identity

These Git blob IDs bind the exact seven audited documents, including final status metadata. The report is audit evidence, not an eighth target document.

| Document | Git blob ID |
|---|---|
| `00-ambiguity-register.md` | `205f7bc660b23756b92045b1e8050db54171c670` |
| `00-index.md` | `82b4db1ca6961f0a86d11bf94088c1f2ac90508a` |
| `01-requirements.md` | `e934d30541a3c7570a14669c1b913fde53285fe5` |
| `02-current-state.md` | `dd3b19a31fd7004842b129fd05ba0b9624ea9618` |
| `03-cia-basic-return.md` | `f8b81d8ca26a5861bd1725c8c04a29d587a74082` |
| `07-testing-strategy.md` | `35ead6084e646454bfa5f60d1ffb662079112415` |
| `99-execution-plan.md` | `27b3460bf3ca46a432d1ed1fa9eb128d90c535e3` |
