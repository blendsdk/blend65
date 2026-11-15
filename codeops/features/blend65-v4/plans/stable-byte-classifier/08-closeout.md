# Stable byte classifier chain — closeout

> **Issue**: [#132](https://github.com/blendsdk/blend65/issues/132)
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Preflight**: [00-preflight-report-99-execution-plan.md](00-preflight-report-99-execution-plan.md)
> **Status**: Done
> **Recorded**: 2026-11-15

## Delivered

The dense equality classifier now reuses one stable byte load and compares immediately:

```asm
lda seed
beq return0
cmp #$01
beq return1
cmp #$02
beq return2
...
cmp #$07
beq return7
lda #$ff
rts
```

That is the issue's expert form: one `lda`, seven `cmp #k`, no reloads and no `eor`.

| Artifact | Before | After | Saving |
| --- | ---: | ---: | ---: |
| Bounds off PRG / program / code | 276 / 274 / 262 | **255 / 253 / 241** | **21** |
| Bounds on PRG / program / code | 292 / 290 / 278 | **271 / 269 / 257** | **21** |

Zero-page stays 2 and scratch 0 in both modes. The saving equals the issue's 21-byte analytical
projection and its `work` 138→117 / 154→133 reduction.

## Implementation

| File | Change |
| --- | --- |
| `packages/compiler/src/machine/held-byte.ts` (new) | Dense-chain selection: `==0` start, single-predecessor consecutive `==k` continuations, instruction-free pass-through blocks |
| `packages/compiler/src/machine/lower-operation.ts` | Serve a selected leading load from A without emitting `lda` |
| `packages/compiler/src/machine/lower-comparison.ts` | Lower the held equality to `cmp #k`, preserving A |
| `packages/compiler/src/machine/lower-function.ts`, `lower-state.ts` | Carry the per-function held-value set |
| `packages/compiler/src/machine/held-byte.impl.test.ts` | Byte, sbyte and enum chains plus gap, store, merge and inequality barriers |
| `test/rd04/stable-byte-classifier.spec.test.ts` | Four-profile assembly oracle, both bounds modes |
| `test/rd04/stable-byte-classifier-cost.impl.test.ts` | Exact PRG/program/code pins |
| `test/rd04/stable-byte-classifier-vice.spec.test.ts` | 40 native cases: seeds 0..8 and 255 on all four PRG profiles |

## Review findings and resolutions

| Finding | Resolution |
| --- | --- |
| PF-132-001 join with a different A | Every continuation has exactly one predecessor; a merge ends the chain. |
| PF-132-002 CMP changes C/N | Only the dense 0..k prefix participates; each reached `cmp #k` leaves C=1; zero tests keep the ordinary load. |
| PF-132-003 unstable/intervening storage | Only whole stable bytes with instruction-free pass-through blocks; stores, calls, MMIO, wider places and dynamic indices end the chain. |
| PF-132-004 incoming carry of 0 | **Accepted residual** — with a nonzero continuation the new C is 1 where the old EOR form preserved an incoming 0; the issue witness enters with C=1, so every path is unchanged. |

## Verification

| Tier | Result |
| --- | --- |
| Implementation | 7/7 |
| Assembly oracle | 12/12 across four profiles and both bounds modes |
| Cost pins | Bounds off 255/253/241; on 271/269/257; zero-page 2, scratch 0 |
| Native VICE | 40/40: seeds 0..8 and 255 on PAL/NTSC 6581/8580 |
| Compiler package | 234 files / 3,925 passed / 2 skipped |
| Host checkpoint | 237 files / 5,059 passed |
| `spec/` and ledger | Byte-identical |

## Residuals

| Residual | Owner |
| --- | --- |
| Chain starting at a nonzero value | keeps the first `lda`/`eor`; no C-preservation claim |
| Sparse or unordered classifier | ordinary reload per comparison |
| Cross-block dataflow beyond the dense single-predecessor chain | not claimed |
| Volatile, MMIO, async-observer or callback storage | never held |
| Incoming carry 0 with a nonzero continuation | accepted residual; the issue witness enters with 1 |

## Deferral-expiry check

No deferral's reason is invalidated. The transform is bounded to the stable ordinary-RAM dense
chain the issue proves; volatile reads, interrupt observers, wider comparisons and sparse chains
keep their existing behavior and owners. The `size` observer still owns its own window proof; this
slice removes the reloads before that observer runs, and the complete optimizer pins stayed green.
