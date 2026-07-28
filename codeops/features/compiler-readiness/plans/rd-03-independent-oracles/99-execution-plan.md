# Execution Plan: RD-03 Independent Semantic, Diagnostic and Metamorphic Oracles

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-28
> **Progress**: 25/72 tasks (35%)
> **Commit Mode**: Auto-commit at verified local checkpoints; never push
> **Design Mode**: Auto-design within the resolved ambiguity register
> **CodeOps Artifact Schema**: 1

## Overview

Implement RD-03 in six dependency-ordered phases. Each phase follows immutable specification tests
→ observed RED → production implementation → GREEN → implementation tests → independent review and
full verification. No handler becomes authoritative before its exact dependency closure and
semantic evidence have been accepted and selected together.

**🚨 Update this document after EACH completed task.**

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Closed protocol and separated authority | 12 |
| 2 | Bounded evaluator, semantic closure and independence | 13 |
| 3 | Semantic relations and relation fault seam | 11 |
| 4 | Provenance, identity and exhaustive bounded mutation | 13 |
| 5 | Compatible staging and resolution revalidation | 11 |
| 6 | Final specs, snapshot evaluation, atomic publication and closeout | 12 |

**Total: 72 tasks across 6 phases**

> **Execution rule:**
>
> 1. Mark an implementation-started task `[~]` with a timestamp.
> 2. Promote only verified tasks to `[x]` with a completion timestamp.
> 3. Update Progress and Last Updated after every task; only `[x]` counts.
> 4. Resume the first `[~]`, otherwise the first `[ ]`, scanning top-to-bottom.
> 5. Preserve every immutable specification file after its RED checkpoint. Implementation and
>    test-oracle disagreements use the runtime ambiguity protocol; never edit the oracle silently.

## Phase 1: Closed Protocol and Separated Authority

> **Phase baseline tree**: 0af20b53a06e785071010a8c661c2d136b55aebc
> **Lenses**: api-surface, compiler-semantics, security
> **Reference**: 03-01 · AR-P1–AR-P5, AR-P9, AR-P18, AR-P25–AR-P31 · ST-01–ST-07

- [x] 1.1.1 [spec-author] Write ST-01–ST-07 in `oracle-contracts.spec.test.ts`; do not open future implementation files — completed 2026-07-27 21:42 CEST
- [x] 1.1.2 Run the Phase 1 suite and record expected RED caused only by absent RD-03 contracts — completed 2026-07-27 21:42 CEST (`createOracleSuite` absent after real fixture construction; 14 cases collected)
- [x] 1.2.1 Add passive oracle values, observations, result/evidence diagnostics and hard limits in `oracle-model.ts` — completed 2026-07-27 22:04 CEST
- [x] 1.2.2 Implement hostile-input snapshotting and exhaustive failure classification in `oracle-input.ts` — completed 2026-07-27 22:04 CEST
- [x] 1.2.3 Implement full RD-02 replay-provenance snapshot/validation/regeneration in `oracle-provenance.ts` — completed 2026-07-27 22:04 CEST
- [x] 1.2.4 Implement bounded compiler-diagnostic parsing and the exact source-projection join — completed 2026-07-27 22:04 CEST
- [x] 1.2.5 Implement the separate closed external binding-rejection parser and exact projection join — completed 2026-07-27 22:04 CEST
- [x] 1.2.6 Author both canonical authority JSON files from frozen semantics without consulting compiler output — completed 2026-07-27 22:04 CEST
- [x] 1.2.7 Add opaque source-authoring suite, exact routing and four raw façades — completed 2026-07-27 22:04 CEST
- [x] 1.2.8 Add passive `PublishedOracleContext`/evidence contracts without implementing selected invocation — completed 2026-07-27 22:04 CEST
- [x] 1.2.9 Add the unbound transform declaration, obtain narrow independent acceptance of the additive `shared-contracts` delta, refresh exact current/historical unbound review fixtures, and regenerate declarations/inventory projections — completed 2026-07-28 12:33 CEST
- [x] 1.3.1 Run ST-01–ST-07 GREEN, add implementation-tier parser/route/error cases, then review and full verify — completed 2026-07-28 13:27 CEST (independent correctness/security and compiler-semantics reviews clean after remediation; exact full gate passed)

**Deliverable:** closed non-authoritative source-authoring capability, separated reviewed-data
candidates and five unbound RD-03 declarations.

**Verify:** exact repository full gate.

## Phase 2: Bounded Evaluator, Semantic Closure and Independence

> **Phase baseline tree**: 60324577c26a684a169565c2311ffd7335fd1df7
> **Lenses**: compiler-semantics, security, performance
> **Reference**: 03-02 · AR-P5–AR-P10, AR-P29, AR-P32, AR-P41 · ST-08–ST-18

- [x] 2.1.1 [spec-author] Write ST-08–ST-17 in `oracle-evaluator.spec.test.ts` — completed 2026-07-28 13:59 CEST
- [x] 2.1.2 [spec-author] Write ST-18 in `oracle-boundary.spec.test.ts` with positive and seeded forbidden fixtures — completed 2026-07-28 13:59 CEST
- [x] 2.1.3 Run both Phase 2 suites and record expected RED caused only by absent evaluator/boundary modules — completed 2026-07-28 13:59 CEST (two suites uncollectable only because `oracle-budget` and `readiness-boundary-scanner` are absent)
- [x] 2.2.1 Implement typed scalar normalization and closed operation dispatch — completed 2026-07-28 15:20 CEST
- [x] 2.2.2 Implement same-signed widening in both operand orders, exact extension/result typing and narrowing rejection — completed 2026-07-28 15:20 CEST
- [x] 2.2.3 Implement structural-following oracle semantic closure, including constant-purity checks — completed 2026-07-28 15:20 CEST
- [x] 2.2.4 Implement validation and charge-before-event tracking in `oracle-budget.ts` — completed 2026-07-28 15:20 CEST
- [x] 2.2.5 Implement fixture, little-endian access and effects in `oracle-memory.ts` — completed 2026-07-28 15:20 CEST
- [x] 2.2.6 Implement constant resolution and one entry frame in `oracle-state.ts` — completed 2026-07-28 15:20 CEST
- [x] 2.2.7 Implement expression/statement/return orchestration and exhaustive result categories — completed 2026-07-28 15:20 CEST
- [x] 2.2.8 Implement the AST boundary scanner and add its invariant to `readiness:source-check` — completed 2026-07-28 15:20 CEST
- [x] 2.2.9 Run ST-08–ST-18 GREEN; fix production implementation only — completed 2026-07-28 15:20 CEST (14/14 immutable specs; 41/41 focused Phase 2 tests)
- [x] 2.3.1 Add focused evaluator/closure/boundary tests, update owned roadmap debt T-02, run coverage/review/full verify — completed 2026-07-28 16:35 CEST (1041 readiness tests; 90.07% branch coverage; exact full gate green; performance and semantics re-reviews clean; correctness re-review retained RV-003/RV-004, corrected under AR-P54 with direct regression verification and no prohibited third review)

**Deliverable:** pure bounded absolute oracle and immutable package-independence gate for the
approved scalar/memory IR, candidate-only.

**Verify:** exact repository full gate plus ≥90% readiness branch coverage and source-check.

## Phase 3: Semantic Relations and Relation Fault Seam

> **Lenses**: compiler-semantics, api-surface, performance
> **Reference**: 03-03 · AR-P11–AR-P13, AR-P26–AR-P28, AR-P32, AR-P40 · ST-19–ST-28

- [ ] 3.1.1 [spec-author] Write ST-19–ST-28 in `semantic-relations.spec.test.ts`
- [ ] 3.1.2 Run the Phase 3 suite and record expected RED caused only by absent relation contracts
- [ ] 3.2.1 Implement request/result contracts, replay provenance and hostile-input validation
- [ ] 3.2.2 Implement binding, dependency, purity and path analysis
- [ ] 3.2.3 Introduce the private relation-scoped production fault seam required by ST-28
- [ ] 3.2.4 Implement identifier renaming and literal-to-local
- [ ] 3.2.5 Implement local-to-parameter plus the separate external binding update
- [ ] 3.2.6 Implement algebraic variants and independent declaration reordering
- [ ] 3.2.7 Implement structural/semantic-closure revalidation and local comparators
- [ ] 3.2.8 Run ST-19–ST-28 GREEN; fix production implementation only
- [ ] 3.3.1 Add focused relation/seam implementation cases, then review and full verify

**Deliverable:** one typed candidate transform with five non-vacuous relations, falsifiable
comparators and an immutable relation fault oracle.

**Verify:** exact repository full gate.

## Phase 4: Provenance, Identity and Exhaustive Bounded Mutation

> **Lenses**: compiler-semantics, concurrency, security, performance
> **Reference**: 03-04 · AR-P14, AR-P17, AR-P26–AR-P30, AR-P36, AR-P38 · ST-29–ST-38

- [ ] 4.1.1 [spec-author] Write ST-29–ST-34 in `oracle-evaluation-identity.spec.test.ts`
- [ ] 4.1.2 [spec-author] Write ST-35–ST-38 in `oracle-mutation.spec.test.ts`
- [ ] 4.1.3 Run both Phase 4 suites and record expected RED caused only by absent identity/mutation modules
- [ ] 4.2.1 Implement canonical source/transformed content preimages and domain-separated digests
- [ ] 4.2.2 Implement pure evaluation-identity preimage/digest and bounded collision registry
- [ ] 4.2.3 Implement closed operation/path registries and catalog exact-join parsing
- [ ] 4.2.4 Author `oracle-mutations-v1.json` for every reachable production operation/path pair
- [ ] 4.2.5 Generalize the relation seam into AsyncLocalStorage operation/path conformance dispatch
- [ ] 4.2.6 Implement the stable-ID bounded worker protocol and deadline termination
- [ ] 4.2.7 Implement exhaustive mutation runner/report semantics
- [ ] 4.2.8 Add missing/extra/duplicate/unreachable path invariants to `readiness:source-check`
- [ ] 4.2.9 Run ST-29–ST-38 GREEN with zero survivors and concurrent context isolation
- [ ] 4.3.1 Add focused identity/mutation/worker implementation tests, then coverage/review/full verify

**Deliverable:** pure provenance/content/evaluation identity primitives and exhaustive bounded
mutation proof. No raw handler yet claims selected participant revisions.

**Verify:** exact repository full gate plus zero required mutation survivors and source-check.

## Phase 5: Compatible Staging and Resolution Revalidation

> **Lenses**: concurrency, security, api-surface, compatibility
> **Reference**: 03-05 · AR-P15–AR-P16, AR-P33–AR-P34 · ST-39–ST-45

- [ ] 5.1.1 [spec-author] Write ST-39–ST-42 in `oracle-bindings.spec.test.ts`
- [ ] 5.1.2 [spec-author] Write ST-43–ST-45 in `oracle-publication.spec.test.ts` and ST-46–ST-47 in separate `oracle-published-evidence.spec.test.ts`
- [ ] 5.1.3 Run all three Phase 5 suites and record expected RED caused only by absent candidate/staging/evidence behavior
- [ ] 5.2.1 Implement snapshot-bound invocation/evidence composition and resolver context factory over staged snapshots
- [ ] 5.2.2 Preserve the legacy four-handler no-pointer preparation wrapper unchanged
- [ ] 5.2.3 Add explicit incremental prepare/publish capability APIs with named base and exact target set
- [ ] 5.2.4 Factor release-derived review-unit reconstruction and `validateReviewEvidence`
- [ ] 5.2.5 Revalidate exact review units during historical/current resolution before snapshot creation
- [ ] 5.2.6 Generate five final candidate revisions, then implement typed registration and handler-ID-directed loading
- [ ] 5.2.7 Run ST-39–ST-47 GREEN and resolve isolated four-row/nine-row releases
- [ ] 5.3.1 Add binding/publication implementation tests, then review/full verify without selecting the real pointer

**Deliverable:** an independently reviewable compatible release request; the real selected
publication remains the four-binding RD-02 authority.

**Verify:** exact repository full gate and historical-release fixture resolution.

## Phase 6: Final Specs, Snapshot Evaluation, Atomic Publication and Closeout

> **Lenses**: compiler-semantics, concurrency, security, compatibility
> **Reference**: 03-05 · AR-P35, AR-P37, AR-P39 · ST-48–ST-49

- [ ] 6.1.1 [spec-author] Write ST-48–ST-49 in new `oracle-final-publication.spec.test.ts`; never reopen Phase 5 specs
- [ ] 6.1.2 Run the Phase 6 suite and record expected RED before pointer integration
- [ ] 6.2.1 Resolve the staged accepted `PublishedOracleContext` without changing the real selected pointer
- [ ] 6.2.2 Implement post-pointer resolve/reconciliation and closed `commit-indeterminate`
- [ ] 6.2.3 Implement one bounded verified-pointer-replacement retry plus deterministic worker-reader barriers
- [ ] 6.2.4 Prepare the exact staged release/review request without changing the selected pointer
- [ ] 6.2.5 [semantics-reviewer] Independently review all authority/evaluator/relation/identity/mutation/binding/publication units
- [ ] 6.2.6 Record accepted evidence; any subsequent semantic byte change invalidates this task
- [ ] 6.2.7 Regenerate projections, validate the staged release and run ST-01–ST-49 plus all focused gates
- [ ] 6.2.8 Publish through the incremental capability; reconcile faults and resolve nine current/four historical bindings
- [ ] 6.3.1 Record selected-publication, traceability, `spec/` and deferral-expiry evidence
- [ ] 6.3.2 Update RD/roadmaps/opted-in techdocs, run final verify and create the green local closeout commit without pushing

**Deliverable:** five RD-03 handlers atomically selected with non-substitutable authority,
revision-complete evidence, backward compatibility and complete closeout proof.

**Verify:** exact repository full gate, `yarn readiness:source-check`, `yarn readiness:check`,
traceability readiness and clean `spec/`.

## Dependency Graph

```text
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
```

## Success Criteria

1. All 72 tasks are verified and ST-01–ST-49 pass unchanged.
2. The readiness package retains at least 90% branch coverage.
3. Every reachable production operation/path mutant is killed in bounded workers.
4. No production oracle/transform import leaves `packages/readiness`.
5. Full replay provenance is verified; RD-02 source identities remain unchanged.
6. Authoritative results contain source/transformed content and one-snapshot evaluation identity.
7. Existing four-row and new nine-row releases resolve by their serialized IDs and revalidated review.
8. Exactly five RD-03 handlers become bound in one compatible selected release.
9. Concurrent readers observe only the exact old or new release; post-commit state is reconciled.
10. No publication-v1 format/evolution-gate change occurs.
11. `spec/` remains untouched and deferral-expiry ownership is recorded.
12. The final checkpoint is locally committed and never pushed.
