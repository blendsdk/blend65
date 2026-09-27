# Execution Plan: RD-05 Stage A

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-27 10:41
> **Progress**: 14/36 tasks (39%)
> **CodeOps Artifact Schema**: 1

## Scope and Entry Gate

Execute only [Stage A](01-requirements.md), after its scoped plan preflight and the required
effort handoff. AR-P3 remains a named deferral outside executable work. No task below changes
the frozen language/expert baseline, implements NMI-dependent behavior, or closes RD-05.

**Original goal / smallest viable design:** [00-index](00-index.md#minimum-sufficient-baseline).
**Governing decisions:** AR-P4–AR-P9. Strict scope; no accepted optional additions.
**Quality policy:** `codeops/codeops.json`; independent correctness/maintainability/standards
review at every completed phase. Phases 1–2 additionally need semantics review; Phase 2 is
performance-critical and needs an independent performance audit. Phase 3 includes security and
concurrency review of binary input, target pinning and owned-process cleanup. No web/auth
security profile is invented for this local compiler.

## Implementation Phases

| Phase | Deliverable | Tasks | Depends on |
|---|---|---|---|
| 1 | Source-visible constants and four frontend declarations | 14 | Stage A preflight |
| 2 | Four cooperative build identities and zero-cost output proof | 11 | Phase 1 |
| 3 | Correct emulator selection and four fresh runtime proofs | 11 | Phase 2 |

**Total: 36 tasks across 3 phases / 9 sessions.** Task size is bounded by one reviewable
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

> **Phase baseline tree**: `6de724cc0a216b48e9a09a6ca9fb4b088eb7ab6d` (HEAD `b389bebe`, clean worktree).
> **Lenses**: api-surface, concurrency
> **Risk**: Language semantics and immutable per-analysis state; semantics review required.

Execution started 2026-09-27 08:55 after the user's XHigh confirmation. The eight-file preflight
digest still equals `8e3950fdccf4d3f2a041032dd654885cef2e0f4a4db6c3fa1455da390f9dc74e`.
Strict modification set: the Phase 1 task files below, this execution record and the feature
roadmap. No pre-existing changes. New specification tests are independently authored before
production edits; existing specification tests, frozen paths and later-phase owners stay unchanged.
Verification logs: `/tmp/blend65-rd05-phase1-3gn2yw/`. Local green commits only; no push.

Before implementation, split 1.2.2's early lookup from its later publication as 1.2.6 to keep
each diff below the task-size bound. This changes no behavior or ST coverage. Task 1.2.3 may
move the existing entry-diagnostic spelling helper into `frontend/module-diagnostics.ts` to
keep `modules.ts` below 700 lines; that existing helper file joins the strict modification set.
No new layer or general resolver is authorized. The source-name collision spans use the
declaration/second-alias token; a private qualified reference uses its complete name expression.

The first integration run exposed the existing member-expression path bypassing scalar name
checks for qualified values. Task 1.2.5 includes the bounded fix in `aggregate-constants.ts`,
`scalar-expressions.ts` and `scalar-unary.ts` (the latter joins the modification set): reuse
qualified-name spelling, preserve lexical root shadowing, and apply ordinary constant/address
rules. No evaluator, syntax or backend change is introduced.
`declaration-order.ts` and `constants.ts` also require the same nested-name recognition for
dependency order and constant classification. These join 1.2.5's five-file correction.
Split the separately exposed full-precision arithmetic fix into 1.2.7 before changing it:
existing binary operand harmonization must not range-check intermediate constant results.
This is frozen TS-18 behavior, not profile-specific semantics or an optimization pass.

### Session 1.1 — Specification Tests

**Reference:** [03-01](03-01-profile-facts.md); ST-1–ST-12; AR-P5–AR-P7.

- [x] 1.1.1 [spec-author] Write declaration/vector specification cases — `packages/compiler/src/frontend/profile-constants.spec.test.ts`; ST-1, ST-12. 17 expected red / 10 preservation green. (completed: 2026-09-27 09:04)
- [x] 1.1.2 [spec-author] Write public frontend constant/import/evaluation cases and minimal real-project setup — `test/rd05/profile-constants.spec.test.ts`, `test/rd05/profile-fixture.ts`; ST-2–ST-4, ST-8–ST-9. 50 expected red. (completed: 2026-09-27 09:04)
- [x] 1.1.3 [spec-author] Write constant/profile diagnostic cases — `test/rd05/profile-diagnostics.spec.test.ts`; ST-5–ST-7, ST-10–ST-11. 63 expected red / 3 preservation green. (completed: 2026-09-27 09:04)
- [x] 1.1.4 Run Phase 1 spec files before implementation; record expected failures and justified already-green preservation cases here; [07 — Verification commands](07-testing-strategy.md#verification-commands). Counts and file hashes independently checked. (completed: 2026-09-27 09:04)

Independent author `rd05_phase1_spec` read no implementation. Baseline build (4/4) and targeted
formatting passed. Final red capture has 130 expected failures and 13 preservation passes across
143 tests; no parser, fixture or file-load failures. Existing PAL operation/vector behavior,
unrestricted vector addresses, PAL missing/private source imports and encoding remain green.
Logs with every instantiated case: `/tmp/blend65-profile-red-Ae0N26/frontend.log` and
`/tmp/blend65-profile-red-Ae0N26/root-final.log`. Before freezing, draft API-shape and diagnostic
span assertions were aligned with the approved public declarations and immutable diagnostic
contract; no implementation had begun. Documentation self-check passed.

Frozen oracle SHA-256 (unchanged throughout implementation):

| File | SHA-256 |
|---|---|
| `frontend/profile-constants.spec.test.ts` | `9ebd79749ac1f7b68eca30db80df4efcbda5da1b464ba64bfee6e55f9a8afcab` |
| `test/rd05/profile-constants.spec.test.ts` | `d706216220408e410e49f717bc63c4ea9a17cdb17a72de359f9b1c1c67b6b822` |
| `test/rd05/profile-diagnostics.spec.test.ts` | `1a449c4a10f8e8cb4f079c71995d650f1b4fb918af094f8b6ca5176971681e2f` |
| `test/rd05/profile-fixture.ts` | `88d6ad5b8fad794af3699504ffedb4c09dcc7c48e33b4d5ac80f21c4a21dc56c` |

**Verify:** Directed Phase 1 tests from 07; expected red for missing capability, not fixture failure.

### Session 1.2 — Implementation

**Reference:** [03-01 — Integration](03-01-profile-facts.md#integration) and diagnostics; AR-P6.

- [x] 1.2.1 Add closed pure facts and four frontend declarations; update only the obsolete implementation-test rejection fixture — `packages/compiler/src/profile/c64-kernal.ts`, `frontend/profile.ts`, `frontend/profile.impl.test.ts`; ST-1, ST-12. Directed new/existing profile suites 60/60; documentation self-check passed. (completed: 2026-09-27 09:08)
- [x] 1.2.2 Prepare stable selected bindings and supply constants before aggregate/header preparation — `packages/compiler/src/frontend/profile-bindings.ts`, `frontend/analyzer.ts`, `frontend/aggregate-constants.ts`, `frontend/semantic-types.ts`; ST-2–ST-9; PF-002. Reuse the existing host/lookup and evaluators; no broad preparation rewrite. Existing `aggregate-types.ts` consumers remain unchanged because the host input suffices. (completed: 2026-09-27 09:21)
- [x] 1.2.6 Publish the same selected bindings through later known-value/import state with collision and lexical-precedence rules — `packages/compiler/src/frontend/profile-bindings.ts`, `frontend/analyzer.ts`; ST-2–ST-9; split from 1.2.2 before implementation. (completed: 2026-09-27 09:21)
- [x] 1.2.3 Recognize exact selected members before mixed-module missing-export diagnostics, then handle constant-module obligations and cooperative resident-loader guards — `packages/compiler/src/frontend/service.ts`, `frontend/modules.ts`, `frontend/module-diagnostics.ts`, `frontend/scalar-expressions.ts`; ST-2, ST-7–ST-11; PF-003. Preserve private/missing errors and source-name collisions; only the existing diagnostic-spelling helper moves for file size. (completed: 2026-09-27 09:21)
- [x] 1.2.4 Pass selected identity through literal diagnostics without breaking three-argument callers — `packages/compiler/src/frontend/profile.ts`, `frontend/encoded-literals.ts`; ST-11. (completed: 2026-09-27 09:21)
- [x] 1.2.5 Run all Phase 1 specification files green; fix implementation only; record results here. Initial integration: 54 failures / 86 passes including import boundaries; qualified scalar/member lookup needs correction. (completed: 2026-09-27 09:21)
- [x] 1.2.7 Preserve full-precision constant binary intermediates until the existing destination range check — `packages/compiler/src/frontend/scalar-binary.ts`, `frontend/comptime.ts`; ST-4, frozen TS-18. Split from integration fixes before implementation; the existing evaluator must honor the typed expression's nonwrapping constant flag while still metering every operation. Runtime widths remain unchanged. (completed: 2026-09-27 09:21)

**Verify:** Directed Phase 1 spec files, existing frontend profile/encoding suites and unchanged
`test/import-boundary.spec.test.ts`; use 07 commands with fresh public builds.

### Session 1.3 — Implementation Tests and Hardening

- [x] 1.3.1 Add immutable-table, stable-binding and selection-internal tests — `packages/compiler/src/frontend/profile-constants.impl.test.ts`; 03-01 §Integration; first describe block and fixture. (completed: 2026-09-27 09:24)
- [x] 1.3.3 Cover ordinary qualified lookup and exact-intermediate fixes — second describe block of `packages/compiler/src/frontend/profile-constants.impl.test.ts`. Split from 1.3.1 when formatting revealed its 202-line total; retain one small file and no extra fixture abstraction. (completed: 2026-09-27 09:24)
- [x] 1.3.2 Run full phase verification and independent correctness/semantics review; record results and dispositions here; preserve frozen paths. Install/build/typecheck/formatting and all 2,261 tests pass; both reviews are clear. AR-P9's timeout allowance was not needed. (completed: 2026-09-27 10:41)

Integration verification: all 143 new independent specification cases pass, as do 24 import-boundary
cases and 217 affected existing cases (244 workspace tests including the 27 new declarations).
Logs: `verify-meter.log`, `verify-affected.log`. New internal/regression cases: 12/12 in
`verify-impl.log`. Documentation self-check passed for all implementation tasks: exported
contracts documented, no ephemeral plan identifiers, no new evaluator/runtime or backend import.

Independent Phase 1 review (2026-09-27): correctness reviewer `rd05_phase1_correctness` and
semantics reviewer `rd05_phase1_semantics`, expert 2.0.0 / content
`c9e70fab6039e9ced3108e88f0ea9730d4fd3007`. Both confirmed the bounded phase; the correctness
review confirmed oracle/frozen-path integrity and no additional API/concurrency/standards findings.
The following concrete findings are accepted, not waived. Under the repository workflow prime
directive §4, their determinate compiler corrections are plan-owned decisions and need no new
product-scope approval. They implement already-approved ordinary module and constant rules.
The user was told the recommended correction; no support surface or runtime change is added.

| Finding | Severity | Evidence / disposition |
|---|---|---|
| RV-001 | Major | A source `c64.profile` module can import another value as `rasterLines`, silently replacing the selected fact locally. Reject the conflicting module-level import at its alias token; preserve child-scope shadowing. |
| SR-001 | Major | A conditional arm's large constant intermediate is rejected before an enclosing division reduces it. Retain type compatibility, defer constant range conversion, and honor nonwrapping mode in the existing metered evaluator. |
| SR-002 | Major | An early array extent accepts an incompatible or missing unselected conditional arm. Check both pure arm expressions and compatible types before selecting the extent value; retain selected-path execution/metering. |
| SR-003 | Major | Boolean equality on selected facts fails in early extents/derived constants. Extend the existing early scalar evaluator's Boolean case to ordinary equality/inequality. |

Remediation stays in task 1.3.2 as two bounded review-fix units: module collision checks/tests,
then constant-expression consistency/tests. `frontend/conditional-expressions.ts` joins the
modification set; all other owners were already authorized. Regression additions remain in
`profile-constants.impl.test.ts`; specification oracles are unchanged. Full verification and
one focused re-review are required before this phase can finish.

All four corrections implemented. Re-review baseline tree:
`dd71601c897dbc5c12a20c395e98ea414ed28058`; fix diff `review-fixes.diff` in the log directory.
The 179-case directed run passes, including 19 implementation cases. On the single focused
re-review, the correctness reviewer resolved RV-001 with no findings; the semantics reviewer
resolved SR-001–SR-003 with no surviving findings. Both retained the pending fresh-build/full
verification gate. No production changes are planned after this reviewed fix set.

The first full run's only failure was the unchanged service-publication test exceeding its
5-second limit. Its directed retry passed 8/8 with unchanged limits; the complete pre-fix
retry then passed 2,254 tests (1,435 compiler + 62 CLI + 14 language server + 6 editor + 737
root), including sequential VICE. The 7 additional review-regression cases bring the final
expected total to 2,261. A fresh post-fix install/build/typecheck/full-test run started at
09:39; final evidence must come from that run, not the earlier build.

Post-fix install/build/typecheck/formatting pass. All 24 public review probes (six per profile)
pass on the fresh build. The post-fix workspace run passes 1,441/1,442 compiler cases and all
other workspaces; the same unchanged 5-second service test times out, followed by cleanup
`ENOTEMPTY` while its build is still finishing. An isolated retry repeats that timing/cleanup
failure. No limits/assertions were changed. The complete root/runtime suite started separately
at 09:44 so unrelated qualification can finish; task 1.3.2 remains unverified until the service
case and remaining checks pass. Logs: `test-final.log`, `service-final-retry.log`, `root-final.log`.

At 10:03, post-fix root verification has finished: 733/737 pass. The unchanged finite-call
integration test hits its default 5-second deadline; three padded-image cases hit their
50-second VICE checkpoint deadline. An isolated sequential retry repeats all four failures
(`root-failures-retry.log`). The final service retry repeats the publication deadline for the
third consecutive post-fix attempt and also times out the SFA live-range case, which passed
the complete workspace attempt (`service-last-retry.log`, 6/8 pass). All 162 new tests pass.
The complete M1 VICE journey passes on the post-fix build, but that does not replace these
remaining checks. No limit, assertion, emulator cycle budget, specification test or production
code was changed during retries.

Classification: environment/tool verification blocker, with host load above 20 on 8 CPUs;
load is a likely cause, not proof that the uncompleted runtime assertions would pass. The
user chose to keep working under that load. The exec-plan convergence guard stops repeated
identical retries. Two orphaned VICE children from our timed-out finite-call tests were
identified by their exact temporary artifact arguments and terminated; no other jobs were
stopped. No VICE process remains after the isolated runs. AR-P9 owns the narrow proposed
three-file test-time allowance; it is not implemented. No commit, push, Phase 1 completion,
or Phase 2 start is claimed.

Verification resumed at 10:31 after the user reduced host load and approved AR-P9 if needed.
The two service cases pass with their original 5-second limits (`service-approved-retry.log`);
the four runtime cases are rerunning sequentially, also with original limits. The conditional
modification set is exactly AR-P9's three existing implementation-test files; no timeout
change has yet been needed or applied. Full verification remains required before completion.

All six retries pass unchanged at 10:33: two service cases and four sequential VICE cases
(`runtime-approved-retry.log`). The finite-call case takes 4.36 seconds; padded-image cases
take 32.15, 29.87 and 31.48 seconds, all within their original limits. AR-P9's allowance is
unused; all three named existing test files remain unchanged. No production or test change
has followed the cleared reviews. Fresh install/build/typecheck pass; the full `yarn test`
checkpoint is running (`install-resumed.log`, `build-resumed.log`, `typecheck-resumed.log`,
`test-resumed.log`).

**Final Phase 1 checkpoint, 10:41:** the complete `yarn test` command passes all 2,261 tests:
1,442 compiler + 62 CLI + 14 language server + 6 editor + 737 root. The root suite includes
the complete M1 journey and all previously timed-out cases, run sequentially with original
limits. Install/build/typecheck and all 23 touched TypeScript formatting checks pass. The
four frozen oracle hashes still match; frozen specification/expert paths and existing spec
tests are unchanged. Documentation self-check and both independent reviews remain clear;
no production/test edits followed their reviewed correction set. All Phase 1 tasks are verified.
AR-P9 is closed without a timeout edit. The result is frontend-only; Phase 2 backend admission,
zero-extra-cost proof and Phase 3 four-profile runtime qualification remain unstarted. No full
RD-05 closeout is claimed. The next phase requires its separate effort handoff.

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
All 36 checkboxes must be green; review findings, frozen paths and relevant output debts must be
reconciled. The remaining requirements stay in RD-05. AR-P3 must be resolved before planning
NMI-dependent executable work or declaring the complete RD-05 plan ready. Finish with an
effort recommendation and user handoff before starting the next distinct planning task.
