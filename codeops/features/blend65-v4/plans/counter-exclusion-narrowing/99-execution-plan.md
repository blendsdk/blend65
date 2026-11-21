# Counter exclusion — release what narrowing cannot claim

> **Owner**: T-39 · **CodeOps Artifact Schema**: 1
> **Status**: Complete — two review lenses, 0 critical, both majors fixed, 7 minors applied
> **Progress**: 5/5 tasks (100%) · [closeout](08-closeout.md)
> **Last Updated**: 2026-11-21
> **Predecessor**: [word-assignment-forwarding](../word-assignment-forwarding/99-execution-plan.md)

## Why

The word-assignment forwarding slice excludes any variable a loop controls, because such a variable
is usually represented far more cheaply as a single byte or a register, and writing its declared word
home defeated that larger saving. The exclusion was deliberately conservative — it had to be, since
forwarding a counter once made a fixture grow from 701 bytes to 2,018.

It is broader than the thing it protects. Counter narrowing admits a loop only when its exit test
compares against a literal of **at most eight**. Every ordinary loop above that — `i < 100`, a frame
counter, a scan over a screen row — is excluded for nothing and pays the full price the predecessor
removed.

Measured, not assumed. A `for (let i: word = 0; i < 100; i += 1)` loop today emits, in **all four**
optimization modes:

```
lda $08be · clc · adc #$01 · sta $08ba     ; into a scratch
lda $08bf · adc #$00       · sta $08bb
lda $08ba · sta $08be                       ; and straight back out again
lda $08bb · sta $08bf
```

The last four instructions are the copy the predecessor exists to delete: **12 bytes and 16 cycles
per site**, forfeited on every counted loop in the language.

## What makes it safe

One implication, in one direction only. Narrowing requires a literal bound of at most eight, so a
bound above eight means narrowing **cannot** fire, which means there is no cheaper representation to
protect and the saving is free. The reverse is never asserted: a root stays excluded whenever
narrowing might still claim it.

The threshold needs no safety margin, because `bound` is not a trip count. It is the comparison's
own right-hand literal — `fixed-loop-facts.ts` computes it as `smallLiteral(literal(comparison.right))`
and documents it as *"Invariant exclusive literal bound, at most eight"*, with `smallLiteral`
returning nothing above `8n`. So `for (let i: word = 2; i < 10; i += 1)` has bound 10 and is released
correctly rather than by luck.

Two properties keep this honest:

- **Evidence is read structurally, never from facts.** The two failed attempts in the predecessor
  both failed because the loop facts are empty in the pass where forwarding fires. The comparison
  constant is already reachable: the exit-test walk visits the `binary` comparison on its way to the
  counter load, so the constant is in hand without consulting any fact.
- **Release is ALL, not ANY.** A root is released only when *every* signal that nominated it shows a
  structural literal above the threshold. One small-bound signal, one non-literal comparison, or one
  nomination from the block-final latch fallback — which has no condition to read — keeps it
  excluded. Protection wins ties.

## Gates cleared before planning

| Gate | Result |
| --- | --- |
| Does a frozen oracle pin a bound>8 counter as *excluded*? | **No** — the frozen oracle contains no counted-loop fixture, so releasing nothing it asserts |
| Is a bound-100 counter already narrowed in some mode, making the implication false there? | **No** — it is a memory word in all four modes; the `inx` that suggested otherwise was the startup stub, not the counter |
| Does the 701-byte cliff fixture fall inside the released set? | **No** — its loop is `i < 8`, at or below the threshold, so it stays excluded by construction |

## Non-goals

- The `hi` arm of the unary byte-write forwarding. Same class, different owner. **Since delivered.**
- `x = x ± constant` as `inc lo; bne +; inc hi`. Recorded here as **structurally blocked**, which
  was wrong and is corrected in this unit's closeout. The two observations behind it are both true —
  relative branches exist only as block terminators (`bind.ts` resolves relative mode for
  `terminator.opcode` alone) and value lowerings return a flat instruction list — but the
  conclusion drawn from them was not, because the function lowering loop already splits the block
  it is filling to give one operation its own branch-terminated blocks, which a platform frame wait
  uses today. The predecessor's three-byte estimate was also low: the `±1` form is worth about nine.
- Releasing the exclusion wholesale when no narrowing policy is active. Tempting at `none`, but it
  would key on fact visibility in a pass where facts have twice proved empty — the exact failure
  mode that caused the cliff.

## Tasks

- [x] **T-39.1 Baselines.** Digest every example in all four modes, plus the bound-100 probe and the
      701-byte cliff fixture. Emitted bytes only; exclude `.build.json` and `current.json`.
- [x] **T-39.2 Controls at RED.** Extend the existing impl controls with a bound-above-threshold
      counted loop (must show the scratch copy today) and a bound-at-threshold loop (must keep it,
      now and after). Reproduce RED before implementing.
- [x] **T-39.3 Implement.** Replace the root set with per-root evidence so release can require ALL
      signals. Read the comparison constant from the walk already in place.
- [x] **T-39.4 Measure.** Re-digest. The bound-100 probe must shrink by 12 bytes per site; the cliff
      fixture must stay exactly 701; no example may grow in any mode.
- [x] **T-39.5 Verify and review.** Frozen oracles 20/20 and 9/9 with blobs unchanged, behaviour
      oracle green, emulator tier isolated, then correctness and machine-code review lenses.

## Measured outcome

| Subject | Before | After | Verdict |
| --- | ---: | ---: | --- |
| Bound-100 probe, `none` | 180 | **168** | −12 |
| Bound-100 probe, `balanced` / `speed` / `size` | 172 | **160** | −12 |
| Cliff fixture, all four modes | 2159 / 701 / 701 / 701 | **unchanged** | tripwire holds |
| All seven examples, all four modes | — | **byte-identical** | nothing moved, nothing grew |

The released update is now the canonical seven-instruction in-place form with no scratch traffic:
`lda lo · clc · adc #$01 · sta lo · lda hi · adc #$00 · sta hi`.

The win appears on the probe rather than on any shipped example, because the examples' counted loops
are all at or below the threshold. That is stated plainly rather than presented as a corpus gain.

## Verification

| Check | Result |
| --- | --- |
| Impl controls, including two that pin exact sizes for `i < 8` shapes | **5/5** |
| Frozen shape oracle, blob untouched | **20/20** |
| Frozen emulator oracles | **10/10** |
| Neighbours pinning exact bytes or whole-PRG digests | **9/9** |
| New emulator test: released counter counts a hundred times and carries to `$012C` | **4/4**, all modes |

The emulator test is an invariance net rather than a red-to-green proof — the scratch form counted
correctly too. Its job is to catch a released counter that stops counting, which no existing oracle
covered, since every counted-loop fixture in the suite sits at or below the threshold.

## Design change made during implementation

The first version left the block-final latch nomination unconditional, and the release never fired.
On a counted loop the update block's last operation *is* the counter store on a closing edge, so it
always nominated the counter with no extent, which under ALL-semantics permanently outvoted the
extent the exit test did supply. The backstop now stands down per edge for any root the exit-test
walk already named. It remains a backstop for a latch whose condition cannot be read.

## Stop conditions

Any of these halts the unit rather than being worked around: the cliff fixture moves off 701, any
example grows in any mode, a frozen oracle reddens, or the released set is found to contain a loop
whose counter narrowing would have claimed.
