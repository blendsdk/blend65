# High-byte write forwarding — the absent arm

> **Owner**: T-40 · **CodeOps Artifact Schema**: 1
> **Status**: Executing — implemented and measured, reviews running
> **Progress**: 4/5 tasks (80%)
> **Last Updated**: 2026-11-21
> **Predecessor**: [boing-ball-low-byte-write-forwarding](../boing-ball-low-byte-write-forwarding/99-execution-plan.md)

## Why

Extracting the low byte of a named word and writing it straight to a fixed hardware address keeps
the value in the accumulator: `poke($D005, lo(value))` emits `lda value · sta $d005`. Extracting the
**high** byte of the same word does not. It stores the accumulator into an anonymous one-byte home
and loads it straight back before the write.

Measured on the admitted shape the low-byte arm fires on, differing only in the operator:

| Source | Emitted | Payload |
| --- | --- | ---: |
| `poke($D005, lo(value))` | `lda value · sta $d005` | 374 |
| `poke($D005, hi(value))` | `lda value+1 · sta tmp · lda tmp · sta $d005` | **380** |

**Six bytes and eight cycles per site**, plus one byte of resident RAM for a home that exists only
to hold a value already sitting in the accumulator. Both removed instructions are absolute.

## Why the high byte was left out, and why that is not a prohibition

The low-byte slice fenced its own scope rather than finding the high byte unsafe. Its plan lists
`hi` among shapes with *"No new selection"* — beside type-shape markers such as a word result or a
signed root, not beside the safety rejections — and states plainly that nothing in it *"removes the
separate high-byte branch/flag ownership proof"*. A follow-on unit was named at the time; this is it.

A frozen oracle does assert that the selection rejects `hi`. It asserts that of the **four-argument
base configuration**, and that stays exactly true: the operator is admitted only through an explicit
opt-in parameter the oracle never passes, which is the same seam the named-arithmetic arm already
uses and which production already turns on. No frozen oracle is edited, and none is expected to
change behaviour.

## Scope

**This unit covers the memory-write consumer only** — an extracted high byte whose sole use is the
immediately following volatile fixed-address byte write.

The **branch** consumer is explicitly out of scope. In the one example that extracts a high byte,
every use feeds a comparison (`if (hi(x) != 0)`), and a frozen oracle pins those four captures as
still present. That case is the *"high-byte branch/flag ownership proof"* the predecessor named: it
needs a flag-ownership argument this unit does not make, and it sits behind a frozen pin. Reviewers
should read the untouched captures as deliberate, not as a miss.

## Gates cleared before planning

| Gate | Result |
| --- | --- |
| Could an example or qualification fixture shrink, moving a frozen size or cost pin? | **No** — no `poke(…, hi(…))` exists anywhere in the examples or the qualification fixtures. The only high-byte extractions are four branch comparisons, which this unit does not admit |
| Does any frozen oracle pass the opt-in argument *and* assert `hi` is rejected? | **No** — the `hi` rejection appears once, in a four-argument call. The oracles that do pass an opt-in use byte-typed fixtures with no high-byte extraction at all |
| Does the emitter already place the correct byte in the accumulator? | **Yes** — the emitted form already loads `value+1`; only the store-and-reload around it is redundant, so the mechanism is operator-agnostic and this is a selection change alone |

## Predicted red

An existing implementation control pins **one** surviving memory-to-memory move and comments that
the survivor *"stages the high byte for the hardware write, which is a separate concern"*. Its
fixture is `poke($D010, hi(x))`. That survivor is precisely this unit's target, so the pin must move
from one to zero. A prediction stated before the change and then observed is the evidence this
slice is doing what it claims.

## Tasks

- [ ] **T-40.1 Baselines.** Digest every example in all four modes, plus the low/high probe pair.
      Emitted bytes only; exclude `.build.json` and `current.json`.
- [ ] **T-40.2 Controls at RED.** Add a control asserting the high-byte extraction reaches its fixed
      write with no intervening home, in the loop shape the low-byte arm is known to fire on.
      Reproduce RED before implementing.
- [ ] **T-40.3 Implement.** Admit the high-byte operator through a new opt-in parameter, defaulted
      off, enabled on the production path. Nothing else about the admitted shape changes.
- [ ] **T-40.4 Measure.** Re-digest. The probe must shrink by six bytes; no example may move at all,
      since none is in the admitted shape.
- [ ] **T-40.5 Verify and review.** The frozen low-byte oracles untouched and green, including the
      one pinning four high-byte branch captures; both test corpora; emulator tier isolated with a
      behavioural proof that a forwarded high byte reaches the hardware address intact; then the
      correctness and machine-code review lenses.

## Measured outcome

| Subject | Before | After | Verdict |
| --- | ---: | ---: | --- |
| `poke($D005, hi(value))` probe | 380 | **374** | −6 bytes, −8 cycles, −1 byte of RAM |
| `poke($D005, lo(value))` probe, the form it is modelled on | 374 | **374** | untouched |
| All seven examples, all four modes | — | **byte-identical** | nothing moved, nothing grew |

The forwarded high-byte form is now instruction-for-instruction the low-byte form with the other
half of the same word loaded — `lda value+1 · sta $d005` — which is why the two payloads agree
exactly. That equality was predicted in advance and is pinned in the control, so it is a falsifiable
claim rather than an observation after the fact.

No example moved, because none is in the admitted shape. That is stated plainly rather than
presented as a corpus gain.

## The predicted red, observed

The control pinned at one surviving move flipped to zero exactly as the plan predicted before any
code was written (`expected +0 to be 1`). Its pin and its now-stale comment are both updated.

## Verification

| Check | Result |
| --- | --- |
| New impl controls: staging home gone, both payloads pinned | **2/2** |
| The predecessor's controls, including the flipped pin | **8/8** |
| Frozen oracles in the compiler package, including the one asserting `hi` is rejected in the base form | **143/143** |
| Frozen root-tier oracles, including the four high-byte branch captures and boing's exact byte and cost pins | **58/58** |
| Every frozen oracle and the whole specification tree | **untouched** |
| New emulator test: the forwarded write delivers the word's own advancing high byte | **4/4**, all modes |

The emulator test is a genuine proof rather than an invariance net. The word advances in both halves
every iteration, so a forwarding that delivered the low byte, a stale byte, or the byte before the
advance would each produce a different register value. Observing `$13` then `$14` excludes all three.

## Stop conditions

Any of these halts the unit rather than being worked around: a frozen oracle reddens, any example
moves a byte, the four high-byte branch captures change in number, or the forwarded write is
observed carrying the wrong byte.
