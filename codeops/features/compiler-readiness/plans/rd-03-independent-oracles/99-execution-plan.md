# Execution Plan: RD-03 Independent Semantic, Diagnostic and Metamorphic Oracles

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-29
> **Progress**: 72/72 tasks (100%)
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

> **Phase baseline tree**: 37f03a1c7a06a0fd87b72bfd26ac02746bbfa239
> **Lenses**: compiler-semantics, api-surface, performance
> **Reference**: 03-03 · AR-P11–AR-P13, AR-P26–AR-P28, AR-P32, AR-P40 · ST-19–ST-28

- [x] 3.1.1 [spec-author] Write ST-19–ST-28 in `semantic-relations.spec.test.ts` — completed 2026-07-28 17:07 CEST (88 expanded cases across 11 named immutable relation declarations; implementation-blind author confirmed no forbidden production file was inspected)
- [x] 3.1.2 Run the Phase 3 suite and record expected RED caused only by absent relation contracts — restarted and completed 2026-07-28 18:30 CEST under AR-P57 (isolated worktree at Phase 2 commit `fa7989c` plus only the corrected implementation-blind specification/fixture; suite uncollectable solely because `semantic-relation-conformance` is absent)
- [x] 3.2.1 Implement request/result contracts, replay provenance and hostile-input validation — completed 2026-07-28 17:29 CEST
- [x] 3.2.2 Implement binding, dependency, purity and path analysis — completed 2026-07-28 17:29 CEST
- [x] 3.2.3 Introduce the private relation-scoped production fault seam required by ST-28 — completed 2026-07-28 17:29 CEST
- [x] 3.2.4 Implement identifier renaming and literal-to-local — completed 2026-07-28 17:29 CEST
- [x] 3.2.5 Implement local-to-parameter plus the separate external binding update — completed 2026-07-28 17:29 CEST
- [x] 3.2.6 Implement algebraic variants and independent declaration reordering — completed 2026-07-28 17:29 CEST
- [x] 3.2.7 Implement structural/semantic-closure revalidation and local comparators — completed 2026-07-28 17:29 CEST
- [x] 3.2.8 Run ST-19–ST-28 GREEN; fix production implementation only — completed 2026-07-28 18:30 CEST (88/88 corrected immutable specification cases pass after the AR-P57 checkpoint restart)
- [x] 3.3.1 Add focused relation/seam implementation cases, then review and full verify — completed 2026-07-28 19:07 CEST (30 focused implementation cases; 1,159 readiness tests; 90.01% branch coverage; correctness/performance/semantics re-review findings resolved under AR-P57–AR-P58 with direct regressions; 88/88 frozen specification cases and exact Phase 3 hashes preserved)

**Deliverable:** one typed candidate transform with five non-vacuous relations, falsifiable
comparators and an immutable relation fault oracle.

**Verify:** exact repository full gate.

## Phase 4: Provenance, Identity and Exhaustive Bounded Mutation

> **Phase baseline tree**: 2c3cd0956d2ca2bd2696a492c30228aeb822bdf3
> **Lenses**: compiler-semantics, concurrency, security, performance
> **Reference**: 03-04 · AR-P14, AR-P17, AR-P26–AR-P30, AR-P36, AR-P38, AR-P59–AR-P72 · ST-29–ST-38

- [x] 4.1.1 [spec-author] Write ST-29–ST-34 in `oracle-evaluation-identity.spec.test.ts` — completed 2026-07-28 20:00 CEST (18 immutable cases; implementation-blind author read no forbidden production source; SHA-256 `511b798544b2889753cac408e00b99109b4d48ed2cfeac275f5c7c2ecd354cc3`)
- [x] 4.1.2 [spec-author] Write ST-35–ST-38 in `oracle-mutation.spec.test.ts` — completed 2026-07-28 20:00 CEST (8 immutable cases over the independently frozen 84-row catalog; SHA-256 `d8174686d4b408a11216bf68fa9fa855194dabed6dcbee48fba3faf34cc56ce1`)
- [x] 4.1.3 Run both Phase 4 suites and record expected RED caused only by absent identity/mutation modules — completed 2026-07-28 20:00 CEST (2 suites failed collection solely on seven absent Phase 4 modules; authored files otherwise pass type analysis, ESLint and Prettier; AR-P59–AR-P61 closed callable, vector/catalog and policy-revision contradictions before implementation)
- [x] 4.2.1 Implement canonical source/transformed content preimages and domain-separated digests
- [x] 4.2.2 Implement pure evaluation-identity preimage/digest and bounded collision registry
- [x] 4.2.3 Implement closed operation/path registries and catalog exact-join parsing
- [x] 4.2.4 Author `oracle-mutations-v1.json` for every reachable production operation/path pair
- [x] 4.2.5 Generalize the relation seam into AsyncLocalStorage operation/path conformance dispatch
- [x] 4.2.6 Implement the stable-ID bounded worker protocol and deadline termination
- [x] 4.2.7 Implement exhaustive mutation runner/report semantics
- [x] 4.2.8 Add missing/extra/duplicate/unreachable path invariants to `readiness:source-check`
- [x] 4.2.9 Run ST-29–ST-38 GREEN with zero survivors and concurrent context isolation
- [x] 4.3.1 Add focused identity/mutation/worker implementation tests, then coverage/review/full verify — completed 2026-07-29 00:17 CEST (90 readiness files / 1,232 tests; all 84 independently asserted mutants killed with zero survivors; 90.11% branch coverage; exact repository full gate and source-check green; immutable Phase 4 hashes preserved; correctness, security, semantics and performance findings resolved under AR-P62–AR-P72)

**Deliverable:** pure provenance/content/evaluation identity primitives and exhaustive bounded
mutation proof. No raw handler yet claims selected participant revisions.

**Verify:** exact repository full gate plus zero required mutation survivors and source-check.

## Phase 5: Compatible Staging and Resolution Revalidation

> **Phase baseline tree**: 5993dd83ee5b96c505a0adc8b7e1b37d4f788d87
> **Expected modification set**: Phase 5 specification/fixture files; readiness candidate,
> publication, resolver, review and published-context modules; generated candidate revisions;
> implementation tests; Phase 5 plan/traceability/roadmap state. The real selected publication
> pointer is excluded until Phase 6.
> **Lenses**: concurrency, security, api-surface, compatibility
> **Reference**: 03-05 · AR-P15–AR-P16, AR-P33–AR-P34 · ST-39–ST-45

- [x] 5.1.1 [spec-author] Write ST-39–ST-42 in `oracle-bindings.spec.test.ts` — completed 2026-07-29 00:42 CEST (implementation-blind; SHA-256 `caa54674958d024f30fd1f317d586ab1c3ddf4ea0b2242d5014c7ce5beed348b`)
- [x] 5.1.2 [spec-author] Write ST-43–ST-45 in `oracle-publication.spec.test.ts` and ST-46–ST-47 in separate `oracle-published-evidence.spec.test.ts` — final post-selection fixture re-freeze 2026-07-29 after AR-P91; immutable spec hashes unchanged; the isolated fixture now names the historical RD-02 base instead of inheriting the advanced selected pointer (publication fixture SHA-256 `4b8e0c0c02761391edf55a0c866053f3536f702e2b85f779e3d40f29b197f719`; semantic-intent fixture `9b942377fe2a7d6c7c4e1ca49e0e53505278ba373bfead414a6abc58683c9de8`)
- [x] 5.1.3 Run all three Phase 5 suites and record expected RED caused only by absent candidate/staging/evidence behavior — implementation checkpoint GREEN 2026-07-29 after AR-P84 for all Phase 5 specs 9/9; original RED remains recorded and typecheck/lint/Prettier are green
- [x] 5.2.1 Implement snapshot-bound invocation/evidence composition and resolver context factory over staged snapshots — completed 2026-07-29 with retained authority buffers and evaluation identities bound to the invoked oracle
- [x] 5.2.2 Preserve the legacy four-handler no-pointer preparation wrapper unchanged — completed 2026-07-29 with exact b715 generator and d163 boundary closure evidence
- [x] 5.2.3 Add explicit incremental prepare/publish capability APIs with named base and exact target set — completed 2026-07-29 with atomic single-use capabilities and generation locking
- [x] 5.2.4 Factor release-derived review-unit reconstruction and `validateReviewEvidence` — completed 2026-07-29 with content-bound publication implementation authority
- [x] 5.2.5 Revalidate exact review units during historical/current resolution before snapshot creation — completed 2026-07-29 for current, named and compatible resolution
- [x] 5.2.6 Generate five final candidate revisions, then implement typed registration and handler-ID-directed loading — completed 2026-07-29 with fixed-ID adapters and generated freshness authorities
- [x] 5.2.7 Run ST-39–ST-47 GREEN and resolve isolated four-row/nine-row releases — completed 2026-07-29; 9/9 frozen Phase 5 specifications pass
- [x] 5.3.1 Add binding/publication implementation tests, then review/full verify without selecting the real pointer — completed 2026-07-29; quality remediation and exact repository gate pass while the real pointer remains unchanged

**Deliverable:** an independently reviewable compatible release request; the real selected
publication remains the four-binding RD-02 authority.

**Verify:** exact repository full gate and historical-release fixture resolution.

## Phase 6: Final Specs, Snapshot Evaluation, Atomic Publication and Closeout

> **Lenses**: compiler-semantics, concurrency, security, compatibility
> **Reference**: 03-05 · AR-P35, AR-P37, AR-P39 · ST-48–ST-49

- [x] 6.1.1 [spec-author] Write ST-48–ST-49 in new `oracle-final-publication.spec.test.ts`; never reopen Phase 5 specs — completed 2026-07-29 implementation-blind; spec SHA-256 `18de911ed7d6dcf222c914e3cbf2a995a0a0ebd845c37432d271a3459e09b9a1`, worker fixture SHA-256 `69463153896ade7993e04dc6375b6901aa690686277898547c085068e3a1cae8`
- [x] 6.1.2 Run the Phase 6 suite and record expected RED before pointer integration — completed 2026-07-29; 14 cases ran, 9 expected failures cover absent Phase 6 boundaries/reconciliation/retry behavior and 5 existing pre-pointer safety controls pass
- [x] 6.2.1 Resolve the staged accepted `PublishedOracleContext` without changing the real selected pointer — completed 2026-07-29 06:48 CEST
- [x] 6.2.2 Implement post-pointer resolve/reconciliation and closed `commit-indeterminate` — completed 2026-07-29 06:48 CEST
- [x] 6.2.3 Implement one bounded verified-pointer-replacement retry plus deterministic worker-reader barriers — completed 2026-07-29 06:48 CEST
- [x] 6.2.4 Prepare the exact staged release/review request without changing the selected pointer — completed 2026-07-29 06:48 CEST
- [x] 6.2.5 [semantics-reviewer] Independently review all authority/evaluator/relation/identity/mutation/binding/publication units — completed 2026-07-29 06:48 CEST (22 exact lexical units accepted with no findings)
- [x] 6.2.6 Record accepted evidence; any subsequent semantic byte change invalidates this task — completed 2026-07-29 06:48 CEST (accepted review digest `sha256:f966b1db2c5fb9ee497b79b3668958f87dc3a93fcddf1936d827abf28b683d6c`)
- [x] 6.2.7 Regenerate projections, validate the staged release and run ST-01–ST-49 plus all focused gates — completed 2026-07-29 07:18 CEST (98 readiness files / 1,282 tests pass sequentially; all 84 mutants killed; source-check and selected-publication check green)
- [x] 6.2.8 Publish through the incremental capability; reconcile faults and resolve nine current/four historical bindings — completed 2026-07-29 07:19 CEST (selected `sha256:41557dde5590fed1fd28a8e920769787af43118de94c48c9484a20dc773e2706`; historical `sha256:41afbb4512456470e0b182fb14edb5caeaac7688d7e36ba1e102fc8d42ae3403` remains four-row resolvable)
- [x] 6.3.1 Record selected-publication, traceability, `spec/` and deferral-expiry evidence — completed 2026-07-29 07:19 CEST (traceability valid; frozen `spec/` clean; deferral rationales remain live and RD-08-owned)
- [x] 6.3.2 Update RD/roadmaps/opted-in techdocs, run final verify and create the green local closeout commit without pushing — completed 2026-07-29 10:21 CEST (readiness coverage: 101 files / 1,316 tests, 90.11% branches; exact repository full gate green; no opted-in VitePress techdocs set; local closeout commit prepared without push)

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
