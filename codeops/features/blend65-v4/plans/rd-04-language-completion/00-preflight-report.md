# Preflight Report: RD-04 Language Completion Plan

> **Status**: ❌ BLOCKED — 4 major recommendations approved, but plan edits and re-scan remain pending; 3 minor decisions pending
> **Iteration**: 1 (first scan)
> **Artifact**: Entire 11-document implementation plan at `codeops/features/blend65-v4/plans/rd-04-language-completion/`, excluding this report and transient notes
> **Audited plan tree**: `686309ac9968a3cc3760edb7c1f413f29657b870` (Git tree at scan start)
> **Scope**: Strict; the plan is the audit target. RD-04, frozen Specification 4, active expert guidance, and current source/tests are context only.
> **Codebase Grounded**: 15 source/test-support files examined; key compiler, CLI, LSP, ACME and VICE references verified against the checkout
> **Last Updated**: 2026-09-23

## Codebase Context Summary

**Stack:** Node 22, TypeScript 7.0.2, Yarn 1, Turbo and Vitest; ACME 0.97 and VICE 3.10 are the selected Linux assembly/runtime tools.

**Architecture:** The existing compiler service loads a project, analyzes its frontend, builds semantic operations, closes whole-program and SFA facts, lowers/binds machine operations, assembles with ACME and publishes one PRG generation. CLI and language server use different public-facing adapters.

**Key files examined:** `packages/compiler/src/services/services.ts`, `frontend/service.ts`, `frontend/semantic-types.ts`, `frontend/direct-calls.ts`, `frontend/flow-facts.ts`, `semantic/operations.ts`, `semantic/lower.ts`, `storage/closure.ts`, `artifacts/acme-serializer.ts`, `artifacts/evidence-types.ts`, `packages/cli/src/run.ts`, `packages/language-server/src/server.ts`, and `test/m1/` VICE support.

**Reference checks:** The existing pipeline, package graph, co-located tests and M1 VICE protocol are real. `test/rd04/` and many named source files are proposed deliverables, not false claims of existing files. One CLI task path is stale (PF-005). No new package, pass framework, readiness system or disproportionate test harness was found. The existing plan's approved AR-P1–AR-P9 decisions were not reopened.

**Domain lenses:** Compiler/language semantics; interrupt concurrency and state ownership; generated-artifact compatibility. The latter found no schema migration in the plan: existing sidecar schema versions remain fixed. Generic distributed-system infrastructure is not applicable to a single-machine interrupt model.

## Summary by Dimension

| # | Dimension | Findings | Highest severity |
|---|---|---:|---|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit assumptions | 0 | — |
| 3 | Logical contradictions | 0 | — |
| 4 | Completeness gaps | 1 | 🟡 Minor |
| 5 | Dependency issues | 0 | — |
| 6 | Feasibility concerns | 0 | — |
| 7 | Testability | 0 | — |
| 8 | Security blind spots | 0 | — |
| 9 | Edge cases | 1 | 🟠 Major |
| 10 | Scope creep | 0 | — |
| 11 | Ordering and sequencing | 2 | 🟠 Major |
| 12 | Consistency | 1 | 🟡 Minor |
| 13 | Codebase alignment | 2 | 🟠 Major |

## Summary by Severity

| Severity | Count | Decision state |
|---|---:|---|
| 🔴 Critical | 0 | — |
| 🟠 Major | 4 | Recommendations approved; fixes not yet applied or verified |
| 🟡 Minor | 3 | Pending |
| 🔵 Observation | 0 | — |

## Findings

### PF-001: Phase 3 asks aggregate ABI tests to pass before Phase 4 implements the ABI 🟠 MAJOR

**Dimension:** Ordering and sequencing
**Location:** `99-execution-plan.md:124,140,145`; `07-testing-strategy.md:69-70`
**Codebase evidence:** `packages/compiler/src/frontend/direct-calls.ts:97-119` still defers aggregate temporary arguments and return calls; `packages/compiler/src/semantic/operations.ts:137-156` has a direct-call operation but no aggregate destination.
**Problem:** Phase 3 claims all ST-21–ST-29 are green and qualified. ST-26/27 require aggregate assignment/return and borrowed-parameter ABI, which the plan implements and qualifies only in Phase 4 (`99-execution-plan.md:158-175`). Phase 3 cannot truthfully close under its own gate.

**Recommended resolution — the only small viable path:** Gate Phase 3 on ST-21–ST-25 and ST-28–ST-29. Keep ST-26/27 as specification-first Phase 4 cases and qualify them there. Pulling the ABI into Phase 3 would undo the approved phase boundary; declaring a known-red phase green is not viable.

**Confidence:** High — the phase/test references are explicit. **Hardening:** Independent challenger converged. **Challenger:** converged; its file evidence came from the dispatch packet and was rechecked by the lead.

**User Decision:** Approved recommended resolution on 2026-09-23. Plan modification was not authorized by this ruling; fix and re-scan pending.

### PF-002: Phase 1 asks every diagnostic to pass before its language feature exists 🟠 MAJOR

**Dimension:** Ordering and sequencing
**Location:** `99-execution-plan.md:54-81`; `07-testing-strategy.md:41`
**Codebase evidence:** `packages/compiler/src/frontend/direct-calls.ts:44-48,117-119` shows current deferred call cases; `packages/compiler/src/frontend/semantic-types.ts:185-196` still has only scalar, struct and array types. Later diagnostic-producing features are not implemented now.
**Problem:** ST-08 requires every RD-04-applicable active Chapter-14 diagnostic, while Phase 1 requires all ST-01–ST-10 green. Semantic, ABI, interrupt, compile-time and backend diagnostic paths are scheduled for Phases 2–8. A complete diagnostic registry can be checked early, but every triggering behavior cannot.

**Recommended resolution — the only small viable path:** In Phase 1 prove frontend-owned diagnostics and registry completeness. Keep the full ST-08 sweep as one immutable end-of-implementation check in Phase 8 or 9, with later codes explicitly tracked until then. Moving all later features to Phase 1 or accepting red phase gates is not viable.

**Confidence:** High — diagnostic producers have later phase owners. **Hardening:** Independent challenger converged. **Challenger:** converged; its file evidence came from the dispatch packet and was rechecked by the lead.

**User Decision:** Approved recommended resolution on 2026-09-23. Plan modification was not authorized by this ruling; fix and re-scan pending.

### PF-003: CLI and editor diagnostics do not share the asset-aware path 🟠 MAJOR

**Dimension:** Codebase alignment
**Location:** `03-01-authority-and-frontend.md:29,103,122`; `07-testing-strategy.md:41-42`; `99-execution-plan.md:64-69`
**Codebase evidence:** CLI `check` reaches `analyzeProjectWithAssets()` through `packages/compiler/src/services/services.ts:159`; that frontend service resolves raw assets at `packages/compiler/src/frontend/service.ts:588-606`. The editor calls `analyzeProjectOverlay()` at `packages/language-server/src/server.ts:186`; its current implementation calls the asset-free `analyzeProject()` at `packages/compiler/src/frontend/service.ts:570-581`. CLI renders text (`packages/cli/src/render.ts`), while the editor renders LSP diagnostics (`packages/language-server/src/server.ts:139-157`).
**Problem:** The plan promises complete CLI/editor diagnostic identity, including embedded sources, but the two paths can return different diagnostics. ST-09 also asks for literally byte-identical adapter output and forbids backend imports from the CLI; actual output formats differ and the CLI legitimately reaches the compiler through its public export. The owning RD-04 AC-39 forbids backend imports from the frontend/editor, not from the CLI.

**Recommended resolution — the only compliant direct path:** Extend the existing frontend overlay analysis with the same bounded asset resolution used by `analyzeProjectWithAssets()`. Test equality of canonical compiler diagnostic records before CLI/LSP rendering; assert the backend-import boundary only for frontend/editor. No second frontend or backend import into the editor is needed. Limiting parity to no-asset sources would weaken R4.53; sending editor requests through full compiler check would break the boundary.

**Confidence:** Medium — the divergent path is verified, but the final overlay API shape depends on implementation details. **Hardening:** Independent challenger converged on the direct existing-path extension; the ST-09 wording correction was added after source inspection. **Challenger:** converged on the central remedy; its file evidence came from the dispatch packet and was rechecked by the lead.

**User Decision:** Approved recommended resolution on 2026-09-23. Plan modification was not authorized by this ruling; fix and re-scan pending.

### PF-004: No decisive case proves stored-result conditional memory effects 🟠 MAJOR

**Dimension:** Edge cases
**Location:** `03-02-values-and-memory.md:30,70`; `07-testing-strategy.md:58`; `99-execution-plan.md:101-110,134-145`
**Codebase evidence:** Current `packages/compiler/src/frontend/flow-facts.ts:55-74` intersects initialized ranges but has no captured-result correlation. RD-04 R4.38 (`requirements/RD-04-complete-language-correct-unoptimized-compiler.md:293`) requires correlation even when a call result is stored before testing it. The plan correctly keeps the real transfer capability unavailable until RD-07 (`03-02-values-and-memory.md:95`).
**Problem:** ST-20 tests a may-alias write but not the required case where a stored success result identifies which captured range became initialized across a branch/join. Because RD-04 has no real transfer producer, a public runtime case alone cannot prove this semantic seam.

**Recommended resolution — the only in-scope direct path:** Add one focused internal semantic-flow specification case with a synthetic conditional effect: store the result, test it later, and check agreeing/disagreeing joins plus captured-range identity. RD-07 remains responsible for real transfer integration. Pulling RD-07 into RD-04 or deferring R4.38 proof is not compliant.

**Confidence:** Medium — the required seam is explicit, but the smallest test hook must be chosen during implementation. **Hardening:** Independent challenger converged; no new framework or product API is needed. **Challenger:** converged; its file evidence came from the dispatch packet and was rechecked by the lead.

**User Decision:** Approved recommended resolution on 2026-09-23. Plan modification was not authorized by this ruling; fix and re-scan pending.

### PF-005: One Phase 8 CLI source path is stale 🟡 MINOR

**Dimension:** Codebase alignment
**Location:** `99-execution-plan.md:294`
**Codebase evidence:** `packages/cli/src/run.ts:75-141` owns `executeCommand()`. `packages/cli/src/commands.ts` does not exist. The similarly named `commands.spec.test.ts` is a test file.
**Problem:** Task 8.2.6 points an executor at a nonexistent implementation file.

**Recommended resolution — the only viable direct correction:** Replace `commands.ts` with `run.ts` in the task path. Do not create a duplicate CLI module.

**User Decision:** Pending

### PF-006: The test-strategy authority line omits approved AR-P9 🟡 MINOR

**Dimension:** Consistency
**Location:** `07-testing-strategy.md:25,112`
**Problem:** The introduction says cases derive from AR-P1–AR-P8, but ST-54 cites AR-P9 and the register records it as resolved at `00-ambiguity-register.md:27`.

**Recommended resolution — the only viable direct correction:** Change the introduction to AR-P1–AR-P9. No test or scope change is needed.

**User Decision:** Pending

### PF-007: Two claimed Should-Have results lack a delivery check 🟡 MINOR

**Dimension:** Completeness gaps
**Location:** `01-requirements.md:11-12`; `07-testing-strategy.md:103-112`; `99-execution-plan.md:281-304`
**Codebase evidence:** Current `packages/compiler/src/artifacts/acme-serializer.ts:50-53,184-188,203-227` emits hex-encoded labels and no source-related routine/data comments. Current `examples/` contains only the foundation and M1 programs.
**Problem:** The plan claims all three RD-04 Should-Haves, but does not give R4.55 (modern complete-language examples/diagnostic wording) or R4.56 (readable labels/comments) an explicit task or proof. R4.57 has a closeout task. The gap can be closed inside the existing examples, diagnostic tests and ACME serializer; no documentation or evidence subsystem is needed.

**Recommended resolution — the only small viable path:** Add a bounded Phase 8/9 check using an existing complete-language fixture as the modern example and a focused assembly assertion for source-related routine/data labels and comments. If that check is red, update the existing serializer and diagnostic wording directly. Do not add a new example framework.

**User Decision:** Pending

## Adversarial and Simplicity Check

- Same-model risk was countered with three bounded read-only audit clusters and one blind recommendation challenger. The challenger could not open files in its role, so the lead rechecked every decisive reference in the checkout.
- The frozen spec's exact text and RD-04 requirements were used for language obligations; current implementation was evidence of gaps, not semantic authority.
- The four major corrections all stay inside approved scope and existing ownership. They add no new package, runtime, parser, pass system, readiness service, test harness or future-target implementation.
- No prior AR-P1–AR-P9 decision was re-litigated. Native Windows qualification remains deferred to RD-10.

## Verdict and Next Gate

This plan is **blocked for execution** until the approved PF-001–PF-004 corrections are applied and verified in a bounded re-scan. PF-005–PF-007 require a user ruling or explicit acceptance as notes. Preflight has not changed the plan documents or advanced the roadmap.
