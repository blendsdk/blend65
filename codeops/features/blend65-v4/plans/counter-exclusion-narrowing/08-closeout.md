# Counter exclusion narrowing — closeout

> **Owner**: T-39 · **CodeOps Artifact Schema**: 1
> **Status**: Complete · **Last Updated**: 2026-11-21
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Predecessor**: [word-assignment-forwarding](../word-assignment-forwarding/99-execution-plan.md)

## What shipped

A loop counter is now forwarded — its advance computes directly into its declared home — once its
loop's exit test compares against a literal **above** the range counter narrowing can claim. The
previous slice excluded every variable a loop controls, which was necessary but broader than the
thing it protected.

| Shape | Before | After |
| --- | --- | --- |
| `for (let i: word = 0; i < 100; i += 1)` update | 11 instructions, incl. a four-instruction copy | **7 instructions**, in place |
| Cost per site | — | **−12 bytes, −16 cycles** |

The emitted form is the lowering casebook's canonical word-add with an in-place result and an
immediate operand: `lda lo · clc · adc · sta lo · lda hi · adc · sta hi`.

## The threshold is load-bearing, and now measured as such

The open question from review was whether over-releasing merely forfeits a saving or actively
fights narrowing. It fights. With the extent protection disabled — narrowing itself untouched — the
saved-input fixture lands on **exactly 2,018 bytes**, the original regression figure, against **701**
with the protection in place.

That is why the limit is no longer written down twice. It is exported once from the loop facts as
`FIXED_LOOP_MAX_BOUND` and imported by this decision, so the two cannot drift. Had narrowing been
widened while a copy of its limit stayed behind, the result would have been the 2,018 outcome.

## Safety argument as implemented

One implication, in one direction: a literal above the published bound means narrowing cannot fire,
so there is no cheaper representation to protect. The converse is never asserted.

| Property | How it holds |
| --- | --- |
| Evidence is structural | Read off the blocks, never from loop facts, which are empty in this pass — the mistake that defeated two earlier attempts in this area |
| Only the canonical shape is read | A whole unsigned-word load on the left and a literal on the right, mirroring the loop facts' own recognizer. `i <= 99`, `100 > i`, `i < limit` and `i - j < 100` all yield nothing |
| Extents are credited to one counter | The named counter only. Every other variable a test mentions is recorded with no extent, which protects it |
| Combining is strictest-wins | A root is released only if every signal that nominated it carries a readable extent above the bound |
| The backstop is a backstop | The block-final latch nomination stands down for a root this edge's test already named, because every loop form builds its condition block before its body and update, so a loop can never reach the backstop without its own test having been offered first |

## Reviews

Two independent lenses. **0 critical.**

| Lens | Result |
| --- | --- |
| Correctness and maintainability | 0 critical, **2 major**, 4 minor |
| 6502 machine code | 0 critical, 0 major, 3 minor |

### The majors, both repaired

**Documentation detached from the exported function.** Moving the new helper clear of one
function's documentation put it between the *exported* function's documentation and its
declaration, so the export became undocumented and a stale example described a four-argument call
against five parameters. The same mistake, made twice in a row, in two different places. Fixed, and
the example corrected.

**The documented recognizer was not the implemented one.** The comment claimed only narrowing's
canonical shape is read, with the counter on the left — but nothing inspected the left operand, and
the literal was handed to every variable the test mentioned. In `i - j < 100` both variables were
credited with an extent narrowing would consult for neither. Not exploitable, because the combining
rule caught each root at its own header, but the stated guarantee was not the real one, which is the
third time this file has been corrected for exactly that. Fixed by requiring a whole unsigned-word
load on the left and crediting that counter alone.

That repair **simplified** the design: once the named counter is credited directly, no extent has to
travel down the walk at all, so the walk carries none — which also dissolved a composite visited-key
a reviewer had flagged as collision-prone.

### Minors applied

| Finding | Disposition |
| --- | --- |
| The limit duplicated narrowing's own `8` with no mechanical link; raising narrowing's bound would wrongly release with no test failing | **Fixed** — one exported constant, imported here |
| The backstop comment overstated its veto, and the block-order premise it rests on was unstated | **Fixed** — both stated plainly |
| The composite visited-key could collide on a separator | **Dissolved** by the major repair |
| The two new controls asserted a whole-program move inventory, which an unrelated change could satisfy | **Fixed** — exact payloads pinned beside the counts, and the two pins differ by exactly the twelve bytes saved |

### Confirmed independently by the machine-code lens

- **−12 bytes and −16 cycles** per site reproduced on its own probe in all four modes, with the
  assembly diff isolating the whole delta to the update block.
- The flag contract is **indistinguishable**, not merely compatible, and for every released shape
  rather than one: `C`, `N`, `Z`, `V`, `D`, `A`, `X`, `Y` and `S` all end identically, because the
  removed tail's final `lda` reloaded the very byte the high `adc` had just stored. The exit test is
  flag-self-contained — its `cmp` establishes the carry its `sbc` consumes — so nothing downstream
  can observe a difference.
- The early-write hazard is safe at identity: the write touches offset 0 and the later read offset 1.
  A shifted overlap is impossible because every declared home is live at every position of its
  function, so allocation can never lay two across each other.
- **No zero-page opportunity is forgone.** Word homes are never zero-page candidates, so every
  removed pair is absolute — six bytes, never four — in every mode.

## Corrections to the record

| Item | Correction |
| --- | --- |
| The predecessor's closeout sized `x = x ± const` at about three bytes with no oracle change | Wrong. The saving is real, but a relative branch exists in this architecture only as a block terminator and value lowerings return a flat instruction list, so it needs a value-lowering contract change or a post-lowering splitting pass. The review adds that it cannot ride on this slice's flag argument either, since `INC` cannot reproduce the released form's flags |
| The zero-page citation in that closeout | The file is `storage/inventory.ts`, not `machine/inventory.ts` |

## Verification

| Check | Result |
| --- | --- |
| Impl controls, including three new review-requested cases | **8/8** |
| Frozen shape oracle, blob untouched | **20/20** |
| Frozen emulator oracles plus the new behavioural test | **14/14** |
| Neighbours pinning exact bytes or whole-PRG digests | **9/9** |
| Compiler package | 260 files / **4,364 passed**, 2 skipped |
| Cliff fixture, all four modes | 2159 / 701 / 701 / 701 — unchanged |
| All seven examples, all four modes | **byte-identical**, before and after the review fixes |

One oracle expectation was re-baselined under explicit authorization: `Q-P15` pins `Game.render`,
whose thousand-iteration counter is released, so its payload went from 383 bytes to **371**. Every
behavioural value in that expectation is unchanged and still passes — the blobs and their hashes,
the conflict count, the final screen, colour and bitmap bytes, and the four VIC registers. Only the
cost witness moved, and downward. The same number had been re-baselined once before, from 385 to
383, for a post-layout fold.

## Process notes worth keeping

- The slice was pushed after only the compiler package reported green. The failing oracle lives in
  the root tier, a different corpus, and was already red at that point. **Both corpora have to
  report before pushing**, not the faster one.
- The gate was running while review fixes were being written, which invalidated that run. Source
  edits and a full run cannot overlap.
- A test edit that anchored on `});` matched inside an `expect` call rather than at the end of the
  file and broke the suite's syntax. Restoring from the index and re-applying against an
  end-of-file anchor was faster than repairing it in place.
