# Contracts and History: RD-05 Failure Reduction

> **Document**: 03-01-contracts-and-history.md
> **Parent**: [Index](00-index.md)

## Overview

This component owns every closed RD-05 value before transformation or I/O: disposition, cleanup,
observation identity, failure predicate, promotion key, reduction policy, historical envelope, and
canonical parsing/serialization. It extends neither `ExecutionResultV1` nor
`ExecutionAuthorityReportV1`. (AR-P1, AR-P2, AR-P9)

## Architecture

### Proposed Modules

| Module | Responsibility |
|---|---|
| `failure-contracts.ts` | Disposition matrix, cleanup/reduction outcomes, policy limits and parsing |
| `failure-identity.ts` | Predicate, route-contract, promotion key, canonical fields and collision checks |
| `failure-envelope.ts` | Complete typed/raw historical envelope, resolvers, canonical wire format |
| `failure-authority.ts` | Opaque authorized envelope/core byte capabilities for cross-package use |

The modules remain in `@blend65/readiness`; execution imports public or purpose-limited subpath
exports. No Node filesystem/process API enters this component. (AR-P1, AR-P11)

## Closed Contracts

### Disposition and Outcome

```ts
export type FailureDispositionV1 =
  | "direct-shrink"
  | "fresh-confirm"
  | "campaign-only"
  | "unsupported";

export type CleanupDispositionV1 = "cleanup-clear" | "cleanup-blocked";

export type ReductionOutcomeCodeV1 =
  | "confirmed-source-failure"
  | "stateful-sequence-failure"
  | "flaky-failure"
  | "reduction-exhausted"
  | "historical-authority-unavailable";

export type ClassifiedFailureV1 =
  | {
      readonly revision: "failure-disposition-v1";
      readonly disposition: Exclude<FailureDispositionV1, "unsupported">;
      readonly cleanup: CleanupDispositionV1;
      readonly result: Extract<ExecutionResultV1, { readonly status: "failure" }>;
    }
  | {
      readonly revision: "failure-disposition-v1";
      readonly disposition: "unsupported";
      readonly cleanup: CleanupDispositionV1;
      readonly result: ExecutionResultV1;
    }
  | {
      readonly revision: "failure-disposition-v1";
      readonly disposition: "unsupported";
      readonly cleanup: "cleanup-clear";
      readonly result?: never;
    };

export function classifyExecutionFailureV1(
  route: unknown,
  result: unknown,
): ExecutionOperationResultV1<ClassifiedFailureV1>;
```

The implementation encodes the RD-05 exhaustive tuple matrix as data, validates the authenticated
terminal tier and reachable prefix, and returns exactly one initial disposition. Valid execution
results are defensively normalized and retained even when their route tuple is unsupported. An
invalid/open route or result returns only the closed unsupported arm, without retaining or
fabricating an `ExecutionResultV1`. Fresh-confirm
transition decisions consume two fresh results plus the required same-route known-good control;
they are not inferred from prose or adapter subcodes. Cleanup classification never overwrites the
primary result. (AR-P2, AR-P16)

### Reduction Policy

```ts
export interface FailureReductionBudgetV1 {
  readonly campaignOperations: number;
  readonly transformationAttempts: number;
  readonly routeExecutions: number;
  readonly oracleEvaluations: number;
  readonly diagnosticBytes: number;
  readonly provenanceEvents: number;
  readonly sequenceCases: number;
  readonly durableWrites: number;
  readonly coreBytes: number;
  readonly runBytes: number;
}

export interface FailureReductionPolicyV1 {
  readonly revision: "failure-reduction-policy-v1";
  readonly dispositionRevision: "failure-disposition-v1";
  readonly catalogRevision: "failure-reduction-catalog-v1";
  readonly normalizationRevision: "failure-normalization-v1";
  readonly budget: FailureReductionBudgetV1;
}

export const FAILURE_REDUCTION_DEFAULT_POLICY_V1: FailureReductionPolicyV1;
export const FAILURE_REDUCTION_MAXIMUM_BUDGET_V1: Readonly<FailureReductionBudgetV1>;
export function parseFailureReductionPolicyV1(
  input: unknown,
): ExecutionOperationResultV1<FailureReductionPolicyV1>;

export interface FailureCampaignBudgetAuthorityV1 {
  readonly [FAILURE_CAMPAIGN_BUDGET_AUTHORITY_V1]: true;
}

export interface FailureCampaignBudgetReservationV1 {
  readonly nonPassResults: number;
  readonly resolvableNonPassResults: number;
}

export type FailureCampaignBudgetChargeV1 =
  | { readonly kind: "transformation-attempt" }
  | {
      readonly kind: "route-execution";
      readonly purpose: "reduction" | "confirmation" | "control";
    }
  | { readonly kind: "oracle-evaluation" }
  | { readonly kind: "diagnostic-capture"; readonly bytes: number }
  | { readonly kind: "provenance-event-read" }
  | { readonly kind: "provenance-event-write" }
  | { readonly kind: "sequence-case" }
  | { readonly kind: "core-write"; readonly bytes: number }
  | { readonly kind: "terminal-envelope-write" }
  | { readonly kind: "terminal-run-write"; readonly bytes: number }
  | { readonly kind: "terminal-summary-write" };

export interface FailureCampaignBudgetSnapshotV1 {
  readonly revision: "failure-campaign-budget-snapshot-v1";
  readonly used: FailureReductionBudgetV1;
  readonly terminalRemaining: {
    readonly campaignOperations: number;
    readonly durableWrites: number;
    readonly envelopes: number;
    readonly runs: number;
    readonly summaries: number;
  };
}

export function createFailureCampaignBudgetAuthorityV1(
  policy: unknown,
  reservation: unknown,
): ExecutionOperationResultV1<FailureCampaignBudgetAuthorityV1>;
export function chargeFailureCampaignBudgetV1(
  authority: FailureCampaignBudgetAuthorityV1,
  charge: unknown,
): ExecutionOperationResultV1<FailureCampaignBudgetSnapshotV1>;
export function getFailureCampaignBudgetSnapshotV1(
  authority: FailureCampaignBudgetAuthorityV1,
): ExecutionOperationResultV1<FailureCampaignBudgetSnapshotV1>;
```

Every value is a positive safe integer. The eight RD-owned category limits retain their exact RD
defaults and maxima. The aggregate additions selected during preflight are
`campaignOperations: 16_384` with hard maximum `65_536`, and `durableWrites: 32_768` with hard
maximum `65_536`. One
orchestrator-owned `FailureCampaignBudgetAuthorityV1` enforces the selected budget across the whole
report in canonical case order. Reduction edits, candidate routes, predicate evaluations,
confirmations, controls, sequence cases, diagnostic capture, evidence reads, and durable writes each
charge the single capability plus their applicable category/byte counters. At construction the
capability derives a mandatory terminal-audit reservation from the authenticated report: one run
for every non-pass, at most one envelope for every resolvable non-pass, and one campaign summary.
Both `campaignOperations` and `durableWrites` must cover that worst-case reservation or policy
validation rejects before any campaign side effect. Ordinary reduction and optional core/event
publication cannot consume either reserved aggregate. Terminal envelope/run/summary writes consume
the reserve while still charging the aggregate-operation, durable-write, and applicable run-byte
caps. Core and run byte ceilings apply to each complete record, while the snapshot retains the
largest observed record size; they are not campaign-total byte counters. Per-session counters are
attribution only and cannot mint independent capacity. Exact
discretionary limits succeed; the next ordinary operation returns a closed exhaustion outcome whose
terminal records can still use the reserve. The selected policy belongs to the
envelope/run/event/candidate identity, never the campaign-independent core or promotion key.
(AR-P2, AR-P4, AR-P15)

### Predicate and Promotion Identity

```ts
export type FailureObservationIdentityV1 =
  | {
      readonly kind: "observed";
      readonly digest: Sha256Digest;
    }
  | {
      readonly kind: "not-reached";
      readonly stage: ExecutionStageV1;
      readonly terminalReasonDigest: Sha256Digest;
    };

export interface FailureRouteContractV1 {
  readonly originalRouteKind: "valid-envelope" | "invalid-diagnostic";
  readonly terminalTier: ExecutionTierV1;
  readonly obligation: string;
  readonly prerequisiteTiers: readonly ExecutionTierV1[];
  readonly policyDigest: Sha256Digest;
  readonly fixtureDigest: Sha256Digest;
  readonly oracleContractDigest: Sha256Digest;
  readonly toolContractDigests: readonly Sha256Digest[];
}

export interface FailurePredicateV1 {
  readonly revision: "failure-predicate-v1";
  readonly resultCode: Exclude<ExecutionResultCodeV1, "pass">;
  readonly terminalTier: ExecutionTierV1;
  readonly terminalStage: ExecutionStageV1;
  readonly observation: FailureObservationIdentityV1;
  readonly cleanup: CleanupDispositionV1;
  readonly primaryRuleId: string;
  readonly requiredClaimedRuleIds: readonly string[];
  readonly target: "c64";
  readonly routeContract: FailureRouteContractV1;
}

export interface PromotedFailureKeyV1 {
  readonly revision: "promoted-failure-key-v1";
  readonly normalizationRevision: "failure-normalization-v1";
  readonly minimizedContentDigest: Sha256Digest;
  readonly predicateDigest: Sha256Digest;
  readonly digest: Sha256Digest;
}

export interface FailurePredicateIdentityV1 {
  readonly revision: "failure-predicate-identity-v1";
  readonly predicate: FailurePredicateV1;
  readonly canonicalBytes: Uint8Array;
  readonly digest: Sha256Digest;
}

export interface FailureReductionRunIdentityInputV1 {
  readonly historicalEnvelopeDigest: Sha256Digest;
  readonly predicateDigest: Sha256Digest;
  readonly policy: FailureReductionPolicyV1;
  readonly traceDigest: Sha256Digest;
}

export interface FailureReductionRunIdentityV1 {
  readonly revision: "failure-reduction-run-identity-v1";
  readonly digest: Sha256Digest;
}

export function deriveFailurePredicateIdentityV1(
  input: unknown,
  registry?: IdentityCollisionRegistry,
): ExecutionOperationResultV1<FailurePredicateIdentityV1>;
export function derivePromotedFailureKeyV1(
  minimizedContentDigest: unknown,
  predicate: unknown,
  registry?: IdentityCollisionRegistry,
): ExecutionOperationResultV1<PromotedFailureKeyV1>;
export function deriveFailureReductionRunIdentityV1(
  input: unknown,
  registry?: IdentityCollisionRegistry,
): ExecutionOperationResultV1<FailureReductionRunIdentityV1>;
```

Canonical predicate fields exclude campaign, case, candidate, execution, route-plan, timing,
workspace, host-path, and non-authoritative prose identities. `not-reached` terminal-reason
normalization retains only stable category and bounded predicate-bearing typed evidence. The
promotion key includes the complete canonical predicate digest and minimized content digest; equal
keys must derive byte-identical core inputs. The omitted legacy valid-request discriminator
normalizes to `valid-envelope`; `invalid-diagnostic` remains distinct. Route-kind equality is
field-by-field and participates in every canonical domain that embeds the route contract. (AR-P2,
AR-P6)

Canonical identity domains are additive and explicit, including at minimum
`failure-predicate-v1`, `promoted-failure-key-v1`, `failure-envelope-v1`,
`reduction-candidate-v1`, `failure-core-v1`, `failure-event-v1`, and `failure-activation-v1`.
Different canonical preimages at one digest return an identity-collision failure. (AR-P2)

## Historical Envelope

```ts
export type FailureReplayAuthorityV1 =
  | {
      readonly kind: "typed-campaign";
      readonly envelope: ReplayEnvelopeV1;
      readonly generatedProjection: GeneratedCaseProjection;
      readonly sourceBytes: Uint8Array;
    }
  | {
      readonly kind: "raw-malformed";
      readonly envelope: MalformedReplayEnvelopeV1;
    };

export interface FailureToolIdentityV1 {
  readonly kind: "compiler" | "assembler" | "emulator";
  readonly name: string;
  readonly version: string;
  readonly digest: Sha256Digest;
}

export interface FailureEnvelopeV1 {
  readonly revision: "failure-envelope-v1";
  readonly replay: FailureReplayAuthorityV1;
  readonly routePlanBytes: Uint8Array;
  readonly routePlanDigest: Sha256Digest;
  readonly predicate: FailurePredicateV1;
  readonly policy: FailureReductionPolicyV1;
  readonly authorities: FailureAuthorityReferencesV1;
  readonly observation: FailureObservationProjectionV1;
  readonly toolVersions: readonly FailureToolIdentityV1[];
  readonly digest: Sha256Digest;
}

export function authorizeFailureEnvelopeV1(
  input: unknown,
): ExecutionOperationResultV1<AuthorizedFailureEnvelopeV1>;
export function serializeFailureEnvelopeV1(
  envelope: AuthorizedFailureEnvelopeV1,
): Uint8Array;
export function parseFailureEnvelopeV1(
  bytes: Uint8Array,
  resolvers: FailureAuthorityResolversV1,
): ExecutionOperationResultV1<AuthorizedFailureEnvelopeV1>;
```

`FailureToolIdentityV1` is an exact enumerable four-field record. `name` and `version` use the
bounded stable execution-identifier grammar; `digest` names the complete tool contract and is not
recomputed from those labels. The duplicate-free normalized tool list must contain exactly one
identity for every sorted `routeContract.toolContractDigests` entry and no extras. (AR-P44)

`FailureAuthorityReferencesV1` content-addresses the exact inventory, rule, generator, boundary,
oracle, diagnostic, execution-publication, projection, fixture, compiler, assembler, and emulator
authority used by the original result. Resolvers accept only the named digest/revision and return
`historical-authority-unavailable` when absent; current content is never substituted. The envelope
contains canonical closed oracle projections, not raw streams or unstructured prose. (AR-P9)

Typed replay retains its separately rendered source because `ReplayEnvelopeV1` does not own those
bytes. Raw replay derives its only authoritative source from the authenticated
`MalformedReplayEnvelopeV1`; no outer copy or equality rule exists. The orchestrator chooses the
policy once, embeds it in the envelope before authorization, and all reducer/execution sessions
derive it solely from that envelope. (AR-P3, AR-P9)

`authorizeFailureEnvelopeV1` is reachable only after the orchestration join in 03-05 validates the
V1 report against genuine live authority. The cross-package value is opaque and module-private
state retains the canonical bytes so execution cannot brand caller-supplied bytes as authorized.
(AR-P6, AR-P9)

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Unknown/open result or route | Result-free `unsupported` arm; no shrink/promotion | AR-P2, AR-P16 |
| Valid but illegal tier/stage tuple | Normalized result with `unsupported`; no shrink/promotion | AR-P2 |
| Invalid/over-hard-max policy | Closed input issue before state or execution | AR-P2 |
| Missing historical resolver content | `historical-authority-unavailable`; no current fallback | AR-P9 |
| Digest/preimage mismatch | Identity failure; preserve prior evidence | AR-P2, AR-P6 |
| Oversized/deep/unknown-field envelope | Bounded closed parser rejection | AR-P2, AR-P6 |
| Caller-created/copy/proxy authority | Reject before projection or execution | AR-P6 |

## Testing Requirements

- Exhaust the complete result-code × tier × stage cross product and the current production tuples.
- Use fixed canonical vectors for every identity domain, including collision injection.
- Prove selected policy values alter run/candidate identity but not an equal promotion core.
- Mutate `originalRouteKind` independently and prove legacy omitted valid routes normalize only to
  `valid-envelope`, never to diagnostic authority.
- Parse typed and raw envelopes after authority revisions; prove unavailable content never falls
  back to current state.
- Inject accessors, proxies, extra keys, oversized bytes/arrays, invalid UTF-8, and digest collisions.
- Prove one shared campaign budget reaches every operation category in canonical case order,
  rejects an undersized terminal reservation before work, allows exact discretionary exhaustion
  followed by terminal run/summary persistence, and rejects work beyond the reserve.
- Preserve the exact existing `ExecutionAuthorityReportV1` serialization vectors.
- Freeze ST-12 from the recorded preimplementation RD-04 report bytes/digest and pair it with the
  Phase 1 guard that forbids report serializer/orchestration production changes while allowing the
  generated binding refresh; do not rebuild a current-source report against an intentionally stale
  content-bound parent. (AR-P17)
