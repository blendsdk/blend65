# Publication and Execution: RD-08

> **Document**: 03-03-publication-execution.md
> **Parent**: [Index](00-index.md)

## Overview

RD-08 publishes changed-format family/disposition/case authority only after the local evolution
contract is proven. It retains existing separate parent and execution pointers and routes every
case through the inventory-declared public evidence obligations. (AR-5, AR-6)

The exact additive Phase-2 interfaces, result unions, wire members and diagnostics are defined in
`03-05-phase2-executable-contracts.md`. They are authoritative where this document describes the
same surface at design altitude. (AR-14)

## Publication evolution

The minimum additive evolution provides:

- one complete immutable v2 family/claim/route/result and structured-case schema before any v2
  candidate is prepared, including an empty-or-populated authenticated embed-fixture reference
  list;
- explicit v1/v2 dispatch in the existing parent model, pointer, transaction and resolver;
- deterministic v1-to-v2 migration for facts whose meaning is unchanged;
- rejection of unsupported or absent historical implementations during replay;
- review invalidation whenever family, handler, case or implementation revision changes;
- immutable v1 bytes and independent resolution;
- the existing content-addressed prepare/review/promote transaction for the v2 parent and the
  unchanged child-v1 transaction for its compatible execution child.

Historical resolution and executable replay are separate authorities. A v1 release whose exact
implementation revisions are no longer installed still resolves passively after its bytes,
digests, schema and stored binding rows authenticate; it exposes no callable binding or published
oracle context. Executable replay requires an exact historical revision and otherwise returns a
stable implementation-unavailable result. A current implementation with the same role, family or
contract version is never a substitute. (AR-13)

Historical and current executable test authority are likewise separate. The exact July v1 release
fixture remains historical/passive and executable-stale. Legacy tests of the still-supported v1
staging transaction use a distinct ephemeral reviewed four-handler v1 base built from current
exact revisions. This preserves the transaction's staging, rejection and fault coverage without
restoring obsolete implementations or changing historical bytes. (AR-19)

Because the first structured slice truthfully changes all four modeled and five oracle dependency
closures, migration to the first executable v2 parent is explicit and all-or-nothing across those
nine handler rows. Five-handler-only, mixed old/current and implicit non-target upgrades fail. Two
runs over the same current authorities produce identical v2 bytes and digest. This parent
compatibility work is executed before Phase-1 verification. Once the immutable child/consumer
specifications are active, the unchanged child-v1 recovery and consumer projection also complete in
Phase 2 before that checkpoint so mandatory verification can be green. (AR-13, AR-17)

The v2 parent owns a new content-addressed `compiler-readiness-v1.json` member: `v1` continues to
name its unchanged wire schema, not the predecessor's bytes. One shared deterministic projection
joins the authenticated predecessor's eight declarations to the closed nine-handler catalog, adds
the missing `transform.semantic-relations` declaration, verifies retained metadata, marks all nine
bound and canonically renders the successor. The v2 model, member and manifest must authenticate
the same digest before strict binding validation. Historical release bytes and meaning remain
unchanged. (AR-18)

The first v2 parent contains all 2,112 inventory IDs. Its exact first-vertical IDs have modeled
evidence; all other rows use the schema's `family-review-pending` blocker. The terminal publication
replaces those blockers but does not change the v2 wire schema. Existing v1 bytes, member profile,
digests, pointer behavior and historical resolution are byte-for-byte regression authorities.

No composite parent-child selector is introduced. Selecting a new parent before its compatible
execution child yields an explicit unavailable stale pair. Selecting the compatible child restores
a valid exact pair. Neither intermediate state can produce passing evidence. (AR-5)

Historical execution children resolve through a separate opaque passive record API that
authenticates only the child manifest, exact member bytes/digests, bindings, review and stored
parent identity. It never reads or resolves the parent and cannot form a composite. The existing
child resolver remains executable-compatible because selection and live catalog callers rely on its
parent/spec/declaration/freshness checks. Both paths share one child-byte validator so authentication
cannot drift. (AR-24)

## First accepted publication

The first accepted v2 parent contains the exact `03-01 §Exact first vertical rule population`,
the complete transitional disposition table, corresponding generated cases, independent
expectations and execution envelopes. A separately prepared, reviewed, persisted and selected
execution-child v1 publication binds that exact parent digest through its already-opaque parent
reference. Parent-first selection must resolve as unavailable; selecting the exact child restores
the pair. No child-v2 wire dialect is introduced. (AR-14)

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
- ST-22 and ST-23 additionally distinguish passive v1 resolution from exact-revision executable
  replay, reject current substitution and partial/mixed migration, and prove deterministic
  nine-handler migration to the first current v2 parent. (AR-13)
- Real VICE acceptance is an explicit local command and never part of `yarn test`.
- The optimizer consumer fixture asserts identity-only provider compatibility.
