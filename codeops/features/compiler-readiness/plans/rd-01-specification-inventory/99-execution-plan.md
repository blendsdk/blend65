# Execution Plan: RD-01 Specification Inventory

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-23 22:02
> **Progress**: 0/50 tasks (0%)
> **CodeOps Artifact Schema**: 1

## Overview

Implement the authoritative C64 v3.0 rule denominator through five specification-first phases.
Every phase uses targeted tests during red/green work, then the full AGENTS.md verify at close.
`spec/` is read-only throughout (AR-P1, AR-P12).

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Workspace, strict input and closed schema | 10 |
| 2 | Fragmentation, manifest and source safety | 10 |
| 3 | Semantic graph, declarations and blockers | 10 |
| 4 | Complete source ledger and C64 inventory | 10 |
| 5 | Projection, version evolution and closeout | 10 |

**Total: 50 tasks across 5 phases**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the single source of truth. Every task appears exactly once.
>
> 1. On implementation, mark a task `[~]` with
>    `⏳ (implemented: YYYY-MM-DD HH:MM)`.
> 2. On verification pass, promote it to `[x]` with
>    `✅ (completed: YYYY-MM-DD HH:MM)`.
> 3. Update Progress and Last Updated after every task. Only `[x]` counts complete.
> 4. Resume the first `[~]` task, otherwise the first `[ ]` task.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'`.

## Phase 1: Workspace, strict input and closed schema

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: compiler/language; data/migration; security/resource safety

### Step 1.1: Specification tests

**Reference**: `03-01` §Package surface–§Limits · AR-P2, AR-P4, AR-P5, AR-P11

- [ ] 1.1.1 [spec-author] Write ST-1–ST-5 strict-input/schema tests — `packages/readiness/src/json-input.spec.test.ts`, `schema-validator.spec.test.ts`
- [ ] 1.1.2 [spec-author] Write ST-6–ST-7 limits/dependency-boundary tests — `packages/readiness/src/limits.spec.test.ts`, `dependency-boundary.spec.test.ts`
- [ ] 1.1.3 Run Phase 1 specification tests and record genuine red failures — targeted readiness Vitest

### Step 1.2: Implementation

**Reference**: `03-01` §Architecture–§Strict JSON intake · AR-P2–AR-P5, AR-P11

- [ ] 1.2.1 Scaffold private workspace and root commands — `packages/readiness/package.json`, `packages/readiness/tsconfig.json`, `package.json`
- [ ] 1.2.2 Add root TS reference and explicit Ajv/jsonc-parser dependencies — `tsconfig.json`, `packages/readiness/package.json`, `yarn.lock`
- [ ] 1.2.3 Implement v1 contracts, limits and ordered diagnostics — `packages/readiness/src/model.ts`, `limits.ts`, `diagnostics.ts`
- [ ] 1.2.4 Implement strict duplicate-preserving intake — `packages/readiness/src/json-input.ts`
- [ ] 1.2.5 Commit the closed schema and Ajv adapter — `readiness/schema/inventory-v1.schema.json`, `packages/readiness/src/schema-validator.ts`
- [ ] 1.2.6 Export the minimal internal API and make ST-1–ST-7 green — `packages/readiness/src/index.ts`

### Step 1.3: Implementation tests and hardening

**Reference**: `07` ST-1–ST-7 · AR-P7, AR-P11

- [ ] 1.3.1 Add parser/diagnostic internal tests, run Prettier, full verify and confirm `spec/` clean — `json-input.impl.test.ts`, `diagnostics.impl.test.ts`

**Deliverables:** private compiler-independent workspace; strict raw intake; closed v1 schema;
deterministic diagnostics; repository commands established.

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 2: Fragmentation, manifest and source safety

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: compiler/language; security/resource safety; data/migration

### Step 2.1: Specification tests

**Reference**: `03-02` §Fragmentation profile–§Source resolution · AR-P6, AR-P8, AR-P11

- [ ] 2.1.1 [spec-author] Write ST-8–ST-10 vector tests from independent bytes — `packages/readiness/src/fragmenter.spec.test.ts`, `readiness/conformance/fragmentation-v1.json`
- [ ] 2.1.2 [spec-author] Write ST-11–ST-14 manifest/citation/path tests — `packages/readiness/src/source-repository.spec.test.ts`
- [ ] 2.1.3 Run Phase 2 specification tests and record genuine red failures — targeted readiness Vitest

### Step 2.2: Implementation

**Reference**: `03-02` §Fragmentation profile–§Normative-source manifest · AR-P6, AR-P8

- [ ] 2.2.1 Implement byte/line/hash primitives and v1 fragment types — `packages/readiness/src/source-bytes.ts`, `fragment-model.ts`
- [ ] 2.2.2 Implement heading, paragraph and list scanning — `packages/readiness/src/fragmenter.ts`
- [ ] 2.2.3 Add table, fenced-EBNF and residual scanning — `packages/readiness/src/fragmenter.ts`
- [ ] 2.2.4 Implement canonical root containment and exact citation resolution — `packages/readiness/src/source-repository.ts`
- [ ] 2.2.5 Add the closed ordered source/section manifest classifications — `readiness/inventory/compiler-readiness-v1.json`
- [ ] 2.2.6 Make ST-8–ST-14 green and verify deterministic scans — fragment/source targeted suite

### Step 2.3: Implementation tests and hardening

**Reference**: `07` ST-8–ST-14 · AR-P6, AR-P11

- [ ] 2.3.1 Add scanner state/hash internals, run Prettier, full verify and confirm `spec/` clean — `fragmenter.impl.test.ts`

**Deliverables:** implementation-independent vectors; total byte scanner; closed manifest; secure
source repository; exact citations.

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 3: Semantic graph, declarations and blockers

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: compiler/language; data/migration; correctness

### Step 3.1: Specification tests

**Reference**: `03-03` §Validation pipeline · AR-P7–AR-P9

- [ ] 3.1.1 [spec-author] Write ST-15–ST-19 ledger/conflict/identity tests — `packages/readiness/src/ledger-validator.spec.test.ts`, `conflict-validator.spec.test.ts`
- [ ] 3.1.2 [spec-author] Write ST-20–ST-22 declaration/capability/blocker tests — `packages/readiness/src/declaration-validator.spec.test.ts`
- [ ] 3.1.3 [spec-author] Write ST-23–ST-26 projection/graph tests — `packages/readiness/src/rule-graph.spec.test.ts`
- [ ] 3.1.4 Run Phase 3 specification tests and record genuine red failures — targeted readiness Vitest

### Step 3.2: Implementation

**Reference**: `03-03` §Ownership–§Blocking reasons · AR-P7–AR-P9

- [ ] 3.2.1 Implement ledger totality, decomposition and lineage validation — `packages/readiness/src/ledger-validator.ts`
- [ ] 3.2.2 Implement reviewed conflict classification and canonical aggregates — `packages/readiness/src/conflict-validator.ts`
- [ ] 3.2.3 Implement handler/capability declaration lifecycle and typed blocker reasons — `packages/readiness/src/declaration-validator.ts`, `blocking-reasons.ts`
- [ ] 3.2.4 Implement target projection, prerequisite rewriting, DAG and stable ordering — `packages/readiness/src/rule-graph.ts`
- [ ] 3.2.5 Compose prerequisite-gated semantic passes and make ST-15–ST-26 green — `packages/readiness/src/semantic-validator.ts`

### Step 3.3: Implementation tests and hardening

**Reference**: `07` ST-15–ST-26 · AR-P7

- [ ] 3.3.1 Add graph/index/cycle internals, run Prettier, full verify and confirm `spec/` clean — `semantic-validator.impl.test.ts`

**Deliverables:** exhaustive ledger semantics; conflict aggregates; typed declarations and
blockers; five-target graph projection; stable topological order.

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 4: Complete source ledger and C64 inventory

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: compiler/language; data/migration; semantic completeness

### Step 4.1: Specification tests

**Reference**: `03-04` §Inventory population and closeout · AR-P1, AR-P8, AR-P9

- [ ] 4.1.1 [spec-author] Write ST-32–ST-33 real-inventory completeness/freeze tests — `packages/readiness/src/inventory.spec.test.ts`
- [ ] 4.1.2 Run the real-inventory tests and record missing-ledger/rule failures — targeted readiness Vitest

### Step 4.2: Implementation

**Reference**: RD-01 Must Haves and AC-3–AC-14 · `03-03` · AR-P1, AR-P8, AR-P9

- [ ] 4.2.1 Populate rules and ledger for chapters 00–03 in bounded reviewed batches — `readiness/inventory/compiler-readiness-v1.json`
- [ ] 4.2.2 Populate rules and ledger for chapters 04–06 in bounded reviewed batches — `readiness/inventory/compiler-readiness-v1.json`
- [ ] 4.2.3 Populate rules and ledger for chapters 07–09 in bounded reviewed batches — `readiness/inventory/compiler-readiness-v1.json`
- [ ] 4.2.4 Populate rules and ledger for chapters 10–12 in bounded reviewed batches — `readiness/inventory/compiler-readiness-v1.json`
- [ ] 4.2.5 Populate rules and ledger for chapters 13–15 in bounded reviewed batches — `readiness/inventory/compiler-readiness-v1.json`
- [ ] 4.2.6 Populate normative grammar and C64 projection children in bounded batches — `readiness/inventory/compiler-readiness-v1.json`
- [ ] 4.2.7 Reconcile contextual restatements, conflicts and feature-index coverage — `readiness/inventory/compiler-readiness-v1.json`

### Step 4.3: Implementation tests and hardening

**Reference**: `07` ST-32–ST-33 · AR-P1, AR-P12

- [ ] 4.3.1 Add aggregate consistency checks, make ST-32–ST-33 green, run Prettier/full verify and confirm `spec/` clean — `packages/readiness/src/inventory.impl.test.ts`

**Deliverables:** complete source classification; zero undisposed included spans; stable C64
denominator; visible other-target children; declared handler/capability contracts.

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 5: Projection, version evolution and closeout

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: data/migration; security/resource safety; maintainability

### Step 5.1: Specification tests

**Reference**: `03-04` §Commands–§Version dispatch · AR-P3, AR-P7, AR-P10, AR-P11

- [ ] 5.1.1 [spec-author] Write ST-27–ST-29 projection/freshness tests — `packages/readiness/src/projection.spec.test.ts`
- [ ] 5.1.2 [spec-author] Write ST-30–ST-31 versioning/atomic-failure tests — `packages/readiness/src/versioning.spec.test.ts`
- [ ] 5.1.3 Run Phase 5 specification tests and record genuine red failures — targeted readiness Vitest

### Step 5.2: Implementation

**Reference**: `03-04` §Markdown projection–§Version dispatch · AR-P3, AR-P10, AR-P11

- [ ] 5.2.1 Implement safe deterministic Markdown projection — `packages/readiness/src/projection.ts`
- [ ] 5.2.2 Implement exact version dispatch, migration registry and invalidation model — `packages/readiness/src/versioning.ts`
- [ ] 5.2.3 Implement failure-atomic writer with injected failure seam — `packages/readiness/src/atomic-writer.ts`
- [ ] 5.2.4 Implement check/generate CLI orchestration and make ST-27–ST-31 green — `packages/readiness/src/cli.ts`
- [ ] 5.2.5 Generate and review the committed projection and authority README — `readiness/generated/compiler-readiness.md`, `readiness/README.md`

### Step 5.3: Implementation tests and hardening

**Reference**: `07` ST-27–ST-34 · AR-P10–AR-P12

- [ ] 5.3.1 Add projection/version internals, run `yarn readiness:check`, Prettier/full verify, deferral-expiry review and final `spec/` freeze check — `projection.impl.test.ts`, `versioning.impl.test.ts`
- [ ] 5.3.2 Record implementation/verification evidence, update RD-01 closeout and synchronize roadmaps — CodeOps traceability and roadmap artifacts

**Deliverables:** byte-stable safe projection; non-mutating trust gate; explicit generator; strict
version dispatcher; proven atomic migration seam; RD closeout evidence.

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Dependencies

```text
Phase 1: model + schema + command seam
    ↓
Phase 2: source fragments + safe citations
    ↓
Phase 3: semantic relationships + blockers
    ↓
Phase 4: complete authoritative denominator
    ↓
Phase 5: projection + evolution + closeout
```

## Success Criteria

The RD is complete when:

1. All 50 tasks are verified.
2. RD-01 AC-1–AC-18 pass through ST-1–ST-34.
3. The complete C64 v3.0 denominator validates with zero undisposed included fragments.
4. Every blocking ambiguity/unbound declaration remains visible as a typed blocker.
5. `yarn readiness:check` is deterministic and non-mutating.
6. Generated Markdown is fresh, complete and injection-safe.
7. The full project verify passes with no new warnings/errors.
8. `spec/` remains byte-for-byte untouched.
9. Deferral-expiry review finds no orphaned downstream owner.
10. CodeOps implementation and verification evidence is recorded before roadmap completion.
