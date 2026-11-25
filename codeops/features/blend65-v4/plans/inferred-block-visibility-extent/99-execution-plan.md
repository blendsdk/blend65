# The chip fetches 64 bytes and the compiler constrained nine thousand

> **Owner**: T-189 (#189) · **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Status**: Planned; oracles not yet authored
> **Progress**: 0/6 tasks (0%)
> **Last Updated**: 2026-11-25

## Why

```blend65
module Game;
let one: byte[5000];
let two: byte[5000];
function blockOne(): byte { return lo(&one / 64); }
function blockTwo(): byte { return lo(&two / 64); }
function main(): void {
  c64.vic.setSpritePointer(0, blockOne());
  c64.vic.setSpritePointer(1, blockTwo());
}
```

```
error[E10273]: Cannot place 'one' — explicit placement constraints conflict with occupied
storage or the selected profile window; change or remove the explicit constraint
```

The author wrote no placement constraint. The compiler inferred one, then blamed them for it.
Both programs built before the previous unit widened the visibility proof across a call, and
neither object is larger than a visible interval — only the two together cannot both be visible
**as whole objects**, because `$2000-$3FFF` holds 8,192 bytes and `$0200-$0FFF` holds 3,584.

The chip fetches 64 bytes. A sprite block is 64 bytes at the addressed offset; those bytes must be
inside the VIC bank and clear of the character-ROM window, and the other 4,936 bytes of each array
are never fetched by the chip and need no particular home. Two 64-byte blocks fit the visible
intervals with enormous room to spare. The demand, not the hardware, is what refuses these
programs.

The same layout shows why the answer is not to drop the demand: before the widening, the second
object was placed at `$1E80`, **inside** the character-ROM window, and the program built with a
silently invisible sprite. The repair has to make these programs build *and* place the fetched
bytes where the chip reads them. Only a demand that carries the effective address and the fetched
extent does both.

## The three causes, and the one that decides the shape

| Cause | Where | Effect |
| --- | --- | --- |
| The demand is stated against the object root and enforced over every byte of the object | `semantic/block-index-alignment.ts`, then `placement.region` | Legal programs refused |
| Any unary operation is followed as if it preserved the block selector | `reachesVicConsumer` | `hi(&buffer / 64)` demands visibility for an object the chip never reads |
| A definite overwrite is not noticed | `loadsReachVicConsumer` | A value the chip provably never receives still constrains its object |
| The refusal names an explicit constraint the author never wrote | `services/resource-diagnostics.ts:89` | Nothing to remove, and no mention of the expression that caused it |

The first decides the design; the other three are over-approximations whose cost only became real
once an unnecessary demand could refuse a build.

## The fix

**The demand carries the fetched range, not the object.** A new inferred field on the global and on
the machine data object carries `{ offset, bytes, span }`: the static offset of the addressed
place, the exact bytes the consumer fetches, and the expression that caused the demand. Layout
places the object so that every demanded range is inside the bank and clear of the character-ROM
window; the rest of the object is ordinary resident data.

`placement.region` is deliberately **not** reused. An author who writes a region means the whole
object, and that acceptance is pinned. The inferred demand is a different claim, and keeping it in
its own channel is also what lets the diagnostic say the constraint was inferred and name the
expression.

**A runtime index widens the extent rather than narrowing it.** `placeAlignment` already admits
`&frames[index]` when the element stride is a multiple of the demand, and returns only the static
prefix. The chip may fetch any element, so the demanded extent for a dynamic step is the whole
indexed span — not 64 bytes at the static offset. Narrowing there would turn today's
over-approximation into a silently invisible sprite, which is the one direction this unit must
never move.

**Only selector-preserving operations are followed downstream.** The IR's unary operators are
`+`, `-`, `~`, `!`, `hi` and `lo`. Of those only `lo` and `+` leave a block selector meaning the
same block, and `lo` is followed today for exactly that reason. `hi(address / 64)` is a value in
`0..3` that selects a block in `$0000-$00FF` — not the object whose address produced it — so
following it claims a provenance it does not have.

**A definite overwrite kills the demand, and may only err toward demanding.** The smallest sound
rule: when a store to the identical place is followed, in that same block, by another store to that
identical place, only the loads between the two can read the first value. A branch that overwrites
on one path, or an overwrite that follows the read inside a loop, still demands.

**The diagnostic names the inferred constraint and its expression.** When a demand the compiler
inferred cannot be satisfied, the message says so and points at the block-index expression, instead
of telling the author to remove a constraint they never wrote.

## The design, grounded

| Layer | Change |
| --- | --- |
| `semantic/operations.ts` | `SemanticGlobal` gains an inferred fetch demand: ranges plus the expression span |
| `semantic/block-index-alignment.ts` | records `{ offset, bytes, span }` instead of a visibility boolean; a dynamic index widens to the whole object; only `lo` and `+` are followed downstream; a definite overwrite kills the demand |
| `machine/lower-data.ts:124-148` | forwards the demand onto the machine data object, beside `placement` |
| `machine/machine-types.ts:647-673` | `MachineDataObject` gains the same field, next to the existing `vicVisible` and `vicConsumerBytes` |
| `layout/c64-layout-placement.ts` | one shared predicate for the ranges, and one shared next-start rule derived from the violating range |
| `layout/c64-layout.ts` | the loaded-data and BSS loops both consult it |
| `services/resource-diagnostics.ts:79-93` | an inferred demand gets its own message, naming the expression |

Why the existing search already lands correctly once the check is range-scoped: a 9,000-byte array
is offered `$0A80` first, whose block `$0A80-$0ABF` is in bank and clear of the window, so it is
accepted where today's whole-object region check refuses it. The second 5,000-byte array is offered
`$1E40`, whose block falls inside the character-ROM window, so the next-start rule moves it to
`$2000` — exactly the home the previous unit produced, without the refusal.

## Enforcement sites, which are not one

Whole-object enforcement lives in four places, and the range rule belongs in one shared predicate
rather than four:

| Site | Role |
| --- | --- |
| `layout/c64-layout-placement.ts:20-35` | `satisfiesSourcePlacement`, the region and window check |
| `layout/c64-layout-placement.ts:80-88` | the character-ROM skip inside `freeSourceStart` |
| `layout/c64-layout.ts:~653-690` | the loaded-data loop's bank check and visible search start |
| `layout/c64-layout.ts:~822-860` | the BSS loop's own inline character-ROM skip |

Initialized and zero-initialized arrays take different loops, so both need a witness. The skip
target is derived from the failing **range** (`characterRomEnd + 1 - offset`), not from the object.

The interval-level `vicVisible` flag is a separate honesty question: `c64-layout.ts:855` marks the
whole BSS interval visible from the region, and for an object whose 64 fetched bytes are visible
while its tail sits under character ROM that claim is false. What reads it — memory evidence and
resource diagnostics — is checked before the flag is kept, moved or scoped.

## Measured baseline, before any change

Measured on `c64-pal-prg-kernal-6581` at `4147e94e`:

| Shape | Result |
| --- | --- |
| 9,000-byte array published through a helper, and the same inline | E10273 |
| Two 5,000-byte arrays, each through its own helper | E10273 on the second |
| 9,000-byte array whose value reaches only `poke` | builds at `$0A80` |
| 9,000-byte array published after a definite overwrite with zero | E10273 |
| `hi(&buffer / 64)` on a 9,000-byte array, helper and inline | E10273 |
| `byte[2][64]` with a runtime index | builds at `$0B00`, both elements visible |
| 64-byte buffer behind 2,400 bytes of padding, through a helper | builds at `$2000` |

The intended result: every refusal above builds, with the fetched bytes visible, and every
build above keeps the address it has — the runtime-index case especially, which must not narrow.

Two layout facts found while measuring, both useful to the implementation. Public debug symbols
name a global by source span, not by identifier, but each carries a `labels` entry containing the
written name, which is how a test with several globals resolves the one it means. And the memory
ledger already projects every object into a second `cpu16-vic` address space, clipped to the bank
and split around the character-ROM reservation into `.before`/`.after` segments — so evidence
already expresses that only part of an object lies in the chip's view.

## Tasks

| # | Task | State |
| --- | --- | --- |
| 1 | Inventory the pinned cases this row moves: every oracle quoting E10273, the block-index oracles, the runtime-index oracle | ☐ |
| 2 | Oracles, authored implementation-blind, asserting the **fetched block's final address is visible** rather than that the program builds | ☐ |
| 3 | The extent-carrying demand: semantic channel, machine object, one shared layout predicate, dynamic-index widening | ☐ |
| 4 | Provenance and the definite-overwrite kill | ☐ |
| 5 | The inferred-constraint diagnostic | ☐ |
| 6 | Verification, reviews, record and roadmap | ☐ |

## Two existing oracle cases lose their teeth, and that has to be said out loud

`test/rd04/block-index-conditional-visibility.spec.test.ts:175-199` holds two negative cases — a
block number used only as a border colour, and one used only as the sprite index — whose arrays are
`byte[8193]`, deliberately one byte larger than the largest contiguous visible interval. Their
stated discriminator is that an accidental visibility demand would **refuse** the program.

Once the demand covers 64 bytes instead of the whole object, an accidental demand on an 8,193-byte
array no longer refuses anything: the block fits, and the 64-byte alignment those programs already
get is not consumer-gated, so nothing observable changes. Both cases keep passing and stop proving
what they were written to prove.

They are oracles and stay exactly as written. The discrimination moves to the implementation tier,
where the pass's output is read directly rather than inferred from a refusal — which is the honest
place for it, because "this program still builds" was only ever a proxy for "no demand was
recorded". The sibling oracle at `:160-168`, which compares the consumed and unconsumed addresses,
keeps its teeth either way.

## What this unit is not

The sibling defect in `semantic/load-destination-constraints.ts` — it collects destination
`ranges` and then collapses them into the same whole-object region — is the same class and is
filed rather than folded in.

## Deliberate departures worth stating

Setting both the inferred ranges **and** the region, with layout preferring the ranges where they
exist, was considered and rejected. It would leave about fifteen implementation cases and the
evidence flag untouched, but it states a whole-object constraint the enforcement then selectively
ignores — a contradiction the next reader has to discover, in a field a second pass writes for its
own reasons. The implementation tier is mine to update; a field that means two things is not.

### Two bounds ruled out before planning


Two cheap bounds were ruled out before planning. Skipping a demand the object cannot satisfy
misses this case entirely, because each 5,000-byte object satisfies the demand alone and only the
set of them does not. Dropping an inferred constraint after a layout failure restores acceptance
without proving the output, and would put the second object back at `$1E80`.
