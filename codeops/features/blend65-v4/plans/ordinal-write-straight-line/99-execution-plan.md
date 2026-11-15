# Straight-line ordinal write — execution plan

> **Owner**: issue [#140](https://github.com/blendsdk/blend65/issues/140), T-20 precision extension.
> **Scope mode**: strict. No change to the canonical `none` baseline, no new runtime or source
> restriction.

## Problem

A proved `poke($0400 + i, value)` with a mask-bounded private byte index already selected
`sta absolute,x` in optimized modes when the bound came from a fixed loop. A straight-line body had
no ordinal bound, so it fell back to the 16-bit address build and `sta (zp),y`.

## Decision

- Extend the same-block straight-line bound already used by the shift consumer to raw read/write
  addresses: `constant + bounded-local-index` records the index bound for that access.
- The write's own address/index is evaluated before the write, so its bound survives the write's
  own aliasing barrier; the barrier still clears later accesses.
- The literal side of the sum is skipped when recording the ordinal, so the base's numeric value
  cannot hide the real index.
- The index may be in A: the memory lowering already emits `TAX` (which preserves A) before loading
  a non-A value, so the previous rejection was unnecessarily conservative.
- `none` stays canonical: the ordinal facts are still wired only for optimized observer modes.
  An unbounded index and a device-window base (`$D800`) keep the indirect path.

## Tasks

- [x] T-140.1 Reproduce the straight-line indirect write and the size-mode regression.
- [x] T-140.2 Extend the straight-line bound to raw read/write addresses.
- [x] T-140.3 Remove the conservative A-index rejection; rely on the existing `TAX` lowering.
- [x] T-140.4 Add the four-profile assembly oracle, cost pins and native cases.
- [x] T-140.5 Compiler and host checkpoints.

## Acceptance

| Area | Oracle |
| --- | --- |
| Size mode | `sta $0400,x` with `ldx`; no `sta (`. |
| None mode | The canonical `sta (zp),y` pair remains. |
| Unbounded index | The indirect store remains. |
| Device-window base | The indirect store remains. |
| Runtime | The stored and re-read byte is 7 for indices 0..3 on four profiles. |
| Cost | Size 643/641/629, ZP 1; none 679/677/665, ZP 2. |

## Residuals

| Residual | Owner |
| --- | --- |
| None-mode straight-line ordinal writes | canonical baseline intentionally unchanged |
| Device-window ordinal stores | not admitted by the ordinary-RAM proof |
| Other #140 rows (T-22–T-27) | #140 |

## Constraints

- `spec/` and the ledger stay byte-identical. No test or VICE journey is weakened. No push.
