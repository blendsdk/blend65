# A call that delegates its own opening

> **Owner**: [#186](https://github.com/blendsdk/blend65/issues/186) · **Type**: Task (lightweight)
> **CodeOps Artifact Schema**: 1
> **Status**: Complete for the reachable half; the helper-block half closes as a measured barrier
> **Progress**: 6/6 tasks in scope (100%)
> **Last Updated**: 2026-11-23

## What was wrong

Stepping a flag-death walk over a call needs more than the call's own encoding,
which touches no flag: the body behind it runs arbitrary code. One opening
instruction that writes N and Z and reads neither settles it, because whatever
follows can no longer see the pair.

That question was asked of exactly one instruction, so a body whose first
instruction is itself a call refused — not because anything was in doubt, but
because the answer was one level further down:

```asm
b65_Game_wrap_:
  jsr b65_Game_inner_
  rts
b65_Game_inner_:
  lda b65_Game_other_      ; writes N and Z, reads neither
  …
```

A caller whose next call is `wrap` therefore kept a staging home that `inner`
plainly makes unnecessary.

## The two halves, which have different answers

The issue describes one problem and it is really two.

**The reachable half** is the shape above: a call whose target resolves to a body
whose opening is another call. A call encodes no flag of its own, so nothing has
been read or written by the time the inner body starts, and the inner body's own
opening settles the pair for both. Asking the same question one level down is
therefore sound, and following the chain is what lets a one-line wrapper be
stepped over rather than refused for having delegated its first instruction.

Termination needs its own guard. A chain arriving back where it started proves
nothing, so the walk carries the labels it has already visited and refuses a
cycle. Recursion is rejected by the language, so no accepted program reaches that
barrier; it stays because a proof's termination should not rest on a diagnostic
raised in another subsystem — and removing the guard does not merely weaken the
answer, it exhausts the stack.

**The other half** is a call whose target is a shared helper block rather than a
body entry, which cannot be resolved at all. That half is closed as a recorded
barrier rather than repaired, and the evidence is below.

## Why the helper-block half closes unrepaired

The refusal only costs anything when an unresolvable call is the **first**
instruction the walk meets with the flags still live. Almost every instruction
writes N and Z, so the window is narrow by construction, and the issue recorded
its cost as unmeasured rather than measured at zero because no witness had been
built.

Six shapes were then built to look for one: byte division, byte modulo, dividing
the delivered byte itself, word division, multiplication, and a helper call
wrapped inside its own body. In each one the generated sequence loads an operand
before it reaches the helper, and that load writes N and Z — so the pair is
already dead and the delivery happens regardless of whether the helper call can
be resolved.

That is a negative answer with evidence behind it, which the issue itself names
as a good outcome. Indexing block labels alongside body entries would be sound
and would buy nothing measurable, so the barrier stays and the reason is recorded
here rather than discovered again.

## Two premises the work corrected

The issue expected the unit case `refuses a call whose target is not a body the
program contains` to be the one to move. It does not move, and stays green:
resolving a call still requires a body entry, because the half that would have
changed that is the half closing as a barrier.

The oracle case it names as pinning the reachable half does move, and is the only
pinned answer this session touches. `should keep the staging home where the next
call settles no flag` in `test/rd04/return-boundary-delivery.spec.test.ts` pinned
exactly this limitation — its witness is byte-for-byte the wrapper shape — and the
issue named it in advance. It is now `should deliver directly where the next call
delegates its own opening`, with one sentence of its doc comment corrected to say
what following the chain reaches. Nothing else in that file changed and its other
forty cases pass.

## A duplication removed, and one left in place

Extracting the called label needed the same operand test the census beside this
one already performs, so `plainEntryLabel` is stated once and the census's own
`plainEntryCall` is expressed in terms of it. That extraction landed with the
return-contract work, which was its first consumer.

## A reachable shape this deliberately still refuses

A wrapper whose inner body opens by saving the whole status register refuses,
because that opening reads exactly the pair being proved dead. It is a correct
refusal of the question as asked — but the matching restore is two instructions
later, so the pair is preserved rather than spent, which is precisely what the
flag-death walk itself was taught earlier in this run of sessions.

Teaching this census the same thing is a further generalisation, not a gap in
this one: the census asks about one opening instruction, while stepping over a
save window is a walk. The shape is reachable from source and appears in the
table below as a refusal, retaining the same staged pair the delivering witnesses
drop — so its cost is the pair's own six bytes, inferred from the two absolute
instructions rather than measured by delivering it. It is recorded here rather
than filed, because the remaining order on this board belongs to whoever extends
it.

## Measured before anything was changed

Ten witnesses, every optimization goal, bounds checks off and on, ACME 0.97, on
the four cooperative KERNAL PRG profiles. Each figure is a whole-image PRG size.

| Witness | Before | After | Saved |
| --- | --- | --- | --- |
| The next callee is a one-line wrapper | 138 | 132 | 6 |
| Two wrappers deep | 142 | 136 | 6 |
| The chain reaches a status save | 204 | 204 | — |
| A call to a generated helper block | 196 | 196 | — |
| The seven return-contract witnesses beside them | — | — | byte-identical |

Six bytes and eight cycles plus one home on each delivered result, identical at
`balanced`, `speed` and `size`, and unchanged by bounds checking. Of eighty
generated artifacts compared as text before and after, exactly the twelve that
save differ — the two delivering witnesses at three optimized goals with bounds
either way — and the other sixty-eight are byte-identical, including every
canonical `none`.

## The search for a helper-block witness

Six shapes, each built to put an unresolvable helper call immediately after a
delivery. The instruction the walk actually meets first is recorded for each,
together with whether the delivery happened anyway.

| Shape | First instruction after the call | Staged |
| --- | --- | --- |
| Byte division | `lda b65_Game_divisor_` | no |
| Byte modulo | `lda b65_Game_divisor_` | no |
| Dividing the delivered byte itself | `lda b65_Game_divisor_` | no |
| Word division | `lda b65_Game_step_` | no |
| Multiplication | `lda b65_Game_factor_` | no |
| The helper call inside its own body | `jsr b65_Game_divide_` | no |

Every one of them loads an operand before reaching the helper, and a load writes
N and Z — so the pair is already dead and the delivery happens whether or not the
helper call can be resolved. The sixth shape has no helper-block call in the
caller at all, and the call it does make is an ordinary body the census resolves.

So the cost of the unresolvable-call refusal is measured at zero across every
shape that could carry it, rather than left unmeasured. That half closes as a
recorded barrier.

## Tasks

- [x] T-186.1 Establish whether a helper-block witness exists, by construction rather than by argument.
- [x] T-186.2 Measure the reachable wrapper shape and its controls at all four goals, bounds off and on.
- [x] T-186.3 Make the opening question transitive, with its own termination guard.
- [x] T-186.4 Author the four-profile oracle, proved red before the fix, and the unit cases.
- [x] T-186.5 Move the one pinned answer the issue named in advance.
- [x] T-186.6 Compiler, host and root checkpoints.

## Acceptance

| Area | Oracle |
| --- | --- |
| The next callee is a wrapper | `sta b65_Game_answer_`, no staged pair |
| A chain of wrappers | delivered directly |
| Every optimized goal | `speed` and `size` deliver the same way |
| Bounds checks on | the same delivery, measured not assumed |
| Canonical reference | `none` still stages the result |
| The chain reaches a status save | the staging home survives |
| The wrapper itself | still a plain call and return |

## Verification

| Tier | Result |
| --- | --- |
| Oracle red before the fix | 20 failed / 52 passed across both files — every failure a delivery case, every pass a retention or reference control |
| `test/rd04/wrapper-call-flag-settlement.spec.test.ts` | 28/28 on four profiles |
| `test/rd04/return-boundary-delivery.spec.test.ts` | 44/44 with the one moved case |
| `call-site-facts.impl.test.ts` | 30/30, both new guards proved load-bearing by removal |
| Compiler machine tier | 93 files / 1,334 |
| `test/rd08/optimizer-saved-output.spec.test.ts` (VICE) | 17/17, including its byte-exact payload pins |
| Root host tier | 278 files / 5,941, green on the first run |

Each new guard was removed in turn:

| Guard removed | Result |
| --- | --- |
| Following a call opening | the wrapper and the wrapper chain both failed |
| The cycle refusal | both cycle cases died with `RangeError: Maximum call stack size exceeded` |

The second row is the useful one. The cycle guard is not documenting an
assumption about recursion — without it the walk does not terminate at all, so
the barrier is doing real work even though no accepted program reaches it.
