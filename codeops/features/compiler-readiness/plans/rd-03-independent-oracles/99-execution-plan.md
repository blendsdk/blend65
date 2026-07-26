# Execution Plan: RD-03 Independent Semantic, Diagnostic and Metamorphic Oracles

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-27
> **Progress**: 0/61 tasks (0%)
> **Commit Mode**: Auto-commit at verified local checkpoints; never push
> **Design Mode**: Auto-design within the resolved ambiguity register
> **CodeOps Artifact Schema**: 1

## Overview

Implement RD-03 in six dependency-ordered phases. Each implementation phase follows immutable
specification tests → observed RED → production implementation → GREEN → implementation tests →
review and full verification. No handler becomes authoritative before the final independently
reviewed compatible publication.

**🚨 Update this document after EACH completed task.**

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Closed protocol and diagnostic authority | 10 |
| 2 | Bounded reference evaluator and memory state | 11 |
| 3 | Semantic relations and local comparators | 10 |
| 4 | Evaluation identity and exhaustive mutation adequacy | 10 |
| 5 | Fresh bindings and backward-compatible staging | 10 |
| 6 | Independent review, atomic publication and closeout | 10 |

**Total: 61 tasks across 6 phases**

> **Execution rule:**
>
> 1. Mark an implementation-started task `[~]` with a timestamp.
> 2. Promote only verified tasks to `[x]` with a completion timestamp.
> 3. Update Progress and Last Updated after every task; only `[x]` counts.
> 4. Resume the first `[~]`, otherwise the first `[ ]`, scanning top-to-bottom.
> 5. Preserve every new immutable specification test. Implementation and test-oracle disagreements
>    use the runtime ambiguity protocol; never edit the oracle silently.

## Phase 1: Closed Protocol and Diagnostic Authority

> **Lenses**: api-surface, compiler-semantics, security
> **Reference**: 03-01 · AR-P1–AR-P5, AR-P9, AR-P18 · ST-01–ST-06

- [ ] 1.1.1 [spec-author] Write ST-01–ST-06 in `oracle-contracts.spec.test.ts`; do not open future implementation files
- [ ] 1.1.2 Run the Phase 1 suite and record expected RED caused only by absent RD-03 contracts
- [ ] 1.2.1 Add passive oracle values, observations, result diagnostics and hard limits in `oracle-model.ts`
- [ ] 1.2.2 Implement hostile-input snapshotting and closed request validation in `oracle-input.ts`
- [ ] 1.2.3 Implement bounded parsing and the exact nineteen-key join in `oracle-diagnostic-input.ts` and `oracle-suite.ts`
- [ ] 1.2.4 Author canonical `diagnostic-oracle-v1.json` from frozen spec citations without consulting compiler output
- [ ] 1.2.5 Add opaque suite, exact routing and four façades in `oracle-suite.ts`, `oracle-routing.ts` and `oracle-handlers.ts`
- [ ] 1.2.6 Add the unbound transform declaration and regenerate `generated/declarations.ts` plus inventory projections
- [ ] 1.2.7 Run ST-01–ST-06 GREEN; fix production implementation only
- [ ] 1.3.1 Add parser/route/error cases in `oracle-contracts.impl.test.ts`, then run targeted artifact checks, review and full verification

**Deliverable:** closed source-authoring oracle capability and exact reviewed-data candidate; all
five RD-03 declarations remain unbound.

**Verify:** exact repository full gate.

## Phase 2: Bounded Reference Evaluator and Memory State

> **Lenses**: compiler-semantics, security, performance
> **Reference**: 03-02 · AR-P5–AR-P10 · ST-07–ST-15

- [ ] 2.1.1 [spec-author] Write ST-07–ST-15 in `oracle-evaluator.spec.test.ts`
- [ ] 2.1.2 Run the Phase 2 suite and record expected RED caused only by absent evaluator modules
- [ ] 2.2.1 Implement typed scalar normalization and operation dispatch in `oracle-values.ts` and `oracle-operations.ts`
- [ ] 2.2.2 Implement validation and charge-before-event tracking in `oracle-budget.ts`
- [ ] 2.2.3 Implement fixture, little-endian access and effects in `oracle-memory.ts`
- [ ] 2.2.4 Implement constant resolution and one entry frame in `oracle-state.ts`
- [ ] 2.2.5 Implement expression/statement/return orchestration in `oracle-evaluator.ts`
- [ ] 2.2.6 Add invalid diagnostics and unmodeled/blocked dispatch to `oracle-evaluator.ts`
- [ ] 2.2.7 Add the TypeScript-AST import gate to `oracle-boundary.impl.test.ts`
- [ ] 2.2.8 Run ST-07–ST-15 GREEN; fix production implementation only
- [ ] 2.3.1 Add focused cases in `oracle-evaluator.impl.test.ts`, then run coverage, review and full verification

**Deliverable:** pure bounded absolute oracle for the approved scalar/memory IR, candidate-only.

**Verify:** exact repository full gate plus ≥90% readiness branch coverage.

## Phase 3: Semantic Relations and Local Comparators

> **Lenses**: compiler-semantics, api-surface, performance
> **Reference**: 03-03 · AR-P11–AR-P13 · ST-16–ST-24

- [ ] 3.1.1 [spec-author] Write ST-16–ST-24 in `semantic-relations.spec.test.ts`
- [ ] 3.1.2 Run the Phase 3 suite and record expected RED caused only by absent relation contracts
- [ ] 3.2.1 Implement request/result contracts and hostile-input checks in `semantic-relation-model.ts` and `semantic-relation-input.ts`
- [ ] 3.2.2 Implement binding, dependency, purity and path analysis in `semantic-relation-analysis.ts`
- [ ] 3.2.3 Implement identifier renaming and literal-to-local in `semantic-relation-transform.ts`
- [ ] 3.2.4 Implement local-to-parameter and external binding in `semantic-relation-transform.ts`
- [ ] 3.2.5 Add algebraic variants and constant reordering to `semantic-relation-transform.ts`
- [ ] 3.2.6 Implement local projections/comparators in `semantic-relation-compare.ts` and the handler in `semantic-relations.ts`
- [ ] 3.2.7 Run ST-16–ST-24 GREEN; fix production implementation only
- [ ] 3.3.1 Add focused cases in `semantic-relations.impl.test.ts`, then run review and full verification

**Deliverable:** one typed candidate transform with five non-vacuous relations and falsifiable
comparators.

**Verify:** exact repository full gate.

## Phase 4: Evaluation Identity and Exhaustive Mutation Adequacy

> **Lenses**: compiler-semantics, security, performance
> **Reference**: 03-04 · AR-P14, AR-P17 · ST-25–ST-31

- [ ] 4.1.1 [spec-author] Write ST-25–ST-31 in `oracle-evaluation-identity.spec.test.ts` and `oracle-mutation.spec.test.ts`
- [ ] 4.1.2 Run the Phase 4 suites and record expected RED caused only by absent identity/mutation modules
- [ ] 4.2.1 Implement canonical preimage and digest in `oracle-evaluation-identity.ts`
- [ ] 4.2.2 Implement the bounded registry in `oracle-evaluation-collision.ts`
- [ ] 4.2.3 Implement catalog parsing/exhaustiveness in `oracle-mutation-model.ts`
- [ ] 4.2.4 Author `oracle-mutations-v1.json` for every production operation/mapping/relation path
- [ ] 4.2.5 Implement `oracle-conformance-v1.ts` and `oracle-mutation-runner.ts`
- [ ] 4.2.6 Bind identity results in `oracle-handlers.ts` and `semantic-relations.ts`
- [ ] 4.2.7 Run ST-25–ST-31 GREEN with zero surviving required mutants
- [ ] 4.3.1 Add `oracle-evaluation-identity.impl.test.ts` and `oracle-mutation.impl.test.ts`, then run coverage, review and full verification

**Deliverable:** stale-oracle-safe evaluation evidence and exhaustive mutation proof; still
candidate-only.

**Verify:** exact repository full gate plus zero required mutation survivors.

## Phase 5: Fresh Bindings and Backward-Compatible Staging

> **Lenses**: concurrency, security, api-surface, compatibility
> **Reference**: 03-05 · AR-P15–AR-P16 · ST-32–ST-38

- [ ] 5.1.1 [spec-author] Write ST-32–ST-38 in `oracle-bindings.spec.test.ts` and `oracle-publication.spec.test.ts`
- [ ] 5.1.2 Run the Phase 5 suites and record expected RED caused only by absent RD-03 candidate/staging behavior
- [ ] 5.2.1 Generate `oracle-candidate-revisions.generated.ts` from all five dependency closures
- [ ] 5.2.2 Implement `oracle-candidate-bindings.ts` and stable package exports
- [ ] 5.2.3 Make `publication-candidates.ts` load exact serialized handler-ID sets
- [ ] 5.2.4 Preserve four-row resolution in `publication-resolver.ts`
- [ ] 5.2.5 Separate carried rows/promotions in `binding-publication.ts`
- [ ] 5.2.6 Add all review units in `review-digests.ts` and `binding-publication.ts` without changing `publication-model.ts`
- [ ] 5.2.7 Run ST-32–ST-38 GREEN and resolve the complete nine-row release in an isolated repository
- [ ] 5.3.1 Add `oracle-bindings.impl.test.ts` and `oracle-publication.impl.test.ts`, then run review/full verification without selecting the real pointer

**Deliverable:** exact independently reviewable compatible release request; real selected
publication remains the four-binding RD-02 authority.

**Verify:** exact repository full gate and historical-release fixture resolution.

## Phase 6: Independent Review, Atomic Publication and Closeout

> **Lenses**: compiler-semantics, concurrency, security, compatibility
> **Reference**: 03-05 · AR-P15, AR-P21–AR-P24 · ST-35–ST-40

- [ ] 6.1.1 Complete ST-39–ST-40 in `oracle-publication.spec.test.ts` and observe expected RED before final integration
- [ ] 6.1.2 Prepare the exact staged release/request through `binding-publication.ts` without changing the selected pointer
- [ ] 6.2.1 [semantics-reviewer] Independently review all exact diagnostic/evaluator/relation/identity/mutation/binding units
- [ ] 6.2.2 Record accepted evidence in `readiness/reviews/semantic-review-v1.json`; any subsequent semantic byte change invalidates this task
- [ ] 6.2.3 Regenerate projections and published-state-validate the complete staged nine-binding release
- [ ] 6.2.4 Run ST-01–ST-40 GREEN, mutation adequacy, coverage, source-check and exact full gate on the unchanged candidate tree
- [ ] 6.2.5 Exercise all fault points through `oracle-publication.spec.test.ts` and the publication child fixture
- [ ] 6.2.6 Publish through `binding-publication.ts`, then resolve nine current and four historical fixture bindings
- [ ] 6.3.1 Record selected-publication, traceability, `spec/` and deferral-expiry evidence in `99-execution-plan.md`
- [ ] 6.3.2 Update the RD, roadmaps and opted-in technical docs; run final verification and create the green local closeout commit without pushing

**Deliverable:** five RD-03 handlers atomically selected with diagnostic authority, backward
compatibility and complete closeout evidence.

**Verify:** exact repository full gate, `yarn readiness:source-check`, `yarn readiness:check`,
traceability readiness and clean `spec/`.

## Dependency Graph

```text
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
```

## Success Criteria

1. All 61 tasks are verified and all ST-01–ST-40 expectations pass unchanged.
2. The readiness package retains at least 90% branch coverage.
3. Every required production-path mutant is killed.
4. No production oracle/transform import leaves `packages/readiness`.
5. RD-02 source-case identities remain unchanged when oracle policy changes.
6. The existing four-row release and new nine-row release both resolve by their own serialized IDs.
7. Exactly five RD-03 handlers become bound in one compatible selected release.
8. No publication-v1 member/schema/digest-domain change and no RD-07 evolution-gate activation occur.
9. `spec/` remains untouched and deferral-expiry ownership is recorded.
10. The final checkpoint is locally committed and never pushed.
