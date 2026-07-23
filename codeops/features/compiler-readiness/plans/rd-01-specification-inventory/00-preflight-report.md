# Preflight Report: RD-01 Specification Inventory Plan

> **Status**: ✅ PASSED — all 14 findings resolved
> **Iteration**: 3 (bounded final verification)
> **Previous Iterations**: Iteration 1 found 13 issues; Iteration 2 verified eight and exposed five
> residual/new major issues; Iteration 3 verified their fixes
> **Artifact**: Complete implementation plan at
> `codeops/features/compiler-readiness/plans/rd-01-specification-inventory/`
> **Artifact Content Hash**:
> `a9b09429aad70d8271d66867d52d9efec413128375fd8f3a29b77565a30311af`
> **Original Content Hash**:
> `cf190616aa6b8f39ec845137ef474de79a2fa409080f8360a4551abe51aaf1e6`
> **Codebase Grounded**: 10 plan documents, the owning RD, 18 representative source/spec/config
> files and 24 plan-to-repository references examined
> **Last Updated**: 2026-07-23
> **Mode**: Auto-design
> **Root Invocation IDs**: `compiler-readiness-rd01-preflight-20260723-01`,
> `compiler-readiness-rd01-preflight-20260723-02`

The audit target was the complete ten-document plan. The owning RD, ambiguity register, roadmap,
traceability graph, frozen specification, repository instructions, manifests, build configuration
and representative implementation/test patterns were context. The continuation authorized
application of the selected fixes within the plan target. No context document entered the
modification set.

## Iteration 2 and 3 Resolution Verification

| Finding | Final result | Verification |
|---|---|---|
| PF-001 | Resolved | Committed declaration publication is Phase 5-only; Phase 3 owns the in-memory generator and stable seam, while Phase 4 proves renderability |
| PF-002 | Resolved | ST-32 closes inventory in Phase 4; ST-35 owns complete projection freshness in Phase 5 |
| PF-003 | Resolved | Unit reviews use canonical unit/dependency digests; aggregate review separately keys to the complete inventory |
| PF-004 | Resolved | Byte/UTF-8 bounds precede parsing; visitor abort must be proven or the strict byte scanner is mandatory |
| PF-005 | Resolved | Fixed-genesis hash-chained identity ledger is anchored by the inventory head and tests truncation/reordering/reuse |
| PF-006 | Resolved | Plan-only fragmentation and review-process assertions moved to implementation/process gates |
| PF-007 | Resolved | ST-18a directly tests duplicate rule IDs across records |
| PF-008 | Resolved | Phase 4 now has one durable unit per chapter plus grammar, C64 and contextual reconciliation |
| PF-009 | Resolved | Dependency boundary consistently means compiler/toolchain independence with allowlisted validation libraries |
| PF-010 | Resolved | Test file map and execution tasks agree |
| PF-011 | Resolved | Temporary files are invocation-owned and concurrent-writer behavior is covered |
| PF-012 | Resolved | Non-mutation excludes ignored build outputs and protects tracked/authority artifacts |
| PF-013 | Resolved | Vitest coverage provider, command, thresholds and phase gates are explicit |
| PF-014 | Resolved | PID/token lock spans reread through pair verification; dead-owner crash recovery and shared generation digests are tested |

Iteration 2 re-scanned all 13 dimensions through five independent clusters. Iteration 3 was bounded
to the five residual/new major roots and their direct dependency surface. No unresolved finding or
new independent root remains.

## Codebase Context Summary

**Tech stack:** Node 22, strict TypeScript/ESM, Yarn 1 workspaces, Turborepo, Vitest, ESLint and
Prettier.

**Architecture:** Ten `packages/*` workspaces implement a staged compiler/toolchain. Root TypeScript
project references are explicit. The plan adds an eleventh private, compiler-independent readiness
workspace and a root machine-readable authority directory. No readiness implementation exists yet.

**Domain lenses:** Compiler/language and data/migration, plus universal security and resource-safety
checks for hostile repository data and filesystem paths.

**Key files examined:** `AGENTS.md`, `package.json`, `tsconfig.json`, `tsconfig.base.json`,
`turbo.json`, `vitest.config.ts`, `packages/config/src/parse.ts`, representative workspace
manifests/configuration, `spec/build-plan.md`, `spec/00-introduction.md`,
`spec/00-feature-index.md`, `spec/grammar.ebnf.md` and `spec/appendix-c64.md`.

**Reference verification:** Proposed `packages/readiness/` and root `readiness/` paths are correctly
identified as new. Workspace discovery, explicit TS references, test naming, build outputs,
`jsonc-parser` availability, transitive Ajv v6, frozen-source authority and current absence of
readiness commands were verified. The deterministic CodeOps audit gate was ready.

## Summary by Dimension

| # | Dimension | Findings | Highest severity |
|---:|---|---:|---|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | 0 | — |
| 4 | Completeness Gaps | 0 | — |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 0 | — |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 0 | — |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 0 | — |
| 13 | Codebase Alignment | 0 | — |

## Summary by Severity

| Severity | Count | Status |
|---|---:|---|
| 🔴 Critical | 0 | None |
| 🟠 Major | 0 open / 8 resolved | All verified |
| 🟡 Minor | 0 open / 6 resolved | All verified |
| 🔵 Observation | 0 | None |

## Findings

### PF-001: Generated TypeScript contracts have no lifecycle 🟠 MAJOR

**Dimension:** Completeness Gaps

**Location:** `03-03-semantic-validation.md:42-44`,
`03-01-workspace-data-model.md:30-46,109-114`, `03-04-projection-evolution.md:22-24`,
`99-execution-plan.md:128-132,161-167,197-201`

**Codebase evidence:** Workspace contracts are consumed through package barrels and emitted
declarations; for example, `packages/test-harness/package.json:4-11` exposes `dist/index.js` and
`dist/index.d.ts`. Root inventory data is not automatically importable through
`@blend65/readiness`.

**Problem:** The plan promises inventory-derived literal unions and declaration records with a
freshness gate, but defines no generated TypeScript path, writer, export or post-population task.
`readiness:generate` is simultaneously restricted to Markdown. Phase 3 cannot generate final IDs
before Phase 4 populates them.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Add a committed generated declaration module, generator, barrel export and freshness gate after inventory population; enumerate both generated outputs | Implements the recorded compile-time contract and preserves JSON authority | Adds generated-source lifecycle and multi-output coordination |
| B | Replace literal unions with branded runtime-validated IDs and registries | Smaller lifecycle and less generated churn | Weakens the already-selected compile-time exhaustiveness contract |

**Recommendation:** Option A. Limit literal unions to bounded handler/capability/declaration IDs;
keep potentially large semantic rule IDs branded unless measured size justifies a union. Render all
outputs before deterministic per-file atomic replacement and make check mode verify every output.

**User Decision:** AI — delegated by `--auto-design`

- **Eligibility:** Internal interface, generation and sequencing mechanism inside approved scope.
- **Objective:** Preserve one authoritative inventory while giving RD-02–RD-04 a real typed API.
- **Evidence:** The plan promises derived/fresh contracts; package consumers require an exported
  source/barrel path.
- **Rejected alternative:** Runtime-only IDs are viable but contradict the recorded compile-time
  declaration choice without new evidence.
- **Strongest counterargument:** Committed generated TypeScript adds churn and partial-write risk;
  render-first, explicit outputs and freshness checks bound that risk.
- **Confidence:** High.
- **Hardening:** Independent challenger converged on A and narrowed union generation to bounded
  declaration identities.
- **Policy version:** 1.
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`.
- **Reopen triggers:** Generated unions prove impractically large, or downstream RDs no longer need
  compile-time declaration exhaustiveness.

### PF-002: Phase 4 depends on Phase 5 projection machinery 🟠 MAJOR

**Dimension:** Ordering & Sequencing

**Location:** `07-testing-strategy.md:81`, `99-execution-plan.md:154-155,171-173,189-201`

**Codebase evidence:** `package.json:13-21` has no readiness commands and
`02-current-state.md:10-14` correctly records that neither the package nor projection exists.

**Problem:** ST-32 requires both a complete inventory and a fresh generated projection. Phase 4
must make it green, but the renderer, commands and committed projection are Phase 5 work. Phase 4
cannot close green under its own test-first gate.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Split ST-32 into Phase-4 inventory closure and a Phase-5 projection/clean-checkout case | Preserves intended dependency direction and honest phase gates | Adds one explicit aggregate case |
| B | Move projection implementation into Phase 4 | Keeps ST-32 intact | Entangles authority population with presentation and weakens phase separation |

**Recommendation:** Option A. Keep a Phase-5 end-to-end case that composes the Phase-4 closure
case.

**User Decision:** AI — delegated by `--auto-design`

- **Eligibility:** Implementation sequencing and test organization.
- **Objective:** Make every phase independently executable and green.
- **Evidence:** Projection code is scheduled strictly after the test that requires it.
- **Rejected alternative:** Moving projection earlier is feasible but creates an avoidable
  dependency inversion.
- **Strongest counterargument:** One aggregate case is simpler; preserve it in Phase 5.
- **Confidence:** Very high.
- **Hardening:** Independent challenger converged on A.
- **Policy version:** 1.
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`.
- **Reopen triggers:** Projection ownership is deliberately moved into the denominator-population
  phase.

### PF-003: Semantic inventory judgments have no acceptance gate 🟠 MAJOR

**Dimension:** Completeness Gaps

**Location:** `03-03-semantic-validation.md:24-28`,
`02-current-state.md:93-98`, `99-execution-plan.md:161-173`,
`07-testing-strategy.md:50-70,81`

**Codebase evidence:** The target is derived from a heterogeneous frozen corpus: chapters,
normative grammar, the C64 appendix, contextual indexes, evaluations, other-target appendixes and
history documents. `spec/build-plan.md:42-70,102-110` establishes canonical ownership but cannot
mechanically decide every real fragment's normativity or decomposition.

**Problem:** Validators can prove that every fragment received a disposition, not that the human
disposition, rule decomposition, applicability or evidence obligation is semantically correct. The
plan calls batches “reviewed” but names no independent reviewer, review artifact, disagreement
handling or freshness gate. A consistently wrong classification can therefore pass every
mechanical test.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Require author plus independent compiler/language review for every source group, persist revision-keyed evidence, block disagreements as errata, then run aggregate cross-chapter review | Directly protects the denominator's semantic authority | Material Phase-4 review cost |
| B | Record counts and review samples | Lower cost | Cannot exclude systematic misclassification |

**Recommendation:** Option A. Persist process evidence keyed by spec revision, inventory revision
and source-group hashes; do not make that evidence semantic authority.

**User Decision:** AI — delegated by `--auto-design`

- **Eligibility:** Verification strategy and implementation-process mechanism inside the approved
  exhaustive-denominator goal.
- **Objective:** Ensure mechanical completeness does not masquerade as semantic correctness.
- **Evidence:** The plan explicitly says natural-language equivalence is reviewed, not inferred.
- **Rejected alternative:** Counts and spot checks do not prove exhaustive semantic review.
- **Strongest counterargument:** Full two-pass review is expensive; that cost is intrinsic to
  making the inventory authoritative and is bounded by per-source-group review.
- **Confidence:** Very high.
- **Hardening:** Independent challenger converged and added revision-keyed review evidence plus an
  aggregate cross-chapter reviewer.
- **Policy version:** 1.
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`.
- **Reopen triggers:** A machine-verifiable semantic source replaces human classification, or the
  inventory ceases to be authoritative.

### PF-004: Nesting is bounded only after tree allocation 🟠 MAJOR

**Dimension:** Feasibility Concerns

**Location:** `03-01-workspace-data-model.md:90-107,116-125`,
`07-testing-strategy.md:33-36`

**Codebase evidence:** The pinned `jsonc-parser` implementation constructs object, array and
property nodes while parsing; its current use in `packages/config/src/parse.ts:74-92` parses and
builds a tree without a depth limit.

**Problem:** The design says nesting is checked before `parseTree`, but a later tree traversal
cannot prevent the parser from allocating/traversing a deeply nested input first. The planned
one-over fixture does not prove early termination.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Implement a tiny strict-JSON byte structural pre-scan for depth before tree parsing | Fully controlled early bound | Duplicates JSON string/escape lexical handling |
| B | Use `jsonc-parser.visit` as a non-tree first pass with depth/key stacks and proven abort behavior, then build the tree | Reuses the pinned parser's lexical grammar and avoids a second parser | Depends on proven early-abort behavior |

**Recommendation:** Option B, conditional on a pinned behavioral test proving exact early abort
without suffix traversal or tree allocation. Fall back to Option A if that proof fails. Keep the
hard byte cap before either mechanism.

**User Decision:** AI — delegated by `--auto-design`

- **Eligibility:** Hostile-input parsing and resource-safety mechanism within the approved policy.
- **Objective:** Enforce depth before unbounded allocation while minimizing security-sensitive
  parser duplication.
- **Evidence:** `parseTree` itself cannot provide the promised pre-allocation depth gate.
- **Rejected alternative:** A is the required fallback, but duplicates string/escape grammar if
  the visitor can safely terminate.
- **Strongest counterargument:** Visitor abort may rely on unstable behavior; the dependency stays
  pinned and an upgrade-blocking contract test is mandatory.
- **Confidence:** Medium-high.
- **Hardening:** Independent challenger preferred B over the initial byte-scanner recommendation,
  with a proof-or-fallback condition.
- **Policy version:** 1.
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`.
- **Reopen triggers:** The pinned visitor traverses after abort, allocates an equivalent full
  structure, or changes behavior on dependency upgrade.

### PF-005: Retired rule IDs have no durable memory 🟠 MAJOR

**Dimension:** Implicit Assumptions

**Location:** `00-ambiguity-register.md:164-178`,
`03-01-workspace-data-model.md:36-54`, `03-03-semantic-validation.md:30-32`,
`07-testing-strategy.md:57`

**Codebase evidence:** The planned clean-checkout command reads one current inventory; the
repository has no database or external identity allocator.

**Problem:** Active-rule lineage cannot prove that an otherwise unreferenced deleted ID was once
allocated. A current-only validator therefore cannot distinguish a new ID from reuse of a retired
one, despite promising permanent reuse rejection.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Add an authoritative monotonic identity/tombstone registry with active/retired status and allocation/retirement metadata | Self-contained current validation and bounded history | Registry grows and needs migration integrity checks |
| B | Retain and validate every predecessor inventory | Complete historical evidence | Unbounded operational dependency on all historical files |

**Recommendation:** Option A. Active rules reference active identities; migrations compare
predecessor identity facts and forbid deletion, mutation or reactivation of retired IDs.

**User Decision:** AI — delegated by `--auto-design`

- **Eligibility:** Internal identity and reversible data-evolution mechanism.
- **Objective:** Preserve stable semantic identity and make reuse mechanically impossible.
- **Evidence:** No current planned artifact remembers an unreferenced deleted ID.
- **Rejected alternative:** Full predecessor retention is correct but needlessly makes history an
  ever-growing runtime dependency.
- **Strongest counterargument:** Tombstones can be edited dishonestly; migration comparison must
  make identity facts append-only.
- **Confidence:** High.
- **Hardening:** Independent challenger converged on A.
- **Policy version:** 1.
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`.
- **Reopen triggers:** An external authoritative ID registry is adopted or inventory history
  becomes an explicit retained-chain contract.

### PF-006: Specification tests derive from implementation design 🟠 MAJOR

**Dimension:** Testability

**Location:** `07-testing-strategy.md:17-24,28-83,87-99`,
`99-execution-plan.md:47-51,82-86,117-122,187-191`

**Codebase evidence:** `AGENTS.md:44-45,74-77` separates immutable specification tests from
implementation tests. The governing CodeOps testing standard requires `*.spec.test.*` to derive
from requirements only.

**Problem:** The plan explicitly derives immutable specification cases from `03-01`–`03-04` and
plan-local AR decisions. That freezes reversible parser, package and algorithm choices as semantic
oracles and makes refactoring failures indistinguishable from requirement failures.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Keep only RD-owned observable outcomes in spec tests; move plan mechanisms to impl tests; back-propagate only a narrow missing durable contract before testing it as specification | Preserves an independent requirements oracle and refactor freedom | Requires careful case-by-case remapping |
| B | Promote every plan mechanism into the RD | Makes current classification formally valid | Overconstrains future implementation without product need |

**Recommendation:** Option A.

**User Decision:** AI — delegated by `--auto-design`

- **Eligibility:** Testing architecture inside approved behavior.
- **Objective:** Keep the immutable oracle independent from implementation choices.
- **Evidence:** The current test strategy directly names design documents as normative test
  sources.
- **Rejected alternative:** Wholesale promotion creates unnecessary product constraints.
- **Strongest counterargument:** Some architecture constraints are load-bearing; those already
  derive from RD outcomes or should be back-propagated narrowly.
- **Confidence:** Very high.
- **Hardening:** Independent challenger converged on A.
- **Policy version:** 1.
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`.
- **Reopen triggers:** The repository formally changes its specification/implementation test
  taxonomy.

### PF-007: Duplicate rule IDs lack a direct acceptance test 🟠 MAJOR

**Dimension:** Testability

**Location:** `01-requirements.md:14-15`, `07-testing-strategy.md:33,50-70`,
`99-execution-plan.md:233-235`

**Codebase evidence:** `requirements/RD-01-specification-inventory.md:151-152` explicitly requires
cross-record duplicate rule-ID rejection. No readiness tests exist yet to provide incidental
coverage.

**Problem:** ST-4 tests duplicate raw JSON property keys, not two different rule records with the
same `ruleId` value. No semantic case proves the RD's explicit uniqueness acceptance criterion.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Add a dedicated Phase-3 semantic fixture with two record paths sharing one ID; require one deterministic diagnostic and no graph output | Tests the correct layer and exact acceptance behavior | Adds one small fixture |
| B | Fold it into ST-4 | Fewer case identifiers | Conflates raw syntax loss with semantic identity collision |

**Recommendation:** Option A.

**User Decision:** AI — delegated by `--auto-design`

- **Eligibility:** Test-case design for an existing acceptance criterion.
- **Objective:** Make every claimed AC mapping observable.
- **Evidence:** Duplicate keys and duplicate values are different validation layers.
- **Rejected alternative:** Folding into ST-4 creates false coverage attribution.
- **Strongest counterargument:** A general uniqueness validator may pass incidentally; explicit
  acceptance still requires a direct fixture.
- **Confidence:** Very high.
- **Hardening:** Independent challenger converged on A.
- **Policy version:** 1.
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`.
- **Reopen triggers:** RD-01 removes cross-record uniqueness from acceptance.

### PF-008: Population batches are inconsistent and too coarse 🟡 MINOR

**Dimension:** Scope Creep Indicators

**Location:** `03-04-projection-evolution.md:65-74`,
`00-ambiguity-register.md:39-44`, `99-execution-plan.md:29-38,161-173`

**Codebase evidence:** The frozen source set contains 16 chapters, a large grammar, five target
appendixes and contextual/history documents. A multi-chapter checkbox can contain hundreds of
semantic dispositions while progress is persisted only at checkbox granularity.

**Problem:** Design and execution define different population groups, and several execution
checkboxes span three chapters or an entire grammar/context reconciliation. They are not the
bounded, resumable review units the plan promises.

**Recommendation:** Use one task per chapter plus separately bounded grammar, C64 projection and
context/conflict groups. Align `03-04` and `99` to that partition and require validation/review
evidence per unit.

**User Decision:** AI — delegated by `--auto-design`

- **Eligibility:** Reversible implementation task decomposition.
- **Objective:** Make semantic authoring reviewable, resumable and attributable.
- **Evidence:** Current group definitions conflict and task status has no subtask persistence.
- **Rejected alternative:** Narrative progress inside coarse tasks remains non-structural and
  weakens resume correctness.
- **Strongest counterargument:** More tasks add bookkeeping; the denominator's manual semantic
  risk justifies chapter-level checkpoints.
- **Confidence:** High.
- **Hardening:** In-context sequencing and failure-isolation review; no independent challenger
  required for minor severity.
- **Policy version:** 1.
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`.
- **Reopen triggers:** A generated batch ledger provides equivalent durable subtask state.

### PF-009: “Dependency-free” contradicts required dependencies 🟡 MINOR

**Dimension:** Consistency

**Location:** `00-ambiguity-register.md:19-23,51-69`,
`02-current-state.md:86-90`, `03-01-workspace-data-model.md:8-10,90-99`

**Problem:** The workspace is repeatedly called dependency-free while it explicitly depends on Ajv
v8 and `jsonc-parser`. The actual invariant is independence from compiler/toolchain packages.

**Recommendation:** Replace “dependency-free” with “independent of compiler/toolchain packages,
with only explicitly allowlisted validation dependencies.”

**User Decision:** AI — delegated by `--auto-design`

- **Eligibility:** Terminology correction preserving the approved architecture.
- **Objective:** State an implementable dependency boundary.
- **Evidence:** Both runtime libraries are explicit plan dependencies.
- **Rejected alternative:** Removing the libraries would overturn AR-P4/P5 without benefit.
- **Strongest counterargument:** “Dependency-free” might mean domain-dependency-free; formal package
  plans should not depend on that colloquial reading.
- **Confidence:** High.
- **Hardening:** In-context consistency review.
- **Policy version:** 1.
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`.
- **Reopen triggers:** The package becomes truly dependency-free.

### PF-010: Test-file inventories disagree 🟡 MINOR

**Dimension:** Consistency

**Location:** `07-testing-strategy.md:87-99`,
`99-execution-plan.md:45-51,115-122`

**Problem:** The strategy assigns ST-15–ST-26 to one semantic-validator spec file and ST-6 to the
JSON-input file; execution creates concern-specific ledger, conflict, declaration, graph and limits
files instead.

**Recommendation:** Make the concern-specific execution files canonical and align the test mapping
table after PF-006 reclassifies requirement versus mechanism cases.

**User Decision:** AI — delegated by `--auto-design`

- **Eligibility:** Reversible test organization.
- **Objective:** Give execution and coverage audits one file map.
- **Evidence:** The two explicit inventories name incompatible outputs.
- **Rejected alternative:** One large semantic file conflicts with the planned component
  boundaries.
- **Strongest counterargument:** Filenames are implementation detail; here they are executable
  task deliverables and taxonomy inputs.
- **Confidence:** High.
- **Hardening:** In-context maintainability review.
- **Policy version:** 1.
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`.
- **Reopen triggers:** The semantic validators are deliberately consolidated.

### PF-011: Atomic writer lacks concurrent ownership 🟡 MINOR

**Dimension:** Edge Cases

**Location:** `03-04-projection-evolution.md:55-63`,
`07-testing-strategy.md:79-80,136-141`, `99-execution-plan.md:197-200`

**Problem:** A “known temporary path” can be shared by two generator/migration processes. One
process can rename or delete the other's file; single-process injected failures do not cover this.

**Recommendation:** Create a unique exclusive same-directory temp file (`wx` semantics), track
ownership per invocation, flush/close, rename, and clean up only the owned path. Add a two-writer
test proving complete outputs and no foreign cleanup.

**User Decision:** AI — delegated by `--auto-design`

- **Eligibility:** Concurrency and failure-recovery mechanism.
- **Objective:** Preserve atomic replacement under ordinary parallel local execution.
- **Evidence:** The writer is shared by generation and future migration.
- **Rejected alternative:** A lock file adds stale-lock lifecycle without removing the need for
  unique temp ownership.
- **Strongest counterargument:** Generated Markdown is recoverable; the same primitive protects
  future authoritative migrations.
- **Confidence:** High.
- **Hardening:** In-context concurrency analysis.
- **Policy version:** 1.
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`.
- **Reopen triggers:** The writer is constrained to a proven single-process environment.

### PF-012: “Non-mutating” conflicts with package build outputs 🟡 MINOR

**Dimension:** Codebase Alignment

**Location:** `03-01-workspace-data-model.md:109-112`,
`00-index.md:47-48`, `03-04-projection-evolution.md:14-20`,
`07-testing-strategy.md:78`

**Codebase evidence:** `turbo.json:4-7` declares `dist/**` and `*.tsbuildinfo` build outputs;
`AGENTS.md:37-40` confirms builds create ignored artifacts.

**Problem:** The root check command is said to build the package and also to modify no file.
Building necessarily changes ignored outputs, so the literal test contract is impossible.

**Recommendation:** Define non-mutating as “does not alter tracked, authoritative, conformance or
generated-projection artifacts.” Snapshot those paths and optionally Git status in ST-29 while
allowing ignored build outputs.

**User Decision:** AI — delegated by `--auto-design`

- **Eligibility:** Command verification semantics within approved non-authority-mutation behavior.
- **Objective:** Preserve an ergonomic build-and-check command and a truthful safety contract.
- **Evidence:** TypeScript/Turbo builds write files by design.
- **Rejected alternative:** Requiring prebuilt output is viable but makes the command fragile.
- **Strongest counterargument:** The intended meaning is obvious; the current “modifies no file”
  assertion makes the stronger reading testable.
- **Confidence:** High.
- **Hardening:** In-context codebase alignment review.
- **Policy version:** 1.
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`.
- **Reopen triggers:** The check command stops building or runs in a truly ephemeral output tree.

### PF-013: Coverage targets have no measurement gate 🟡 MINOR

**Dimension:** Testability

**Location:** `07-testing-strategy.md:8-15,143-153`,
`99-execution-plan.md:68-73,103-108,138-143,173-178,207-213`

**Codebase evidence:** `package.json:23-32` has no Vitest coverage provider; package tests and
Turbo run ordinary Vitest without coverage thresholds.

**Problem:** The plan states 95% and 80% branch targets, but adds no dependency, configuration,
command, threshold or task. Every checkbox can complete without measuring them.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Add a Vitest 2-compatible coverage provider, readiness configuration and enforced thresholds | Makes the numeric goals real | Adds dependency and coverage-maintenance cost |
| B | Remove percentages and use contracted cases, mutation tests and exhaustive ledger criteria | Avoids weak proxy metrics | Loses a quantitative implementation-code backstop |

**Recommendation:** Option A, scoped to `@blend65/readiness`, because parser/validator code handles
hostile inputs and the plan already commits to precise branch thresholds.

**User Decision:** AI — delegated by `--auto-design`

- **Eligibility:** Testing mechanism within approved quality goals.
- **Objective:** Make stated coverage thresholds executable.
- **Evidence:** No current tool or task measures branch coverage.
- **Rejected alternative:** Case/mutation coverage is strong but does not implement the explicit
  numeric promise.
- **Strongest counterargument:** Branch coverage is a proxy, not correctness; it supplements rather
  than replaces the contracted-case and mutation suites.
- **Confidence:** High.
- **Hardening:** In-context testability review.
- **Policy version:** 1.
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`.
- **Reopen triggers:** Numeric targets are explicitly removed from the approved testing strategy.

## Verdict

✅ **PREFLIGHT PASSED — all 14 findings resolved**

All 13 dimensions were re-scanned after the selected `--auto-design` fixes. The bounded third pass
verified the residual generated-contract, semantic-review, identity-history, test-tier and
concurrent-publication corrections. The plan is ready for execution and the feature roadmap
advances to **Plan Preflighted**.

## Adversarial Closeout

- The largest same-framing risk was assuming mechanical fragment closure proves semantic
  correctness; PF-003 closes that gap with independent unit/dependency-digest and aggregate review.
- The strongest external-standard constraint is the repository's requirements-only specification
  test taxonomy; PF-006 prevents implementation design from becoming its own oracle.
- A compiler/language expert may still challenge individual inventory classifications during
  Phase 4. The selected review gate turns disagreements into visible blockers instead of silent
  denominator rows.

Because this inventory will become the foundation for later readiness and release claims, an
additional human compiler/language review of the completed Phase-4 inventory remains advisable.
