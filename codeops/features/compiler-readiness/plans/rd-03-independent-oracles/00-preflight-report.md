# Preflight Report: RD-03 Independent Semantic, Diagnostic and Metamorphic Oracles Plan

> **Status**: ❌ PREFLIGHT BLOCKED — 1 critical and 15 major findings unresolved
> **Iteration**: 1 (first scan)
> **Artifact**: Full implementation plan at
> `codeops/features/compiler-readiness/plans/rd-03-independent-oracles/`
> **Artifact Revision**: git tree `cb208855a2a843511e8db349987a4156ce59659e`
> **Codebase Grounded**: 153 readiness source/test files inventoried; 37 material
> source/test/config/authority references verified
> **Mode**: Auto-design
> **Root Invocation ID**: `compiler-readiness-rd03-plan-preflight-20260727-01`
> **Policy Version**: 1
> **Last Updated**: 2026-07-27

> **SAME-SESSION REVIEW:** This plan was created in the same logical session recovered after the
> workstation crash. Five independent clustered auditors and one blind design challenger were used
> to reduce same-agent bias.

## Audit Scope

- **Audit target:** the 11 committed Markdown documents in
  `plans/rd-03-independent-oracles/`, excluding this report
- **Context only:** compiler-readiness RD-03 and its requirements preflight, traceability,
  RD-01/RD-02 artifacts, frozen specification, `packages/readiness`, readiness authority JSON,
  repository manifests/configuration, and project instructions
- **Authorized modification set:** this permanent report only. The user authorized auto-design
  rulings and a local report commit, but did not authorize applying plan corrections.
- **Applicable domain lenses:** compiler and language; distributed and concurrent; data and
  migration
- **Inapplicable domain lenses:** web application; financial system

## Codebase Context Summary

**Tech stack:** strict TypeScript ESM on Node 22, Yarn workspaces, Turborepo, Vitest, ESLint.

**Architecture:** RD-01 owns the inventory and publication schemas. RD-02 owns the closed
scalar/memory generator IR, nine reviewed modeled rules, campaign/replay identities,
freshness-gated bindings, a seven-member publication, and atomic pointer selection. RD-03 plans
four oracle façades plus one semantic-relation transform without importing compiler packages.

**Key files examined:** `generator-ir.ts`, `generator-ir-validator.ts`,
`modeled-generator-model.ts`, `modeled-generator-facts.ts`, `case-identity.ts`,
`canonical-identity.ts`, `binding-model.ts`, `binding-validator.ts`,
`publication-candidates.ts`, `binding-publication.ts`, `publication-resolver.ts`,
`publication-pointer.ts`, `publication-model.ts`, `publication-conformance-v1.ts`,
`review-evidence.ts`, current authority/review/publication JSON, existing immutable publication
specification tests, and relevant frozen type/constant rules.

**Key observations:**

- RD-02 case identity hashes campaign digest, generation path, and ordinal; it is not a case-content
  identity.
- The IR validator accepts same-signed mixed-width promotion and also admits a memory-read constant
  initializer that the frozen language forbids.
- The selected resolver stores authority in an opaque snapshot but exposes raw handler callables.
- The current preparation profile and immutable specification prove a four-handler no-pointer
  bootstrap; RD-03 requires an incremental four-carried-plus-five-promoted transaction.
- Selected release resolution structurally parses semantic review bytes but does not recompute and
  revalidate their acceptance/freshness.

**Deterministic checks:** CodeOps graph validation, the `audit` gate, and the `plan` gate are
structurally READY; all plan links resolve; `spec/` is clean. Structural readiness does not
supersede the semantic blockers below.

## Summary by Dimension

| # | Dimension | Findings | Highest severity |
|---|---|---:|---|
| 1 | Ambiguities | 1 | 🟡 Minor |
| 2 | Implicit Assumptions | 4 | 🟠 Major |
| 3 | Logical Contradictions | 5 | 🔴 Critical |
| 4 | Completeness Gaps | 9 | 🔴 Critical |
| 5 | Dependency Issues | 4 | 🟠 Major |
| 6 | Feasibility Concerns | 2 | 🟠 Major |
| 7 | Testability | 7 | 🟠 Major |
| 8 | Security Blind Spots | 2 | 🔴 Critical |
| 9 | Edge Cases | 5 | 🟠 Major |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 5 | 🟠 Major |
| 12 | Consistency | 6 | 🔴 Critical |
| 13 | Codebase Alignment | 9 | 🔴 Critical |

## Summary by Severity

| Severity | Count | Decision state | Fix state |
|---|---:|---|---|
| 🔴 Critical | 1 | Auto-design ruling recorded | Unresolved |
| 🟠 Major | 15 | Auto-design rulings recorded | Unresolved |
| 🟡 Minor | 1 | Auto-design ruling recorded | Unresolved |
| 🔵 Observation | 0 | — | — |

## Findings

### PF-001: Published invocation does not bind accepted diagnostic authority 🔴 CRITICAL

**Dimensions:** Security Blind Spots, Completeness, Consistency, Codebase Alignment
**Location:** `03-01-oracle-contracts-authority.md:85-92`;
`03-05-atomic-publication.md:24-30`
**Codebase Evidence:** `packages/readiness/src/binding-model.ts:19-20,39-51`;
`packages/readiness/src/publication-resolver.ts:151-154,424-428`

**Problem:** An accepted raw handler can be invoked with a separately constructed, structurally
valid `OracleSuite` containing unreviewed diagnostic values. The transform has no suite/snapshot
input at all. Recording the substituted digest makes the mismatch visible but does not make it
accepted authority, contradicting the no-mixed-generation guarantee.

**Selected resolution — BEST:** Add a resolver-owned, snapshot-bound published-evaluation context
that supplies the exact reviewed oracle suite and selected participant metadata internally. Raw
source-authoring suites remain test capabilities, not authoritative invocation inputs.

**Rejected alternatives:** Closing each callable over source bytes cannot prove accepted-review
state; a caller-supplied publication suite retains substitution risk and a wider public surface.
**Strongest counterargument:** The orchestration context couples evaluation to publication.
**Authority:** AI — delegated by `--auto-design`; eligible internal authority/API mechanism within
approved behavior.
**Confidence:** High. **Hardening:** challenger converged.
**Policy / invocation:** version 1;
`compiler-readiness-rd03-plan-preflight-20260727-01`.
**Reopen trigger:** a release-native immutable authority member supersedes source-closure
reconstruction.
**Fix state:** Not applied; blocks execution.

### PF-002: Source provenance and transformed content identity are not implementable 🟠 MAJOR

**Dimensions:** Implicit Assumptions, Completeness, Dependency, Codebase Alignment
**Location:** `03-01-oracle-contracts-authority.md:95-120`;
`03-03-semantic-relations.md:35-51`; `03-04-identity-mutation.md:27-58`
**Codebase Evidence:** `packages/readiness/src/case-identity.ts:71-80,474-534`;
`packages/readiness/src/generate-case.ts:220-248`

**Problem:** A digest plus `GeneratedModeledCase` cannot verify RD-02 identity because its preimage
is campaign/path/ordinal, not case content. A transformed case has no RD-02 coordinates, so the
claimed “RD-02-compatible case-content identity” does not exist.

**Selected resolution — BEST:** Carry complete RD-02 replay provenance and verify/regenerate the
source case, while adding separate domain-separated canonical content digests for both source and
transformed cases. Bind provenance and both content digests into evaluation identity.

**Rejected alternatives:** Content digests alone do not prove RD-02 provenance; assigning synthetic
campaign coordinates misrepresents transformed cases as generated campaign members.
**Strongest counterargument:** Dual provenance/content identities add debugging and migration
complexity.
**Authority:** AI — delegated by `--auto-design`; eligible identity mechanism.
**Confidence:** High. **Hardening:** challenger added the dual-identity hybrid and converged.
**Reopen trigger:** RD-02 adopts a canonical case-content identity.
**Fix state:** Not applied; blocks execution.

### PF-003: The public result cannot carry revision-complete evaluation evidence 🟠 MAJOR

**Dimensions:** Completeness, Ordering, Consistency, Codebase Alignment
**Location:** `03-01-oracle-contracts-authority.md:124-151`;
`03-04-identity-mutation.md:48-55`; `99-execution-plan.md:105-140`
**Codebase Evidence:** `packages/readiness/src/implementation-revision.ts:419-430`;
`packages/readiness/src/publication-resolver.ts:383-456`

**Problem:** `OracleResultV1` contains no evaluation identity. Phase 4 asks handlers to bind final
participant revisions before Phase 5 creates those revisions and before a selected snapshot exists.

**Selected resolution — BEST:** Phase 4 implements and tests pure identity primitives only. A
published-snapshot evaluation API added after candidate selection returns a closed
`{ result, evaluationIdentity, sourceProvenance, contentIdentities }` evidence envelope.

**Rejected alternatives:** Embedding generated revision constants inside handlers creates revision
recursion and cannot prove same-snapshot participants.
**Strongest counterargument:** The API adds orchestration over simple callables.
**Authority:** AI — delegated by `--auto-design`; eligible internal API/ordering mechanism.
**Confidence:** High. **Hardening:** challenger converged.
**Reopen trigger:** binding resolution itself begins returning pre-bound evaluation capabilities.
**Fix state:** Not applied; blocks execution.

### PF-004: Evaluator rejection categories are not exact 🟡 MINOR

**Dimension:** Ambiguities
**Location:** `03-01-oracle-contracts-authority.md:153-160`;
`03-02-reference-evaluator.md:56-70`; `07-testing-strategy.md:43`

**Problem:** Unresolved entries/references, invalid parameter frames, unsupported constructs, and
inconsistent authority are allowed to be either failure or `oracle-unmodeled`; ST-14 cannot assert
one immutable result.

**Selected resolution — BEST:** Add an exhaustive classification table: malformed request →
`oracle.input.invalid`; inconsistent reviewed suite/model → authority failure; structurally valid
unsupported semantics → `oracle-unmodeled`; absent route → `oracle-unmodeled`.

**Rejected alternative:** Treating all cases as unmodeled hides broken accepted authority.
**Strongest counterargument:** More categories increase test volume.
**Authority:** AI — delegated by `--auto-design`; eligible failure-contract design.
**Confidence:** High. **Hardening:** in-context refutation did not change the ruling.
**Reopen trigger:** the public result taxonomy changes version.
**Fix state:** Not applied.

### PF-005: Mutation exhaustiveness does not cover every semantic path 🟠 MAJOR

**Dimensions:** Completeness, Testability, Consistency
**Location:** `00-ambiguity-register.md:29`;
`03-04-identity-mutation.md:84-107`; `07-testing-strategy.md:68-69`

**Problem:** The plan requires one row per operation ID, but AR-P17 requires every normalization and
semantic path. One broad operation ID can omit branches while still reporting zero survivors.

**Selected resolution — BEST:** Add a closed `pathId` registry and require an exact exhaustive join
over operation/path pairs. Source checks reject missing, extra, duplicate, or unreachable paths.

**Rejected alternative:** Defining operation IDs at branch granularity makes refactors rename the
public operation taxonomy and still leaves the granularity implicit.
**Strongest counterargument:** Stable path IDs create maintenance churn.
**Authority:** AI — delegated by `--auto-design`; eligible mutation-testing mechanism.
**Confidence:** High. **Hardening:** challenger converged.
**Reopen trigger:** automated structural mutation coverage replaces the explicit catalog.
**Fix state:** Not applied; blocks execution.

### PF-006: One diagnostic key conflates source and external-binding failures 🟠 MAJOR

**Dimensions:** Implicit Assumptions, Edge Cases, Codebase Alignment
**Location:** `03-01-oracle-contracts-authority.md:42-64`
**Codebase Evidence:** `packages/readiness/src/modeled-generator-facts.ts:192-224`;
`packages/readiness/src/modeled-generators.ts:351-403`;
`packages/readiness/src/case-generator.ts:307-418`

**Problem:** Const/literal/local invalid neighbors mutate source and expect compiler diagnostics,
while parameter spelling retains valid source and produces an invalid external parameter binding.
One `(ruleId, neighborId)` compiler-diagnostic record cannot truthfully represent both.

**Selected resolution — BEST:** Keep the diagnostic manifest restricted to compiler-invalid source
projections. Add a separate closed external binding-value rejection contract and route
parameter-binding invalid cases to it.

**Rejected alternative:** Adding spelling/kind to the diagnostic key still calls a non-compiler
binding failure a compiler diagnostic and mixes two authorities.
**Strongest counterargument:** A second rejection authority broadens the protocol.
**Authority:** AI — delegated by `--auto-design`; eligible internal authority separation.
**Confidence:** High. **Hardening:** challenger converged.
**Reopen trigger:** RD-02 stops generating parameter-binding invalid neighbors.
**Fix state:** Not applied; blocks execution.

### PF-007: Scalar semantics contradict mixed-width IR and frozen widening 🟠 MAJOR

**Dimensions:** Logical Contradictions, Codebase Alignment
**Location:** `03-02-reference-evaluator.md:36-49`
**Codebase Evidence:** `packages/readiness/src/generator-ir-validator.ts:588-655`;
`spec/02-type-system.md:125-144`

**Problem:** The plan says arithmetic and bitwise operands must have the same type. Current valid IR
and frozen semantics permit same-signed mixed widths and require sign/zero extension to the wider
type in either operand order.

**Selected resolution — BEST:** Specify same-signed widening before dispatch for arithmetic,
bitwise, and comparison operations; test both operand orders, all width pairs, result typing, and
signed/unsigned extension.

**Rejected alternative:** Narrowing the accepted IR would contradict RD-02 and the frozen language.
**Strongest counterargument:** Widening complicates evaluator normalization.
**Authority:** AI — delegated by `--auto-design`; eligible semantic implementation correction
within fixed language behavior.
**Confidence:** High. **Hardening:** challenger converged.
**Reopen trigger:** frozen promotion rules change.
**Fix state:** Not applied; blocks execution.

### PF-008: Structural IR validation can bless illegal constant initializers 🟠 MAJOR

**Dimensions:** Feasibility, Codebase Alignment
**Location:** `03-01-oracle-contracts-authority.md:114-122`;
`03-02-reference-evaluator.md:56-70`
**Codebase Evidence:** `packages/readiness/src/generator-ir-validator.ts:663-674,707-725`;
`spec/03-variables.md:93-103`

**Problem:** `validateGeneratorIr` accepts a memory read in a module constant initializer, while the
frozen language requires compile-time-constant expressions. The public oracle could model success
for illegal IR.

**Selected resolution — BEST:** Add an oracle semantic-closure validator that enforces
compile-time-constant purity and every evaluator prerequisite after structural validation, before
suite acceptance or evaluation. Record the RD-02 structural-validator gap as separately owned
corrective debt; do not silently broaden this plan into an RD-02 re-publication.

**Rejected alternative:** Strengthening and re-publishing RD-02 is the challenger’s globally
cleaner design, but it expands this audit target and invalidates the selected four-binding base
without user authorization.
**Strongest counterargument:** Two validation layers can drift and leave “valid IR” overloaded.
**Authority:** AI — delegated by `--auto-design`; eligible plan-local semantic-validation
mechanism, constrained by the fixed audit scope.
**Confidence:** Medium. **Hardening:** challenger diverged toward an RD-02 prerequisite; scope
reconciliation selected the plan-local validator and a reopenable debt.
**Reopen trigger:** the user expands scope to correct and re-publish RD-02 first.
**Fix state:** Not applied; blocks execution.

### PF-009: The immutable four-handler bootstrap path is not preserved 🟠 MAJOR

**Dimensions:** Dependency, Ordering, Compatibility, Codebase Alignment
**Location:** `03-05-atomic-publication.md:76-90`;
`07-testing-strategy.md:98-105`; `99-execution-plan.md:133-145`
**Codebase Evidence:** `packages/readiness/src/binding-publication.spec.test.ts:243-268,317-368`;
`packages/readiness/src/test-fixtures/unbound-publication-authority.ts:4-9,45-69`

**Problem:** Existing immutable tests remove the pointer and prove a fresh four-handler bootstrap.
The plan assumes an RD-02 selected base and a nine-handler target; changing the default profile
makes the full gate red.

**Selected resolution — BEST:** Preserve the legacy preparation wrapper unchanged. Add an explicit
incremental preparation API whose inputs name the selected base snapshot and exact target handler
set; use it only for four-carried-plus-five-promoted RD-03 publication.

**Rejected alternative:** Implicit branching on repository state obscures which profile is being
authorized and complicates replay.
**Strongest counterargument:** Two entrypoints increase compatibility burden.
**Authority:** AI — delegated by `--auto-design`; eligible backward-compatible API mechanism.
**Confidence:** High. **Hardening:** challenger added the explicit target-set refinement and
converged.
**Reopen trigger:** a versioned generic publication builder replaces both wrappers.
**Fix state:** Not applied; blocks execution.

### PF-010: Release resolution does not revalidate accepted semantic review 🟠 MAJOR

**Dimensions:** Completeness, Dependency, Compatibility, Codebase Alignment
**Location:** `03-05-atomic-publication.md:63-74,95-109`;
`07-testing-strategy.md:78-84`
**Codebase Evidence:** `packages/readiness/src/publication-resolver.ts:328-341,360-380`;
`packages/readiness/src/binding-publication.ts:607-614`

**Problem:** Publication validates accepted review before writing, but selected and historical
resolution later parse review JSON only structurally. Immutable bytes prove identity, not that the
records are accepted and fresh for recomputed units.

**Selected resolution — BEST:** Factor review-unit reconstruction and `validateReviewEvidence`
into release resolution. Recompute exact release-derived units/dependencies and reject stale,
rejected, missing, or extra evidence before creating `PublishedSnapshot`.

**Rejected alternative:** A new attestation structure inside the existing member duplicates the
review model without removing the need to recompute its dependencies.
**Strongest counterargument:** Resolution becomes more expensive.
**Authority:** AI — delegated by `--auto-design`; eligible integrity-validation mechanism.
**Confidence:** High. **Hardening:** challenger converged.
**Reopen trigger:** a release format stores independently verifiable signed attestations.
**Fix state:** Not applied; blocks execution.

### PF-011: Post-commit failure can lie about durable authority state 🟠 MAJOR

**Dimensions:** Logical Contradictions, Ordering, Edge Cases
**Location:** `03-05-atomic-publication.md:111-125`
**Codebase Evidence:** `packages/readiness/src/publication-pointer.ts:261-316`;
`packages/readiness/src/binding-publication.impl.test.ts:206-246`

**Problem:** After atomic rename, a fault can make the transaction return failure although the new
publication is selected. Blind retry or rollback behavior is undefined and conflicts with the
requirement that a failed promotion preserve the previous authority.

**Selected resolution — BEST:** Reconcile after every post-rename fault: re-read and fully resolve
the pointer; return committed success with the exact digest if the new release is selected, ordinary
failure if the old release remains selected, and a closed `commit-indeterminate` result with
recovery data only when reconciliation itself is impossible.

**Rejected alternatives:** Always reporting failure is false after commit; unconditional success
can conceal an unreadable/indeterminate pointer.
**Strongest counterargument:** `commit-indeterminate` expands caller recovery logic.
**Authority:** AI — delegated by `--auto-design`; eligible consistency/recovery mechanism without
changing the approved atomicity goal.
**Confidence:** High. **Hardening:** challenger supplied the reconciliation hybrid and converged.
**Reopen trigger:** the pointer writer can guarantee and prove no fallible step after commit.
**Fix state:** Not applied; blocks execution.

### PF-012: Concurrent mutation-context isolation is untested 🟠 MAJOR

**Dimensions:** Testability, Edge Cases, Concurrency
**Location:** `03-04-identity-mutation.md:91-98`;
`07-testing-strategy.md:68-70,108`
**Codebase Evidence:** `packages/readiness/src/publication-conformance-v1.ts:1,77,97-106`

**Problem:** Serial mutation tests cannot detect a global/current-mutant implementation leaking
into a concurrent baseline or another mutant, despite the contract promising isolation.

**Selected resolution — BEST:** Use `AsyncLocalStorage` for mutation context and add an immutable,
barrier-controlled specification test interleaving baseline plus two distinct mutants across
awaited boundaries. Serial catalog execution may remain for deterministic throughput.

**Rejected alternative:** Exclusive single-runner locking weakens the approved concurrent
isolation contract.
**Strongest counterargument:** Every production dispatch must consistently enter the async context.
**Authority:** AI — delegated by `--auto-design`; eligible concurrency/testing mechanism.
**Confidence:** High. **Hardening:** challenger converged.
**Reopen trigger:** mutation execution becomes strictly process-isolated.
**Fix state:** Not applied; blocks execution.

### PF-013: Atomic publication is not tested with concurrent readers 🟠 MAJOR

**Dimensions:** Testability, Edge Cases, Concurrency, Compatibility
**Location:** `03-05-atomic-publication.md:111-125`;
`07-testing-strategy.md:83,104-105`
**Codebase Evidence:** `packages/readiness/src/publication-pointer.ts:294-305`;
`packages/readiness/src/publication-resolver.ts:396-428`

**Problem:** Crash-before/after tests do not prove that a resolver observing the four-to-nine
transition never combines an old pointer with new-profile assumptions or vice versa.

**Selected resolution — BEST:** Add deterministic barrier-controlled worker-thread readers on both
sides of pointer replacement. Every completed resolution must be exactly the old four-row or new
nine-row snapshot; no mixed successful snapshot is permitted.

**Rejected alternative:** The challenger preferred child-process readers, but the approved plan
explicitly excludes subprocesses. Uncontrolled reader loops are nondeterministic.
**Strongest counterargument:** Worker fixtures add coordination complexity and do not model process
startup differences.
**Authority:** AI — delegated by `--auto-design`; eligible concurrency test within the no-subprocess
constraint.
**Confidence:** Medium. **Hardening:** challenger diverged on isolation mechanism; the governing
non-change constraint selected workers.
**Reopen trigger:** subprocess scope is explicitly authorized or OS-specific worker behavior is
shown insufficient.
**Fix state:** Not applied; blocks execution.

### PF-014: Synchronous mutant execution cannot enforce timeout classification 🟠 MAJOR

**Dimensions:** Feasibility, Testability, Edge Cases
**Location:** `03-02-reference-evaluator.md:131-138`;
`03-04-identity-mutation.md:120-123`; `99-execution-plan.md:114-119`
**Codebase Evidence:** `packages/readiness/src/binding-model.ts:19-20`

**Problem:** An in-process nonterminating synchronous mutant blocks the event loop, so a timer
cannot convert it into the promised report failure.

**Selected resolution — BEST:** Run each mutant vector in a bounded `node:worker_threads` worker,
addressed by stable mutant/vector IDs, and terminate it at the deadline. Timeout, startup, crash,
and protocol failure remain harness failures rather than kills.

**Rejected alternative:** Declaring the closed mutant set terminating makes ST-31’s timeout
contract vacuous and cannot contain a regression that hangs.
**Strongest counterargument:** Worker module loading and messaging add cost.
**Authority:** AI — delegated by `--auto-design`; eligible failure-containment mechanism.
**Confidence:** High. **Hardening:** challenger converged.
**Reopen trigger:** a preemptible in-process execution runtime becomes available.
**Fix state:** Not applied; blocks execution.

### PF-015: Phase 6 mutates a Phase 5 immutable specification file 🟠 MAJOR

**Dimensions:** Logical Contradictions, Testability, Ordering
**Location:** `07-testing-strategy.md:8-10,19,95-100`;
`99-execution-plan.md:131-140,152-158`

**Problem:** Phase 5 authors ST-35–ST-38 in `oracle-publication.spec.test.ts`; Phase 6 then adds
ST-39–ST-40 to the same file after exposure to publication implementation.

**Selected resolution — BEST:** Put ST-39–ST-40 in a separate final-publication specification file
authored implementation-blind before Phase 6 integration starts; never reopen the Phase 5 file.

**Rejected alternative:** Authoring ST-35–ST-40 together before Phase 5 is sound but delays the
specific final-integration RED gate and mixes candidate staging with pointer commit.
**Strongest counterargument:** Splitting one publication contract across two files fragments
navigation.
**Authority:** AI — delegated by `--auto-design`; eligible specification-test sequencing.
**Confidence:** High. **Hardening:** challenger converged.
**Reopen trigger:** all publication specification cases move before any publication implementation.
**Fix state:** Not applied; blocks execution.

### PF-016: ST-24 requires a fault seam before that seam exists 🟠 MAJOR

**Dimensions:** Ordering, Testability
**Location:** `07-testing-strategy.md:58`;
`99-execution-plan.md:89-98,110-119`;
`03-04-identity-mutation.md:89-98`

**Problem:** Phase 3 must make injected precondition/rewrite/comparator faults GREEN, but the only
production-path conformance seam is scheduled in Phase 4.

**Selected resolution — BEST:** Introduce the relation-scoped production fault seam before Phase 3
ST-24 GREEN. Phase 4 generalizes it into the exhaustive catalog and runner without changing the
immutable relation specification.

**Rejected alternative:** Moving ST-24 to Phase 4 weakens Phase 3’s falsifiable relation
deliverable and delays detection of self-confirming comparators.
**Strongest counterargument:** Mutation infrastructure is split across phases.
**Authority:** AI — delegated by `--auto-design`; eligible implementation sequencing.
**Confidence:** High. **Hardening:** challenger converged.
**Reopen trigger:** relations are implemented in the same phase as the complete mutation runner.
**Fix state:** Not applied; blocks execution.

### PF-017: Package-boundary acceptance lacks immutable specification coverage 🟠 MAJOR

**Dimensions:** Completeness, Testability, Security
**Location:** `00-ambiguity-register.md:32`;
`07-testing-strategy.md:86-100`; `99-execution-plan.md:68-78`
**Codebase Evidence:** `packages/readiness/src/dependency-boundary.impl.test.ts:125-151`

**Problem:** AR-P20 requires immutable specification coverage, but the boundary gate is planned
only as an implementation test after evaluator work begins. Existing coverage does not prove
relative-path escape or non-literal dynamic-import rejection.

**Selected resolution — BEST:** Author `oracle-boundary.spec.test.ts` before Phase 2 production
work with positive discovery and seeded forbidden-import fixtures. Add the same invariant to
`readiness:source-check` as defense in depth.

**Rejected alternative:** A source-check-only rule remains mutable implementation evidence and
does not satisfy the specification-first contract.
**Strongest counterargument:** AST/source fixtures can be brittle as module syntax evolves.
**Authority:** AI — delegated by `--auto-design`; eligible testing/security mechanism.
**Confidence:** High. **Hardening:** challenger converged.
**Reopen trigger:** a repository-wide immutable boundary oracle supersedes the package-local test.
**Fix state:** Not applied; blocks execution.

## Adversarial Checklist

| Question | Result |
|---|---|
| Which creation assumption was most likely self-confirmed? | That a selected raw callable plus a caller suite constituted one accepted authority; PF-001 disproves it. |
| Which external convention needed direct checking? | Frozen widening and constant-expression rules were checked against `spec/02-type-system.md` and `spec/03-variables.md`. |
| What would a dissenting compiler/reliability expert flag? | Identity provenance, review revalidation on reads, false-failure-after-commit, and unfalsifiable concurrency/timeout claims; all are findings. |

## Verdict

❌ **PREFLIGHT BLOCKED.** Auto-design selected technical remediations for all 17 findings, but the
plan itself was not changed because this invocation did not authorize applying corrections. The
critical authority-substitution flaw and all 15 major findings must be corrected and verified in a
bounded Iteration 2 before the roadmap may advance to Plan Preflighted or `exec-plan` may begin.

The compiler/language and publication authority are architecturally foundational. A human compiler
or formal-semantics reviewer should review the corrected plan in addition to the automated re-scan.
