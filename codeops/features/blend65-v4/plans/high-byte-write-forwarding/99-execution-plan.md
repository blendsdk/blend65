# High-byte write forwarding — the absent arm

> **Owner**: T-40 · **CodeOps Artifact Schema**: 1
> **Status**: Complete — two review lenses, 0 critical, both majors repaired, 8 minors applied
> **Progress**: 5/5 tasks (100%)
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

The low-byte slice fenced its own scope rather than finding the high byte unsafe. Its execution plan
lists `hi` among shapes with *"No new selection"*, in a row of type-shape markers — a wrong result
or root type, a field or index path, a missing preceding load — while the safety rejections
(*"dynamic/wide/nonvolatile write"*) sit in a separate row of their own. Its verification document
then states that nothing in it *"removes the separate high-byte branch/flag ownership proof"*, and
its plan says the same in other words: *"High-byte branches need separate flag/terminal-use proof"*.
A follow-on unit was named at the time; this is it.

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
| Could an example or a qualification-corpus program shrink, moving a frozen size or cost pin? | **No** — no `poke(…, hi(…))` exists in any example or in the qualification corpus. The only high-byte extractions there are four branch comparisons, which this unit does not admit |
| Does any frozen oracle pass the opt-in argument *and* assert `hi` is rejected? | **No** — the `hi` rejection appears once, in a four-argument call. The oracles that do pass an opt-in use byte-typed fixtures with no high-byte extraction at all |
| Do frozen oracles that build whole programs exercise the admitted shape without passing anything, simply because they run the production path? | **Yes, and that is the wider exposure.** Several build- and emulator-tier oracles contain fixed writes of an extracted high byte, including one that asserts the delivered value on the emulator. A selector survey cannot see these, so they are covered by full verification rather than by the gate above, and both corpora must report before this unit is pushed |
| Does the emitter already place the correct byte in the accumulator? | **Yes** — the emitted form already loads `value+1`; only the store-and-reload around it is redundant, so the mechanism is operator-agnostic and this is a selection change alone |

## Predicted red

An existing implementation control pins **one** surviving memory-to-memory move and comments that
the survivor *"stages the high byte for the hardware write, which is a separate concern"*. Its
fixture is `poke($D010, hi(x))`. That survivor is precisely this unit's target, so the pin must move
from one to zero. A prediction stated before the change and then observed is the evidence this
slice is doing what it claims.

## Tasks

- [x] **T-40.1 Baselines.** Digest every example in all four modes, plus the low/high probe pair.
      Emitted bytes only; exclude `.build.json` and `current.json`.
- [x] **T-40.2 Controls at RED.** Add a control asserting the high-byte extraction reaches its fixed
      write with no intervening home, in the loop shape the low-byte arm is known to fire on.
      Reproduce RED before implementing.
- [x] **T-40.3 Implement.** Admit the high-byte operator through a new opt-in parameter, defaulted
      off, enabled on the production path. Nothing else about the admitted shape changes.
- [x] **T-40.4 Measure.** Re-digest. The probe must shrink by six bytes; no example may move at all,
      since none is in the admitted shape.
- [x] **T-40.5 Verify and review.** The frozen low-byte oracles untouched and green, including the
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

The cost is mode-independent for a reason worth writing down rather than leaving to coincidence:
an anonymous value home is requested in ordinary RAM rather than as a zero-page candidate, so both
removed instructions are absolute in every mode. Were anonymous homes ever made zero-page
preferred, the same removal would be four bytes and six cycles instead of six and eight.

Two honest limits on the headline figure. No example moved, because none is in the admitted shape —
that is not a corpus gain. And the saving is per site in a narrow class: the shared publication
proof admits only a single reachable function with no parameter or global places, so this arm fires
in single-function, local-only programs and the figure must not be read as program-wide.

## Residual debt, deliberately not taken here

Matching the low-byte form is **not** a parity meet, and the outcome above should not be read as
one. The surrounding sequence is still three bytes and four cycles above what an expert would write:

```
lda value+1 · adc #$01 · sta value+1 · lda value+1 · sta $d005   emitted
lda value+1 · adc #$01 · sta value+1 ·               sta $d005   expert
```

The reload is removable and the removal is both value- and flag-identical, since the byte loaded is
exactly the accumulator the addition left and the intervening store writes memory without touching
a flag. It is a separate unit because its premise set is different, not because it is small: this
unit's contract is that an *anonymous* home is never created, whereas the residual concerns a
**named** store that must remain and whose stored value is then reused. That needs store-to-load
address identity, no intervening write or accumulator clobber, a non-volatile home, and — the real
obligation — proof that no reachable interrupt handler writes that home between the store and the
load. It would also move every word-assignment site, including the examples, so it carries frozen
pin exposure this unit does not.

One asymmetry must be carried into that unit so it is not scoped on a false symmetry: the residual
exists for the **high** half only, because a word addition stores its high byte last and so leaves
it in the accumulator. At the same site the low half's reload is genuinely necessary, since the
accumulator by then holds the high byte. The two halves are reached the same way; they do not have
the same remaining headroom. The same reload is also removable a second time when two fixed writes
share one extracted half.

## The predicted red, observed

The control pinned at one surviving move flipped to zero exactly as the plan predicted before any
code was written (`expected +0 to be 1`). Its pin and its now-stale comment are both updated.

## Verification

| Check | Result |
| --- | --- |
| New impl controls: staging home gone, both payloads pinned in all four modes, and the write proved fed from the word's high half rather than its low one | **6/6** |
| New barrier controls: every shape the low half rejects is still rejected with the high half admitted, plus admitted-with and rejected-without | **15/15** |
| The predecessor's controls, including the flipped pin | **8/8** |
| Frozen oracles in the compiler package, including the one asserting `hi` is rejected in the base form | **143/143** |
| Frozen root-tier oracles, including the four high-byte branch captures and boing's exact byte and cost pins | **58/58** |
| Every frozen oracle and the whole specification tree | **untouched** |
| New emulator test: the forwarded write delivers the word's own advancing high byte | **4/4**, all modes |

The emulator test is a genuine proof rather than an invariance net. The word advances in both halves
every iteration, so a forwarding that delivered the low byte, a stale byte, or the byte before the
advance would each produce a different register value. Observing `$13` then `$14` excludes all three.

## Reviews

Two independent lenses. **0 critical, 0 major on the emitted code.**

| Lens | Result |
| --- | --- |
| Correctness and maintainability | 0 critical, **2 major**, 4 minor |
| 6502 machine code | 0 critical, 0 major, 4 minor |

### The majors, both repaired

**Shipped behaviour was pinned only by mutable tests.** The seam this unit uses was introduced once
before, and that time it arrived with frozen oracles that declare and pass the flag. This unit
shipped implementation tests alone, which left every barrier for this window proved only with the
admission turned **off** — so a later edit to the operator condition could widen the shape in the
configuration that actually ships while every existing test stayed green. All fourteen barrier
shapes are now re-proved with the admission on, beside the admitted-with and rejected-without
cases. They are implementation tests and say so in the file: they were written after the selection
they cover, so calling them an oracle would claim an immutability they cannot have.

**The containment gate asked the wrong question.** It surveyed which oracles pass the opt-in
argument, but oracles that build whole programs exercise the production path without passing
anything, and several contain fixed writes of an extracted high byte. The gate wording is corrected
above, and the exposure is answered by evidence rather than by argument: the emulator oracle that
asserts delivered values across roughly seventeen such writes passes untouched.

### The sharpest minor, and why it mattered

The host-tier control **could not tell the two halves apart.** Both cases asserted the same thing —
no staging home, payload 374 — which is exactly as true of a forwarding that delivered the *wrong*
half, since the two forms differ by one operand and nothing else. The only discriminating evidence
was the emulator test, which the host gate does not run. A host-tier assertion now pins the write's
source to one byte above the low form's, so the wrong half fails without an emulator.

### Minors applied

| Finding | Disposition |
| --- | --- |
| The comment claimed the byte always comes from the word's own home — false for a word already narrowed to one live byte, where the high half is a synthesized zero | **Fixed.** The third overclaim of this class in this family of files, so worth naming as a pattern rather than a line |
| Two adjacent positional booleans at the production call site let a transposition read as correct | **Fixed** by naming both at the call site. Deliberately *not* converted to an options object: changing the fifth parameter's type would break the typed-alias assignability that three frozen oracles depend on |
| A `@param` line said "the same named-word read" with no referent when read alone | **Fixed** |
| The payload pin covered one optimization mode while the claim covered four | **Fixed** — all four modes pinned, and all four hold at 374 |
| A quotation was attributed to the predecessor's execution plan | **Not a defect.** The wording is verbatim from the predecessor's verification document; the reviewer read only the plan. Both sources are now cited precisely rather than the quote being dropped |

### Confirmed independently by the machine-code lens

- **−6 bytes in all four modes**, measured on its own before-and-after builds, with `residentRam`
  falling 432 → 425 — six code bytes plus **exactly one** data byte, which independently confirms
  the one-byte home. The cycle delta is exactly **−8**, not a range, since neither absolute
  instruction carries a page-cross term.
- The flag contract is **identical, not merely compatible**, across all nine of `A`, `X`, `Y`, `S`,
  `C`, `N`, `Z`, `V` and `D` — argued from the instructions rather than by analogy to the low half:
  the removed pair's only flag writer reloads the byte just stored, so its `N`/`Z` are bit-identical
  to those the surviving load already set. Nothing downstream could observe a difference either,
  because the loop's terminator is unconditional and the next iteration overwrites `N`/`Z` and
  re-seeds the carry before its first addition.
- `home+1` can **never** escape the word's allocation, on several independent grounds — the
  decisive one being that this change does not alter the address loaded at all.
- Removing the staging pair makes the sequence **strictly more robust**: the store-then-reload was a
  two-instruction window in which an interrupt writing that home would have changed the byte
  delivered.

## Stop conditions

Any of these halts the unit rather than being worked around: a frozen oracle reddens, any example
moves a byte, the four high-byte branch captures change in number, or the forwarded write is
observed carrying the wrong byte.
