# A saved status register is not a spent one

> **Owner**: [#182](https://github.com/blendsdk/blend65/issues/182) · **Type**: Task (lightweight)
> **CodeOps Artifact Schema**: 1
> **Status**: Complete; canonical reference unchanged by design
> **Progress**: 6/6 tasks in scope (100%)
> **Last Updated**: 2026-11-23

## What was wrong

The flag-death proof treats any instruction that reads a flag as an observer of
it, read straight off the processor facts rather than from a special case. `php`
reads all six. So a delivery whose successor was an interrupt-ownership prologue
kept a staging home it had no need for:

```asm
  sta $08c8        ; a temporary nothing else reads
  lda $08c8
  sta answer
  php              ; reads every flag
  pha
  sei
  …                ; vector restore
  pla
  plp              ; writes every flag back
```

The read is undone two instructions later. A `php` matched by its own `plp`
**preserves** the flags; it does not consume them. Nothing in that window tests
N or Z, and the `plp` writes both back from the saved byte, so whatever the
delivery left behind reaches exactly the place it would have reached without the
pair. Treating a save as an observation is sound, and coarse.

## The fact that was missing, and where it lives

`machine/status-save-window.ts` answers one question: given a `php`, which `plp`
restores it, and is the window between them clean? The window is deliberately
confined to straight-line instructions inside one block, which disposes of two
awkward questions at once — no path can reach the restore without the save, and
no path can leave the window with the saved byte still on the stack. Anything
wider refuses, which is the answer the proof already gave.

Inside the window, only `pha`, `php`, `pla` and `plp` may move the stack, and the
depth has to come back to the save's own byte exactly at a `plp`. Any other
instruction that reads or writes the stack pointer refuses: a call, a return, a
frame unwind. That also keeps this proof from interacting with the strict
treatment of `jsr` the previous session added.

`flagsDead` in `machine/optimization-cleanup.ts` steps **over** the window rather
than through it. Walking into it would be wrong twice over: the reads inside
would look like observations of the pair, and the writes inside would look like
replacements for a pair the restore puts straight back. Stepping over it and
carrying the same flags onward is the only reading that matches the hardware.

Nothing about the stack contents has to be proved. The conclusion the walk draws
is the conservative one — the pair is *still live* after the restore — so a saved
byte that something else overwrote would only make the answer safer, never less
safe. What the balance check buys is different: it guarantees the save's byte is
consumed by this restore and so cannot be restored again by a later one.

## Measured before anything was changed

Six witnesses, every optimization goal, bounds checks off and on, ACME 0.97, on
the four cooperative KERNAL PRG profiles. Each figure is a whole-image PRG size.

| Witness | Before | After | Saved |
| --- | --- | --- | --- |
| The issue's own: install, deliver, restore | 192 | 186 | 6 |
| The install prologue follows the delivery | 192 | 186 | 6 |
| One delivery each side of the restore | 219 | 213 | 6 |
| The installed handler branches internally | 207 | 201 | 6 |
| The delivery is in a callee under a handler | 196 | 190 | 6 |
| The caller saves the status register after a call | 196 | 190 | 6 |

Six bytes and eight cycles each, identical at `balanced`, `speed` and `size`, and
unchanged by bounds checking. Canonical `none` is byte-identical for all six.

The last two rows are the composition with the previous session's cross-return
walk: the delivery is in one body and the window in its caller, and both facts
have to hold for the result to be delivered.

Fourteen witnesses were generated as full assembly text from the compiler built
immediately before this change and diffed against the compiler built after it.
Exactly the six rows above differ, each by its six bytes; the other eight —
canonical `none` for every witness, a plain delivery with no handler at all, two
readers of the delivered byte, a delivery inside a loop, a run-time dispatch
candidate, an unresolvable next call, a boolean caller that branches on the flag
it is handed, and a body whose address is taken — are byte-identical.

## A premise in the issue that measurement corrected

The issue proposed, as the refusal to preserve, "a handler installed around a
delivery that is *not* restored on every path". That program does not exist: the
language rejects it outright with

```
E10278  Interrupt ownership for sink 'c64.system.setIRQ' is invalid at
        'program return' — installs and restores must agree on every path
```

so an unmatched save cannot be reached from accepted source at all. Every
generated save sits in one straight-line block with its own restore. The
window-kind refusals are therefore pinned in the unit file rather than the
oracle, exactly as the previous session's two unreachable barriers were. The
barriers hold for anything a later pass might construct, not merely for what
today's lowering emits.

## The two pinned answers that moved

Both were retention pins, and both pinned this filed limitation rather than a
required behaviour. That is the whole of the justification; the oracle rule
protects requirements.

`test/rd04/runtime-shift-result-delivery.spec.test.ts` carried
`should keep the staging home under an installed handler`. The issue named that
exact case in advance as the one the repair would move. It is now
`should deliver directly under an installed handler`.

`test/rd04/return-boundary-delivery.spec.test.ts` carried
`should keep the staging home where the caller pushes the status register`. The
issue could not have named it — that file was written a day later, by the session
this one follows, and its retention came from the same coarse rule this issue
reports. It is now
`should deliver directly where the caller saves and restores the status register`,
and it has become the stronger witness of the two: one program in which the
cross-return walk and the window skip both have to hold.

What that case was *for* — proving the cross-return walk stops at a caller-side
flag barrier — is unaffected. Three refusal cases in the same file still carry
it: a run-time dispatch candidate, a next call that settles no flag, and a body
whose address is taken. Each keeps its staging home and each is verified above as
byte-identical across this change.

Both edits are a renamed case and a flipped assertion. No source constant, build
option or helper in either file was touched, and the stale sentence in each
witness's doc comment was corrected to describe what the pair actually does. The
previous session's own record is left as written: its acceptance row was true
when it was written.

## Tasks

- [x] T-182.1 Measure the filed witness and five controls at all four goals, bounds off and on.
- [x] T-182.2 Establish which refusals are reachable from accepted source at all.
- [x] T-182.3 Author the window matcher as its own module.
- [x] T-182.4 Step the flag-death walk over the window instead of into it.
- [x] T-182.5 Author the four-profile oracle, proved red before the fix, and the unit cases.
- [x] T-182.6 Compiler, host and root checkpoints.

## Acceptance

| Area | Oracle |
| --- | --- |
| The restore follows the delivery | `sta b65_Game_answer_`, no staged pair |
| The install prologue follows the delivery | delivered directly |
| One delivery each side of the restore | both delivered directly |
| The window is reached through a return | delivered directly, body still ends `rts` |
| Whatever the handler's own shape is | delivered directly |
| Every optimized goal | `speed` and `size` deliver the same way |
| Bounds checks on | the same delivery, measured not assumed |
| Canonical reference | `none` still stages the result |
| Ownership bookkeeping | both windows still `php, pha, sei … pla, plp` with two vector writes |

## Verification

| Tier | Result |
| --- | --- |
| Oracle red before the fix | 36 failed / 80 passed across the three files — every failure a delivery case, every pass a retention or reference control |
| `test/rd04/status-save-window-delivery.spec.test.ts` | 36/36 on four profiles |
| `test/rd04/runtime-shift-result-delivery.spec.test.ts` | 36/36 with the one moved case |
| `test/rd04/return-boundary-delivery.spec.test.ts` | 44/44 with the one moved case |
| `status-save-window.impl.test.ts` | 13/13, every guard proved load-bearing by removal |
| Compiler machine tier | 92 files / 1,288 |
| Compiler package, every tier | 266 files / 4,482 passed, 2 skipped |
| Root host tier | 274 files / 5,801, green on the first run |

The four shared frontier guards for this run of sessions were run against the
built compiler before anything else: `test/rd05/input-acquisition-output`,
`test/rd05/input-saved-query-output` and `test/rd08/optimizer-acquisition-output`
at 20 cases on the host tier, and `test/rd08/optimizer-saved-output` at 17 on the
VICE tier, which includes its byte-exact payload pins and its behavioural
endpoints under the emulator.

Each window guard was removed in turn and failed exactly its own cases:

| Guard removed | Cases that failed |
| --- | --- |
| Save-opcode check at the start index | the index that is not a save |
| Live-flag read inside the window | the read of either flag; the nested save |
| Stack-pointer refusal | the six other stack-pointer instructions |
| Restore-opcode check at depth zero | the pull that consumes the saved byte |

The fifth barrier — a block that ends before the restore — is the function's own
fall-through answer and has no guard to remove; its case is pinned alongside the
others.

## Note on file size

`machine/optimization-cleanup.ts` was already past the 700-line guidance before
this session and is 1,109 lines after it. The window matcher was given its own
module partly for that reason, and partly because it is the kind of fact worth
testing directly. Splitting the cleanup pass itself remains unaddressed and is
recorded here rather than acted on.
