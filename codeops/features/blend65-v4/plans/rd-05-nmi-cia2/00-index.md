# Cooperative NMI publication and generated-route qualification

> **Implements**: blend65-v4/RD-05
> **Status**: Executing — Phase 1 complete; Phase 2 not started
> **Created**: 2026-10-03
> **CodeOps Artifact Schema**: 1

## Minimum-sufficient baseline

**Original goal:** Progress DEF-7 using the qualified cooperative NMI contract,
without inventing a source bound or runtime manager. This is AR-P2's bounded
proof-first slice, not all NMI/CIA2 support or RD-05 closeout.

**Smallest viable design:** Correct existing stack evidence, then qualify stock-
chained `setNMI`/`restoreNMI` using the current ownership/context, SFA, wrapper,
layout and service owners. AR-P12's analytical proof determines the gates; emitted
bytes and runtime observations must still pass independently.

**Excluded machinery:** New profiles/APIs, dynamic frames, runtime selection,
event suppression, general state/range managers, new reporter/schema, new test
harness, dependency and optimizer. A direct placement-required `JMP` entry is
ordinary lowering through existing machine/layout patterns, not a dispatcher.
**Approved complexity:** None beyond the direct accepted feature work.

## Documents

| Document                                      | Owns                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| [Decision register](00-ambiguity-register.md) | Approved scope, oracle exceptions and bounded analytical result           |
| [Requirements delta](01-requirements.md)      | RD mapping and delivery boundary                                          |
| [Current state](02-current-state.md)          | Actual implementation gaps and integration seams                          |
| [Stack evidence](03-stack-evidence.md)        | Honest bounded-resource and external-uncertainty reporting                |
| [NMI route](03-nmi-route.md)                  | Publication, lifetime, selected-route storage, placement and ABI          |
| [Testing strategy](07-testing-strategy.md)    | Independent input → output cases                                          |
| [Execution plan](99-execution-plan.md)        | Sole task-progress authority                                              |
| [Preflight report](00-preflight-report.md)    | Exact payload, grounded findings and verified corrections                 |
| [Execution evidence](09-phase-review.md)      | Specification-first results, complete checkpoints and independent reviews |

## Remaining owners

RD-05 and DEF-7 stay open after this slice. Exact exclusive CIA2 handoff, keyboard
AR-P2/AR-P3, combined-input qualification, raw takeover and remaining platform
requirements keep their existing RD-05 owners. No deferral is assigned to a future
slice of a closed RD. [The roadmap](../../00-roadmap.md) owns overall status.

Expert lineage: 2.0.3/content `22cc5f00f381c82d347cf342be4fcff16bc291c6`;
the register owns exact specification identity, primary sources and qualifications.
No `spec/`, expert authority, compiler or test file changes during planning.
