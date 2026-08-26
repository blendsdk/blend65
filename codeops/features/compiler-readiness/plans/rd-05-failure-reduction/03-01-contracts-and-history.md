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

export interface ClassifiedFailureV1 {
  readonly revision: "failure-disposition-v1";
  readonly disposition: FailureDispositionV1;
  readonly cleanup: CleanupDispositionV1;
  readonly result: ExecutionResultV1;
}

export function classifyExecutionFailureV1(
  route: ExecutionRoutePlanItemV1,
  result: ExecutionResultV1,
): ExecutionOperationResultV1<ClassifiedFailureV1>;
```

The implementation encodes the RD-05 exhaustive tuple matrix as data, validates the authenticated
terminal tier and reachable prefix, and returns exactly one initial disposition. Fresh-confirm
transition decisions consume two fresh results plus the required same-route known-good control;
they are not inferred from prose or adapter subcodes. Cleanup classification never overwrites the
primary result. (AR-P2)

### Reduction Policy

```ts
export interface FailureReductionBudgetV1 {
  readonly transformationAttempts: number;
  readonly routeExecutions: number;
  readonly oracleEvaluations: number;
  readonly diagnosticBytes: number;
  readonly provenanceEvents: number;
  readonly sequenceCases: number;
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
```

Every value is a positive safe integer. Defaults and hard maxima are the exact RD values. The
selected policy belongs to the run envelope/event/candidate identity, never the campaign-independent
core or promotion key. Exact selected limits succeed; the next consuming operation returns a closed
exhaustion outcome. (AR-P2, AR-P4)

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
```

Canonical predicate fields exclude campaign, case, candidate, execution, route-plan, timing,
workspace, host-path, and non-authoritative prose identities. `not-reached` terminal-reason
normalization retains only stable category and bounded predicate-bearing typed evidence. The
promotion key includes the complete canonical predicate digest and minimized content digest; equal
keys must derive byte-identical core inputs. (AR-P2, AR-P6)

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
      readonly sourceBytes: Uint8Array;
    };

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

`FailureAuthorityReferencesV1` content-addresses the exact inventory, rule, generator, boundary,
oracle, diagnostic, execution-publication, projection, fixture, compiler, assembler, and emulator
authority used by the original result. Resolvers accept only the named digest/revision and return
`historical-authority-unavailable` when absent; current content is never substituted. The envelope
contains canonical closed oracle projections, not raw streams or unstructured prose. (AR-P9)

`authorizeFailureEnvelopeV1` is reachable only after the orchestration join in 03-05 validates the
V1 report against genuine live authority. The cross-package value is opaque and module-private
state retains the canonical bytes so execution cannot brand caller-supplied bytes as authorized.
(AR-P6, AR-P9)

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Unknown result or illegal tier/stage tuple | `unsupported-non-pass-disposition`; no shrink/promotion | AR-P2 |
| Invalid/over-hard-max policy | Closed input issue before state or execution | AR-P2 |
| Missing historical resolver content | `historical-authority-unavailable`; no current fallback | AR-P9 |
| Digest/preimage mismatch | Identity failure; preserve prior evidence | AR-P2, AR-P6 |
| Oversized/deep/unknown-field envelope | Bounded closed parser rejection | AR-P2, AR-P6 |
| Caller-created/copy/proxy authority | Reject before projection or execution | AR-P6 |

## Testing Requirements

- Exhaust the complete result-code × tier × stage cross product and the current production tuples.
- Use fixed canonical vectors for every identity domain, including collision injection.
- Prove selected policy values alter run/candidate identity but not an equal promotion core.
- Parse typed and raw envelopes after authority revisions; prove unavailable content never falls
  back to current state.
- Inject accessors, proxies, extra keys, oversized bytes/arrays, invalid UTF-8, and digest collisions.
- Preserve the exact existing `ExecutionAuthorityReportV1` serialization vectors.
