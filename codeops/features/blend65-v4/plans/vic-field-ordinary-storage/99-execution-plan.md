# Let the safe VIC field form take the address of ordinary module storage

> **Owner**: T-179 (#179) · **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Status**: In progress
> **Progress**: 0/5 tasks (0%)
> **Last Updated**: 2026-11-25

## Why this unit exists

`c64.vic.vicSpriteBlock(address)` exists so the compiler computes a sprite block number instead of
the author hand-rolling `lo(&object / 64)`. It is the **safe** form: a field derived this way is
checked at its resolved address for all three hardware requirements together — inside the video
chip's bank, clear of the window where the chip reads character ROM, and aligned to the unit the
field selects.

It refused an ordinary module array, so the hazardous form was the only one available for ordinary
storage. Measured on `c64-pal-prg-kernal-6581`, with 2,400 bytes of live storage ahead of the object
so that placement cannot hide the outcome:

| Shape | Today |
| --- | --- |
| `vicSpriteBlock($2000)` — a constant | builds |
| `vicSpriteBlock(&SPRITES)` — an `embed()` asset | builds |
| `vicSpriteBlock(&buffer)` — an ordinary `byte[64]` | **refused, E10273** |
| the same through a helper, with a displacement, at a static element offset | **refused, E10273** |
| `vicCharsetSelect`, `vicScreenSelect`, `vicBitmapSelect` on ordinary storage | **refused, E10273** |

And the refusal named nothing the author could change:

```
error[E10273]: Cannot place 'VIC field' — VIC field 'vic-sprite-block' requires a constant
or symbolic address; change the field address or placement constraint
```

`&buffer` already is a symbolic address. The real constraint was narrower than the sentence: the
address had to lower to a label, and only a placed asset produced one.

## What was actually broken, measured before designing

The refusal is thrown in lowering, but the cause is spread over three stages, and fixing any one of
them alone leaves the other two refusing or, worse, placing the object where the chip cannot read it.

**The address never stayed symbolic.** `&buffer` on a module array lowered to a two-byte pointer
staged into function storage at run time:

```
{"kind":"storage","requestId":"machine:...:aggregate-address:...","bytes":2}
```

A field is one immediate byte resolved after layout, so a run-time pointer can never answer it. The
asset path works because an asset address is kept symbolic until layout; nothing did that for a
module object addressed through this capability.

**Layout demanded an asset by name.** Even with a symbolic address, the post-layout resolver refused
any interval that was not `kind: "asset"` — a module object placed by the compiler is `global` or
`bss`, and the chip cannot tell the difference between those bytes and an asset's.

**Nothing constrained where the object went.** The capability stated no demand at all, while the
hand-rolled arithmetic stated `align=64 fetch=0+64`. So accepting the capability without a demand
would have placed a 64-byte object at `$1400`, inside the character-ROM window, and then refused it
at layout for a reason the author never caused — a legal program, refused, with the compiler's own
placement to blame.

## What this unit changes

**One capability-to-field map, shared by all three stages.** `vicFieldTransformOf` moves into
`target/vic-fetch.ts` and is imported by the demand pass, by the address fold and by field lowering.
A capability named in only two of the three would place an object for a field nobody resolves, or
resolve a field against a home nothing constrained.

**The address stays symbolic, on the opposite contract from the arithmetic form.** The existing fold
that keeps `lo(&x / 64)` symbolic deliberately excludes an explicitly placed object and a zero-page
home, because that form preserves exactly what the author wrote. The capability form promises the
opposite — that the field is checked at whatever address the object ends up with — so every module
object folds, including an explicitly placed one, and layout answers for it. An address that another
use also needs keeps its run-time form.

**The demand is the capability's contract, not something to prove.** The arithmetic form has to prove
the chip receives its number, because `lo(&x / 64)` is also an ordinary expression and charging every
one of them would constrain code the hardware never reads. Naming the capability is the author asking
for a field the chip reads, so the demand is stated unconditionally, with the alignment and footprint
the field itself requires. A sprite block is followed further for displacements, because adding to one
names another 64-byte block of the same object; the other three fields select a region through
register bits, so adding to one of them names a different register value rather than different bytes.

**Layout accepts data the chip can address, not assets only.** `asset`, `immutable`, `global` and
`bss` are all data at a resolved address. Code, function-execution storage, the startup stub and
alignment fill are not, and naming one of those stays a reported mistake.

**Two refusals now name the real requirement.** An address only known while the program runs is
refused in lowering, saying so and pointing at the arithmetic form that does work. An offset inside
the addressed object that is not a multiple of the field's alignment is refused before the final
address is judged, because it is the one failure no placement can correct.

## Endings enumerated, rather than witnesses collected

The two previous units in this area both learned the same lesson the expensive way: following a route
removes the protection the fallback was giving every route beyond it, and chasing reviewer-supplied
programs one at a time loses. So every ending of argument 0 was enumerated and measured before the
first line was written.

| Ending | Before | After |
| --- | --- | --- |
| a constant address | builds | unchanged |
| an `embed()` asset, placed or automatic | builds | unchanged |
| an ordinary module array | refused | **builds, visible** |
| the same through a helper | refused | **builds, visible** |
| with a constant displacement | refused | **builds, both blocks visible** |
| with a run-time displacement | refused | **builds, every block visible** |
| at a static aligned element offset | refused | **builds, that block visible** |
| an aligned struct field | refused | **builds, that field visible** |
| the three sibling fields on ordinary storage | refused | **builds, footprint visible** |
| `place(at:)` on a usable address | refused | **builds** |
| `place(at:)` inside the character-ROM window, outside the bank, or misaligned | refused, wrong reason | **refused, naming the reason** |
| a static **unaligned** element offset | refused, wrong reason | **refused, naming the offset** |
| an index chosen at run time | refused, wrong reason | **refused, naming the real requirement** |
| an address held in a `word` | refused, wrong reason | **refused, naming the real requirement** |
| a local array, or a borrowed array parameter | refused earlier, E10260 | unchanged |
| `&object` with no VIC capability anywhere | builds, unconstrained | unchanged |

Two of those refusals are kept deliberately rather than implemented. An index chosen at run time
names a different block on every execution, so there is no single value for a capability returning
one byte to compute; the hand-rolled arithmetic covers that intent and keeps working. An address held
in a `word` is not resolvable before layout at all. Both now say so.

## Tasks

| # | Task | Status |
| --- | --- | --- |
| 1 | Split the oversize block-index implementation tests, and the shared fixture they needed | ☐ |
| 2 | Share the capability-to-field map; keep the capability's address symbolic | ☐ |
| 3 | State the field's demand on the addressed object; accept addressable data at layout | ☐ |
| 4 | Make both remaining refusals name the real requirement | ☐ |
| 5 | Verification, reviews, record and roadmap | ☐ |

## Verification shape

Impact: semantic demand inference, machine lowering, layout transform resolution and two diagnostic
causes. Directed probes and the new oracle during implementation; install, build, typecheck and the
complete owned tests at the checkpoint; the affected VICE files, which are the sprite-pointer and VIC
observer journeys; byte identity across the three examples and three optimization goals.
