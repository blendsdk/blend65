# A block number the helper computed and the caller published

> **Owner**: T-178 (#178) · **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Status**: Complete; three independent reviews dispositioned, two further issues filed
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

## What review found, and why reproducing it mattered

Three reviews landed two defects in this seam that the delivered unit did not cause but did
extend. Reproducing each one **inline** — no helper, no return — is what settled attribution, and
it changed the response: a defect this unit merely gave more routes to is still a defect in the
code this unit touches, which the prime directive says not to propagate for the sake of
consistency.

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
explicit constraint; the compiler inferred one. The oracle quotes that message, so it cannot be
lost again.

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

### The one finding refuted

The correctness review called the "each of nine cases proved non-vacuous" claim an overstatement,
since two controls had no mutation cited. It was right about the evidence and the answer was to
produce the evidence rather than to weaken the sentence: forcing every block index visible fails
exactly the two counter-cases, and forcing none visible fails exactly the nine positive ones. The
matrix below now covers all thirteen new cases.

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
| Both oracles, after | **12/12** and **24/24**, four profiles each |
| Impl cases | **34**, 13 of them new: eight source shapes, two counter-cases and three the compiler alone can build |
| New cases non-vacuous | **Complete mutation matrix**, below |
| rd04 complete | **128 files / 1,826 tests** |
| Compiler package | **267 files / 4,557 tests**, 2 skipped (the Windows-only emulator cases) |
| Root host tier | **280 files / 5,977 tests**, zero errors |
| No emitted byte change | **Measured after each of the three changes**: three examples × three goals, SHA-256 of each PRG against the recorded baseline, **9/9 identical** every time — no example publishes a block number through a helper or a conditional, so there was nothing for this to move |

The byte-identity result is reported as a fact, not as a success criterion. This change exists to
move data; an example whose hash had changed would have been a finding to explain, not a
regression. The platform audit's caution is worth keeping attached to it: nine unchanged controls
prove those nine controls, not that affected output is identical, and nothing here is runtime or
hardware proof. The status remains `VICE-verified / hardware-unverified` at best for the fetch
behaviour itself, and these oracles check placement in public debug metadata rather than displayed
pixels.

### Mutation matrix

Each mutation was applied to the implementation alone, with the tests untouched.

| Mutation | Cases it fails |
| --- | --- |
| Pool the walked values into one set | the per-body identity case, and nothing else |
| Remove the re-entry guard | the publishing-nothing cycle, and nothing else — with a stack overflow |
| Stop the walk at the return | the six boundary-crossing cases |
| Do not follow a join | the two conditional cases |
| Treat every block index as visible | the two counter-cases |
| Treat no block index as visible | all nine positive cases |

Every one of the thirteen new cases is failed by at least one mutation, and the first four
mutations each fail only the cases that exist to guard them.
