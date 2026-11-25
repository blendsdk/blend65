# Follow a block number across a call argument, and close what the fallback never covered

> **Owner**: T-188 (#188) · **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Status**: Delivered and verified; six reviews dispositioned over two rounds, eleven reviewer-found regressions fixed here
> **Progress**: 6/6 tasks (100%)
> **Last Updated**: 2026-11-25

## Why this unit exists

The previous unit narrowed the inferred sprite-visibility demand from the whole object to the bytes
the chip fetches, and fell back to the whole object wherever the selector left along a route the
proof does not follow. That fallback is sound for the routes it covers. Measuring it first, before
designing anything, found that it does not cover two routes at all, and that it refuses programs in
which nothing hardware-related happens.

Measured on `c64-pal-prg-kernal-6581`, 2,400 bytes of live storage ahead of a 64-byte object so
placement below the window cannot hide a missing demand:

| Shape | Where the object lands today | Verdict |
| --- | --- | --- |
| `publish(lo(&buffer / 64))`, helper publishes it | `$2000`, visible | safe, whole object demanded |
| `let f: fn(): byte = &blockOf;` then `f()` | **`$1400`, character ROM** | **silent wrong** |
| `let table: (fn(): byte)[2] = [...]`, module or local | **`$1440`, character ROM** | **silent wrong** |
| `frames[0] = lo(&buffer / 64);` then `publish(frames)` | **`$1440`, character ROM** | **silent wrong** |
| `publish(b)` → `f[0] = b;` → `inner(f)` | demand present | safe only by the escape |
| `fill(xs)` writes `xs[0] = lo(&buffer / 64)`, caller publishes | **`$1440`, character ROM** | **silent wrong** |

And with a 9,000-byte object, where the whole-object fallback has no legal home:

| Shape | Today |
| --- | --- |
| `publish(lo(&sheet / 64))`, helper publishes it | refused, E10273 |
| `publish(lo(&sheet / 64))`, helper only **pokes** it | **refused, E10273** |

The last row is the sharpest: nothing in that program asks the video chip for anything, and #188's
own acceptance says ordinary address arithmetic crossing these boundaries stays unconstrained. The
fallback made that false.

## What this unit changes

Three changes, one seam.

**The argument route is followed.** A value passed as argument *i* of a direct call resumes at every
read of the callee's *i*th parameter, in the callee's body, carrying the selector arithmetic across
the boundary exactly as the return route does. A parameter read is a load of a place rooted at the
parameter binding, so the existing load-walking machinery applies. The escape is dropped for that
route and only that route.

**A value held in an address-taken object escapes.** The walk matches reads by `load`. Where the
address of the object holding the selector is taken anywhere in the program, a read this walk never
sees can reach the chip, so the honest answer is the whole object. This closes the local array lent
to a helper, a parameter whose address the callee takes, and a callee that copies its parameter into
a local and lends that on. It is stated against the holding object, never against the object whose
address produced the block number — `&buffer / 64` is itself an address-taken place, and guarding on
that would demand the whole object for every program this pass exists for.

**A value written through a borrowed parameter escapes.** `spec/06-functions.md:113` makes array and
struct parameters zero-copy borrows of the caller's object, while a scalar parameter is the callee's
own copy. So `xs[0] = lo(&buffer / 64)` inside `fill(xs: byte[])` writes storage this body does not
own, and the reads that matter are in a caller this walk is not standing in. The address-taken guard
does not reach it, because the `place-address` that lent the object belongs to the caller and the
parameter's own address is never taken. Restricting the rule to borrowed parameters is what keeps it
free: reassigning a scalar parameter writes a private copy, so those reads are still followed exactly
and a sheet published that way keeps its narrow demand.

**A result that an indirect call can receive escapes.** A value leaving a body by return resumes at
that function's direct call sites. Where the function's address is taken anywhere, an indirect call
can receive the result and this pass cannot enumerate the receivers, so the demand falls back to the
whole object. #188 allows a stated over-approximation here, and the alternative is the measured
`$1400`.

## What this unit deliberately leaves

A block number stored in module storage in one body and read in another, and one published from a
module initializer, keep the whole-object fallback. Both are sound today; following them is the same
load walk over every body plus the same address-taken guard, and it belongs in its own unit with its
own measurements. #188 stays open for them.

An indirect call's **arguments** keep the escape, unchanged: there is no resolved callee to continue
into without the call-target proof.

## Tasks

| # | Task | Done |
| --- | --- | --- |
Ordered so that every commit is at least as safe as its parent. Following arguments before the
guards exist would open a silent hole of its own: the callee that copies its parameter into a local
and lends it on is safe today only because the argument escapes.

| # | Task | Done |
| --- | --- | --- |
| 1 | Baseline measurement of every route, recorded above | ☑ |
| 2 | Specification oracle, authored implementation-blind, with meaningful RED | ☑ |
| 3 | Escape a selector held in an address-taken object, or written through a borrowed parameter | ☑ |
| 4 | Follow a result an indirect call can receive, rather than escaping | ☑ |
| 5 | Follow a direct call's argument into the callee's parameter reads | ☑ |
| 6 | Verification, reviews, record and roadmap | ☑ |

## What the oracle caught that I had not planned for

Task 4 was planned as an escape: a result returned from a function whose address is taken would fall
back to the whole object, because a call through an address names no callee. The oracle refused that,
and it was right to. A 9,000-byte object whose block number is returned by an address-taken helper
and only **poked** was then refused, and nothing in that program asks the video chip for anything.

Every call made through an address is an indirect call, so the places such a result can arrive are
the indirect calls accepting that function's shape. Following those answers the question without a
call-target proof, and answers it with the runs the chip reads instead of with the whole object.
The issue anticipated "a stated over-approximation across every function whose signature matches";
this is that over-approximation, used to follow the route rather than to abandon it. Its cost is
real and filed as [#193](https://github.com/blendsdk/blend65/issues/193): two functions sharing a
shape share a demand, so a number only poked can be demanded at the other's call site.

## What mutation testing caught that no review had

Removing the rule that escapes a selector whose **parameter** address is taken left all 73 cases
passing, while the shape it protects placed its object at `$1440` with no demand at all:

```blend65
function publish(b: byte): void { let a: word = &b; c64.vic.setSpritePointer(0, peek(a)); }
```

A later mutation found the same thing about a write to an address computed at run time. Both shapes
went back to the implementation-blind author as requirements rather than being written here, which is
why the oracle is 119 cases and not 117 plus two of mine.

## What four reviews found, and what each one cost

Four independent reviews ran: correctness, platform, semantics and SFA/ABI. Every one found a real
defect, and **five of the findings were regressions this unit had introduced** — three of them
silent. All five are fixed here rather than filed, on the same reasoning as the unit before: an
unnecessary refusal costs a build and shows a diagnostic, while an under-demand costs nothing until
the sprite displays character shapes.

| Finding | Severity | Measured | Disposition |
| --- | --- | --- | --- |
| RV-001 — one helper used twice in an expression invented a chain of 256 displacements | major | `0+9000` for a sheet needing `64+64` | **Fixed.** A return resumes at the invocation that supplied the argument |
| SF-001 — a selector composed into an aggregate was dropped | major | `$1440`, no demand at all | **Fixed**, and followed rather than escaped |
| SF-002 — a write through a borrowed element address bypassed every escape | major | `$1440`, no demand at all | **Fixed** |
| TP-001 / SM-001 — a backward displacement lost the demand entirely | major | `fetch=none` where `0+64` was owed | **Fixed.** Both candidates tried; pre-existing, exposed by narrowing |
| SM-002 — an indirect call's shape group invents a consumer | major | refused, runs `640+64` and `17024+64` | Filed as [#193](https://github.com/blendsdk/blend65/issues/193); needs its own target resolver |
| SM-003 — a lent object holding a selector is demanded whole, with no VIC consumer at all | major | refused, all 9,000 bytes | Filed as [#194](https://github.com/blendsdk/blend65/issues/194); needs following an object across a boundary |
| RV-002 — two comments misstated the language | minor | — | **Fixed.** FN-12 requires exact qualifier matching, so the key's erasure is an over-approximation and now says so |
| RV-003 — the implementation tests reached 1,282 lines | minor | 1,154 before this unit | Filed as [#197](https://github.com/blendsdk/blend65/issues/197); a shared fixture would ship in `dist` |
| SM-004 — the fallback's message gives no next action | minor | — | Recorded on #188; stateable once a route is closed |
| TP — no emulator journey discriminates this inference | — | — | Filed as [#196](https://github.com/blendsdk/blend65/issues/196) |

### The structural lesson, which is the same one as last unit

Following a route removes whatever protection the fallback was giving every route **beyond** it.
Last unit it was narrowing the extent that exposed three unfollowed routes; this unit it was
following the argument that exposed the callee's own unmodelled consumers. Patching the two
witnesses would have left the next one.

So the walk now classifies **every** operation that receives a block number: an exhaustive switch
over all twenty operation kinds with a `never`-typed default, so a kind added later stops compiling
instead of silently dropping a selector. Three outcomes — already inspected, proved to designate no
block of this object, or a route not followed and therefore the whole object.

Two of those became precise rather than conservative, because escaping them cost ordinary code. A
number written through an address lands in the object that address names. A number composed into an
aggregate is in whichever object the aggregate is delivered into, so an animation table demands the
two blocks it holds — `0+128` — rather than the 9,000-byte sheet behind it.

One branch was then **removed** because a mutation proved it could not answer differently: resolving
a written address back to a named place could never beat the escape, since writing through an
object's address requires taking that address, which escapes on its own.

## The second review round, and why it changed the approach

The four repairs went back to two of the reviewers. They found six more holes in the same class —
one of them a **compiler crash** — which is the point at which enumerating programs stopped being
the right method.

| Finding | Measured | Disposition |
| --- | --- | --- |
| SM-009 / SF-005 — the aggregate route dropped the invocation it was entered with | `RangeError: Maximum call stack size exceeded` | **Fixed.** Now `64+64` |
| SM-006 / SF-001 — an aggregate assigned into module storage | `$1400`, no demand at all | **Fixed.** The module check moved to where every write route arrives |
| SM-007 / SF-002 — a constant write to the address of a placed object | `$1400`, no demand at all | **Fixed** |
| SF-002b — a block number poked into a sprite-pointer byte, through a helper | no demand | **Fixed.** `(address & $03FF) >= $03F8` |
| SF-004 — two exclusive-ors restoring the number, across calls | no demand | **Fixed** by the crossing invariant; the direct form is [#198](https://github.com/blendsdk/blend65/issues/198) |
| SF-006 — an 18,000-byte object owed two runs 16 KiB apart | unsatisfiable, refused | **Fixed.** One residue, one position |
| SM-005 / SF-003 — two callers of one helper collapsing in the memo | `0+64` in both caller orders | **Refuted**, by construction |
| SM-008 — a computed address outside the bank refuses the whole object | refused | Filed as [#199](https://github.com/blendsdk/blend65/issues/199) |

### Enumerating endings instead of programs

Two rounds had found holes as fast as they were fixed, because both attacked programs. The walk ends
a search in exactly three ways: it follows a route, it reaches something it has **proved** no longer
names a block of this object, or it reaches something it merely **assumes** does. Listing those
endings showed the assumed ones were inherited and two were false — an exclusive-or by a mask twice
restores the number exactly, and so does decimal subtraction of zero.

Before arguments were followed, every number passed as one demanded the whole object, so none of
those assumptions were reachable that way. The walk now carries whether the number has crossed into
a function through a parameter, and **an assumed ending escapes once it has**. That makes every
crossed program at least as safe as it was before the route was followed, by construction rather
than by enumeration, and leaves direct code exactly as it behaved. Adding and subtracting stay
followed; a boolean result stays proved, so a helper that compares its block number pays nothing.

### One refutation, by construction rather than by probe

Both reviewers in the second round held that two callers of one helper could share a function-local
result identity, collapse in the memo, and lose the chip-facing caller. `ControlFlowBuilder`
allocates every identity as `${prefix}:v${n}` with the prefix `function:<binding>` or
`initializer:<binding>`, so identities are unique program-wide and initializers are distinguished
too. Measured in both caller orders: `0+64` each time. Recorded as refuted rather than as a risk
accepted.

## Verification

| Check | Result |
| --- | --- |
| Oracle, authored implementation-blind throughout | **141 cases** over four profiles; **28 of the first 73 failed** before implementation |
| Implementation tier | **1,727** across pass, layout and services |
| rd04 in full | **130 files / 1,997 tests** |
| Host checkpoint | **282 files / 6,148 tests**, exit 0 |
| Affected emulator tier, targeted and serialized | **166/166** across four files |
| Byte identity | **9/9** across three examples × three optimization goals, every hash unchanged |
| Install · build · typecheck | clean; `spec/` untouched throughout |
| Module sizes | 411 · 673 · 302 · 120 · 110; the walk is above the 500 aim and inside the 700 ceiling |

### Mutation matrix

Twenty mutations, each applied alone against the delivered code with the tests untouched, all
measured against the final 141-case oracle.

| Mutation | Cases it fails |
| --- | --- |
| Unknown consumers no longer escape | 21 |
| A write to an unattributable address no longer escapes | 18 |
| The indirect-result route removed | 10 |
| The displacement residue replaced by the raw offset | 9 |
| The address-taken holder no longer escapes | 8 |
| A borrowed-parameter write no longer escapes | 8 |
| The parameter address-taken check removed | 8 |
| The escape left set on a followed call | 7 |
| The argument position reversed | 4 |
| The callee entered with an unshifted selector | 4 |
| An undelivered aggregate no longer escapes | 4 |
| A crossed assumption no longer escapes | 4 |
| The sprite-pointer test removed | 4 |
| The placed-object test removed | 4 |
| Module ownership no longer checked where writes arrive | 4 |
| An address-taken result escapes instead of being followed | 1 |
| A returned value resumes at every call site | 1 |
| An aggregate escapes instead of being followed | 1 |
| The aggregate route forgets the invocation, in either delivery branch | 1 |
| The second displacement candidate removed (superseded by the residue) | 8 |

Two mutations fail nothing, and both are disclosed below rather than counted.

### Shapes measured beyond the oracle

| Shape | Result |
| --- | --- |
| Direct recursion through a parameter | rejected by the language, E10180 |
| Indirect recursion `a → b2 → a` | rejected by the language, E10181 — which is what makes a matched return chain terminate |
| Mutual composition `b2(x)` then `inner(b + 1)` | run `64+64` |
| Two call sites, displacements 0 and 2 | runs `0+64` and `128+64` |
| Cross-module call into another module's helper | run `0+64`, followed rather than escaped |
| One helper that both pokes and publishes its parameter | run `0+64` |
| A parameter passed on through two hops | run `0+64` |
| A reassigned scalar parameter | run `0+64`, its private copy followed exactly |
| An interrupt handler reading a module slot | whole object, the deliberate fallback |
| A block number poked to a constant address | no demand — and [#195](https://github.com/blendsdk/blend65/issues/195) is the hole that leaves |

## Disclosures

**Two branches no test can observe.** `enterParameter` escapes when the callee body or parameter
position cannot be resolved, and refuses to revisit a call site already on its path. No program
reaches either: every direct call's callee is indexed, including across modules, arguments align
one-to-one with parameters, and the language rejects both direct and indirect recursion (E10180,
E10181). The second guard exists because a forgotten hand-off reintroduced exactly such a cycle and
the compiler crashed rather than answering conservatively — the walk's termination should not rest
on a property of the source language holding.

**The host checkpoint reported unhandled rejections once.** The first run showed six unhandled
rejections and 281 of 282 files; three subsequent runs were 282 of 282 with exit 0. Not reproduced,
recorded rather than filed.

**Everything here is artifact-placement-verified.** Every test resolves a final address from public
debug metadata and checks the fetched bytes against the bank and the character-ROM window. No test
observes the chip fetching them, and a processor-side read cannot tell RAM from the character ROM the
chip sees. That is weaker than the `VICE-verified / hardware-unverified` status the rest of the VIC
surface carries, and it is filed as [#196](https://github.com/blendsdk/blend65/issues/196).

**Three routes keep the fallback.** An indirect call's arguments, module storage written in one body
and read in another, and a module initializer. The first needs a call-target proof; the other two
need the object-following capability #194 describes. #188 stays open for all three.

**The walk is 673 lines, above the 200–500 aim.** The obvious seam is the classification of
operations that receive a selector — around 200 lines and a coherent concern — but it calls back into
the walk it would be split from, so extracting it needs either a circular import or an injected
continuation. Neither is worth improvising at the end of a long unit, and it is recorded here for
whoever next changes this pass rather than filed as its own row.

**Seven issues carry what was not fixed here.** #193 and #194 are over-demands needing capabilities
beyond this unit; #195 and #198 are silent holes that predate it and need no call boundary; #199 is
a new over-demand; #196 is the emulator gap; #197 is the implementation-test split, which has
nowhere in the package to put a shared fixture.

## Verification shape

Impact: semantic inference, layout placement and one diagnostic cause. Directed impl tests and the
new oracle during implementation; install, build, typecheck and the complete owned tests at the
checkpoint; the affected VICE files, which are the sprite-pointer and VIC observer journeys; byte
identity across the three examples and three optimization goals.
