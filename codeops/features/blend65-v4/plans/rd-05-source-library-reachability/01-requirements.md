# Requirements delta: source-library reachability

> **Parent**: [Index](00-index.md)
> **Source**: [RD-05](../../requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md)

## Scope

Only the prerequisite for R5.25/AC-20 and the accepted keyboard AR-P7 cold-library contract
is included (local AR-1). Frozen Chapter 10 governs exports/entry; Chapters 3 and 12 govern
explicit initialization and raw-memory effects. The public input API and acquisition proof,
remaining RD-05 obligations, future library mode, general dead-data optimization and release
host qualification are outside this prerequisite, not newly deferred deliverables.

## Plan-local acceptance

1. The [ST cases](07-testing-strategy.md) pass without weakening existing specification tests.
2. [Closure](03-01-reachability.md) preserves all required execution/effect/address roots.
3. No introduced runtime bytes, hidden initialization or compiler-special source-library dispatch.
4. Full existing Linux verification and applicable independent reviews pass (AR-6).

The accepted old export-inventory exception AR-P6 belongs to later keyboard implementation;
this plan exercises no old-oracle exception. Unknown proof remains conservative (AR-3/4).
