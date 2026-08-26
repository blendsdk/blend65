# Preflight Report: RD-05 Failure Reduction Plan

> **Status**: ✅ PASSED — all 20 first-scan findings resolved and verified
> **Iteration**: 3 — final targeted scan
> **Artifact**: complete implementation plan; the 11 audited Markdown documents in
> `codeops/features/compiler-readiness/plans/rd-05-failure-reduction/`
> **Artifact Tree**: `b86d924c0133da9c75b69524274bcc8153d62ad0`
> **Scan Commit**: `7ecfad6df5af3e1e8e03e22d0261bdf426b2810a`
> **Scope**: strict; report and working notes are audit outputs, not audited plan documents
> **Codebase Grounded**: 15 core source modules, 9 test/config surfaces, and all 13 existing plan
> file references examined
> **Last Updated**: 2026-08-26
>
> ⚠️ **SAME-SESSION REVIEW**: the same lead model created this plan earlier in the current session.
> Five independent clustered auditors and one independent recommendation challenger were used to
> reduce same-agent bias. A human compiler/toolchain review remains prudent before execution.

## Audit Scope

**Audit target:** all 11 committed RD-05 plan documents represented by the artifact tree above.

**Context documents:** RD-05 requirements and their passing preflight report; RD-02/RD-04 artifacts;
the compiler-readiness roadmap; `AGENTS.md`; package manifests; CI; current readiness and
readiness-execution source/tests; selected execution-publication evidence.

**Modification set:** all 11 plan documents and this report. The user authorized every recommended
ruling and remediation under strict scope with `--auto-design --auto-commit`.

**Product-scope baseline:** approved RD-05 failure classification, deterministic reduction,
authenticated candidate execution, immutable failure evidence, green-checkpoint activation, and the
required RD-04 handler-publication refresh. No optional compiler, specification, CLI, or network
behavior was admitted.

**Selected domain lenses:** compiler and language; distributed and concurrent; data and migration;
universal security, compatibility, testability, traceability, and ambiguity checks.

## Codebase Context Summary

**Tech stack:** TypeScript ESM, Node 22, Yarn classic workspaces, Turborepo, Vitest, ESLint, and
Prettier.

**Architecture:** `@blend65/readiness` owns immutable domain authorities and canonical identities;
`@blend65/readiness-execution` depends on readiness and owns compiler, worker, process, tool, and
filesystem I/O. Existing route requests form a closed valid/typed-invalid union and dispatch through
six generated content-bound handlers. Campaign workers deliberately serve up to eight cases. The
RD-04 V1 report is a compact summary, not a replay bundle. Existing publication primitives already
provide pinned no-follow reads, synced exclusive temporary writes, no-clobber commit, byte
revalidation, and directory durability.

**Key files examined:**

- `packages/readiness/src/execution-contracts.ts`, `replay-input-model.ts`,
  `modeled-generator-model.ts`, `execution-case.ts`, `published-diagnostic-case.ts`,
  `canonical-identity.ts`, `campaign-state.ts`, and `index.ts`;
- `packages/readiness-execution/src/execution-route-adapters.ts`,
  `execution-worker-executor.ts`, `execution-worker-entry.ts`, `execution-orchestration.ts`,
  `execution-authority-report.ts`, `execution-vice-evaluation.ts`,
  `execution-publication-catalog.ts`, `execution-publication-secure-filesystem.ts`, and the generated
  handler catalog;
- the matching specification/implementation suites, both Vitest configs,
  `scripts/gen-execution-bindings.mjs`, package manifests, CI workflow, and selected publication
  pointer.

**Reference verification:** all 13 existing paths named by `02-current-state.md` exist and match
their described responsibilities. Proposed `failure-*` modules are intentionally new.

## Direct Artifact Checks

- 11 required documents, 113 sections, 14 resolved ambiguity entries, and no broken relative links.
- 70 execution tasks and 58 unique specification cases.
- Phases 1–5 place specification authoring and an observed RED before their nominal production work.
- All plan Markdown passed Prettier; `spec/` was unchanged.
- Strict-scope scan found no scope-creep defect.

## Summary by Dimension

| # | Dimension | Primary findings | Highest severity |
|---:|---|---:|---|
| 1 | Ambiguities | 3 | 🟠 Major |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | 4 | 🔴 Critical |
| 4 | Completeness Gaps | 1 | 🟠 Major |
| 5 | Dependency Issues | 2 | 🟠 Major |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 4 | 🟠 Major |
| 8 | Security Blind Spots | 1 | 🟠 Major |
| 9 | Edge Cases | 0 | — |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 2 | 🔴 Critical |
| 12 | Consistency | 1 | 🟠 Major |
| 13 | Codebase Alignment | 2 | 🟠 Major |

## Summary by Severity

| Severity | Count | Status |
|---|---:|---|
| 🔴 Critical | 3 | Resolved and verified |
| 🟠 Major | 15 | Resolved and verified |
| 🟡 Minor | 2 | Resolved and verified |
| 🔵 Observation | 0 | — |

## Critical Findings

### PF-001: Sequence isolation erases the state it must reproduce 🔴 CRITICAL

**Dimension:** Logical Contradictions

**Location:** `00-ambiguity-register.md:23,145-149`; `03-03-candidate-execution.md:98-101`;
`99-execution-plan.md:101-102`

**Codebase Evidence:** `packages/readiness-execution/src/execution-worker-executor.ts:17-18,424-438`;
`packages/readiness-execution/src/execution-orchestration.ts:684-736`

**The Problem:** the plan requires a new worker/workspace for every sequence step, but a stateful
failure exists because earlier cases affect a later case in the same worker. Per-case replacement
destroys that state and misclassifies genuine contamination as flaky.

**Only viable resolution:** create one fresh worker/process per complete ordered sequence attempt,
reuse it across that attempt's cases while preserving the ordinary per-case workspace lifecycle,
and isolate independent attempts and standalone confirmations. Persist ordered case plus worker/batch
evidence and test failures on cases 2–8.

**Rejected:** per-case freshness cannot reproduce cross-case state.

**Recommendation:** adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution on 2026-08-26; applied and verified in iteration 3.

**Confidence:** High — the present worker reuse is the exact state channel under diagnosis.
**Hardening:** the challenger refined workspace ownership but retained the ruling.
**Challenger:** converged.

### PF-002: Generated-binding freshness makes intermediate green commits impossible 🔴 CRITICAL

**Dimension:** Ordering & Sequencing

**Location:** `99-execution-plan.md:50-60,95-105,141-168`;
`03-05-orchestration-and-closeout.md:85-95`

**Codebase Evidence:** `scripts/gen-execution-bindings.mjs:15-45`;
`packages/readiness-execution/src/execution-publication-catalog.spec.test.ts:323-339`;
`packages/readiness-execution/src/execution-publication-catalog.impl.test.ts:111-115`

**The Problem:** Phase 1 changes readiness runner dependencies and Phase 3 changes handler/worker
dependencies, but regeneration waits until Phase 6 after earlier mandatory full verifies. Existing
tests fail as soon as emitted dependency bytes no longer match the generated catalog. Phase 6 also
verifies before its regeneration task.

**Only viable resolution:** regenerate and check bindings after every participating-byte change and
before that phase's full verify/commit. Move final regeneration ahead of Phase 6 verification and
repeat it after every later code-affecting fix. Continue deferring semantic acceptance, child
preparation, real acceptance, and selection until final closeout.

**Rejected:** deferring all participating implementation until Phase 6 destroys the staged
specification-first architecture.

**Recommendation:** adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution on 2026-08-26; applied and verified in iteration 3.

**Confidence:** High — ordinary tests directly enforce the generated closure.
**Hardening:** independent delivery and grounding scans found the same deadlock.
**Challenger:** converged.

### PF-003: Frozen specification cases precede their executable dependencies 🔴 CRITICAL

**Dimension:** Ordering & Sequencing

**Location:** `07-testing-strategy.md:29-35,46,103-117`;
`99-execution-plan.md:50-58,72-81,117-126`

**Codebase Evidence:** `packages/readiness-execution/src/index.ts:23`;
`packages/readiness/package.json:35`; `packages/readiness/tsconfig.json:1`;
`packages/readiness-execution/vitest.config.ts:3-6`

**The Problem:** ST-06 requires event identity before events exist; ST-09 assigns Phase 2 raw
authority to the Phase 1 file; ST-12 requires the execution-package RD-04 serializer from a
readiness-owned file; and ST-18 requires Phase 2 reduction plus Phase 3 execution plus Phase 4
promotion. Phase 4 then assigns dynamic specification-runner implementation after the specification
file is frozen. The stated GREEN checkpoints require early future implementation, a forbidden
reverse dependency, or editing a frozen oracle.

**Only viable resolution:** repartition each assertion to its first executable phase/package and
split multi-stage cases while preserving traceability: run identity in Phase 1 and event/core
identity in Phase 4; raw authority in Phase 2; report compatibility in an execution-owned file;
zero-byte reduction, execution, and lifecycle across Phases 2–4/5. Author the complete dynamic test
registration in task 4.1.2; task 4.2.6 implements production loading, graph validation, and execution
only.

**Rejected:** implementing every later subsystem early defeats package direction and phase ordering.

**Recommendation:** adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution on 2026-08-26; applied and verified in iteration 3.

**Confidence:** High — the named interfaces and package edges do not exist in the assigned phases.
**Hardening:** the challenger merged the runner-freeze symptom into this root ordering defect.
**Challenger:** converged.

## Major Findings

### PF-004: Failure route identity omits the original request kind 🟠 MAJOR

**Dimension:** Consistency

**Location:** `03-01-contracts-and-history.md:114-146`; `03-03-candidate-execution.md:46-56`

**Codebase Evidence:** `packages/readiness-execution/src/execution-route-adapters.ts:44-87`

**The Problem:** the candidate contract promises to preserve route kind, and RD-05 requires it in
the route identity, but `FailureRouteContractV1` has no discriminator. Valid and diagnostic arms can
share a terminal tier and obligation, so their predicate/promotion identities can collide.

**Only viable resolution:** add a closed original-route-kind field, explicitly normalize the legacy
omitted valid kind, bind it into canonical equality, and add field-mutation/cross-arm tests.

**Recommendation:** adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution on 2026-08-26; applied and verified in iteration 3.

**Confidence:** High. **Hardening:** no stronger alternative survived. **Challenger:** converged.

### PF-005: Candidate replay rejection conflicts with required repeated execution 🟠 MAJOR

**Dimension:** Logical Contradictions

**Location:** `03-03-candidate-execution.md:52-56,83-96,118-121`

**The Problem:** adapters must reject replayed candidate authority, yet confirmation accepts one
request and executes the same candidate twice. Single-use authority makes the second run fail;
reusable authority contradicts the replay test.

**Only viable resolution:** make immutable candidate authority reusable only through the bounded
coordinator and mint a distinct single-use execution/evaluation token for every reduction,
confirmation, control, and sequence invocation. Reject token reuse, not legitimate candidate reuse.

**Recommendation:** adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution on 2026-08-26; applied and verified in iteration 3.

**Confidence:** High. **Hardening:** token scope was expanded to every invocation kind.
**Challenger:** converged.

### PF-006: Invalid UTF-8 is simultaneously preserved and rejected 🟠 MAJOR

**Dimension:** Logical Contradictions

**Location:** `03-02-reduction-engine.md:52-56,188-205`; `07-testing-strategy.md:47`;
`99-execution-plan.md:74`

**Codebase Evidence:** `packages/readiness-execution/src/execution-worker-entry.ts:26-28,236`

**The Problem:** production accepts only valid UTF-8 and the existing worker decodes fatally, while
the frozen test strategy requires preservation of a single invalid byte sequence.

**Only viable resolution:** retain the approved valid-UTF-8 boundary, replace the preservation
fixture with malformed-but-validly-encoded source (including BOM/path-like cases), and add explicit
invalid-UTF-8 rejection before authority minting.

**Rejected:** arbitrary-byte execution requires a new unapproved route contract.

**Recommendation:** adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution on 2026-08-26; applied and verified in iteration 3.

**Confidence:** High. **Hardening:** all three relevant clusters converged. **Challenger:** converged.

### PF-007: Equal-size normalization has no legal reducer transition 🟠 MAJOR

**Dimension:** Ambiguities

**Location:** `03-02-reduction-engine.md:111-114,147-151`; `07-testing-strategy.md:52`;
`99-execution-plan.md:78-80`

**The Problem:** equal-size deterministic normalization is permitted, while `next` can propose only
strictly smaller edits and ST-24 rejects all equal-size edits. No API, progress rank, trace rule, or
evaluation path exists for normalization.

**Only viable resolution:** define an idempotent normalization phase before enumeration and after
each accepted decreasing edit, with a separate normalization trace. If it changes execution-bearing
bytes, evaluate it through the ordinary authenticated predicate path. Keep catalog edits strictly
decreasing and distinguish them in ST-24.

**Recommendation:** adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution on 2026-08-26; applied and verified in iteration 3.

**Confidence:** High. **Hardening:** the challenger added predicate evaluation for byte-changing
normalization. **Challenger:** converged.

### PF-008: Orphan provenance events are both ignored and fail-closed 🟠 MAJOR

**Dimension:** Logical Contradictions

**Location:** `03-04-evidence-and-regressions.md:73-79,100-104,126-135`;
`07-testing-strategy.md:79`

**The Problem:** the recovery model permits immutable orphan events outside projections, while the
dynamic loader promises to validate every record/cross-reference and fail on orphan-event faults.
A valid crash residue can therefore either be harmless or permanently break `yarn test`.

**Only viable resolution:** define active discovery by activation-rooted reachability. Fail closed
for every reachable activation/core/candidate reference; ignore valid unreferenced immutable events
in active projections while surfacing non-authoritative reconciliation diagnostics.

**Recommendation:** adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution on 2026-08-26; applied and verified in iteration 3.

**Confidence:** High. **Hardening:** no stronger alternative survived. **Challenger:** converged.

### PF-009: Reduction policy has multiple competing authorities 🟠 MAJOR

**Dimension:** Ambiguities

**Location:** `03-01-contracts-and-history.md:95-98,173-180`;
`03-02-reduction-engine.md:132-135,179-181`; `03-05-orchestration-and-closeout.md:17-24`

**The Problem:** the envelope contains a selected policy, while the session factory and orchestrator
accept another. The plan does not define mismatch, override, or rerun semantics even though policy
participates in identity.

**Only viable resolution:** materialize the orchestrator-selected policy into the authenticated
envelope and derive the session policy solely from that envelope.

**Rejected:** a second argument plus equality guard preserves two authorities and future drift.

**Recommendation:** adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution on 2026-08-26; applied and verified in iteration 3.

**Confidence:** High. **Hardening:** the challenger preferred authority elimination over an equality
guard. **Challenger:** converged.

### PF-010: Raw replay exposes two competing authoritative source fields 🟠 MAJOR

**Dimension:** Ambiguities

**Location:** `03-01-contracts-and-history.md:160-171`;
`03-02-reduction-engine.md:30-40`

**The Problem:** `MalformedReplayEnvelopeV1` owns `sourceBytes`, but the raw arm repeats another
`sourceBytes` without an equality or canonical-source rule. Replay, identity, and execution can
select different bytes.

**Only viable resolution:** remove the outer raw source copy and derive raw bytes solely from the
authenticated malformed envelope. Retain a separate outer source only for typed replay, whose
existing envelope lacks rendered source.

**Recommendation:** adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution on 2026-08-26; applied and verified in iteration 3.

**Confidence:** High. **Hardening:** duplicate equality was rejected as needless authority surface.
**Challenger:** converged.

### PF-011: Historical old-to-new-to-old live selection is impossible across revisions 🟠 MAJOR

**Dimension:** Codebase Alignment

**Location:** `03-05-orchestration-and-closeout.md:96`; `99-execution-plan.md:172`

**Codebase Evidence:** `packages/readiness-execution/src/execution-publication-catalog.ts:288-305,419-441`

**The Problem:** selection and live resolution require binding rows equal to the current generated
catalog. RD-05 deliberately changes those rows, so the old child cannot be selected or executed by
the existing public APIs after regeneration. Existing old/new/old tests cover releases sharing one
current revision, not cross-revision code.

**Only viable in-scope resolution:** prove passive old-release resolution and byte integrity before
and after selecting the new release; only the new revision is live-selectable. Historical execution
unavailable under current bytes fails closed.

**Rejected:** a versioned historical executable-code loader is absent and materially expands scope.

**Recommendation:** adopt the only viable in-scope resolution.

**User Decision:** Resolved — user accepted the recommended resolution on 2026-08-26; applied and verified in iteration 3.

**Confidence:** High. **Hardening:** the challenger confirmed passive preservation as the strict-scope
meaning. **Challenger:** converged.

### PF-012: Published results cannot supply stable predicate ingredients 🟠 MAJOR

**Dimension:** Codebase Alignment

**Location:** `03-03-candidate-execution.md:65-68`; `99-execution-plan.md:100`

**Codebase Evidence:** `packages/readiness/src/execution-contracts.ts:107-174`;
`packages/readiness-execution/src/execution-vice-evaluation.ts:339-370`

**The Problem:** `ExecutionResultV1` exposes only an aggregate evidence digest. VICE hashes stable
observation facts together with candidate-specific route/evaluation identities. Those identities
cannot be removed from a SHA-256 digest, so result code/tier/stage alone cannot evaluate the complete
predicate.

**Only viable resolution:** add a closed authenticated candidate-evaluation sidecar produced inside
each handler before aggregate hashing. It exposes only stable predicate ingredients, is immediately
consumed into the failure envelope, and leaves RD-04 V1 result/report bytes unchanged. Add concrete
frontend, diagnostic, and runtime extraction plus cross-arm conformance tests.

**Recommendation:** adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution on 2026-08-26; applied and verified in iteration 3.

**Confidence:** High. **Hardening:** the challenger linked restart safety to PF-014's durable
envelope. **Challenger:** converged.

### PF-013: Shallow CI cannot prove a green ancestor 🟠 MAJOR

**Dimension:** Dependency Issues

**Location:** `03-04-evidence-and-regressions.md:39-46,88-104`;
`07-testing-strategy.md:13`; `99-execution-plan.md:125-126`

**Codebase Evidence:** `.github/workflows/ci.yml:12`

**The Problem:** activation must fail closed unless `verifiedCommit` is an ancestor, but CI fetches
only the checked-out commit by default. The first valid activation therefore references an absent
object and makes CI red.

**Only viable resolution:** require exact lowercase 40-hex object IDs, use fixed argv-only Git
`cat-file` and `merge-base --is-ancestor` probes with closed exit mapping, set checkout
`fetch-depth: 0`, and test shallow/missing objects, detached PR heads, malformed IDs,
non-ancestors, and valid ancestors.

**Recommendation:** adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution on 2026-08-26; applied and verified in iteration 3.

**Confidence:** High. **Hardening:** a self-contained chain was rejected because it does not prove
repository ancestry. **Challenger:** converged.

### PF-014: Historical envelopes and non-promotable run evidence are not durable 🟠 MAJOR

**Dimension:** Completeness Gaps

**Location:** `03-01-contracts-and-history.md:173-207`;
`03-04-evidence-and-regressions.md:28-37,67-71`;
`03-05-orchestration-and-closeout.md:39-44`; `99-execution-plan.md:143-147`

**Codebase Evidence:** `packages/readiness/src/campaign-state.ts:48-74`,
`execution-case.ts:67`, `published-diagnostic-case.ts:53-57`;
`packages/readiness-execution/src/execution-authority-report.ts:505-519`

**The Problem:** envelopes are materialized only in memory; events retain only an unresolvable
digest; and stateful, flaky, exhausted, unavailable, and summary outcomes have no publication path.
Process-local WeakMap authorities disappear after exit, so later historical replay is impossible.

**Only viable resolution:** add immutable content-addressed envelope and run records beneath the
evidence root covering every promotable and non-promotable outcome, bounded sequence, and summary.
Publish securely before or atomically with dependent events, retain verified content references,
and add restart, missing/orphan record, and revision-drift tests.

**Recommendation:** adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution on 2026-08-26; applied and verified in iteration 3.

**Confidence:** High. **Hardening:** delivery and risk audits independently converged.
**Challenger:** converged.

### PF-015: Package exports arrive after their consumers 🟠 MAJOR

**Dimension:** Dependency Issues

**Location:** `03-02-reduction-engine.md:23-26`; `99-execution-plan.md:95-104,148`

**Codebase Evidence:** `packages/readiness/package.json:6-27`;
`scripts/gen-execution-bindings.mjs:71-92`

**The Problem:** Phase 3 must import `@blend65/readiness/failure-reduction-internals`, but the
manifest subpath does not exist and export integration is deferred to Phase 5. Earlier specification
GREEN gates likewise require stable interfaces that are not explicitly exported.

**Only viable resolution:** create every root/subpath export and manifest entry in the phase that
introduces it, before its first consumer and GREEN gate. Make task 5.2.6 a final public/internal
surface audit.

**Recommendation:** adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution on 2026-08-26; applied and verified in iteration 3.

**Confidence:** High. **Hardening:** kept separate from PF-002 because import resolution and generated
freshness are independent failures. **Challenger:** converged.

### PF-016: The focused per-core coverage gate is unenforceable 🟠 MAJOR

**Dimension:** Testability

**Location:** `00-ambiguity-register.md:199-204`; `07-testing-strategy.md:13-16`;
`03-05-orchestration-and-closeout.md:107`; `99-execution-plan.md:164`

**Codebase Evidence:** `packages/readiness/vitest.config.ts:13-19`;
`packages/readiness-execution/vitest.config.ts:13-31`

**The Problem:** both packages enforce one aggregate branch threshold over all source, while the
plan requires every new core to reach 90%. Aggregate coverage can hide a poorly covered new module,
and no exact include list or command exists.

**Only viable resolution:** define checked RD-05 production-file include lists and exact commands
using per-file 90% branch thresholds; compare the lists to the planned/source-owned module set and
run them at each phase and closeout.

**Recommendation:** adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution on 2026-08-26; applied and verified in iteration 3.

**Confidence:** High. **Hardening:** the challenger added a source-owner freshness guard for the
maintained lists. **Challenger:** converged.

### PF-017: Real ACME/VICE candidate acceptance has no reproducible gate 🟠 MAJOR

**Dimension:** Testability

**Location:** `07-testing-strategy.md:13,101,112,149`;
`99-execution-plan.md:168`

**Codebase Evidence:** `packages/readiness-execution/package.json:20`;
`packages/readiness-execution/src/execution-vice-local.impl.test.ts:203`

**The Problem:** mandatory closeout is stated only as prose. No exact invocation distinguishes a CI
skip from local proof, executes candidate confirmation, fails when local tools are absent, or names
the retained report/run evidence.

**Only viable resolution:** add a dedicated local-gated implementation test or internal script using
the public library workflow, with exact command, seed, tool/version preconditions, CI skip behavior,
local missing-tool hard failure, and retained report/run-record paths. Do not add a public CLI.

**Recommendation:** adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution on 2026-08-26; applied and verified in iteration 3.

**Confidence:** High. **Hardening:** the challenger required reuse of the public workflow to avoid
runner duplication. **Challenger:** converged.

### PF-018: Per-failure limits multiply into an unbounded campaign workload 🟠 MAJOR

**Dimension:** Security Blind Spots

**Location:** `03-01-contracts-and-history.md:69-98`;
`03-02-reduction-engine.md:147-156`; `03-03-candidate-execution.md:91-101`;
`03-05-orchestration-and-closeout.md:59-69`

**Codebase Evidence:** `packages/readiness-execution/src/execution-authority-report.ts:44-47`;
`packages/readiness-execution/src/execution-orchestration.ts:688-734`

**The Problem:** a report may contain 4,096 routes, and each failure session can consume the full
4,096 route-execution maximum before confirmation/control/sequence work. Per-case bounds permit
millions of operations and do not prevent local resource exhaustion.

**Only viable resolution:** define every limit's scope and add one shared campaign/run budget
capability charged in canonical case order for reduction, confirmations, controls, sequences,
diagnostic capture, event reads, and durable writes. Retain session counters only for attribution
and test the aggregate exact limit plus next operation.

**Recommendation:** adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution on 2026-08-26; applied and verified in iteration 3.

**Confidence:** High. **Hardening:** the challenger retained deterministic order as the answer to
shared-exhaustion order dependence. **Challenger:** converged.

## Minor Findings

### PF-019: Route-relative mismatch cases are absent from the specification matrix 🟡 MINOR

**Dimension:** Testability

**Location:** `03-01-contracts-and-history.md:54-60`; `07-testing-strategy.md:24-25`

**The Problem:** ST-01/02 cover the global code/tier/stage table and unknown inputs, but not a known
result tier differing from the authenticated route terminal tier or a globally allowed stage absent
from that route's prefix.

**Only viable resolution:** add explicit known-value negative matrices for terminal-tier mismatch
and allowed-but-unreachable stage.

**Recommendation:** adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution on 2026-08-26; applied and verified in iteration 3.

### PF-020: ST-36–ST-49 ownership is not partitioned between blind authors 🟡 MINOR

**Dimension:** Testability

**Location:** `07-testing-strategy.md:110-111`; `99-execution-plan.md:117-118`

**The Problem:** two independent specification files receive overlapping “portions” of the same
14 cases while one author cannot inspect the other file. Packets cannot detect omissions or
conflicting duplicate oracles.

**Only viable resolution:** map every ST-36–ST-49 assertion/facet to exactly one file and name any
intentional cross-package integration assertion separately.

**Recommendation:** adopt the only viable resolution.

**User Decision:** Resolved — user accepted the recommended resolution on 2026-08-26; applied and verified in iteration 3.

## Historical First-Scan Verdict

❌ **PREFLIGHT BLOCKED — 3 critical and 15 major findings unresolved.**

The plan documents were not modified. The roadmap remains at **Plan Created** until every critical
and major finding is resolved and verified. Minor findings also require an explicit fix or accepted
risk before a passing verdict.

## Remediation and Rescan

The user accepted PF-001–PF-020 and authorized strict-scope remediation with `--auto-design` and
`--auto-commit`. Iteration 2 reopened PF-001, PF-003, PF-005, PF-006, PF-012, PF-014–PF-018 and
found direct consequences at the candidate-payload, authority-name and activation-graph seams.
Those roots were back-propagated without expanding product scope.

Iteration 3 independently rechecked soundness, codebase grounding and delivery/risk. Its remaining
issues were resolved in the audited target:

| Root | Final resolution |
|---|---|
| PF-001 | Closed private `campaign-shared`, `standalone` and `sequence-attempt` isolation modes now define mint, lifetime, consumption, shutdown and substitution rules. |
| PF-003 / PF-020 | ST-08, ST-10, ST-22, ST-23 and ST-42 are split into first-executable facets with exact package/file/phase ownership. |
| PF-005 | Candidate reuse is limited to reduction/confirmation; sequence authority now places exactly one minimized candidate at its original failing position after authenticated preceding cases. |
| PF-008 | Active discovery validates only the reachable activation/core graph; events remain non-authoritative reconciliation evidence. |
| PF-014 | Unavailable runs use a versioned canonical preimage over exact report, route-record/case/execution/ordinal, terminal-result bytes and a complete enum-ordered unique missing-authority set. |

Final deterministic validation found 11 target documents, 70 unique task IDs, complete
`ST-01`–`ST-58` coverage, no broken relative links, Prettier-clean Markdown, no diff whitespace
errors and no `spec/` changes. The final artifact tree is
`b86d924c0133da9c75b69524274bcc8153d62ad0`.

## Final Verdict

✅ **PREFLIGHT PASSED — all 3 critical, 15 major and 2 minor findings are resolved.**

The complete RD-05 plan is implementation-ready. No accepted risk, deferred preflight blocker or
scope-expansion item remains.

## Review Independence

Five `preflight-auditor` clusters scanned an exact partition of all 13 dimensions. One independent
`design-challenger` reviewed the complete critical/major batch without the lead's picks. It retained
all 19 high-severity candidates, merged the dynamic-runner ordering symptom into PF-003, refined
workspace ownership for PF-001, and converged on every recorded recommendation.
The final targeted scan reused three independent auditors for soundness, grounding and
delivery/risk; their surviving issues are the iteration-3 roots recorded above.
