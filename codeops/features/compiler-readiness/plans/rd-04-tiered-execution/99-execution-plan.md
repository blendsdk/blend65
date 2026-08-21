# Execution Plan: RD-04 Tiered Compiler, ACME and VICE Execution

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-08-21
> **Progress**: 0/79 tasks (0%)
> **Commit Mode**: Auto-commit at verified local checkpoints; never push
> **Design Mode**: Auto-design within the resolved ambiguity register
> **CodeOps Artifact Schema**: 1

## Overview

Implement RD-04 in seven dependency-ordered phases. Every phase follows immutable specification
tests → observed RED → production implementation → GREEN → implementation tests → independent
quality review and full verification. Execution publication selection occurs only after local real
ACME/VICE evidence is accepted.

**🚨 Update this document after EACH completed task.**

## Implementation phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Closed contracts, policy and route planning | 11 |
| 2 | Envelope, identity and diagnostic provenance | 12 |
| 3 | Real adapters and bounded lifecycle | 12 |
| 4 | Cancellable VICE control and durable lease | 12 |
| 5 | Runtime observation and local authority proof | 10 |
| 6 | Child execution publication and composite resolution | 11 |
| 7 | Campaign orchestration, selection and closeout | 11 |

**Total: 79 tasks across 7 phases**

> **Execution rule:**
>
> 1. Mark an implementation-started task `[~]` with a timestamp.
> 2. Promote only verified tasks to `[x]` with a completion timestamp.
> 3. Update Progress and Last Updated after every task; only `[x]` counts.
> 4. Resume the first `[~]`, otherwise the first `[ ]`, scanning top-to-bottom.
> 5. Preserve every authored specification test after its RED checkpoint. If implementation and
>    oracle disagree, use the runtime ambiguity protocol; never edit the spec oracle silently.

## Phase 1: Closed Contracts, Policy and Route Planning

> **Lenses**: compiler-semantics, api-surface, performance
> **Reference**: 03-01 · AR-P2, AR-P6, AR-P9 · ST-01–ST-10

- [ ] 1.1.1 Create the behavior-free `@blend65/readiness-execution` package/test scaffold so its first immutable specification is discoverable; add no production source or readiness-core workspace import
- [ ] 1.1.2 [spec-author] Write ST-01–ST-10 in new `packages/readiness-execution/src/execution-contracts-routing.spec.test.ts` from the declared interfaces only; do not open future implementation files
- [ ] 1.1.3 Run the Phase 1 specification suite and record RED caused only by absent contracts/planner
- [ ] 1.2.1 Connect the scaffold to the root TypeScript build, then add documented passive execution tier, capability, stage, result, policy and budget contracts plus strict schemas in `packages/readiness/src/execution-contracts.ts`
- [ ] 1.2.2 Implement positive-safe-integer validation, inclusive canonical maxima and canonical serialization in focused readiness modules
- [ ] 1.2.3 Implement cheapest-tier assignment and independent prerequisite/obligation expansion in `execution-route-planner.ts`
- [ ] 1.2.4 Implement domain-separated candidate ranking, lexical strata and round-robin selection in `execution-selector.ts`
- [ ] 1.2.5 Implement mandatory per-runtime-rule VICE minima and fail-closed 16/256 capacity accounting
- [ ] 1.2.6 Run ST-01–ST-10 GREEN; fix production implementation only
- [ ] 1.3.1 Add implementation tests for validation paths, canonical bytes, adversarial ordering, 10× population and budget/result precedence; prove ≥90% branch coverage for touched readiness cores
- [ ] 1.3.2 Run configured correctness/semantics/performance review, resolve required findings, update plan/roadmap state, run full verification and auto-commit the green phase without pushing

**Deliverable:** pure closed execution vocabulary and a byte-deterministic, capacity-safe plan for
every selected obligation before any external work.

**Verify:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 2: Envelope, Identity and Diagnostic Provenance

> **Lenses**: compiler-semantics, api-surface, compatibility
> **Reference**: 03-02, 03-04 · AR-P3, AR-P7, AR-P8 · ST-11–ST-22

- [ ] 2.1.1 [spec-author] Write ST-11–ST-22 in new `execution-envelope-evidence.spec.test.ts`; derive only from requirements and planned interfaces
- [ ] 2.1.2 Run the Phase 2 suite and record RED caused only by absent envelope/evidence APIs
- [ ] 2.2.1 Add documented `ExecutionEnvelopeIrV1`, argument, fixture, observation and layout contracts with closed validation
- [ ] 2.2.2 Implement deterministic valid-only envelope rendering with actual stores and completion `0xA5` last; reject expectation leakage and invalid-case wrapping
- [ ] 2.2.3 Implement `c64-vic-color-readback-v1` host fixture projection for `$D020..$D022` and little-endian words
- [ ] 2.2.4 Implement pre-build and label-resolved execution identity preimages without changing source-case identity
- [ ] 2.2.5 Extend compiler diagnostic-bag construction with accepted-entry identity, active real phase and final-severity sidecar while leaving ordinary diagnostics unchanged
- [ ] 2.2.6 Add an evidence compiler façade and optional same-invocation CLI façade/observer injection without altering default CLI output or exit behavior
- [ ] 2.2.7 Implement label/report observation-layout proof across code/data, semantic footprint, stack, MMIO, result and completion ranges
- [ ] 2.2.8 Run ST-11–ST-22 GREEN; fix production implementation only
- [ ] 2.3.1 Add implementation/compatibility tests for bag dedup/caps, severity policy, renderer JSON, CLI output, identity collisions, stale sentinel and layout mutants; meet coverage floors
- [ ] 2.3.2 Run configured semantics/correctness/compatibility review, resolve required findings, update plan/roadmap state, run full verification and auto-commit without pushing

**Deliverable:** replayable valid programs with independent actual observation and directly observed
diagnostic phase, without public diagnostic or source-case compatibility changes.

**Verify:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 3: Real Adapters and Bounded Lifecycle

> **Lenses**: security, concurrency, performance, compatibility
> **Reference**: 03-04, 03-05 · AR-P2, AR-P3, AR-P9, AR-P10 · ST-23–ST-33

- [ ] 3.1.1 [spec-author] Write ST-23–ST-33 in new `execution-adapters-safety.spec.test.ts` using only route/lifecycle contracts
- [ ] 3.1.2 Run the Phase 3 suite and record RED caused only by absent adapters/supervisor
- [ ] 3.2.1 Define closed structured-clone worker requests/responses and implement terminable compiler, CLI and emit workers
- [ ] 3.2.2 Implement real frontend, compiler-API and CLI adapters with distinct contract evidence and strict later-artifact absence checks
- [ ] 3.2.3 Implement real emit adapter and additive bounded ACME runner seam; distinguish discovery absence, invocation failure and missing artifacts
- [ ] 3.2.4 Implement canonical mode-0700 case workspaces, lexical path allowlist, pinned containment and regular-file revalidation
- [ ] 3.2.5 Implement argv-only owned process groups, positive child-start identity and bounded graceful/forced cleanup hooks
- [ ] 3.2.6 Implement streaming stdout/stderr drain with deterministic head/tail/count/hash and combined 1 MiB cap
- [ ] 3.2.7 Implement lazy 16 MiB evidence ledger, monotonic route deadline, stage limits and cumulative counters under one cancellation scope
- [ ] 3.2.8 Run ST-23–ST-33 GREEN; fix production implementation only
- [ ] 3.3.1 Add process/worker/path/output/race implementation tests, default API regressions and coverage floors
- [ ] 3.3.2 Run configured security/correctness/performance review, resolve required findings, update plan/roadmap state, run full verification and auto-commit without pushing

**Deliverable:** real frontend-through-ACME routes whose synchronous work, filesystem, output and
process trees remain bounded and clean on every outcome.

**Verify:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 4: Cancellable VICE Control and Durable Lease

> **Lenses**: security, concurrency, compatibility, performance
> **Reference**: 03-06 · AR-P4, AR-P10, AR-P11 · ST-34–ST-43

- [ ] 4.1.1 [spec-author] Write ST-34–ST-43 in new `packages/test-harness/src/emulator/vice/vice-control-lease.spec.test.ts`; forbid inspection of new control/lease implementation files
- [ ] 4.1.2 Run the Phase 4 suite and record RED caused only by absent cancellable control/lease contracts
- [ ] 4.2.1 Factor binary/text transports, validated `1..65535` instruction codec and target/version handshake behind additive `@blend65/test-harness/vice-control`
- [ ] 4.2.2 Refactor existing `ViceDriver` as a compatibility wrapper and prove all pre-existing emulator suites unchanged
- [ ] 4.2.3 Implement checksummed generation/nonce lease records and atomic acquisition/fencing state transitions
- [ ] 4.2.4 Implement Linux boot ID and `/proc/<pid>/stat` start-time identity provider with fail-closed unsupported-host result
- [ ] 4.2.5 Implement durable pre-launch token artifact, post-spawn child record and immediate pre-signal identity revalidation
- [ ] 4.2.6 Implement two distinct loopback endpoints, bounded collision retry, child-liveness and dual-protocol C64/version handshake
- [ ] 4.2.7 Implement cancellable monitor pending-command/checkpoint registry and cumulative instruction/cycle/wall watchdog behavior
- [ ] 4.2.8 Run ST-34–ST-43 GREEN; fix production implementation only
- [ ] 4.3.1 Add lifecycle crash matrix, PID-reuse/token/generation race, process-tree and codec implementation tests with coverage floors
- [ ] 4.3.2 Run configured security/concurrency/correctness/performance review, resolve required findings, update plan/roadmap state, run full verification and auto-commit without pushing

**Deliverable:** one reusable live-verified VICE control substrate and an exclusive Linux lease that
never signals an ambiguously identified process.

**Verify:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 5: Runtime Observation and Local Authority Proof

> **Lenses**: compiler-semantics, security, performance
> **Reference**: 03-02, 03-06 · AR-P7, AR-P8, AR-P9 · ST-44

- [ ] 5.1.1 [spec-author] Write ST-44 in new `packages/readiness-execution/src/execution-runtime-acceptance.spec.test.ts` plus fixed source/oracle fixtures; do not inspect runtime adapter implementation
- [ ] 5.1.2 Run the CI-safe portion RED for absent VICE runtime adapter and record the local-suite prerequisite
- [ ] 5.2.1 Implement VICE binary loading, fixture establishment/readback, entry setup, completion polling and actual-byte/direct-MMIO observation
- [ ] 5.2.2 Implement exact completion/instruction/cycle/wall precedence and all-outcomes cancellation/cleanup integration
- [ ] 5.2.3 Join actual runtime observations to the selected RD-03 host evaluator without serializing expected values into source or producer evidence
- [ ] 5.2.4 Run all ST-44 cases GREEN through real ACME and VICE 3.10 for `$D020..$D022`, both word starts and one selected `peek`, `peekw`, `poke`, `pokew` case; fix production only
- [ ] 5.2.5 Add fake-monitor implementation tests for success, wrong byte, stale/missing completion, fixture mismatch and simultaneous budgets
- [ ] 5.2.6 Freeze accepted local evidence digests/tool versions; any participating semantic byte change invalidates this task
- [ ] 5.3.1 Run focused coverage and expert-6502 output review; file any meet-only measured parity gap with its path to beat
- [ ] 5.3.2 Run configured semantics/security/performance/correctness review, resolve required findings, update plan/roadmap state, run full verification and auto-commit without pushing

**Deliverable:** bounded real C64 execution with authoritative input projection, completion-last
observation and locally accepted evidence for all four modeled runtime rules.

**Verify:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 6: Child Execution Publication and Composite Resolution

> **Lenses**: data-migration, concurrency, security, compatibility
> **Reference**: 03-03 · AR-P5, AR-P13 · ST-45–ST-50

- [ ] 6.1.1 [spec-author] Write ST-45–ST-50 in new `packages/readiness/src/execution-publication.spec.test.ts` from publication/composite contracts only
- [ ] 6.1.2 Run the Phase 6 suite and record RED caused only by absent child publication/resolver APIs
- [ ] 6.2.1 Add strict manifest, parent-reference, exact-six-binding and semantic-review schemas for `execution-publication-v1`
- [ ] 6.2.2 Generalize pinned/bounded publication filesystem primitives for the isolated execution-publications root
- [ ] 6.2.3 Implement content-derived route registration and candidate preparation against the exact nine-binding parent digest
- [ ] 6.2.4 Implement review-unit reconstruction and require accepted CI-safe, coverage and local ACME/VICE evidence before selection
- [ ] 6.2.5 Implement opaque `PublishedExecutionContext` resolution with exact parent-by-digest verification
- [ ] 6.2.6 Implement composite projection that clears exactly accepted child rows while preserving every other blocker and parent byte
- [ ] 6.2.7 Implement atomic pointer replacement, fault reconciliation and historical named-release resolution
- [ ] 6.2.8 Run ST-45–ST-50 GREEN and prove old four-row/new nine-row parent fixtures remain byte-identical and resolvable
- [ ] 6.3.1 Add binding/publication/composite/fault implementation tests, configured data/concurrency/security review, resolve findings, meet coverage, update state, full verify and auto-commit without selecting the real child pointer or pushing

**Deliverable:** reviewed, immutable six-route child candidate with atomic compatibility-safe
selection machinery; real selection remains deferred to final campaign acceptance.

**Verify:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 7: Campaign Orchestration, Selection and Closeout

> **Lenses**: compiler-semantics, security, concurrency, compatibility
> **Reference**: 03-07 · AR-P1, AR-P5, AR-P9, AR-P13 · ST-51–ST-54

- [ ] 7.1.1 [spec-author] Write ST-51–ST-54 in new `packages/readiness-execution/src/execution-orchestration.spec.test.ts`; never reopen prior specifications
- [ ] 7.1.2 Run the Phase 7 suite and record RED caused only by absent campaign orchestrator/publication gate
- [ ] 7.2.1 Implement `executeReadinessCampaign` over opaque parent/execution/oracle contexts and require complete route-plan serialization before work
- [ ] 7.2.2 Implement canonical per-case results and per-rule/obligation summaries with unavailable and residual blockers preserved
- [ ] 7.2.3 Add documented root/local execution command and machine-neutral report serialization
- [ ] 7.2.4 Run ST-51–ST-54 GREEN; fix production implementation only and preserve every prior specification
- [ ] 7.2.5 Add orchestration/blocker/report implementation tests, run ST-01–ST-54, both 90% branch floors, source/boundary/publication checks and mandatory real ACME/VICE acceptance
- [ ] 7.2.6 Independently review the exact six route units and accepted local evidence; record content-bound semantic/quality acceptance
- [ ] 7.2.7 Prepare, publish and resolve the six-binding child; prove exactly six blockers clear against the exact parent and fault reconciliation remains green
- [ ] 7.3.1 Perform deferral-expiry and expressiveness-ledger audit, keep `spec/` frozen, update RD/feature and portfolio roadmaps as applicable, and update opted-in technical docs
- [ ] 7.3.2 Run final configured correctness/semantics/security/performance review, resolve required findings, run exact full verification and create the green local RD-04 closeout commit without pushing

**Deliverable:** all six routes selected as reviewed child authority, the selected modeled
population executed with independent results, residual blockers retained and RD-04 closed.

**Verify:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Dependency graph

```text
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7
```

## Success criteria

1. All 79 tasks are verified and ST-01–ST-54 pass unchanged after their RED checkpoints.
2. The route plan is deterministic, obligation-complete and fixed before execution.
3. Every invalid case proves exact direct diagnostic provenance and absence of later artifacts.
4. Valid envelopes contain no expectation, complete their arguments and prove collision-free layout.
5. Current C64 memory semantics pass real ACME/VICE for all four modeled runtime rules.
6. Limits, output, workers, child trees, paths, lease and monitor commands remain bounded and clean.
7. Ambiguous process identity never signals a process and retains a recoverable blocked lease.
8. One reviewed child publication binds exactly six routes to the exact selected parent digest.
9. Historical parent/child releases remain byte-identical and independently resolvable.
10. Remaining population and unavailable-capability blockers cannot satisfy RD-06.
11. Both readiness cores retain at least 90% branch coverage and the exact repository gate passes.
12. `spec/` remains untouched, deferral-expiry ownership is recorded, checkpoints are committed and
    nothing is pushed.
