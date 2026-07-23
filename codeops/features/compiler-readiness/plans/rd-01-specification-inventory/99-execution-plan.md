# Execution Plan: RD-01 Specification Inventory

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-24 00:34
> **Progress**: 20/62 tasks (32%)
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
| 4 | Complete source ledger and C64 inventory | 22 |
| 5 | Projection, version evolution and closeout | 10 |

**Total: 62 tasks across 5 phases**

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

> **Phase baseline tree**: c00af39aa55a3164f4700717e5627c230605a746
> **Lenses**: compiler/language; data/migration; security/resource safety

### Step 1.1: Specification tests

**Reference**: `03-01` §Package surface–§Limits · AR-P2, AR-P4, AR-P5, AR-P11

- [x] 1.1.1 [spec-author] Write ST-1–ST-5 strict-input/schema tests — `packages/readiness/src/json-input.spec.test.ts`, `schema-validator.spec.test.ts` ✅ (completed: 2026-07-23 23:24)
- [x] 1.1.2 [spec-author] Write ST-6 limits tests — `packages/readiness/src/limits.spec.test.ts` ✅ (completed: 2026-07-23 23:24)
- [x] 1.1.3 Run Phase 1 specification tests and record genuine red failures — targeted readiness Vitest ✅ (completed: 2026-07-23 23:24)

### Step 1.2: Implementation

**Reference**: `03-01` §Architecture–§Strict JSON intake · AR-P2–AR-P5, AR-P11

- [x] 1.2.1 Scaffold private workspace and root commands — `packages/readiness/package.json`, `packages/readiness/tsconfig.json`, `package.json` ✅ (completed: 2026-07-23 23:36)
- [x] 1.2.2 Add root TS reference plus explicit Ajv/jsonc-parser and Vitest 2 coverage-provider dependencies — `tsconfig.json`, `packages/readiness/package.json`, `yarn.lock` ✅ (completed: 2026-07-23 23:36)
- [x] 1.2.3 Implement v1 contracts, limits and ordered diagnostics — `packages/readiness/src/model.ts`, `limits.ts`, `diagnostics.ts` ✅ (completed: 2026-07-23 23:36)
- [x] 1.2.4 Implement strict duplicate-preserving intake — `packages/readiness/src/json-input.ts` ✅ (completed: 2026-07-23 23:36)
- [x] 1.2.5 Commit the closed schema and Ajv adapter — `readiness/schema/inventory-v1.schema.json`, `packages/readiness/src/schema-validator.ts` ✅ (completed: 2026-07-23 23:36)
- [x] 1.2.6 Export the minimal internal API and make ST-1–ST-6 green — `packages/readiness/src/index.ts` ✅ (completed: 2026-07-23 23:36)

### Step 1.3: Implementation tests and hardening

**Reference**: `07` ST-1–ST-6 · AR-P7, AR-P11

- [x] 1.3.1 Add visitor-abort, package-boundary and diagnostic internal tests; enforce readiness branch coverage; run Prettier/full verify and confirm `spec/` clean — `json-input.impl.test.ts`, `dependency-boundary.impl.test.ts`, `diagnostics.impl.test.ts` ✅ (completed: 2026-07-23 23:43)

**Deliverables:** private compiler-independent workspace; strict raw intake; closed v1 schema;
deterministic diagnostics; repository commands established.

### Phase 1 quality review

| Finding | Severity | Ruling |
|---|---|---|
| RV-001 | MAJOR | Fixed; re-review resolved — reject excessive depth in container-begin callbacks and prove extreme nesting cannot throw |
| RV-002 | MINOR | Fixed; re-review resolved — replace locale-sensitive diagnostic comparison with ordinal comparison |
| RV-SEM-001 | MAJOR | Fixed; re-review resolved — extend closed-object and required-field oracles across every v1 variant |
| RV-SEM-002 | MAJOR | Fixed after re-review rejection — exact-boundary fixtures are complete valid inventories and must return `ok: true` |
| SA-001 | MAJOR | Fixed after re-review rejection — enforce value, property-name and path-specific collection caps before materialization |
| SA-002 | MAJOR | Fixed after re-review rejection — fail fast before Ajv with a bound derived from the published input contract |
| RV-003 | MAJOR | Fixed after re-review — remove the hidden aggregate limit that rejected a valid 14,000-rule inventory |

The protocol's single re-review was completed. Its rejected findings were corrected and verified;
no third review was dispatched.

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 2: Fragmentation, manifest and source safety

> **Phase baseline tree**: cce222517e9780ea48a9801f64af2def1fb6afd7
> **Lenses**: compiler/language; security/resource safety; data/migration

### Step 2.1: Specification tests

**Reference**: `03-02` §Fragmentation profile–§Source resolution · AR-P6, AR-P8, AR-P11

- [x] 2.1.1 [spec-author] Write ST-8 and ST-10 requirement-derived vector tests from independent bytes — `packages/readiness/src/fragmenter.spec.test.ts`, `readiness/conformance/fragmentation-v1.json` ✅ (completed: 2026-07-24 00:22)
- [x] 2.1.2 [spec-author] Write ST-11–ST-14 manifest/citation/path tests — `packages/readiness/src/source-repository.spec.test.ts` ✅ (completed: 2026-07-24 00:22)
- [x] 2.1.3 Run Phase 2 specification tests and record genuine red failures — targeted readiness Vitest ✅ (completed: 2026-07-24 00:22)

### Step 2.2: Implementation

**Reference**: `03-02` §Fragmentation profile–§Normative-source manifest · AR-P6, AR-P8

- [x] 2.2.1 Implement byte/line/hash primitives and v1 fragment types — `packages/readiness/src/source-bytes.ts`, `fragment-model.ts` ✅ (completed: 2026-07-24 00:32)
- [x] 2.2.2 Implement heading, paragraph and list scanning — `packages/readiness/src/fragmenter.ts` ✅ (completed: 2026-07-24 00:32)
- [x] 2.2.3 Add table, fenced-EBNF and residual scanning — `packages/readiness/src/fragmenter.ts` ✅ (completed: 2026-07-24 00:32)
- [x] 2.2.4 Implement canonical root containment and exact citation resolution — `packages/readiness/src/source-repository.ts` ✅ (completed: 2026-07-24 00:32)
- [x] 2.2.5 Add the closed ordered source/section manifest classifications — `readiness/inventory/compiler-readiness-v1.json` ✅ (completed: 2026-07-24 00:32)
- [x] 2.2.6 Make ST-8 and ST-10–ST-14 green and verify deterministic scans — fragment/source targeted suite ✅ (completed: 2026-07-24 00:32)

### Step 2.3: Implementation tests and hardening

**Reference**: `07` ST-8, ST-10–ST-14 · AR-P6, AR-P11

- [x] 2.3.1 Add scanner state/hash internals, enforce readiness branch coverage, run Prettier/full verify and confirm `spec/` clean — `fragmenter.impl.test.ts` ✅ (completed: 2026-07-24 00:34)

**Deliverables:** implementation-independent vectors; total byte scanner; closed manifest; secure
source repository; exact citations.

### Phase 2 quality review

| Finding | Severity | Ruling |
|---|---|---|
| RV-201 | MAJOR | Fixed — reject unsupported profiles and noncanonical source paths before scanning |
| RV-202 / RV-SEM-202 | MAJOR | Fixed — emit residual children for every unclaimed EBNF byte interval |
| RV-203 / RV-SEM-203 | MAJOR | Fixed — enforce unique contiguous order and the authoritative path/classification/section policy |
| RV-204 / SA-201 | MAJOR | Fixed — enforce `maxFragments` during draft creation and reuse one line table |
| SA-202 | MAJOR | Fixed — use iterative bounded enumeration and reserve aggregate bytes before reads |
| SA-203 | MAJOR | Fixed — index fragments once for bounded citation resolution |
| SA-204 | MAJOR | Fixed — reject source symlinks instead of canonicalizing away lexical aliases |
| SA-205 | MINOR | Fixed — replace raw filesystem messages with stable repository diagnostics |
| RV-SEM-201 | MAJOR | Fixed — keep the Phase-2 skeleton source-invalid until every fragment is disposed |
| RV-SEM-204 | MAJOR | Fixed — count section occurrences using NFC-normalized ancestry |
| RV-SEM-205 | MINOR | Fixed — remove at most one ASCII space around table cells |
| RV-205 | MAJOR | Fixed after re-review rejection — keep unterminated production children within the fence's non-whitespace span |

The protocol's single re-review was completed. Its remaining containment finding was corrected and
verified; no third review was dispatched.

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 3: Semantic graph, declarations and blockers

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: compiler/language; data/migration; correctness

### Step 3.1: Specification tests

**Reference**: `03-03` §Validation pipeline · AR-P7–AR-P9

- [ ] 3.1.1 [spec-author] Write ST-15–ST-19 plus ST-18a ledger/conflict/identity tests — `packages/readiness/src/ledger-validator.spec.test.ts`, `conflict-validator.spec.test.ts`
- [ ] 3.1.2 [spec-author] Write ST-20–ST-22 declaration/capability/blocker tests — `packages/readiness/src/declaration-validator.spec.test.ts`
- [ ] 3.1.3 [spec-author] Write ST-23–ST-26 projection/graph tests — `packages/readiness/src/rule-graph.spec.test.ts`
- [ ] 3.1.4 Run Phase 3 specification tests and record genuine red failures — targeted readiness Vitest

### Step 3.2: Implementation

**Reference**: `03-03` §Ownership–§Blocking reasons · AR-P7–AR-P9

- [ ] 3.2.1 Implement ledger totality, decomposition, genesis-anchored hash-chained identity allocation/retirement and lineage validation — `packages/readiness/src/ledger-validator.ts`, `identity-ledger.ts`, `readiness/inventory/rule-identities-v1.jsonl`
- [ ] 3.2.2 Implement reviewed conflict classification and canonical aggregates — `packages/readiness/src/conflict-validator.ts`
- [ ] 3.2.3 Implement handler/capability declaration lifecycle, typed blocker reasons and a deterministic bounded declaration generator with a hand-written stable barrel seam; exercise only fixture/in-memory output — `packages/readiness/src/declaration-validator.ts`, `blocking-reasons.ts`, `declaration-generator.ts`, `index.ts`
- [ ] 3.2.4 Implement target projection, prerequisite rewriting, DAG and stable ordering — `packages/readiness/src/rule-graph.ts`
- [ ] 3.2.5 Compose prerequisite-gated semantic passes, review-evidence validation and make ST-15–ST-26 plus ST-18a green — `packages/readiness/src/semantic-validator.ts`, `review-evidence.ts`

### Step 3.3: Implementation tests and hardening

**Reference**: `07` ST-15–ST-26 · AR-P7

- [ ] 3.3.1 Add graph/index/cycle, declaration-generation and review-evidence internals; enforce readiness branch coverage; run Prettier/full verify and confirm `spec/` clean — `semantic-validator.impl.test.ts`, `declaration-generator.impl.test.ts`, `review-evidence.impl.test.ts`

**Deliverables:** exhaustive ledger semantics; conflict aggregates; typed declaration contracts,
deterministic in-memory declaration generator and blockers; five-target graph projection; stable
topological order.

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 4: Complete source ledger and C64 inventory

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: compiler/language; data/migration; semantic completeness

### Step 4.1: Specification tests

**Reference**: `03-04` §Inventory population and closeout · AR-P1, AR-P8, AR-P9

- [ ] 4.1.1 [spec-author] Write ST-32 requirements-derived real-inventory completeness tests — `packages/readiness/src/inventory.spec.test.ts`
- [ ] 4.1.2 Run the real-inventory tests and record missing-ledger/rule failures — targeted readiness Vitest

### Step 4.2: Chapter-granular inventory and independent review

**Reference**: RD-01 Must Haves and AC-3–AC-14 · `03-03` · AR-P1, AR-P8, AR-P9

Every unit below requires separate author and compiler/language reviewer ownership. The reviewer
checks every disposition, decomposition, applicability choice and evidence set. Run ledger and
in-memory declaration-render determinism checks, then record evidence keyed to the unit's canonical
semantic digest and closed dependency digests before completing the unit; unresolved disagreements
become `blocked-errata`.

- [ ] 4.2.1 Populate and independently review chapter 00 — inventory + review evidence
- [ ] 4.2.2 Populate and independently review chapter 01 — inventory + review evidence
- [ ] 4.2.3 Populate and independently review chapter 02 — inventory + review evidence
- [ ] 4.2.4 Populate and independently review chapter 03 — inventory + review evidence
- [ ] 4.2.5 Populate and independently review chapter 04 — inventory + review evidence
- [ ] 4.2.6 Populate and independently review chapter 05 — inventory + review evidence
- [ ] 4.2.7 Populate and independently review chapter 06 — inventory + review evidence
- [ ] 4.2.8 Populate and independently review chapter 07 — inventory + review evidence
- [ ] 4.2.9 Populate and independently review chapter 08 — inventory + review evidence
- [ ] 4.2.10 Populate and independently review chapter 09 — inventory + review evidence
- [ ] 4.2.11 Populate and independently review chapter 10 — inventory + review evidence
- [ ] 4.2.12 Populate and independently review chapter 11 — inventory + review evidence
- [ ] 4.2.13 Populate and independently review chapter 12 — inventory + review evidence
- [ ] 4.2.14 Populate and independently review chapter 13 — inventory + review evidence
- [ ] 4.2.15 Populate and independently review chapter 14 — inventory + review evidence
- [ ] 4.2.16 Populate and independently review chapter 15 — inventory + review evidence
- [ ] 4.2.17 Populate and independently review normative grammar — inventory + review evidence
- [ ] 4.2.18 Populate and independently review C64 target projections — inventory + review evidence
- [ ] 4.2.19 Classify and independently review contextual/other-target sources, conflicts and feature-index reconciliation — inventory + review evidence

### Step 4.3: Implementation tests and hardening

**Reference**: `07` ST-32 · AR-P1, AR-P12

- [ ] 4.3.1 Run an independent aggregate review of canonical ownership, cross-chapter duplicates, conflicts and target projection; make ST-32 green; enforce readiness branch coverage; run Prettier/full verify and confirm `spec/` clean — `packages/readiness/src/inventory.impl.test.ts`, `readiness/reviews/compiler-readiness-v1-review.json`

**Deliverables:** complete source classification; zero undisposed included spans; stable C64
denominator with genesis-anchored identity ledger; visible other-target children; declared
handler/capability contracts that render deterministically in memory; unit/dependency-keyed
semantic-review evidence plus an aggregate review keyed to the complete inventory.

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 5: Projection, version evolution and closeout

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: data/migration; security/resource safety; maintainability

### Step 5.1: Specification tests

**Reference**: `03-04` §Commands–§Version dispatch · AR-P3, AR-P7, AR-P10, AR-P11

- [ ] 5.1.1 [spec-author] Write ST-27–ST-29 projection/freshness tests — `packages/readiness/src/projection.spec.test.ts`
- [ ] 5.1.2 [spec-author] Write ST-30–ST-31 versioning/atomic-failure tests and ST-35 aggregate command test — `packages/readiness/src/versioning.spec.test.ts`, `readiness-command.spec.test.ts`
- [ ] 5.1.3 Run Phase 5 specification tests and record genuine red failures — targeted readiness Vitest

### Step 5.2: Implementation

**Reference**: `03-04` §Markdown projection–§Version dispatch · AR-P3, AR-P10, AR-P11

- [ ] 5.2.1 Implement safe deterministic Markdown projection and compose render-first generation of both explicit outputs — `packages/readiness/src/projection.ts`, `declaration-generator.ts`
- [ ] 5.2.2 Implement exact version dispatch, migration registry and invalidation model — `packages/readiness/src/versioning.ts`
- [ ] 5.2.3 Implement one PID/token-owned generation lock held from authoritative reread through verified dual-output replacement, conservative dead-owner quarantine/reclamation, invocation-owned exclusive temporary files and injected failure/crash seams — `packages/readiness/src/atomic-writer.ts`, `generation-lock.ts`
- [ ] 5.2.4 Implement check/generate CLI orchestration and make ST-27–ST-31 plus ST-35 green — `packages/readiness/src/cli.ts`, `readiness-command.spec.test.ts`
- [ ] 5.2.5 Generate and review both committed projections and authority README — `packages/readiness/src/generated/declarations.ts`, `readiness/generated/compiler-readiness.md`, `readiness/README.md`

### Step 5.3: Implementation tests and hardening

**Reference**: `07` ST-27–ST-31, ST-35 · AR-P10–AR-P12

- [ ] 5.3.1 Add projection/version/identity-chain/generation-lock internals plus a subprocess crash-after-first-rename repair test; enforce readiness branch coverage, run `yarn readiness:check`, Prettier/full verify, deferral-expiry review and final `spec/` freeze check — `projection.impl.test.ts`, `versioning.impl.test.ts`, `identity-ledger.impl.test.ts`, `atomic-writer.impl.test.ts`
- [ ] 5.3.2 Record implementation/verification evidence, update RD-01 closeout and synchronize roadmaps — CodeOps traceability and roadmap artifacts

**Deliverables:** byte-stable safe projections; trust gate that preserves tracked and authority
artifacts; explicit generator; strict version dispatcher; proven concurrent failure-atomic
migration seam; RD closeout evidence.

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

1. All 62 tasks are verified.
2. RD-01 AC-1–AC-18 pass through 32 requirements-derived cases (ST-1–ST-35, excluding
   process/implementation-only ST-7/ST-9/ST-33/ST-34 and including ST-18a).
3. The complete C64 v3.0 denominator validates with zero undisposed included fragments.
4. Every blocking ambiguity/unbound declaration remains visible as a typed blocker.
5. `yarn readiness:check` is deterministic and does not modify tracked, authoritative,
   conformance, review-evidence or generated artifacts.
6. Generated TypeScript declarations and Markdown are fresh, complete and safe.
7. The full project verify passes with no new warnings/errors.
8. `spec/` remains byte-for-byte untouched.
9. Deferral-expiry review finds no orphaned downstream owner.
10. Current per-unit and aggregate independent semantic-review evidence exists before closeout.
11. CodeOps implementation and verification evidence is recorded before roadmap completion.
