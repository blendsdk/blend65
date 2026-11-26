# Let the safe VIC field form take the address of ordinary module storage

> **Owner**: T-179 (#179) · **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Status**: Delivered and verified; seven reviews dispositioned over three rounds, two fields withdrawn on their evidence
> **Progress**: 5/5 tasks (100%)
> **Last Updated**: 2026-11-26

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
| `vicCharsetSelect` on ordinary storage | refused | **builds, 2 KiB footprint visible** |
| `vicScreenSelect` and `vicBitmapSelect` on ordinary storage | refused, wrong reason | **refused, naming the asset and constant spellings** |
| `place(at:)` on a usable address | refused | **builds** |
| `place(at:)` inside the character-ROM window, outside the bank, or misaligned | refused, wrong reason | **refused, naming the reason** |
| a static **unaligned** element offset | refused, wrong reason | **refused, naming the offset** |
| an index chosen at run time | refused, wrong reason | **refused, naming the spelling that works** |
| an address held in a `word` | refused, wrong reason | **refused, naming the real requirement** |
| a zero-page home | refused, wrong reason | **refused, naming zero-page storage** |
| `place(at:)` whose **displaced** block leaves the readable area | **accepted, silently unreadable** | **refused, naming the window** |
| a local array, or a borrowed array parameter | refused earlier, E10260 | unchanged |
| `&object` with no VIC capability anywhere | builds, unconstrained | unchanged |

Three of those refusals are kept deliberately rather than implemented, and each names the spelling
that works. An index chosen at run time has no single value for a capability returning one byte to
compute — and the answer is not the hand-rolled arithmetic, which is the hazard this capability
exists to remove, but `vicSpriteBlock(&object[0]) + index`, which is accepted and keeps every
selectable block reachable. An address held in a `word` cannot be attributed to one object. A
zero-page home is chosen by an allocator that knows nothing of video alignment, so the author never
wrote the address that would be refused.

## Tasks

| # | Task | Status |
| --- | --- | --- |
| 1 | Split the oversize block-index implementation tests, and the shared fixture they needed | ☑ |
| 2 | Share the capability-to-field map; keep the capability's address symbolic | ☑ |
| 3 | State the field's demand on the addressed object; accept addressable data at layout | ☑ |
| 4 | Make every remaining refusal name the real requirement | ☑ |
| 5 | Verification, reviews, record and roadmap | ☑ |

## The reviews, and the one place all three landed

Three independent audits ran against the first delivery: emitted code, target platform, and
semantics with developer experience. They reported fifteen findings between them and **converged on
one place without sharing notes** — the screen field. The platform and machine-code audits arrived at
the same root cause separately, which is the strongest signal either of them produced.

| Finding | Measured | Disposition |
| --- | --- | --- |
| the screen-role machinery is asset-only | `let screen: byte[1000]` at `$2000`, `other` at `$23E8-$2427` — owning `$23F8-$23FF`, the eight sprite-pointer bytes | **withdrawn**, filed as [#200](https://github.com/blendsdk/blend65/issues/200) |
| the fetched extent is not enforced for a global | `let bitmap: byte[64]` built, chip fetching 7,936 bytes from its neighbours | **withdrawn** with it |
| the single-active-screen proof cannot see a module object | `vicScreenSelect(&screen)` plus any `setSpritePointer` refused *"select one screen with vicScreenSelect"* | **withdrawn** with it |
| a declared demand did not hold at a fixed address | `place(at: $0FC0)` + `+ 1` accepted; block one is `$1000` | **fixed** |
| the refusal stated a false cause for two of four inputs | one sentence claimed the address was run-time for a link-time binding | **fixed** |
| the run-time-index refusal sent the author to the hazardous form | *"compute the field from it with ordinary arithmetic instead"* | **fixed**; it names `vicSpriteBlock(&object[0]) + index` |
| the remedy inside the message argued with its own template tail | *"…which no placement can correct; change the field address or placement constraint"* | **fixed**; a `help` channel |
| the demand could not name the field it came from | a charset refusal called itself a sprite-block expression | **fixed** |
| the pass documentation contradicted the pass | "proved only where the chip provably receives the value" | **fixed** |
| a zero-page home folded and refused an address the author never wrote | *"`$f2` is not aligned"* | **fixed** |
| `vicCharsetSelect(&x) + 2` selects an undemanded 2 KiB slot | **asset parity** — the asset form accepts it too | filed as [#201](https://github.com/blendsdk/blend65/issues/201) |
| no bank-first search for a demand-carrying global | symmetric with the arithmetic form, which predates this | filed as [#202](https://github.com/blendsdk/blend65/issues/202) |
| the specification's own `const B: byte = vicSpriteBlock(&buffer)` | **E10191** for an asset as much as for module storage | filed as [#203](https://github.com/blendsdk/blend65/issues/203) |
| a third `\|`-combined field, and a reloaded accumulator | 2.0× and 1.54× by inference, not measured bytes | filed as [#204](https://github.com/blendsdk/blend65/issues/204) |
| nothing structurally stops a field label being used as an address | unreachable, but the value population widened | filed as [#205](https://github.com/blendsdk/blend65/issues/205) |

### Why two fields were withdrawn rather than repaired

The issue this unit owns names `vicSpriteBlock`. The three sibling fields were an extension, taken
because the lowering gate is shared and extending it looked free. It was not: a screen matrix owns a
complete 1 KiB interval whose last eight bytes are what the chip fetches as the sprite pointers, a
bitmap reads 8,000 bytes however short the declaration is, and the proof that one screen is active
recognises an asset and nothing else. Three mechanisms, all carried only for an asset, and fixing any
one alone hides the next.

A charset stays, because it needs nothing those three provide: alignment and a reachable run, which
the demand already expresses, and a partial charset is legal exactly as it is for an asset.

So the shipped surface is decided by one predicate rather than by four call sites, and the two
withdrawn fields are rows in the expressiveness ledger whose probes the gate keeps honest.

### The lesson, now for the third consecutive unit

Row 3d narrowed a demand and lost the protection the coarse one gave every unfollowed route. Row 3e
followed call arguments and exposed the callee's unmodelled consumers. This unit accepted a new kind
of address and exposed the placement machinery behind it. The shape is identical each time:
**following a route removes the protection the fallback was giving every route beyond it.**

Enumerating the argument's endings up front — which this unit did before writing a line, and which
is why the acceptance table above exists — caught the input side completely. It caught nothing on the
output side, because the endings of *placement* are a different list. The next unit in this area
should enumerate the facts an asset carries that a global does not, before admitting a new kind of
object anywhere.

## The second review round, and what it caught that the first did not

The repairs went back to two of the three reviewers. The semantics re-review found **three refusals
naming a cause that was not true**, all three introduced by the first round's own fixes, and one of
them invalidated two cases that had been passing.

| Finding | Measured | Disposition |
| --- | --- | --- |
| SM-013 — an occupancy conflict reported as a visibility failure | two objects at `$2000`: *"the address $2000 … does not satisfy it"*. It satisfies it completely; the conflict was the other object | **Fixed.** The cause is split where it is known, and an occupancy conflict gets the canonical sentence about an explicit constraint |
| SM-014 — the bounded wording became unreachable, and two cases stopped discriminating | `place(at: $1000)` and `place(at: $4000)` rendered **one** sentence naming the bank and the window together, so each case's pattern matched in either program | **Fixed.** The failing run is named with its own bounds |
| SM-017 — an asset addressed at an element fell through to the wrong sentence | `vicSpriteBlock(&SPRITES[i])` — an animated sheet — told the author to pass `&` straight at the call, which is what they had done | **Fixed.** It names `vicSpriteBlock(&asset) + index`, which works |
| SM-016 — a composite demand claimed the capability declared all of it | an object reached by both routes dropped the inferred admission | **Fixed.** The weaker claim is kept |
| SM-019 — the zero-page action claimed the alignment was impossible | false for a sprite block: `$0040` is a legal block | **Fixed**, and filed as [#207](https://github.com/blendsdk/blend65/issues/207) |
| SM-023 — the alignment action named a byte count | *"the nearest below this one is 64"*, where the author types a position or a field name | **Fixed** |
| SM-015 — the shared-address branch has no reachable shape | neither the reviewer nor a mutation could reach it | **Branch kept, its sentence removed.** No author can be told about a branch no author can reach |
| SM-008 remainder — a link-time address through a binding or a parameter | the reviewer's ruling: an issue alone would not notice when the reason expired | **Filed as [#206](https://github.com/blendsdk/blend65/issues/206) with a ledger row** |
| SM-021 — a charset displacement is unproved | pre-existing, at asset parity; but the sprite help now teaches `+ index` | **Recorded on [#201](https://github.com/blendsdk/blend65/issues/201)** as a raised exposure |
| SM-020 — the withdrawal's stated reason was leaky | a constant address reserves nothing either, yet is the recommended spelling | **Reason restated** as ownership |

### What the round says about the method

The first round's lesson was that enumerating the argument's endings caught the input side and nothing
of the output side. This round's is narrower and sharper: **three of the fixes for round one were
themselves new defects, every one of them in a diagnostic.** The pattern is that each fix moved where
a failure is detected, and the sentence stayed behind describing the old detection point.

An oracle reading a message as a substring cannot catch that. Two cases passed through a wording that
had lost the distinction they existed to pin, and only a reviewer reading the render could tell.
Where a refusal has a cause, the case now has to reject the other causes as well as match its own.

### Two findings answered rather than fixed

The reviewer asked for the specification authority behind the declared/inferred split and supplied it:
`spec/11-memory-model.md:72-75` says requirements from a platform operation are intersected with the
source clause and the complete object must satisfy the result, otherwise E10273. A VIC field
capability is a platform operation; address arithmetic is not. The split is specified, not merely
defensible, and that citation is better than the argument this record first made for it.

The withdrawal was also challenged and survives on stronger evidence than the first round's: accepting
module storage for a screen field would not have been quietly wrong, it would have produced *"Active
screen 'X' has no placed VIC asset"* — an internal-sounding refusal — the moment a sprite pointer was
written.

## The third review round

The second round's repairs went back once more. One finding, and it was the second half of a defect
the round before had only half-closed.

| Finding | Measured | Disposition |
| --- | --- | --- |
| TP-010 — a body nothing can enter declared a demand, refusing a build that previously succeeded | an uncalled function holding `vicSpriteBlock(&far)` with `far` at `$4000` was refused; the same dead function using the arithmetic form built | **Fixed.** Liveness over-approximates on purpose, and only the declared route is gated |
| TP-009 — the run-time-index advice was wrong for a wide element | `byte[4][128]`: following `+ index` selects block `base+i` instead of `base+2i` | **Fixed.** The fold knows the stride and the advice is scaled by it |
| TP-011 — the withdrawal's help steered authors to the spelling with no reservation either | a constant screen address leaves `$xFF8-$xFFF` unowned too | **Fixed**; the gap is on [#200](https://github.com/blendsdk/blend65/issues/200) |
| the alignment clause claimed no placement could correct the offset | `place(at: $2820)` with `&b[32]` puts the addressed byte at `$2840`, which is aligned | **Wording corrected**, and the reason the check still refuses it written down beside it |
| the footprint comment claimed every footprint divides the bank and window boundaries | 8,000 and 1,000 divide neither; `satisfiesVicFetch($0000, 8000)` is `false` | **Corrected**, with the measurement |
| TP-008 — a composite demand's attribution | already closed by the second round's fix | **Verified**, no change |
| the withdrawal's completeness | every producer of a foldable field operand enumerated | **Confirmed complete** |
| the `help` channel's effect on artifacts | pre-existing `ProjectDiagnostic` field, already rendered and serialized | **Confirmed text-only** |

### And one defect the mutation matrix found rather than a reviewer

Verifying the occupied-address case, the mutation aimed at the layout reason failed nothing. Chasing
why found that the sentence is chosen where the diagnostic is built, not where the reason is set —
and that the repair had been applied to one of the two placement loops. Storage reserved without
bytes still blamed the chip: `place(at: $0100)` satisfies every requirement the chip has and fails
the resident window, and was told the address did not satisfy the chip. Both loops now ask the same
question, and the shape is pinned as a case beside the occupied address.

### And one the fix for a finding introduced itself

The liveness gate that closed TP-010 walked only function bodies. A module initializer is a body of
its own and runs before the entry, so a publisher reached only from one looked unreachable and had
its declared demand dropped. Measured, with `buffer: byte[64]` published by a function `blk`:

| Shape | Before | After |
| --- | --- | --- |
| `let f: fn(): byte = &blk;` | **no demand** | align 64, 64 bytes |
| `let b: byte = blk();` | **no demand** | align 64, 64 bytes |
| called from `main` | align 64 | unchanged |
| uncalled, address never taken | no demand | unchanged |

This is the error direction the gate's own comment named as the one to avoid, and the fix for it
walked into it anyway. A global initializer naming a publisher is not the dead-body case — it runs
at startup, so the function genuinely executes.

**One claim in the commit that fixed it is wrong, and this is the correction.** That message says
the programs would have shipped a sprite pointing at character ROM with no diagnostic. Only the
dropped demand had been measured at that point, not what the build then did. Measured since, at
paddings of 16, 100, 900, 2,400 and 9,000 bytes before `buffer`, every one of them is **refused**:

```
E10273  Cannot place 'VIC field' - VIC field 'vic-sprite-block' at $13e8 overlaps the
        VIC-invisible character-ROM window $1000-$1fff
  help: Move 'place(at:)' on this object to an address that satisfies the requirement
        above, or remove it and let the compiler choose a home that does.
```

A later stage checks the field address and catches the dropped demand every time. So this is not a
silent miscompile — it is the same defect as the rest of the round: a legal program refused, with a
message naming a cause that is not true. The author is told to move a `place(at:)` their program does
not contain, at an address they did not choose, for an object the compiler placed itself.

Three acceptance cases now pin it, all three verified red against the pre-fix compiler, and the oracle crossed 700 lines again in the process. It is now split on the class boundary rather than by size: placement and acceptance in `vic-field-ordinary-storage` (263 lines, 21 tests), the refusals and the reachability cases in `vic-field-refusals-and-reachability` (452 lines, 24 tests). All fourteen `expectActionable` refusals are in the second file, and the first imports neither `refusalTexts` nor `expectActionable`, so nothing there can assert a message at all. The third is
the one worth keeping: it puts both answers in one program, so that widening liveness to every
function — which would satisfy the other two — still fails on the dead body beside them.

The method note is that the claim was wrong in the safe direction and still wrong. Measuring that a
demand was dropped is not measuring what the compiler does about it, and the two are a stage apart.

### Why the second hole is the last one

The first hole came from enumerating the routes into a function by hand, so the second pass
enumerated them from the IR instead:

| Question | Answer | Evidence |
| --- | --- | --- |
| Which forms name a function? | `call` and `function-address`, and nothing else | the only two carrying a `BindingId` for a function in `operations.ts`; the four terminators (`jump`, `branch`, `return`, `unreachable`) carry none |
| Which bodies can hold them? | function bodies and global initializers | both are `readonly SemanticBlock[]`, and both are now walked |
| Can an initializer name a function without emitting one? | no | `let f: fn(): byte = &blk;` lowers to one block of `function-address, store`; `let b: byte = blk();` to `call, store`; `initialBytes` is `null` for both, so neither folds away |
| Can the entry be missing? | only from a test | production passes the resolved main; the gate now names nothing unreachable without it |

Two fold shapes that could have hidden a function address do not exist to hide one:
`const F: fn(): byte = &blk;` is refused as not compile-time evaluable (E10191), and an array of
function pointers refuses the whole program before any of this runs — unrelated to VIC fields, filed
as [#208](https://github.com/blendsdk/blend65/issues/208) with a ledger row and probe, since a
dispatch table is ordinary code and the natural spelling of a hand-written jump table.

## Verification

| Gate | Result |
| --- | --- |
| Oracle, authored independently | **33 shapes / 45 tests** across two files; 26 of 36 red before implementation |
| Mutations | **20** applied alone, **18 discriminate**, failing 1–28 cases |
| Host checkpoint | **284 files / 6,220 tests**, green |
| Affected VICE journeys | **137/137** — sprite pointer, producer, VIC observers, koala, qp15 |
| Byte identity, three examples × three goals | **9/9 unchanged** |
| Capability versus hand-rolled arithmetic | **byte-identical**, four profiles × none/balanced/size |
| Compiler package suite | **269 files / 4,594 tests**, green |
| Install, build, typecheck | clean |

### Mutation matrix

Twenty mutations, each applied alone against the delivered code with the tests untouched.

| Mutation | Cases it fails |
| --- | --- |
| The zero-page guard inverted | 28 |
| The capability states no demand | 21 |
| Layout admits only an asset again | 21 |
| The help line dropped from the author's view | 9 |
| Every refusal reports the same cause | 5 |
| Every field accepts module storage | 3 |
| A declared demand drops at a fixed address | 3 |
| The placement action removed | 3 |
| The bounded fixed-address cause removed | 3 |
| The failing check no longer selects the sentence | 2 |
| A position inside an asset reports no cause | 2 |
| The offset-alignment check removed | 1 |
| The capability's displacement reach not collected | 1 |
| The field footprint widened by one byte | 1 |
| An unreachable body declares a demand again | 1 |
| The element stride no longer scales the advice | 1 |
| Reserved storage blames the chip for a window failure | 1 |
| Initializer bodies not walked for a caller | 3 |
| The shared-address guard removed | **0** |
| The field footprint narrowed to one sprite block | **0** |

Two of those are the disclosed non-discriminators below. One more is worth recording for method
rather than for coverage: the first attempt at *"the failing check no longer selects the sentence"*
mutated the layout reason instead of the place the sentence is chosen, and failed nothing. Chasing
that is what found the second misattributed refusal — a mutation that does not discriminate is
sometimes aimed at the wrong line rather than at an untested rule.

## Disclosures

**Five of the forty-five cases are not implementation-blind, and the table no longer claims they
are.** The first thirty-six were authored against the requirements with the implementation unwritten,
and 26 of them were red. The five added during review — the occupied address, the address below the
resident window, and the three initializer routes — were written after the code existed, from a
stated requirement rather than from the code, and the initializer prompt described the failure
mechanism because that is what had just been measured. They are regression pins, and each was
verified red by reverting the fix and rebuilding rather than by having been written first. That is
weaker evidence than a blind oracle case and is recorded as such.

**The entry-absent branch is asserted above and pinned by nothing.** The gate now names nothing
unreachable when it is handed no entry, and the table above states that. No test covers it and no
mutation row measures it, because the only caller that can reach it is a direct one: production
always passes the resolved main, so the branch is reachable from a unit test and from a future
caller that forgets the argument. A test would have had to be written while the host count was
being measured, so it is recorded as unpinned rather than written in a hurry — the honest status is
that the repair is argued from the single call site, not demonstrated.

**The ledger carries five rows for this row's work, not four.** The fifth is the function-pointer
table (#208), which this row did not create and does not own — it was found while enumerating the
routes into a function, and is recorded because a restriction a user can hit belongs in the ledger
whoever finds it.

**Two mutations fail nothing, for different reasons.**

The shared-address guard — the fold declines when one `place-address` result has more than one use —
is unobservable. No source shape reuses such a result: each `&object` occurrence mints its own value,
and an address stored in a variable arrives as a load rather than as the place-address. The guard is
kept rather than deleted because being wrong about it would fold an address another use still needs
at run time, and that is a wrong artifact rather than a refusal.

The field footprint cannot be narrowed observably **for the two fields this unit ships**, and the
reason is arithmetic rather than a test gap: a sprite block's 64 bytes and a charset's 2,048 both
equal their field's alignment granule, so a start aligned to that granule keeps the whole footprint
inside the bank and either wholly inside or wholly outside a 4 KiB-aligned window. Widening the
footprint by one byte **does** fail a case — the 4,096-byte charset whose fetched 2,048 bytes end
exactly at `$3FFF` — so the extent is pinned from above by a test and from below by the alignment.

The platform re-review was right to refuse the general form of that argument, and measuring settled
it. A bitmap's footprint is **not** subsumed: `satisfiesVicFetch($0000, 8000 bytes)` is `false`,
because 8,000 bytes from an 8,192-aligned `$0000` reach `$1F3F` — half of them inside the
character-ROM window, with the base address clear of it. So the footprint becomes load-bearing the
moment [#200](https://github.com/blendsdk/blend65/issues/200) admits a bitmap or a screen matrix to
module storage, and the comment in `target/vic-fetch.ts` that claimed every footprint divides the
bank and window boundaries — it does not; 8,000 and 1,000 divide neither — is corrected, because that
comment is what a later reader would have leaned on to narrow one.

**Everything here is artifact-placement-verified.** Every acceptance case resolves a final address
from public debug metadata and checks the fetched run against the bank and the character-ROM window.
No test observes the chip fetching those bytes, and the three sibling fields' emitted `$D018`
immediates are not read back by any test — only the sprite encoding is, through byte identity with
the hand-rolled form. That is weaker than the `VICE-verified / hardware-unverified` status the rest
of the VIC surface carries, and it is the same gap already filed as
[#196](https://github.com/blendsdk/blend65/issues/196).

**Every demand here is correct while and only while the program leaves CIA2 DDRA bits 0–1 as
inputs.** Startup establishes bank 0 by clearing them, and `$DD02` is deliberately not an owned
device byte, so a legal program may reconfigure the bank bits as outputs — after which every folded
field immediate and the whole placement proof are wrong with no diagnostic. Pre-existing for
constants and assets; this unit makes it load-bearing for the author's own mutable data. Recorded by
the platform audit, not filed, because it is a property of the ownership model rather than of this
change.

**The character-ROM window is modelled as the absolute `$1000-$1FFF`** while the authority states it
is bank-relative and present only in banks 0 and 2. Unreachable today — `vicBankStart` is the literal
type `0x0000` on every selectable profile — and recorded so bank selection does not inherit an
absolute window.

**Three cost claims are inference, not measured bytes.** The two ratios in #204 come from the
instruction forms the selection code constructs; nothing was disassembled. The issue says so, and
says to disassemble before sizing either fix.

## Verification shape

Impact: semantic demand inference, machine lowering, layout transform resolution and two diagnostic
causes. Directed probes and the new oracle during implementation; install, build, typecheck and the
complete owned tests at the checkpoint; the affected VICE files, which are the sprite-pointer and VIC
observer journeys; byte identity across the three examples and three optimization goals.
