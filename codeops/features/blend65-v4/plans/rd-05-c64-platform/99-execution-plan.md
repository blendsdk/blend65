# Execution Plan: RD-05 Stage A

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-27 18:51
> **Progress**: 43/43 tasks (100%)
> **CodeOps Artifact Schema**: 1

## Scope and Entry Gate

Execute only [Stage A](01-requirements.md), after its scoped plan preflight and the required
effort handoff. AR-P3 remains a named deferral outside executable work. No task below changes
the frozen language/expert baseline, implements NMI-dependent behavior, or closes RD-05.

**Original goal / smallest viable design:** [00-index](00-index.md#minimum-sufficient-baseline).
**Governing decisions:** AR-P4–AR-P10. Strict scope; no accepted optional additions.
**Quality policy:** `codeops/codeops.json`; independent correctness/maintainability/standards
review at every completed phase. Phases 1–2 additionally need semantics review; Phase 2 is
performance-critical and needs an independent performance audit. Phase 3 includes security and
concurrency review of binary input, target pinning and owned-process cleanup. No web/auth
security profile is invented for this local compiler.

## Implementation Phases

| Phase | Deliverable | Tasks | Depends on |
|---|---|---|---|
| 1 | Source-visible constants and four frontend declarations | 14 | Stage A preflight |
| 2 | Four cooperative build identities and zero-cost output proof | 15 | Phase 1 |
| 3 | Correct emulator selection and four fresh runtime proofs | 14 | Phase 2 |

**Total: 43 tasks across 3 phases / 9 sessions.** Task size is bounded by one reviewable
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

> **Phase baseline tree**: `bfa4d8c58d233c25cb8b4ec3e9b3e13ae2e343b7` (HEAD `62d44c6f`, clean worktree before Phase 2).
> **Lenses**: api-surface, perf
> **Risk**: Target/storage identity, mandatory lowering and startup; semantics and performance review required.

Phase 2 began at confirmed XHigh effort before the disk-full interruption. The full filesystem
truncated this execution record and `test/rd05/profile-fixture.ts`; the subsequent system crash
lost their RAM recovery drafts and temporary logs. At 14:00 both files were restored byte-for-byte
from the verified, remotely confirmed `62d44c6f` checkpoint. Git connectivity passes and 161 GB
is available. No production compiler or frozen-path change was lost. Phase 1's committed
verification record remains authoritative; its tests have not yet been rerun after the crash.

The user confirmed restoration plus the remainder of Phase 2 at XHigh. Strict modification set:
the Phase 2 task files below, additive fixture helpers, this record and the feature roadmap.
The two surviving new specification drafts are unverified, not complete. The independent
specification author will reconstruct output/pipeline tests and fixture additions before a fresh
red run; no Phase 2 implementation has begun. Recovery logs:
`/tmp/blend65-rd05-phase2-resume-7OR8hr/`. Preserve the original baseline so the surviving drafts
remain in the phase review. Coherent green local commits only; no push or Phase 3 execution.

Split additive fixture helpers from 2.1.2 into 2.1.6 before output-test authoring to keep each
unit below the changed-line bound. This adds no test framework, requirement or implementation scope.
Also split output fact/cost comparisons into 2.1.7 and startup/layout proofs into 2.1.8 before
their authoring exceeded the per-task bound; keep the same two planned test files and contracts.

The independent red cases also expose false-pretest-loop assembly failures and a 20-byte PAL
all-fact versus literal-program mismatch. Task 2.2.3 owns these required zero-cost corrections:
avoid constructing unreachable loop edges while retaining initializer/condition effects, and
retain known binary-expression values in existing `semantic/lower-expressions.ts` after ordered
operand effects. That direct expression owner joins the modification set; no new pass, IR form,
runtime, dependency or source rule is introduced. Tests remain independent and are frozen before
production edits. Already-correct paths remain unchanged when their directed proofs pass.

Task 2.2.1 includes a mechanical typing follow-through in `services/services.ts`: after the
generic zero-page reservation helper adjusts resource windows, retain the same selected closed
profile ID when composing the allocation target. This is not Phase 3 emulator/launch work and
does not change reservation or selection semantics. The generic storage subsystem stays generic.

### Session 2.1 — Specification Tests

**Reference:** [03-02 — Target and layout](03-02-cooperative-pipeline.md#target-and-layout),
[03-01 — No runtime cost](03-01-profile-facts.md#no-runtime-cost); AR-P4/AR-P6/AR-P7.

- [x] 2.1.1 [spec-author] Write exact backend identity/admission tests — `packages/compiler/src/target/cooperative-profiles.spec.test.ts`; ST-13. Independent red verified. (completed: 2026-09-27 14:15)
- [x] 2.1.6 [spec-author] Add real-project and artifact-reading helpers to `test/rd05/profile-fixture.ts`, preserving existing analysis/span helpers; split from 2.1.2, ST-14–ST-18. (completed: 2026-09-27 14:15)
- [x] 2.1.2 [spec-author] Write independent selected-effects and branch-removal tests — `test/rd05/profile-output.spec.test.ts`; ST-14; reuse the Phase 1 fixture. (completed: 2026-09-27 14:15)
- [x] 2.1.7 [spec-author] Write all-fact literal comparison and independent assembly/cost expectations — `test/rd05/profile-output.spec.test.ts`; ST-15, split from 2.1.2. (completed: 2026-09-27 14:15)
- [x] 2.1.3 [spec-author] Write fresh evidence identity/repeatability and manifest-inventory tests — `test/rd05/profile-pipeline.spec.test.ts`; ST-16, split from startup/layout proof. (completed: 2026-09-27 14:15)
- [x] 2.1.8 [spec-author] Write four-profile real-ACME startup/layout and initialized-payload proofs — `test/rd05/profile-pipeline.spec.test.ts`; ST-18, split from 2.1.3. (completed: 2026-09-27 14:15)
- [x] 2.1.4 [spec-author] Write retained interrupt-safety cases for the four profiles — `test/rd05/profile-interrupts.spec.test.ts`; ST-17. Independent red verified. (completed: 2026-09-27 14:15)
- [x] 2.1.5 Run Phase 2 spec files red; record missing behavior versus preservation cases here; 07 commands. 83 cases: 72 expected red, 11 preservation green; no setup errors. (completed: 2026-09-27 14:15)

**Verify:** Directed Phase 2 spec files after a fresh build; expected red for new backend profiles.

Independent author `rd05_phase2_spec_recovery` finished 83 cases: 72 expected red, 11 preservation
green. Backend: 12/13 red (three admissions, nine allowlists); output: 38/40 red (30 admissions,
four constant-switch, three false-loop assembler failures, one all-fact 20-byte mismatch);
pipeline: 7/10 red; interrupts: 15/20 red. PAL startup/data/IRQ, if/conditional and manifest
preservation cases pass. Literal controls validate effect-observation plumbing before the failing
profile forms. No forbidden implementation read, parser/setup error, existing-spec edit or
production change preceded this red baseline. Formatting/documentation checks pass. Recovery
preservation: 140/140 existing root frontend and import-boundary cases pass on the fresh build.
Report/logs: `spec-red-report.md`, `spec-backend-red.log`, `spec-root-red-final.log` and
`recovery-preservation.log` in the recovery log directory above.

Frozen Phase 2 oracle SHA-256:

| File | SHA-256 |
|---|---|
| `target/cooperative-profiles.spec.test.ts` | `030c9581eacd2c819ff74933b54ec90df722f725635d0d69a22f48ac20a33f7d` |
| `test/rd05/profile-output.spec.test.ts` | `8ee6b8593b951993323c12f6786412740397b8e2de6d28539384328359696eb8` |
| `test/rd05/profile-pipeline.spec.test.ts` | `10ca52b59e6a02cd6f99d4a317c7f266f5042de8223e3e08b5bc5b5a5bc20501` |
| `test/rd05/profile-interrupts.spec.test.ts` | `f2423ac0810bc0ddcbb65ce4a54bd9e74b9941e8cc5ad560cb663bb7a37b522c` |
| `test/rd05/profile-fixture.ts` | `5a097c26b123e259cb5e20ab1265a249f06d9e2fd4aa70e48836524ae03d903e` |

### Session 2.2 — Implementation

- [x] 2.2.1 Generalize machine facts and compose the four closed target identities, including the bounded machine-file rename — `packages/compiler/src/target/c64-kernal.ts` (from `c64-pal-kernal.ts`), `target/profile.ts`, `services/resource-diagnostics.ts`; 03-02 §Target and layout; ST-13. Fresh build and 15/15 new/existing target cases pass; documentation/formatting checks pass. (completed: 2026-09-27 14:18)
- [x] 2.2.2 Admit the four profiles through existing startup/layout and terminal serializer guards with certificate agreement — `packages/compiler/src/layout/startup.ts`, `layout/c64-layout.ts`, `artifacts/acme-validate.ts`; ST-16–ST-18; PF-001. Fresh build and 30/30 pipeline/interrupt cases pass. Serializer/packager, closed-certificate, machine and layout validation are retained; documentation check passes. (completed: 2026-09-27 14:19)
- [x] 2.2.3 Remove constant-switch dead paths in existing CFG lowering; prove all selected constant paths preserve effects and disappear before storage closure — `packages/compiler/src/semantic/cfg.ts`, `semantic/lower-expressions.ts`; existing `semantic/lower-calls.ts` and `semantic/lower.ts` remain unchanged. 03-01 §No runtime cost; ST-14–ST-15; PF-004. Fresh build and 40/40 output cases pass; documentation/formatting checks pass. Selector/initializer effects, default/fallthrough and exact literal parity hold. No new optimization pass. (completed: 2026-09-27 14:20)
- [x] 2.2.4 Run all Phase 2 specification files green; preserve existing version-1 validators and safe/unsafe interrupt results; record results here. All 83 new cases pass; 146 affected workspace cases and 23 existing root resource/interrupt cases pass. No existing oracle changed. (completed: 2026-09-27 14:25)

**Verify:** Directed Phase 2 spec files plus existing target, startup, resource/evidence and
RD-04 interrupt/expressiveness suites; 07 commands. Do not change spec expectations.

### Session 2.3 — Implementation Tests and Hardening

- [x] 2.3.1 Add machine/storage agreement, startup-certificate and terminal serializer/packager/open-or-mismatched-certificate rejection tests — `packages/compiler/src/target/cooperative-profiles.impl.test.ts`; 03-02 §Target and layout; PF-001. All 24 cases pass; existing tests unchanged. (completed: 2026-09-27 14:28)
- [x] 2.3.3 Add bounded internal regression cases for known binary values and CFG effect ordering — `packages/compiler/src/semantic/cfg.impl.test.ts`; split from 2.3.1 before writing to keep target guards and semantic regressions independently reviewable. Reuse its existing fixture; no new support surface. All 17 cases pass (nine new); documentation/formatting checks pass. (completed: 2026-09-27 14:28)
- [x] 2.3.2 Run full phase verification and independent correctness/semantics/performance reviews; record measured output deltas and any required existing/new debt issue here. AR-P10 final correction verified after the concrete runtime red; SR-001/RV-001 and SR-002 resolved. Install/build/typecheck, all 2,387 tests and documentation checks pass. Required initial reviews and one focused re-review completed; no third review claimed. (completed: 2026-09-27 17:11)

Directed checks pass: 83/83 independent new cases, 33/33 new internal cases, 146 affected workspace
cases and 23 affected root cases. No frozen oracle changed. At 14:34 the complete checkpoint passes:
install/build/typecheck, all 18 touched-file formatting checks, and all 2,377 tests (1,488 compiler,
62 CLI, 14 language server, six editor, 807 root including sequential VICE). All original deadlines
remain unchanged. No public evidence schema, startup instruction sequence or test expectation was
relaxed. Logs: `install-final.log`, `build-final.log`, `typecheck-final.log`, `test-final.log`,
`format-final.log`. Three independent phase reviews are running; 2.3.2 is not yet complete.

Independent correctness and performance reviews are clear. The semantics review found two
necessary correctness corrections in the direct blast radius of the new constant consumers:

| Finding | Severity | Accepted correction |
|---|---|---|
| SR-001 / RV-001 | Major | `poke(&local, 2)` or a synchronous call can leave the local's old known value available to arithmetic/switch folding. Final AR-P10 ruling: raw memory and every runtime call forget mutable values, including no-argument calls because numeric addresses can alias caller storage. Preserve readonly constants and initialization/provenance metadata. |
| SR-002 | Major | A module assignment after IRQ installation reestablishes a known value even though an interrupt may change it before its next read. At the existing scalar name-read owner, expose neither a constant nor an exact value for mutable module storage without interference proof. Assignment results and readonly/profile constants stay foldable. |

These are determinate language-correctness fixes under workflow prime directive §4, not new
product choices or restrictions. Both are accepted, not waived. The independent semantic reviewer
confirmed no new semantic decision or support surface is needed. Extend the modification set only
to existing `frontend/flow-facts.ts`, `frontend/direct-calls.ts`, `frontend/scalar-expressions.ts`, additional cases in
`semantic/cfg.impl.test.ts`, and one bounded public-runtime regression file
`test/rd05/profile-mutable-values.impl.test.ts` using the existing project/VICE helpers. Work in two
small units (fact correction/internal regression, then runtime regression). Frozen oracles remain
unchanged. Later effect/alias/interrupt-aware optimization can recover safe mutable values; this
adds no runtime barrier or new analysis framework. Re-review once on the fix diff, followed by a
fresh full checkpoint. Fix baseline tree: `d6a4eb699f27a91cb06dac1e001e8fcab8d5b9b1`.

Historical draft (superseded by AR-P10): the first conservative call correction failed one existing
aggregate specification expectation and one implementation expectation. The temporary diagnosis
treated the loss of a non-borrowed local's value as unnecessary and narrowed invalidation using
existing argument address origins. The later numeric-address witness disproved that justification.
No new state, escape analysis, effect lattice or pass was added. Six new internal regression cases cover raw/aliased addresses, synchronous calls,
unqualified/qualified shared reads and Boolean equality. One draft qualified-name fixture was
corrected to export its shared declaration; no production rule was changed to admit private access.
All 526 frontend/CFG cases, 40 output cases and the new sequential PAL VICE regression now pass.
The VICE oracle independently observes `[3, 3, 3, 1, 2, 22, 6, 3]` after byte/word/alias/call writes,
switch selection and an immutable profile read. Full post-fix verification is running; reviews
must judge the final narrowed correction, not the rejected all-call invalidation draft.

A final counterexample showed scalar argument origins do not describe an address carried through
a struct or one of its fields. Do not add a new alias analysis merely for this correction. The
final smaller rule forgets mutable local values for calls with arguments, preserves them for
no-argument calls (legal local borrows cannot escape into persistent state), and keeps raw-memory
access conservative. Two further internal cases and two runtime observations cover aggregate-held
addresses. The final directed runs pass 528 frontend/CFG cases and 41 public output/runtime cases;
the independent VICE bytes are `[3, 3, 3, 1, 2, 22, 6, 3, 3, 3]`. The preceding intermediate full
run passed 2,384 tests, but does not qualify this final refinement: rerun the complete command and
use only its fresh result. No frozen test was edited, no permanent optimization barrier was added,
and no precision claim beyond the current proof is made.

An additional runtime-selector probe with all-returning switch clauses fails real ACME's strict
segment check (`Segment starts inside another one, overwriting it`). This is separate from the
constant-selector work; that runtime lowering branch is unchanged, and the earliest affected
commit is not established. Filed [#90](https://github.com/blendsdk/blend65/issues/90) with the exact
source and observed failure, owned by remaining RD-05 correctness work before full RD closeout.
The alias-runtime regression uses ordinary switch stores to isolate the reviewed fact defect;
the independent all-returning failure is retained in the issue, not declared passing. No new
source restriction, hidden waiver, historical qualification claim or speculative repair is made.

**Focused re-review outcome, 14:57:** performance is clear; correctness and semantics independently
confirm that the no-argument exception is still unsound. Consolidate RV-001 with unresolved SR-001;
SR-002 is resolved. The exact final-layout witness is:
`function change(): void { poke($0acd, 2); }` called after initializing local `value` to 1, then
`poke($0420, value + 1)`. SFA places `value` at `$0ACD`; the callee writes 2 there, but the caller
emits immediate 2 instead of required 3. No argument is needed for this raw alias. The earlier
no-borrow justification above is disproved and must not be used as authority.

[AR-P10](00-ambiguity-register.md#ar-p10--sound-values-across-runtime-calls) proposes the smallest
safe all-runtime-call invalidation and exactly two analysis-precision expectation updates, one in
an existing specification test. That immutable-oracle change requires explicit approval. Stop here:
no third review, silent test edit, new effect-analysis framework, commit, push or Phase 3 work.
The final full test command may finish, but a green result does not close this known miscompile.
Review lineage: expert 2.0.0 / `c9e70fab6039e9ced3108e88f0ea9730d4fd3007`; roles
`rd05_phase2_correctness`, `rd05_phase2_semantics`, `rd05_phase2_performance`. Both rounds retained
all five frozen hashes and unchanged language/expert paths. The working diff is preserved for the
user's ruling; task 2.3.2 and Phase 2 are not complete.

**Final verification at the pause, 14:58:** install/build/typecheck and all 2,386 tests pass
(1,496 compiler + 62 CLI + 14 language server + six editor + 808 root, including sequential VICE).
Logs: `install-qualified.log`, `build-qualified.log`, `typecheck-qualified.log`,
`test-qualified.log`; all 22 changed code/record files pass formatting, and the three updated
pause records pass the follow-up formatting check. The raw no-argument alias is an independently
established coverage gap, not a test timeout or a cleared defect. Existing specification tests
and frozen language/expert files remain untouched. Working changes are deliberately uncommitted
until AR-P10 is ruled and the known correctness failure is repaired. No push occurred.

**AR-P10 approval, 17:00:** the user accepted the preceding explicit approval request with
“proceed”. Resume the confirmed XHigh Phase 2 batch. The modification set adds only the two
named expectation edits in `frontend/aggregates.spec.test.ts` and `frontend/scalars.impl.test.ts`;
existing correction and regression owners stay unchanged. Record a failing concrete no-argument
raw-write case before removing the exception, then prove its runtime result and the retained
265-valued index. No new support surface or third review; no Phase 3 work or push. The previous
green checkpoint does not qualify this pending correction.

**Final correction implemented, 17:04:** the two approved expectation edits and the added internal
regression fail as expected before the correction (77 pass / three fail). After resolving a test-only
debug-symbol lookup error, the real VICE regression reproduces exactly the missing result: the
numeric no-argument write yields 2, not 3, while all other markers and the index-265 sentinel pass.
Its two-build setup resolves the local through final debug storage, patches only the four-digit
numeric literal, and asserts the address stays identical on rebuild. No address is guessed or
provided to the callee as an argument. Logs: `ar-p10-red.log`, `ar-p10-runtime-red-final.log`.
The production fix now delegates every runtime call to the existing all-mutable invalidation
helper. Immutable facts, initialization and provenance metadata remain untouched. Directed and
full fresh verification remain pending; the runtime oracle is `[3,3,3,1,2,22,6,3,3,3,3,77]`.

Directed post-correction checks pass: 529 frontend/CFG cases and 71 public output/pipeline/
interrupt/runtime cases (`ar-p10-directed-green.log`, `ar-p10-runtime-green.log`) after a fresh
build. The VICE byte at `$042A` is now 3, while `$042B` is the sentinel at index 265 rather than
the distinguishable index-9 sentinel. All five frozen Phase 2 hashes still match. The only
existing specification-test diff is the approved single expectation; the other approved edit is
the single implementation-test expectation. Full install/build/typecheck pass; the complete test
run is still in progress. Formatting, local links and the documentation self-check pass. The
roadmap engine confirms this feature's 2/10 RD count; its sole drift report is the already-deferred
portfolio roll-up on this non-integration branch. No portfolio edit or extra review is made.

**Final Phase 2 checkpoint, 17:11:** fresh `yarn install --frozen-lockfile`, `yarn build`,
`yarn typecheck` and the complete `yarn test` pass. Final count: **2,387** = 1,497 compiler +
62 CLI + 14 language server + six editor + 808 root. The root suite includes the full M1
journey and the final numeric-alias/index regression; VICE runs sequentially. Original wall-clock
and emulated-cycle limits remain unchanged. Final logs are `ar-p10-{install,build,typecheck,test}-final.log`
in `/tmp/blend65-rd05-phase2-resume-7OR8hr/`. The 22 touched TypeScript files pass formatting and
documentation checks; local document links, plan counts, exact oracle diffs and frozen paths are
validated. No active architecture-document set needs an update; no new architectural subsystem
was introduced.

Finding closure: SR-001/RV-001 is repaired by the exact user-approved all-runtime-call rule,
the internal load-after-call regression, and the independently expected VICE result 3 after the
recorded result-2 red. SR-002 was cleared by the focused review and its regressions remain green.
The performance review is clear; no runtime barrier, effect-analysis state, dependency or source
restriction is added. This is the authorized correction after the one permitted re-review, not
a claim of a third independent review. The two old expectation edits are exactly AR-P10's ruling;
all five Phase 2 oracle hashes and the language/expert baseline remain unchanged.

All 15 Phase 2 tasks are verified. Phase 3's 11 tasks remain unstarted. RD-05 stays open with
AR-P3 and issue #90 retained under their existing owners. Build/assembly/cost evidence is
**Verified complete** for this phase; its PAL regression is **VICE-verified / hardware-unverified**.
Four-profile emulator selection and fresh runtime qualification remain Phase 3, not a claim here.
Knowledge lineage remains expert 2.0.0 / `c9e70fab6039e9ced3108e88f0ea9730d4fd3007`, particularly
`references/blend65-semantics.md`, `references/il-and-optimization.md` and
`references/sfa-and-abi.md`; frozen raw-memory semantics govern the numeric-alias correction.

Output measurements (`cost-measurements.log`, `cost-call.log` in the recovery log directory):

| Equal-contract measurement | Result |
|---|---|
| Selected marker versus literal marker | Same PRG, cost totals, physical memory and stack demands; the selected `LDA #imm; STA $0420` is 5 bytes / 6 nominal CPU cycles. No dispatch or profile storage. |
| Empty returning program | 647 emitted bytes; 697 resident bytes; zero ZP/scratch; 21-byte reported hardware-stack aggregate (one-byte program peak plus 20-byte platform reserve). |
| One selected marker program | 652 emitted bytes; 702 resident bytes; unchanged ZP/scratch/stack demand. |
| Startup separate from body | Entry 345 bytes / 463 nominal instruction cycles; restore 287 bytes / 393 cycles; BASIC stub 12 bytes; saved platform state 50 BSS bytes. The empty main's cooperative return jump is a separate 3 bytes / 3 cycles. No DMA/interrupt time is included in these instruction sums. |
| Existing whole-program debt | A sole `paint(color: byte)` wrapper retains 15 bytes / 26 nominal cycles versus the direct 5 bytes / 6 cycles, plus one parameter byte. This is the exact open [#79](https://github.com/blendsdk/blend65/issues/79) constant-call/SFA debt, not a new profile cost. Its path to the win is constant-value specialization, safe leaf-call elimination and dead-home removal. |
| Existing layout debt | The main-to-next-restore jump costs 3 bytes / 3 cycles. Open [#51](https://github.com/blendsdk/blend65/issues/51) owns proved fallthrough elision. No new duplicate issue or optimizer is needed here. |

The direct store meets the local expert floor; a whole-program beat is not claimed. The existing
issues retain measured routes beyond that floor. Nominal instruction counts do not claim elapsed
C64 timing: public whole-program path cycles remain explicitly `Unknown`, and four-profile runtime
qualification is still Phase 3. Structured effects and selected identities remain available before
SFA, so this work does not close off later peephole, allocation or whole-program improvements.

**Deliverable:** Four build identities and the specified zero-extra-cost proof; no runtime
qualification claim until Phase 3.
**Verify:** Full 07 command set, frozen-path check and the phase reviews above.

## Phase 3: Exact Emulator Selection and Qualification

> **Phase baseline tree**: `951acc588778707a3526b5eb3e1c45f09a706117` (HEAD `1a224c45`, clean worktree).
> **Lenses**: security, concurrency, api-surface
> **Risk**: Pinned-generation identity, binary monitor input and owned process cleanup.

Execution started 2026-09-27 17:47 after the user confirmed High for the complete Phase 3
batch. Strict scope: only the Phase 3 task paths below, this execution record and the feature
roadmap. No pre-existing changes. Reuse the existing process, monitor and project helpers;
no new runner, configuration layer, dependency, public schema or interrupt behavior.
Independent specification authoring precedes implementation. Preserve every existing oracle
and both frozen paths. Logs: `/tmp/blend65-rd05-phase3-OIYPb2/`. Coherent green local commits
only; no push. AR-P3 and issue #90 remain outside this phase and owned by later RD-05 work.

Before authoring crosses the task-size limit, split service failure and pin-preservation tests
from 3.1.1 into 3.1.5/3.1.6, and runtime state assertions from 3.1.3 into 3.1.7. These are
bookkeeping splits within the same three planned files and test families, not additional scope
or support machinery. Each implementation unit remains below 200 added lines.

### Session 3.1 — Specification Tests

**Reference:** [03-02 — Emulator launch](03-02-cooperative-pipeline.md#emulator-launch) and
[Qualification](03-02-cooperative-pipeline.md#qualification); AR-P7/AR-P8.

- [x] 3.1.1 [spec-author] Write external-process setup and exact run-selection tests — `packages/compiler/src/services/vice-profiles.spec.test.ts`; ST-19. Verified 2026-09-27 17:59: four exact-argv failures as expected; documentation/reference self-check clean.
- [x] 3.1.5 [spec-author] Write snapshot, stale-generation, cancellation and process-failure tests — `packages/compiler/src/services/vice-profiles.spec.test.ts`; ST-20–ST-21; split from 3.1.1. Verified 2026-09-27 17:59: snapshot selection red; five unchanged lifecycle/source cases pass.
- [x] 3.1.6 [spec-author] Write cleanup-uncertainty and pin-lifecycle tests — `packages/compiler/src/services/vice-profiles.spec.test.ts`; ST-21; split from 3.1.1. Verified 2026-09-27 17:59: uncertain cleanup fails the bounded outcome assertion; final cleanup leaves no fake-VICE process. Suite: 6 expected failures / 5 preservation passes.
- [x] 3.1.2 [spec-author] Write bounded resource-get protocol cases — `test/rd05/vice-resource.spec.test.ts`; ST-22. Verified 2026-09-27 17:57: 15 intentional missing-method assertion failures, no collection error. Documentation/reference self-check clean. Log: `spec-vice-resource.log`.
- [x] 3.1.3 [spec-author] Write four-profile runtime setup and active-model tests — `test/rd05/profiles-vice.spec.test.ts`; ST-23; retain ST-25's existing file unchanged. Verified 2026-09-27 18:00: four fresh real builds reach the missing-resource-reader assertion, no setup or collection failure.
- [x] 3.1.7 [spec-author] Write startup, selected-body and caller-return assertions — `test/rd05/profiles-vice.spec.test.ts`; ST-24; split from 3.1.3. Verified 2026-09-27 18:00: independent state/initializer/store assertions authored; runtime red at the required active-resource boundary. Documentation/reference self-check clean.
- [x] 3.1.4 Run Phase 3 spec files red, sequentially for VICE; record failures and existing preservation cases here; 07 commands. Verified 2026-09-27 18:00: 25 intentional failures / 5 preservation passes; formatting, documentation and cleanup checks pass. No implementation file was exposed to the independent author or edited before red.

Independent oracle freeze before implementation:

| File | SHA-256 |
|---|---|
| `packages/compiler/src/services/vice-profiles.spec.test.ts` | `b2c21de012c432e45e078f52e9530d80a74ca2cc5cec75ac0ee54ae8fc6286f1` |
| `test/rd05/vice-resource.spec.test.ts` | `b1697b8907369babb87dd83592b35d7458a72cc3f691224f025bef7dba9e38b2` |
| `test/rd05/profiles-vice.spec.test.ts` | `0e200dec5ab889e1cb2ffb4e0f4969ba8dc6e38cd8060ac64d78db0a6ef09402` |

Red logs: `spec-vice-profiles-bounded.log` (6 failures / 5 passes),
`spec-vice-resource.log` (15 failures), `spec-profiles-vice.log` (4 failures).
The first service run exposed an indefinite wait after denied process termination; its test
cleanup was bounded before freezing the oracle. The owned orphan from that initial red run
was explicitly identified and stopped. The required correction is within the existing lifecycle
contract: return recovery-required when bounded cleanup cannot prove exit, retaining the pin.
No process framework or new failure category is needed.

**Verify:** Directed Phase 3 tests; missing helper/configuration must fail, never silently skip.

### Session 3.2 — Implementation

- [x] 3.2.1 Carry the fresh build's private selected identity into fixed-argv interactive launch — `packages/compiler/src/services/services.ts`, `services/vice.ts`; 03-02 §Emulator launch; ST-19–ST-21. Verified 2026-09-27 18:04: 25/25 new and existing service cases pass, including bounded uncertain cleanup and pin retention. Documentation/reference self-check clean. First run had one old five-second timeout under load; unchanged retry passed. Logs: `green-services.log`, `green-services-retry.log`.
- [x] 3.2.2 Extend the existing qualification helper with the closed optional profile argument and pinned-ROM ordering — `test/m1/vice-runtime.ts`; 03-02 §Qualification; ST-23–ST-25. Verified 2026-09-27 18:04: four fresh runtime profiles pass, exact resources and ROM identities observed. Documentation/reference self-check clean. The closed type is reused through existing public `TypedProgram`; no compiler API export was added. Default M1 compatibility remains the next task's required check.
- [x] 3.2.3 Add the single bounded integer-resource reader to the existing monitor — `test/m1/vice-monitor.ts`; 03-02 §Qualification; ST-22–ST-23. Verified 2026-09-27 18:03: all 15 protocol tests and four real-profile runtime cases pass. Documentation/reference self-check clean. Reuses existing request/envelope/timeout handling; 675 lines, no general monitor refactor. Log: `green-runtime.log`.
- [x] 3.2.4 Run Phase 3 spec files and the unchanged M1 journey green, sequentially; record actual selected resources and runtime outcomes here. Verified 2026-09-27 18:05: 30/30 new cases plus unchanged complete 441-input M1 journey pass. Sequential VICE logs: `green-runtime.log`, `green-m1.log`; service log above. Status: VICE-verified / hardware-unverified.

Runtime observations: VICIIModel 0 for PAL / 3 for later NTSC, SidModel 0 for 6581 / 1 for
8580; both CIAs 0 and KernalRev 3 in every run. The selected raster/SID words and one source
border store match each profile. Each initializer executes once and loaded constant data receives
zero writes. All four reach the captured BASIC caller at `$E147`, restore observed ports, device
readbacks, CINV/NMINV and I/D, and change SP from 246 to 248 only through the final RTS.
Exact executable/ROM hashes and per-PRG hashes are retained in the runtime log and final handoff.

**Verify:** Directed Phase 3 tests and existing `test/m1/vice.spec.test.ts`; 07 commands;
`VICE-verified / hardware-unverified` only for successfully observed cases.

### Session 3.3 — Implementation Tests and Handoff

- [x] 3.3.1 Add argument-assembly/resource-decoder and process-error edge tests — `packages/compiler/src/services/vice-profiles.impl.test.ts`, `test/rd05/vice-resource.impl.test.ts`; 03-02 §Evidence and failures / Qualification. Verified 2026-09-27 18:07: 6 service and 9 transport/helper cases pass. Documentation/reference self-check clean. The two focused files total 156 lines. Logs: `green-service-edges.log`, `green-resource-edges.log`.
- [x] 3.3.2 Run full Stage A verification and independent phase review, including security/concurrency lenses; record results and close review findings here. Verified 2026-09-27 18:44: final install/build/typecheck and all 2,434 tests pass; RV-001 resolved by the single focused re-review. Documentation/reference checks clean; frozen oracles and paths unchanged. Exact commands and retry evidence below.
- [x] 3.3.3 Write the bounded Stage A evidence/deferral handoff and update only the feature roadmap — `08-stage-a-handoff.md`, `../../00-roadmap.md`; 01 §Stage Acceptance. Verified 2026-09-27 18:51: targeted formatting, 49 local links/anchors, four exact runtime observations and pins, source/decision keys, task totals and retained owners pass. Full RD-05 stays open; the next bounded correctness-planning owner is issue #90, with AR-P3 and all remaining scope retained.

**Deliverable:** Stage A runtime proof and an honest remaining-work handoff, not RD closeout.
**Verify:** Full 07 command set for 3.3.2. For 3.3.3, targeted Markdown formatting, links,
source/decision keys, task totals and retained deferral ownership; no compiler changes after
the full verification checkpoint.

### Phase 3 review and correction

Reviewer `/root/rd05_phase3_review` covered correctness, maintainability, standards, security,
concurrency and API surface. It confirmed the minimal direct-extension design, all oracle hashes,
unchanged frozen paths and the initial complete green verification. No separate security-profile
auditor applies to this local process/monitor change; those checks are owned by the reviewer.
No emitted-code change calls for a performance or semantics audit.

| Finding | Evidence | Ruling / correction |
|---|---|---|
| RV-001 — Major, concurrency | Both launch and probe return `cleanup-uncertain`, but referenced child handles (and probe pipes) keep a CLI-style caller alive after it sets exit code 10. The reviewer reproduced natural exit only after the outer fixture killed the exact owned child. | Accepted necessary correction under the confirmed Phase 3 batch and project workflow directive 4: release only parent-side event-loop ownership after bounded termination fails. Preserve recovery-required and the retained pin. This is the existing completion contract, not a product choice, new support surface or test-oracle change. |

Correction baseline: `8804a07396ddc09cc61ad514a837368beb8f3475`. Modification set remains
`services/vice.ts` and `services/vice-profiles.impl.test.ts`, plus this execution record.
Add a bounded isolated-process regression first; apply the small existing-helper correction;
rerun directed and full verification, then request the one allowed focused re-review.
Regression implemented 2026-09-27 18:22; red verification found both expected failures against the exact built
JavaScript consumed by Node callers. It requires natural exit code 10 before the outer fixture
cleans up the still-live, precisely identified emulator process.
Correction implemented 2026-09-27 18:22: the existing bounded termination helper releases only
the child's host handles after uncertain cleanup. No change to signal attempts, deadlines,
classification or retained pin. Verification pending.
Directed verification passed 2026-09-27 18:23: fresh build and all 33 service cases, including
both natural-caller-exit regressions and retained-pin assertions. Logs:
`review-regression-red.log`, `review-build.log`, `review-fix-green.log`.
Fresh full verification and the single focused re-review now gate completion independently.

The one focused re-review completed: **RV-001 resolved; no fix-introduced findings**.
It verified safe settlement even if closing owned pipes triggers `close`, unchanged recovery/pin
behavior, the two red-to-green natural-exit regressions, frozen hashes and the minimal existing-helper
design. No third review is authorized or required. Fresh full verification is the remaining gate.

The first post-review full run hit the existing implicit five-second host deadline in
`test/rd04/expert-calls.impl.test.ts` while load was 18.82 on eight CPUs. Its initial full-run
result was green; the new 33-case process correction suite is also green. Finish collecting this
run, then rerun `yarn test --testTimeout 30000`, using Vitest's existing temporary command option
for root tests. No test/configuration file, assertion, explicit test bound, monitor deadline,
emulated-cycle cap or generated-code cost limit changes. This is bounded verification under
host contention, not a renewed AR-P9 modification allowance or a new support mechanism.
Any non-timeout failure remains a defect; a continuing timeout is investigated, not declared green.
That run ended with 2,433 passes and only the five-second `expert-calls` timeout. The timed-out
worker left its detached test emulator alive; its exact PID/group 258530, fixture path, current
workspace and `VITEST_WORKER_ID=40` were confirmed before stopping only that group. No unrelated
process was touched. The timeout-adjusted full retry starts with no leftover test emulator.

The timeout-adjusted retry was interrupted by SIGTERM (shell status 143) before completion;
its cause is not established. Its partial log also records one unchanged scalar-runtime monitor
ownership failure. Do not treat that run as green or weaken socket attestation. After confirming
workspace, fixture, group and `VITEST_WORKER_ID=35`, stop only orphaned test VICE group 300983.
Recheck both affected old cases in isolation, then obtain a fresh complete full result. Log:
`final-test-host-bound.log`; bounded recheck: `environment-recheck.log`.
Both affected cases passed unchanged in that recheck (3.78 seconds for scalar runtime and
2.99 seconds for expert calls). The ownership failure did not reproduce; the interrupted run
remains unqualified. Retry the complete command after cleanup; machine load has fallen to 5.93.
Current complete retry log: `final-test-retry.log`. No source, oracle, configuration or timeout
file changed between these verification attempts.

**Final checkpoint, 2026-09-27 18:44:** `yarn install --frozen-lockfile`, `yarn build`,
`yarn typecheck` and `yarn test --testTimeout 30000` pass. Total: **2,434 tests** = 1,516 compiler +
62 CLI + 14 language-server + 6 editor + 836 root (89 root files). The retry reused the successful,
unchanged workspace results and freshly executed the complete sequential root suite. All four
profile proofs and unchanged M1 pass. Logs: `final-install.log`, `final-build.log`,
`final-typecheck.log`, `final-test-retry.log`. The temporary 30-second default is host-only;
no source/configuration/test expectation, explicit deadline or emulated-cycle limit changed.
No unresolved review finding remains. Technical-docs hook is N/A: no opted-in active architecture
documentation set or new architectural surface; the bounded evidence handoff is the final task.

## Success and Remaining Ownership

Stage success is exactly [01 — Stage Acceptance](01-requirements.md#stage-acceptance).
All 43 checkboxes must be green; review findings, frozen paths and relevant output debts must be
reconciled. The remaining requirements stay in RD-05. AR-P3 must be resolved before planning
NMI-dependent executable work or declaring the complete RD-05 plan ready. Finish with an
effort recommendation and user handoff before starting the next distinct planning task.
