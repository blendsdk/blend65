# Execution: keyboard and combined input

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-10 09:40 CEST
> **Progress**: 0/29 tasks (0%)
> **CodeOps Artifact Schema**: 1

## Implementation phases

| Phase | Title                                                    | Tasks | Dependency                                |
| ----- | -------------------------------------------------------- | ----- | ----------------------------------------- |
| 1     | Three existing-consumer output corrections               | 13    | Approved AR-P12; qualified T-11/T-12/T-14 |
| 2     | Complete ordinary-source input library and qualification | 16    | Phase 1 GREEN and reviewed                |

Task checkboxes are the sole progress authority. Immediately mark implemented
work `[~]` with its actual timestamp; promote to `[x]` only after relevant
verification. Update Progress/Last Updated after each task. Resume the first
`[~]`, otherwise first `[ ]`; `[!]` requires an explicit blocked reason.
Green coherent checkpoints use the git-commit skill, without asking; never push
automatically. Expected RED or incomplete public library work is not committed.
The standing named RD-05 effort confirmation applies; recommend effort before
each task without repeated confirmation pauses. New material scope decisions
retain their normal gate.

Production paths below are relative to `packages/compiler/src/` unless fully
qualified. Root owns tightly coupled implementation and durable progress.
Specification authors own only their assigned new test file, cannot read
implementation, and cannot review their own oracle. Record a real phase baseline
tree before starting; exclude any earlier dirty work. Keep every implementation
task to one concern and 1–3 files; split before execution if it grows to 200
added lines, six files or multiple independent concerns. A split changes ordering,
not authority. Existing specification tests remain unchanged except the exact
task 2.2.7 exception. Focused implementation-test extensions are named below;
preserve their still-valid negative/effect guards.

## Phase 1: output corrections

### Session 1.1 — independent specification tests

Reference: [03-01](03-01-output-corrections.md), [07](07-testing-strategy.md).

- [ ] 1.1.1 [spec-author] Write ST-1–ST-3 in `test/rd05/input-index-output.spec.test.ts` using ordinary-source public fixtures.
- [ ] 1.1.2 [spec-author] Write ST-4–ST-6 in `test/rd05/input-expression-output.spec.test.ts`; freeze independent flag/effect and intended-byte expectations.
- [ ] 1.1.3 [spec-author] Write ST-7–ST-9 in `test/rd05/input-call-output.spec.test.ts`; freeze equivalent source/ABI boundaries and actual-byte expectations.
- [ ] 1.1.4 Run the three new files before production changes; record expected RED output assertions and justified baseline-pass safety cases in this document.

Verify: `yarn vitest run test/rd05/input-index-output.spec.test.ts
test/rd05/input-expression-output.spec.test.ts test/rd05/input-call-output.spec.test.ts`.
VICE portions run sequentially. No implementation or RED commit yet.

### Session 1.2 — three separate existing-consumer corrections

Reference: [03-01](03-01-output-corrections.md). Reuse existing pre-SFA facts and
fallbacks. Do not combine the three families into a new optimization pass.

- [ ] 1.2.1 Retain proved zero-high/byte ordinal facts in `machine/lower-scalar.ts` and `lower-state.ts`; ST-1–ST-3.
- [ ] 1.2.2 Consume those facts for stride-one addressing and adjacent aggregate-byte delivery in `machine/lower-aggregate-index.ts`, `lower-aggregate.ts` and existing forwarding where required; ST-1–ST-3.
- [ ] 1.2.3 Correct adjacent byte expression/valid zero-flag delivery in `machine/lower-register-forwarding.ts` and `lower-scalar.ts`; ST-4–ST-6.
- [ ] 1.2.4 Preserve proved fixed aggregate-place identity in the existing `machine/lower-aggregate.ts` / `lower-state.ts` producer-to-consumer path; ST-7–ST-8.
- [ ] 1.2.5 Consume fixed places and eligible immediate byte-call results in `machine/lower-call.ts` / `lower-register-forwarding.ts`; ST-7–ST-9.
- [ ] 1.2.6 Rebuild and run all three new files to GREEN without changing their oracle; record actual output/resource deltas here.

Verify: rebuild after production edits, then the directed command above and
impacted existing scalar/index/aggregate/call/forwarding suites. After each family
run its own new file immediately; only proceed with its behavior and output
expectations GREEN. A later family's RED baseline is not waived. No local
analytical subtraction substitutes for complete assembled evidence.

### Session 1.3 — internals, checkpoint and review

- [ ] 1.3.1 Add focused `packages/compiler/src/machine/input-index.impl.test.ts` guards after GREEN; [03-01](03-01-output-corrections.md#masked-addressing-and-aggregate-byte-delivery).
- [ ] 1.3.2 Add adjacency/flag/fixed-place/call fallback cases to existing `lower-register-forwarding.impl.test.ts` and `call-retention.impl.test.ts`; [03-01](03-01-output-corrections.md).
- [ ] 1.3.3 Run complete phase verification and independent correctness, semantics/DX, SFA/ABI, platform, output and host-performance reviews; retain `08-phase-1-review.md`, dispose findings and update this plan/roadmap.

Verify: root install/build/typecheck/full tests; targeted formatting, frozen/old
oracle guards, actual ST-9 resource evidence. Reviewers run in waves under the
four-total limit. No library API is published by this phase. A green local
checkpoint follows verification/review, with no push.

## Phase 2: complete source input library

### Session 2.1 — independent specification tests

Reference: [03-02](03-02-saved-input.md), [03-03](03-03-acquisition.md), [07](07-testing-strategy.md).

- [ ] 2.1.1 [spec-author] Write ST-10–ST-15 in `test/rd05/input-saved-data.spec.test.ts`; keep the electrical oracle independent of implementation.
- [ ] 2.1.2 [spec-author] Write ST-16–ST-17/ST-22/ST-24 in `test/rd05/input-acquisition.spec.test.ts` using existing build/VICE interfaces and preserved negative cases.
- [ ] 2.1.3 [spec-author] Write ST-23 output/resource assertions in `test/rd05/input-library-output.spec.test.ts`; derive complete equivalent expert acquisition/query/caller baselines before production edits. ST-18–ST-22 native matrix/RESTORE cases use the already-owned procedure in 07, not a new test framework.
- [ ] 2.1.4 Run all three new files to RED for the absent public library; record baseline diagnostics and oracle provenance here.

Verify: `yarn vitest run test/rd05/input-saved-data.spec.test.ts
test/rd05/input-acquisition.spec.test.ts test/rd05/input-library-output.spec.test.ts`.
Missing library/API is RED, not a permitted skip or commit. Stop for an exact
runtime ruling if the ordinary source or complete output needs support beyond
AR-P12; do not weaken the accepted behavior to produce GREEN.

### Session 2.2 — ordinary source implementation

All source changes below target `packages/compiler/stdlib/c64/input.blend`.
Prepare/qualify through normal builds. The complete public surface and its one
old inventory amendment publish together at the coherent phase checkpoint,
after native qualification, full verification and independent reviews;
partial declarations or an UNAVAILABLE-only acquisition stub are not shipped.

- [ ] 2.2.1 Add documented declarations and the exact matrix enum; [03-02 §Declarations](03-02-saved-input.md#declarations), ST-10.
- [ ] 2.2.2 Add bounded private compatibility/population-count source helpers; [03-02 §Query implementation](03-02-saved-input.md#query-implementation), ST-12–ST-14.
- [ ] 2.2.3 Implement guarded `keyState` over borrowed saved data; 03-02, ST-11–ST-15.
- [ ] 2.2.4 Implement guarded `joystickState` for both ports; 03-02, ST-11–ST-15.
- [ ] 2.2.5 Add named register constants, full result initialization and the balanced one-attempt acquisition transaction; [03-03 §Source transaction](03-03-acquisition.md#source-transaction), ST-16–ST-17.
- [ ] 2.2.6 Add the private PA-only callback/shared marker and complete route ordering; [03-03 §Interrupt callback and handback](03-03-acquisition.md#interrupt-callback-and-handback), ST-19–ST-22.
- [ ] 2.2.7 Apply only AR-P6's exact nine-name extension in `test/rd05/bundled-input-library.spec.test.ts:135`; preserve every existing fixture and behavior assertion.
- [ ] 2.2.8 Rebuild and run all three new specification files to GREEN, unchanged; record actual source/byte identities and complete output comparisons here.

Verify: the new directed command, existing bundled-input/library, source
reachability, joystick and NMI suites; build first. ST-23 parity is mandatory,
not deferred to RD-08. Each pure classifier task gets its directed cases as soon
as declarations resolve; complete scan/runtime tasks remain pending until run.
No new compiler intrinsic, profile inventory or bundled loader change.

### Session 2.3 — internal checks, native qualification and closeout

- [ ] 2.3.1 Add `test/rd05/input-library.impl.test.ts` for actual private helper/callback reachability and selected-home closure after GREEN; reuse current typed/build evidence, not a new validator.
- [ ] 2.3.2 Execute ST-18–ST-23's exact-source four-profile native qualification sequentially; record matrix/joystick/NMI/RESTORE, restoration, full cost and proof limits in `09-closeout.md`.
- [ ] 2.3.3 Update `docs/platform-libraries.md` and complete the scoped deferral-expiry/ownership check in `09-closeout.md`; [01](01-requirements.md).
- [ ] 2.3.4 Run full verification and independent correctness, semantics/DX, SFA/ABI, platform, output and host-performance reviews; resolve findings through their normal gates, record `10-phase-2-review.md` and update index/progress/roadmap.

Verify: root install/build/typecheck/full tests, sequential actual VICE cases,
targeted formatting, whitespace and exact immutable/old-oracle guards. All new
specifications execute without skips. Reviewers independently inspect the actual
phase baseline/diff and evidence; authors do not review their own oracle.

## Completion and resume boundary

All 29 tasks and [01's completion evidence](01-requirements.md#completion-evidence)
must be satisfied. Plan/preflight acceptance is not runtime or parity acceptance.
Any necessary larger mechanism, new API, source limitation, frozen change or
old-test exception becomes the next exact AR-P item before implementation.
RD-05/DEF-7 remain open unless their separately owned remaining work completes.
No automatic push, host release claim or physical-hardware certificate follows.
