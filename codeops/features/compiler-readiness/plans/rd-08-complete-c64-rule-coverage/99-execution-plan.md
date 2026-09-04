# Execution Plan: RD-08 Complete C64 Rule Coverage

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-04
> **Progress**: 21/62 tasks (34%)
> **Status**: Paused by explicit course correction; preserved at commit `14d9f1f`. Domain-skill
> creation and a read-only compiler recovery audit must finish before any execution resumes.
> **CodeOps Artifact Schema**: 1

## Overview

Execution is paused. If the work is later resumed, execute RD-08 in six bounded phases. Phase 1 delivers real generated arrays/calls/branches/loops
and independent semantic observations before authority expansion. Later phases add only the
minimum versioned publication, family/disposition, route and closeout work required by the RD.

**🚨 Update this document after EACH completed task.**

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Real structured generated programs | 12 |
| 2 | Minimal evolution and first accepted publication | 10 |
| 3 | Terminal disposition and quality classification | 8 |
| 4 | Remaining source families and non-source evidence | 12 |
| 5 | Declared public routes and defect evidence | 8 |
| 6 | Bounded smoke, complete publication and closeout | 12 |

**Total: 62 tasks across 6 phases**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes in the phase sections below are the single source of truth. Every task line
> appears exactly once. The executing agent MUST:
>
> 1. Mark implementation `[~]` with `implemented: YYYY-MM-DD HH:MM`.
> 2. Promote it to `[x]` only after verification with `completed: YYYY-MM-DD HH:MM`.
> 3. Update Progress and Last Updated after every task; only `[x]` counts.
> 4. Resume the first `[~]`, otherwise the first `[ ]`, scanning top-to-bottom.
> 5. Mark a blocker `[!]` with `Blocked: <reason>` on the same line.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'`. The lifecycle is Ready, Executing, Done or
> Blocked. Specification expectations are immutable; a failure is fixed in implementation or
> recorded as typed compiler evidence, never weakened in a spec test.

## Phase 1: Real Structured Generated Programs

> **Phase baseline tree**: `f9f0598d11bdf83991cc1b0b3fefb595d9de3c59`
> **Scope mode**: strict
> **Product scope baseline**: Real generated arrays, calls, branches and bounded loops with
> independent semantic observations, stable case identities and authenticated execution cases;
> no compiler fixes, generalized framework, new dependency or new execution infrastructure.
> **Expected modification set**: the Phase-1 files named by tasks 1.1.1–1.3.3 under
> `packages/readiness/src/`, `packages/readiness-execution/src/` and `test/`, plus this execution
> plan and the compiler-readiness roadmap.
> **Lenses**: compiler and language; data and migration
> **AR-13 execution dependency**: after task 1.2.5 reaches its implemented authority state, execute
> Phase-2 tasks 2.1.1–2.2.7 as the coherent publication compatibility prerequisite, then return to
> verify and complete task 1.2.5 and the rest of Phase 1. AR-17 supersedes AR-13's earlier stop
> after 2.2.4 because the active child/consumer specifications make that checkpoint necessarily
> red. The next checkpoint reviews and commits Phase 1 plus the complete compatibility unit.

**Reference**: 03-01; ST-01–ST-15, ST-33–ST-36, ST-38–ST-40; AR-1–AR-4, AR-8

### Session 1.1: Specification Tests

- [x] 1.1.1 [spec-author] Write independent IR/render/oracle/relation and bidirectional dependency-boundary specification tests for ST-01–ST-13, ST-33–ST-36 and ST-38–ST-40, including indexed writes, sized/unsized array parameters, void calls, exact statement depth and loop type extremes — `packages/readiness/src/structured-generated-programs.spec.test.ts`, `packages/readiness/src/structured-control-flow.spec.test.ts`, `packages/readiness/src/test-fixtures/structured-generated-programs-spec-fixture.ts`, `test/readiness-boundary.spec.test.ts` ✅ (completed: 2026-09-02 21:07) — 36 implementation-blind tests authored after correcting boolean fixtures, awaited mutation scopes and file-size split; targeted run RED only on planned missing structured modules/boundary export
- [x] 1.1.2 [spec-author] Write authenticated structured execution-case/public-route tests and exact rule-to-case/digest binding mutations for ST-14–ST-15 — `packages/readiness/src/structured-execution-case.spec.test.ts`, `packages/readiness/src/first-vertical-publication.spec.test.ts`, `packages/readiness/src/test-fixtures/structured-phase1-authority-spec-fixture.ts`, `packages/readiness-execution/src/structured-generated-programs.spec.test.ts`, `packages/readiness-execution/src/test-fixtures/structured-generated-programs-spec-fixture.ts` ✅ (completed: 2026-09-02 20:59) — 10 implementation-blind tests authored; targeted readiness/readiness-execution runs RED only on the planned missing structured authority, projection and first-vertical modules/exports
- [x] 1.1.3 Run the Phase-1 specification tests and record the expected RED result without implementation changes ✅ (completed: 2026-09-02 21:07) — consolidated six-file run: 46/46 RED on absent `structured-ir-validation`, `structured-case-families`, `first-vertical-publication`, structured execution projections and `scanReadinessCompilerBoundary`; no production file changed

### Session 1.2: Implementation

- [x] 1.2.1 Add the exact closed expression/statement/parameter/assignment forms, all holders, and structured-v2 identity-bearing statement-depth budget with an explicit v2 configuration domain separator and delegated syntax/type validation; preserve v1 budget preimages, domains, digests and canonical bytes exactly — `packages/readiness/src/generator-ir.ts`, `packages/readiness/src/generation-budget.ts`, `packages/readiness/src/canonical-identity.ts`, `packages/readiness/src/case-identity.ts`, `packages/readiness/src/replay-envelope-normalizer.ts`, `packages/readiness/src/oracle-evaluation-identity.ts`, `packages/readiness/src/failure-envelope-history.ts`, `packages/readiness/src/modeled-construction-templates.ts`, `packages/readiness/src/structured-ir-validation.ts`, `packages/readiness/src/generator-ir-validator.ts` (03-01 §New IR types) ✅ (completed: 2026-09-02 21:41) — structured IR/budget/holder probes passed; 138 legacy identity/replay tests passed; the exact phase baseline proved the publication-freshness hardening test green before dirty dependency bytes, so that intentional phase-local freshness gate remains open for the Phase-1 authority refresh and final verification
- [x] 1.2.2 Render the new nodes as canonical modern Blend source — `packages/readiness/src/structured-source-renderer.ts`, `packages/readiness/src/source-renderer.ts`, `packages/readiness/src/expression-renderer.ts` (ST-01, ST-05, ST-08, ST-12) ✅ (completed: 2026-09-02 21:44) — canonical structured fixture probe passed; 47/47 legacy renderer tests, ESLint, Prettier and diff guards passed
- [x] 1.2.3 Build the four finite reviewed case families, authenticated structured-case resolver and exact construction usage — `packages/readiness/src/structured-case-families.ts`, `packages/readiness/src/modeled-generator-model.ts`, `packages/readiness/src/modeled-construction-templates.ts` (ST-01–ST-13, ST-34–ST-35, AR-10) ✅ (completed: 2026-09-02 21:54) — all 18 stable case IDs resolved to deterministic authenticated authorities with registry-owned provenance, suites, budgets and digests; identity/usage probe and static guards passed
- [x] 1.2.4 Evaluate arrays/array-parameter aliasing, fixture-bound address wrap, call frames, branches and bounded/type-extreme loops independently; add loop unrolling through every closed relation seam — `packages/readiness/src/structured-oracle-evaluator.ts`, private `packages/readiness/src/structured-oracle-runtime.ts`, `packages/readiness/src/oracle-evaluator.ts`, `packages/readiness/src/oracle-model.ts`, `packages/readiness/src/semantic-relation-model.ts`, `packages/readiness/src/semantic-relation-input.ts`, `packages/readiness/src/semantic-relation-analysis.ts`, `packages/readiness/src/semantic-relation-transform.ts`, `packages/readiness/src/semantic-relation-compare.ts`, `packages/readiness/src/semantic-relation-conformance.ts`, `packages/readiness/src/semantic-relations.ts`, `packages/readiness/src/oracle-semantic-relations-candidate.ts`, `packages/readiness/src/oracle-mutation-model.ts`, `packages/readiness/src/oracle-mutation-suite.ts`, `packages/readiness/src/oracle-mutation-assertions.ts` (ST-01–ST-13, ST-33–ST-34, ST-39–ST-40, AR-11) ✅ (completed: 2026-09-02 22:26) — converged readiness typecheck and 34/34 focused specs passed; legacy relation 118/118, mutation 63/63, evaluator 33/33 and renderer compatibility 54/54 passed; direct v2 probe covered all 94 mutation paths and killed all four loop mutants
- [x] 1.2.5 Bind/export stable structured case identities/digests, implement the passive first-vertical candidate validator, add the authenticated structured branch to the existing execution-case constructor/projections, bind its oracle token to the exact case through the existing execution-runtime subpath, and feed ST-14 through the unchanged envelope/route without a new runner or caller-supplied observation — `packages/readiness/src/index.ts`, `packages/readiness/src/modeled-operation-registry.ts`, `packages/readiness/src/first-vertical-publication.ts`, `packages/readiness/src/execution-case.ts`, `packages/readiness/src/execution-runtime.ts`, `packages/readiness/src/structured-execution-case.spec.test.ts`, `packages/readiness/src/execution-case.impl.test.ts`, `packages/readiness-execution/src/index.ts`, `packages/readiness-execution/src/execution-route-adapters.ts`, `packages/readiness-execution/src/execution-route-evidence.ts`, `packages/readiness-execution/src/structured-generated-programs.spec.test.ts` (AR-12) ✅ (completed: 2026-09-03) — after the Phase-2 compatibility prerequisite, structured execution/first-publication/authority isolation is green 19/19 and the unchanged public execution route is green 1/1
- [x] 1.2.6 Run ST-01–ST-15, ST-33–ST-36 and ST-38–ST-40 and make them GREEN by changing implementation only; record any real compiler defect as typed evidence ✅ (completed: 2026-09-03) — consolidated Phase-1 immutable specification suite GREEN 46/46: readiness 43/43, readiness-execution route 1/1 and bidirectional repository boundary 2/2 after correcting the scanner's incomplete one-way implementation

### Session 1.3: Implementation Tests and Hardening

- [x] 1.3.1 Add hostile-input, type, source-byte, frame, wrapping, order, exact/over statement-depth and budget implementation tests — `packages/readiness/src/structured-ir-validation.impl.test.ts`, `packages/readiness/src/structured-source-renderer.impl.test.ts`, `packages/readiness/src/structured-oracle-evaluator.impl.test.ts` ✅ (completed: 2026-09-03) — test-only hardening GREEN 54/54: IR validation 26, renderer 12 and evaluator 16; all three files are below 260 lines and no production defect was exposed
- [x] 1.3.2 Add mutation and dependency-boundary assertions for wrong indexing/order/branch/loop behavior and zero workspace imports — `packages/readiness/src/oracle-mutation-assertions-v2.impl.test.ts`, `packages/readiness/src/dependency-boundary.impl.test.ts` ✅ (completed: 2026-09-03) — test-only hardening GREEN 35/35: mutation assertions 17 and dependency boundaries 18, proving all six structured evaluator mutations, loop/relation failures and zero workspace imports across twelve structured authorities
- [x] 1.3.3 Run targeted Phase-1 tests, Prettier checks, `spec/` cleanliness and the exact full verification command from AR-7 ✅ (completed: 2026-09-03) — Phase-1 specifications 46/46 and hardening 89/89 are green; touched-file Prettier and diff guards pass, `spec/` is clean, and the exact install/build/typecheck/lint/test command completed successfully

> **Phase-1 quality review (2026-09-03): corrections implemented; verification active.** Independent correctness and
> semantic reviews found four unique critical and twelve major issues after overlap removal:
> claimed cases without matching semantics; shallow/mutable v2 publication authority; unreadable
> selected v2 pointers; mutable structured-case authority; incomplete structured typing/name/cycle
> and nested-work closure; incomplete oracle input/budget/evaluation identity; discarded computed
> out-of-bounds writes; a wrong unscaled-index mutant oracle; substituted evaluation identities;
> unauthenticated replayed migration; parent-record TOCTOU reads; missing optimizer cross-member
> joins; and oversized validation modules. All are ruled **fix now** under the user's standing
> expert-choice direction. Focused correction suites are green, historical release checksums are
> preserved, and the AR-7 exact full verification is green (readiness smoke 78/78,
> readiness-execution smoke 190/190 and root boundary/parity 36/36). The checkpoint remains
> uncommitted pending independent re-review.
>
> **Independent re-review (2026-09-03): correction round two active.** The first correction set
> closes every original finding, but re-review found one critical and thirteen unique major issues:
> compile-time-foldable indices masquerading as runtime OOB evidence; missing index-tier checks;
> absent constant evaluation; unsound dynamic-loop work and iteration metering; exponential graph
> traversal and an inaccurate cycle path; rejected same-signed widening; wrong zero-division
> modeling; hostile accessors escaping two validators; missing parent-publication CAS/exact
> post-commit resolution; three oversized touched modules; rejected intermediate release history;
> and this plan's stale progress counter. All are ruled **fix now**. The progress counter is
> corrected above; the remaining fixes must repeat focused tests, AR-7 exact full verification and
> independent re-review before commit.

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 2: Minimal Evolution and First Accepted Publication

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: compiler and language; data and migration
> **Execution note (AR-13, superseded in part by AR-17)**: tasks 2.1.1–2.2.7 execute now as one
> prerequisite to Phase-1 verification. Return to task 1.2.5 only after all active Phase-2 specs
> are green; skipping the child/consumer specs or accepting a red checkpoint is prohibited.

**Reference**: 03-02 §Embed fixture mapping; 03-03 §Publication evolution/First accepted
publication; 03-05 exact executable contracts; passive ST-21, ST-22–ST-26, ST-37, ST-41;
AR-3, AR-5, AR-13–AR-34

### Session 2.1: Specification Tests

- [x] 2.1.1 [spec-author] Write passive authenticated embed-reference schema/projection, complete-v2-schema, v1 preservation, migration, stale-review, crash, parent-v2 transaction, unchanged child-v1 recovery and consumer-envelope specification tests for passive ST-21, ST-22–ST-26, ST-37 and ST-41 in each owning package using the exact 03-05 interfaces; under AR-19–AR-24, migrate callable-base fixture calls in legacy oracle publication/final publication/published evidence/failure reduction and the executable-base oracle-binding case to `createCurrentOraclePublicationSpecFixture`, express carried-row identity relative to that authenticated base, split the existing historical parent/child pair's passive-record resolution from current-parent composite execution, explicitly install only that immutable historical child in the otherwise-empty isolated fixture, and target `resolvePublishedExecutionReleaseRecordByDigestV1` plus its defensive projection while preserving behavioral and byte-immutability assertions — `packages/readiness/src/rule-family-dispositions.spec.test.ts`, `packages/readiness/src/rule-family-migration.spec.test.ts`, `packages/readiness/src/rule-family-publication.spec.test.ts`, `packages/readiness-execution/src/execution-publication-v2.spec.test.ts`, `packages/readiness-execution/src/test-fixtures/execution-publication-v2-spec-fixture.ts`, `packages/readiness/src/optimizer-consumer-contract.spec.test.ts`, `packages/readiness/src/oracle-publication.spec.test.ts`, `packages/readiness/src/oracle-final-publication.spec.test.ts`, `packages/readiness/src/oracle-published-evidence.spec.test.ts`, `packages/readiness/src/failure-reduction.spec.test.ts`, `packages/readiness/src/oracle-bindings.spec.test.ts`, `packages/readiness/src/execution-publication.spec.test.ts` ✅ (completed: 2026-09-03) — AR-24 passive historical-child record/projection oracle is RED only on the two planned functions and projection type; ESLint, Prettier, diff and static guards are green
- [x] 2.1.2 Run passive ST-21, ST-22–ST-26, ST-37 and ST-41 and record the expected RED result ✅ (completed: 2026-09-02 23:43) — final consolidated readiness/readiness-execution run: 16/16 RED only on absent planned Phase-2 modules/exports (`embed-case-fixtures`, `structured-execution-exemplar`, passive v2 resolver, optimizer projection and reverse dependency scanner)

### Session 2.2: Implementation

- [x] 2.2.1 Define the one complete immutable v2 pending/reviewed row union, structured-case schema, authenticated embed-fixture references and published structured-execution exemplar; derive all 2,112 first-candidate rows from authenticated authorities as the exact 16 reviewed modeled results plus 2,096 constrained pending variants through the exact 03-05 factory/validator, and bind the registry to the shared authenticated all-nine-bound successor-inventory projection — `packages/readiness/src/rule-family-model.ts`, `packages/readiness/src/terminal-rule-disposition.ts`, `packages/readiness/src/rule-model-version.ts`, `packages/readiness/src/embed-case-fixtures.ts`, `packages/readiness/src/structured-execution-exemplar.ts`, `readiness/rule-models/rule-models-v2.json` (ST-41, AR-15, AR-16, AR-18) ✅ (completed: 2026-09-03) — canonical 2,112-row registry persisted with 16 reviewed rows, 2,096 pending rows and authenticated exemplar/fixture authorities; final corrected model artifact digest `sha256:3e9f96b2…4eebf`
- [x] 2.2.2 Add passive authenticated publication-record resolution separately from executable authority acquisition, then extend the existing fixed parent model, pointer and transaction with exact closed v1/v2 dispatch while preserving v1 bytes and passive resolution — `packages/readiness/src/publication-model.ts`, `packages/readiness/src/publication-pointer.ts`, `packages/readiness/src/binding-publication.ts`, `packages/readiness/src/publication-resolver.ts`, `packages/readiness/src/rule-family-publication.ts` ✅ (completed: 2026-09-03) — exact v1/v2 dispatch, passive records and executable authority are separated; legacy callable-publication specs 34/34, binding publication 12/12, incremental publication 8/8 and final-publication internals 19/19 are green while historical release bytes remain unchanged
- [x] 2.2.3 Add a deterministic all-nine eligible-fact revision-transition manifest, exact implementation-revision replay invalidation and changed-format review binding without rewriting v1; reject partial, authority-inconsistent mixed, reordered, wildcard and identity-substituted migrations while accepting equality only where authenticated source/current authorities agree through the exact 03-05 results — `packages/readiness/src/rule-model-migration.ts`, `packages/readiness/src/publication-implementation-authority.ts`, `packages/readiness/src/publication-review.ts`, `packages/readiness/src/published-replay-authority.ts` ✅ (completed: 2026-09-03) — deterministic exact-nine transitions, authority-consistent identity rows under AR-30 and stable implementation-unavailable behavior pass the immutable migration/publication contracts
- [x] 2.2.4 Prepare, review, persist and failure-atomically select the first v2 parent with the exact 16 rule-to-stable-case/digest bindings, complete transitional table, authenticated structured-execution exemplar, shared all-nine-bound successor-inventory bytes and exact 03-05 member population; require model/member/manifest inventory-digest equality and reject omitted, swapped, list-only and unrelated bindings — `packages/readiness/src/rule-family-publication.ts`, `packages/readiness/src/binding-publication.ts`, `readiness/rule-models/rule-models-v2.json` (AR-18) ✅ (completed: 2026-09-03) — final corrected 12-member parent `sha256:95196a…dfdf6` is selected; strict digest equality and all hostile binding cases are green; every predecessor and historical release remains byte-identical
- [x] 2.2.5 Reuse the existing child-v1 transaction, pointer and executable resolver unchanged to prepare, review, persist and select the compatible execution child bound to that exact v2 parent digest; add the exact AR-24 passive child record/projection over a shared child-only validator while preserving all historical child-v1 bytes and named history — `packages/readiness/src/execution-publication-transaction.ts`, `packages/readiness/src/execution-publication-pointer.ts`, `packages/readiness/src/execution-publication-resolver.ts`, `packages/readiness/src/execution-publication-record.ts`, `packages/readiness-execution/src/execution-publication-catalog.ts` ✅ (completed: 2026-09-03) — final selected child-v1 `sha256:130e01…eb39` binds parent `sha256:95196a…dfdf6`; passive historical child `sha256:2afaa8…d228` authenticates without executable authority, focused publication/catalog/selection/filesystem regressions are green, and historical bytes remain untouched
- [x] 2.2.6 Implement the exact 03-05 identity-only provider-envelope consumer projection and make the pre-authored ST-37 contract green while proving parent-first `execution.stale-authority` and exact-child recovery through the existing child-v1 resolver — `packages/readiness/src/optimizer-consumer-contract.ts`, `packages/readiness/src/execution-publication-resolver.ts` (ST-26, ST-37) ✅ (completed: 2026-09-03) — optimizer consumer 2/2 green and execution recovery 1/1 green through the genuine selected pair
- [x] 2.2.7 Run passive ST-21, ST-22–ST-26, ST-37 and ST-41 and make them GREEN by changing implementation only ✅ (completed: 2026-09-03) — consolidated immutable compatibility suite GREEN: readiness 15/15 plus readiness-execution 1/1

### Session 2.3: Implementation Tests and Hardening

- [ ] 2.3.1 Add version/migration/publication failure-injection tests, including passive child-only missing-parent, hostile filesystem/schema/identity/race/forged-record/defensive-copy cases, and run targeted plus AR-7 full verification — `packages/readiness/src/rule-family-publication.impl.test.ts`, `packages/readiness/src/rule-model-migration.impl.test.ts`, `packages/readiness/src/execution-publication-record.impl.test.ts` (AR-24)

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 3: Terminal Disposition and Quality Classification

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: compiler and language; data and migration

**Reference**: 03-02 §Proposed data model/Quality-obligation review; ST-16–ST-20; AR-6

### Session 3.1: Specification Tests

- [ ] 3.1.1 [spec-author] Write denominator equality, independent bidirectional family completeness, terminal join and quality classification specification tests for ST-16–ST-20 — `packages/readiness/src/rule-family-dispositions.spec.test.ts`
- [ ] 3.1.2 Run ST-16–ST-20 and record the expected RED result before completeness-authority implementation

### Session 3.2: Implementation

- [ ] 3.2.1 Derive inventory-owned domain/neighbor/boundary completeness and define the separately reviewed citation-obligation authority for construction/spelling axes — `packages/readiness/src/rule-family-completeness.ts`, `readiness/rule-models/rule-family-citation-obligations-v2.json`
- [ ] 3.2.2 Validate exact 2,112-ID equality, bidirectional inventory/citation family completeness and fail-closed applicability/claim/route/result joins — `packages/readiness/src/rule-family-completeness.ts`, `packages/readiness/src/rule-family-validator.ts`, `packages/readiness/src/terminal-rule-disposition.ts`
- [ ] 3.2.3 Review and encode every selected quality-obligation row from frozen citations without adding cost measurement — `readiness/rule-models/quality-obligation-classification-v2.json`, `packages/readiness/src/quality-obligation-classification.ts`
- [ ] 3.2.4 Project semantic-gate and secondary-quality rows separately with shared rule identity — `packages/readiness/src/terminal-rule-projection.ts`, `packages/readiness/src/projection.ts`
- [ ] 3.2.5 Run the Phase-3 specification tests and make them GREEN by changing implementation/data only

### Session 3.3: Implementation Tests and Hardening

- [ ] 3.3.1 Add hostile combination, missing-ID and classification tests, then run targeted plus AR-7 full verification — `packages/readiness/src/rule-family-validator.impl.test.ts`, `packages/readiness/src/terminal-rule-disposition.impl.test.ts`

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 4: Remaining Source Families and Non-Source Evidence

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: compiler and language; data and migration

**Reference**: 03-02 §Family expansion/Non-source evidence/Embed fixture mapping; ST-17, ST-19, ST-21, ST-34; AR-6, AR-8

### Session 4.1: Specification Tests

- [ ] 4.1.1 [spec-author] Write only the execution-side write-before-launch/source-only-worker contract for ST-21; reuse passive ST-21 and ST-34 plus immutable ST-17/ST-19 from their earlier phases — `packages/readiness-execution/src/embed-fixture-route.spec.test.ts`
- [ ] 4.1.2 Run the new Phase-4 specification cases and record the expected RED result

### Session 4.2: Implementation

- [ ] 4.2.1 Author reviewed family/disposition rows for ch00–ch03, retaining one result per rule ID — `readiness/rule-models/rule-families-v2.json`, `readiness/rule-models/rule-models-v2.json`
- [ ] 4.2.2 Author reviewed family/disposition rows for ch04–ch06 — `readiness/rule-models/rule-families-v2.json`, `readiness/rule-models/rule-models-v2.json`
- [ ] 4.2.3 Author reviewed family/disposition rows for ch07–ch10 — `readiness/rule-models/rule-families-v2.json`, `readiness/rule-models/rule-models-v2.json`
- [ ] 4.2.4 Author reviewed family/disposition rows for ch11–ch15 — `readiness/rule-models/rule-families-v2.json`, `readiness/rule-models/rule-models-v2.json`
- [ ] 4.2.5 Author reviewed family/disposition rows for grammar and C64 platform rules; prove exact 2,112-ID closure — `readiness/rule-models/rule-families-v2.json`, `readiness/rule-models/rule-models-v2.json`
- [ ] 4.2.6 Bind remaining source-generatable families to existing or minimal family handlers — `packages/readiness/src/rule-family-cases.ts`, `packages/readiness/src/modeled-operation-registry.ts`
- [ ] 4.2.7 Add finite named non-source handlers and reject classification-only pass attempts — `packages/readiness/src/non-source-evidence.ts`, `packages/readiness/src/rule-family-validator.ts`
- [ ] 4.2.8 Carry authenticated content-addressed embed fixture references through the published case/route projection; have the trusted adapter resolve, verify and exclusively write them before source-only worker launch — `packages/readiness/src/embed-case-fixtures.ts`, `packages/readiness/src/execution-route-plan.ts`, `packages/readiness-execution/src/execution-envelope.ts`, `packages/readiness-execution/src/execution-route-planner.ts`, `packages/readiness-execution/src/execution-route-adapters.ts`, `packages/readiness-execution/src/execution-workspace.ts`
- [ ] 4.2.9 Run ST-17, ST-19, ST-21 and ST-34 and make them GREEN by changing implementation/data only

### Session 4.3: Implementation Tests and Hardening

- [ ] 4.3.1 Independently remove one authority obligation, family declaration and selected case per category—including both family and case together—and add unsafe fixture/carrier tests, then run targeted plus AR-7 full verification — `packages/readiness/src/rule-family-cases.impl.test.ts`, `packages/readiness/src/rule-family-validator.impl.test.ts`, `packages/readiness/src/embed-case-fixtures.impl.test.ts`, `packages/readiness-execution/src/complete-rule-routes.impl.test.ts`

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 5: Declared Public Routes and Defect Evidence

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: compiler and language; data and migration

**Reference**: 03-03 §Public execution obligations/Defect evidence; ST-27, ST-31; AR-1, AR-6

### Session 5.1: Specification Tests

- [ ] 5.1.1 [spec-author] Write declared-route and distinct ownership/evidence specification tests for ST-27 and ST-31 — `packages/readiness-execution/src/complete-rule-routes.spec.test.ts`, `packages/readiness/src/terminal-evidence-routing.spec.test.ts`
- [ ] 5.1.2 Run the Phase-5 specification tests and record the expected RED result

### Session 5.2: Implementation

- [ ] 5.2.1 Plan each modeled rule through its existing declared public obligations with exact case identity — `packages/readiness/src/execution-route-plan.ts`, `packages/readiness-execution/src/execution-route-planner.ts`
- [ ] 5.2.2 Feed structured source/diagnostic cases through existing frontend/compiler/CLI/emit/ACME adapters without new execution infrastructure — `packages/readiness-execution/src/execution-route-adapters.ts`, `packages/readiness-execution/src/execution-envelope.ts`
- [ ] 5.2.3 Bind bounded VICE-required cases to the existing local execution path and preserve unavailable semantics — `packages/readiness-execution/src/execution-vice-build.ts`, `packages/readiness-execution/src/execution-vice-evaluation.ts`
- [ ] 5.2.4 Map failure classes to conformance/compiler or parity/optimizer ownership using completed RD-05 Phase-3 contracts and the existing report provenance authority only — `packages/readiness/src/terminal-evidence-routing.ts`, `packages/readiness-execution/src/execution-report-provenance.ts`, `packages/readiness-execution/src/failure-report-provenance.impl.test.ts`
- [ ] 5.2.5 Run ST-27 and ST-31 and make them GREEN by changing implementation only

### Session 5.3: Implementation Tests and Hardening

- [ ] 5.3.1 Add unavailable/mismatch/ICE/assembly/VICE/timeout/cost separation tests and run targeted plus AR-7 full verification — `packages/readiness-execution/src/complete-rule-routes.impl.test.ts`, `packages/readiness/src/terminal-evidence-routing.impl.test.ts`

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 6: Bounded Smoke, Complete Publication and Closeout

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: compiler and language; data and migration

**Reference**: 03-04; ST-28–ST-32, ST-42; AR-1, AR-5–AR-7

### Session 6.1: Specification Tests

- [ ] 6.1.1 [spec-author] Write smoke ceiling/topology specification tests for ST-28–ST-30 — `packages/readiness/src/readiness-smoke-selection.spec.test.ts`
- [ ] 6.1.2 [spec-author] Write both the real-artifact authoritative ST-32 expectation and the synthetic ST-42 validator case; ST-42 cannot satisfy ST-32 — `packages/readiness/src/rd08-closeout.spec.test.ts`
- [ ] 6.1.3 Run the Phase-6 specification tests, record ST-28–ST-30/ST-42 RED, and record ST-32 RED because real closeout evidence does not yet exist

### Session 6.2: Implementation

- [ ] 6.2.1 Add the explicit deterministic 4-per-family/16-total selector and reject case 5/17 — `packages/readiness/src/readiness-smoke-selection.ts`, `packages/readiness/vitest.smoke.config.ts`
- [ ] 6.2.2 Add explicit family/tier/full non-emulator commands and scoped RD-08 coverage commands/configs while proving root smoke cannot reach exhaustive or production readiness VICE — `packages/readiness/package.json`, `packages/readiness/vitest.rd08.config.ts`, `packages/readiness-execution/package.json`, `packages/readiness-execution/vitest.rd08.config.ts`, `package.json`, `packages/readiness/src/readiness-command-boundary.ts`
- [ ] 6.2.3 Prepare, review, persist and failure-atomically select the complete reviewed v2 parent and emit family/rule summaries — `packages/readiness/src/rule-family-publication.ts`, `packages/readiness/src/terminal-rule-projection.ts`, `packages/readiness/src/binding-publication.ts`, `readiness/publications/`
- [ ] 6.2.4 Prepare, review, persist and select the compatible complete execution child under `readiness/execution-publications/`, bound to the exact final parent under `readiness/publications/`; prove parent-first unavailable and exact-child recovery — `packages/readiness/src/execution-publication-transaction.ts`, `packages/readiness/src/execution-publication-pointer.ts`, `packages/readiness/src/execution-publication-resolver.ts`, `packages/readiness-execution/src/execution-publication-catalog.ts`, `readiness/execution-publications/`
- [ ] 6.2.5 Run ST-28–ST-31 and ST-42 and make them GREEN by changing implementation/data only; authoritative ST-32 remains pending

### Session 6.3: Implementation Tests and Hardening

- [ ] 6.3.1 Add smoke hostile-input and deterministic summary tests; record bounded normal readiness case counts without a wall-clock gate — `packages/readiness/src/readiness-smoke-selection.impl.test.ts`, `packages/readiness/src/terminal-rule-projection.impl.test.ts`
- [ ] 6.3.2 Run the explicit complete non-emulator campaign and bounded local ACME/VICE campaign; retain unavailable results when tools are absent
- [ ] 6.3.3 Complete the deferral-expiry audit, assign every expired item, prove `spec/` and v1 bytes unchanged, and write the real closeout/roadmap evidence without marking RD-08 done — `codeops/features/compiler-readiness/plans/rd-08-complete-c64-rule-coverage/08-closeout.md`, `codeops/features/compiler-readiness/00-roadmap.md`
- [ ] 6.3.4 Run both scoped RD-08 coverage commands, then AR-7 exact full verification, then authoritative ST-32 last against the real artifacts; only after all pass mark the roadmap/closeout complete

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Dependencies

```text
Phase 1: real programs and independent semantics
    ↓
Phase 2: minimum evolution + first vertical publication
    ↓
Phase 3: terminal joins + quality classification
    ↓
Phase 4: remaining source/non-source families
    ↓
Phase 5: exact declared public-route evidence
    ↓
Phase 6: bounded smoke + complete publication + closeout
```

## Success Criteria

RD-08 is complete only when all 62 tasks and RD acceptance criteria pass; the selected v2
authority has one valid terminal row for every inventory ID; the first and complete publications
retain exact replay identity; normal tests stay within the smoke ceilings; required explicit local
campaigns have decisive evidence or typed unavailable blockers; `spec/` and historical v1 bytes
are unchanged; and the deferral-expiry audit has no orphaned RD-08 owner.
