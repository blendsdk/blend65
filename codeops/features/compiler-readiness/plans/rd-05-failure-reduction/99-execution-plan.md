# Execution Plan: RD-05 Failure Reduction

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-08-26
> **Progress**: 0/70 tasks (0%)
> **Commit Mode**: Auto-commit at verified local checkpoints; never push
> **Design Mode**: Auto-design within the resolved ambiguity register
> **CodeOps Artifact Schema**: 1

## Overview

Implement RD-05 in six dependency-ordered phases. Every implementation phase follows immutable
specification tests → observed RED → production implementation → GREEN → implementation tests →
independent quality review and exact full verification. The final phase refreshes the content-bound
execution publication, reruns real ACME/VICE acceptance, reselects the reviewed child, and closes the
RD only after the deferral-expiry audit.

**🚨 Update this document after EACH completed task.**

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Closed contracts and historical authority | 11 |
| 2 | Malformed ingress and deterministic reduction | 12 |
| 3 | Candidate route execution and fresh confirmation | 11 |
| 4 | Immutable evidence and regression activation | 13 |
| 5 | Failure orchestration and package integration | 12 |
| 6 | Publication refresh, real acceptance and closeout | 11 |

**Total: 70 tasks across 6 phases**

> **Execution rule:**
>
> 1. Mark an implementation-started task `[~]` with a timestamp.
> 2. Promote only verified tasks to `[x]` with a completion timestamp.
> 3. Update Progress and Last Updated after every task; only `[x]` counts.
> 4. Resume the first `[~]`, otherwise the first `[ ]`, scanning top-to-bottom.
> 5. Preserve every specification test after its RED checkpoint. If implementation and oracle
>    disagree, use the runtime ambiguity protocol; never edit the specification oracle silently.
> 6. Any code-affecting fix after Phase 6 review reopens handler generation, verification, real
>    execution, review, preparation, and selection.

## Phase 1: Closed Contracts and Historical Authority

> **Lenses**: compiler-semantics, api-surface, compatibility, security
> **Reference**: 03-01 · AR-P1–AR-P3, AR-P9 · ST-01–ST-12

- [ ] 1.1.1 [spec-author] Write ST-01–ST-12 in new `packages/readiness/src/failure-contracts.spec.test.ts` from RD-05 and declared public interfaces only; construct prerequisite authorities only through existing public APIs
- [ ] 1.1.2 Run the Phase 1 specification file and record RED caused only by absent RD-05 contracts/history APIs; freeze its content hash
- [ ] 1.2.1 Add closed failure result/stage/disposition/cleanup and family contracts plus exhaustive allowed-tuple validation in focused `failure-contracts.ts` modules
- [ ] 1.2.2 Implement canonical `FailurePredicateV1`, required-claim freezing, normalized observation identity and complete field-by-field equality in `failure-identity.ts`
- [ ] 1.2.3 Implement separate `PromotedFailureKeyV1`, campaign-independent core-key normalization and fatal canonical-byte collision validation without conflating predicate/run identities
- [ ] 1.2.4 Implement selected/hard `FailureReductionPolicyV1` parsing, inclusive exact-limit accounting and domain-separated reduction-run identity
- [ ] 1.2.5 Implement typed `FailureEnvelopeV1` construction/validation from genuine historical replay, route, oracle, inventory, projection, tool and policy authority; reject missing/current fallback
- [ ] 1.2.6 Add unchanged-RD-04-report compatibility fixture and canonical serialization guard while exporting the new readiness contracts with JSDoc
- [ ] 1.3.1 Run ST-01–ST-12 GREEN; fix production only and preserve the frozen specification hash
- [ ] 1.3.2 Add `failure-contracts.impl.test.ts` and `failure-history.impl.test.ts` for the tuple cross-product, every identity field, required/incidental claims, canonical collisions, historical corruption/revision drift, limits, extra keys and hostile proxy/accessor input; meet focused 90% branch coverage
- [ ] 1.3.3 Run configured correctness/semantics/security/performance review, resolve required findings, update plan/roadmap state, run exact full verification and auto-commit the green phase without pushing

**Deliverable:** exhaustive non-pass classification, separate predicate/promotion identities,
versioned policy and complete authenticated typed historical envelopes without altering RD-04 V1.

**Verify:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 2: Malformed Ingress and Deterministic Reduction

> **Lenses**: compiler-semantics, algorithms, security, performance
> **Reference**: 03-02 · AR-P3–AR-P5 · ST-13–ST-24

- [ ] 2.1.1 [spec-author] Write ST-13–ST-24 in new `packages/readiness/src/failure-reduction.spec.test.ts` using only declared reducer, invariant, authority and malformed-ingress interfaces
- [ ] 2.1.2 Run the Phase 2 specification file and record RED caused only by absent malformed/reducer APIs; freeze its content hash
- [ ] 2.2.1 Implement bounded opaque `MalformedDiagnosticCaseV1` and `MalformedReplayEnvelopeV1` authority from genuine diagnostic oracle context, including exact valid UTF-8 zero-byte source and closed token/text provenance
- [ ] 2.2.2 Implement typed-valid invariant validation for syntax/type/semantic family, original primary rule, fail-closed required claims and immutable route predicate
- [ ] 2.2.3 Implement complete typed-invalid baseline/transform/diagnostic tuple validation, path rebasing, binding reduction, neighbor identity and exactly-one-intentional-violation proof
- [ ] 2.2.4 Implement raw-malformed exact-byte invariant, bounded token metadata and field-aware validation that never normalizes authoritative source
- [ ] 2.2.5 Implement the closed non-empty V1 transformation catalog, total canonical ordering, strictly decreasing family tuples and finite non-cycling normalization
- [ ] 2.2.6 Implement opaque `ReductionCandidateAuthorityV1`, passive purpose-limited projection and domain-separated identity over envelope, candidate, trace, predicate, route and selected policy
- [ ] 2.2.7 Implement the restart-to-fixed-point `FailureReductionSessionV1` state machine with single-use ordered evaluations, first-preserving acceptance, one-minimal proof and exact/next exhaustion
- [ ] 2.3.1 Run ST-13–ST-24 GREEN for known typed-valid, typed-invalid and raw-malformed fixtures; preserve the frozen specification hash
- [ ] 2.3.2 Add `failure-reduction-catalog.impl.test.ts` and `failure-reducer.impl.test.ts` for every catalog arm, decreasing tuples, path rebasing, collision/cycle/replay faults, zero bytes, huge shallow input and no callback/accessor execution; meet focused 90% branch coverage
- [ ] 2.3.3 Run configured semantics/correctness/security/performance review, resolve required findings, update state, run exact full verification and auto-commit the green phase without pushing

**Deliverable:** separately authenticated malformed cases and a pure deterministic one-minimal
reducer for all three families, with no compiler, worker or filesystem access.

**Verify:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 3: Candidate Route Execution and Fresh Confirmation

> **Lenses**: compiler-semantics, distributed/concurrency, security, compatibility
> **Reference**: 03-03 · AR-P1, AR-P5, AR-P7 · ST-25–ST-35

- [ ] 3.1.1 [spec-author] Write ST-25–ST-35 in new `packages/readiness-execution/src/failure-candidate-execution.spec.test.ts` using genuine published-handler authority and independent worker/process fixtures
- [ ] 3.1.2 Run the Phase 3 specification file and record RED caused only by absent candidate-route and confirmation APIs; freeze its content hash
- [ ] 3.2.1 Add the dedicated closed `ReductionExecutionRouteRequestV1` arm and validate readiness-minted candidate authority before exposing any passive execution payload
- [ ] 3.2.2 Extend existing route adapters so candidate execution preserves original obligation/tier/policy/fixture/oracle/tool semantics while replacing only source-bound execution identity
- [ ] 3.2.3 Implement typed-valid, typed-invalid and raw-diagnostic request variants through the same published handler chain; allow zero source bytes only in the raw diagnostic arm
- [ ] 3.2.4 Implement normalized predicate evaluation from closed route results, excluding volatile host/process/workspace data without rewriting exact source or diagnostic facts
- [ ] 3.2.5 Implement a fresh executor factory that creates a new worker, temporary root, process boundary and reduced allowlisted environment for every confirmation run
- [ ] 3.2.6 Implement two-run confirmation, same-route known-good control and bounded authenticated sequence reproduction with source/sequence/flaky closed outcomes
- [ ] 3.3.1 Run ST-25–ST-35 GREEN and rerun all ordinary generated-route compatibility specifications unchanged
- [ ] 3.3.2 Add `failure-candidate-execution.impl.test.ts` and `failure-confirmation.impl.test.ts` for forged/replayed candidates, changed routes, direct callbacks, raw/typed cross-arm confusion, worker reuse, cleanup, control failure, sequence limits and stale authority; meet focused 90% branch coverage
- [ ] 3.3.3 Run configured correctness/semantics/security/performance/concurrency review, resolve findings, update state, run exact full verification and auto-commit the green phase without pushing; record that selected handler publication is now stale

**Deliverable:** every transformed case executes under a truthful new identity through the original
published route, with isolated two-run confirmation and campaign-only sequence/flaky handling.

**Verify:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 4: Immutable Evidence and Regression Activation

> **Lenses**: data-integrity, filesystem-security, concurrency, testability
> **Reference**: 03-04 · AR-P2, AR-P6, AR-P8, AR-P14 · ST-36–ST-49

- [ ] 4.1.1 [spec-author] Write readiness-owned ST-36–ST-49 contract cases in new `packages/readiness/src/failure-evidence.spec.test.ts` from canonical record and lifecycle interfaces only
- [ ] 4.1.2 [spec-author] Write execution-owned ST-36–ST-49 durability/discovery cases in new `packages/readiness-execution/src/failure-publication-regressions.spec.test.ts` without inspecting readiness production or the other specification file
- [ ] 4.1.3 Run both Phase 4 specification files together and record RED caused only by absent evidence/publication/activation APIs; freeze both hashes
- [ ] 4.2.1 Implement closed canonical `FailureCoreV1` derivation that excludes campaign/history/selected-policy data and retains exact minimized replay, predicate, expectation, catalog and normalization authority
- [ ] 4.2.2 Implement append-only `FailureProvenanceEventV1` with campaign envelope, complete selected policy, trace and confirmation identities, plus immutable `FailureActivationV1` cross-references
- [ ] 4.2.3 Implement authorized canonical encoders/parsers with strict size/schema/digest/collision checks and structural exclusion of environment, command, absolute-host-path, raw-stream and unstructured-prose fields
- [ ] 4.2.4 Generalize the existing execution secure-filesystem primitives for failure paths while preserving existing publication behavior, pinned directory identity, no-clobber durability and symlink/special-file rejection
- [ ] 4.2.5 Implement idempotent concurrent core/event/activation publication and safe partial-temp/orphan-event reconciliation without a mutable authoritative index
- [ ] 4.2.6 Implement the implementation-blind dynamic activation specification runner with explicit zero state and fail-closed missing/malformed/duplicate/non-ancestor/changed-candidate checks
- [ ] 4.2.7 Implement the two-checkpoint activation API requiring an unchanged inactive candidate and already-green ancestor commit; do not add an expected-failure path
- [ ] 4.3.1 Run ST-36–ST-49 GREEN, including inactive current-defect behavior, activated regression failure-on-reintroduction and canary/path exact-source checks
- [ ] 4.3.2 Add `failure-evidence.impl.test.ts`, `failure-publication.impl.test.ts` and `failure-regressions.impl.test.ts` for collision, retry, directory replacement, sync failure, partial writes, orphan projection, oversized/open records and secret canaries; meet focused 90% branch coverage
- [ ] 4.3.3 Run configured data/concurrency/security/performance/correctness review, resolve findings, update state, run exact full verification and auto-commit the green inactive-regression phase without pushing

**Deliverable:** immutable campaign-independent failure cores, lossless append-only discovery events,
and a green-by-construction active regression protocol over secure durable storage.

**Verify:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 5: Failure Orchestration and Package Integration

> **Lenses**: compiler-semantics, integration, security, traceability
> **Reference**: 03-05 · AR-P1, AR-P2, AR-P9, AR-P11 · ST-50–ST-58

- [ ] 5.1.1 [spec-author] Write ST-50–ST-58 in new `packages/readiness-execution/src/failure-orchestration.spec.test.ts` from the public join/orchestration interfaces and genuine prerequisite constructors only
- [ ] 5.1.2 Run the Phase 5 specification file and record RED caused only by absent join/orchestration APIs; freeze its content hash
- [ ] 5.2.1 Implement genuine report/campaign/execution/oracle/inventory/projection/target/policy join validation without changing `ExecutionAuthorityReportV1`
- [ ] 5.2.2 Materialize a separate complete `FailureEnvelopeV1` immediately for each joined non-pass and return closed unavailable outcomes when live historical content cannot be authenticated
- [ ] 5.2.3 Implement primary/cleanup classification routing into direct shrink, fresh-confirm gate, campaign-only and unsupported outcomes with same-route known-good controls where required
- [ ] 5.2.4 Implement `reduceReadinessFailuresV1` over the opaque reducer protocol, published candidate handler, confirmation and publisher capabilities; preserve every bounded non-promotable outcome
- [ ] 5.2.5 Implement closed per-case outcomes and canonical campaign summary/report identity without raw streams, host data or mutable projections
- [ ] 5.2.6 Export documented public readiness domain APIs, purpose-limited execution-internal projections and readiness-execution orchestration/publication APIs without adding CLI/network/compiler/spec surface
- [ ] 5.2.7 Add boundary/source-owner guards proving no compiler implementation, frozen specification or reverse dependency import can enter RD-05
- [ ] 5.3.1 Run ST-50–ST-58 GREEN end to end for all dispositions/families/lifecycle states and preserve every prior frozen specification
- [ ] 5.3.2 Add `failure-orchestration.impl.test.ts` for join/report/exhaustion/compatibility paths, focused ≥90% branch coverage for all new cores and explicit end-to-end no-compiler/no-spec mutation proof
- [ ] 5.3.3 Run final pre-publication configured correctness/semantics/security/performance/concurrency review over every participating code byte, resolve all required findings, update state, run exact full verification and auto-commit without pushing

**Deliverable:** one public library workflow joins RD-04 evidence to immutable historical envelopes,
reduces and confirms eligible failures, and publishes only authenticated inactive regressions.

**Verify:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 6: Publication Refresh, Real Acceptance and Closeout

> **Lenses**: publication-integrity, compiler-semantics, compatibility, lifecycle
> **Reference**: 03-05 · AR-P10, AR-P12–AR-P14 · ST-56–ST-58

- [ ] 6.1.1 Run all frozen RD-05 specification files and focused implementation coverage together; record every new-core branch floor at or above 90% and prove existing RD-04 report/route compatibility
- [ ] 6.1.2 Run Prettier checks on every touched source/test/artifact, generated binding freshness diagnostics, package boundaries and `git status --porcelain spec/`; resolve only in-scope defects
- [ ] 6.1.3 Run the exact full repository verification after all code/review fixes and auto-commit the final implementation checkpoint without pushing
- [ ] 6.2.1 Regenerate the six execution-handler dependency closures with `yarn workspace @blend65/readiness-execution generate:execution-bindings`, then run the non-mutating freshness check
- [ ] 6.2.2 Run the reviewed real C64 readiness execution/candidate-confirmation path with explicit deterministic seed on ACME and VICE 3.10; persist the canonical authority report only through existing secure APIs
- [ ] 6.2.3 Independently review exact final handler closure bytes, focused coverage, CI-safe evidence and real ACME/VICE report; require zero unresolved critical/major findings
- [ ] 6.2.4 If review changes any participating code byte, reopen and repeat tasks 6.1.1–6.2.3 before continuing
- [ ] 6.2.5 Prepare and resolve the immutable execution child candidate from final reviewed bytes without changing the selected pointer
- [ ] 6.2.6 Atomically select the refreshed child through existing public APIs and prove exact new-route availability, six binding resolution and byte-identical historical old→new→old replay
- [ ] 6.2.7 Run only non-mutating post-selection source-boundary, freshness, named-resolution, regression-activation and fault-reconciliation checks; any code change reopens tasks 6.1.1–6.2.7
- [ ] 6.3.1 Perform the mandatory deferral-expiry/expressiveness-ledger audit, rehome every invalidated/orphaned deferral, preserve `spec/`, update RD/feature/portfolio roadmaps and opted-in technical docs, run final exact verification, and auto-commit the local RD-05 closeout without pushing

**Deliverable:** final reviewed handler authority selected from exact RD-05 bytes, real C64 evidence
accepted, historical releases preserved, deferrals owned, and RD-05 closed green.

**Verify:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Dependency Graph

```text
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
```

## Success Criteria

1. All 70 tasks are verified and ST-01–ST-58 pass unchanged after their RED checkpoints.
2. Every RD-04 non-pass has one primary and one separately observable cleanup disposition.
3. Typed-valid, typed-invalid and raw-malformed failures reduce deterministically to one-minimal or
   a closed exhaustion result while preserving exact historical predicates and routes.
4. Every candidate uses a new authenticated identity and the existing published handler chain.
5. Confirmation uses two genuinely fresh workers; sequence/flaky/infrastructure outcomes never
   obtain promotion authority.
6. Equal promoted keys yield one immutable core plus lossless append-only campaign events under
   concurrency; every storage fault fails closed.
7. Inactive current defects keep the tree green; active unchanged regressions require a previously
   green commit and fail when reintroduced.
8. Persisted records contain no forbidden host/process data or secret canaries outside exact source.
9. The final selected execution child binds exact reviewed handler closures and preserves historical
   old/new releases after real ACME/VICE acceptance.
10. New core modules retain at least 90% branch coverage, the exact repository gate passes,
    `spec/` stays untouched, all expired deferrals have owners, commits are local, and nothing is
    pushed.
