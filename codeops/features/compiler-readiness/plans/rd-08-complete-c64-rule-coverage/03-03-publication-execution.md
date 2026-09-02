# Publication and Execution: RD-08

> **Document**: 03-03-publication-execution.md
> **Parent**: [Index](00-index.md)

## Overview

RD-08 publishes changed-format family/disposition/case authority only after the local evolution
contract is proven. It retains existing separate parent and execution pointers and routes every
case through the inventory-declared public evidence obligations. (AR-5, AR-6)

## Publication evolution

The minimum additive evolution provides:

- explicit v1/v2 dispatch;
- deterministic v1-to-v2 migration for facts whose meaning is unchanged;
- rejection of unsupported or absent historical implementations during replay;
- review invalidation whenever family, handler, case or implementation revision changes;
- immutable v1 bytes and independent resolution;
- the existing content-addressed prepare/review/promote transaction for v2.

No composite parent-child selector is introduced. Selecting a new parent before its compatible
execution child yields an explicit unavailable stale pair. Selecting the compatible child restores
a valid exact pair. Neither intermediate state can produce passing evidence. (AR-5)

## First accepted publication

The first accepted v2 parent contains the exact `03-01 §Exact first vertical rule population`,
the corresponding generated cases, independent expectations and execution envelopes. One small
consumer-contract fixture reads an unchanged envelope and verifies its identities without a
production optimizer import of readiness. It does not execute optimizer profiles or claim cost
truth. (AR-3, AR-5)

## Public execution obligations

For every modeled rule:

- `frontend` stops after the public frontend contract;
- `compiler-api`, `cli`, `emit` reach those exact public boundaries;
- `acme` assembles bounded source through the existing adapter;
- `vice` contributes at least one bounded real execution per modeled rule that declares VICE;
- unavailable ACME/VICE is blocking/unavailable, never skipped or passing.

The existing execution envelope retains rule, case, publication, compiler and execution identity.
RD-08 may add only structured-case projections needed to feed the unchanged route plan. It does
not extend supervisors, workers, leases, workspaces or subprocess infrastructure. (AR-1, AR-8)

## Defect evidence

Valid rejection, invalid acceptance, wrong diagnostic, ICE, semantic mismatch, assembly failure,
VICE failure and timeout remain distinct typed results. Cost-only divergence is projected only to
secondary quality. RD-08 uses completed RD-05 Phase 3 classification, exact-route execution and
confirmation; it does not add durable promotion or resume reduction orchestration. (AR-1, AR-6)

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Unknown format/version | Fail closed before interpretation | AR-5 |
| Historical implementation absent | Replay unavailable; never substitute current code | AR-5 |
| Crash during parent promotion | Prior selected parent remains current | AR-5 |
| Parent selected before compatible child | Explicit unavailable stale pair | AR-5 |
| Missing declared tier | Blocking evidence at that tier | AR-6 |
| Compiler/assembler/emulator failure | Typed exact evidence with owning route | AR-1 |

## Testing Requirements

- ST-22–ST-27 cover v1 preservation, migration, stale review, crash safety, separate pointer
  recovery and public-tier completeness.
- Real VICE acceptance is an explicit local command and never part of `yarn test`.
- The optimizer consumer fixture asserts identity-only provider compatibility.
