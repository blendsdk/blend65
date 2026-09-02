# Execution Plan: RD-08 Complete C64 Rule Coverage

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-02 10:49
> **Progress**: 0/62 tasks (0%)
> **CodeOps Artifact Schema**: 1

## Overview

Execute RD-08 in six bounded phases. Phase 1 delivers real generated arrays/calls/branches/loops
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

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: compiler and language; data and migration

**Reference**: 03-01; ST-01–ST-15, ST-33–ST-36, ST-38–ST-40; AR-1–AR-4, AR-8

### Session 1.1: Specification Tests

- [ ] 1.1.1 [spec-author] Write independent IR/render/oracle/relation and bidirectional dependency-boundary specification tests for ST-01–ST-13, ST-33–ST-36 and ST-38–ST-40, including indexed writes, sized/unsized array parameters, void calls, exact statement depth and loop type extremes — `packages/readiness/src/structured-generated-programs.spec.test.ts`, `test/readiness-boundary.spec.test.ts`
- [ ] 1.1.2 [spec-author] Write authenticated structured execution-case/public-route tests and exact rule-to-case/digest binding mutations for ST-14–ST-15 — `packages/readiness/src/structured-execution-case.spec.test.ts`, `packages/readiness-execution/src/structured-generated-programs.spec.test.ts`, `packages/readiness/src/first-vertical-publication.spec.test.ts`
- [ ] 1.1.3 Run the Phase-1 specification tests and record the expected RED result without implementation changes

### Session 1.2: Implementation

- [ ] 1.2.1 Add the exact closed expression/statement/parameter/assignment forms, all holders, and structured-v2 identity-bearing statement-depth budget with an explicit v2 configuration domain separator and delegated syntax/type validation; preserve v1 budget preimages, domains, digests and canonical bytes exactly — `packages/readiness/src/generator-ir.ts`, `packages/readiness/src/generation-budget.ts`, `packages/readiness/src/canonical-identity.ts`, `packages/readiness/src/case-identity.ts`, `packages/readiness/src/replay-envelope-normalizer.ts`, `packages/readiness/src/oracle-evaluation-identity.ts`, `packages/readiness/src/failure-envelope-history.ts`, `packages/readiness/src/modeled-construction-templates.ts`, `packages/readiness/src/structured-ir-validation.ts`, `packages/readiness/src/generator-ir-validator.ts` (03-01 §New IR types)
- [ ] 1.2.2 Render the new nodes as canonical modern Blend source — `packages/readiness/src/structured-source-renderer.ts`, `packages/readiness/src/source-renderer.ts`, `packages/readiness/src/expression-renderer.ts` (ST-01, ST-05, ST-08, ST-12)
- [ ] 1.2.3 Build the four finite reviewed case families and exact construction usage — `packages/readiness/src/structured-case-families.ts`, `packages/readiness/src/modeled-generator-model.ts`, `packages/readiness/src/modeled-construction-templates.ts` (ST-01–ST-13, ST-34–ST-35)
- [ ] 1.2.4 Evaluate arrays/array-parameter aliasing, fixture-bound address wrap, call frames, branches and bounded/type-extreme loops independently; add loop unrolling through every closed relation seam — `packages/readiness/src/structured-oracle-evaluator.ts`, `packages/readiness/src/oracle-evaluator.ts`, `packages/readiness/src/oracle-model.ts`, `packages/readiness/src/semantic-relation-model.ts`, `packages/readiness/src/semantic-relation-input.ts`, `packages/readiness/src/semantic-relation-analysis.ts`, `packages/readiness/src/semantic-relation-transform.ts`, `packages/readiness/src/semantic-relation-compare.ts`, `packages/readiness/src/semantic-relation-conformance.ts`, `packages/readiness/src/semantic-relations.ts`, `packages/readiness/src/oracle-semantic-relations-candidate.ts`, `packages/readiness/src/oracle-mutation-model.ts`, `packages/readiness/src/oracle-mutation-suite.ts`, `packages/readiness/src/oracle-mutation-assertions.ts` (ST-01–ST-13, ST-33–ST-34, ST-39–ST-40)
- [ ] 1.2.5 Bind/export stable structured case identities/digests, add the authenticated structured branch to the existing execution-case constructor/projection, and feed ST-14 through the unchanged envelope/route without a new runner or caller-supplied observation — `packages/readiness/src/index.ts`, `packages/readiness/src/modeled-operation-registry.ts`, `packages/readiness/src/execution-case.ts`, `packages/readiness/src/structured-execution-case.spec.test.ts`, `packages/readiness/src/execution-case.impl.test.ts`, `packages/readiness-execution/src/structured-generated-programs.spec.test.ts`
- [ ] 1.2.6 Run ST-01–ST-15, ST-33–ST-36 and ST-38–ST-40 and make them GREEN by changing implementation only; record any real compiler defect as typed evidence

### Session 1.3: Implementation Tests and Hardening

- [ ] 1.3.1 Add hostile-input, type, source-byte, frame, wrapping, order, exact/over statement-depth and budget implementation tests — `packages/readiness/src/structured-ir-validation.impl.test.ts`, `packages/readiness/src/structured-source-renderer.impl.test.ts`, `packages/readiness/src/structured-oracle-evaluator.impl.test.ts`
- [ ] 1.3.2 Add mutation and dependency-boundary assertions for wrong indexing/order/branch/loop behavior and zero workspace imports — `packages/readiness/src/oracle-mutation-assertions-v2.impl.test.ts`, `packages/readiness/src/dependency-boundary.impl.test.ts`
- [ ] 1.3.3 Run targeted Phase-1 tests, Prettier checks, `spec/` cleanliness and the exact full verification command from AR-7

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 2: Minimal Evolution and First Accepted Publication

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: compiler and language; data and migration

**Reference**: 03-02 §Embed fixture mapping; 03-03 §Publication evolution/First accepted publication; passive ST-21, ST-22–ST-26, ST-37, ST-41; AR-3, AR-5

### Session 2.1: Specification Tests

- [ ] 2.1.1 [spec-author] Write passive authenticated embed-reference schema/projection, complete-v2-schema, v1 preservation, migration, stale-review, crash, parent/child transaction and consumer-envelope specification tests for passive ST-21, ST-22–ST-26, ST-37 and ST-41 in each owning package — `packages/readiness/src/rule-family-dispositions.spec.test.ts`, `packages/readiness/src/rule-family-publication.spec.test.ts`, `packages/readiness-execution/src/execution-publication-v2.spec.test.ts`, `packages/readiness/src/optimizer-consumer-contract.spec.test.ts`
- [ ] 2.1.2 Run passive ST-21, ST-22–ST-26, ST-37 and ST-41 and record the expected RED result

### Session 2.2: Implementation

- [ ] 2.2.1 Define the one complete immutable v2 pending/reviewed row union, structured-case and execution-child schema—including authenticated embed fixture references—and project all 2,112 first-candidate rows as the exact 16 reviewed modeled results plus 2,096 constrained pending variants — `packages/readiness/src/rule-family-model.ts`, `packages/readiness/src/terminal-rule-disposition.ts`, `packages/readiness/src/rule-model-version.ts`, `packages/readiness/src/embed-case-fixtures.ts`, `packages/readiness/src/execution-publication-model.ts`, `readiness/rule-models/rule-models-v2.json` (ST-41)
- [ ] 2.2.2 Extend the existing fixed parent model, pointer, transaction and resolver with closed v1/v2 dispatch while preserving exact v1 bytes and resolution — `packages/readiness/src/publication-model.ts`, `packages/readiness/src/publication-pointer.ts`, `packages/readiness/src/binding-publication.ts`, `packages/readiness/src/publication-resolver.ts`
- [ ] 2.2.3 Add deterministic eligible-fact migration, implementation-revision replay invalidation and changed-format review binding without rewriting v1 — `packages/readiness/src/rule-model-migration.ts`, `packages/readiness/src/publication-implementation-authority.ts`, `packages/readiness/src/publication-review.ts`, `packages/readiness/src/published-replay-authority.ts`
- [ ] 2.2.4 Prepare, review, persist and failure-atomically select the first v2 parent with the exact 16 rule-to-stable-case/digest bindings and complete transitional table; reject omitted, swapped, list-only and unrelated bindings — `packages/readiness/src/rule-family-publication.ts`, `packages/readiness/src/binding-publication.ts`, `readiness/rule-models/rule-models-v2.json`
- [ ] 2.2.5 Add closed child v1/v2 dispatch, then prepare, review, persist and select the compatible execution child bound to that exact parent through the existing child transaction and pointer while preserving v1 child bytes/resolution — `packages/readiness/src/execution-publication-model.ts`, `packages/readiness/src/execution-publication-transaction.ts`, `packages/readiness/src/execution-publication-pointer.ts`, `packages/readiness/src/execution-publication-resolver.ts`, `packages/readiness-execution/src/execution-publication-catalog.ts`
- [ ] 2.2.6 Implement the small provider-envelope consumer fixture and make the pre-authored ST-37 contract green while proving parent-first unavailable/exact-child recovery — `packages/readiness/src/optimizer-consumer-contract.ts`, `packages/readiness/src/execution-publication-resolver.ts` (ST-26, ST-37)
- [ ] 2.2.7 Run passive ST-21, ST-22–ST-26, ST-37 and ST-41 and make them GREEN by changing implementation only

### Session 2.3: Implementation Tests and Hardening

- [ ] 2.3.1 Add version/migration/publication failure-injection tests and run targeted plus AR-7 full verification — `packages/readiness/src/rule-family-publication.impl.test.ts`, `packages/readiness/src/rule-model-migration.impl.test.ts`

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
