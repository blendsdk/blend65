# Execution: proved returned-local destination

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-09 21:27 CEST
> **Progress**: 0/15 tasks (0%)
> **CodeOps Artifact Schema**: 1

## Implementation phase

| Phase | Title                                   | Tasks |
| ----- | --------------------------------------- | ----- |
| 1     | Proved whole-function destination reuse | 15    |

Task lines below are the single mutable progress authority and appear once.
Immediately mark implemented work `[~]` with its real timestamp; only promote to
`[x]` after its relevant verification passes. Update Progress/Last Updated after
each task. Resume the first `[~]`, otherwise the first `[ ]`. A blocker uses `[!]`
and an explicit reason. Only `[x]` counts complete. Green local commits use the
git-commit skill; no automatic push. No frozen or existing spec-test amendment.

## Phase 1: whole-function destination reuse

> **Phase baseline tree**: record the complete phase-start snapshot through exec-plan
> **Lenses**: compiler/language, SFA/ABI, generated asynchronous observation, emitted output, host cost

### Session 1.1 — independent specification tests

Reference: [07](07-testing-strategy.md), [AR-1](00-ambiguity-register.md).

- [ ] 1.1.1 [spec-author] Write ST-1–ST-5 and ST-12–ST-13 in `test/rd05/returned-local-behavior.spec.test.ts`, using existing public/VICE fixture interfaces.
- [ ] 1.1.2 [spec-author] Write ST-6–ST-11 and ST-14 in `test/rd05/returned-local-safety.spec.test.ts`, preserving the frozen legality/value oracle.
- [ ] 1.1.3 [spec-author] Write ST-15–ST-18 in `test/rd05/returned-local-output.spec.test.ts`; establish the exact selected PA-only diagnostic source/baseline for ST-18 before production changes.
- [ ] 1.1.4 Run the new specification files; record RED output assertions and justified baseline-pass safety cases in `99-execution-plan.md`; no implementation yet.

Verify: `yarn vitest run test/rd05/returned-local-behavior.spec.test.ts test/rd05/returned-local-safety.spec.test.ts test/rd05/returned-local-output.spec.test.ts`, sequential VICE. Expected new output failures are RED evidence, not a green commit.

### Session 1.2 — existing-stage correction

Reference: [03-01](03-01-destination.md). Order below is dependency order; keep
each edit bounded and verify its existing directed consumer suite. Do not add a
new general framework or start the unrelated optimization debts.

- [ ] 1.2.1 Preserve fresh declaration origin in `semantic/operations.ts` and `semantic/cfg.ts`; see 03-01 §Small retained facts.
- [ ] 1.2.2 Reuse bounded literal/mask and exact raw-address routines through `semantic/aggregate-place-proof.ts` and `semantic/reachable-globals.ts`, with no behavior change to the old consumer.
- [ ] 1.2.3 Reuse complete place footprints and hardware-RAM observer routines in those same two modules; see 03-01 §Whole-function eligibility, ST-8–ST-11.
- [ ] 1.2.4 Implement complete-local/initializer/use eligibility in `semantic/returned-local-destination.ts`; see 03-01 §Whole-function eligibility, ST-1–ST-3/ST-6–ST-9/ST-17.
- [ ] 1.2.5 Complete actual-call/observer qualification and prepare its immutable fact in `semantic/whole-program.ts`, but keep production publication absent until task 1.2.7; see 03-01 §Small retained facts, ST-4–ST-5/ST-10–ST-14.
- [ ] 1.2.6 Bind every certified root through the hidden result pointer in `machine/lower-state.ts` and `machine/lower-aggregate.ts`; see 03-01 §Root and construction consumers, ST-1–ST-3/ST-8/ST-12/ST-17.
- [ ] 1.2.7 Preserve direct nested construction/completed stores and omit only proved terminal address/copy delivery in `machine/lower-aggregate-members.ts`, `machine/lower-aggregate-return.ts` and `machine/lower-operation.ts`; then activate the prepared whole-program fact and matching local omission in `storage/inventory.ts` together, after all root consumers are ready. See 03-01 §Root and construction consumers, ST-15–ST-18.
- [ ] 1.2.8 Run `yarn build`, then all new specification files to GREEN without changing their oracle; record results in `99-execution-plan.md`.

Verify: the new directed specification command above plus impacted existing
whole-program/source-library, nested-construction and aggregate-return suites.
Run `yarn build` first whenever directed tests import the public compiler package
after production edits. Until task 1.2.7 activation, production uses no certificate
and retains every current home/copy; proof and consumer preparation remain inert.
Production file paths in these tasks are relative to `packages/compiler/src/`.
If a task exceeds its one reviewable concern or needs six files/200 added lines,
split it before execution and preserve the same authority and ordering.

### Session 1.3 — internals, qualification and independent review

Reference: [07](07-testing-strategy.md), [A-1–A-6](01-requirements.md#plan-local-acceptance).

- [ ] 1.3.1 Add focused `packages/compiler/test/returned-local-destination.impl.test.ts` and `packages/compiler/test/aggregate-place-proof.impl.test.ts` after GREEN; cover the guard boundaries, ST-7's structurally unchanged ineligible path and bounded host walks in 07.
- [ ] 1.3.2 Qualify actual assembled bytes, complete costs and sequential four-profile VICE cases, then run the full project checkpoint; retain raw evidence and results in `08-closeout.md`.
- [ ] 1.3.3 Run independent correctness, semantics/DX, SFA/ABI, platform, output and host-performance phase reviews in waves; dispose findings, verify any authorized fixes, complete the deferral check and update `08-closeout.md` plus the feature roadmap.

Verify: `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, `yarn
test`; targeted touched-file formatting, frozen-authority/old-oracle and whitespace
guards. Only the implementation owner runs expensive verification. VICE is always
sequential, and skips do not pass. Reviewers are read-only and independent of the
author; the spec author is not an independent reviewer of its own tests.

## Completion boundary

All fifteen tasks must be verified; [A-1–A-6](01-requirements.md#plan-local-acceptance)
must have their stated evidence. Critical/major findings require their normal
decision gate. A materially larger mechanism reopens AR-1; no generic fix approval
grants it. Full-body parity debts stay measured and owned, not silently waived.

At closeout answer whether deliverables expire any deferral rationale; check
relevant ambiguity/Won't-Have/future-consideration owners without reopening
unrelated work or editing frozen authorities. T-14 completion does not close
RD-05/DEF-7 or qualify the public keyboard library. The next owned work is the
still-separate keyboard technical/positive plan gate.
