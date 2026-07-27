# Requirements: RD-03 Independent Semantic, Diagnostic and Metamorphic Oracles

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-03](../../requirements/RD-03-independent-oracles.md) — the owning requirements document

## Scope of This Plan

### In this plan

- All RD-03 Must Have requirements and AC-1–AC-13.
- The exact user-authorized nine-rule/current-IR v1 boundary.
- The four oracle façades and one semantic-relation transform.
- The existing publication-v1 compatibility seam.

### Deferred / out of this plan

- RD-08 owns broader generator IR, arrays, nested calls, branches, loops, loop unrolling and the
  remaining inventory population (AR-P1).
- RD-04–RD-06 own execution tiers, failure reduction and readiness claims.
- RD-07 owns the first inventory/publication format upgrade.

## Plan-Local Decisions

| Decision | Chosen | AR Ref |
|---|---|---|
| Diagnostic authority composition | Closed manifest plus dedicated semantic-review unit | AR-P4 |
| External binding rejection | Separate closed reviewed contract, never a compiler diagnostic | AR-P31 |
| Scalar host representation | `bigint` with per-operation typed normalization | AR-P6 |
| Mixed-width semantics | Same-signed widening before dispatch; narrowing rejected | AR-P6 |
| Evaluator admission | Structural validation plus oracle semantic-closure validation | AR-P32 |
| Relation architecture | Five relation IDs under one typed transform | AR-P11–AR-P13 |
| Evidence identity | Replay provenance, two content digests and evaluation identity | AR-P14, AR-P26–AR-P28 |
| Invocation authority | Snapshot-bound resolver context supplies reviewed authority | AR-P25 |
| Compatible promotion | Legacy wrapper plus explicit four-carried/five-promoted API | AR-P15, AR-P33 |
| Resolution review | Reconstruct and revalidate exact review units at resolution | AR-P34 |
| Mutation proof | Closed exhaustive operation/path catalog in bounded workers | AR-P17, AR-P30, AR-P36, AR-P38 |

## Plan-Local Acceptance

- ST-01–ST-49 in [07-testing-strategy.md](07-testing-strategy.md) remain immutable and pass.
- The traceability plan gate, full repository verification and mandatory closeout checks pass.
