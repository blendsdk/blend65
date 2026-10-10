# Proved returned-local destination

> **Status**: Done — 19/19 tasks; full verification and independent review complete
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

| Document                                                           | Owner                                                     |
| ------------------------------------------------------------------ | --------------------------------------------------------- |
| [Decisions](00-ambiguity-register.md)                              | Imported approval and planning gate                       |
| [Requirements](01-requirements.md)                                 | Plan-local acceptance and exclusions                      |
| [Current state](02-current-state.md)                               | Reinspected producer/consumer facts                       |
| [Destination proof and binding](03-01-destination.md)              | One bounded technical contract                            |
| [Testing](07-testing-strategy.md)                                  | Independent behavior and output expectations              |
| [Execution](99-execution-plan.md)                                  | Sole mutable task progress                                |
| [Qualification](08-closeout.md)                                    | Actual costs, qualified evidence and remaining boundaries |
| [Entry-observation assessment](09-entry-observation-assessment.md) | Physical overlap and exact approved observer ruling       |

The [preflight report](00-preflight-report.md) owns the scan, technical corrections
and exact reviewed artifact hashes. The unrelated legal partial-array backend
defect remains separately owned by T-15; it is not repaired or waived here.

One phase, three sessions, nineteen tasks after the execution-only guard, internal-test and
activation splits recorded in [live progress](99-execution-plan.md). Applicable lenses are **compiler and
language**, plus **concurrency** for generated asynchronous observation and
existing domain/closure consumers. No distributed runtime, persistent-format
migration or host security boundary is introduced. Existing build generations
are rebuilt in full; their schema and publication policy are unchanged.

Lineage: expert `2.0.4`, content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; frozen Specification 4.0,
`BLEND65-SPEC-4-038b70e9`; selected NMOS 6510, cooperative PRG profiles,
ACME 0.97 and VICE 3.10. Qualification uses optimization `none`, safety off,
Linux Node 22+. Other supported modes keep their existing semantics; no new
target claim is made. Implementation and actual costs are recorded in
[qualification](08-closeout.md). Independent platform review found TP-001:
incoming bitmap mode leaves caller storage visible to VIC fetches. Final
checkpoint and review disposition proceed under the approved
[AR-6](00-ambiguity-register.md#ar-6-runtime--incoming-bitmap-display-invalidates-hardware-disjointness).
The approved [T-16 assessment](09-entry-observation-assessment.md) distinguishes
physical overlap from a specified semantic failure. It recommends a narrow
observer-contract clarification before adding startup/layout support. The user
approved that exact ruling on 2026-10-10; no compiler change, protected-test edit
or qualification waiver follows. Full verification and all independent reviews
pass, including the final base-review consistency check.
No positive keyboard or whole-program parity claim follows.
