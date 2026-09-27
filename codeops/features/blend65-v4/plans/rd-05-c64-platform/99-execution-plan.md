# Execution Plan: RD-05 Stage A

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-27 01:57
> **Progress**: 0/33 tasks (0%)
> **CodeOps Artifact Schema**: 1

## Scope and Entry Gate

Execute only [Stage A](01-requirements.md), after its scoped plan preflight and the required
effort handoff. AR-P3 remains a named deferral outside executable work. No task below changes
the frozen language/expert baseline, implements NMI-dependent behavior, or closes RD-05.

**Original goal / smallest viable design:** [00-index](00-index.md#minimum-sufficient-baseline).
**Governing decisions:** AR-P4–AR-P8. Strict scope; no accepted optional additions.
**Quality policy:** `codeops/codeops.json`; independent correctness/maintainability/standards
review at every completed phase. Phases 1–2 additionally need semantics review; Phase 2 is
performance-critical and needs an independent performance audit. Phase 3 includes security and
concurrency review of binary input, target pinning and owned-process cleanup. No web/auth
security profile is invented for this local compiler.

## Implementation Phases

| Phase | Deliverable | Tasks | Depends on |
|---|---|---|---|
| 1 | Source-visible constants and four frontend declarations | 11 | Stage A preflight |
| 2 | Four cooperative build identities and zero-cost output proof | 11 | Phase 1 |
| 3 | Correct emulator selection and four fresh runtime proofs | 11 | Phase 2 |

**Total: 33 tasks across 3 phases / 9 sessions.** Task size is bounded by one reviewable
change, normally 1–3 files. Split a task before implementation if it grows to 200+ changed
lines, six files or three independent concerns; preserve its spec-first ordering. No speculative
refactor is authorized by a task-size split.

Within task target lists, abbreviated `frontend/`, `semantic/`, `target/`, `layout/`, `artifacts/` and
`services/` paths share the `packages/compiler/src/` prefix of the first listed file.

> **Execution rule:** These phase lists are the sole task-progress authority. Each task occurs
> once. On implementation mark `[~]` with `(implemented: YYYY-MM-DD HH:MM)`; after its stated
> verification passes mark `[x]` with `(completed: YYYY-MM-DD HH:MM)`. Update the Progress and
> Last Updated headers after each task; only `[x]` counts complete. Resume the first `[~]`, else
> the first `[ ]`. Use `[!]` plus a specific blocker if needed. Get timestamps from the current
> clock, never invention. Keep red tests uncommitted until their coherent unit is green.

Use the exec-plan and git-commit skills for coherent local checkpoints under the project
prime directive. Never automatically push. Review packets carry the phase diff/baseline,
owning component excerpts, ST cases, verification results and the explicit Stage A boundary.
Spec-author packets carry no implementation logic and forbid opening implementation files or
changing existing `*.spec.test.ts`. Material findings follow the normal authorized ruling gate.

## Phase 1: Frontend Constants

> **Phase baseline tree**: Record at execution start through exec-plan.
> **Lenses**: api-surface, concurrency
> **Risk**: Language semantics and immutable per-analysis state; semantics review required.

### Session 1.1 — Specification Tests

**Reference:** [03-01](03-01-profile-facts.md); ST-1–ST-12; AR-P5–AR-P7.

- [ ] 1.1.1 [spec-author] Write declaration/vector specification cases — `packages/compiler/src/frontend/profile-constants.spec.test.ts`; ST-1, ST-12.
- [ ] 1.1.2 [spec-author] Write public frontend constant/import/evaluation cases and minimal real-project setup — `test/rd05/profile-constants.spec.test.ts`, `test/rd05/profile-fixture.ts`; ST-2–ST-4, ST-8–ST-9.
- [ ] 1.1.3 [spec-author] Write constant/profile diagnostic cases — `test/rd05/profile-diagnostics.spec.test.ts`; ST-5–ST-7, ST-10–ST-11.
- [ ] 1.1.4 Run Phase 1 spec files before implementation; record expected failures and justified already-green preservation cases here; [07 — Verification commands](07-testing-strategy.md#verification-commands).

**Verify:** Directed Phase 1 tests from 07; expected red for missing capability, not fixture failure.

### Session 1.2 — Implementation

**Reference:** [03-01 — Integration](03-01-profile-facts.md#integration) and diagnostics; AR-P6.

- [ ] 1.2.1 Add closed pure facts and four frontend declarations; update only the obsolete implementation-test rejection fixture — `packages/compiler/src/profile/c64-kernal.ts`, `frontend/profile.ts`, `frontend/profile.impl.test.ts`; ST-1, ST-12.
- [ ] 1.2.2 Supply selected constants before aggregate/header preparation and through later known-value/import state, with shared identities and collision/precedence rules — `packages/compiler/src/frontend/profile-bindings.ts`, `frontend/analyzer.ts`, `frontend/aggregate-types.ts`, `frontend/aggregate-constants.ts`, `frontend/semantic-types.ts`; ST-2–ST-9; PF-002. Reuse the existing host/lookup and evaluators; no broad preparation rewrite.
- [ ] 1.2.3 Recognize exact selected members before mixed-module missing-export diagnostics, then handle constant-module obligations and cooperative resident-loader guards — `packages/compiler/src/frontend/service.ts`, `frontend/modules.ts`, `frontend/scalar-expressions.ts`; ST-2, ST-7–ST-11; PF-003. Preserve private/missing errors and source-name collisions.
- [ ] 1.2.4 Pass selected identity through literal diagnostics without breaking three-argument callers — `packages/compiler/src/frontend/profile.ts`, `frontend/encoded-literals.ts`; ST-11.
- [ ] 1.2.5 Run all Phase 1 specification files green; fix implementation only; record results here.

**Verify:** Directed Phase 1 spec files, existing frontend profile/encoding suites and unchanged
`test/import-boundary.spec.test.ts`; use 07 commands with fresh public builds.

### Session 1.3 — Implementation Tests and Hardening

- [ ] 1.3.1 Add immutable-table, stable-binding and selection-internal tests — `packages/compiler/src/frontend/profile-constants.impl.test.ts`; 03-01 §Integration.
- [ ] 1.3.2 Run full phase verification and independent correctness/semantics review; record results and dispositions here; preserve frozen paths.

**Deliverable:** Frontend contract in 03-01; backend admission is not yet claimed.
**Verify:** Full command set in [07](07-testing-strategy.md#verification-commands), including
targeted formatting, then the phase reviews above.

## Phase 2: Cooperative Builds and Output Proof

> **Phase baseline tree**: Record at execution start through exec-plan.
> **Lenses**: api-surface, perf
> **Risk**: Target/storage identity, mandatory lowering and startup; semantics and performance review required.

### Session 2.1 — Specification Tests

**Reference:** [03-02 — Target and layout](03-02-cooperative-pipeline.md#target-and-layout),
[03-01 — No runtime cost](03-01-profile-facts.md#no-runtime-cost); AR-P4/AR-P6/AR-P7.

- [ ] 2.1.1 [spec-author] Write exact backend identity/admission tests — `packages/compiler/src/target/cooperative-profiles.spec.test.ts`; ST-13.
- [ ] 2.1.2 [spec-author] Write independent selected-effects and assembly/cost tests — `test/rd05/profile-output.spec.test.ts`; ST-14–ST-15; reuse the Phase 1 fixture.
- [ ] 2.1.3 [spec-author] Write fresh evidence and startup/layout tests — `test/rd05/profile-pipeline.spec.test.ts`; ST-16, ST-18.
- [ ] 2.1.4 [spec-author] Write retained interrupt-safety cases for the four profiles — `test/rd05/profile-interrupts.spec.test.ts`; ST-17.
- [ ] 2.1.5 Run Phase 2 spec files red; record missing behavior versus preservation cases here; 07 commands.

**Verify:** Directed Phase 2 spec files after a fresh build; expected red for new backend profiles.

### Session 2.2 — Implementation

- [ ] 2.2.1 Generalize machine facts and compose the four closed target identities, including the bounded machine-file rename — `packages/compiler/src/target/c64-kernal.ts` (from `c64-pal-kernal.ts`), `target/profile.ts`, `services/resource-diagnostics.ts`; 03-02 §Target and layout; ST-13.
- [ ] 2.2.2 Admit the four profiles through existing startup/layout and terminal serializer guards with certificate agreement — `packages/compiler/src/layout/startup.ts`, `layout/c64-layout.ts`, `artifacts/acme-validate.ts`; ST-16–ST-18; PF-001. Retain serializer/packager, closed-certificate, machine and layout validation.
- [ ] 2.2.3 Remove constant-switch dead paths in existing CFG lowering; prove all selected constant paths preserve effects and disappear before storage closure — `packages/compiler/src/semantic/cfg.ts`, `semantic/lower-calls.ts`, `semantic/lower.ts`; 03-01 §No runtime cost; ST-14–ST-15; PF-004. Constant-switch folding is a demonstrated gap; preserve its normal selector effects and clause/fallthrough semantics. For already-supported paths, record the no-change proof; no new optimization pass.
- [ ] 2.2.4 Run all Phase 2 specification files green; preserve existing version-1 validators and safe/unsafe interrupt results; record results here.

**Verify:** Directed Phase 2 spec files plus existing target, startup, resource/evidence and
RD-04 interrupt/expressiveness suites; 07 commands. Do not change spec expectations.

### Session 2.3 — Implementation Tests and Hardening

- [ ] 2.3.1 Add machine/storage agreement, startup-certificate and terminal serializer/packager/open-or-mismatched-certificate rejection tests — `packages/compiler/src/target/cooperative-profiles.impl.test.ts`; 03-02 §Target and layout; PF-001. Keep existing tests unchanged.
- [ ] 2.3.2 Run full phase verification and independent correctness/semantics/performance reviews; record measured output deltas and any required existing/new debt issue here.

**Deliverable:** Four build identities and the specified zero-extra-cost proof; no runtime
qualification claim until Phase 3.
**Verify:** Full 07 command set, frozen-path check and the phase reviews above.

## Phase 3: Exact Emulator Selection and Qualification

> **Phase baseline tree**: Record at execution start through exec-plan.
> **Lenses**: security, concurrency, api-surface
> **Risk**: Pinned-generation identity, binary monitor input and owned process cleanup.

### Session 3.1 — Specification Tests

**Reference:** [03-02 — Emulator launch](03-02-cooperative-pipeline.md#emulator-launch) and
[Qualification](03-02-cooperative-pipeline.md#qualification); AR-P7/AR-P8.

- [ ] 3.1.1 [spec-author] Write run-selection, pin/failure and process-compatibility tests — `packages/compiler/src/services/vice-profiles.spec.test.ts`; ST-19–ST-21.
- [ ] 3.1.2 [spec-author] Write bounded resource-get protocol cases — `test/rd05/vice-resource.spec.test.ts`; ST-22.
- [ ] 3.1.3 [spec-author] Write four-profile active-model and runtime-state tests — `test/rd05/profiles-vice.spec.test.ts`; ST-23–ST-24; retain ST-25's existing file unchanged.
- [ ] 3.1.4 Run Phase 3 spec files red, sequentially for VICE; record failures and existing preservation cases here; 07 commands.

**Verify:** Directed Phase 3 tests; missing helper/configuration must fail, never silently skip.

### Session 3.2 — Implementation

- [ ] 3.2.1 Carry the fresh build's private selected identity into fixed-argv interactive launch — `packages/compiler/src/services/services.ts`, `services/vice.ts`; 03-02 §Emulator launch; ST-19–ST-21.
- [ ] 3.2.2 Extend the existing qualification helper with the closed optional profile argument and pinned-ROM ordering — `test/m1/vice-runtime.ts`; 03-02 §Qualification; ST-23–ST-25.
- [ ] 3.2.3 Add the single bounded integer-resource reader to the existing monitor — `test/m1/vice-monitor.ts`; 03-02 §Qualification; ST-22–ST-23. Keep the file below 700 lines; no general monitor refactor.
- [ ] 3.2.4 Run Phase 3 spec files and the unchanged M1 journey green, sequentially; record actual selected resources and runtime outcomes here.

**Verify:** Directed Phase 3 tests and existing `test/m1/vice.spec.test.ts`; 07 commands;
`VICE-verified / hardware-unverified` only for successfully observed cases.

### Session 3.3 — Implementation Tests and Handoff

- [ ] 3.3.1 Add argument-assembly/resource-decoder and process-error edge tests — `packages/compiler/src/services/vice-profiles.impl.test.ts`, `test/rd05/vice-resource.impl.test.ts`; 03-02 §Evidence and failures / Qualification.
- [ ] 3.3.2 Run full Stage A verification and independent phase review, including security/concurrency lenses; record results and close review findings here.
- [ ] 3.3.3 Write the bounded Stage A evidence/deferral handoff and update only the feature roadmap — `08-stage-a-handoff.md`, `../../00-roadmap.md`; 01 §Stage Acceptance. Keep full RD-05 unfinished and name its next planning owner; finish with a green local documentation checkpoint.

**Deliverable:** Stage A runtime proof and an honest remaining-work handoff, not RD closeout.
**Verify:** Full 07 command set for 3.3.2. For 3.3.3, targeted Markdown formatting, links,
source/decision keys, task totals and retained deferral ownership; no compiler changes after
the full verification checkpoint.

## Success and Remaining Ownership

Stage success is exactly [01 — Stage Acceptance](01-requirements.md#stage-acceptance).
All 33 checkboxes must be green; review findings, frozen paths and relevant output debts must be
reconciled. The remaining requirements stay in RD-05. AR-P3 must be resolved before planning
NMI-dependent executable work or declaring the complete RD-05 plan ready. Finish with an
effort recommendation and user handoff before starting the next distinct planning task.
