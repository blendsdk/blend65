# Preflight Report: RD-08 Complete C64 Rule Models and Generated-Program Coverage

> **Status**: ✅ PREFLIGHT PASSED — all 11 findings resolved
> **Iteration**: 3 (bounded PF-001 verification after the iteration-2 full re-scan)
> **Artifact**: Single requirement at `codeops/features/compiler-readiness/requirements/RD-08-complete-c64-rule-coverage.md`
> **Original Artifact Hash**: `f9c936e4abeaab98d682d34771b9b04f89d4c191`
> **Corrected Artifact Hash**: `f8d96f5f19e43ec39c73b0957eebe68ca4871452`
> **Codebase Grounded**: 22 source/test/config files examined; 18 material references verified
> **Scope Mode**: Strict
> **Last Updated**: 2026-09-02

## Audit Scope

- **Audit target:** RD-08 only.
- **Context documents:** compiler-readiness ambiguity register, README, RD-05–RD-07 and roadmap;
  optimizer RD-03/RD-14 and roadmap; frozen array semantics; readiness/optimizer/conformance/parity
  ownership artifacts.
- **Authorized product scope:** complete C64 v3.0 per-rule dispositions and generated semantic
  evidence, beginning with arrays/calls/branches/bounded loops; no compiler/optimizer fixes or
  general failure-harness expansion.
- **Authorized modification set:** RD-08 and this report. The user authorized only the smallest
  local PF corrections and prohibited new generalized frameworks, resuming full RD-05/RD-07 work
  or expanding readiness-execution infrastructure.
- **Domain lenses:** compiler and language; data and migration.

## Codebase Context Summary

**Tech Stack:** TypeScript ESM on Node 22, Yarn classic workspaces, Turborepo and Vitest.

**Architecture:** `@blend65/readiness` owns the inventory, independent scalar generator IR,
oracles, replay and parent publications. `@blend65/readiness-execution` owns public compiler/ACME/
VICE routes and a separately selected child publication bound to one exact parent digest.

**Key files examined:** `packages/readiness/src/{generator-ir,model-registry-model,publication-model,
execution-publication-resolver}.ts`, `packages/readiness-execution/src/{execution-route-planner,
execution-publication-catalog,execution-workspace}.ts`, both smoke configs, root `package.json`,
the selected inventory/rule-model publications, frozen array semantics and the optimizer profile/
translation-validation RDs.

**Key observations:** the selected inventory contains 2,112 rules (2,057 `mandatory-c64`, 55
`out-of-claim-target`); the rule-model authority contains nine modeled and 2,103
`outside-initial-slice` rows. The independent IR currently models scalar/memory expressions only.
Parent and execution authorities use separate pointers. Optimizer execution profiles are specified
but unimplemented. The normal readiness gate is file-selected and excludes production VICE, but it
has no generated-case ceiling.

## Summary by Dimension

| # | Dimension | Findings | Highest severity |
|---|---|---:|---|
| 1 | Ambiguities | 2 | 🟠 MAJOR |
| 2 | Implicit Assumptions | 1 | 🟠 MAJOR |
| 3 | Logical Contradictions | 1 | 🟠 MAJOR |
| 4 | Completeness Gaps | 1 | 🟠 MAJOR |
| 5 | Dependency Issues | 2 | 🟠 MAJOR |
| 6 | Feasibility Concerns | 1 | 🟠 MAJOR |
| 7 | Testability | 1 | 🟠 MAJOR |
| 8 | Security Blind Spots | 1 | 🟠 MAJOR |
| 9 | Edge Cases | 1 | 🟠 MAJOR |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 0 | — |
| 13 | Codebase Alignment | 0 | — |

Cross-dimension symptoms were deduplicated under their primary root cause.

## Summary by Severity

| Severity | Count | Status |
|---|---:|---|
| CRITICAL | 0 | — |
| MAJOR | 11 | 11 resolved |
| MINOR | 0 | — |
| OBSERVATION | 0 | — |

## Findings

### PF-001: Terminal disposition conflates three independent authorities 🟠 MAJOR

**Dimension:** Ambiguities

**Location:** RD-08 lines 28–35, 104–114 and 208–213.

**Codebase Evidence:** `packages/readiness/src/model-registry-model.ts:58` separates model state;
`packages/readiness/src/model.ts:196` separately owns applicability; execution projects the joined
facts through `packages/readiness/src/execution-contracts.ts:241`.

**The Problem:** The RD treats model state, non-source evidence route, inventory applicability and
terminal evidence result as one disposition. It never defines the passing result for a
non-source-generatable mandatory rule, so implementations can produce incompatible RD-06 results.

**Recommended ruling — only viable resolution:** Define separate closed axes and an exhaustive,
fail-closed join that produces the exact RD-06 result. Retire `outside-initial-slice` as a reason;
do not duplicate inventory applicability into the rule-model schema. A unified replacement schema
was rejected because it creates a second applicability authority and a larger migration.

**Strongest counterargument:** Separate axes can drift; the join validator must therefore reject
every missing, duplicate or invalid combination.

**Confidence:** High. **Hardening:** independent challenger converged.

**User Decision:** Resolved — user accepted the recommendation under the minimum-sufficient constraint.

### PF-002: The first vertical publication has no closed population 🟠 MAJOR

**Dimension:** Ambiguities

**Location:** RD-08 lines 55–58, 102–108, 123–127 and 214–220.

**The Problem:** “Contains arrays, calls, branches and bounded loops” can mean one example per
construct or complete reviewed families. Nothing identifies which inventory IDs must be present,
so the optimizer-unlock milestone is not reproducible or reviewable.

**Recommended ruling:** Require a content-addressed reviewed manifest of the exact inventory IDs
and family members in the first publication. Family metadata mechanically validates the manifest
but cannot silently add members. A predicate-only population was rejected because metadata changes
could silently change the accepted milestone.

**Strongest counterargument:** The manifest duplicates membership and must be deliberately updated
when reviewed family metadata changes.

**Confidence:** High. **Hardening:** independent challenger converged.

**User Decision:** Resolved — user accepted the recommendation under the minimum-sufficient constraint.

### PF-003: Optimizer execution is circularly required by its own unlock gate 🟠 MAJOR

**Dimension:** Logical Contradictions

**Location:** RD-08 lines 55–58, 143–154 and 231–234.

**Codebase Evidence:** Optimizer profiles belong to
`codeops/features/game-optimizer-codegen/requirements/RD-03-pass-manager-profiles.md:21`; profile
execution and mismatch attribution belong to
`codeops/features/game-optimizer-codegen/requirements/RD-14-translation-validation.md:24`. The
optimizer roadmap is 0/18 and has no implementation plans.

**The Problem:** AC-08 requires real reference/isolated/prefix/full execution and pass attribution
before the readiness publication that is explicitly meant to unlock that optimizer work.

**Recommended ruling:** End RD-08 acceptance at a stable provider envelope and consumer-contract
fixture. Keep real profile execution and pass-mismatch localization solely in optimizer RD-14.
Making optimizer RD-03/RD-14 prerequisites was rejected because it defeats AR-18's unlock sequence.

**Strongest counterargument:** A fixture cannot prove real pass-manager integration; optimizer
RD-14 must retain that gate.

**Confidence:** High. **Hardening:** independent challenger converged.

**User Decision:** Resolved — user accepted the recommendation under the minimum-sufficient constraint.

### PF-004: “Empty array extent” contradicts the frozen language 🟠 MAJOR

**Dimension:** Implicit Assumptions

**Location:** RD-08 lines 123–128 and 214–217.

**Codebase Evidence:** `spec/08-arrays-strings.md:73` requires E10111 for a zero-size array;
`packages/frontend/src/semantics/type-check/type-resolution.ts:145` implements that rejection.

**The Problem:** AC-03 can be read as requiring a valid zero-length array, turning correct E10111
behavior into a failing immutable oracle.

**Recommended ruling — only viable resolution:** State that the minimum valid extent is one and
zero extent is the E10111 invalid neighbor. If “empty” means an empty initializer, name that
separately with its actual validity rules.

**Strongest counterargument:** Future zero-sized types would require a separate specification
change; RD-08 cannot anticipate one against the frozen authority.

**Confidence:** High. **Hardening:** independent challenger converged.

**User Decision:** Resolved — user accepted the recommendation under the minimum-sufficient constraint.

### PF-005: RD-05 is a missing staged dependency 🟠 MAJOR

**Dimension:** Dependency Issues

**Location:** RD-08 line 7, lines 68–71 and integration row at line 174.

**Codebase Evidence:** The compiler-readiness roadmap records RD-05 deferred at 34/70 after Phase 3;
`plans/rd-05-failure-reduction/99-execution-plan.md:376` shows evidence publication, regression
activation and orchestration remain incomplete.

**The Problem:** The first vertical slice can use RD-01–RD-04, but denominator closeout requires
RD-05 retention/promotion providers. The RD header currently permits continuous execution into
acceptance before those providers exist.

**Recommended ruling:** Define two gates: the first vertical publication depends on RD-01–RD-04;
denominator closeout and retained reproducer acceptance depend on the exact required RD-05
checkpoint. Completing all of RD-05 first was rejected because it delays the high-value compiler
coverage slice without a correctness benefit.

**Strongest counterargument:** Split gates add lifecycle states, so the roadmap must clearly mark
the publication as not closeout-ready.

**Confidence:** High. **Hardening:** independent challenger converged.

**User Decision:** Resolved — user required use of completed RD-05 Phase 3 contracts only; unfinished RD-05 remains deferred.

### PF-006: Required format evolution omits its mandatory RD-07 prerequisite 🟠 MAJOR

**Dimension:** Dependency Issues

**Location:** RD-08 line 7 and lines 134–141.

**Codebase Evidence:** `RD-07-non-functional.md:25` requires its evolution gate before the first
schema or inventory-format upgrade; the requirements README repeats this conditional prerequisite.

**The Problem:** Family and non-source evidence representation require an evolved format, but RD-07
is absent from the dependency header and no milestone places its evolution subset before selection.

**Recommended ruling — only viable resolution:** Make the RD-07 evolution subset an explicit
pre-selection dependency before the first RD-08 publication that changes schema or publication
members.

**Strongest counterargument:** It adds ceremony to an additive change, but exact replay and
historical byte preservation make the gate necessary.

**Confidence:** High. **Hardening:** independent challenger converged.

**User Decision:** Resolved — user required only the local pre-selection evolution checks; unfinished RD-07 remains deferred.

### PF-007: Mandatory quality-obligation rules have no achievable readiness route 🟠 MAJOR

**Dimension:** Completeness Gaps

**Location:** RD-08 lines 72–75, 90–93, 145–150 and 208–213.

**Codebase Evidence:** `readiness/inventory/compiler-readiness-v1.json:1` contains 54
`mandatory-c64` `quality-obligation` rows, including normative byte/cycle costs. RD-06 lines 24–32
and 41–44 forbid performance thresholds from changing semantic readiness.

**The Problem:** Cost rules cannot pass through semantic oracles, cannot be hidden as target
exclusions, and are barred from affecting readiness. The complete denominator is therefore
unachievable as written.

**Recommended ruling — only viable resolution consistent with AR-3/RD-06:** Run a reviewed,
fail-closed reconciliation of all 54 rows. True semantic obligations remain in the readiness
denominator; cost-only rows remain visible in a secondary quality projection outside semantic pass
status. Unreviewed or ambiguous rows remain blocking.

**Strongest counterargument:** Misclassification could launder mandatory failures; every change
must preserve the inventory ID and cite the frozen source.

**Confidence:** High. **Hardening:** independent challenger converged.

**User Decision:** Resolved — user accepted the recommendation under the minimum-sufficient constraint.

### PF-008: Cross-publication selection semantics are not achievable as implied 🟠 MAJOR

**Dimension:** Feasibility Concerns

**Location:** RD-08 lines 51–54 and 134–141.

**Codebase Evidence:** Parent selection uses `packages/readiness/src/publication-model.ts:146`;
execution selection uses a separate pointer in
`packages/readiness/src/execution-publication-model.ts:98`. Each child binds one exact parent and
stale pairs fail closed through the execution publication catalog.

**The Problem:** If “new selection” means an atomic parent-plus-execution switch, the existing
two-pointer contracts cannot provide it. Updating either pointer first creates an intermediate stale
pair, although current code safely refuses to treat that pair as valid.

**Recommended ruling:** Preserve the smaller two-pointer architecture. Explicitly allow a
fail-closed unavailable intermediate state, require exact parent-child binding, and prove recovery
without mixed evidence. A composite selector was rejected as unnecessary availability
infrastructure outside the stated integrity requirement.

**Strongest counterargument:** A stale interval reduces availability and needs deterministic
recovery tests.

**Confidence:** Medium-High. **Hardening:** independent challenger converged on the smaller design.

**User Decision:** Resolved — user accepted the existing two-pointer, fail-closed design and no new selector framework.

### PF-009: Constant and runtime array bounds require opposite outcomes 🟠 MAJOR

**Dimension:** Edge Cases

**Location:** RD-08 lines 36–46 and 123–132.

**Codebase Evidence:** `spec/08-arrays-strings.md:164` requires constant out-of-bounds rejection but
defines computed runtime out-of-bounds access through address-space wrapping;
`packages/frontend/src/semantics/type-check/expression-typing.ts:1043` checks only known constants.

**The Problem:** “Boundary-invalid indices” can cause the generator to reject defined computed
runtime cases or accept invalid constant cases, creating a false oracle.

**Recommended ruling — only viable resolution:** Specify two contracts: constant out-of-range
indices produce the exact diagnostic; computed runtime out-of-range indices remain valid and get an
absolute wrapped-address observation at the applicable tier.

**Strongest counterargument:** Wrapping is surprising, but RD-08 must test the frozen semantics,
not replace them.

**Confidence:** High. **Hardening:** independent challenger converged.

**User Decision:** Resolved — user accepted the recommendation under the minimum-sufficient constraint.

### PF-010: Complete `embed()` coverage lacks a safe asset-fixture route 🟠 MAJOR

**Dimension:** Security Blind Spots

**Location:** RD-08 lines 12–16, 28–32 and 193–204.

**Codebase Evidence:** The inventory contains 32 mandatory `embed()`-related rules. The compiler
reads source-relative assets in `packages/compiler/src/api/asset-reader.ts:43`; the execution
workspace already provides bounded exclusive regular-file creation at
`packages/readiness-execution/src/execution-workspace.ts:42`.

**The Problem:** Asset-free generated source cannot prove valid `embed()` behavior, while allowing
generated host paths would violate the required filesystem boundary.

**Recommended ruling — only viable resolution:** Use content-addressed, size-bounded fixture IDs
materialized exclusively inside each canonical case workspace. Generated source can reference only
those IDs. Traversal, symlink, absolute-path, missing-file and size-limit cases stay explicit
rejection tests.

**Strongest counterargument:** Fixture materialization adds harness surface, so it must remain a
narrow case-input provider rather than general workspace infrastructure.

**Confidence:** High. **Hardening:** independent challenger converged.

**User Decision:** Resolved — user required reuse of the existing execution workspace without generalized fixture infrastructure.

### PF-011: The quick-development gate has no enforceable ceiling 🟠 MAJOR

**Dimension:** Testability

**Location:** RD-08 lines 59–67, 158–164 and 238–242.

**Codebase Evidence:** `packages/readiness/vitest.smoke.config.ts:3` and
`packages/readiness-execution/vitest.smoke.config.ts:3` select files, not generated-case counts.

**The Problem:** A positive per-family cap can still be millions. The acceptance criteria permit a
technically bounded smoke gate that again takes hours, contrary to the requirement's purpose.

**Recommended ruling:** Set immutable maximum total and per-family smoke case counts; reject the
first over-limit manifest and prove `yarn test` reaches no other generated population. A wall-clock
SLA alone was rejected because host variance makes it neither deterministic nor a work bound.

**Strongest counterargument:** Fixed caps can under-sample later families; raising them must be an
explicit reviewed publication revision.

**Confidence:** High. **Hardening:** independent challenger converged.

**User Decision:** Resolved — user accepted fixed numeric caps and protection of quick development/release tests.

## Recommendation Hardening

The forced-reframing pass considered a unified terminal schema, predicate-derived first
publication, optimizer-first sequencing, RD-05-first sequencing, composite publication selector
and wall-clock-only smoke SLA. The independent challenger converged on all eleven recommended
rulings. The strongest general counterargument is added schema and lifecycle ceremony; the scan
retained only corrections necessary to make the already-authorized behavior correct, testable and
feasible.

## Resolution Verification

| Finding | Verification result |
|---|---|
| PF-001 | Closed in bounded iteration 3: applicability, claim role, evidence route and decisive result are separate; failing/blocking coverage remains valid while only passing satisfies RD-06 |
| PF-002 | Closed: `firstVerticalRuleIds` is an exact reviewed list inside the existing publication |
| PF-003 | Closed: RD-08 proves only the provider envelope; optimizer profiles remain RD-14-owned |
| PF-004 | Closed: extent one is minimum; zero extent is E10111; legal empty initializers are distinct |
| PF-005 | Closed: only completed RD-05 Phase 3 contracts are consumed; unfinished work stays deferred |
| PF-006 | Closed: only local required evolution checks run before selection; unfinished RD-07 stays deferred |
| PF-007 | Closed: all quality rows are reviewed; cost-only rows remain visible but outside semantic pass status |
| PF-008 | Closed: existing separate pointers and fail-closed stale-pair recovery are explicit |
| PF-009 | Closed: constant rejection and computed runtime wrapping have separate oracle contracts |
| PF-010 | Closed: valid assets reuse the bounded canonical workspace through a narrow fixture-ID map |
| PF-011 | Closed: smoke generation is capped at four cases per family and sixteen total |

The iteration-2 clustered re-scan covered all 13 dimensions. PF-001 alone required the permitted
bounded iteration-3 correction; its final verification found no direct regression. No critical,
major, minor or observation finding remains.

## Verdict

✅ **PASSED.** All eleven findings were authorized, corrected and independently verified. The
minimum-sufficient constraint is normative in RD-08: the first implementation phase prioritizes
real generated Blend programs and semantic compiler coverage; it cannot create a generalized
framework, resume unfinished RD-05/RD-07 phases or expand readiness-execution infrastructure.
