# Stable byte classifier chain — execution plan

> **Owner**: issue [#132](https://github.com/blendsdk/blend65/issues/132).
> **Scope mode**: strict. No new pass, runtime, source workaround or `spec/` change.

## Problem

A dense equality classifier reloads the same ordinary byte for every comparison and destroys it
with `EOR`:

```asm
lda seed
beq return0
lda seed
eor #$01
beq return1
lda seed
eor #$02
beq return2
...
```

The equivalent expert keeps A: `lda seed; beq`, then `cmp #k; beq` for each consecutive value.
The issue measures 21 bytes and 28 nominal cycles saved in `Game.main`/`work`.

## Decision

- A dense chain starts at `place == 0` and continues through `place == k` for consecutive `k`.
  The first comparison emits `lda place; beq` and leaves the byte in A.
- Each continuation block has exactly one predecessor, so no join can substitute another A value,
  and begins with the same whole-byte load. Its leading load is omitted and the equality lowers to
  `cmp #k`; CMP preserves A across the rest of the chain.
- Pass-through blocks with no instruction-producing operations carry the fact. A store, call,
  memory write, platform operation, wider comparison, skipped constant, control-flow merge or
  `!=` comparison ends the chain and keeps the ordinary `lda`/`eor` form.
- The first comparison keeps the ordinary load: only the continuations are rewritten. Zero tests
  are not converted, so the emitted carry behavior stays the issue's analyzed sequence.
- Stable ordinary storage only: whole scalar/enum/sbyte bytes, no word, aggregate, asset or
  volatile read. No call, MMIO or opaque effect is crossed.

## Tasks

- [x] T-132.1 Record the pre-change RED (assembly `lda`/`eor` chain, 276/274/262 bounds off and
      292/290/278 bounds on).
- [x] T-132.2 Add the dense-chain selection and the leading-load reuse.
- [x] T-132.3 Lower the held equality to `cmp #k` while preserving the ordinary fallback.
- [x] T-132.4 Add implementation tests for byte, sbyte and enum chains plus the gap, store, merge
      and inequality barriers.
- [x] T-132.5 Add the four-profile assembly oracle, the exact cost pins and the 40-case native
      behavior oracle (seeds 0..8 and 255 on all four PRG profiles).
- [x] T-132.6 Compiler and host checkpoints.

## Acceptance

| Area | Oracle |
| --- | --- |
| Dense chain | `work` has one seed `lda`, no `eor`, and one `cmp #k` for each 1..7. |
| Bounds | The chain holds with bounds checks on and off. |
| sbyte / enum | Both typed byte forms reuse one load. |
| Gap | `0` then `2` keeps `lda`/`eor #2`. |
| Store / merge / `!=` | Each barrier keeps the ordinary reload. |
| Runtime | Seeds 0..8 and 255 return the expected byte on PAL/NTSC 6581/8580. |
| Cost | Bounds off 255/253/241; on 271/269/257; zero-page 2, scratch 0 (from 276/274/262 and 292/290/278). |

## Residuals

| Residual | Owner |
| --- | --- |
| Chain starting at a nonzero value | keeps the first `lda`/`eor`; no C-preservation claim |
| Sparse or unordered classifier | ordinary reload per comparison |
| Cross-block dataflow beyond the dense single-predecessor chain | not claimed |
| Volatile, MMIO, async-observer or callback storage | never held |

## Constraints

- `spec/` and the ledger stay byte-identical. No test or VICE journey is weakened. No push.
