# Preflight Report: RD-05 Failure Classification, Shrinking and Regression Promotion

> **Status**: ✅ PREFLIGHT PASSED — all 12 findings resolved and verified
> **Iteration**: 2 (bounded full rescan)
> **Artifact**: single requirement at `codeops/features/compiler-readiness/requirements/RD-05-failure-reduction.md`
> **Artifact Git Blob**: `41fef8e2cfade59dd7839a7317c45996b89733e4`
> **Artifact SHA-256**: `e5b47708509ade513ad2c951d53997da530851ebb4c15eb1bef9d794835ae909`
> **Scope Mode**: strict
> **Authorized Modification Set**: `RD-05-failure-reduction.md`, plus this report and continuity notes
> **Codebase Grounded**: 14 production source files, 2 specification tests, 7 configuration/context artifacts, and 31 direct references verified
> **Last Updated**: 2026-08-26

## Audit Scope

The audit target is RD-05 only. RD-02, RD-04, RD-06, the shared ambiguity register, project policy,
and current readiness source code are context documents used to test RD-05's claims. Findings do not
assert that those context documents passed this audit, and no sibling requirement is in the
modification set.

The authorized product baseline is failure classification, bounded deterministic shrinking,
deduplication, and regression promotion for generated RD-02/RD-04 non-pass evidence. Compiler or
frozen-spec modification, failing-output approval, and optional product expansion are excluded.

## Codebase Context Summary

**Tech Stack:** TypeScript ESM on Node 22, Yarn classic workspaces, Turborepo, Vitest, ESLint.

**Architecture:** `@blend65/readiness` owns immutable inventory, generated-case, replay, oracle, and
publication authority. `@blend65/readiness-execution` owns the six terminal execution routes,
bounded external processes, secure filesystem operations, and canonical authority reports.

**Key Files Examined:**

- `packages/readiness/src/campaign-model.ts`
- `packages/readiness/src/modeled-generator-model.ts`
- `packages/readiness/src/generate-case.ts`
- `packages/readiness/src/replay.ts`
- `packages/readiness/src/execution-case.ts`
- `packages/readiness/src/published-diagnostic-case.ts`
- `packages/readiness/src/execution-contracts.ts`
- `packages/readiness/src/case-generator.ts`
- `packages/readiness/src/semantic-relations.ts`
- `packages/readiness-execution/src/execution-orchestration.ts`
- `packages/readiness-execution/src/execution-route-adapters.ts`
- `packages/readiness-execution/src/execution-authority-report.ts`
- `packages/readiness-execution/src/execution-publication-secure-filesystem.ts`
- `packages/readiness-execution/src/execution-worker-executor.ts`
- `packages/readiness/src/campaign-replay.spec.test.ts`
- `packages/readiness-execution/src/execution-orchestration.spec.test.ts`

**Key Observations:**

- `ExecutionResultV1` keeps result code, tier, stage, bounded evidence, and cleanup blocker as
  separate facts; a broad “failure class” is not a complete predicate identity.
- Exact replay requires the complete replay envelope and revision authorities. The persisted RD-04
  report retains digests and terminal records, but not replay-envelope bytes, typed IR, source, or
  raw oracle observations.
- Current route constructors authenticate only an original campaign ordinal. A reduced candidate
  has different source/IR and cannot pass those authority boundaries.
- Current generated cases are typed valid cases or typed invalid transforms. There is no production
  raw token/text malformed-case ingress.
- Specification tests are active immutable oracles, while project commits must be green. A current
  defect cannot be activated into that tier before its separately owned compiler fix.

**Domain Lenses:** compiler and language; data and migration; universal security, testability,
traceability, and ambiguity checks.

**Review Independence:** five clustered preflight auditors scanned an exact partition of all 13
dimensions. One independent challenger reviewed the complete merged high-severity batch. It
retained every root cause, raised five to critical, changed the recommendations for PF-001 and
PF-010, and found no additional critical or major root cause.

## Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|---|---:|---|
| 1 | Ambiguities | 4 | 🔴 Critical |
| 2 | Implicit Assumptions | 3 | 🔴 Critical |
| 3 | Logical Contradictions | 2 | 🔴 Critical |
| 4 | Completeness Gaps | 7 | 🔴 Critical |
| 5 | Dependency Issues | 3 | 🔴 Critical |
| 6 | Feasibility Concerns | 6 | 🔴 Critical |
| 7 | Testability | 6 | 🔴 Critical |
| 8 | Security Blind Spots | 2 | 🔴 Critical |
| 9 | Edge Cases | 5 | 🔴 Critical |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 1 | 🔴 Critical |
| 12 | Consistency | 2 | 🟠 Major |
| 13 | Codebase Alignment | 7 | 🔴 Critical |

## Summary by Severity

| Severity | Count | Status |
|---|---:|---|
| 🔴 Critical | 5 | Resolved and verified in iteration 2 |
| 🟠 Major | 7 | Resolved and verified in iteration 2 |
| 🟡 Minor | 0 | — |
| 🔵 Observation | 0 | — |

---

## Critical Findings

### PF-003: The persisted fields cannot replay a historical failure 🔴 CRITICAL

**Dimensions:** Implicit Assumptions, Dependency Issues, Codebase Alignment

**Location:** `RD-05-failure-reduction.md:25-26,40-43,65-66`

**Codebase Evidence:** `packages/readiness/src/replay.ts:29-36,135-177` requires replay-envelope
bytes plus a revision registry; `packages/readiness-execution/src/execution-orchestration.ts:94-123`
shows that the RD-04 report does not retain the complete replay envelope, route-plan bytes, source,
or generation configuration.

**The Problem:** “Original identity,” seed, case ID, target, and unspecified “versions” cannot
reconstruct the exact source case, route, policy, oracle, and publication after revisions change.
AC-3 is impossible without a complete, resolvable historical authority.

**Only viable resolution:** Define a bounded `FailureEnvelopeV1` that embeds or content-addresses
the exact `ReplayEnvelopeV1`, route-plan bytes and policy, selected inventory/oracle/execution
publication authorities, projection revisions, tool identities, and resolver contracts. Missing
historical content returns an explicit unavailable result; current code is never substituted.

**Rejected:** Persisting source alone bypasses the authenticated campaign and oracle contracts;
persisting only more digests still cannot reconstruct unavailable bytes.

**Recommendation:** Adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution and authorized its in-scope fix on 2026-08-26.

**Confidence:** High — complete replay inputs are explicit in the current public contracts.
**Hardening:** The challenger tightened the retained authority set and endorsed content-addressed
references to avoid duplicate large artifacts. **Challenger: converged.**

### PF-004: RD-04 cannot execute a reduced candidate through its authority boundary 🔴 CRITICAL

**Dimensions:** Completeness Gaps, Dependency Issues, Feasibility, Codebase Alignment

**Location:** `RD-05-failure-reduction.md:21-24,40-43`

**Codebase Evidence:** `packages/readiness/src/execution-case.ts:244-256` and
`packages/readiness/src/published-diagnostic-case.ts:119-141` authenticate only a regenerated
campaign ordinal. `packages/readiness-execution/src/execution-route-adapters.ts:44-98` requires
those opaque authorities. A reduced source no longer has the authenticated original digest.

**The Problem:** Direct compiler invocation would bypass the original route, fixture, obligation,
oracle, and policy, while reusing the original identity would be false. The central shrink loop has
no feasible authoritative execution seam.

**Only viable resolution:** Add a domain-separated, revision-bound
`ReductionCandidateAuthorityV1`, derived from authenticated original replay authority, candidate
IR/source digest, canonical transformation trace, predicate identity, and original route. It gets a
new execution identity and can execute only through the same obligation, tier, policy, fixture, and
oracle predicate. Original `CaseIdentity` remains immutable.

**Rejected:** Weakening current opaque route constructors would make arbitrary bytes appear to be
published campaign evidence.

**Recommendation:** Adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution and authorized its in-scope fix on 2026-08-26.

**Confidence:** High — the existing constructors reject every non-ordinal candidate by design.
**Hardening:** Independent delivery and grounding reviewers found the same missing seam.
**Challenger: converged.**

### PF-007: Raw malformed token/text cases do not exist in the completed dependencies 🔴 CRITICAL

**Dimensions:** Implicit Assumptions, Dependency Issues, Feasibility, Codebase Alignment

**Location:** `RD-05-failure-reduction.md:23,63-64`

**Codebase Evidence:** `packages/readiness/src/modeled-generator-model.ts:160-211` exposes typed
valid IR or a typed baseline plus a closed invalid transform. Published diagnostic authority accepts
only `invalid-source-transform` at `packages/readiness/src/published-diagnostic-case.ts:30-41`.

**The Problem:** RD-02/RD-04 cannot supply the raw malformed population that AC-2 unconditionally
requires. A synthetic unit fixture would not prove production campaign integration.

**Options:**

| Option | Description | Trade-off |
|---|---|---|
| A | RD-05 owns a closed, bounded malformed-case ingress in `@blend65/readiness` and matching diagnostic-route authority in `@blend65/readiness-execution`. | Preserves RD-05 scope and unblocks RD-06; adds prerequisite generation work. |
| B | Give production malformed ingress to an explicit prerequisite and mark RD-05 blocked until it lands. | Preserves narrower ownership but RD-05 cannot close AC-2 or unblock RD-06. |

**Recommendation:** Option A. The ingress is required by RD-05's stated unconditional behavior; it
is not optional expansion.

**User Decision:** Resolved — user accepted recommended Option A and authorized its in-scope fix on 2026-08-26.

**Confidence:** High — production type unions and route authorities contain no raw malformed arm.
**Hardening:** The challenger selected A; B remains viable only as an explicit blocked state.
**Challenger: converged.**

### PF-008: Immediate active spec-test promotion cannot produce a green RD-05 checkpoint 🔴 CRITICAL

**Dimensions:** Logical Contradictions, Feasibility, Testability, Ordering & Sequencing

**Location:** `RD-05-failure-reduction.md:28,32-35,67-70`

**Codebase Evidence:** Project policy defines `*.spec.test.ts` as the active immutable specification
tier and permits commits only at green verification checkpoints. RD-05 excludes compiler
modification but requires the regression to fail while the defect is present.

**The Problem:** Activating a real current defect as a test makes the tree red, while RD-05 neither
owns nor may perform the fix. Disabled or expected-failure tests would approve broken behavior and
do not meet AC-5.

**Only viable resolution:** Define a two-state lifecycle: immediately publish an immutable,
expectation-bearing inactive regression candidate with append-only discovery provenance; activate
the unchanged candidate into the specification tier only alongside a separately owned compiler fix
and a green checkpoint. Direct activation is allowed when the compiler already passes it.

**Rejected:** Expected-failure tests reverse the oracle; uncommitted generated tests are not durable
promotion; automatic compiler changes violate scope.

**Recommendation:** Adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution and authorized its in-scope fix on 2026-08-26.

**Confidence:** High — the contradiction follows directly from the RD and repository gate.
**Hardening:** Three independent clusters converged on the two-state lifecycle.
**Challenger: converged.**

### PF-010: Durable failure evidence lacks a safe concurrent publication model 🔴 CRITICAL

**Dimensions:** Completeness Gaps, Security, Edge Cases, Codebase Alignment

**Location:** `RD-05-failure-reduction.md:25-30,55-58,67-68`

**Codebase Evidence:** Existing report publication rejects different bytes at a no-clobber target
rather than merging provenance (`packages/readiness-execution/src/execution-authority-report.ts:561-572,639-666`). Existing secure filesystem code pins directory/file identity and performs
durable no-follow operations in
`packages/readiness-execution/src/execution-publication-secure-filesystem.ts:60-261`.

**The Problem:** Allowlisted filenames do not prevent symlink/directory substitution, tampered or
oversized records, partial writes, or concurrent provenance loss. Two campaigns racing to promote
the same regression can violate AC-4 even if deduplication is correct.

**Options:**

| Option | Description | Trade-off |
|---|---|---|
| A | Immutable content-addressed failure cores, append-only individually no-clobber provenance events, and a derived activation/projection marker. | Naturally idempotent and avoids mutable lost updates; requires reconciliation/projection logic. |
| B | Lock-protected transactional read–merge–publish of one mutable provenance document. | Simpler read model; increases lock, torn-merge, and crash-recovery risk. |

Both require closed bounded parsing, domain-separated digest validation and collision rejection,
pinned no-follow reads, file/directory durability, idempotent retry, and orphan recovery.

**Recommendation:** Option A. It matches the repository's immutable-authority architecture and is
safer under concurrent retry.

**User Decision:** Resolved — user accepted recommended Option A and authorized its in-scope fix on 2026-08-26.

**Confidence:** High — new durable authority influences test activation and must not be forgeable or
lose provenance.
**Hardening:** The challenger changed the recommendation from mutable merge to immutable core/event
publication. **Challenger: diverged — improved remedy, same finding.**

## Major Findings

### PF-001: Failure preservation and regression deduplication conflate different identities 🟠 MAJOR

**Dimensions:** Ambiguities, Logical Contradictions, Completeness, Consistency, Codebase Alignment

**Location:** `RD-05-failure-reduction.md:12-14,24-28,40-43,65-70`

**Codebase Evidence:** `packages/readiness/src/execution-contracts.ts:31-51,141-189` models rule
obligation, tier, stage, code, evidence, and cleanup blocker as separate facts.

**The Problem:** “Same failure class” can retain a different stage or predicate. The dedup key then
omits tier, obligation, stage, predicate, and cleanup status, allowing distinct failures to collapse.
One identity also cannot remain stable while source changes during shrinking and then include the
final minimized source for promotion.

**Only viable resolution:** Define two versioned identities:

1. `FailurePredicateV1` for preservation: required rule claims, target, obligation, terminal
   tier/stage/code, oracle release and predicate-contract identity, plus separately classified
   cleanup blocker.
2. `PromotedFailureKeyV1` for deduplication: canonical minimized-content digest plus the complete
   `FailurePredicateV1`.

Source-bound evaluation identities and adapter detail are excluded unless the predicate contract
explicitly declares them invariant.

**Recommendation:** Adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution and authorized its in-scope fix on 2026-08-26.

**Confidence:** High.
**Hardening:** The challenger split one proposed signature into preservation and promotion
identities. **Challenger: diverged — improved remedy, same finding.**

### PF-002: Non-source failures have no closed disposition 🟠 MAJOR

**Dimensions:** Ambiguities, Completeness, Edge Cases, Testability

**Location:** `RD-05-failure-reduction.md:20-30`

**Codebase Evidence:** RD-04 includes authority, unavailable-tier, capacity, resource, launch,
handshake, and lease-recovery outcomes in `packages/readiness/src/execution-contracts.ts:31-51`.
RD-06 accepts classified campaign evidence rather than a reproducer for infrastructure failures.

**The Problem:** “Every non-pass” is classified, but the RD never states which outcomes are
shrinkable, require fresh confirmation, or are campaign-only infrastructure evidence. Source
reduction of an unavailable tool or lease blocker is meaningless.

**Only viable resolution:** Define a closed versioned disposition transition table over every
tier/stage/code: direct shrink candidate, fresh confirmation/retry, or campaign-only evidence.
Unknown future values fail closed. Treat `cleanupBlocker` as a second classified non-pass that may
coexist with the primary result.

**Recommendation:** Adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution and authorized its in-scope fix on 2026-08-26.

**Confidence:** High.
**Hardening:** Reviewers tested the strongest counterargument—code-only mapping—and retained
stage/tier confirmation because timeout and resource failures are contextual.
**Challenger: converged.**

### PF-005: Typed shrinking does not preserve the complete rule and invalid-neighbor contract 🟠 MAJOR

**Dimensions:** Ambiguities, Feasibility, Edge Cases, Consistency

**Location:** `RD-05-failure-reduction.md:12-14,21-22,40-43`

**Codebase Evidence:** `packages/readiness/src/modeled-generator-model.ts:194-210` separately carries
primary and claimed rules, validity kind, neighbor, violated predicate, diagnostic family, bindings,
and transform. Rendering depends on exactly resolved transform paths.

**The Problem:** Removing or reordering IR can stale or retarget a path while retaining the same
broad failure code. “Rule coverage,” “target rule,” “rule set,” and “primary target rule” do not say
which facts must survive.

**Only viable resolution:** Revalidate a family-specific invariant after every edit: validity kind,
primary rule, fail-closed required subset of claimed rules, neighbor/predicate/diagnostic family and
context, exactly one intentional violation, complete type-correct bindings, and paths rebased to
resolve exactly once. Deviations from original claims require an explicit predicate contract.

**Recommendation:** Adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution and authorized its in-scope fix on 2026-08-26.

**Confidence:** High.
**Hardening:** The challenger avoided over-constraining incidental paths or bindings while preserving
their semantic contracts. **Challenger: converged.**

### PF-006: Minimality, normalization, and candidate ordering are undefined 🟠 MAJOR

**Dimensions:** Ambiguities, Completeness, Testability

**Location:** `RD-05-failure-reduction.md:27-28,67-68`

**The Problem:** “Minimal” could mean globally smallest, locally irreducible, or merely smaller.
“Normalized source” is unsafe without separate rules for canonical typed rendering and deliberately
malformed bytes. Different runs can select different reproducers or conflate distinct malformed
inputs.

**Only viable resolution:** Define versioned deterministic policies per shrink family: closed
candidate enumeration, explicit lexicographic monotone metric, deterministic tie-breaker, and a
one-minimal fixed point. Typed cases normalize through canonical IR rendering; malformed cases
retain authoritative bytes and use separately specified predicate-safe normalization.

**Recommendation:** Adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution and authorized its in-scope fix on 2026-08-26.

**Confidence:** High.
**Hardening:** Global minimality was rejected as infeasible; deterministic one-minimality is measurable
and sufficient. **Challenger: converged.**

### PF-009: Shrink budgets and exhaustion behavior are not measurable 🟠 MAJOR

**Dimensions:** Completeness, Testability, Scope Control

**Location:** `RD-05-failure-reduction.md:40,55-58`

**Codebase Evidence:** RD-04's execution policy bounds individual operations but contains no shrink
attempt, repeated route, provenance-event, or durable-output limits.

**The Problem:** All current acceptance criteria can pass with arbitrary caps or nondeterministic
stopping. Different limits can produce different minima without changing identity.

**Only viable resolution:** Define `failure-reduction-policy-v1` with inclusive positive-safe-
integer maxima for candidate attempts, terminal route executions, oracle invocations, diagnostic
capture, provenance events/sequence length, and total durable bytes. Bind selected values into
reduction identity; define deterministic exhaustion disposition; test exact-limit/next-event and
fresh-process identity.

**Recommendation:** Adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution and authorized its in-scope fix on 2026-08-26.

**Confidence:** High.
**Hardening:** Reusing RD-04 budgets was rejected after verifying that they cover different resource
dimensions. **Challenger: converged.**

### PF-011: The environment-value ban conflicts with byte-authoritative source 🟠 MAJOR

**Dimensions:** Feasibility, Security, Edge Cases, Testability

**Location:** `RD-05-failure-reduction.md:25-30,55-58,71`

**Codebase Evidence:** Readiness workers inherit most of the ambient environment at
`packages/readiness-execution/src/execution-worker-executor.ts:125-131`.

**The Problem:** An environment value can be empty, short, or identical to legitimate source text.
A whole-record substring ban is untestable and can corrupt the reproducer; field-only ad-hoc
redaction can miss diagnostics or tool output.

**Only viable resolution:** Preserve exact candidate source bytes and exempt them from redaction.
Structurally exclude environment maps, commands, and arbitrary host files. Classify every other
field as excluded, typed-normalized, or bounded/redacted; reject unknown fields and prove non-leakage
with seeded high-entropy environment canaries. Minimize worker environment where route semantics
permit it.

**Recommendation:** Adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution and authorized its in-scope fix on 2026-08-26.

**Confidence:** Medium — this changes only if all processing is proven to run in an environment-free
process.
**Hardening:** The risk challenger and batch challenger converged on provenance-aware canary testing.
**Challenger: converged.**

### PF-012: Standalone promotion can hide worker-state and case-order failures 🟠 MAJOR

**Dimensions:** Completeness, Feasibility, Edge Cases, Testability, Codebase Alignment

**Location:** `RD-05-failure-reduction.md:24,65-70`

**Codebase Evidence:** `packages/readiness-execution/src/execution-worker-executor.ts:17-18,416-438`
reuses a worker for up to eight cases.

**The Problem:** A failure caused by module state or prior-case contamination can reproduce in the
campaign pool but disappear when the minimized source runs alone. Promoting only that source would
misidentify the defect.

**Only viable resolution:** Require final confirmation in a fresh worker and workspace under the
same route, predicate, and policy. If it disappears, attempt a bounded deterministic sequence
reproducer and classify it separately as a stateful-sequence regression; never promote the final
source alone.

**Recommendation:** Adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution and authorized its in-scope fix on 2026-08-26.

**Confidence:** High.
**Hardening:** Only final confirmation—not every shrink attempt—needs fresh isolation, limiting the
cost while proving standalone validity. **Challenger: converged.**

## Iteration-2 Resolution Verification

| Findings | Verified requirement surface | Result |
|---|---|---|
| PF-001, PF-002 | Separate predicate/promotion identities; exhaustive code-tier-stage disposition relation; closed cleanup and reduction outcomes | Closed |
| PF-003, PF-004 | Complete typed/raw historical envelopes; domain-separated reduction-candidate authority through the original route contract | Closed |
| PF-005, PF-006 | Immutable rule subset; complete typed-invalid invariants; non-empty deterministic catalog; catalog-wide one-minimality | Closed |
| PF-007, PF-008 | Bounded production raw-malformed ingress; immutable inactive candidate followed by green activation | Closed |
| PF-009 | Versioned selected limits, hard maxima, identity binding, and exact-limit exhaustion behavior | Closed |
| PF-010 | Campaign-independent immutable cores, append-only per-campaign events, durable no-clobber publication, and recovery | Closed |
| PF-011 | Exact source isolation, typed persisted evidence, structural exclusion, and canary validation | Closed |
| PF-012 | Two fresh-worker confirmations and separately persisted stateful-sequence evidence | Closed |

Five independent clusters rescanned all 13 dimensions against the final artifact and current
codebase. One intermediate tuple-matrix mismatch, one policy/core consistency issue, and three risk
edge cases were corrected within their already authorized root causes and rechecked. The final scan
reported zero new, carried, or reopened findings.

## Current Verdict

**✅ PREFLIGHT PASSED — all 12 findings are resolved and iteration-2 verification is clean.**

RD-05 may advance to **RD Preflighted**. Strict scope introduced no optional product expansion, and
the compiler plus frozen specification remain outside the modification set.
