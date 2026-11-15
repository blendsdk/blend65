# Constant-index callable recovery — closeout

> **Issue**: [#162](https://github.com/blendsdk/blend65/issues/162)
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Preflight**: [00-preflight-report-99-execution-plan.md](00-preflight-report-99-execution-plan.md)
> **Status**: Done (bounded to the constant-index assignment path)
> **Recorded**: 2026-11-15

## Delivered

A proved constant array index is distinct from a runtime index in the must-assignment path. A
complete constant-index callable store restores exactly that element after a raw write; the issue
witness builds and calls `chosen`. A constant-index callable field under an aggregate element
follows the same path.

- Target provenance keeps the collapsed `index:*` path, so a runtime read still selects every
  possible element.
- An uninitialized constant sibling, an unrestored raw-written element, a runtime-index read of a
  raw-written element and a constant read after a runtime store all stay `E10277`.
- A corrupted aggregate copy selected from a constant element stays rejected.
- No runtime, per-element solver or source restriction.

## Implementation

| File | Change |
| --- | --- |
| `packages/compiler/src/semantic/assignment-facts.ts` | Constant-aware assignment key/path; the load checks assignment at the constant path and reports unknown leaves value-relative |
| `packages/compiler/src/semantic/constant-index-callable-recovery.impl.test.ts` | Seven implementation cases |
| `test/rd04/constant-index-callable-recovery.spec.test.ts` | Six public cases across four profiles |
| `test/rd04/constant-index-callable-cost.impl.test.ts` | Exact accepted-output pin |

## Review findings and resolutions

| Finding | Resolution |
| --- | --- |
| PF-162-002 unknown marker used the source-place prefix, so a corrupted aggregate copy could keep the finite target | The marker is value-relative (`leaf.path`); the counterexample is an implementation case and is rejected. |
| Preflight PF-162-001 assignment/target path separation | `assignmentPathWith` is constant-aware; `placePath` stays collapsed for target selection. |
| Preflight PF-162-003 constant initializer with an omitted sibling | **Accepted residual** — the initializer keeps the collapsed conservative unknown; the issue witness is a separate complete store. |

## Verification

| Tier | Result |
| --- | --- |
| RED | Pre-change compiler fails `E10277` at `table[0]`; post-change builds |
| Public oracle | 24/24 across four profiles |
| Implementation oracle | 7/7 |
| Compiler package | 232 files / 3,913 passed / 2 skipped |
| Host checkpoint | 227 files / 4,968 passed |
| Wave full checkpoint | Host green; VICE 2,272 passed / 4 skipped / 2 failed in the known host-load VIC collision file; that file passes 16/16 on a serialized rerun |
| Cost pin | PRG 780, program 778, code 766, zero-page 6, scratch 0 |
| `spec/` and ledger | Byte-identical |

## Residuals

| Residual | Owner |
| --- | --- |
| Constant-index initializer with an omitted sibling | conservative unknown; representation stays collapsed |
| Runtime-index must-assignment | collapsed by design |
| Bounded local index ranges | #163 |
| Interprocedural constant-element transfer | direct-call field transfer only |

## Deferral-expiry check

No deferral's reason is invalidated. The runtime-index and omitted-element representations keep
their conservative behavior; #163 owns bounded local indices. No deferral names this plan as its
landing place.
