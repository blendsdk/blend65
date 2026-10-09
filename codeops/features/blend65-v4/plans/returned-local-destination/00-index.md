# Proved returned-local destination

> **Status**: Planning Complete — preflight passed, implementation pending
> **Created**: 2026-10-09
> **Implements**: blend65-v4/RD-05
> **CodeOps Artifact Schema**: 1

## Minimum-sufficient baseline

**Original goal:** remove the independently reproduced extra local-to-caller
aggregate copy without changing ordinary source or hiding its cost in an input
library workaround.

**Smallest viable design:** qualify the whole function, retain one small
returned-local ownership fact before SFA inventory, and bind every proved use of
that root to the existing hidden result destination. Reuse current construction,
address, return and bounded containment/observer helpers. Missing proof retains
the entire current function; the existing ABI and compiler pipeline remain.

**Excluded machinery:** per-call destination variants, forced caller temporaries,
general alias/range solver, new pass, IR kind, storage model, runtime, API,
dependency or harness. **Approved complexity:** [AR-1](00-ambiguity-register.md).
This is T-14, a prerequisite, not the positive keyboard plan or RD-05 closeout.

## Documents

| Document                                              | Owner                                        |
| ----------------------------------------------------- | -------------------------------------------- |
| [Decisions](00-ambiguity-register.md)                 | Imported approval and planning gate          |
| [Requirements](01-requirements.md)                    | Plan-local acceptance and exclusions         |
| [Current state](02-current-state.md)                  | Reinspected producer/consumer facts          |
| [Destination proof and binding](03-01-destination.md) | One bounded technical contract               |
| [Testing](07-testing-strategy.md)                     | Independent behavior and output expectations |
| [Execution](99-execution-plan.md)                     | Sole mutable task progress                   |

The [preflight report](00-preflight-report.md) owns the scan, technical corrections
and exact reviewed artifact hashes. The unrelated legal partial-array backend
defect remains separately owned by T-15; it is not repaired or waived here.

One phase, three sessions, fifteen tasks. Applicable lenses are **compiler and
language**, plus **concurrency** for generated asynchronous observation and
existing domain/closure consumers. No distributed runtime, persistent-format
migration or host security boundary is introduced. Existing build generations
are rebuilt in full; their schema and publication policy are unchanged.

Lineage: expert `2.0.4`, content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; frozen Specification 4.0,
`BLEND65-SPEC-4-038b70e9`; selected NMOS 6510, cooperative PRG profiles,
ACME 0.97 and VICE 3.10. Qualification uses optimization `none`, safety off,
Linux Node 22+. Other supported modes keep their existing semantics; no new
target claim is made. Implementation, actual cost and runtime remain **Unknown**.
