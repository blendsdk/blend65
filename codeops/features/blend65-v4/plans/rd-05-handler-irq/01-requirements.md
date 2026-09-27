# Requirements Delta: Handler-Side IRQ Updates

> **Parent**: [Index](00-index.md)
> **Source**: [RD-05](../../requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md) — owning requirements

## In This Plan

| Requirement | Bounded contribution |
|---|---|
| R5.16 / AC-13 | Handler-side cooperative IRQ installation and exact restoration; DEF-8 |
| R5.15 / AC-12 | Existing chain/exclusive CINV entry variants for those installations |
| R5.17 / AC-14 | Complete route, storage, stack and cost proof for the added IRQ contexts |
| R5.18 / AC-15 | Private storage and shared-state warnings for finite overlapping IRQ roots |

The frozen [Chapter 6 §7.8](../../../../../spec/06-functions.md#78-install-and-restore-ownership)
owns installation semantics. The plan does not reinterpret a compiler limitation as a language
restriction. AR-P1/P2 govern this scope; AR-P3/P6 authorize only their exact existing-test edits.

## Outside This Plan

| Work | Existing owner / reason |
|---|---|
| Positive NMI source, re-entry and safe vector-update proof | AR-P4 / Stage A AR-P3; no new NMI acceptance here |
| Takeover/raw-vector profiles, new banking modes, raster primitives and other platform deliverables | Remaining RD-05; this is not whole-RD readiness or closeout |
| Windows and physical hardware qualification | RD-10; no earlier host request |
| Broad optimization passes or a new evidence format | Existing later owners; direct output-quality obligations still apply here |

No language, public compiler API, manifest, dependency, runtime, asset or game-policy feature is
added. Profile IDs and artifact schemas remain unchanged. See AR-P1/P4/P5.

## Plan-Local Acceptance

All [ST cases](07-testing-strategy.md#specification-test-cases) must meet their independent
expectations, old tests may change only under AR-P3/P6, and the [execution checklist](99-execution-plan.md)
must be fully verified. The bounded closeout records actual assembly/cost and sequential VICE
evidence with the frozen expert lineage. DEF-8 retires only then. It does not retire the NMI
deferral or close RD-05. Verification and source-quality constraints are owned by AR-P5 and
[the testing strategy](07-testing-strategy.md#verification).
