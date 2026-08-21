# Component Design: Execution Contracts and Routing

> **Document**: 03-01-execution-contracts-routing.md
> **Parent**: [Index](00-index.md)
> **Decisions**: AR-P2, AR-P6, AR-P9

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
| `ExecutionResultV1` | Pass/failure discriminated union with tier, stage, code, usage and bounded evidence |
| `ExecutionRoutePlanV1` | Identity-bound cases, obligations, selected tiers, strata and policy |

Unknown discriminators, extra properties, duplicate bindings and unsafe numeric values fail closed
before planning. The stable failure codes include input/capability errors, tier unavailability,
diagnostic mismatch, unexpected emission, compiler ICE, emit/ACME failure, VICE launch/handshake,
instruction/cycle/wall/output/evidence exhaustion, lease recovery blocking, semantic mismatch and
pass. The first terminal stage wins. At one VICE checkpoint instruction exhaustion precedes cycle
exhaustion while both totals remain recorded; an already-fired wall watchdog is terminal before
return.

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

Every selected lower limit and the policy revision enters execution identity. Exact maxima are
accepted; zero, negative, fractional, unsafe or maximum-plus-one values are rejected before work.

## Route planning algorithm

`execution-selector-v1` performs these deterministic steps:

1. Validate the selected composite snapshot, prepared campaign and selected oracle context share
   compatible parent, campaign, generator and oracle identities.
2. Assign every case its cheapest declared decisive tier.
3. For each additional obligation, group candidates by rule, obligation, validity, spelling tuple
   and boundary family.
4. Rank each candidate by a domain-separated SHA-256 digest over parent digest, campaign identity,
   case identity, selector revision and obligation.
5. Visit non-empty strata in lexical round-robin order and select at least one candidate from each.
6. Guarantee one valid VICE selection for every modeled mandatory-C64 runtime rule declaring VICE.
7. Enforce 16 selections per rule/expensive obligation and 256 expensive selections per campaign.
   If required minima do not fit, return `execution.plan.capacity`; never silently truncate.

The serialized plan sorts maps and sets lexically and contains the digest-ranked candidate proof,
so identical authority and campaign inputs produce byte-identical plans in fresh processes. No
prior execution outcome is an input.

## Boundaries

- `@blend65/readiness` owns validation schemas and passive types only; its workspace-import ban is
  unchanged.
- `@blend65/readiness-execution` owns route selection and later execution.
- RD-02 source-case identity is consumed, never rewritten.
- RD-03 expectations remain opaque host-side inputs and never enter the selector ranking beyond
  their accepted context identity.

## Failure behavior

Validation returns structured issues with stable JSON-pointer paths. Capacity failure reports the
unsatisfied rule/obligation/minimum and configured cap. Capability absence remains an explicit
unbound blocker; missing ACME or VICE becomes `tier-unavailable` only during execution, not a plan
rewrite.
