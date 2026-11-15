# Callable-field helper transfer — closeout

> **Issue**: [#157](https://github.com/blendsdk/blend65/issues/157)
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Preflight**: [00-preflight-report-99-execution-plan.md](00-preflight-report-99-execution-plan.md)
> **Status**: Done (bounded to direct field transfer and direct restoration)
> **Recorded**: 2026-11-15

## Delivered

A helper's definite store of a direct callable source into a whole callable field now transfers to
the caller's assignment facts. The issue witness builds and resolves to `chosen`. The same holds for
a borrowed parameter field and for an uninitialized borrowed aggregate that the helper initializes.

- The transfer accepts a global aggregate field, a field under a borrowed parameter, a whole bare
  callable global, and ordered startup initializers.
- A sibling non-callable field store is irrelevant. A conditional store, an indexed store, a
  whole-parameter store and a non-source value (for example `box.cb = other.cb`) stay conservative.
- A raw write through `&value.cb`, a helper that stores then corrupts, and a corrupted aggregate
  copy still fail `E10277`.
- A caller kill followed by a direct helper field store is repaired for a global field and a
  borrowed field.

## Implementation

| File | Change |
| --- | --- |
| `packages/compiler/src/semantic/callable-paths.ts` | Shared argument-origin resolver |
| `packages/compiler/src/semantic/assignment-facts.ts` | Definite-write summary carries the parameter index; call-site translation uses a single definite origin; field keys transfer |
| `packages/compiler/src/semantic/function-targets.ts` | Per-key unsafe-store filter; callable-field roots; definite-write paths excluded from the argument transfer; field restorations translated |
| `packages/compiler/src/semantic/interprocedural-kills.ts` | Definite field byte intervals in the restoration summary |

## Review findings and resolutions

| Finding | Resolution |
| --- | --- |
| SF-001 uninitialized borrowed aggregate stayed poisoned | The definite field path is excluded from the argument-to-parameter transfer; the uninitialized witness now builds. |
| SF-002 merged/indexed origins were claimed as definite | Only a single origin with no index path transfers; merged and indexed origins stay conservative. |
| SF-003 caller-kill restoration excluded fields | Field byte intervals and parameter translation are in the restoration summary; direct global and borrowed restores pass. |
| SF-003 transitive/startup restoration | **Accepted residual** — false rejection; owned by [#165](https://github.com/blendsdk/blend65/issues/165). |

## Verification

| Tier | Result |
| --- | --- |
| Public oracle | 48/48 across four profiles |
| Implementation oracle | 13/13 |
| Compiler package | 231 files / 3,906 passed / 2 skipped |
| Host checkpoint | 225 files / 4,943 passed |
| VICE | 4/4; `chosen` returns 37 on PAL/NTSC 6581/8580 |
| Cost pin | PRG 713, program 711, code 699, zero-page 2, scratch 0 |
| `spec/` and ledger | Byte-identical |

## Residuals

| Residual | Owner |
| --- | --- |
| Transitive restoration through a helper chain or ordered startup | #165 |
| Indexed callable-field assignment transfer | #163 |
| Indirect-call definite field transfer | direct-call transfer only; documented |
| Handler raw write overlapping an asynchronous read | interrupt ownership analysis |

## Deferral-expiry check

No deferral's stated reason is invalidated by this slice. The parameter-field and global-field
forms now transfer; indexed transfer, indirect-call transfer and transitive restoration keep their
existing owners. No deferral names this plan as its landing place.
