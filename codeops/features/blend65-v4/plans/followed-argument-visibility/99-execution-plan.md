# Follow a block number across a call argument, and close what the fallback never covered

> **Owner**: T-188 (#188) · **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Status**: Planned
> **Progress**: 0/6 tasks (0%)
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
| 2 | Specification oracle, authored implementation-blind, with meaningful RED | ☐ |
| 3 | Escape a selector held in an address-taken object, or written through a borrowed parameter | ☐ |
| 4 | Escape a result an indirect call can receive | ☐ |
| 5 | Follow a direct call's argument into the callee's parameter reads | ☐ |
| 6 | Verification, reviews, record and roadmap | ☐ |

## Verification shape

Impact: semantic inference, layout placement and one diagnostic cause. Directed impl tests and the
new oracle during implementation; install, build, typecheck and the complete owned tests at the
checkpoint; the affected VICE files, which are the sprite-pointer and VIC observer journeys; byte
identity across the three examples and three optimization goals.

Mutations that must each fail a case: the escape left set on a followed call, the callee entered with
an unshifted selector, the argument position ignored, the address-taken guard removed, the borrowed
parameter rule removed, the indirect-return escape removed, and an unresolvable callee no longer
escaping.

Every case must land inside the character-ROM window when its own rule is mutated away. Several of
these shapes are green before and after this unit, so the mutation is their only proof, and a layout
that happens to be visible would leave them proving nothing. The padding the existing oracles use —
2,400 uninitialized bytes ahead of the object — is what exposes it; an initialized pad moves the
object past the window and hides the defect.
