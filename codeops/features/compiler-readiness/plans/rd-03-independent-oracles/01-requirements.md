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
| Scalar host representation | `bigint` with per-operation typed normalization | AR-P6 |
| Relation architecture | Five relation IDs under one typed transform | AR-P11–AR-P13 |
| Evidence identity | Separate oracle-evaluation identity | AR-P14 |
| Compatible promotion | Seven release members, four carried rows, five promotions | AR-P15 |
| Mutation proof | Closed exhaustive production-path catalog | AR-P17 |

## Plan-Local Acceptance

- ST-01–ST-40 in [07-testing-strategy.md](07-testing-strategy.md) remain immutable and pass.
- The traceability plan gate, full repository verification and mandatory closeout checks pass.
