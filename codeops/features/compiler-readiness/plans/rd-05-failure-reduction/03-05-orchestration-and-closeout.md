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
  readonly parent: ReadinessParentCapabilityV1;
  readonly execution: PublishedExecutionAuthorityV1;
  readonly oracle: PublishedOracleContext;
  readonly campaign: CampaignAuthorityV1;
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
reading a result. A matching non-pass is immediately materialized as `FailureEnvelopeV1` while all
historical content is still live. RD-04's report schema and canonical bytes remain unchanged; the
envelope is a separate RD-05 record. Missing content returns `historical-authority-unavailable`
without current fallback. (AR-P9)

## Processing Flow

```text
authenticated report + live authorities
  -> validate join and materialize FailureEnvelopeV1
  -> classify primary and cleanup dispositions
  -> direct shrink OR fresh-confirm gate OR campaign-only/unsupported
  -> deterministic reduction through published route handlers
  -> two fresh confirmations / bounded sequence reproduction
  -> immutable inactive core + append-only provenance event
  -> closed campaign summary
```

Every non-pass produces exactly one primary disposition and one cleanup disposition. The
orchestrator never drops unsupported, campaign-only, exhausted, flaky, sequence, or unavailable
outcomes; they remain bounded campaign evidence and summary counts but cannot mint promotion
authority. For infrastructure-like direct candidates, a same-route known-good control gates the
transition to shrinking. (AR-P2, AR-P7)

Each reduction step follows the readiness state-machine protocol: request opaque candidate, execute
through the published route, evaluate the exact predicate, and record the authenticated evaluation.
The orchestrator cannot inspect or mutate private session state. Publication occurs only for a
one-minimal `confirmed-source-failure` with two fresh confirmations and a passing control whenever
the disposition table requires one.

## Package Integration

Public readiness exports include closed policies, dispositions, predicate/key constructors,
envelope and malformed authority constructors, reducer session operations, canonical evidence
records, and orchestration report types. Purpose-limited projections are exposed only through the
execution-internal subpath. Execution exports the candidate route, fresh confirmation, secure
failure publisher, and top-level orchestrator wiring. (AR-P1, AR-P11)

No CLI command, network API, compiler implementation edit, spec edit, RD-06 matrix work, or RD-07
migration is added. The public library API is the complete RD-05 integration surface under strict
scope. (AR-P11)

## Handler Publication Refresh

Because route-adapter and worker-executor bytes are included in all six generated handler dependency
closures, the currently selected execution child becomes stale as soon as RD-05 implementation
changes land. Refresh happens only after code, tests, coverage, security review, and all authorized
fixes are final: (AR-P13)

1. Regenerate and check the execution bindings with the existing generation command.
2. Run exact full repository verification and prove `spec/` is untouched.
3. Run the real C64 readiness execution path with ACME and VICE, using an explicit deterministic
   seed and preserving the resulting authority report.
4. Obtain independent correctness/security/performance review required by project routing.
5. If any code-affecting finding is fixed, repeat steps 1–4.
6. Prepare and select a new content-bound child through the existing public execution publication
   APIs/workflow; do not hand-edit generated authority records.
7. Prove the old child remains historically replayable, the new child accepts RD-05 routes, and
   old-new-old selection preserves both generations without byte drift.

The selected child is the only external repository state changed by this plan, and it is required
to restore publication freshness. No push is part of planning or execution unless separately
requested.

## Closeout Gates

- Run focused branch coverage at or above 90% for every new failure-classification, reduction,
  authority, publication, activation, and orchestration core; keep error paths explicit. (AR-P10)
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
- End-to-end tests cover every disposition, all three reduction families, exhaustion, fresh
  confirmation, sequence/flaky classification, deduplication, inactive publication, and activation.
- Boundary tests prove no compiler or frozen-spec mutation and no direct compiler/candidate bypass.
- Publication freshness tests detect the old selected child, validate regenerated closures, and
  prove old-new-old historical replay.
- The real ACME/VICE acceptance run exercises the selected C64 execution path with exact policies,
  bounded resources, cleanup evidence, and deterministic retained output.
