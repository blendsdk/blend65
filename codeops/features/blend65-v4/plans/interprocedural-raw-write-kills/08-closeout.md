# Interprocedural raw-write callable invalidation — closeout

> **Issue**: [#161](https://github.com/blendsdk/blend65/issues/161)
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Preflight**: [00-preflight-report-99-execution-plan.md](00-preflight-report-99-execution-plan.md)
> **Status**: Done — bounded to the delivered invalidation and restoration slice
> **Recorded**: 2026-11-15

## Delivered

Byte-interval raw-write kills now cross direct calls, borrowed aggregate parameters, forwarded
parameters and finite indirect calls. A later callable read fails the existing `E10277` when the
pointer bytes may have been overwritten, including:

- a helper raw write followed by a caller read;
- a caller raw write read through a helper;
- the same object passed to two borrowed parameters;
- a parameter aliasing a global in both directions;
- a forwarded alias chain;
- a finite indirect call to a raw-writing helper;
- an un-restored startup initializer kill;
- a constant placed write inside a helper;
- a borrowed word write that crosses an adjacent placed callable;
- a dynamic read of a forwarded any-size callable array.

Distinct actual objects, disjoint fields, checked sibling-array writes and an opaque write with no
later callable read stay accepted. A helper that definitely stores a direct callable source on every
returning path restores only the kills that entered it; a store followed by a corruption keeps the
corruption. An unresolved raw destination is conservatively opaque until the affected callable is
definitely re-assigned.

## Implementation

| File | Change |
| --- | --- |
| `packages/compiler/src/semantic/raw-write-kills.ts` | Opaque kill sentinel; possible place/write ranges; displaced alias projection with a bounded closure; constant writes project through placement and aliases |
| `packages/compiler/src/semantic/interprocedural-kills.ts` (new) | Entry-independent produced summaries; entry-informed read analysis; direct/borrowed/forwarded/indirect/startup translation; per-body alias graphs; definite-store restoration |
| `packages/compiler/src/semantic/assignment-facts.ts` | Kill-flow options, per-call kill state, exit kills, unsized dynamic-read conservatism |
| `packages/compiler/src/semantic/function-targets.ts` | Pre-poison target settle, provisional indirect superset, kill closure, final poison settle; address-taken/placed global assignment transfer |
| `test/rd04/interprocedural-raw-write-callable-invalidation.spec.test.ts` | 24 public cases across four profiles |
| `packages/compiler/src/semantic/interprocedural-kills.impl.test.ts` | 21 implementation cases, including every review counterexample |
| `test/rd04/interprocedural-kill-cost.impl.test.ts` | Pinned PRG, program, code, zero-page and scratch bytes for nine accepted controls |

## Review findings and resolutions

| Finding | Resolution |
| --- | --- |
| SF-001 constant placed writes bypassed alias projection | Constant overlaps now pass through `addKilledInterval`; witness rejected. |
| SF-002 forwarded any-size arrays lost kills | A whole zero-length array origin is unresolved; witness rejected. |
| SF-003 one shared graph equated alternative actuals | Per-body graphs; the accepted distinct-object control with two calls stays accepted. |
| SF-004 produced summaries included incoming kills | Summary uses an empty entry; a separate informed analysis carries reads. Read-only helper reuse accepted. |
| SF-005 nested call kills were not projected through the caller's aliases | `callEffect` projects produced kills through the caller graph; witness rejected. |
| SF-006 forwarded global-to-parameter direction was missing | Composition adds both displacement directions; witness rejected. |
| SF-007 restoration unioned returning paths | Restoration intersects every returning path; early-return witness rejected. |
| SF-008 unsized dynamic read ignored known kills | An unsized dynamic read checks the whole root and the opaque sentinel; witness rejected. |
| SF-009 nested effects ignored the caller's opaque flag | A caller with an unresolved actual turns produced effects opaque; witness rejected. |
| SF-010 alias closure kept one displacement per root | Closure keeps every bounded `(root, displacement)` alternative; the two-field witness rejected. |
| SM-004 E10277 lacks causal write/call locations | **Accepted MINOR** — the existing call and declaration locations remain; causal spans are a diagnostic-precision enhancement, not a safety or acceptance gate. |

The alias fixed point is bounded to 64 rounds, the closure to 256 alternatives and the raw-write
projection to 256 entries. Any overflow becomes the conservative opaque kill rather than an
unproved acceptance.

## Verification

| Tier | Result |
| --- | --- |
| Public oracle | 96/96 across `c64-pal/ntsc` × 6581/8580 |
| Implementation oracle | 21/21 |
| Compiler package | 230 files / 3,893 passed / 2 skipped |
| Host checkpoint | 223 files / 4,894 passed |
| Cost pins | Nine accepted controls exact; the seven pre-existing controls keep their pre-change PRG and program bytes |
| `spec/` and expressiveness ledger | Byte-identical |

The full serialized VICE checkpoint belongs to the wave close after #157 and #162.

## Residuals

| Residual | Owner |
| --- | --- |
| Field-level caller-kill restoration through a helper | #157 |
| Bounded local index ranges and opaque-store recovery precision | #163 |
| Handler raw write overlapping an asynchronous callable read | interrupt ownership analysis |
| Constant address overlapping an automatically placed callable after layout | [#164](https://github.com/blendsdk/blend65/issues/164) |
| Alias precision inside a helper called with different actual objects | union relation, conservative by design |
| Causal E10277 related spans | diagnostic precision debt (SM-004) |

## Deferral-expiry check

Did this work invalidate a deferral's stated reason? Yes, one: the #156 closeout deferred
interprocedural and borrowed-alias invalidation to #161 on the ground that the analysis had no
cross-call facts. That reason no longer holds, and #156's closeout dependency is now satisfied.
Field transfer (#157), bounded indices (#163) and the post-layout constant overlap keep their own
open owners; none is orphaned by this closeout.
