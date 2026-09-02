# Execution Plan: RD-08 Complete C64 Rule Coverage

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-02 10:49
> **Progress**: 0/58 tasks (0%)
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
| 2 | Minimal evolution and first accepted publication | 8 |
| 3 | Terminal disposition and quality classification | 8 |
| 4 | Remaining source families and non-source evidence | 12 |
| 5 | Declared public routes and defect evidence | 8 |
| 6 | Bounded smoke, complete publication and closeout | 10 |

**Total: 58 tasks across 6 phases**

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

**Reference**: 03-01; ST-01–ST-15, ST-33, ST-35–ST-36; AR-1–AR-4, AR-8

### Session 1.1: Specification Tests

- [ ] 1.1.1 [spec-author] Write independent IR/render/oracle/relation and bidirectional dependency-boundary specification tests for ST-01–ST-13, ST-33 and ST-35–ST-36 — `packages/readiness/src/structured-generated-programs.spec.test.ts`, `test/readiness-boundary.spec.test.ts`
- [ ] 1.1.2 [spec-author] Write public-route and exact first-list specification tests for ST-14–ST-15 — `packages/readiness-execution/src/structured-generated-programs.spec.test.ts`, `packages/readiness/src/first-vertical-publication.spec.test.ts`
- [ ] 1.1.3 Run the Phase-1 specification tests and record the expected RED result without implementation changes

### Session 1.2: Implementation

- [ ] 1.2.1 Add only the array/call/branch/loop closed IR types and delegated syntax/type validation — `packages/readiness/src/generator-ir.ts`, `packages/readiness/src/structured-ir-validation.ts`, `packages/readiness/src/generator-ir-validator.ts` (03-01 §New IR types)
- [ ] 1.2.2 Render the new nodes as canonical modern Blend source — `packages/readiness/src/structured-source-renderer.ts`, `packages/readiness/src/source-renderer.ts`, `packages/readiness/src/expression-renderer.ts` (ST-01, ST-05, ST-08, ST-12)
- [ ] 1.2.3 Build the four finite reviewed case families and exact construction usage — `packages/readiness/src/structured-case-families.ts`, `packages/readiness/src/modeled-generator-model.ts`, `packages/readiness/src/modeled-construction-templates.ts` (ST-01–ST-13, ST-35)
- [ ] 1.2.4 Evaluate arrays, call frames, branches and bounded loops independently and add the bounded loop-unrolling relation — `packages/readiness/src/structured-oracle-evaluator.ts`, `packages/readiness/src/oracle-evaluator.ts`, `packages/readiness/src/oracle-semantic-relations-candidate.ts` (ST-01–ST-13, ST-33)
- [ ] 1.2.5 Bind/export the structured cases and feed ST-14 through the existing execution envelope/route without a new runner — `packages/readiness/src/index.ts`, `packages/readiness/src/modeled-operation-registry.ts`, `packages/readiness-execution/src/structured-generated-programs.spec.test.ts`
- [ ] 1.2.6 Run ST-01–ST-15 and make them GREEN by changing implementation only; record any real compiler defect as typed evidence

### Session 1.3: Implementation Tests and Hardening

- [ ] 1.3.1 Add hostile-input, type, source-byte, frame, wrapping, order and budget implementation tests — `packages/readiness/src/structured-ir-validation.impl.test.ts`, `packages/readiness/src/structured-source-renderer.impl.test.ts`, `packages/readiness/src/structured-oracle-evaluator.impl.test.ts`
- [ ] 1.3.2 Add mutation and dependency-boundary assertions for wrong indexing/order/branch/loop behavior and zero workspace imports — `packages/readiness/src/oracle-mutation-assertions-v2.impl.test.ts`, `packages/readiness/src/dependency-boundary.impl.test.ts`
- [ ] 1.3.3 Run targeted Phase-1 tests, Prettier checks, `spec/` cleanliness and the exact full verification command from AR-7

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 2: Minimal Evolution and First Accepted Publication

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: compiler and language; data and migration

**Reference**: 03-03 §Publication evolution/First accepted publication; ST-22–ST-26, ST-37; AR-3, AR-5

### Session 2.1: Specification Tests

- [ ] 2.1.1 [spec-author] Write v1 preservation, migration, stale-review, crash, pointer-pair and consumer-envelope specification tests for ST-22–ST-26 and ST-37 — `packages/readiness/src/rule-family-publication.spec.test.ts`
- [ ] 2.1.2 Run ST-22–ST-26 and ST-37 and record the expected RED result

### Session 2.2: Implementation

- [ ] 2.2.1 Add closed v1/v2 dispatch and deterministic eligible-fact migration without rewriting v1 — `packages/readiness/src/rule-model-version.ts`, `packages/readiness/src/rule-model-migration.ts`
- [ ] 2.2.2 Add implementation-revision replay invalidation and changed-format review binding — `packages/readiness/src/publication-implementation-authority.ts`, `packages/readiness/src/publication-review.ts`, `packages/readiness/src/published-replay-authority.ts`
- [ ] 2.2.3 Publish the exact 16-ID vertical parent and retain existing failure-atomic parent selection — `packages/readiness/src/rule-family-publication.ts`, `packages/readiness/src/binding-publication.ts`, `readiness/rule-models/rule-models-v2.json`
- [ ] 2.2.4 Add the small provider-envelope consumer fixture and prove separate-pointer unavailable/recovery behavior — `packages/readiness/src/optimizer-consumer-contract.spec.test.ts`, `packages/readiness/src/execution-publication-resolver.ts` (ST-26, ST-37)
- [ ] 2.2.5 Run ST-22–ST-26 and ST-37 and make them GREEN by changing implementation only

### Session 2.3: Implementation Tests and Hardening

- [ ] 2.3.1 Add version/migration/publication failure-injection tests and run targeted plus AR-7 full verification — `packages/readiness/src/rule-family-publication.impl.test.ts`, `packages/readiness/src/rule-model-migration.impl.test.ts`

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 3: Terminal Disposition and Quality Classification

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: compiler and language; data and migration

**Reference**: 03-02 §Proposed data model/Quality-obligation review; ST-16, ST-18–ST-20; AR-6

### Session 3.1: Specification Tests

- [ ] 3.1.1 [spec-author] Write denominator equality, terminal join and quality classification specification tests for ST-16, ST-18–ST-20 — `packages/readiness/src/rule-family-dispositions.spec.test.ts`
- [ ] 3.1.2 Run the Phase-3 specification tests and record the expected RED result

### Session 3.2: Implementation

- [ ] 3.2.1 Define closed claim-role, evidence-route, evidence-result and family v2 types — `packages/readiness/src/rule-family-model.ts`, `packages/readiness/src/terminal-rule-disposition.ts`
- [ ] 3.2.2 Validate exact 2,112-ID equality and fail-closed applicability/claim/route/result joins — `packages/readiness/src/rule-family-validator.ts`, `packages/readiness/src/terminal-rule-disposition.ts`
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

- [ ] 4.1.1 [spec-author] Write family completeness, named non-source, embed fixture and unsized-array specification tests for ST-17, ST-19, ST-21 and ST-34 — `packages/readiness/src/rule-family-dispositions.spec.test.ts`
- [ ] 4.1.2 Run the new Phase-4 specification cases and record the expected RED result

### Session 4.2: Implementation

- [ ] 4.2.1 Author reviewed family/disposition rows for ch00–ch03, retaining one result per rule ID — `readiness/rule-models/rule-families-v2.json`, `readiness/rule-models/rule-models-v2.json`
- [ ] 4.2.2 Author reviewed family/disposition rows for ch04–ch06 — `readiness/rule-models/rule-families-v2.json`, `readiness/rule-models/rule-models-v2.json`
- [ ] 4.2.3 Author reviewed family/disposition rows for ch07–ch10 — `readiness/rule-models/rule-families-v2.json`, `readiness/rule-models/rule-models-v2.json`
- [ ] 4.2.4 Author reviewed family/disposition rows for ch11–ch15 — `readiness/rule-models/rule-families-v2.json`, `readiness/rule-models/rule-models-v2.json`
- [ ] 4.2.5 Author reviewed family/disposition rows for grammar and C64 platform rules; prove exact 2,112-ID closure — `readiness/rule-models/rule-families-v2.json`, `readiness/rule-models/rule-models-v2.json`
- [ ] 4.2.6 Bind remaining source-generatable families to existing or minimal family handlers — `packages/readiness/src/rule-family-cases.ts`, `packages/readiness/src/modeled-operation-registry.ts`
- [ ] 4.2.7 Add finite named non-source handlers and reject classification-only pass attempts — `packages/readiness/src/non-source-evidence.ts`, `packages/readiness/src/rule-family-validator.ts`
- [ ] 4.2.8 Map content-addressed embed fixture IDs through the existing execution workspace contract without a general asset system — `packages/readiness/src/embed-case-fixtures.ts`, `packages/readiness-execution/src/execution-workspace.ts`
- [ ] 4.2.9 Run ST-17, ST-19, ST-21 and ST-34 and make them GREEN by changing implementation/data only

### Session 4.3: Implementation Tests and Hardening

- [ ] 4.3.1 Remove one construction/neighbor/boundary/spelling/member per family and add unsafe fixture tests, then run targeted plus AR-7 full verification — `packages/readiness/src/rule-family-cases.impl.test.ts`, `packages/readiness/src/embed-case-fixtures.impl.test.ts`

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
- [ ] 5.2.4 Map failure classes to conformance/compiler or parity/optimizer ownership using completed RD-05 Phase-3 contracts only — `packages/readiness/src/terminal-evidence-routing.ts`, `packages/readiness-execution/src/failure-report-provenance.ts`
- [ ] 5.2.5 Run ST-27 and ST-31 and make them GREEN by changing implementation only

### Session 5.3: Implementation Tests and Hardening

- [ ] 5.3.1 Add unavailable/mismatch/ICE/assembly/VICE/timeout/cost separation tests and run targeted plus AR-7 full verification — `packages/readiness-execution/src/complete-rule-routes.impl.test.ts`, `packages/readiness/src/terminal-evidence-routing.impl.test.ts`

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 6: Bounded Smoke, Complete Publication and Closeout

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: compiler and language; data and migration

**Reference**: 03-04; ST-28–ST-32; AR-1, AR-5–AR-7

### Session 6.1: Specification Tests

- [ ] 6.1.1 [spec-author] Write smoke ceiling/topology specification tests for ST-28–ST-30 — `packages/readiness/src/readiness-smoke-selection.spec.test.ts`
- [ ] 6.1.2 [spec-author] Write the deferral-expiry closeout case for ST-32 — `packages/readiness/src/rd08-closeout.spec.test.ts`
- [ ] 6.1.3 Run the Phase-6 specification tests and record the expected RED result

### Session 6.2: Implementation

- [ ] 6.2.1 Add the explicit deterministic 4-per-family/16-total selector and reject case 5/17 — `packages/readiness/src/readiness-smoke-selection.ts`, `packages/readiness/vitest.smoke.config.ts`
- [ ] 6.2.2 Add explicit family/tier/full non-emulator commands while proving root smoke cannot reach exhaustive or production readiness VICE — `packages/readiness/package.json`, `package.json`, `packages/readiness/src/readiness-command-boundary.ts`
- [ ] 6.2.3 Publish complete reviewed v2 parent/compatible child evidence through existing transactions and emit family/rule summaries — `packages/readiness/src/rule-family-publication.ts`, `packages/readiness/src/terminal-rule-projection.ts`, `readiness/publications/`
- [ ] 6.2.4 Run ST-28–ST-32 and make them GREEN by changing implementation/data only

### Session 6.3: Implementation Tests and Hardening

- [ ] 6.3.1 Add smoke hostile-input and deterministic summary tests; record bounded normal readiness case counts without a wall-clock gate — `packages/readiness/src/readiness-smoke-selection.impl.test.ts`, `packages/readiness/src/terminal-rule-projection.impl.test.ts`
- [ ] 6.3.2 Run the explicit complete non-emulator campaign and bounded local ACME/VICE campaign; retain unavailable results when tools are absent
- [ ] 6.3.3 Complete the deferral-expiry audit, assign every expired item, prove `spec/` and v1 bytes unchanged, update roadmap/closeout docs, and run AR-7 exact full verification — `codeops/features/compiler-readiness/plans/rd-08-complete-c64-rule-coverage/08-closeout.md`, `codeops/features/compiler-readiness/00-roadmap.md`

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

RD-08 is complete only when all 58 tasks and RD acceptance criteria pass; the selected v2
authority has one valid terminal row for every inventory ID; the first and complete publications
retain exact replay identity; normal tests stay within the smoke ceilings; required explicit local
campaigns have decisive evidence or typed unavailable blockers; `spec/` and historical v1 bytes
are unchanged; and the deferral-expiry audit has no orphaned RD-08 owner.
