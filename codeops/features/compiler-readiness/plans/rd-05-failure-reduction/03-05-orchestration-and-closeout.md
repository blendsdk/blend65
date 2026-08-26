# Orchestration and Closeout: RD-05 Failure Reduction

> **Document**: 03-05-orchestration-and-closeout.md
> **Parent**: [Index](00-index.md)

## Overview

The public RD-05 orchestrator joins an RD-04 report to live authenticated campaign/execution/oracle
authority, immediately materializes complete historical failure envelopes, classifies every
non-pass, drives reduction and fresh confirmation, and publishes eligible evidence. Final closeout
refreshes the content-bound handler publication after all implementation and review changes, then
reselects a fresh execution child before accepting RD-05. (AR-P9, AR-P13)

## Public Orchestration API

```ts
export interface ReduceReadinessFailuresInputV1 {
  readonly parent: PublishedSnapshot;
  readonly execution: ExecutionAuthorityContextV1;
  readonly oracle: PublishedOracleContext;
  readonly campaign: PreparedCampaign;
  readonly report: ExecutionAuthorityReportV1;
  readonly reductionPolicy: FailureReductionPolicyV1;
}

export interface ReduceReadinessFailuresReportV1 {
  readonly revision: "reduce-readiness-failures-report-v1";
  readonly campaignIdentity: Sha256Digest;
  readonly outcomes: readonly FailureReductionOutcomeV1[];
  readonly summary: FailureDispositionSummaryV1;
  readonly digest: Sha256Digest;
}

export function reduceReadinessFailuresV1(
  input: ReduceReadinessFailuresInputV1,
): Promise<ExecutionOperationResultV1<ReduceReadinessFailuresReportV1>>;
```

The input is closed and uses genuine, matching authorities. The join validates report publication,
campaign, execution, route-plan, oracle, inventory, projection, target, and policy identities before
reading a result. The orchestrator selects the policy once, creates one shared campaign budget, and
requires the live handler-minted original-route predicate sidecar. It embeds that sidecar and policy
in every resolvable matching non-pass `FailureEnvelopeV1` while all historical content is still
live. It derives the pinned evidence root internally from matching genuine execution context state;
the caller supplies no path. RD-04's report schema and canonical bytes remain unchanged; the
envelope is a separate RD-05 record. Missing content or a pre-RD-05 result without a live sidecar
produces a durable unavailable-source run through the versioned constructor bound to the exact
report digest, complete canonical route record with case/execution/ordinal, canonical terminal
result bytes, and complete enum-ordered duplicate-free missing-authority set, without a fake
envelope or current fallback. Reducer and execution sessions derive policy only from a
resolved envelope and cannot supply an override. (AR-P9)

## Processing Flow

```text
authenticated report + live authorities
  -> validate join and reserve mandatory terminal audit capacity
  -> resolvable: materialize/publish FailureEnvelopeV1
     unavailable: publish closed run-source authority without an envelope
  -> classify primary and cleanup dispositions
  -> direct shrink OR fresh-confirm gate OR campaign-only/unsupported
  -> deterministic reduction through published route handlers
  -> two fresh confirmations / bounded sequence reproduction
  -> durable run record for every outcome
  -> immutable inactive core + append-only provenance event when promotable
  -> durable closed campaign summary record
```

Every non-pass produces exactly one primary disposition and one cleanup disposition. The
orchestrator never drops unsupported, campaign-only, exhausted, flaky, sequence, or unavailable
outcomes; they remain bounded durable run evidence and summary counts but cannot mint promotion
authority. Resolved envelope records publish before dependent runs; unavailable runs use their
closed stable source arm; and all runs publish before dependent events or summaries so restart never
depends on process-local capabilities. For infrastructure-like direct
candidates, a same-route known-good control gates the transition to shrinking. (AR-P2, AR-P7)

Each reduction step follows the readiness state-machine protocol: request opaque candidate, execute
through the published route, evaluate the exact predicate, and record the authenticated evaluation.
The orchestrator cannot inspect or mutate private session state. Publication occurs only for a
one-minimal `confirmed-source-failure` with two fresh confirmations and a passing control whenever
the disposition table requires one. Canonical case order determines shared-budget consumption;
reduction, confirmation, control, sequence, diagnostics, reads, and writes all charge the same
campaign capability before their side effect. Mandatory envelope/run/summary writes use the
prevalidated terminal-audit reservation. Optional core/event publication and ordinary work use only
discretionary capacity; exhaustion therefore remains persistable.

## Package Integration

Each phase adds its root and purpose-limited subpath exports, `package.json` entries, and generated
type surfaces before the first cross-package consumer or GREEN checkpoint. Public readiness exports
include closed policies, dispositions, predicate/key constructors,
envelope and malformed authority constructors, reducer session operations, canonical evidence
records, and orchestration report types. Purpose-limited projections are exposed only through the
execution-internal subpath. Execution exports the candidate route, fresh confirmation, secure
failure publisher, and top-level orchestrator wiring. (AR-P1, AR-P11)

No CLI command, network API, compiler implementation edit, spec edit, RD-06 matrix work, or RD-07
migration is added. The public library API is the complete RD-05 integration surface under strict
scope. (AR-P11)

## Handler Publication Refresh

Because readiness exports, route adapters, live-handler predicate extractors, report authority,
worker executor, VICE build, and candidate-runtime evaluation bytes participate in the six generated
handler dependency closures, every phase regenerates and
checks bindings after its last participating-byte change and before full verification/commit. This
keeps the committed generated catalog fresh while deliberately deferring semantic acceptance,
immutable-child preparation, real-tool acceptance, and selection until all code, tests, coverage,
review, and authorized fixes are final. (AR-P13)

1. Regenerate and check the execution bindings with the existing generation command; repeat after
   any later participating-byte change.
2. Run exact full repository verification and prove `spec/` is untouched.
3. Run
   `BLEND65_RD05_LOCAL_ACCEPTANCE=1 yarn workspace @blend65/readiness-execution vitest run src/failure-candidate-acceptance.impl.test.ts --no-file-parallelism --maxWorkers=1`
   through the public library workflow with seed `0xB16505`. The test requires ACME 0.97 and VICE
   3.10, fails locally when either is unavailable or has the wrong version, and is explicitly
   skipped in ordinary CI where the opt-in variable is absent. It prints and retains the canonical
   authority-report, envelope-record, run-record, and summary-record paths beneath its pinned
   evidence root; no public CLI is added.
4. Obtain independent correctness/security/performance review required by project routing.
5. If any code-affecting finding is fixed, repeat steps 1–4.
6. Prepare and select a new content-bound child through the existing public execution publication
   APIs/workflow; do not hand-edit generated authority records.
7. Resolve the old release passively and prove its descriptor/binding bytes remain byte-identical
   before and after new selection. Only the new revision is live-selectable and executes RD-05
   routes. Historical execution whose bindings do not equal the current catalog returns
   `historical-authority-unavailable`; the plan does not add a historical executable-code loader.

The selected child is the only external repository state changed by this plan, and it is required
to restore publication freshness. No push is part of planning or execution unless separately
requested.

## Closeout Gates

- Run the checked package-owned RD-05 include lists with Vitest per-file branch thresholds at or
  above 90%; the source-owner freshness guard must prove every introduced or explicitly touched
  RD-05 production module appears exactly once. (AR-P10)
- Run Prettier checks on every touched file and the exact repository verify command. (AR-P12)
- Confirm the original RD-04 canonical report serialization is unchanged and all previous
  generated-case route tests remain green.
- Confirm `git status --porcelain spec/` is empty and no compiler implementation file changed.
- Complete independent phase review and all routed security/performance audits; no critical or
  major finding may remain unresolved.
- Answer the mandatory deferral-expiry question by walking the shared ambiguity register, RD-05
  Won't Have section, and `spec/future-considerations.md`. Rehome any expired or orphaned deferral
  before RD-05 closes.
- Update the feature and portfolio roadmaps at lifecycle transitions and record content-free
  workflow outcomes.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Report fails genuine-authority join | Reject before envelope creation | AR-P9 |
| Live authority disappears before materialization | `historical-authority-unavailable`; no fallback | AR-P9 |
| Unknown result or disallowed tuple | Preserve `unsupported` outcome; do not shrink | AR-P2 |
| Reducer/confirmation exhaustion | Preserve campaign evidence; do not promote | AR-P4, AR-P7 |
| Publication conflict | Closed fatal result; accepted evidence remains unchanged | AR-P6 |
| Handler closure changes after review | Reopen refresh, verification, execution, and review steps | AR-P13 |
| Deferral loses its stated rationale | Reopen as an owned backlog/ledger row before closeout | AR-P13 |

## Testing Requirements

- Genuine-authority join tests cover every identity, immediate envelope materialization, unchanged
  RD-04 report bytes, missing historical content, and replay after authority revision.
- Unavailable-path tests distinguish equal terminal results from different cases/route ordinals,
  mutate every identity preimage field, reject incomplete or duplicate missing-authority sets,
  canonicalize resolver order, and prove byte-identical run and summary resolution after restart.
- End-to-end tests cover every disposition, all three reduction families, exhaustion, fresh
  confirmation, sequence/flaky classification, deduplication, inactive publication, and activation.
- Boundary tests prove no compiler or frozen-spec mutation and no direct compiler/candidate bypass.
- Publication freshness tests validate regeneration at every participating phase, prove passive old
  release bytes survive new selection, prove only the new revision is live-selectable, and fail
  closed when historical executable authority is unavailable.
- The real ACME/VICE acceptance run exercises the selected C64 execution path with exact policies,
  bounded resources, cleanup evidence, and deterministic retained output.
