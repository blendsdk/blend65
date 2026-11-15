# Bounded local callable index — execution plan

> **Owner**: issue [#163](https://github.com/blendsdk/blend65/issues/163).
> **Scope mode**: strict. No new runtime, source restriction or `spec/` change.

## Problem

With bounds checks disabled, an unchecked dynamic callable read is accepted only when the index
bound is visible in the same expression. A masked value held in a local is treated as unbounded, so
an unrelated raw-write kill rejects a safe read:

```blend65
let index: byte = peek($0400) & 1;
poke($C000, callbacks[index]());
```

## Decision

Carry a proved upper bound for a local place from a dominating store into the read, using the
existing kill/bounds seam:

- The store value's `indexUpperBound` is recorded for the exact place.
- The read's possible elements use that bound; the unrelated kill no longer matches.
- A later store never widens a read backwards; a store with an unknown bound clears the fact.
- A merge with a wider incoming value returns null; an unbounded local still rejects.
- The bound map is per block; a predecessor block's store is not propagated (conservative false
  rejection, never an unsafe acceptance).

## Tasks

- [x] T-163.1 Reproduce the bounded, unbounded, inline and later-store witnesses.
- [x] T-163.2 Extend the index-bound and possible-range seams with a local bound map.
- [x] T-163.3 Add the four-profile public oracle.
- [x] T-163.4 Compiler and host checkpoints.

## Acceptance

| Area | Oracle |
| --- | --- |
| Bounded local | The masked local read builds with bounds off and an unrelated kill. |
| Unbounded local | The unmasked local still fails `E10277`. |
| Inline masked | The inline expression still builds. |
| Later store | A later masked store does not bound an earlier read. |
| Merge/loop | Wider incoming values return unbounded; cross-block bounds stay conservative. |

## Residuals

| Residual | Owner |
| --- | --- |
| Cross-block dominating bound propagation | #163 precision debt |
| Bounds through helper returns | not claimed |

## Constraints

- `spec/` and the ledger stay byte-identical. No test or VICE journey is weakened. No push.
