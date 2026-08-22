# Component Design: Execution Contracts and Routing

> **Document**: 03-01-execution-contracts-routing.md
> **Parent**: [Index](00-index.md)
> **Decisions**: AR-P2, AR-P6, AR-P9, AR-P20

## Responsibility

Define the passive, toolchain-independent execution vocabulary in `@blend65/readiness` and the
deterministic route planner in `@blend65/readiness-execution`. Planning is a pure operation: it
must finish before any compiler, filesystem, child-process or emulator work begins.

## Public contracts

`packages/readiness/src/execution-contracts.ts` exports documented version-1 contracts:

| Contract | Shape and invariant |
|---|---|
| `ExecutionTierV1` | Closed union: `frontend`, `compiler-api`, `cli`, `emit`, `acme`, `vice` |
| `ExecutionCapabilityIdV1` | The six reviewed declaration IDs, never an arbitrary string |
| `ExecutionBudgetV1` | Positive safe integers bounded by `ExecutionPolicyV1` |
| `ExecutionPolicyV1` | Revision plus canonical maxima and cleanup grace |
| `ExecutionStageV1` | Ordered closed pipeline-stage union |
| `ExecutionResultV1` | Pass/failure discriminated union with tier, stage, canonical code, usage, bounded evidence and optional cleanup blocker |
| `ExecutionRoutePlanV1` | Identity-bound cases, obligations, selected tiers, strata and policy |

Unknown discriminators, extra properties, duplicate bindings and unsafe numeric values fail closed
before planning. Public result codes use only the canonical RD-compatible literals below; adapters may
retain a separate bounded `adapterSubcode` but must normalize it before returning a public result.

| Condition | Canonical public code |
|---|---|
| success | `pass` |
| invalid evidence/capability/plan | `invalid-evidence-input` / `unbound-capability` / `execution-plan-capacity` |
| unavailable tool or unsupported host | `tier-unavailable` |
| diagnostic mismatch | `diagnostic-mismatch` |
| unexpected later artifact | `unexpected-emission` |
| compiler worker crash or invalid response | `compiler-ice` |
| emit failure | `emission-failure` |
| assembler failure | `assembler-failure` |
| VICE launch or handshake failure | `emulator-launch-failure` / `emulator-handshake-failure` |
| instruction/cycle/wall/output/evidence limit | `instruction-exhaustion` / `cycle-exhaustion` / `wall-time-exhaustion` / `output-exhaustion` / `evidence-exhaustion` |
| unsafe lease recovery | `emulator-lease-recovery-blocked` |
| actual/oracle mismatch | `semantic-mismatch` |

The first operational terminal stage wins. A cleanup failure is always attached as a structured
`cleanupBlocker`; it becomes the primary result only when no earlier operational failure exists.
A provisional pass becomes `emulator-lease-recovery-blocked` when safe VICE termination cannot
be proven. Every cleanup blocker prevents publication authority and retains the lease. At one VICE
checkpoint instruction exhaustion precedes cycle exhaustion while both totals remain recorded; an
already-fired wall watchdog is terminal before return.

## Canonical policy

| Limit | Inclusive maximum |
|---|---:|
| Compiler or assembler operation | 60,000 ms |
| VICE launch/handshake attempt | 15,000 ms |
| Complete VICE route | 120,000 ms |
| Aggregate child stdout/stderr | 1,048,576 bytes per process |
| VICE instructions | 10,000,000 |
| VICE cycles | 100,000,000 |
| VICE launch attempts | 8 |
| Retained evidence | 16,777,216 bytes per case |
| Cleanup grace | exactly 3,000 ms: 2,000 ms graceful plus 1,000 ms forced |

Every selected lower limit and the policy revision enters execution identity. Exact maxima are
accepted; zero, negative, fractional, unsafe or maximum-plus-one values are rejected before work.
Version 1 requires `cleanupGraceMs === 3000`; it reserves 2,000 ms for graceful termination and
1,000 ms for forced termination. A child-capable route must therefore have `routeMs >= 3001`.

## Route planning algorithm

`execution-selector-v1` performs these deterministic steps:

1. Strictly validate the guarded composite and campaign projections, selected oracle digest and
   policy share compatible parent, campaign, generator and oracle identities. For a diagnostic
   route, compatibility is the closed `published-diagnostic-case-equivalence-v1` relation: retain
   caller and selected provenance separately; require equal publication-owned inventory/spec/
   rule-model/target facts plus generator/boundary handler IDs and contract versions. Seed and
   normalized configuration come only from the authenticated caller campaign and must echo exactly
   through selected replay and both identity chains. Permit implementation-revision differences
   only when the full modeled case and rendered source are exactly equal.
2. Assign every case its cheapest declared decisive tier. Invalid-source cases may terminate only
   at frontend, compiler-API or CLI; they are excluded from emit/ACME/VICE candidate sets.
3. For each additional obligation, group candidates by rule, obligation, validity, spelling tuple
   and boundary family.
4. Rank each candidate by a domain-separated SHA-256 digest over parent digest, campaign identity,
   case identity, selector revision and obligation.
5. Visit non-empty strata in lexical round-robin order and select at least one candidate from each.
6. Guarantee one valid VICE selection for every modeled mandatory-C64 runtime rule declaring VICE;
   every emit/ACME/VICE obligation must have a valid candidate and fails capacity rather than using
   an invalid case as a false witness.
7. Enforce 16 selections per rule/expensive obligation and 256 expensive selections per campaign.
   If required minima do not fit, return `execution-plan-capacity`; never silently truncate.

The serialized plan sorts maps and sets lexically and contains the digest-ranked candidate proof,
so identical authority and campaign inputs produce byte-identical plans in fresh processes. No
prior execution outcome is an input.

## Boundaries

- `@blend65/readiness` owns validation schemas and passive types only; its workspace-import ban is
  unchanged.
- `@blend65/readiness-execution` owns route selection and later execution.
- RD-02 source-case identity is consumed through a passive campaign projection, never rewritten.
- RD-03 expectations remain opaque host-side inputs and never enter the selector ranking beyond
  their accepted publication digest.
- The structural projections and route plan convey no execution authority. Phase 7 alone obtains
  them from genuine opaque capabilities before invoking this pure planner.

## Failure behavior

Validation returns structured issues with stable JSON-pointer paths. Capacity failure reports the
unsatisfied rule/obligation/minimum and configured cap. Capability absence remains an explicit
unbound blocker; missing ACME or VICE becomes `tier-unavailable` only during execution,
not a plan rewrite.

## Specification-visible TypeScript interface

The following declarations are exported from `@blend65/readiness` through
`packages/readiness/src/execution-contracts.ts` and its package root:

```ts
export type ExecutionTierV1 = 'frontend' | 'compiler-api' | 'cli' | 'emit' | 'acme' | 'vice';
export type ExecutionCapabilityIdV1 =
  | 'frontend'
  | 'compiler-api'
  | 'cli'
  | 'emit'
  | 'acme'
  | 'vice';
export type ExecutionStageV1 =
  | 'input'
  | 'capability'
  | 'frontend'
  | 'compiler-api'
  | 'cli'
  | 'emit'
  | 'acme'
  | 'vice-launch'
  | 'vice-handshake'
  | 'fixture'
  | 'run'
  | 'observe'
  | 'compare'
  | 'cleanup';
export type ExecutionResultCodeV1 =
  | 'pass'
  | 'invalid-evidence-input'
  | 'unbound-capability'
  | 'execution-plan-capacity'
  | 'tier-unavailable'
  | 'diagnostic-mismatch'
  | 'unexpected-emission'
  | 'compiler-ice'
  | 'emission-failure'
  | 'assembler-failure'
  | 'emulator-launch-failure'
  | 'emulator-handshake-failure'
  | 'instruction-exhaustion'
  | 'cycle-exhaustion'
  | 'wall-time-exhaustion'
  | 'output-exhaustion'
  | 'evidence-exhaustion'
  | 'emulator-lease-recovery-blocked'
  | 'semantic-mismatch';
export interface ExecutionBudgetV1 {
  readonly operationMs: number;
  readonly launchAttemptMs: number;
  readonly routeMs: number;
  readonly cleanupGraceMs: number;
  readonly outputBytes: number;
  readonly evidenceBytes: number;
  readonly instructions: number;
  readonly cycles: number;
  readonly launchAttempts: number;
}
export interface ExecutionPolicyV1 {
  readonly revision: 'execution-policy-v1';
  readonly budget: ExecutionBudgetV1;
}
export interface ExecutionCleanupBlockerV1 {
  readonly code: 'emulator-lease-recovery-blocked';
  readonly evidenceDigest: string;
}
export interface ExecutionUsageV1 {
  readonly wallMs: number;
  readonly outputBytes: number;
  readonly evidenceBytes: number;
  readonly instructions: number;
  readonly cycles: number;
  readonly launchAttempts: number;
}
export interface ExecutionEvidenceSummaryV1 {
  readonly digest: string;
  readonly retainedBytes: number;
  readonly truncated: boolean;
}
export interface ExecutionIssueV1 {
  readonly code: ExecutionOperationIssueCodeV1;
  readonly path: string;
  readonly message: string;
}
export type ExecutionOperationIssueCodeV1 =
  | Exclude<ExecutionResultCodeV1, 'pass'>
  | 'execution.invalid-schema'
  | 'execution.io'
  | 'execution.stale-authority'
  | 'execution.identity'
  | 'execution.reconciliation';
export type ExecutionOperationResultV1<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly [ExecutionIssueV1, ...ExecutionIssueV1[]] };
export type ExecutionResultV1 =
  | {
      readonly status: 'pass';
      readonly tier: ExecutionTierV1;
      readonly stage: ExecutionStageV1;
      readonly code: 'pass';
      readonly usage: ExecutionUsageV1;
      readonly evidence: ExecutionEvidenceSummaryV1;
    }
  | {
      readonly status: 'failure';
      readonly tier: ExecutionTierV1;
      readonly stage: ExecutionStageV1;
      readonly code: Exclude<ExecutionResultCodeV1, 'pass'>;
      readonly adapterSubcode?: string;
      readonly usage: ExecutionUsageV1;
      readonly evidence: ExecutionEvidenceSummaryV1;
      readonly cleanupBlocker?: ExecutionCleanupBlockerV1;
    };
export interface ExecutionRoutePlanItemV1 {
  readonly caseIdentity: string;
  readonly ruleId: string;
  readonly obligation: string;
  readonly terminalTier: ExecutionTierV1;
  readonly prerequisiteTiers: readonly ExecutionTierV1[];
  readonly rankDigest: string;
}
export interface ExecutionRoutePlanV1 {
  readonly revision: 'execution-route-plan-v1';
  readonly parentDigest: string;
  readonly campaignDigest: string;
  readonly oracleDigest: string;
  readonly policy: ExecutionPolicyV1;
  readonly items: readonly ExecutionRoutePlanItemV1[];
  readonly digest: string;
}
export type ExecutionCapabilityProjectionV1 =
  | {
      readonly capabilityId: ExecutionCapabilityIdV1;
      readonly state: 'bound';
    }
  | {
      readonly capabilityId: ExecutionCapabilityIdV1;
      readonly state: 'unbound';
      readonly blocker: 'unbound-evidence-capability';
    };
export interface CompositeReadinessProjectionV1 {
  readonly parentDigest: string;
  readonly executionDigest: string;
  readonly capabilities: readonly ExecutionCapabilityProjectionV1[];
  readonly rules: readonly ExecutionRuleProjectionV1[];
}
export interface ExecutionRuleProjectionV1 {
  readonly ruleId: string;
  readonly applicability:
    | 'mandatory-c64'
    | 'not-applicable-c64'
    | 'out-of-claim-target'
    | 'blocked-errata';
  readonly evidenceObligations: readonly ExecutionTierV1[];
  readonly boundaryFamilyIds: readonly string[];
}
export interface ExecutionPlanningCaseV1 {
  readonly caseIdentity: string;
  readonly ruleId: string;
  readonly validity: 'valid' | 'invalid';
  readonly spellingTuple: readonly string[];
  readonly boundaryFamilyId: string;
}
export interface ExecutionCampaignProjectionV1 {
  readonly revision: 'execution-campaign-projection-v1';
  readonly campaignDigest: string;
  readonly cases: readonly ExecutionPlanningCaseV1[];
}
export interface ExecutionContractsV1 {
  readonly revision: 'execution-contracts-v1';
  readonly tiers: readonly ExecutionTierV1[];
  readonly capabilities: readonly ExecutionCapabilityIdV1[];
  readonly stages: readonly ExecutionStageV1[];
  readonly resultCodes: readonly ExecutionResultCodeV1[];
  readonly policy: ExecutionPolicyV1;
}
export interface ExecutionTerminalBaseV1 {
  readonly tier: ExecutionTierV1;
  readonly stage: ExecutionStageV1;
  readonly usage: ExecutionUsageV1;
  readonly evidence: ExecutionEvidenceSummaryV1;
}
export interface ExecutionTerminalCandidateV1 {
  readonly stage: ExecutionStageV1;
  readonly code: Exclude<ExecutionResultCodeV1, 'pass'>;
  readonly usage: ExecutionUsageV1;
  readonly evidence: ExecutionEvidenceSummaryV1;
  readonly cleanupBlocker?: ExecutionCleanupBlockerV1;
}
export function parseExecutionContractsV1(
  input: unknown,
): ExecutionOperationResultV1<ExecutionContractsV1>;
export function parseExecutionPolicyV1(input: unknown): ExecutionOperationResultV1<ExecutionPolicyV1>;
export function reduceExecutionTerminalV1(
  base: ExecutionTerminalBaseV1,
  candidates: readonly ExecutionTerminalCandidateV1[],
): ExecutionResultV1;
export function serializeExecutionRoutePlanV1(plan: ExecutionRoutePlanV1): Uint8Array;
export function projectExecutionCampaignV1(
  campaign: PreparedCampaign,
): ExecutionOperationResultV1<ExecutionCampaignProjectionV1>;
```

The following declarations are exported from `@blend65/readiness-execution`:

```ts
export interface PlanExecutionRoutesInputV1 {
  readonly parent: CompositeReadinessProjectionV1;
  readonly campaign: ExecutionCampaignProjectionV1;
  readonly oracleDigest: string;
  readonly policy: ExecutionPolicyV1;
}
export function planExecutionRoutesV1(
  input: PlanExecutionRoutesInputV1,
): ExecutionOperationResultV1<ExecutionRoutePlanV1>;
```
