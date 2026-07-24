# Execution Plan: RD-01 Specification Inventory

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-24 08:15
> **Progress**: 59/69 tasks (86%)
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
| 4R | Semantic inventory remediation | 7 |
| 5 | Projection, version evolution and closeout | 10 |

**Total: 69 tasks across 6 phases**

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

> **Phase baseline tree**: cb81d6a1f411f64fa8b521d56eee487da83210c7
> **Lenses**: compiler/language; data/migration; correctness

### Step 3.1: Specification tests

**Reference**: `03-03` §Validation pipeline · AR-P7–AR-P9

- [x] 3.1.1 [spec-author] Write ST-15–ST-19 plus ST-18a ledger/conflict/identity tests — `packages/readiness/src/ledger-validator.spec.test.ts`, `conflict-validator.spec.test.ts` ✅ (completed: 2026-07-24 01:06)
- [x] 3.1.2 [spec-author] Write ST-20–ST-22 declaration/capability/blocker tests — `packages/readiness/src/declaration-validator.spec.test.ts` ✅ (completed: 2026-07-24 01:06)
- [x] 3.1.3 [spec-author] Write ST-23–ST-26 projection/graph tests — `packages/readiness/src/rule-graph.spec.test.ts` ✅ (completed: 2026-07-24 01:06)
- [x] 3.1.4 Run Phase 3 specification tests and record genuine red failures — targeted readiness Vitest: 4 files / 38 tests failed because all Phase-3 exports were absent ✅ (completed: 2026-07-24 01:06)

### Step 3.2: Implementation

**Reference**: `03-03` §Ownership–§Blocking reasons · AR-P7–AR-P9

- [x] 3.2.1 Implement ledger totality, decomposition, genesis-anchored hash-chained identity allocation/retirement and lineage validation — `packages/readiness/src/ledger-validator.ts`, `identity-ledger.ts`, `readiness/inventory/rule-identities-v1.jsonl` ✅ (completed: 2026-07-24 01:15)
- [x] 3.2.2 Implement reviewed conflict classification and canonical aggregates — `packages/readiness/src/conflict-validator.ts` ✅ (completed: 2026-07-24 01:15)
- [x] 3.2.3 Implement handler/capability declaration lifecycle, typed blocker reasons and a deterministic bounded declaration generator with a hand-written stable barrel seam; exercise only fixture/in-memory output — `packages/readiness/src/declaration-validator.ts`, `blocking-reasons.ts`, `declaration-generator.ts`, `index.ts` ✅ (completed: 2026-07-24 01:15)
- [x] 3.2.4 Implement target projection, prerequisite rewriting, DAG and stable ordering — `packages/readiness/src/rule-graph.ts` ✅ (completed: 2026-07-24 01:15)
- [x] 3.2.5 Compose prerequisite-gated semantic passes, review-evidence validation and make ST-15–ST-26 plus ST-18a green — `packages/readiness/src/semantic-validator.ts`, `review-evidence.ts` ✅ (completed: 2026-07-24 01:15)

### Step 3.3: Implementation tests and hardening

**Reference**: `07` ST-15–ST-26 · AR-P7

- [x] 3.3.1 Add graph/index/cycle, declaration-generation and review-evidence internals; enforce readiness branch coverage; run Prettier/full verify and confirm `spec/` clean — `semantic-validator.impl.test.ts`, `declaration-generator.impl.test.ts`, `review-evidence.impl.test.ts` ✅ (completed: 2026-07-24 01:22)

**Deliverables:** exhaustive ledger semantics; conflict aggregates; typed declaration contracts,
deterministic in-memory declaration generator and blockers; five-target graph projection; stable
topological order.

### Phase 3 quality review

| Finding | Severity | Ruling |
|---|---|---|
| RV-301 / RV-SEM-301 | MAJOR | Fixed — bind mapped/decomposed ownership and exact rule union to resolved source fragments |
| RV-302 / RV-SEM-303 / RV-SEM-304 | MAJOR | Fixed — enforce connected replacement topology and exact split/merge/supersedes lineage semantics |
| RV-303 / RV-SEM-302 / SA-304 | MAJOR | Fixed — resolve conflict and ledger citations exactly against source context |
| RV-304 | MAJOR | Fixed — require closed accepted semantic-review evidence through AR-P20/AR-P21 |
| RV-305 / RV-SEM-305 / RV-SEM-306 | MAJOR | Fixed after re-review rejection — require complete universal groups and reject all cross-target prerequisites |
| SA-301 | MAJOR | Fixed — scan identity framing/event bounds before decoding or splitting |
| SA-302 | MAJOR | Fixed — use linear ledger duplicate accounting |
| SA-303 | MAJOR | Fixed — use iterative graph analysis and a lexical heap, proven at maximum rule count |
| SA-305 / SA-306 | MINOR | Fixed — use structured citation tuples and ordinal authority ordering |
| RV-306 | MAJOR | Fixed after re-review rejection — exclude recomputed display lines from citation identity |
| RV-307 | MAJOR | Fixed after re-review rejection — close required dependency-digest keys per review unit |

The protocol's single re-review was completed. Its three remaining findings were corrected and
verified; no third review was dispatched.

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 4: Complete source ledger and C64 inventory

> **Phase baseline tree**: fc0fb1815f65b8b99ae98827468d7071bb446472
> **Lenses**: compiler/language; data/migration; semantic completeness

### Step 4.1: Specification tests

**Reference**: `03-04` §Inventory population and closeout · AR-P1, AR-P8, AR-P9

- [x] 4.1.1 [spec-author] Write ST-32 requirements-derived real-inventory completeness tests — `packages/readiness/src/inventory.spec.test.ts` ✅ (completed: 2026-07-24 01:42)
- [x] 4.1.2 Run the real-inventory tests and record missing-ledger/rule failures — targeted readiness Vitest: 1 file / 2 tests failed on undisposed fragments and semantic totality ✅ (completed: 2026-07-24 01:42)

### Step 4.2: Chapter-granular inventory and independent review

**Reference**: RD-01 Must Haves and AC-3–AC-14 · `03-03` · AR-P1, AR-P8, AR-P9

Every unit below requires separate author and compiler/language reviewer ownership. The reviewer
checks every disposition, decomposition, applicability choice and evidence set. Run ledger and
in-memory declaration-render determinism checks, then record evidence keyed to the unit's canonical
semantic digest and closed dependency digests before completing the unit; unresolved disagreements
become `blocked-errata`.

- [x] 4.2.1 Populate and independently review chapter 00 — inventory + review evidence ✅ (verified: 2026-07-24)
- [x] 4.2.2 Populate and independently review chapter 01 — inventory + review evidence ✅ (verified: 2026-07-24)
- [x] 4.2.3 Populate and independently review chapter 02 — inventory + review evidence ✅ (verified: 2026-07-24)
- [x] 4.2.4 Populate and independently review chapter 03 — inventory + review evidence ✅ (verified: 2026-07-24)
- [x] 4.2.5 Populate and independently review chapter 04 — inventory + review evidence ✅ (verified: 2026-07-24)
- [x] 4.2.6 Populate and independently review chapter 05 — inventory + review evidence ✅ (verified: 2026-07-24)
- [x] 4.2.7 Populate and independently review chapter 06 — inventory + review evidence ✅ (verified: 2026-07-24)
- [x] 4.2.8 Populate and independently review chapter 07 — inventory + review evidence ✅ (verified: 2026-07-24)
- [x] 4.2.9 Populate and independently review chapter 08 — inventory + review evidence ✅ (verified: 2026-07-24)
- [x] 4.2.10 Populate and independently review chapter 09 — inventory + review evidence ✅ (verified: 2026-07-24)
- [x] 4.2.11 Populate and independently review chapter 10 — inventory + review evidence ✅ (verified: 2026-07-24)
- [x] 4.2.12 Populate and independently review chapter 11 — inventory + review evidence ✅ (verified: 2026-07-24)
- [x] 4.2.13 Populate and independently review chapter 12 — inventory + review evidence ✅ (verified: 2026-07-24)
- [x] 4.2.14 Populate and independently review chapter 13 — inventory + review evidence ✅ (verified: 2026-07-24)
- [x] 4.2.15 Populate and independently review chapter 14 — inventory + review evidence ✅ (verified: 2026-07-24)
- [x] 4.2.16 Populate and independently review chapter 15 — inventory + review evidence ✅ (verified: 2026-07-24)
- [x] 4.2.17 Populate and independently review normative grammar — inventory + review evidence ✅ (verified: 2026-07-24)
- [x] 4.2.18 Populate and independently review C64 target projections — inventory + review evidence ✅ (verified: 2026-07-24)
- [x] 4.2.19 Classify and independently review contextual/other-target sources, conflicts and feature-index reconciliation — inventory + review evidence ✅ (verified: 2026-07-24)

### Step 4.3: Implementation tests and hardening

**Reference**: `07` ST-32 · AR-P1, AR-P12

- [x] 4.3.1 Run an independent aggregate review of canonical ownership, cross-chapter duplicates, conflicts and target projection; make ST-32 green; enforce readiness branch coverage; run Prettier/full verify and confirm `spec/` clean — `packages/readiness/src/inventory.impl.test.ts`, `readiness/reviews/compiler-readiness-v1-review.json` ✅ (verified: 2026-07-24 — 95.23% branches; full verify exit 0)

**Deliverables:** complete source classification; zero undisposed included spans; stable C64
denominator with genesis-anchored identity ledger; visible other-target children; declared
handler/capability contracts that render deterministically in memory; unit/dependency-keyed
semantic-review evidence plus an aggregate review keyed to the complete inventory.

### Phase 4 quality review

The initial independent compiler/language and correctness reviews rejected the mechanically
complete draft. Auto-design repaired example/rationale inflation, error/warning polarity,
capability-specific handlers, semantic identity slugs, compound paragraph decomposition, false
grammar equivalence, contextual isolation and target projection. The protocol's single re-review
still rejected the phase; no third review was dispatched and no review-evidence acceptance record
was created.

| Finding | Severity | Re-review ruling |
|---|---|---|
| RV-401 | MAJOR | Rejected — structural chapter-index/registry/rationale prose remains mapped in chapters 00–08 |
| RV-402 | MAJOR | Rejected — order-derived `variant-N` collisions and compound mixed-polarity table rows remain |
| RV-403 | MAJOR | Rejected — several output, ABI, placement and instruction-cycle rules still lack ACME/VICE evidence |
| RV-404 | MAJOR | Rejected — grammar call-postfix ownership remains inconsistent between production comment and note |
| RV-405 | MAJOR | Rejected — chapter 10 prohibited-form row and chapter 13 mixed acceptance/error outcome retain positive polarity |
| RV-406 | MAJOR | Rejected — chapter 15 other-target rows remain mandatory C64 and incorrectly name VICE evidence |

The phase remains implemented-but-unverified at tasks 4.2.1–4.2.19. Phase 4 cannot advance to
4.3.1, commit or push without a new user-authorized review strategy because the configured
single-re-review budget is exhausted.

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 4R: Semantic inventory remediation

> **Phase baseline tree**: ff99b9eb3c68a8f4244fe9a8a8649c1472efbde4
> **Authorized**: 2026-07-24 — user-approved fresh remediation/review cycle
> **Lenses**: compiler/language; semantic completeness; data/migration

This phase repairs the six rejected Phase-4 finding groups against a fresh worktree baseline. It
does not waive or re-review the rejected Phase-4 diff; it produces a new remediation diff with its
own one-pass quality loop. When this phase verifies, it closes the implemented Phase-4 population
tasks and aggregate hardening task together.

- [x] 4R.1.1 [spec-author] Add requirements-derived regression assertions for structural-carrier exclusion, stable semantic IDs, polarity decomposition, evidence sufficiency and C64 applicability ✅ (completed: 2026-07-24 08:15)
- [x] 4R.1.2 Run the remediation specification assertions and record genuine red failures — targeted readiness Vitest: 3 remediation assertions failed on stable semantics, executable evidence and C64 applicability ✅ (completed: 2026-07-24 08:15)
- [x] 4R.2.1 Remove structural/navigation/rationale carriers and replace order-derived identity collisions with reviewed semantic identities ✅ (verified: 2026-07-24)
- [x] 4R.2.2 Decompose mixed-polarity table/paragraph outcomes and close grammar production-comment ownership ✅ (verified: 2026-07-24)
- [x] 4R.2.3 Correct capability-specific evidence and C64/other-target applicability ✅ (verified: 2026-07-24; residuals closed by T-01)
- [x] 4R.2.4 Produce current unit/dependency and aggregate independent-review evidence; make specification and implementation inventory tests green ✅ (completed: 2026-07-24)
- [x] 4R.3.1 Enforce readiness branch coverage; run declaration determinism, Prettier/full verify and confirm `spec/` clean; complete the fresh independent quality review ✅ (completed: 2026-07-24 — focused remediation accepted; 95.23% branches; full verify exit 0)

**Deliverables:** independently accepted semantic denominator, closed review evidence, verified
Phase-4 population tasks and one green auto-commit/push checkpoint.

### Phase 4R quality review

The fresh initial review found incomplete example/metadata filtering, polarity, executable-evidence
and identity repairs. Auto-design applied the eligible technical corrections. The single permitted
fix-diff re-review accepted chapters 00–02, 04, 09, 11–15, grammar, C64 projection and contextual
isolation, but rejected the phase on residual MAJOR findings; no third review was dispatched.

| Finding | Severity | Re-review ruling |
|---|---|---|
| RV-4R-101 | MAJOR | Rejected — four chapter-03 ROM-size rules and one chapter-07 zero-page cost rule remain frontend-only |
| RV-4R-102 | MAJOR | Rejected — six chapter-05 runtime/control-flow rules lack complete emulator evidence |
| RV-4R-103 | MAJOR | Rejected — chapter-06 struct/array return cells and eleven chapter-08 unsupported-platform cells remain positive despite `❌` |
| RV-4R-104 | MAJOR | Rejected — chapter-10 wildcard-import rejection remains positive |

The user authorized a separate narrowly scoped manual task after the Phase-4R review budget was
exhausted. T-01 corrected only the 24 explicitly rejected records, added focused assertions, and
passed one correctness re-review plus one semantic audit. The prior findings are resolved; no
broad inventory regeneration or review occurred in T-01.

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
