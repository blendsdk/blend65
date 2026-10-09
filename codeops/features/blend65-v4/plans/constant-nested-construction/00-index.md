# Direct constant nested construction

> **Status**: Ready
> **Created**: 2026-10-09
> **Implements**: blend65-v4/RD-05
> **CodeOps Artifact Schema**: 1

## Minimum-sufficient baseline

Original goal: remove the general nested-constant temporary/copy exposed by ordinary
keyboard-library source, without changing language behavior or adding a special API.
Smallest viable design: reuse aggregate destinations and fixed packed offsets; prove
fresh ownership before forwarding children, elide already-completed member writes,
and reuse equal literal loads within the resulting straight-line construction.
Approved complexity: [AR-1](00-ambiguity-register.md). No new pass, IR kind, solver,
runtime, dependency, framework or broader optimizer. Existing unproved cases keep
their current safe path. This correction alone does not qualify keyboard support.

## Documents

| Document                              | Owner                                    |
| ------------------------------------- | ---------------------------------------- |
| [Decisions](00-ambiguity-register.md) | Exact imported approval and gate         |
| [Requirements](01-requirements.md)    | Task acceptance and exclusions           |
| [Current state](02-current-state.md)  | Producer/consumer facts                  |
| [Construction](03-01-construction.md) | Bounded lowering contract                |
| [Tests](07-testing-strategy.md)       | Independent behavior/output expectations |
| [Execution](99-execution-plan.md)     | Sole mutable task progress               |

One phase; source semantics, SFA/ABI, emitted output, platform preservation and host
cost supplement base correctness review. Public artifact schemas do not change. No host/security boundary,
dependency, packaging format or release migration is introduced.
