# Joystick and Bundled C64 Library

> **CodeOps Artifact Schema**: 1
> **Implements**: blend65-v4/RD-05
> **Status**: Executing — Phase 1 complete; Phase 2 not started
> **Created**: 2026-10-01
> **Last Updated**: 2026-10-01
> **Scope mode**: strict

## Overview

Finish the bounded joystick pilot and ship its constants as real Blend65 source. The accepted
staging decision is [AR-P2](00-ambiguity-register.md#ambiguity-register): direct hardware/predicate
operations now, ordinary source-function migration only after its RD-08 optimization prerequisite.
This plan does not close all RD-05 input or platform work.

## Minimum-sufficient baseline

One fixed packaged source file enters existing module analysis. Existing frontend, build evidence
and editor diagnostics share its immutable input records. No package manager, new library framework,
runtime input system or early inliner. The two bounded independent challenges and the exact old-test
exception are recorded in the [decision register](00-ambiguity-register.md).

## Document index

| Document | Owns |
| --- | --- |
| [Decisions](00-ambiguity-register.md) | Scope, public API, physical contract, technical choices and approval authority |
| [Requirements delta](01-requirements.md) | RD mapping, exclusions and pilot acceptance boundary |
| [Current state](02-current-state.md) | Remaining integration seams and evidence limitations |
| [Component design](03-joystick-library.md) | Interfaces, implementation responsibilities and failure propagation |
| [Testing strategy](07-testing-strategy.md) | Independent input → output cases and their file ownership |
| [Execution plan](99-execution-plan.md) | Two phases, 21 tasks; sole task-progress authority |
| [Preflight report](00-preflight-report.md) | Current audit verdict, exact target identities, findings and verified corrections |
| [Phase review](09-phase-review.md) | Phase 1 verification, independent review, oracle integrity and qualification boundary |

## Related owners

[Feature roadmap](../../00-roadmap.md) remains authoritative for overall delivery.
[RD-05](../../requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md)
owns the input requirements. [RD-08](../../requirements/RD-08-optimization-and-expert-output.md)
owns the callable-helper prerequisite. The final analysis RD and qualified expert-skill change
remain evidence-dependent follow-ups under AR-P7, not secretly added tasks.

## Planning validation

Targeted formatting, local links/anchors, resolved decision authority, source-manifest keys and
specification-first task ordering pass. The derived plan helper reports Ready, 0/21, no problems.
The roadmap counter check reports no feature-counter drift; its existing portfolio 1/10→4/10
drift is intentionally deferred on this non-integration branch. No compiler tests were run for
this document-only checkpoint. Frozen `spec/` and expert authority remain unchanged.
This section records original planning validation, not implementation qualification.
The preflight report owns the current review gate separately from task progress.

## Execution checkpoint

Phase 1 is complete: 11/11 tasks verified; the overall plan is 11/21 (52%). The real source asset
is packaged and consumed through the existing frontend, compiler evidence and editor seams.
Install, build, typecheck and all 3,150 tests pass; independent review reports no findings.
AR-P9 permits only the exact constant-only probe filter, independently verified against its
original frozen identity. The bounded padded-image host wait changes no program or assertion.
No framework, cache, dependency, runtime input policy or early optimizer was added.
The next task is Phase 2's implementation-blind joystick API/output oracle; its ten tasks remain
unstarted. RD-05 remains Executing. No push is part of this checkpoint.
