# A call to a function that never returns

> **Owner**: T-173 · **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Status**: Complete
> **Progress**: 4/4 tasks (100%)
> **Last Updated**: 2026-11-22

## Why

```
spin();
let i: byte = peek($C002);
i = i + peek($C003);
```

was refused, where `spin` loops forever. The program is legal: a function whose body never reaches
its own end never resumes its caller, so everything after the call is unreachable, and unreachable
code is not an error in this language. An expert expects this to compile and the arithmetic simply
never to run.

The refusal also depended on detail the program does not state. The same call followed by
`poke($C101, 11)` built; followed by an addition it did not. The call route decided it too: through
a pointer with two candidates it built, by name or through a pointer with one candidate it did not.

## The cause, which the arithmetic only exposed

The reported sentence named the storage binding stage, which sent the first reading of this at the
wrong stage. The measured diagnostic is sharper:

```
Machine flag proof did not complete for 'main'
  — the selected 'adc' has no proved producer for its decimal flag
```

A callee that cannot return summarizes as preserving nothing and returning nothing, which is
correct — there is no resumption to describe. The caller then applied that summary to the
instructions written after the call, erasing every flag including the two the language ABI
guarantees. Decimal is never established by local code, so an `adc` after such a call could never
find a producer. A store of a literal reads no flag, which is why only arithmetic exposed it.

So the flag proof was right and the generated control flow was wrong: the block being filled kept
an exit that execution can never take. The dispatch routes already answered this correctly by
giving a candidate that cannot return no executable edge; the route a program happens to use was
deciding whether it is accepted.

## What changed

| Site | Change |
| --- | --- |
| `machine/call-returning-facts.ts` | The non-returning test, previously local to the dispatch file, is now one documented helper the call routes share |
| `machine/lower-function.ts` | An ordinary call to such a callee closes the block it was filling as unreachable and resumes after it |
| `machine/lower-indirect.ts` | The single-candidate route, which calls one proved candidate by name, answers the same way |
| `services/debug-machine-ranges.ts` | The closed-off remainder is still its source block's own code, so the block/source map recognizes it |

The unreachable code itself is left where the author wrote it. Removing it is optimization, not
part of proving the program, and keeping it is what makes the repair cost nothing (below).

## Evidence

Measured by hash, every program compiled twice — once at the commit before the change and once
after — in `none` and `size`:

| Program | Before | After |
| --- | --- | --- |
| direct call, non-returning, arithmetic | **refused** | **663 bytes** / **107** in size |
| pointer to one, non-returning, arithmetic | **refused** | builds |
| direct call, non-returning, plain store | 634 / 88 | **byte-identical** |
| direct call, returning, arithmetic | 665 / 109 | **byte-identical** |
| direct call, returning, plain store | 636 / 90 | **byte-identical** |
| pointer to one, non-returning, plain store | 644 / 644 | **byte-identical** |
| pointer to one, returning, arithmetic | 675 / 665 | **byte-identical** |
| pointer to two, non-returning, arithmetic | 703 / 687 | **byte-identical** |

Exactly two measurements moved, and both are programs that were refused and now build. Twelve
controls are byte-identical by hash, including the directly affected path: closing a block adds no
instruction, so the remainder lands at the same address.

Three further shapes were probed and all build: the call inside a branch with arithmetic after the
join, the call inside a loop body, and a pointer whose candidates are mixed. None needed its own
change — removing the edge a call cannot take is what makes the join and the loop prove out.

## Tasks

- [x] **T-173.1 Specify.** A new oracle for the requirement that the call route and the kind of
      following work may not decide whether a legal program compiles. Red on the two refusing
      routes before any source change.
- [x] **T-173.2 Share the fact.** Extract the non-returning test from the dispatch file, so a
      third consumer does not become a third copy.
- [x] **T-173.3 Close the unreachable edge.** The ordinary call route and the single-candidate
      route, plus the block/source map that must still own the remainder.
- [x] **T-173.4 Verify.** The oracle, the suites nearest the change, and byte-identity by hash
      against the previous commit.

## Verification

| Check | Result |
| --- | --- |
| New specification oracle | **60/60** — 3 routes × 2 callees × 2 suffixes, in 4 optimization modes, plus check |
| Compiler package, machine and services | **125 files / 2,223 tests** |
| Root tier: all of rd04, the sibling non-returning oracle, both size frontier guards and the optimizer pair | **70 files / 951 tests** |
| Byte-identity controls | **12/12 identical by hash**; 2 refusals became builds |
| Existing tests that flipped | **one**, deliberately — below |

The full gate was not run: the change is confined to call lowering and the suites above cover the
oracles that pin its output. That is a narrower claim than a whole-corpus run and is recorded as
such.

## The guard that had to move

`test/rd04/machine-binding-refusal.impl.test.ts` used this very defect as its specimen for
checking that a compiler-stage refusal is located, names its instruction and says it reports a
limitation rather than a bad line. Repairing the defect left it with nothing to observe, and no
source program triggers that refusal any more — the plausible alternatives were probed, and the
status-save shapes are caught earlier by an ordinary diagnostic with its own span, which is correct
behavior rather than a specimen.

The properties it pinned are preserved rather than dropped, in
`services/machine-binding-diagnostic.impl.test.ts`, which judges the same refusal at the layer that
can still produce one. That code had no test of its own before, so the move adds coverage where
there was none. The one property that cannot survive the move — that check and build refuse a
program the same way — needs a program that still refuses, and returns with the located-refusal
work, which creates exactly those.

## Stop conditions observed

No specification file and no frozen oracle was edited. The new oracle judges acceptance only: it
does not pin the instruction sequence a call lowers to, nor where the unreachable remainder is
placed, because repeating those would make a correct change to either look like a regression. The
test stays one-way safe — an absent or unknown returning-body fact keeps the ordinary exit, so a
callee the compiler cannot summarize is treated as one that may return.

Observed and deliberately left alone: a function that loops forever still emits the `rts` of its
own unreachable exit block. That is dead code the compiler can see, in a different shape from this
one, and belongs with removing unreachable code rather than with proving it.
