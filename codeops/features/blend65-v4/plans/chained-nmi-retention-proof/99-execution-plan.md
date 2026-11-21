# Chained NMI retention — the proof

> **Owner**: T-153 · **Type**: Task (lightweight, investigation) · **CodeOps Artifact Schema**: 1
> **Status**: Complete — proof delivered; admission itself needs a decision only the user can make
> **Progress**: 4/4 tasks (100%)
> **Last Updated**: 2026-11-21
> **Related**: [nmi-stock-entry-contract](../nmi-stock-entry-contract/99-execution-plan.md),
> [rd-05-nmi-cia2](../rd-05-nmi-cia2/99-execution-plan.md)

## What this unit was asked for

The tracker recorded chained NMI retention as blocked, and named the missing piece as *"the stock
NMINV frame and RTS return proof"*. That proof is the deliverable here. Whether retention is then
admitted is a separate question, and this document ends by showing it is not ours to answer.

Every measurement below that required opening the admission gate is labelled as such. The gate was
opened in the working tree, measured, and reverted; the source is unchanged and each revert was
confirmed by an empty diff.

## The recorded blocker does not reproduce

The tracker said that enabling the existing straight-line stack-retention proof for the chained
installer *"yields no retained stack bindings for the chained handler and the public build fails at
machine storage binding"*.

That is wrong at shallow depth. With the gate opened for the chained installer, a handler retaining
two volatile byte samples **builds**, and the emitted frame is correct:

```
php · pha · txa · pha · cld        ; entry: status, A, X
lda $d012 · pha                     ; retained sample 1
lda $d011 · pha                     ; retained sample 2
tsx · lda $0102,x → $d020           ; slot read, deepest sample
pla         → $d021                 ; consumed in order
tsx · lda $0101,x → $d022
pla
pla · tax · pla · plp               ; entry state restored
jmp ($0bb8)                         ; handover to the retained predecessor
```

Five pushes, five pops, balanced. The indexed slot reads address the live frame correctly, and at
the handover the stack holds exactly the hardware frame the stock predecessor expects. **This is the
frame-and-return proof the tracker asked for, and it passes at this depth.**

## Where the chained route actually stops, and why

Swept with the gate open, one volatile byte sample at a time:

| Retained samples | Outcome with the gate open | Frame |
| ---: | --- | --- |
| 1 | builds, 879 bytes | balanced, 8 pushes / 8 pops |
| 2 | builds, 895 bytes | balanced, 10 / 10 |
| 3 | builds, 906 bytes | balanced, 11 / 11 |
| 4 | builds, 917 bytes | balanced, 12 / 12 |
| 5 | builds, 928 bytes | balanced, 13 / 13 |
| 6 | builds, 939 bytes | balanced, 14 / 14 |
| 7 | **compiler limitation at `plp`** | not emitted |
| 8 | **compiler limitation at `plp`** | not emitted |
| 9 | **compiler limitation at `plp`** | not emitted |

So the tracker's note was right about a failure and wrong about its cause and its reach: the
chained entry shell genuinely cannot be emitted from **seven** retained bytes upward, failing in
its own epilogue at the `plp` that must precede the handover. Below that it emits correctly.

For contrast, the exclusive route has **no depth envelope at all** — it builds at eight, nine, ten,
eleven and twelve retained samples (956, 966, 976, 986 and 996 bytes). This matters, because it
kills the obvious hypothesis: that a bound could be *derived* from the one-byte difference between
the two variants' declared entry stack costs, seven for the chain against six for the exclusive
entry. If the exclusive entry admitted nine but not twelve, a budget argument might have produced a
chained figure. It admits twelve. There is no envelope to scale.

## Why a single retained local is rejected today

With the gate as shipped, the chained route rejects a handler holding **one** ordinary local:

| Handler body | Chained | Exclusive |
| --- | --- | --- |
| empty | builds | builds |
| `const V: byte = 7; poke($0411, V);` | builds | — |
| `poke($0411, peek($0400));` — no named local | builds | — |
| `let a: byte = peek($0400); poke($0411, a);` | **rejected** | builds |
| two locals with crossed lifetimes | **rejected** | builds |

The rejection is not about depth and not about the frame. It is one condition: stack retention is
offered only to the exclusive installer, and the register-only elision that could otherwise absorb
such a local is narrow by design — it admits a constant initializer, or a volatile byte read of a
*forwardable* capability, and an ordinary memory read of an arbitrary address is neither. So the
local keeps a private home, and a surviving private home on an NMI path is what the reentrancy
check rejects.

Two further facts place the asymmetry precisely:

- **Route admission already treats the two installers identically.** The admission predicate names
  both the chained and the exclusive sink together, with the comment that *"both cooperative
  entries receive the same final private-storage and reentrancy proof"*. Nothing there separates
  them.
- **Exactly one place separates them**: the storage inventory offers hardware-stack retention only
  when the handler's route is the exclusive installer, with the comment that the stock chained route
  *"keeps its separate frame contract and does not reuse this proof"*.

## What the normative record says

The specification permits an externally unbounded NMI route to remain expressible *"when its
complete transitive generated path is proved reentrant without invocation-private RAM/zero-page
homes"*, and adds that *"a local may remain in registers, and a helper may qualify without private
homes"*. It does not name hardware-stack retention as an admitted substitute either way. That
silence has already been resolved in practice, and resolved differently for the two installers:

| Requirement | Pinned by |
| --- | --- |
| Exclusive route, nine retained samples → **admitted**, hardware stack exactly 14 bytes | A frozen oracle |
| Exclusive callback, five retained samples → **admitted**, hardware stack exactly 10 bytes | A frozen oracle |
| Chained route, nine retained samples → **rejected**, with no output directory | A frozen oracle |
| Five retained samples behind an ordinary helper → **rejected** | A frozen oracle |

And the chained rejection is not an incidental fixture. It is requirement-derived and was decided
deliberately:

- The requirements' own testing strategy carries it as a numbered case: a **balanced** chained
  handler retaining **five** byte reads across later stores must produce one canonical reentrancy
  rejection and **no generation**, traced to the cooperative-exception chapter and to an entry in
  the ambiguity register.
- That register entry resolves the question explicitly, and records the user's approval on
  2026-10-03: convert the balanced *empty* chained fixture to success, and *"retarget the old
  canonical E10245 diagnostic to a balanced, genuinely storage-bearing handler"*.

The phrase that settles this unit is **balanced**. The resolution was taken in full knowledge that
such a handler's frame balances — which is exactly what the sweep above re-measures — and still
required rejection. The frame proof was never what stood in the way.

## The conclusion, stated plainly

Admitting chained retention is **not deliverable under the current requirements**, and the two
routes to it are both closed to me:

| Route | Why it is closed |
| --- | --- |
| Admit at the depth the oracle names | The frozen oracle requires rejection at nine samples. A frozen oracle is an immutable contract: a failing specification test means the implementation is wrong, never the test. Separately, the implementation cannot emit that depth at all |
| Admit up to a cap of six, keeping nine rejected | This would leave every shipped oracle green, and that is precisely why it must not be done. The requirement-level case is **five**, inside the admitted window, and the approved resolution retargeted the rejection onto a balanced storage-bearing handler. Passing the suite by choosing a cap that steps around the one fixture that happens to be shipped is fixture-dodging, not engineering. There is also nothing to derive such a cap *from*: six is where this implementation's epilogue happens to break, which is an implementation limit, not a contract |

A bound that cannot be derived from a documented constant, and that exists only to stay clear of a
test, is not a proof. Recording that is the honest outcome of this unit.

## Candidate follow-on, named and not taken

One partial win exists with no oracle conflict. The register-only elision could be widened to
absorb a local whose whole life is an adjacent read-then-store pair of an ordinary address, as it
already does for a forwardable volatile read. Such a local needs no bytes at all, so no private home
survives and the chained route would accept it — and the specification explicitly contemplates this
case, since it says a local may remain in registers.

It is not taken here because it needs its own proof: that the accumulator genuinely carries the
value across the gap, that no intervening effect clobbers it, and that the read's ordering and count
against shared state are preserved. That is a separate unit with a separate review, not a rider on
an investigation.

## Tasks

- [x] **T-153.1 Reproduce the recorded blocker.** Build the same handler under both installers and
      capture the exact diagnostic.
- [x] **T-153.2 Prove the frame and the return.** Open the gate in the working tree, inspect the
      emitted chained entry shell, and establish that the pushes balance and the handover leaves the
      predecessor's expected frame. Revert and confirm an empty diff.
- [x] **T-153.3 Find the real envelope.** Sweep retained depth on both installers and separate what
      is normatively rejected from what cannot be emitted.
- [x] **T-153.4 Settle the normative basis.** Trace the rejection to its requirement case and its
      approved ambiguity resolution, and record whether admission is an implementation decision or a
      governance one.

## Decision required

This unit stops here deliberately, with the proof complete. Admission needs one of:

1. **Authorize a requirements revision** — amend the chained route's separate-frame contract,
   re-baseline the admission oracle, and reverse the approved resolution that retargeted the
   rejection onto a balanced storage-bearing handler. Also needs the epilogue limitation at seven
   retained bytes fixed, since the oracle's own depth cannot currently be emitted.
2. **Close as errata** — record chained retention as not deliverable under the current
   requirements, as was done for the consumer-aware block-index diagnostic.
3. **Authorize the register-only widening** as the partial win, which conflicts with nothing.

## Stop conditions observed

No frozen oracle was edited. No specification file was touched. The admission gate was opened only
in the working tree, twice, and reverted both times with the revert confirmed by an empty diff. No
measurement taken with the gate open is presented as shipped behaviour.
