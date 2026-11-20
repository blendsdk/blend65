# Dispatch residual closure — findings

> **Owner**: T-36 / #170 · **CodeOps Artifact Schema**: 1
> **Last Updated**: 2026-11-20

Findings from the plan preflight, which ran before any implementation. Severity is the auditor's.
Every empirical claim was re-verified by the parent before disposition, because the auditor runs
read-only and cannot build the compiler.

## Majors

### PA-001 — the byte-neutrality claim was false · **fixed**

The plan asserted that the thunk route's non-returning path "is only reachable with zero arguments,
and a program on it today is refused rather than compiled, so no program that currently builds can
change by a byte."

That is wrong, and the auditor's reasoning was right: the refusal is not a property of the route. It
needs a **post-call flag consumer**. A non-returning dispatch summarises as preserving nothing
(`validate-flags.ts:303-305`), the `jsr` clears what is available (`:170-171`), and the verdict only
turns false when a later instruction actually *requires* a flag that is now missing
(`:151-153,181-187`). Every control in the baseline table and every program in the frozen oracle
carries `i = i + peek($C003)` — the `adc` that supplies that consumer — so the table had no control
for the shape that reaches the changed path and builds.

**Verified by the parent, which the auditor could not do.** A program with two never-returning
candidates, zero arguments and no post-call arithmetic **builds today in all four modes** and takes
the thunk route (`jmp (` present in the emitted assembly):

| Mode | Digest |
| --- | --- |
| `none` | `044801b51c3f54bc` |
| `balanced` / `speed` / `size` | `39a2c88bc1e0bbcf` |

This matters beyond the wording, because the change is not structurally neutral for it: an
`unreachable` terminator is itself an optimizer input — `optimization-cleanup.ts:183` returns
`false` from `flagsDead` for exactly that terminator kind — and moving post-call instructions into a
fresh continuation removes them from the pre-`jsr` block's peephole window.

**Disposition.** The control is added to the baseline table and the appendix as
`thunk-nonreturning-no-consumer`, measured at baseline and reproduced across two independent runs.
The universal sentence is replaced by the accurate one: the shape is refused when a flag consumer
follows the call and accepted otherwise, and that accepted shape is now pinned. If its bytes move,
the delta is stated and justified rather than asserted away.

### PA-002 — the defect finder could accept a malformed program · **fixed**

Design decision D-5 said to capture the first defect beside the accumulating `valid` dataflow. That
prescription named only the `valid &&= …` sites. The verdict also turns false at five places that
never pass through that dataflow, all confirmed by reading the file:

| Site | How it refuses |
| --- | --- |
| `validate-flags.ts:100` | A duplicate block label — `return false` from the top-level function |
| `validate-flags.ts:115` | An active or absent entry — returns a summary with `valid: false` |
| `validate-flags.ts:125` | An absent successor block — same |
| `validate-flags.ts:162` | A missing stack byte — a plain `valid = false`, already gated on `check` |
| `validate-flags.ts:224` | Unequal stack shapes at a join — same |

Because the planned boolean is *derived from* the finder, a false verdict with no captured defect
yields `null`, which the wrapper reads as `true`. **That accepts a malformed program** — strictly
worse than the defect this unit is repairing. The capture direction that does hold is one-way: a
capture always propagates to a false verdict, but a false verdict does not imply a capture.

The auditor also named a second trap, confirmed: `transfer` runs twice per block — the fixpoint
pass at `:206` with `check = false` and the verdict pass at `:250` with `check = true` — so a
capture not gated on `check` records phantom defects from the propagation pass.

**Disposition.** D-5 is rewritten: capture at the five bypass sites as well as the `&&=` sites,
only on `check === true` paths, with a guaranteed non-null fallback defect whenever the verdict is
false, plus an equivalence test asserting that the finder returning `null` matches the pre-change
boolean exactly. Without that fallback the signature-preservation argument does not hold at all.

### PA-003 — half B witnesses one of five producers of the same message · **needs a ruling**

`size-selection.ts:511-512` maps **any** bind error to the same `incomplete("machine storage
binding")` and discards `reason` and `requestId`. `bindMachineProgram` has five error returns and
only one is the validator:

| Site | Reason | Witnessed by half B as planned? |
| --- | --- | --- |
| `bind.ts:556` | `certificate` | No |
| `bind.ts:561-564` | `invalid-storage`, carries a `requestId` | No |
| `bind.ts:569` | `missing-storage`, carries a `requestId` | No |
| `bind.ts:574` | `invalid-storage`, a function failed binding | No |
| `bind.ts:585-586` | `invalid-storage`, the validator refused | **Yes** |

So after half B, four paths still emit the byte-identical span-less sentence that this plan calls
"itself the defect", and T-36.5's acceptance as written is false for them.

This is the one finding with a genuine choice rather than a single correct remedy, so it is carried
to the user. Options and the recommendation are in the plan's open-decision section.

## Minors — all applied

| ID | Finding | Disposition |
| --- | --- | --- |
| PA-004 | The design read ambiguously about whether the result's retention instructions sit inside the pushed block | Stated explicitly: the pushed block carries `retained.instructions`, the `state.values` entry is unchanged, and the fresh continuation starts empty |
| PA-005 | "The dispatch controls stay byte-identical" is unsatisfiable for the two shapes that are refused today and so have no digest | Acceptance split: the controls that build stay byte-identical; the two previously-refused shapes get a stated expected shape proved in the implementation tests, not merely "no longer refused" |
| PA-006 | The plan said two construction sites; there are five occurrences across two files | Corrected to five emission sites across two files, of which the bind-error one is `size-selection.ts:244`. Verified: 3 in `services.ts`, 2 in `size-selection.ts` |
| PA-007 | The plan repeated the challenger's claim that `machine/` imports `project/diagnostics` as a type only | Corrected: **no production module** under `machine/` imports it at all; the only importer is a test, and it imports the value. Verified. The conclusion — format in `services/` — is unaffected |
| PA-008 | The header baseline commit and the capture commit disagreed | Both roles are now named explicitly instead of one field standing for both |
| PA-009 | The plan placed new code in two files already near the size limit (`bind.ts` 592 lines, `size-selection.ts` 1,038) without naming modules | Module names are now given so the implementer is not pushed past the split threshold, and the rule that user-facing strings carry no plan or issue identifier is stated as well as the comment rule |

## Unconfirmed leads, carried rather than closed

| ID | Lead | Why it stays open |
| --- | --- | --- |
| PA-L1 | The claim "no legal source program is known to trigger this refusal" is weaker than stated: the feature roadmap records a stock chained-NMI program failing `COMPILER_INCOMPLETE` at machine storage binding | That trigger appeared only behind a gate change that was reverted, so it may not reproduce on this baseline. The plan's wording is narrowed to the validator path on the current baseline rather than claiming none exists |
| PA-L2 | Whether the newly accepted thunk programs could trip a different observer or certificate check on the unreferenced continuation block | Probably benign, because the comparison chain already emits the same unreferenced continuation and that program builds. Not traced; the implementation tests must cover it rather than assume it |
