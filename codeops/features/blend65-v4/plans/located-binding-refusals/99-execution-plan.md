# A binding refusal that names the demand it failed on

> **Owner**: T-174 · **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Status**: Two of four producers delivered; two remain open by scope
> **Progress**: 4/4 tasks in scope (100%)
> **Last Updated**: 2026-11-22

## Why

```
error[COMPILER_INCOMPLETE]: The machine storage binding stage is not complete for this program
```

No file, no line, no construct. On a C64 there is no debugger, so there is nothing to act on and
nothing to report. A refusal that locates nothing is itself a defect, whichever internal check
produced it.

## The five producers, and which two this unit repairs

The reported line numbers had moved since the issue was filed; these are the current ones.

| Site | Reason | Carries | Status |
| --- | --- | --- | --- |
| `bind.ts:609` | `certificate` | — | Open |
| `bind.ts:615` | `invalid-storage` | a `requestId` | **Located here** |
| `bind.ts:634` | `missing-storage` | a `requestId` | **Located here** |
| `bind.ts:647` | `invalid-storage` | — (a function failed binding) | Open |
| `bind.ts:662` | `invalid-storage` | the validator's own defect | Already located |

### A scope note the previous record had wrong

The roadmap entry written before this session read that `certificate` **and** `missing-storage`
stay open, which contradicts the issue's own table: `missing-storage` is one of the two producers
that already compute a `requestId`. The issue's difficulty note says those two cannot reuse the
*instruction-span* channel, not that they are out of scope — and deriving a span from the request
is precisely the separate derivation it calls for. The roadmap note is corrected with this
delivery.

## The information already existed

A `StorageRequest` carries `source` (the declaration that asked for the storage), `reason` (a
stable human-readable description of the demand) and `owner` (the function that owns the value).
Both failing checks already hold the request's identity. All of it was discarded at the service
boundary.

So nothing had to be discovered: the repair carries the request's own span and wording outward
through the channel the validator refusal already uses.

| Before | After |
| --- | --- |
| `The machine storage binding stage is not complete for this program` | `Machine storage binding did not complete for 'main' — no storage home was selected for 'Static local home'` |
| no span | the caret lands on the declaration that asked for the storage |
| no help | `Compiler limitation in the machine storage binding stage, not an error on this line; please report it with the source shown` |

An unusable home reads `the storage home selected for 'Static parameter home' does not satisfy it`.
Where the demand has no source of its own — target-created scratch — the refusal says so instead of
claiming a line: it keeps the stage wording and the demand, and drops the "not an error on this
line" clause along with the caret.

The demand's wording is **quoted** rather than folded into the sentence. Request reasons are
sometimes clauses rather than noun phrases, and `no storage home was selected for 'Low byte
retained while the high byte is read'` stays grammatical where an unquoted form would not.

## What changed

| Site | Change |
| --- | --- |
| `machine/machine-defect.ts` | A check may supply its own span, for an obligation no instruction witnesses. Span order is instruction, then block, then the supplied span |
| `machine/bind.ts` | The two producers that name a demand build located evidence from it, matching the owning function by source identity rather than by generated link name |
| `services/machine-binding-diagnostic.impl.test.ts` | The two new producers, driven from `bindMachineProgram` through to the sentence an author receives |

## Tasks

- [x] **T-174.1 Settle the scope from the code.** Five producers, current line numbers, and which
      two carry a demand identity — correcting the previous record.
- [x] **T-174.2 Open the span channel.** An explicit span on the defect site, for checks that fail
      before any instruction is implicated.
- [x] **T-174.3 Locate the two producers.** Derive the message, the owner and the caret from the
      storage request each one already names.
- [x] **T-174.4 Verify.** New cases through the real binder, the package tier, and the frontier
      guards for the byte claim.

## Verification

| Check | Result |
| --- | --- |
| New cases, bind through to the author-facing sentence | **11/11** in the services suite, including the spanless demand and an unnamed owner |
| Compiler package, machine and services | **126 files / 2,234 tests** |
| Root tier: all of rd04, both size frontier guards and the optimizer pair | **69 files / 935 tests** |
| No emitted byte changes | Every touched line is on a refusal path; the successful bind return is untouched, and the four frontier guards hold |
| Existing tests that flipped | **one**, deliberately — below |

Both producers guard the agreement between a program and its own storage certificate, which the
compiler constructs. No source program reaches either, so these are judged by binding hand-built
programs rather than through a build. That is why the end-to-end property below has no home yet.

## The guard that caught this change

`machine-contracts.impl.test.ts` asserted that a storage refusal carries no defect, with a comment
saying a defect appearing there "would silently change what an author reads". That is exactly what
this unit does, deliberately — so the guard did its job and reported it. It now asserts the
stronger property it was really protecting: a refusal that names one demand carries evidence for
that demand, describing the binding obligation rather than the flag proof, with that demand's own
span.

## What remains open, and one correction to an earlier note

Two producers still report nothing:

- **`certificate`** — the certificate as a whole is not closed, so there is no single demand to
  name. It needs its own span derivation, which is the second design question the issue records.
- **`invalid-storage` where a function failed binding** — this one *can* be located: the failing
  function is known by its index, and a machine function carries its source identity. It is left
  out deliberately because this unit is bounded to the producers that name a demand, not because
  it cannot be done. Folding it in is a scope decision rather than more of the same work.

A separate finding for whoever takes those: the service is already handed a fallback span for the
main function and **discards it** when no defect is present, so even an unlocated refusal could
point somewhere today.

The property that cannot yet be restored is that **check and build refuse a program the same way**.
It needs a refusal reachable from source, and none of the five binding producers is. The earlier
note promising its return with this work is corrected here and on the issue: it waits for a
source-reachable refusal, not for these spans.

## Stop conditions observed

No specification file and no frozen oracle was edited. The new span channel is optional and
additive: every existing caller of the defect builder is unaffected, and a producer that supplies
no span still reports exactly what it reported before. The three remaining unlocated producers keep
their established sentence rather than gaining a guessed location.
