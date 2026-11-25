# The chip fetches 64 bytes and the compiler constrained nine thousand

> **Owner**: T-189 (#189) · **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Status**: Implemented and locally verified; package and host tiers running, reviews pending
> **Progress**: 5/6 tasks (83%)
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
| 1 | Inventory the pinned cases this row moves: every oracle quoting E10273, the block-index oracles, the runtime-index oracle | ☑ |
| 2 | Oracles, authored implementation-blind, asserting the **fetched block's final address is visible** rather than that the program builds | ☑ |
| 3 | The extent-carrying demand: semantic channel, machine object, one shared layout predicate, dynamic-index widening | ☑ |
| 4 | Provenance and the definite-overwrite kill | ☑ |
| 5 | The inferred-constraint diagnostic | ☑ |
| 6 | Verification, reviews, record and roadmap | ☐ |

## What landed

| File | Change |
| --- | --- |
| `target/vic-fetch.ts` | New. Owns the fetched-extent facts and the demand type, plus run merging. The extent table moved here from `machine/vic-fields.ts`, which re-exports it, so one owner states what the chip fetches through each field |
| `semantic/block-index-alignment.ts` | Records a fetched run per published use instead of one visibility flag; a runtime index widens to the object; only `lo` and unary plus are followed downstream; a value this body provably replaces stops the walk |
| `semantic/operations.ts`, `machine/machine-types.ts`, `machine/lower-data.ts` | The demand rides beside `placement` from the global onto the machine object |
| `layout/c64-layout-placement.ts` | `satisfiesVicFetch` and `nextVicFetchStart`, consulted inside `freeSourceStart` |
| `layout/c64-layout.ts` | Both searches consult them — the loaded-data loop through `freeSourceStart`, the zero-initialized loop in its own hand-rolled search — and an unsatisfiable inferred demand fails as `vic-visibility` |
| `services/resource-diagnostics.ts` | An inferred demand gets its own message, naming the fetched bytes and pointing at the expression |

Measured after the change, same profile and same programs as the baseline above:

| Shape | Before | After |
| --- | --- | --- |
| 9,000-byte array, helper and inline | E10273 | `$0A80`, block visible |
| Two 5,000-byte arrays through their own helpers | E10273 | `$0AC0` and `$2000`, **both** blocks visible |
| Published after a definite overwrite | E10273 | `$0AC0` |
| `hi(&buffer / 64)`, helper and inline | E10273 | `$0AC0` |
| `poke`-only · runtime index · 64-byte control | `$0A80` · `$0B00` · `$2000` | unchanged |

The two 5,000-byte objects are the case worth reading twice: the second moves from `$1E40`, where
the previous unit silently left an invisible sprite, to `$2000` — and the program builds. That is
the pair of outcomes neither the whole-object demand nor dropping the demand could produce.

## The diagnostic, and whose call the wording is

The frozen diagnostics chapter states E10273 as `Cannot place '<object>' — <requirements> conflict
with <occupied_or_profile_fact>; change or remove the explicit constraint`
(`spec/14-diagnostics.md:244`). The oracle requires an inferred refusal **not** to end that way,
since the author wrote no constraint to remove.

Nothing under `spec/` was touched, and the deviation is not new: the handler-visibility branch at
`services/resource-diagnostics.ts:85` already emits an E10273 whose tail differs, for the same
reason — the cause was not an explicit constraint. The pinned canonical framing in
`test/rd04/diagnostics-alternate-placement.spec.test.ts:118-142` covers explicitly placed objects
only, and it still passes. So the existing in-tree reading is that the frozen sentence is the
explicit-constraint framing rather than the only legal E10273 message, and this follows it.

Whether the frozen table should also be amended is a separate decision, and the user's.

## Verification

| Check | Result |
| --- | --- |
| New oracle, authored implementation-blind | 52 cases over four profiles; **36 RED** before implementation, all green after |
| Impl tier | **44 cases** in the pass (9 new) and **149** in layout (3 new) |
| Compiler package | **267 files / 4,570 tests**, 2 skipped (the Windows-only emulator cases) |
| Host tier | **281 files / 6,029 tests** |
| Affected VICE tier, targeted and serialized | **166 tests**, four files: the relocated-screen sprite-pointer emulator case, the VIC observer suite (132), VIC collisions (16) and the optimizer saved-output frontier guard (17) |
| Byte identity | **9/9** across three examples × three optimization goals, prefixes unchanged |
| Install · build · typecheck | clean; `spec/` untouched throughout |

### Mutation matrix

Eleven mutations, applied one at a time against the delivered code with the tests untouched.

| Mutation | Cases it fails |
| --- | --- |
| A runtime index keeps the static offset instead of widening | 1 — the widening case |
| Follow every unary operator again | 1 — the provenance case |
| Never prove a replacement | 1 — the overwrite case |
| Trust a replacement in module storage too | 1 — the module-storage case |
| Accept a replacement from any block, not just this one | 2 — the conditional case and the held-local case |
| Do not merge touching runs | 1 — the merge case |
| Let the last published use win instead of accumulating | 2 — the accumulation and merge cases |
| Judge the whole object instead of the fetched runs | 1 — the layout predicate case |
| Advance past the window without the run's own offset | 1 — the deep-offset case |
| Ignore the inferred runs inside the search loop | 1 — the search case |
| Fall back to the explicit-constraint message and span | 1 — the diagnostic oracle case |

Every new case is failed by at least one mutation, and each structural mutation fails only the cases
that exist to guard it. The two that fail two cases are telling rather than noisy: dropping the
same-block requirement also breaks an ordinary held-local publication, and last-use-wins breaks the
merge because merging is what makes two adjacent runs one.

### One VICE case failed intermittently, and it is not this change

`test/rd05/vic-collision-vice.spec.test.ts`'s "only sprite 7 overlaps foreground" failed three times
and passed twice today over identical compiler output — including a failure at the parent commit
with the compiler rebuilt from that state, which is what rules this change out. The final
affected-tier run was 166/166. Filed as [#191](https://github.com/blendsdk/blend65/issues/191)
rather than absorbed here, because a case that fails half the time trains the next reader to re-run
until green.

## A second hole in the same proof, measured and filed

The walk follows a block number through conversions, a selector-preserving unary operator, a join,
a store and load, and a return into every call site. It does not follow a **binary** operation, so

```blend65
c64.vic.setSpritePointer(0, lo(&sheet / 64) + 1);
```

records no demand at all, and the sheet stays at `$1400` where the chip reads character ROM —
indistinguishable from never publishing it. The control without `+ 1` is moved to `$2000`, and
`lo(&sheet[64] / 64)` is placed at `$1FC0` so the addressed element lands at `$2000` with the
object's unfetched first 64 bytes left under the window, which is this unit working as intended.

Selecting frame *n* by adding to a base block number is ordinary style, and this is the dangerous
direction: over-demanding costs a build and shows a diagnostic, under-demanding costs nothing until
the sprite displays character shapes. It predates this unit — the walk has never followed a binary
operation — and is filed as [#190](https://github.com/blendsdk/blend65/issues/190) with its
measurements and a fix shape, not repaired here.

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

The sibling defect in `semantic/load-destination-constraints.ts:186-235` — it collects destination
`ranges` and then collapses them into the same whole-object region — is the same class and stays
out of this unit. The two defects found while delivering it are filed:
[#190](https://github.com/blendsdk/blend65/issues/190), the arithmetic the proof does not follow,
and [#191](https://github.com/blendsdk/blend65/issues/191), the intermittent collision case.

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
