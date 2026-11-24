# A refusal that names the instruction storage binding could not bind

> **Owner**: T-177 · **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Status**: Complete for its three producers; three independent reviews dispositioned
> **Progress**: 6/6 tasks (100%)
> **Last Updated**: 2026-11-24

## Why

```
error[COMPILER_INCOMPLETE]: The machine storage binding stage is not complete for this program
```

Two of the five `bindMachineProgram` refusals still produce that sentence and nothing else. On a
C64 there is no debugger, so a refusal naming neither a file nor a construct leaves nothing to act
on and nothing to report — the same reasoning that justified locating the first two.

The two differ in kind, and the difference decides the work. One can be located and simply was
not. The other refuses the whole certificate, so there is no construct to name at all, and its
answer is an explicit record plus the one location it can honestly offer.

## The three producers that still report nothing

Line numbers as of `185c9d24`.

| Site | Reason | Carries | Answer here |
| --- | --- | --- | --- |
| `bind.ts:655` | `certificate` | — | Recorded: nothing to name; reported against the project |
| `bind.ts:659` with an empty identity | `invalid-storage` | — | Same channel; reported against the project |
| `bind.ts:695` | `invalid-storage` | — (a function failed binding) | **Located** |

The middle row is new to this record. `validateHomes` returns `""` when the certificate
disagrees with the program as a whole — a wrong inventory hash, a wrong profile identity, a home
count that does not match the request count — and that empty identity produces a refusal with no
demand and no defect, exactly like the certificate marker. Unlike the marker it is reachable
through the real binder without forging a certificate, which is what makes the defect-free service
branch testable at all. That is a narrower claim than an earlier version of this record made: the
failed-function site is reachable through the binder too, as its own cases show. What this one is
alone in being is reachable *and* construct-less.

## What the failing function already knows

`bindFunction` returns `null`, and three different checks produce that null:

| Check | What it means |
| --- | --- |
| `resolveHome` finds no home | the instruction names storage the certificate gave no home |
| `resolveHome` rejects the offset | the byte named is not part of the storage that was allocated — past its end, negative, or not a whole number of bytes |
| the indirect guard in `bindInstruction` | the pointer begins at `$xxFF`, where this processor takes its high byte from the start of that same page |

All three are collapsed into one `null` today, and the `missing` check one line earlier has
already proved every *required* demand has a home — so "no storage home was selected" would be the
wrong sentence for most of them. The reason reported must be the check that actually fired.

The third is not a missing home at all. It is the 6502 indirect page-wrap, and naming it is worth
more than the other two, because it is the only one that identifies a specific hardware rule the
generated code broke rather than a bookkeeping disagreement. Two reviewers rejected an earlier
version of this sentence that called it the fault an author could resolve by moving the object:
the compiler chose that address, so that is not the author's placement to change.

So the repair threads the failed check outward instead of guessing it, and the site it reports is
the instruction itself — block label, opcode and the span that selected it — which is the evidence
channel the validator refusal at `:711` already uses and the service already formats.

## What the certificate refusal can and cannot do

`StorageClosureCertificate.closed` is the literal type `true`, a marker preventing a partial
record from masquerading as a certificate. Reaching `!certificate.closed` therefore means binding
was handed a record that is not a certificate, and no demand, function or instruction is
implicated. There is nothing to name, and inventing a construct would be worse than naming none.
The guard stays, because a runtime guard against a forged record costs one test and protects the
whole stage.

What it can do is point somewhere. `services/machine-binding-diagnostic.ts:51-56` returns the
unlocated sentence with a `null` span while discarding `failure.fallbackSpan` — which all three
callers in `services/size-selection.ts` already supply as the main function's span. The located
branch consults it; the unlocated one does not. So the program-scoped sentence stays and gains the
caret and the "not an error on this line" clause the located refusals already carry.

## Tasks

- [x] **T-177.1 Settle the scope from the code.** Three producers, current line numbers, the three
      distinct nulls behind the failed-function site, and why the certificate marker cannot name a
      construct.
- [x] **T-177.2 Author the cases and record red.** Driven through the real `bindMachineProgram`,
      with no cast forging a certificate: the three faults, a startup variant, and the empty-identity
      refusal for the fallback span.
- [x] **T-177.3 Thread the failed check outward.** Each null says which check produced it, through
      the private resolve/bind helpers, so the reason reported is the one that fired.
- [x] **T-177.4 Locate the failed-function refusal.** Build defect evidence from the failing
      function, its block and the instruction that could not bind.
- [x] **T-177.5 Stop discarding the fallback span.** The unlocated branch points where it is told,
      with the wording the located branch uses.
- [x] **T-177.6 Verify.** Package tier, the host tier, and the four frontier guards — the refactor
      runs on every successful bind, so byte identity is measured rather than argued.

## What an author now reads

Read from the real binder, through the service, for each producer, after review.

| Producer | Message |
| --- | --- |
| memory never allocated | `Machine storage binding did not complete for 'main' — generated code refers to memory the compiler never allocated` |
| a byte the allocation does not contain | `… — generated code refers to a byte that is not part of the storage the compiler allocated for that value` |
| an indirect pointer starting at `$xxFF` | `… — the compiler placed an indirect pointer at the last byte of a page, where this processor takes its high byte from the start of that same page` |
| the same, inside startup | `Machine storage binding did not complete for generated startup code — …` |
| a whole-program disagreement | `The machine storage binding stage is not complete for this program`, at the project input |

Each located one carries the instruction's own span and
`Compiler limitation in generated block 'fn.main.entry' at 'lda', not an error on this line`. The
block label and opcode stay in the help line, where a bug report wants them and an author does not.

Every sentence names the compiler or its generated code as the subject. That is not politeness:
an author supplies no storage homes and chooses no addresses, so a sentence about certificates and
selected homes would describe machinery they neither provided nor control. The first wording did
exactly that, and review was right to call it.

## Two boundaries the first wording got wrong

Both were caught independently by three reviewers, which is the useful part — the same sentence
read wrong to a correctness lens, a semantics lens and a storage lens.

**The page-wrap guard is about where the pointer starts, not where its home ends.** The check reads
the resolved operand address, so a two-byte pointer at `$30FF` is refused because the processor
takes its high byte from `$3000` — and that pointer's home *ends* at `$3100`, which the first
sentence named as the problem. The same two bytes one address lower, at `$30FE`, are fine. An
offset into a larger home reaches the same bad address, so the home's own extent decides nothing.
The contrast is now pinned as its own case.

**Not every rejected offset lies past the end of an allocation.** The check also refuses a negative
offset and one that is not a whole number of bytes, and the address-byte form legally permits the
byte one past the last — the address of an object's end is a value a program may form. Saying
"reaches a byte outside" described one of those conditions and misdescribed the rest. The endpoint
and the two invalid shapes are now pinned.

## Where a construct-less refusal is reported, and how that was settled

This went three rounds and the reviewer was right in the end.

The first answer carried the caller's span, which is `main`'s. Review objected that a caret at
`main` for a whole-program disagreement points at a construct that did not cause it. The relevant
paragraph in `spec/14-diagnostics.md` is:

> For generated or command-line-only failures with no source expression, the primary location is
> the responsible source declaration when one exists; otherwise it is the input path or command
> option.

The second answer read that as settling it: a binding refusal is a generated failure with no
source expression, and the program entry is a declaration the caller already supplies. That
overstated the chapter, which never defines "responsible" and never designates the entry as a
default. "Responsible" need not mean erroneous — a correct function can own generated code that
exposes a compiler defect — but it does require some attributable relation to the failed
operation, and an available span is not one.

The third answer uses both branches as written, which is what they are for. A refusal that names
one demand has a responsible declaration: the one that asked for the storage, which is where
those already report. A refusal that disagrees with the program as a whole has none, so the
"otherwise" branch governs and the location is the input the compiler was given — the project
manifest. That is already this compiler's convention for an input-level failure, as
`project/inventory.ts` and the manifest diagnostics show, so nothing new was invented to express
it. The help line says the refusal is reported against the project because no source construct is
implicated, and a case asserts the refusal does **not** take the declaration span even when one is
handed over.

A null span was considered and rejected by the reviewer itself on re-reading: under that paragraph
an absent location is incomplete, not safe. It remains what a caller with no input to name gets,
and says so.

## Verification

| Check | Result |
| --- | --- |
| New cases, bind through to the author-facing sentence | **27/27** in the services file: 11 pre-existing, 9 authored first (7 failing on the unlocated sentence, 2 passing controls labelled as such), and 7 more added by review |
| The three accepted-shape controls are not vacuous | **Proved by mutation**: widening the address-byte bound to `>=`, widening the page guard to `$xxFE`, and dropping the indirect displacement each fail exactly the one control that guards it, and nothing else |
| Compiler package, machine and services | **267 files / 4,544 passed**, 2 skipped |
| Root host tier, complete and clean | **278 files / 5,941 passed**, zero errors — re-run again after the refusal was relocated to the project input |
| The four frontier guards, re-run directly | **37/37**, including the emulator-driving saved-output file at 17/17 |
| No emitted byte changes | **Measured three times**: three examples × three goals, SHA-256 of each PRG against a `185c9d24` rebuild, **9/9 identical** at the first delivery, after the review fixes, and after the relocation touched `size-selection.ts` — `2cba40b8…`, `9b346814…`, `d78aba55…`, `99d16c37…`, `e21c2e34…` throughout |
| Existing tests that flipped | **none** — including the exact-shape guards in `machine-contracts.impl.test.ts` |

The two skips are the Windows-only cases in `services/vice-profiles.impl.test.ts`, which
`skipIf(process.platform !== "win32")` excludes on this host. They are not disabled tests and
nothing in this unit touches them.

An earlier host run reported 277 of 278 files with ten `Timeout calling "onTaskUpdate"` reporter
errors and zero assertion failures; the affected file passed alone. Rather than argue that
disposition, the complete tier was re-run after the review fixes and came back clean, so the gate
rests on a green run rather than on a re-run of one file. `yarn test:full` belongs to the wave
close under this board's protocol, as it did for the twelve rows before this one; the serialized
VICE tier is not claimed here.

Byte identity is measured rather than argued because this refactor runs on every successful bind,
not only on the refusal path: the three private helpers now return which check failed instead of a
bare `null`, and `bindFunction` returns the first site that refused rather than discarding the
whole body. The baseline was taken by reverting both source files to `185c9d24`, rebuilding, and
rebuilding again with the change restored.

## Independent review

Three reviewers, each on a different contract: correctness and standards, semantic preservation and
developer experience, and storage/ABI closure from producer to consumer.

**No critical finding and no major implementation defect; every finding is dispositioned.** The one
that stayed open longest — where a construct-less refusal is reported — was settled by adopting the
reviewer's reading rather than by ruling over it, after it withdrew its original remedy and its
categorical verdict in turn. The section above records how.

| Finding | Disposition |
| --- | --- |
| The page-wrap sentence names the home's end, not the pointer's start (found three times over) | **Fixed**, with the valid `$xxFE` contrast pinned |
| "Reaches a byte outside" misdescribes a negative, fractional or permitted-endpoint offset | **Fixed**, with the endpoint and both invalid shapes pinned |
| The sentences use vocabulary the author never supplied — certificates, homes | **Fixed**: every message now names the compiler or its generated code as the subject |
| A caret at `main` for a whole-program refusal is a misleading location | **Adopted**, after my own counter-argument from the chapter turned out to overstate it. Such a refusal now reports against the project manifest through the paragraph's "otherwise" branch, and the reviewer's original null-span remedy was withdrawn by the reviewer itself as incomplete under the same paragraph |
| Omitting allocation budgets and source remedies breaches the SFA diagnostic model | **Refuted** by the auditor itself: that model governs impossible allocations, and these guards detect disagreement after closure rather than exhausted capacity |
| The opcode was asserted present in help but not absent from the message | **Fixed** |
| New fixtures carried empty memory-effect arrays, so the rewritten effect loop was untested | **Fixed**: an effect-only fault, a two-effect ordering case, and a nonzero `indirect-y` displacement that must keep binding |
| The host checkpoint was not unconditionally green | **Fixed by re-running it**; 278/278 clean |
| The two skips were unidentified | **Identified**: the Windows-only emulator cases |
| Three accepted-shape controls asserted only that one phrase was absent, so an unrelated refusal would pass them | **Fixed**, and the fix is the better lesson: built from the CPU facts rather than by hand, all three programs now bind completely and assert what was produced — the absolute pointer at `$30FE`, the immediate low byte of `$3002`, the bound effect keeping displacement 64. Each is then proved non-vacuous by mutation |

The last round also retired the one gate finding: the board's protocol places `yarn test:full` at
the wave close, which the reviewer accepted once it was quoted, and the earlier incomplete host run
was answered by re-running the tier clean rather than by defending its disposition.

The storage audit decided all six of its obligations preserved — closure, short-circuit safety, the
shared-body boundary, zero-page/region/cost selection, the `$xxFF` predicate itself, and
startup/interrupt ordering — and recorded that successful binding adds zero RAM, zero zero-page,
zero stack bytes, zero code bytes and zero cycles against the baseline.

**One inherited claim corrected.** The previous unit's record says no source program reaches any of
these five producers, and this record repeated it. Two reviewers pushed back and they are right:
what is defensible is that a correct producer and closure pipeline should not reach them. Valid
source can still arrive here by exposing a compiler defect upstream — which is exactly why these
refusals needed to say where they gave up. The fifth producer reinforces it, since
`findMachineProgramDefect` checks instruction legality, transfers and flag proofs rather than
certificate agreement alone.

## Stop conditions

No specification file and no frozen oracle is edited. The `closed` guard stays. The certificate and
empty-identity refusals keep their program-scoped sentence rather than gaining a guessed construct,
and a caller that supplies no fallback span still reads exactly what it reads today.
