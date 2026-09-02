# Publication and Execution: RD-08

> **Document**: 03-03-publication-execution.md
> **Parent**: [Index](00-index.md)

## Overview

RD-08 publishes changed-format family/disposition/case authority only after the local evolution
contract is proven. It retains existing separate parent and execution pointers and routes every
case through the inventory-declared public evidence obligations. (AR-5, AR-6)

## Publication evolution

The minimum additive evolution provides:

- one complete immutable v2 family/claim/route/result, structured-case and execution-child schema
  before any v2 candidate is prepared, including an empty-or-populated authenticated embed-fixture
  reference list;
- explicit v1/v2 dispatch in the existing parent model, pointer, transaction and resolver;
- deterministic v1-to-v2 migration for facts whose meaning is unchanged;
- rejection of unsupported or absent historical implementations during replay;
- review invalidation whenever family, handler, case or implementation revision changes;
- immutable v1 bytes and independent resolution;
- the existing content-addressed prepare/review/promote transactions for both v2 parent and
  compatible execution child.

The first v2 parent contains all 2,112 inventory IDs. Its exact first-vertical IDs have modeled
evidence; all other rows use the schema's `family-review-pending` blocker. The terminal publication
replaces those blockers but does not change the v2 wire schema. Existing v1 bytes, member profile,
digests, pointer behavior and historical resolution are byte-for-byte regression authorities.

No composite parent-child selector is introduced. Selecting a new parent before its compatible
execution child yields an explicit unavailable stale pair. Selecting the compatible child restores
a valid exact pair. Neither intermediate state can produce passing evidence. (AR-5)

## First accepted publication

The first accepted v2 parent contains the exact `03-01 §Exact first vertical rule population`,
the complete transitional disposition table, corresponding generated cases, independent
expectations and execution envelopes. A separately prepared, reviewed, persisted and selected v2
execution child binds that exact parent digest. Parent-first selection must resolve as unavailable;
selecting the exact child restores the pair.

One small consumer-contract fixture reads an unchanged envelope from the compatible pair and
verifies its identities without a production optimizer import of readiness. It does not execute
optimizer profiles or claim cost truth. The final complete-family milestone repeats the explicit
parent and child transactions; it cannot claim publication success after selecting only the
parent. (AR-3, AR-5)

## Public execution obligations

For every modeled rule:

- `frontend` stops after the public frontend contract;
- `compiler-api`, `cli`, `emit` reach those exact public boundaries;
- `acme` assembles bounded source through the existing adapter;
- `vice` contributes at least one bounded real execution per modeled rule that declares VICE;
- unavailable ACME/VICE is blocking/unavailable, never skipped or passing.

The existing execution envelope retains rule, case, publication, compiler and execution identity.
RD-08 may add only structured-case and authenticated embed-fixture references needed to feed the
unchanged route plan. The trusted adapter materializes those references before launch using the
existing workspace primitive; supervisors, workers, leases and subprocess infrastructure remain
unchanged. (AR-1, AR-8)

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

- ST-22–ST-27 and ST-41 cover the immutable complete v2 schema, v1 preservation, migration, stale
  review, crash safety, explicit parent/child transactions, separate-pointer recovery and
  public-tier completeness.
- Real VICE acceptance is an explicit local command and never part of `yarn test`.
- The optimizer consumer fixture asserts identity-only provider compatibility.
