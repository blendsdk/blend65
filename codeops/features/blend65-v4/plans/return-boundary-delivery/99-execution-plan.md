# Delivering a result across a callee's return

> **Owner**: [#181](https://github.com/blendsdk/blend65/issues/181) · **Type**: Task (lightweight)
> **CodeOps Artifact Schema**: 1
> **Status**: Complete for enumerable direct callers; canonical reference unchanged by design
> **Progress**: 6/6 tasks in scope (100%)
> **Last Updated**: 2026-11-23

## What was wrong

A runtime-count shift delivered its result through a temporary nothing else read,
purely because the next instruction was a return:

```asm
asl
dex
bne loop
sta $087a        ; a temporary nothing reads
lda $087a
sta answer
rts
```

The identical statement inside `main` already stored straight into `answer`. The
only difference was the return.

## Why the refusal stood, and what actually settles it

The flag-death walk delivered beside it follows control flow out of a block, but
it stopped at a return, because the flags a caller sees are not the callee's to
spend. That was the honest answer: a body cannot read its own callers.

The fact that closes it is interprocedural and had to be built. One correction
to the premise came out of measurement first: the call convention hands back no
flags, but that is a statement about what a caller *may* rely on, not about what
the generated caller *does*. A boolean-returning body really does leave its
answer in Z, and its caller really does branch on it:

```asm
jsr ready
beq skip
```

So the answer cannot be read off the convention. It has to be read off every call
site, which is what the delivery does: the walk simply continues in the caller
from the instruction after the call, using the same rules it already used inside
one body. Nothing consults the separate boolean-exit certificate — a caller that
observes the flag is refused by the branch terminator's own flag check, which was
already there.

## The fix

A new census, `machine/call-site-facts.ts`, answers two questions about calls and
nothing else. `directCallSites` enumerates every plain direct call into one body
or refuses the enumeration outright, and `calleeRewritesFlags` says whether a
body certainly rewrites N and Z before reading either.

The walk in `machine/optimization-cleanup.ts` then takes an optional caller fact.
Its absence is the old behaviour exactly, which is what keeps every other proof
in that file byte-identical.

Two barriers deserve naming because they are easy to get wrong:

- **"Every caller" is only usable when the callers can be counted.** A body whose
  address is taken can be called from a stored pointer, so an enumeration of its
  direct calls is no longer complete. A dispatch candidate is worse: such a body
  returns to whoever called the dispatch block, not to the transfer. A body with
  no call at all refuses too, because a vacuous "every caller" is exactly how a
  label-matching mistake would pass unnoticed.
- **A call encodes no flag of its own.** Stepping a flag-death walk over one is
  only safe when the body behind it certainly rewrites the pair, because a body
  that opens by pushing the status register observes precisely what is being
  proved dead. The old walk stepped over calls freely; that optimism was
  unreachable while the return refused everything downstream, and the caller fact
  would have made it reachable, so the new path is strict about it.

| Shape | Answer | Why |
| --- | --- | --- |
| Delivery, every caller ignores N/Z | deliver | nothing observes the pair |
| Next instruction is another call that rewrites the pair | deliver | the callee's opening kills it |
| Two returns deep | deliver | the fact composes through the caller's own callers |
| Canonical `none` construction | retain | the reference a build is measured against |
| The caller pushes the status register | retain | it observes every flag |
| The body is a run-time dispatch candidate | retain | it returns to the dispatch block's caller |
| The body's address is taken | retain | a stored pointer can be called from anywhere |
| The next call settles no flag | retain | its opening is itself a call |
| The body is entered by a jump or fallthrough | retain | not a call site |
| Nothing calls the body | retain | not a satisfied "every caller" |
| A cycle of bodies | retain | they would prove each other |

The order-independence rule carries over without being restated. A reload this
same pass may itself remove must not count as a flag producer, or the answer
would depend on which candidate pair happened to be visited first. The walk
already declined to credit one, and a caller walk is the same walk, so the rule
now holds across a call boundary for the same reason it held inside one block.

## Measured result

Four witnesses, four profiles, bounds off / on:

| Witness | `none` | before | after |
| --- | ---: | ---: | ---: |
| Called once | 128 | 118 | **112** |
| Two call sites | 131 | 121 | **115** |
| Caller carries on with its own work | 143 | 133 | **127** |
| Two returns deep | 132 | 122 | **116** |

Six bytes and eight cycles on every delivered result, identical at `balanced`,
`speed` and `size` and unaffected by bounds checking. Canonical `none` is
byte-identical on every witness.

The delivered shape is what an expert would have written by hand:

```asm
asl
dex
bne loop
sta answer
rts
```

Every refusal witness is byte-identical before and after: a caller that pushes
the status register, a two-candidate dispatch, an address taken beside a direct
call, a next call that settles no flag, and an interrupt body, which is not a
candidate at all.

## The one pinned answer that moved

`test/rd04/runtime-shift-result-delivery.spec.test.ts` carried
`should keep the staging home where the delivery ends at a return`, which pinned
the refusal at `balanced`. Delivering this turns that case red, by producing the
better sequence. The issue that owned the work named that exact case in advance
as the one the delivery would move, and the case pinned an implementation limit
filed with its own issue rather than a required behaviour, so the limitation —
not the test — was the thing under repair.

It is now `should deliver directly where the path ends at a return`, asserting
the same witness against the correct answer. Four lines changed in that file and
nothing else; the other thirty-two cases are untouched and pass.

## Tasks

- [x] T-181.1 Measure the filed witness and eight controls at all four goals, bounds off and on.
- [x] T-181.2 Settle the call-site label identity and the dispatch form from the program's own model.
- [x] T-181.3 Author the call census as its own module.
- [x] T-181.4 Take the walk across the return behind that fact, strictly over calls.
- [x] T-181.5 Author the four-profile oracle, proved red before the fix, and the unit cases.
- [x] T-181.6 Compiler, host and root checkpoints.

## Acceptance

| Area | Oracle |
| --- | --- |
| Called once | `sta b65_Game_answer_` then `rts`, no staged pair |
| Next instruction is another call | delivered directly |
| Caller carries on with its own work | delivered directly |
| Two returns deep | delivered directly |
| Every optimized goal | `speed` and `size` deliver the same way |
| Bounds checks on | the same delivery, measured not assumed |
| Canonical reference | `none` still stages the result |
| Caller pushes the status register | the staging home survives |
| Run-time dispatch candidate | the staging home survives |
| Address taken | the staging home survives |
| Next call settles no flag | the staging home survives |

## Verification

| Tier | Result |
| --- | --- |
| Oracle red before the fix | 24 failed / 16 passed — every failure a delivery case, every pass a retention control |
| `test/rd04/return-boundary-delivery.spec.test.ts` | 44/44 on four profiles |
| `test/rd04/runtime-shift-result-delivery.spec.test.ts` | 36/36 with the one moved case |
| `call-site-facts.impl.test.ts` | 23/23, every guard proved load-bearing by removal |
| Compiler machine tier | 91 files / 1,275 |
| Compiler services + frontend | 68 files / 1,553 |
| Compiler storage, semantic, layout, project, artifacts, assets, target, tools | 103 files / 1,623 |
| Root host tier | 273 files / 5,765, green on the first run |

The byte-for-byte optimizer artifact pins passed, which is the one place a change
to the cleanup pass could have shown up unannounced.

Each census guard was removed in turn and failed exactly its own cases:

| Guard removed | Cases that failed |
| --- | --- |
| Plain-call offset check | the offset label |
| Other-mention check on an operand | the address byte, the layout relation, the offset label |
| Memory-effect label check | the effect naming the label |
| Dispatch-candidate check | the recorded candidate |
| Terminator-target check | the jump and the fallthrough |
| No-caller refusal | the body nothing calls |
| Called-operand shape check | the offset call |
| Missing-opening check | the absent body and the empty body |
| Opening flag-definition check | the three partial-definition openings |
| Opening flag-observation check | the two openings that read the pair |

Two barriers cannot be reached from accepted source and are pinned in the unit
file rather than the oracle. An opening that both writes N and Z and reads either
matches no opcode in the documented set, so its case builds the instruction; the
barrier holds for anything a later pass might construct rather than for today's
table. A cycle of bodies is rejected by the language itself — `E10181`, indirect
recursion — so the walk's cycle guard stays only so that the soundness of a proof
does not rest on a diagnostic raised in another subsystem.

## Residuals

**A result handed back through the accumulator is staged in the caller.** A
byte-returning callee's result arrives in A, and the caller stages it before
testing it:

```asm
jsr shifted
sta $087e        ; 6 bytes / 8 cycles
lda $087e
bne skip
```

This is the same waste on the other side of the call and is refused for a
different reason: the producer of the byte is the call itself, which defines no
flag, so the adjacent-producer proof cannot admit the pair and the entry-forwarding
route does not apply either. Closing it needs a stated fact about what a callee
leaves in A and its flags at every return, which is a different certificate from
the caller census built here.

**A call to an unresolvable target refuses conservatively.** A call reaching a
shared helper block rather than a body entry settles no flag as far as this census
is concerned, even when the helper plainly rewrites the pair. Admitting those
needs the helper blocks indexed the way bodies are.
