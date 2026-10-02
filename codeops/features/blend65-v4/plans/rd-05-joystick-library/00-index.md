# Joystick and Bundled C64 Library

> **CodeOps Artifact Schema**: 1
> **Implements**: blend65-v4/RD-05
> **Status**: Done — bounded pilot 21/21 verified; RD-05 remains Executing
> **Created**: 2026-10-01
> **Last Updated**: 2026-10-02
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
| [Phase review](09-phase-review.md) | Both phase checkpoints, independent reviews, exact oracle authority and qualification limits |
| [Closeout](08-closeout.md) | Delivered boundary, complete checkpoint, costs, deferral expiry and remaining owners |

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

The pilot is complete: 21/21 tasks verified, Phase 1 11/11 and Phase 2 10/10.

| Delivered boundary | Qualification |
| --- | --- |
| Real bundled source and input/editor/build evidence | 24 independent specification cases; detached installed-package proof |
| Both-port reads and five saved-byte predicates | 252 source/output/runtime cases across four profiles, sequential VICE |
| Inventory and internal guards | 55 inventory and 55 directed implementation cases |
| Complete checkpoint | Install/build/typecheck and all 3,421 tests pass; two unchanged native-host skips |
| Final guide and closeout | Exact guide source builds on four profiles; final 91 links/anchors and roadmap counters pass |

Independent correctness and semantic reviews clear the implementation; final document review has
no new findings. The mandatory oracle-edit finding is retained with the exact prior user rulings
AR-P8/AR-P10/AR-P11/AR-P12. The phase review distinguishes independently repeated current proofs
from historical parent inverse-hash evidence. One existing CIA1 pre-release stop failure passed
both unchanged directed and complete retries; no fixture, timeout, source or assertion changed.

The six masks are real Blend65 source; callable operations remain direct compiler-owned forms.
AR-P12 accepts canonical `none` for this pilot only, preserving direct floors and all behavior/
MMIO/accounting oracles. General local/condition/layout targets and the path-to-win in issue #95
stay RD-08-owned. The separate collision issue #94 is unchanged. Status is VICE-verified /
hardware-unverified; complete keyboard sharing and other platform obligations stay RD-05.
No framework, early optimizer, production reporter, extra RD or skill activation was added.

The confirmed high effort and explicit waiver for tasks 2.1.2–2.3.3 are fulfilled. The user's
safekeeping request authorizes one commit/push at this green checkpoint, not automatic later pushes.
RD-05 remains Executing. Portfolio synchronization is deferred to integration under branch policy.
