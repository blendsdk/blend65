# Word unit increment — the expert form for `x = x + 1`

> **Owner**: T-41 · **CodeOps Artifact Schema**: 1
> **Status**: Complete — two review lenses, 0 critical, 0 major on emitted code, 1 major on the proof comment, 8 minors
> **Progress**: 6/6 tasks (100%)
> **Last Updated**: 2026-11-21
> **Predecessors**: [word-assignment-forwarding](../word-assignment-forwarding/99-execution-plan.md),
> [counter-exclusion-narrowing](../counter-exclusion-narrowing/99-execution-plan.md)

## Why

Advancing a two-byte variable by one is the most common arithmetic a game performs, and the
compiler emits the general word-addition chain for it. The two earlier slices made that chain
operate in place, which was the larger half of the problem; what remains is that the chain itself
is the wrong instruction selection for a unit step.

Measured today on a local word, after both predecessors:

```
lda lo · clc · adc #$01 · sta lo · lda hi · adc #$00 · sta hi      17 bytes, 22 cycles
inc lo · bne skip · inc hi · skip:                                  8 bytes, 9 or 14 cycles
```

**Nine bytes, and eight to thirteen cycles, at every unit step of a word.** The casebook endorses
the `INC`/`DEC` selection for an increment or decrement by one, choosing on location, needed result
flags, and carry liveness — which is exactly the proof this unit owes.

## The seam, and a correction to the record

Two earlier closeouts recorded this as structurally blocked, needing either a new value-lowering
contract or a post-lowering splitting pass. **That conclusion was wrong and both records are now
corrected.** The two observations behind it hold — a relative branch exists only as a block
terminator, and value lowerings return a flat instruction list — but they describe value lowerings,
not the loop that drives them.

The function lowering loop already splits the block it is filling in order to give a single
operation its own branches: it flushes the pending instructions into a block ending in a
fallthrough, pushes its own branch-terminated blocks, and resumes on a fresh label. A platform
frame wait takes exactly that path today. So no new contract and no new pass are needed, and the
downstream handling is established by working code rather than by argument — binding, layout and
branch-range resolution already digest blocks produced that way.

## What has to be proved

The emitted form is not flag-equivalent to the chain it replaces, so this cannot reuse either
predecessor's flag argument. It needs its own, and the obligation is larger than the earlier
records implied.

| Obligation | Why it bites |
| --- | --- |
| `C` dead after the site | The chain leaves carry-out of the high addition; `INC` does not affect carry at all |
| `V` dead after the site | Same reasoning; `INC` does not affect overflow |
| `A` dead after the site | The chain leaves the high result in the accumulator; the `INC` form never loads it. Single use of the arithmetic result is necessary but not sufficient, because the accumulator is not the result — it is a side effect the chain happens to leave behind |
| **`N` and `Z` dead after the site** | The subtle one, and absent from the earlier records. The chain always leaves `N`/`Z` from the high byte. The `INC` form leaves them **path-dependent at the join**: the no-carry path arrives through the taken branch with `N`/`Z` from the *low* byte, the carry path arrives after `inc hi` with them from the *high* byte. A consumer reading either flag would see a value that depends on the data |
| The home is ordinary non-volatile RAM | `INC` is a read-modify-write and performs two bus accesses, so it is never a silent substitute for a device write |
| The update is in place against one whole word home | Already proved by the existing destination forwarding and declared-home machinery; this unit must ride that rather than build a parallel recognizer |

A loop counter is the easy case and the common one: the exit test re-establishes its own flags with
a comparison, so nothing of ours is live into it. A straight-line site needs the liveness argument
made on its own terms, not inherited from the loop case.

## Scope

**Increment by one only.** Decrement is deliberately a separate case *inside* this unit rather than
an assumed mirror, because its canonical form loads the low byte to test it
(`lda lo · bne skip · dec hi · skip: dec lo`) and therefore leaves the **old** low byte in the
accumulator. The two directions do not share one accumulator-liveness argument, and the decrement
form is eleven bytes rather than eight.

`x = x ± N` for `N > 1` is a named follow-on, not folded in: it keeps the low-byte addition and
replaces only the high half with `bcc skip · inc hi`, worth about three bytes, and it uses this same
seam. Delivering it alongside would mix two different savings and two different proofs into one
reviewable change.

## Blast radius, surveyed before writing

Unlike the two predecessors, this unit **will** move frozen pins. That is established now rather
than discovered at the gate.

| Subject | Exposure |
| --- | --- |
| A qualification fixture's render routine advances a local word counter to a thousand | **Its cost witness moves**, for the third time. Every behavioural value in that expectation must be shown unchanged, and the re-baseline must be its own commit with the reason stated |
| The predecessors' control fixtures pin exact payloads either side of the counter-release threshold | **Both move.** They are implementation tests and may be updated, but the twelve-byte difference between them is load-bearing and must be re-derived, not merely re-pinned |
| One example increments a word, but as a module-level global | **To resolve before implementing.** Globals sit outside the in-place shape the predecessors admit, so this is expected to be out of scope — but it decides whether that example's frozen byte and cost pins move, which changes this unit from "one re-baseline" to several |
| The other examples' unit steps are all byte-typed or inside compile-time functions | **No exposure** — a byte step is already a single `INC`, and a compile-time function emits nothing |

## Gates to clear before implementing

| Gate | Why it must be answered first |
| --- | --- |
| Is a module-global word step in the admitted in-place shape? | Decides whether an example's frozen pins move |
| Does any *behavioural* or *shape* oracle, as opposed to a cost witness, assert the chain's flags or its instruction sequence? | A cost witness moving is a re-baseline; a behavioural or shape oracle reddening is a stop |
| Can the carry path be reached in a test, and does the counter still terminate? | A sixteen-bit increment whose carry is wrong still terminates small loops, so the test must cross a page boundary to be discriminating |
| Does the split block upset interrupt-boundary analysis, which records instruction sites per operation? | The frame wait precedent suggests not, but it is a platform operation rather than an arithmetic one |

## Tasks

- [x] **T-41.1 Gates.** Answer the four questions above with evidence before any code.
- [x] **T-41.2 Baselines.** Digest every example in all four modes, plus a unit-step probe and a
      page-crossing probe. Emitted bytes only.
- [x] **T-41.3 Controls at RED.** A control pinning the expert form for a local word step, a
      control proving a site with live flags keeps the chain, and a page-crossing behavioural case.
- [x] **T-41.4 Implement.** Flag and accumulator liveness first; then selection at the lowering
      loop's existing split seam. Increment only; decrement as its own case behind the same proof.
- [x] **T-41.5 Measure and re-baseline.** Re-digest. Re-derive the two control payloads rather than
      copying them. Re-baseline the cost witness in its own commit, with every behavioural value in
      that expectation shown unchanged.
- [x] **T-41.6 Verify and review.** Frozen behavioural and shape oracles green and untouched, both
      corpora, emulator tier isolated including the page-crossing case, then both review lenses.

## Gates answered

| Gate | Answer |
| --- | --- |
| Is a module-global word step in the admitted in-place shape? | **No.** Measured in one program holding both: a global step still copies through a scratch pair, while a local step is already written in place. So the one example with a word step is out of scope, and **no example moves a byte** — confirmed by digesting all seven in all four modes |
| Does any behavioural or shape oracle assert the chain's flags or instruction sequence? | **No.** The frozen shape and behaviour oracles pass untouched, so the only movement is in cost witnesses |
| Can the carry path be reached in a test, and does the counter still terminate? | **Yes**, and it is now proved on the emulator rather than argued: a counter run to three hundred crosses the low-byte wrap exactly once and publishes `$012C` in all four modes |
| Does the split block upset the per-operation evidence? | **It did, and the cause was found rather than worked around.** Debug range attribution matches machine blocks to their semantic owner through an explicit allowlist of split-block label prefixes, and a new family has to be registered there. It now is |

## Measured outcome

| Subject | Before | After | Verdict |
| --- | ---: | ---: | --- |
| Released-counter control | 416 | **407** | −9 bytes |
| Qualification render routine | 371 | **365** | −6 bytes |
| Protected-counter control | 428 | **428** | unmoved, and correctly so |
| All seven examples, all four modes | — | **byte-identical** | no example is in the admitted shape |

The emitted form is the casebook's increment selection, with the skip branch carrying the loop's
back edge directly where it can:

```
inc <low> · bne <exit test> · inc <high> · jmp <exit test>
```

The nine-versus-six difference is **relative branch range**, and the first explanation written here
was wrong. It was not that one layout lets the carry arm fall through — in both counted-loop cases
the carry arm emits its own jump back. What differs is whether the skip branch can reach the loop
test in one signed byte of displacement. Where it can, the two-byte branch *replaces* the three-byte
jump the update block used to end with, so the saving is nine. Where it cannot, the ordinary
long-branch repair inverts the condition and adds an absolute jump, so the branch is paid *on top
of* a jump that has to stay, and the saving is six. The qualification site's back edge is a hundred
and eighty-two bytes away, well outside range, which is exactly why it measures six.

The clean eight-byte form, with the carry arm genuinely falling through, does occur — in a
straight-line step and in a called function whose step closes the body — but not in either counted
loop measured here.

The protected counter staying at 428 is worth stating as a result rather than an absence. A counter
narrowing still claims keeps its scratch copy, so it is never an in-place step, so this selection
cannot reach it — which is the same one-way implication the release threshold rests on, observed
from the other side.

## Reviews

| Lens | Result |
| --- | --- |
| Correctness and maintainability | 0 critical, **1 major**, 5 minor |
| 6502 machine code | 0 critical, **0 major**, 3 minor |

### The major: the proof was right, the stated reason was not

The comment claimed the successor block establishes its own sign and zero flags. Nothing requires
that, nothing checks it, and the safety never depended on it. The real discharge is narrower and
provable, and is now what the comment says: flag and register reuse is selected between operations
of a *single* block, so a cross-block reader of this result's flags cannot be constructed at all;
the form clobbers strictly less than the chain, preserving the accumulator, the carry and the
overflow; and both arms define sign and zero, so the whole-function flag proof still finds a definer
for every later use. The positional requirement keeps its place against a different reader — the
in-block peepholes that inspect the instructions pending in the block being filled.

The machine-code lens then checked the three cross-block machine passes that the correctness lens
had not, and all three are safe: the whole-program flag proof proves a producer exists and never
value agreement, which is exactly what is claimed; the boolean-exit abstract interpretation treats
the increment as a memory update that clears its own byte fact and both flag-from-accumulator facts,
so no path pruning can be derived from the generated branch; and the dead-store cleanup lists the
increment as reading storage and not writing it, so no store feeding it can ever be removed.

### Two of my own explanations were wrong, and are corrected above

The nine-versus-six difference is relative branch range, not whether the carry arm falls through.
Both counted-loop layouts emit a jump in the carry arm. Recorded in the measured outcome.

### Minors applied

| Finding | Disposition |
| --- | --- |
| The zero-page cycle figure omitted the branch — five or ten should have been eight or twelve | **Fixed.** A shipped cost claim is exactly the kind of thing a later selection decision would trust |
| No sentence recorded what happens now that the form preserves the carry instead of defining it | **Fixed** — if a later block's only carry producer were this arithmetic, the flag proof refuses the program rather than accepting it, which is the safe direction and worth stating once |
| The second positional conjunct had no control, and its reachability was an open question | **Fixed** — the shape is reachable, so it has a real control: a step on a parameter closing a function body leaves by a return and keeps the chain |
| A redundant instruction-site record duplicated what the surrounding loop already does | **Removed** |
| The two width constants were duplicated with their doc comments in a second file | **Shared** from the module that owns the shape |
| A doc block floated above a constant instead of documenting the module | **Fixed before review**, and named as a habit: fourth occurrence in this family |

### Confirmed independently by the machine-code lens

- Carry propagation exact in both directions with no first-iteration special case, verified by
  executing the real emitted bytes: a counter seeded at 255 wraps on iteration one and reaches the
  expected value, as do the counter, parameter and interrupt-handler forms.
- **The increment form's joined zero flag is better than the chain's**, which is worth recording:
  on the taken path the low byte is non-zero so the word is non-zero, and on the other path the low
  byte is zero and the flag reflects the high byte — so it is a correct whole-word zero test, which
  the chain's zero flag never was. Sign is the only genuinely unusable flag.
- The read-modify-write can never reach device memory, by construction rather than by luck: only a
  declared local or parameter home resolves, module globals are subtracted earlier, and the profile
  windows exclude the input/output page and the processor port entirely.
- Byte and cycle costs recomputed from the opcode tables and agreeing, except the zero-page cycle
  figure which was wrong and is fixed.

## Residual debt, named rather than folded in

| Item | Why it is separate |
| --- | --- |
| Under long-branch repair the back edge is emitted twice — once in the inverted branch's added jump and once in the carry arm — where one shared jump at a continuation placed after the carry arm would do. Eleven bytes instead of fourteen, at the cost of one cycle on the hot path | The mechanism is block ordering and long-branch repair, which every splitting selection shares, so the repair belongs there rather than in this file. Where layout honours the declared fallthrough the carry arm already costs nothing |
| **Decrement**, and the stated reason for excluding it was overstated | The exclusion said the canonical form loads the old low byte into the accumulator and so needs a different liveness argument. The chain it replaces also clobbers the accumulator, with its high result byte, so the discharge is the same block-closure argument with no new machinery. The honest reason to hold it back is staging, not difficulty — and it is the more valuable half for game code, where countdown loops are the idiom. The form is `lda lo · bne skip · dec hi · skip: dec lo`, eleven bytes against seventeen, and its flag story is *simpler* than the increment's because both arms end on `dec lo`, so sign and zero always describe the new low byte with no path dependence at all |
| `x = x ± N` for `N > 1` | Genuinely a different proof: it keeps the low-byte addition, so it clobbers the accumulator and the carry, and its branch consumes the carry that addition just produced rather than the zero flag. Fourteen bytes against seventeen |

## Stop conditions

Any of these halts the unit rather than being worked around: a behavioural or shape oracle reddens,
a counter stops terminating, the carry path is shown wrong at any boundary, an example grows, or
the flag obligation cannot be discharged for a site the selection admits.
