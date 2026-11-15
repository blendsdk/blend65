# Straight-line ordinal write — closeout

> **Issue**: [#140](https://github.com/blendsdk/blend65/issues/140), T-20 precision extension
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Preflight**: [00-preflight-report-99-execution-plan.md](00-preflight-report-99-execution-plan.md)
> **Status**: Done (T-20 straight-line extension); other #140 rows remain
> **Recorded**: 2026-11-15

## Delivered

A straight-line `poke($0400 + i, value)` with a mask-bounded private byte index now selects the
native indexed store in optimized modes:

```asm
lda $0400
sta+1 $02
ldx+1 $02
lda #$07
sta+2 $0400,x
```

The write-only witness is 643 PRG / 641 program / 629 code bytes and zero-page 1, from 679 / 677 /
665 and zero-page 2: **36 bytes and one zero-page byte**. The index may be in A because `TAX`
preserves A; no value reload is lost.

- The canonical `none` mode keeps the indirect `sta (zp),y` pair at 679/677/665, ZP 2.
- An unbounded index keeps the indirect path.
- A device-window base (`$D800`) keeps the indirect path; the ordinary-RAM proof excludes it.
- A runtime index and a re-read of the same element behave correctly: the stored byte is 7 for
  indices 0..3 on all four profiles.

## Implementation

| File | Change |
| --- | --- |
| `packages/compiler/src/machine/lower-bounds.ts` | Straight-line raw read/write index bounds; snapshot before the write barrier; skip the literal base when recording the ordinal |
| `packages/compiler/src/machine/lower-arithmetic.ts` | Remove the stale A-held-index rejection; `TAX` preserves A |
| `test/rd04/ordinal-write-straight-line.spec.test.ts` | Four-profile assembly oracle |
| `test/rd04/ordinal-write-straight-line-cost.impl.test.ts` | Exact size and none pins |
| `test/rd04/ordinal-write-straight-line-vice.spec.test.ts` | 16 native cases (indices 0..3) |

## Review findings and resolutions

| Finding | Resolution |
| --- | --- |
| PF-140-001 the write's own alias barrier erased the index bound | Snapshot the bound before the barrier; later accesses still clear. |
| PF-140-002 the base literal's bound hid the real index | Skip the literal side in the ordinal loop. |
| PF-140-003 A-held index was rejected | Removed; `TAX` preserves A. |
| PF-140-004 none/device-window residuals | Accepted; the baseline and the ordinary-RAM boundary are unchanged. |

## Verification

| Tier | Result |
| --- | --- |
| Assembly + cost oracle | 18/18 across four profiles |
| Cost pins | Size 643/641/629, ZP 1; none 679/677/665, ZP 2 |
| Native VICE | 16/16: indices 0..3 on four profiles |
| Compiler package | 236 files / 3,934 passed / 2 skipped |
| Host checkpoint | 243 files / 5,111 passed |
| `spec/` and ledger | Byte-identical |

## Residuals

| Residual | Owner |
| --- | --- |
| None-mode straight-line ordinal writes | canonical baseline intentionally unchanged |
| Device-window ordinal stores | ordinary-RAM proof excludes the device window |
| Other #140 rows (T-22–T-27) | #140 |

## Deferral-expiry check

No deferral's reason is invalidated. The optimized straight-line bound is a precision extension of
the delivered T-20 proof; the canonical `none` baseline, the ordinary-RAM boundary and the
device-window exclusion keep their owners.
