# Word constant step — the high half under a carry test

> **Owner**: T-43 · **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Status**: Complete
> **Progress**: 5/5 tasks (100%)
> **Last Updated**: 2026-11-21
> **Predecessors**: [word-unit-increment](../word-unit-increment/99-execution-plan.md),
> [word-unit-decrement](../word-unit-decrement/99-execution-plan.md)

## Why

The two unit-step units cover a step of exactly one, because those are the only steps `INC` and
`DEC` can express on their own. A step by any other byte-sized constant still emitted the general
chain, which does real arithmetic on *both* halves and threads the carry between them.

The high half's arithmetic is unnecessary. Adding or subtracting a value that fits in one byte can
only ever move the high byte by one, so the second addition exists solely to turn a carry into a
plus-one. A conditional step says the same thing in less space:

```
      lda <low>          ; up                      lda <low>          ; down
      clc                                          sec
      adc #N                                       sbc #N
      sta <low>                                    sta <low>
      bcc <join>         ; no carry                bcs <join>         ; no borrow
      inc <high>                                   dec <high>
<join>:                                      <join>:
```

| Home | Chain | This form |
| --- | ---: | ---: |
| absolute | 17 bytes, 22 cycles | **14 bytes**, 14 or 20 cycles |
| zero page | 13 bytes, 18 cycles | **11 bytes**, 12 or 17 cycles |

Three bytes per site, and the saving is the same in both directions because the two forms differ
only in which three instructions they use.

## What it shares with the unit steps, and what it does not

It reuses the selection and the block-splitting seam unchanged: the same in-place requirement, the
same positional requirement that the step closes a block leaving by an unconditional edge, and the
same set of consumption checks. Only the step constant's bound widened, from exactly one to one
byte's worth.

Two differences are worth stating, because both make this form *easier* to justify than the unit
steps rather than harder:

- **It still defines the carry.** The unit forms stop defining it, which is safe but can turn a
  later carry consumer into a refusal. This form's low-byte arithmetic defines the carry exactly as
  the chain did, so that consideration does not arise at all.
- **It clobbers the accumulator exactly as the chain did**, with the low half's result rather than
  the high half's. No new register obligation.

What it shares with them is the flag shape: sign and zero are path-dependent where the arms rejoin,
discharged the same way — flag and register reuse is selected only between operations of one block,
so no cross-block reader of this result's flags can be constructed.

The branch sense is the one genuinely new thing to get right, and it is proved rather than asserted:
an addition skips the high step when it did **not** carry, and a subtraction when it did **not**
borrow. A control pins both senses together, because the opposite sense would step the high byte on
two hundred and fifty-five of every two hundred and fifty-six steps instead of one.

## Measured

| Subject | Before | After | Verdict |
| --- | ---: | ---: | --- |
| Bidirectional step-by-three fixture | 451 | **445** | −6, three per arm |
| **boing-ball**, code bytes, every mode | 1103 / 1019 | **1100 / 1016** | −3, the first example this family has moved |
| Released-counter control | 407 | **404** | −3, its body steps by three |
| Protected-counter control | 428 | **425** | −3, same body; the counter itself is still protected |
| Bidirectional step-by-one fixture | 436 | 436 | unchanged, as it must be |

**boing-ball moving is the headline.** Its ball position is a word moved either way under a
condition — `if (right) { x = x + 2; } else { x = x - 2; }` — which is exactly this form's shape and
exactly the idiom the unit was written for. The expert-parity record moves down accordingly, from a
gap of 661 bytes against the hand-written twin to 658.

The net is three bytes rather than six for two arms, and the reason is the already-documented
layout effect rather than a missed arm: in one arm the carry branch reaches the join inside a signed
byte, and in the other the ordinary long-branch repair inverts the condition and adds an absolute
jump, so that arm pays the branch on top of a jump that has to stay. Both arms were inspected and
both are correct; the inverted one is the standard repair, not a wrong sense.

## Scope

A step by a constant from one to two hundred and fifty-five. A step of exactly one keeps the
dedicated increment or decrement form, which is cheaper still. A constant that does not fit in one
byte is left entirely alone, since it can move the high byte by more than one and the conditional
step cannot express that — pinned by a control using a step of two hundred and fifty-seven.

The descending-counter limit recorded by the decrement unit is unchanged and still applies: a
`for` counter stepping down never reaches any of these selections, because in-place forwarding
excludes a loop control variable whose extent cannot be read.

## Tasks

- [x] **T-43.1 Widen the admitted constant.** One byte's worth, keeping every other premise.
- [x] **T-43.2 Emit both senses.** Carry-conditional step up, borrow-conditional step down.
- [x] **T-43.3 Controls.** The conditional form chosen in both directions; both branch senses
      pinned together; the chain kept when the step is not block-final; a word-wide step untouched.
- [x] **T-43.4 Measure and re-derive.** Before and after by toggling the build output only; the
      three moved cost pins re-derived rather than copied, and the example gain recorded.
- [x] **T-43.5 Verify.** Frozen oracles, the two unit-step units' own controls, the exact-byte
      neighbours, and an emulator proof of both crossings.

## Verification

| Check | Result |
| --- | --- |
| New constant-step controls | **4/4** |
| Emulator proof, all four modes: a position walked a hundred steps of three down and a hundred back up publishes three hundred | **4/4** |
| The two unit-step units' controls, unit 1's controls, the predecessors' controls, the parity record and the qualification expectation | **31/31** |
| Frozen shape and behaviour oracles, including boing's own | **122/122**, untouched |
| Exact-byte neighbours | **9/9** |

The emulator proof uses three rather than a power of two deliberately, so neither crossing lands on
the page boundary and both exercise a partial borrow. A high byte that never moves publishes five
hundred and fifty-six instead of three hundred, and a branch taken in the wrong sense overshoots at
once.

## Cost pins moved, and why each is sound

| Pin | Move | Why |
| --- | --- | --- |
| boing-ball expert-parity record | 1103 → **1100** | Its own comment states the contract: *"Improving the compiler should move them down; any increase is a regression"*. This is the sanctioned direction, and the twin's figure is unchanged |
| Released-counter control | 407 → **404** | Its loop body steps by three |
| Protected-counter control | 428 → **425** | Same body. The counter itself is still protected and still never an in-place step, which is why the twenty-one byte gap between the two controls is unchanged — that gap is the thing the pair exists to pin, and it was re-derived rather than re-copied |

All three are implementation pins rather than frozen oracles. No frozen oracle moved.
