# A refusal that names the instruction storage binding could not bind

> **Owner**: T-177 · **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Status**: Complete for its three producers; independent review pending
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
| `bind.ts:655` | `certificate` | — | Recorded: nothing to name; gains the fallback location |
| `bind.ts:659` with an empty identity | `invalid-storage` | — | Same channel; gains the fallback location |
| `bind.ts:695` | `invalid-storage` | — (a function failed binding) | **Located** |

The middle row is new to this record. `validateHomes` returns `""` when the certificate
disagrees with the program as a whole — a wrong inventory hash, a wrong profile identity, a home
count that does not match the request count — and that empty identity produces a refusal with no
demand and no defect, exactly like the certificate marker. It is reachable through the real binder,
which is what makes the service-level half of this unit testable at all.

## What the failing function already knows

`bindFunction` returns `null`, and three different checks produce that null:

| Check | What it means |
| --- | --- |
| `resolveHome` finds no home | the instruction names storage the certificate gave no home |
| `resolveHome` rejects the offset | the byte reached is outside the home selected for that storage |
| the indirect guard in `bindInstruction` | the pointer home ends at `$xxFF`, where this processor reads the high byte from the start of the same page |

All three are collapsed into one `null` today, and the `missing` check one line earlier has
already proved every *required* demand has a home — so "no storage home was selected" would be the
wrong sentence for most of them. The reason reported must be the check that actually fired.

The third is not a missing home at all. It is the 6502 indirect page-wrap, and naming it is worth
more than the other two: it is the one an author could act on, by moving the object.

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

Read from the real binder, through the service, for each producer.

| Producer | Message |
| --- | --- |
| no home for the named storage | `Machine storage binding did not complete for 'main' — the certificate selected no home for the storage this instruction uses` |
| a byte outside the selected home | `… — this instruction reaches a byte outside the home selected for the storage it uses` |
| an indirect pointer at `$xxFF` | `… — the home selected for this instruction's indirect pointer ends at the last byte of a page, where this processor reads the high byte from the start of that same page` |
| the same, inside startup | `Machine storage binding did not complete for generated startup code — …` |
| a whole-program disagreement | `The machine storage binding stage is not complete for this program`, now with the caller's caret |

Each located one carries the instruction's own span and
`Compiler limitation in generated block 'fn.main.entry' at 'lda', not an error on this line`. The
block label and opcode stay in the help line, where a bug report wants them and an author does not.

## Verification

| Check | Result |
| --- | --- |
| New cases, bind through to the author-facing sentence | **9 red → 20/20** in the services file; 7 of 9 failed on the unlocated sentence, 2 were passing controls |
| Compiler package, machine and services | **267 files / 4,537 passed**, 2 skipped |
| Root host tier | **277 files / 5,932 passed**, one reporter RPC timeout on `rd08/optimizer-acquisition-output`, re-run green alone |
| The four frontier guards, re-run directly | **37/37**, including the emulator-driving saved-output file at 17/17 |
| No emitted byte changes | **Measured**: three examples × three goals, SHA-256 of each PRG before and after, **9/9 identical** at `2cba40b8…`, `9b346814…`, `d78aba55…`, `99d16c37…`, `e21c2e34…` |
| Existing tests that flipped | **none** — including the exact-shape guards in `machine-contracts.impl.test.ts` |

Byte identity is measured rather than argued because this refactor runs on every successful bind,
not only on the refusal path: the three private helpers now return which check failed instead of a
bare `null`, and `bindFunction` returns the first site that refused rather than discarding the
whole body. The baseline was taken by reverting both source files to `185c9d24`, rebuilding, and
rebuilding again with the change restored.

## Stop conditions

No specification file and no frozen oracle is edited. The `closed` guard stays. The certificate and
empty-identity refusals keep their program-scoped sentence rather than gaining a guessed construct,
and a caller that supplies no fallback span still reads exactly what it reads today.
