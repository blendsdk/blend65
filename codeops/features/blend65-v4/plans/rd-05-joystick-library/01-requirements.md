# Requirements delta: joystick and bundled C64 library

> **Parent**: [Index](00-index.md)
> **Source**: [RD-05](../../requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md) — owning requirements

## Scope of this plan

| RD contract | Pilot contribution |
| --- | --- |
| R5.24 / AC-19 | Both port samples and all five active-low bit tests; state preservation and bounded keyboard-sharing evidence |
| R5.50 | Direct operations without library abstraction overhead; complete costs and expert comparison |
| R5.3 | Existing four selected profiles; no new target/profile |
| R5.25 | Boundary only: shared-line interference must be honest; combined keyboard scanning is separate |

Library-first distribution is the approved plan-local delta [AR-P1–AR-P4](00-ambiguity-register.md#ambiguity-register).
The RD retains its own acceptance criteria; this document does not rewrite them.

## Plan-local acceptance

The [ST cases](07-testing-strategy.md#-specification-test-cases) must prove actual shipped source
use, exact input provenance, editor/build agreement and the approved API. All 21 tasks must verify,
independent review must clear. AR-P12's explicitly approved pilot-only staging correction keeps
exact direct-operation floors here, while accepting correctly accounted canonical `none` storage
and branch layout. General whole-local performance floors remain RD-08 deliverables; this is not
production game-grade qualification or a relaxation of optimized-output requirements.

Pilot completion is not unrestricted joystick isolation, combined keyboard support or RD-05
closeout. Carry the remaining R5.24/AC-19 coexistence obligation explicitly into the pilot closeout.

## Out of this plan

Per AR-P2/AR-P5/AR-P7: callable source helpers, inlining/other optimization modes, keyboard matrix
scanning, input policy, takeover/NMI changes, a library/package framework, VSIX release tooling,
gameplay support and broad refactoring. Native user-host and physical-hardware proof stay RD-10.
Final review-RD creation and expert-skill activation have separate gates after pilot evidence.
