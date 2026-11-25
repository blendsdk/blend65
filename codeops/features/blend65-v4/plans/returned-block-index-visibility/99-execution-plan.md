# A block number the helper computed and the caller published

> **Owner**: T-178 (#178) · **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Status**: Delivered and verified; two reviewer majors stay open as #189, whose repair is the
> user's release call
> **Progress**: 8/8 tasks (100%)
> **Last Updated**: 2026-11-25

## Why

```blend65
module Game;
let pad: byte[2400];
let buffer: byte[64];
function blockOf(): byte { return lo(&buffer / 64); }
function main(): void { pad[0] = 1; c64.vic.setSpritePointer(0, blockOf()); }
```

`buffer` landed at `$1400`. Inside `$1000-$1FFF` the video chip reads character ROM instead of
the RAM underneath, so the sprite displays character shapes, and the program builds without a
word. The compiler picked that address; nothing in the program asked for it. A home the hardware
cannot read is the compiler's own mistake, which is why this is a placement fix and not a
diagnostic.

The previous unit proved the three publishing shapes that stay inside one function. This is the
fourth, and the walk stopped at the edge of the body that did the arithmetic.

## The fix

The pass already recorded two demands against the object: 64-byte alignment from the shape of the
expression, and VIC visibility from proof that the chip receives the value. Only the second is
consumer-gated, and only the second crosses a boundary. It now does: a value handed back by a
`return` resumes at every call site that receives the result, walked by the same function that
walks the rest of the derivation.

Recursing with the same walk is what makes the other shapes fall out rather than needing cases of
their own — a second helper passing the first one's answer on is the same question asked twice,
and a caller that names the result before publishing it is the store-and-load the walk already
followed.

Measured on `c64-pal-prg-kernal-6581`, with `pad` sizing the layout so the object does not simply
fit below the window:

| How the block number is published | Before | After |
| --- | --- | --- |
| Straight into the call | `$2000` | `$2000` |
| Returned by a helper | **`$1400`** | `$2000` |
| Returned through two helpers | **`$1400`** | `$2000` |
| Returned, then held in a local | **`$1400`** | `$2000` |
| Returned, then stored in a module variable | **`$1400`** | `$2000` |
| One VIC call site among several | **`$1400`** | `$2000` |
| Returned, no VIC consumer | `$1400` | `$1400` |
| No consumer at all | `$1400` | `$1400` |

The last two rows are the point of the exercise as much as the first six. `poke($C000, blockOf())`
is ordinary address arithmetic, and confining its object because of how the author divided a
number is a restriction on ordinary code that both tracker issues explicitly forbid.

## Two shapes no source program can express, and what they decided

Neither is reachable from source, and both are the reason the implementation looks the way it
does. They are built directly in the impl tests, because there is nowhere else to build them.

**A value identity is unique only inside its own body.** The operation contract says so, and the
current producer happens to qualify every identity with the body that owns it — so the hazard is
invisible at run time today and would arrive silently if that ever changed. One shared set of
walked values would treat a second body's `v0` as already walked and answer that nothing reaches
the chip. That answer is not merely wrong, it is wrong in the direction that leaves a sprite
reading character ROM, so the walked values are remembered per body.

**A call cycle terminates only because of the re-entry guard.** Direct and mutual recursion are
refused before lowering (E10180, E10181), so a cycle reaches this pass only from inside the
compiler. The first cycle case written for it proved nothing: an answer of *reaches the chip* is
final the moment it is found, so the walk succeeded before the cycle closed. Removing the guard
left it passing. The case that earns its place is a cycle that publishes nothing, where the walk
has to exhaust the loop instead — without the guard that one overflows the stack.

## What review found, and the attribution I got wrong

Four reviews ran — correctness, semantics, platform and host cost — and two of them landed defects
in this seam. I first recorded both as predating the unit and merely extended by it, having
reproduced each one **inline**, with no helper and no return. For the walk itself that holds. For
the *acceptance* consequence it does not, and the measurement I had not taken is the one that
decides it: the inline counterpart being refused before says nothing about whether the helper
route built. It did.

### The acceptance regression this unit caused

Measured on `c64-pal-prg-kernal-6581`, `0596547a` being the commit immediately before this unit:

| Program | Before | After |
| --- | --- | --- |
| 9,000-byte array published as a sprite block through a helper | **built** at `$0A80` | **E10273** |
| 9,000-byte array, overwritten variable, through a helper | **built** at `$0AC0` | **E10273** |
| 9,000-byte array published through a conditional, no helper | **built** at `$0AC0` | **E10273** |
| 9,000-byte array published inline | E10273 | E10273 |
| 9,000-byte array, overwrite shape inline | E10273 | E10273 |
| 8,193-byte array used only as a border colour, through a helper | built | built |
| 8,193-byte array, the same inline | **E10273** | **built** |

Three legal programs are refused that compiled before this unit, and one is accepted that did not.
Widening a proof whose demand cannot always be satisfied is what did it, and filing the defect
does not undo it. #189 owns the repair and leads the remaining order; the correctness review's
wording for this is the one to keep — pre-existing imprecision caused newly introduced refusals
when the traversal widened.

### How wide the regression actually is, measured — and it is not narrow

The semantics review argued the class is larger than my witnesses suggested, because demanded
objects compete for the visible intervals. It was right, and my first attempt to refute it was a
vacuous probe: three 4,000-byte arrays with one 64-byte sprite block placed that block at `$3980`
before and after, but the never-published control landed at `$3980` too, so the demand never bound
anything in that layout and the measurement showed nothing.

The probe that does bind is two **demanded** objects. `$2000-$3FFF` holds 8,192 bytes and
`$0200-$0FFF` holds 3,584, so two 5,000-byte sprite sources cannot both be visible as whole
objects even though RAM is ample:

| Program | `0596547a` | HEAD |
| --- | --- | --- |
| Two 5,000-byte blocks, published through their own helpers | **built**, `$0AC0` and `$1E80` | **E10273** |
| Two 5,000-byte blocks, published inline | E10273 | E10273 |
| Two 5,000-byte blocks, never published | built | built |
| One 5,000-byte and one 3,000-byte block, through helpers | built, `$0AC0` and **`$1E80`** | built, `$2000` and `$33C0` |

Neither object is larger than an interval, so the bound I claimed — "objects past 8,192 bytes" — is
**wrong**, and the record said so before this measurement existed. Two 5,000-byte sprite sources
are ordinary game data, roughly 78 frames each. That is the real exposure.

The last row is the same measurement cutting the other way, and is worth as much: before, the
second object was placed at `$1E80`, inside the character-ROM window, with a silently invisible
sprite and a successful build. Now both are visible. So the widening fixes real silent defects in
exactly the layouts where it can also refuse — which is why the repair is #189's block-scoped
demand rather than a retreat: two 5,000-byte objects each need only their own 64 bytes visible, and
that fits with room to spare.

A fourth witness came from the platform audit and is the same class with a different cause:

```blend65
let buffer: byte[8193];
function blockOf(): byte { return hi(&buffer / 64); }
function main(): void { c64.vic.setSpritePointer(0, blockOf()); }
```

`hi(address / 64)` is in `0..3`. It selects a block in `$0000-$00FF`, not this buffer at all — the
walk follows any unary operation and claims provenance it has not got. Built at `0596547a` through
the helper, refused now. The inline form was already refused, so the false provenance predates
this unit and the refusal through a helper does not.

My first disposition was to ship on the argument that the refused shapes were unusual. The
measurement above retired that argument, so the decision goes to the user with the ledger rather
than being settled here. Two bounds were considered and neither works: dropping a demand the
object cannot satisfy misses this case entirely, because each 5,000-byte object satisfies the
demand alone and only the **set** of them does not, and dropping an inferred constraint after a
layout failure restores acceptance without proving the output is right. What does work is #189 —
carry the effective address and the fetched extent instead of collapsing to a region on the object
root — which makes every refusal above build *and* be visible.

### The walk did not follow a join

```blend65
c64.vic.setSpritePointer(0, peek($0400) == 0 ? lo(&buffer / 64) : 0);
```

`$1400`, with no function boundary anywhere in it. A value arriving at a join is the join's value
on the path it came from, so one incoming edge is enough: a sprite the chip cannot see on some
frames is still a sprite it cannot see. Four conditional shapes were measured, all four now land
at `$2000`, and the oracle covers three of them across four profiles.

### Namespace membership is not a fetch

The proof matched **any** argument of **any** `c64.vic.*` capability. Of the twelve in that
namespace, one argument of one capability is a block number: `setSpritePointer`'s second. The four
address-taking selectors prove their own bank, window and alignment when they are lowered and
never receive this quotient. Everything else is a number — a colour, a position, an enable mask,
and the sprite index sitting right beside the block number in the same call.

This was not cosmetic. An unnecessary demand is mandatory downstream, and the largest interval
satisfying it is 8,192 bytes, so an object past that size had no legal home at all:

| Program | Before | After |
| --- | --- | --- |
| 8,193 bytes, number used only as a border colour, through a helper | **E10273** | builds |
| 8,193 bytes, the same inline | **E10273** | builds |
| 8,193 bytes, quotient passed as the sprite *index* | **E10273** | builds |

The error they were refused with reads *change or remove the explicit constraint*. There was no
explicit constraint; the compiler inferred one. The oracle guards the acceptance — those programs
must build — and nothing more: it reads a diagnostic only when a build fails, so the wording is not
pinned. Repairing the message belongs to #189.

### Two comments that were false, not merely awkward

Both the issue text and this code claimed an unnecessary demand can never decide whether a program
is accepted. The measurement above is the counterexample. The comments are corrected rather than
reworded, and the claim does not reappear anywhere in this record.

### What is still wrong, and now has an owner

**#189**, filed with measurements: two causes of an impossible inferred demand remain. The demand
constrains the whole object when the chip fetches one 64-byte block of it — a 9,000-byte array
whose sprite block would fit perfectly is still refused — and a definite overwrite between a write
and a read is not noticed, so a value that provably never reaches the chip can impose the demand.
Both reproduce inline. The misattributing diagnostic is part of the same issue.

**#188**, the four crossings. Both the semantics reviewer and the platform auditor independently
ranked the argument form the worst developer-facing gap of the four, which is recorded on the issue
so the row is not prioritized on shape count.

### The evidence finding, adopted

The correctness review called the "each of nine cases proved non-vacuous" claim an overstatement,
since two controls had no mutation cited. It was right, and the answer was to produce the evidence
rather than to weaken the sentence: forcing every block index visible fails exactly the
counter-cases, and forcing none visible fails exactly the positive ones. It was right a second
time in the same place — the matrix I first quoted had been measured before the two
argument-position cases and the caller index existed, so it was stale. The matrix below is the
complete re-run against the delivered code.

A claim about that caller index was also wrong and is corrected in the code rather than in prose:
it said the index cost no extra pass, while definitions and call sites were in fact scanned
separately. They now come out of one traversal, which is what the comment always claimed.

## A host-cost improvement that came with it

The visibility walk used to run for **every** result-producing operation, before anything had
decided the operation was a block index. It now runs only after `completeSelector` or
`blockDemand` has recognized one. Block indices are rare, so the common path got cheaper at the
same time as the proof got wider — the reorder is otherwise behaviour-free, and the complete rd04
tier confirms no answer moved.

A scaling risk arrived with the widening and is now closed. Caller discovery rescanned every body
per query, so the audit's worst realistic input — 64 selector arms, 64 helpers returning their
answer, a 5,000-operation program — had it inspecting roughly 20.8 million operation entries per
build. Call sites are now indexed by callee, built inside the one traversal that already indexes
each body's definitions, so the multiplier is gone and no extra pass over the program was added.
The audit found no memory concern in retaining the per-body definition maps.

## What is still invisible, measured rather than assumed

Four crossings remain unproved. All four still land at `$1400`, and they are filed as **#188**
with the measured addresses rather than left implied:

| Shape | Why it is not more of this work |
| --- | --- |
| Passed as an argument into the publishing function | The mirror direction: the question resumes at the callee's parameter, with argument-position bookkeeping of its own. This unit shaped the walk so it is additive |
| Published from a module initializer | An initializer is a body with no caller to resume in |
| Stored in one function, read in another | Neither direction: the store-to-load match is deliberately per body, so the write and the read are never connected |
| Returned through an indirect call | No resolved callee at this stage, so there is nothing to continue into |

The argument form is the one a developer is most likely to write, which is recorded on #188 so the
row is not prioritized on shape count alone.

## Tasks

- [x] **T-178.1 Measure the real behaviour.** Eight publishing shapes against the bank and the
      character-ROM window, before touching anything, rather than inheriting the issue's framing.
- [x] **T-178.2 Oracle, authored independently and implementation-blind.** Four profiles, the
      repro, the no-consumer counter-case and the explicit-placement contract.
- [x] **T-178.3 Follow the value out through the return.** Bodies that carry their own
      definitions, and a walk that resumes at every call site.
- [x] **T-178.4 Settle the two unreachable shapes.** Per-body walked values and the re-entry
      guard, each pinned by a case that fails when the implementation is mutated.
- [x] **T-178.5 Verify, and measure the emitted bytes rather than argue them.**
- [x] **T-178.6 File what is still invisible.** #188, with addresses.
- [x] **T-178.7 Disposition three independent reviews.** Two defects adopted and fixed after
      reproducing each inline, one evidence finding answered with the missing mutations.
- [x] **T-178.8 Close the scaling risk the widening introduced.** Call sites indexed by callee.

## Verification

| Check | Result |
| --- | --- |
| Returned-value oracle, RED against the baseline pass | **8 of 12 failed** — four profiles at `$1400`, and the counter-case because neither build moved. The four explicit-placement cases pass before and after, which the author flagged as an existing contract rather than a vacuous case |
| Conditional oracle, RED against the state the reviews audited | **24 of 24 failed**, for three distinct reasons: twelve invisible placements, eight `E10273` refusals and four counter-cases that had not moved |
| Both oracles, after | **12/12** and **24/24**, four profiles each — 24 being twelve conditional-placement cases, eight acceptance cases and four counter-cases |
| Affected VICE tier, targeted and sequential | **166 tests**, four files: the relocated-screen sprite-pointer emulator case, the VIC observer suite (132), VIC collisions (16) and the optimizer saved-output frontier guard (17) |
| Impl cases | **35**, 14 of them new: nine source shapes, two counter-cases and three the compiler alone can build |
| New cases non-vacuous | **Complete mutation matrix**, below |
| rd04 complete | **128 files / 1,826 tests** |
| Compiler package | **267 files / 4,558 tests**, 2 skipped (the Windows-only emulator cases) |
| Root host tier | **280 files / 5,977 tests**, zero errors |
| No emitted byte change | **Measured after each change**: three examples × three goals, SHA-256 of each PRG against the recorded baseline, **9/9 identical** every time — no example publishes a block number through a helper or a conditional, so there was nothing for this to move |

The byte-identity result is reported as a fact, not as a success criterion. This change exists to
move data; an example whose hash had changed would have been a finding to explain, not a
regression. The platform audit's caution is worth keeping attached to it: nine unchanged controls
prove those nine controls, not that affected output is identical, and nothing here is runtime or
hardware proof. The status remains `VICE-verified / hardware-unverified` at best for the fetch
behaviour itself, and these oracles check placement in public debug metadata rather than displayed
pixels.

### Mutation matrix

Re-run against the delivered code, with the tests untouched and one mutation applied at a time.
Thirty-five cases in the file, fourteen of them new.

| Mutation | Cases it fails |
| --- | --- |
| Pool the walked values into one set | 1 — the per-body identity case, and nothing else |
| Remove the re-entry guard | 1 — the publishing-nothing cycle, and nothing else, with a stack overflow |
| Stop the walk at the return | 7 |
| Do not follow a join | 2 — the conditional cases |
| Restore the namespace-prefix consumer test | 2 — the two argument-position cases |
| Treat every block index as visible | 4 — the counter-cases |
| Treat no block index as visible | 9 — the positive cases |
| Stop scanning initializer bodies | 1 — the initializer alignment case |
| Index call sites in functions only, leaving initializer bodies scanned | **0** |

Every one of the fourteen new cases is failed by at least one mutation, and the six structural
mutations each fail only the cases that exist to guard them.

The last row is reported because it found nothing, and the row above it is why the distinction is
worth drawing. An initializer's own arithmetic does prove alignment, and a case now pins that. Its
*call sites* are indexed only because initializers are bodies like any other, and nothing
distinguishes that choice: publishing needs a statement, an initializer binds an expression, and
the route that would make it observable — a module variable written in one body and read in
another — is exactly the hole #188 owns. The generality is one shared loop rather than extra code.

## Deliberate departures worth stating

Two things in this unit were done knowingly and are better said than found.

**The conditional oracle grew before it was first run.** Its author wrote four cases; the platform
audit then produced the acceptance counterexample, and two more cases were added to the same file
in the same authoring session, before any run and before the file was committed. An oracle freezes
when it lands, so extending one still being authored is not an edit to a frozen answer — but the
sequence is worth recording rather than leaving for a later reader to reconstruct.

**Both oracles were authored implementation-blind and verified by me.** The author never ran them;
I own every execution figure here, as the dispatch contract requires.

**One commit message described work it did not contain.** `10361d10` says the definition and
call-site indexes were merged into one traversal. They were not: a `git checkout HEAD --` while
measuring an unrelated counterexample silently reverted that edit before the commit, so the commit
carried only the record updates. The restructure landed afterwards, in its own commit, and this
note stays because the earlier message is in the history either way.
