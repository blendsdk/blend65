# Preflight Report: RD-08 Complete C64 Rule Coverage Plan

> **Status**: ✅ PREFLIGHT PASSED — 0 critical or major findings unresolved
> **Iteration**: 5 (final exact verification)
> **Artifact**: full implementation plan at `codeops/features/compiler-readiness/plans/rd-08-complete-c64-rule-coverage/`
> **Audited Baseline Commit**: `3973663`
> **Initial Artifact Tree**: `0743e1a90d5ff60299a678eada6e4f8f62bee160`
> **Final Audited Content Hash**: `af7f88bddb39b9d22bb2cea3ef26a13591f17d42b536c3c815a96c57399b16eb`
> **Codebase Grounded**: 40+ source modules, 10+ tests and 5 configuration/data authorities examined; 78 exact plan paths mapped
> **Scope Mode**: strict
> **Domain Lenses**: compiler/language semantics; data/schema migration
> **Last Updated**: 2026-09-02

## Codebase Context Summary

RD-08 extends the workspace-independent `@blend65/readiness` generator, oracle, rule authority and
publication model, then consumes that evidence through `@blend65/readiness-execution`. The current
generator IR is a closed scalar/memory-only union. Parent and execution-child publications are
separate fixed v1 formats with separate pointers and transactions. The frozen inventory owns 2,112
rule IDs: 9 modeled and 2,103 marked `outside-initial-slice`.

The approved scope is limited to arrays, calls, branches and bounded loops first, followed by exact
2,112-rule terminal authority and additive publication compatibility. Compiler/optimizer fixes,
new dependencies, generalized frameworks, unfinished RD-05/RD-07 execution and changes under
`spec/` remain out of scope.

## Summary by Dimension

| # | Dimension | Findings | Highest severity |
|---:|---|---:|---|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | 0 | — |
| 4 | Completeness Gaps | 5 | 🟠 MAJOR |
| 5 | Dependency Issues | 1 | 🟠 MAJOR |
| 6 | Feasibility Concerns | 2 | 🟠 MAJOR |
| 7 | Testability | 5 | 🟠 MAJOR |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 1 | 🟠 MAJOR |
| 10 | Scope Creep Indicators | 1 | 🟡 MINOR |
| 11 | Ordering & Sequencing | 7 | 🟠 MAJOR |
| 12 | Consistency | 5 | 🟡 MINOR |
| 13 | Codebase Alignment | 3 | 🟠 MAJOR |

## Summary by Severity

| Severity | Encountered | Unresolved | Status |
|---|---:|---:|---|
| CRITICAL | 0 | 0 | None |
| MAJOR | 23 | 0 | All accepted, remediated and verified |
| MINOR | 7 | 0 | All accepted, remediated and verified |
| OBSERVATION | 0 | 0 | None |

| Iteration | Frozen content | Result |
|---:|---|---|
| 1 | `0743e1a9…e160` | 11 major, 3 minor |
| 2 | `1525dba1…a1b3` | 8 residual major, 2 residual minor |
| 3 | `d89e1fd1…e2480` | 3 residual major, 1 residual minor |
| 4 | `4d4959ac…90acf` | 1 residual major |
| 5 | `ff49b3ab…e2480` | 1 minor consistency finding; exact fix recheck at `af7f88bd…b16eb` returned no findings |

## Findings

### PF-001: The structured generator IR cannot represent its accepted vertical 🟠 MAJOR

**Dimension:** 4 Completeness Gaps  
**Location:** `03-01-vertical-generated-programs.md:43`; `99-execution-plan.md:56-70`  
**Codebase Evidence:** `packages/readiness/src/generator-ir.ts:37-149`

**The Problem:** The proposed IR adds array declarations, indexed reads, calls and structured
control flow, but it has no indexed assignment target, void-call statement, array-valued reference,
or sized/unsized and const/mutable array parameter form. It also leaves recursive statement depth
unbounded. The validator, renderer and oracle cannot satisfy the plan's own indexed-write,
zero/void-call, by-reference array and hostile-depth cases from these types.

**Recommended:** Complete the exact closed TypeScript unions and limits before Phase 1 RED tests:
add indexed lvalues, void-call statements, array references/parameter forms and a statement-depth
budget, then name their validator, renderer and evaluator behavior. Reducing the accepted cases was
rejected because each shape is already required by RD-08.

**Confidence:** High. **Hardening:** Independent challenger converged.  
**User Decision:** Accepted 2026-09-02. Amend the plan with the recommended closed IR forms and
limits before Phase 1 specification tests.

### PF-002: ST-03 assumes a source-controlled array base that does not exist 🟠 MAJOR

**Dimension:** 6 Feasibility Concerns  
**Location:** `07-testing-strategy.md:32`; `03-01-vertical-generated-programs.md:113-140`  
**Codebase Evidence:** `packages/readiness/src/generator-ir.ts:37-149`; `packages/frontend/src/sfa/`; `packages/codegen/src/il/lower-aggregates.spec.test.ts:65`

**The Problem:** ST-03 fixes an array at `$FFF0` and expects word indexing to wrap to `$0010`, but
array placement is compiler-owned and neither the current nor proposed case/oracle input binds an
array declaration to an absolute base. The test is therefore not constructible as specified.

**Recommended:** Give the independent oracle a bounded, identity-bound array-base fixture solely
for address calculation and pair it with a relocation-independent public-route case; explicitly
forbid the fixture from affecting rendered source or compiler layout. This preserves the wrap proof
without inventing user-visible placement syntax. A hardcoded source base was rejected because the
language has no such contract.

**Confidence:** High. **Hardening:** Independent challenger converged on the bounded fixture seam.  
**User Decision:** Accepted 2026-09-02 as recommended.

### PF-003: The plan selects an incomplete v2 format before defining v2 🟠 MAJOR

**Dimension:** 11 Ordering & Sequencing  
**Location:** `99-execution-plan.md:82-97,108-122`; `03-02-rule-families-dispositions.md:8-40`

**The Problem:** Phase 2 selects `rule-models-v2.json`, while Phase 3 later defines the closed v2
family, claim, route and result types. The first vertical has only 16 IDs, yet v2 forbids
`outside-initial-slice`, leaving the other 2,096 IDs without a legal transitional representation.
Two incompatible shapes would be published under one version.

**Recommended:** Define one immutable complete v2 schema and explicit transitional disposition
before any v2 candidate is prepared or selected. The first vertical may populate 16 modeled rows,
but every remaining rule must have a legal, reviewable v2 blocker state that cannot pass terminal
closure. Do not create a second v2 dialect.

**Confidence:** High. **Hardening:** Independent challenger converged.  
**User Decision:** Accepted 2026-09-02 as recommended.

### PF-004: Parent v2 publication omits the hardcoded v1 transaction seams 🟠 MAJOR

**Dimension:** 13 Codebase Alignment  
**Location:** `99-execution-plan.md:89-92,200`; `03-03-publication-execution.md:13-24`  
**Codebase Evidence:** `packages/readiness/src/publication-model.ts:131-200`; `packages/readiness/src/binding-publication.ts:504-885`; `packages/readiness/src/publication-pointer.ts:30`; `packages/readiness/src/publication-resolver.ts:453-560`

**The Problem:** The parent release profile, members, pointer and resolver dispatch are fixed to v1,
but the v2 tasks name only migration/family modules and `binding-publication.ts`. The planned v2
candidate cannot pass through the existing atomic transaction or resolve historically without
changes to the omitted closed seams.

**Recommended:** Extend the existing publication model, pointer, transaction and resolver with
closed v1/v2 dispatch and byte-preserving v1 tests. Reuse the existing authority rather than create
a parallel publication family.

**Confidence:** High. **Hardening:** Independent challenger converged.  
**User Decision:** Accepted 2026-09-02 as recommended.

### PF-005: Embed fixtures have no authenticated case-to-workspace carrier 🟠 MAJOR

**Dimension:** 5 Dependency Issues  
**Location:** `03-02-rule-families-dispositions.md:69-85`; `99-execution-plan.md:136-153`  
**Codebase Evidence:** `packages/readiness-execution/src/execution-route-adapters.ts:77`; `packages/readiness-execution/src/execution-workspace.ts:241-530`

**The Problem:** Current route requests carry only `main.blend`. The plan defines digest-to-bytes
lookup and workspace writing, but not how an authenticated fixture reference travels from a case
through route planning to materialization before launch. ST-21 cannot exercise the real boundary,
and an ad hoc worker-side lookup would grant the worker undeclared filesystem authority.

**Recommended:** Add bounded fixture references and digests to the execution case/envelope, have
the trusted route adapter resolve and exclusively write them through the existing workspace before
launch, and keep workers source-only. Test identity mismatch, traversal, symlink, size and missing
fixture failures at that boundary.

**Confidence:** High. **Hardening:** Independent challenger converged.  
**User Decision:** Accepted 2026-09-02 as recommended.

### PF-006: Compatible execution-child publication has no executable tasks 🟠 MAJOR

**Dimension:** 4 Completeness Gaps  
**Location:** `03-03-publication-execution.md:23-31`; `99-execution-plan.md:91-92,200`  
**Codebase Evidence:** `packages/readiness/src/execution-publication-model.ts`; `packages/readiness/src/execution-publication-resolver.ts`; `packages/readiness/src/binding-publication.ts`

**The Problem:** Parent and execution-child publications have independent formats, candidates,
pointers and selection transactions. Both the first vertical and terminal deliverables promise a
compatible child, but their tasks only target parent publication paths. Provider-envelope recovery
and the final compatible pair cannot be achieved by parent work alone.

**Recommended:** Add explicit child prepare, review, persist, select and resolve tasks at both
publication milestones, including parent-selected/child-unavailable and exact-child-recovery tests.
Keep the separate-pointer design already accepted by the plan.

**Confidence:** High. **Hardening:** Independent challenger converged.  
**User Decision:** Accepted 2026-09-02 as recommended.

### PF-007: The exact first 16 rule IDs are not each semantically proved 🟠 MAJOR

**Dimension:** 7 Testability  
**Location:** `03-01-vertical-generated-programs.md:143-170`; `07-testing-strategy.md:30-49`

**The Problem:** The first publication contains 16 exact IDs, including invalid-condition, missing
return and scalar call semantics, but several have no direct positive/negative generated case.
ST-15 proves list shape, not that evidence establishes each cited rule. An incorrect claim can be
published while the exact-ID test remains green.

**Recommended:** Add an ID-to-ST evidence table and a direct semantic or diagnostic case for every
one of the 16 IDs before selection. Keep the approved population; do not remove hard-to-prove IDs.

**Confidence:** High. **Hardening:** Independent challenger converged.  
**User Decision:** Accepted 2026-09-02 as recommended.

### PF-008: Family completeness is validated against self-declared family data 🟠 MAJOR

**Dimension:** 7 Testability  
**Location:** `03-02-rule-families-dispositions.md:8-67`; `99-execution-plan.md:136-153`  
**Codebase Evidence:** frozen 2,112-row inventory and its existing domain, neighbor and boundary facts

**The Problem:** The proposed family file declares its own constructions, domains, invalid
neighbors, boundaries and spellings, and tests remove entries only from that same declaration. A
category omitted from both the declaration and its cases still passes. Exact ID closure does not
prove semantic-family completeness.

**Recommended:** Derive a separate, reviewable completeness authority from the frozen inventory
facts and citations, then require bidirectional equality between that authority, family rows and
selected cases. Keep human review for citation classifications; do not let generated family data
validate itself.

**Confidence:** Medium-high. **Hardening:** Independent challenger converged.  
**User Decision:** Accepted 2026-09-02 as recommended.

### PF-009: ST-32 is made green before its real closeout evidence exists 🟠 MAJOR

**Dimension:** 11 Ordering & Sequencing  
**Location:** `99-execution-plan.md:193-207`; `07-testing-strategy.md:81,96`

**The Problem:** Task 6.2.4 makes ST-32 green before campaigns, the deferral-expiry audit and the
closeout artifact in tasks 6.3.2-6.3.3. The testing strategy also assigns ST-32 to a different file
than the execution plan. A synthetic fixture can pass while the real mandatory RD closeout remains
incomplete.

**Recommended:** Split the reusable closeout-validator specification from the real RD-08 closeout
gate. Run the real ST-32 last, after campaigns and `08-closeout.md` exist, and use one documented
test owner.

**Confidence:** High. **Hardening:** Independent challenger converged.  
**User Decision:** Accepted 2026-09-02 as recommended.

### PF-010: Bounded-loop cases omit the byte-domain wrap boundaries 🟠 MAJOR

**Dimension:** 9 Edge Cases  
**Location:** `03-01-vertical-generated-programs.md:132-140`; `07-testing-strategy.md:41-45`

**The Problem:** Loop tests cover small domains and budgets but not a full byte range, descending
to the minimum, or steps that cross a type extreme. The frozen semantics and current codegen have
special termination behavior for cases such as `0 to 255`; ordinary comparison logic can wrap and
execute forever or miss the terminal iteration.

**Recommended:** Add full-range ascending, descending-to-minimum and crossing-step cases, with
exact ordered traces and budget assertions, before accepting the loop and loop-unrolling relation.

**Confidence:** High. **Hardening:** Independent challenger converged.  
**User Decision:** Accepted 2026-09-02 as recommended.

### PF-011: Loop-unrolling work omits the existing closed relation dependents 🟠 MAJOR

**Dimension:** 13 Codebase Alignment  
**Location:** `99-execution-plan.md:63`; `03-01-vertical-generated-programs.md:138-140`  
**Codebase Evidence:** `packages/readiness/src/oracle-semantic-relations-candidate.ts` and the closed relation input, analysis, transform, comparison and conformance modules

**The Problem:** Task 1.2.4 names only the evaluator and relation candidate, but relation IDs,
parsing, analysis paths, transforms, comparisons and conformance allowlists are closed. Adding one
candidate branch alone either fails validation or creates a shadow authority outside the existing
relation pipeline.

**Recommended:** Name and update every closed relation dependent in the Phase 1 contract and add
end-to-end conformance/mutation tests through the existing relation path. Do not introduce a second
loop-equivalence mechanism.

**Confidence:** High. **Hardening:** Independent challenger converged.  
**User Decision:** Accepted 2026-09-02 as recommended.

### PF-012: The ambiguity register contradicts its resolved status 🟡 MINOR

**Dimension:** 12 Consistency  
**Location:** `00-ambiguity-register.md`, Systematic Gate Scan

**The Problem:** All eight ambiguity rows are resolved, but the later gate-scan text still says
they are pending. Resume logic can incorrectly treat the plan as blocked on already-decided ARs.

**Recommended:** Replace the stale pending language with the resolved outcome and retain the
decision rows as authority.  
**User Decision:** Accepted 2026-09-02 as recommended.

### PF-013: Coverage targets have no measurement task 🟡 MINOR

**Dimension:** 7 Testability  
**Location:** `07-testing-strategy.md:10-15`; `99-execution-plan.md`

**The Problem:** The strategy requires 80–90% branch coverage, and the repository has coverage
configuration, but no execution task runs or records it. Normal verification does not prove these
numeric gates.

**Recommended:** Add a bounded coverage command and recorded threshold check to the terminal
verification task for the named modules.  
**User Decision:** Accepted 2026-09-02 as recommended.

### PF-014: The plan names a duplicate failure-provenance authority 🟡 MINOR

**Dimension:** 10 Scope Creep Indicators  
**Location:** `99-execution-plan.md:174`  
**Codebase Evidence:** `packages/readiness-execution/src/execution-report-provenance.ts`; `packages/readiness-execution/src/failure-report-provenance.impl.test.ts`

**The Problem:** The task names absent `failure-report-provenance.ts`, while the existing authority
is `execution-report-provenance.ts` and already has a failure-provenance implementation test.
Following the path literally would duplicate ownership.

**Recommended:** Retarget the task to the existing execution-report provenance authority and its
test; add no new module.  
**User Decision:** Accepted 2026-09-02 as recommended.

## Recommendation Hardening

### Iteration-2 residual findings

The first remediation was rescanned at frozen content hash
`1525dba16eea89e2f5180f93e02dc75d5f55792008cff72d757d8ad8253491b3`. Three independent clusters
reported eight deduplicated major and two minor residual findings. The user's instruction to make
the best bounded choices and accept all PF findings delegates these rulings; every recommendation
below was accepted and applied before iteration 3.

| Finding | Severity | Residual problem | Applied resolution | Decision |
|---|---|---|---|---|
| PF-015 | MAJOR | Pending v2 rows had no legal claim/route wire shape | Added a closed pending/reviewed row union and mixed-variant rejection | Accepted, applied |
| PF-016 | MAJOR | Array parameters lacked alias, const-write and mismatch semantics | Required caller-storage aliasing, caller-visible mutation, const rejection and exact compatibility tests | Accepted, applied |
| PF-017 | MAJOR | ST labels were mistaken for publishable evidence identity | Added exact rule-to-stable-case/digest bindings and binding mutations | Accepted, applied |
| PF-018 | MAJOR | ST-32 preceded coverage/full verification in its terminal task | Ordered coverage, full verify, then authoritative ST-32 last | Accepted, applied |
| PF-019 | MAJOR | ST-17 was authored after its completeness implementation | Moved ST-17 RED specification work into Phase 3 before implementation | Accepted, applied |
| PF-020 | MAJOR | No task authored authoritative ST-32 | Authored ST-32 with ST-42 in Session 6.1 and retained its RED state until closeout | Accepted, applied |
| PF-021 | MAJOR | Structured-v2 identity omitted the actual v1 domain selector | Added `case-identity.ts`, explicit v2 domain separation and exact v1 digest preservation | Accepted, applied |
| PF-022 | MAJOR | ST-14 could not become an authenticated existing-route execution case | Added the existing execution-case constructor/projection seam and immutable tests | Accepted, applied |
| PF-023 | MINOR | Publication testing summary omitted ST-41 | Added ST-41 to the component coverage statement | Accepted, applied |
| PF-024 | MINOR | Final child task named the parent publication directory | Corrected it to `readiness/execution-publications/` | Accepted, applied |

**Iteration-2 hardening:** Cluster A reviewed document soundness, cluster B grounded dependencies
and feasibility against current source, and cluster C reviewed specification-first delivery and
testability. PF-017 was independently found by two clusters and merged once.

### Iteration-3 residual findings

The second remediation was rescanned at frozen content hash
`d89e1fd1f61249f0f925c23f41de58857586d52372d3777a6a27b018aa460f19`. Codebase grounding returned
no findings. Document and delivery clusters produced three deduplicated major findings and one
minor mapping inconsistency, accepted under the same delegated ruling and applied before iteration
4.

| Finding | Severity | Residual problem | Applied resolution | Decision |
|---|---|---|---|---|
| PF-025 | MAJOR | Inclusive `ST-33–ST-40` ranges wrongly pulled Phase-4 ST-34 and Phase-2 ST-37 into Phase 1 | Replaced every range with the exact non-contiguous Phase-1 set | Accepted, applied |
| PF-026 | MAJOR | The ST-37 specification file was created during implementation | Moved it to the Phase-2 spec-author RED task; implementation now changes production only | Accepted, applied |
| PF-027 | MAJOR | ST-21 had no execution-side immutable adapter/worker-boundary specification | Added an owning-package `embed-fixture-route.spec.test.ts` before implementation | Accepted, applied |
| PF-028 | MINOR | The ST-to-file ownership table omitted new owning spec files | Reconciled every Phase-1, publication, consumer and embed owner | Accepted, applied |

The plan also closes the stable evidence case ID as an exact literal union rather than leaving an
undefined generic case-ID alias.

### Iteration-4 residual finding

The third remediation was rescanned at frozen content hash
`4d4959ac004c7d462e0b3fcecfdef5475f906e8821f5cd74ce01f7f794900acf`. Document soundness and
codebase grounding returned no findings. Delivery review found one remaining specification-first
ordering defect, accepted and applied as delegated.

| Finding | Severity | Residual problem | Applied resolution | Decision |
|---|---|---|---|---|
| PF-029 | MAJOR | ST-34 and passive ST-21 expectations followed their Phase-1/Phase-2 contract implementations | Authored ST-34 in Phase 1 and passive ST-21 in Phase 2; Phase 4 now reuses them and authors only execution-side materialization | Accepted, applied |

### Iteration-5 final verification

Codebase grounding and delivery/test-ordering clusters returned no findings. Document review found
one minor stale Phase-3 ST reference; the delegated correction was applied and independently
rechecked at the final audited content hash.

| Finding | Severity | Residual problem | Applied resolution | Decision |
|---|---|---|---|---|
| PF-030 | MINOR | Phase-3 reference omitted ST-17 while its spec task correctly owned ST-16–ST-20 | Reconciled the phase reference to `ST-16–ST-20`; exact recheck returned no findings | Accepted, applied, verified |

## Original Recommendation Hardening

Five independent audit clusters reviewed document soundness, codebase grounding, delivery,
risk/edge behavior and product fit. One blind design challenger then attempted to refute or
downgrade every major finding. All 11 survived as major. The challenger converged on every
recommendation; PF-008 carries medium-high rather than high confidence because the exact independent
taxonomy derivation still needs to be written into the plan.

PF-003, PF-004 and PF-006 should be implemented as one v2 publication workstream with distinct
acceptance gates. PF-007 and PF-008 remain separate because exact rule membership and semantic
family completeness prove different properties.

## Verdict

✅ **PREFLIGHT PASSED.** All 23 major and 7 minor findings are accepted, remediated and verified.
The 62-task plan is ready for specification-first execution. No production code, tests,
publication bytes or frozen specification files changed during preflight.
