# Delivering a runtime-count shift result where it is going

> **Owner**: #130, with the measured ruling for #129 recorded below · **Type**: Task (lightweight)
> **CodeOps Artifact Schema**: 1
> **Status**: #130 complete for the optimized candidate; canonical reference unchanged by design
> **Progress**: 5/5 tasks in scope (100%)
> **Last Updated**: 2026-11-23

## What was wrong

A runtime-count shift leaves its result in the accumulator on every path out of
its loop, and the only consumer was the very next store:

```asm
  dex
  bne loop
  sta $0903        ; a temporary nothing else reads
  lda $0903        ; reading back what the store just wrote
  sta answer
  jmp startup_restore
```

Measured on the issue's own program at every optimization goal before any
change, with bounds checks both off and on.

## Where the defect actually was

Not in the shift. The pass that removes exactly this pair already exists —
`cleanup.copy-forward` — and it already admits a pair that opens a block, on the
reasoning that whatever the predecessors left in A is precisely what the store
wrote, so the reload cannot read anything else. Its one remaining obligation is
the flags: the removed load used to establish N and Z from the result.

That obligation was discharged by demanding both flags be **rewritten inside
the same block**. Nothing in this block rewrites them, so the pair stayed — even
though two instructions further along, past a jump, the platform restore
sequence overwrites them before anything reads them.

The proof was block-local where the fact is not. The same program with one
`if (answer == 0)` appended already delivered directly, because the comparison's
own load happened to rewrite the flags in time. One statement of unrelated
source decided whether six bytes of traffic were emitted.

## The fix

The flag-death proof now follows control flow when a block ends with either flag
still live: every successor path must rewrite it before reading it, and the index
it walks includes the shared platform startup routine, because an ordinary body
does not end at its own terminator — it jumps into the restore sequence, which is
where its last flags actually die.

Conservative on every edge it cannot prove:

| Shape | Answer | Why |
| --- | --- | --- |
| Successor rewrites N/Z first | fold | nothing can observe the old pair |
| Branch reading Z on the way out | retain | the terminator is itself an observer |
| Successor pushes the status register | retain | `php` reads every flag |
| Path ends at a return | retain | a caller's flags are not this body's to spend |
| Path back into the block being proved | retain | the post-fold shape is not what is being walked |
| Successor label resolves to nothing | retain | an unknown edge proves nothing |

One further rule keeps the answer independent of visiting order: a reload this
same pass may itself remove does not count as a flag producer. Two staged pairs
in sequence must not each be justified by the other's survival.

## Measured result

Issue witness, four profiles, bounds off / on:

| Witness | `none` | optimized before | optimized after |
| --- | ---: | ---: | ---: |
| Literal operand | 233 / 249 | 241 / 257 | **235 / 251** |
| Private operand | 240 / 256 | 248 / 264 | **242 / 258** |
| Full-width word count | 249 / 265 | 243 / 259 | **237 / 253** |
| Right shift | 233 / 249 | 241 / 257 | **235 / 251** |
| Unproved count | 236 / 252 | 236 / 252 | **230 / 246** |

Six bytes and eight cycles on every delivered result, and the staging home is
released with it. `none` is byte-identical: the cleanup pipeline runs only when
optimization facts are supplied, so the canonical reference cannot reach it.

The saved and acquisition artifacts are byte-for-byte unchanged — this shape does
not occur in them.

## The ruling on #129

#129's prefix arithmetic was filed against a baseline that has since moved. Its
witness is the same program the zero-count work already changed: the count is no
longer loaded before the shifted value, and the `CPX #0` the issue counted as
present is gone. Measured at `balanced` today, delivering the count through `TAX`
while keeping the local's home costs **one byte and one cycle more** than what
ships. The issue's saving exists only if the named local's home disappears
entirely, which is a storage-elision capability for a single-use named local, not
a register-delivery change — and the issue itself prices that as needing
exhaustive-use, debug and layout closure.

One slice of #129 survives measurement and is real: in the private-operand
witness the source is read twice with only a store between the reads.

```asm
lda seed
sta value       ; leaves A alone
lda seed        ; three bytes and four cycles of nothing
and #$07
```

That is the same class as the reload repaired for #123 — a value still in A being
fetched again — with a different shape, and it is tracked as **#180** rather than
left inside #129's dissolved arithmetic.

## Tasks

- [x] T-130.1 Measure both issues' witnesses at all four goals, bounds off and on.
- [x] T-130.2 Locate the mechanism that already removes the pair and why it refused.
- [x] T-130.3 Follow control flow in the flag-death proof, including the startup routine.
- [x] T-130.4 Author the four-profile oracle, proved red before the fix, and the unit cases.
- [x] T-130.5 Compiler, host and root checkpoints.

## Acceptance

| Area | Oracle |
| --- | --- |
| Left and right delivery | the instruction after the shift loop is the destination store |
| Every optimized goal | `balanced`, `speed` and `size` deliver identically |
| Bounds checks on | the same delivery, measured not assumed |
| Unproved count | the saturation arm reaches the same direct delivery |
| Canonical reference | `none` still stages the result, byte-identical |
| Second reader | the staging home survives |
| Installed handler | the staging home survives |
| Delivery ending at a return | the staging home survives |
| Order independence | neither of two staged pairs justifies the other |

## Verification

| Tier | Result |
| --- | --- |
| Oracle red before the fix | 20 failed / 16 passed — every failure a delivery case, every pass a retention control |
| `test/rd04/runtime-shift-result-delivery.spec.test.ts` | 36/36 on four profiles |
| `optimization-cleanup.impl.test.ts` | 16/16, both new guards proved load-bearing by removal |
| Compiler machine tier | 90 files / 1,232 |
| Compiler services + frontend | 68 files / 1,553 |
| Compiler storage, semantic, layout, project, artifacts, assets, target, tools | 103 files / 1,623 |
| Root host tier | 270 files / 5,645 |

## Residuals

Two precise boundaries this unit refuses and does not hide:

- **#181** — a delivery whose path ends at a **return** keeps its temporary. The
  flags are dead there too in the ordinary case, but proving it needs every
  caller, which a walk inside one body does not have.
- **#182** — a delivery under an **installed handler** keeps its temporary,
  because the ownership prologue pushes the status register. A `php`/`plp` pair
  preserves and restores the flags rather than branching on them, so a sharper
  proof could distinguish observation from preservation. Asynchrony is not what
  retains it: a handler that runs leaves the flags restored by its own wrapper.

Each costs the same six bytes, eight cycles and one home this unit removes
elsewhere, and each has an oracle case pinning today's answer.
