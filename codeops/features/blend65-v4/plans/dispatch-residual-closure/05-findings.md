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

**Outcome after the change.** The control is **byte-identical** — `044801b51c3f54bc` and
`39a2c88bc1e0bbcf`, unmoved. Across every control in all four modes and all seven examples, exactly
one line differs: `thunk-nonreturning` stopped being refused. So the concern was real and the
answer is clean, but it is now an answer from measurement rather than an assertion that could not
have been checked.

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
| PA-005 | "The dispatch controls stay byte-identical" is unsatisfiable for the two shapes that are refused today and so have no digest | Acceptance split: the controls that build stay byte-identical; the two previously-refused shapes get a stated expected shape proved in the implementation tests, not merely "no longer refused". **Discharged for half A**: the newly accepted program emits `jsr` with no instruction after it, the thunk's `jmp ($0af1)` untouched, and the dead tail in the continuation — recorded verbatim in the plan |
| PA-006 | The plan said two construction sites; there are five occurrences across two files | Corrected to five emission sites across two files, of which the bind-error one is `size-selection.ts:244`. Verified: 3 in `services.ts`, 2 in `size-selection.ts` |
| PA-007 | The plan repeated the challenger's claim that `machine/` imports `project/diagnostics` as a type only | Corrected: **no production module** under `machine/` imports it at all; the only importer is a test, and it imports the value. Verified. The conclusion — format in `services/` — is unaffected |
| PA-008 | The header baseline commit and the capture commit disagreed | Both roles are now named explicitly instead of one field standing for both |
| PA-009 | The plan placed new code in two files already near the size limit (`bind.ts` 592 lines, `size-selection.ts` 1,038) without naming modules | Module names are now given so the implementer is not pushed past the split threshold, and the rule that user-facing strings carry no plan or issue identifier is stated as well as the comment rule |

## Unconfirmed leads, carried rather than closed

| ID | Lead | Why it stays open |
| --- | --- | --- |
| PA-L1 | The claim "no legal source program is known to trigger this refusal" is weaker than stated: the feature roadmap records a stock chained-NMI program failing `COMPILER_INCOMPLETE` at machine storage binding | That trigger appeared only behind a gate change that was reverted, so it may not reproduce on this baseline. The plan's wording is narrowed to the validator path on the current baseline rather than claiming none exists |
| PA-L2 | Whether the newly accepted thunk programs could trip a different observer or certificate check on the unreferenced continuation block | Probably benign, because the comparison chain already emits the same unreferenced continuation and that program builds. Not traced; the implementation tests must cover it rather than assume it |

## Half A independent review — correctness lens

**0 critical, 0 major, 3 minor.** Verdict: the fix is soundly conditioned and can stand as
committed. The reviewer confirmed, against the code rather than the packet, that `every` is the
exact mirror of the validator's own rule (it yields a non-returning summary only when no candidate
returns, so `some` would have dropped an edge a returning candidate really takes — a miscompile
rather than a refusal), that the absent-summary default leans the safe way, that
`state.values.set` precedes the new early return on every path, that the continuation label cannot
collide, and that a predecessor-less continuation is valid at every later stage because the flag
walk only visits blocks reachable from an entry — which is precisely why the post-call `adc` no
longer needs a producer.

It also refuted three things it could have reported: trusting the returning-body facts is
identical to what the comparison chain already does; the retained stores in the cut block are
consistent with the chain's own arms; and a requirement identifier in a *directory* name is
established convention, since the rule governs code and doc comments.

| ID | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| RV-001 | minor | The continuation label was built twice from the same prefix, once per route, so editing one would silently diverge | **Fixed** — built once above both routes and shared |
| RV-002 | minor | The shape-detection regexes and the build helper were copied from the sibling dispatch suite, so the definition of "the cheap dispatch" lived in two places. The sibling's copy also carried a global flag, which advances `lastIndex` on a shared instance and matches inconsistently depending on call order | **Fixed** — one `test/rd04/dispatch-shape-fixture.ts` owns both patterns and the build helper, both suites import it, and the global form is confined to an explicit counting helper |
| RV-003 | minor | `Object.freeze(instructions)` froze the array in place while the local stayed mutably typed, so a later `push` would have thrown at run time | **Fixed** — a copy is frozen, leaving the local genuinely mutable |

Two items the reviewer could not close because it has no shell: that the prior inline chain
expressions were character-identical to the extracted helper, and where the freeze previously sat.
Both are visible in the committed diff and were confirmed by the parent: the two chain lookups were
the same expression differing only in formatting, and the freeze previously sat at the result-path
return. The reviewer independently corroborated the expression by finding the identical form at
three other sites in the tree.

After these three fixes the capture was re-run: **identical to the post-fix measurement**, so none
of them moved a byte.

## Half A independent review — machine-code lens

**0 critical, 0 major, 4 minor**, one of which was an Unknown the auditor could not resolve because
it has no shell. Verdict: acceptable as expert-quality for the shape this unit handles — the
acceptance fix costs zero emitted bytes, and the page hazard of `jmp (indirect)` on NMOS is
**triply guarded** (route selection rejects a pointer whose low byte is `$FF`, the allocator never
places a function-typed pair at `$xxFF`, and binding refuses a bound indirect operand at `$xxFF`
rather than dropping it silently).

The auditor also closed two questions as non-findings with arithmetic rather than assertion: the
new block boundary introduces **no padding** (blocks are laid contiguously and the origin directive
merely restates the address a block already has — `$0977 + $25 = $099C`, exactly the thunk's
origin), and it explained why byte-identity across the other controls was the expected result
rather than luck, because splitting a block after the `jsr` emits the same bytes in the same order.

### MC-004 — escalated to major by measurement

The auditor flagged, as Unknown, that the single-candidate route devirtualizes to a direct call and
never had the non-returning test applied. The parent ran the probe, and the answer is **worse than
the Unknown suggested**:

| Shape | Result |
| --- | --- |
| Two candidates through a pointer, no candidate returns, arithmetic after | **Builds** — this unit's fix |
| **One** candidate through a pointer, candidate never returns, arithmetic after | **Refused**, same diagnostic |
| A **plain direct call** to a never-returning function, arithmetic after | **Refused**, same diagnostic |

So the defect class is not dispatch-shaped at all. It is *any* call to a provably non-returning
callee followed by work that consumes processor state, and this unit has repaired one of its three
shapes. By the prime directive `spin(); i = i + peek($C003);` is a legal program an expert expects
to compile, so the remaining two shapes are the same defect rather than adjacent parity debt.

This needs a ruling, because the remedy's blast radius is the question: the dispatch thunk is one
narrow route, while the direct-call path is every call site in the language.

**It also improves half B.** The plan had argued that the diagnostic could only be proved at unit
level, because half A's fix would leave no legal program able to reach the refusal. This probe
refutes that: the direct-call program is legal, is refused, and reaches the diagnostic through the
validator path, so half B gains a genuine end-to-end demonstration — and a reason to land before
the wider repair, since a located diagnostic is exactly what an author hitting these two shapes
needs in the meantime.

### Remaining minors, all parity debt this commit did not create

| ID | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| MC-001 | minor | For an all-non-returning dispatch an expert writes `jmp (ptr)` at the call site; no return address is needed. The generated `jsr` into a `jmp (ptr)` thunk costs **3 bytes, 6 cycles and 2 never-reclaimed stack bytes per call site** more than the expert idiom — a larger gap than the packet put to the auditor | Follow-up, not this commit. The auditor agrees the commit's purpose was acceptance and that it achieves it at zero byte cost. Two preconditions are recorded: the validator recognises a dispatch only when the block is nothing but the indirect transfer, and the hardware-stack peak model must learn the tail form before it credits the saved stack bytes |
| MC-002 | minor | The unreachable continuation costs **37 real artifact bytes** in this witness and is ineligible for the existing cleanup, which removes only empty blocks that fall through. No unreachable-block rule exists in the machine layer at all, although the semantic layer already computes the needed fact and uses it for retained interrupt bodies only | Follow-up. Pre-existing for the comparison chain, now reachable from the thunk route too. Flagged as **golden-shifting**, so it needs its own unit with a reachability oracle and an exact artifact delta |
| MC-003 | minor | The retained result's store in the terminated block is unexecutable, and the existing dead-store rules cannot remove it because the read-set computation is not reachability-aware, so the dead block's read keeps both the store and its RAM home alive | Subordinate to MC-002: fixing that lets the existing rules remove this unaided. The retention **registration** must stay — the still-lowered unreachable suffix resolves the result through it, and dropping it fails lowering on a legal program |

Two further Unknowns are recorded rather than guessed: whether the stack-peak model would credit
the two saved bytes of an inline tail dispatch, and whether an unaccessed retained-value request
still reserves RAM once its store disappears. Both need probes that only matter when MC-001 and
MC-003 are sized, so they are deferred with their owners named.

## An intermittent observed during the half B gate, and its attribution

A full `yarn test` run reported **1 failure of 4,362**:
`src/services/input-size-frontier.spec.test.ts > complete size frontier on c64-pal-prg-kernal-8580
> should close a bounded recipe inventory for 64 ordinary sites`. It is a frozen specification
test, so it was treated as the implementation being wrong until the evidence said otherwise.

It did not reproduce. A second run of the whole compiler package in the same context passed
**260 files / 4,360 with 2 skipped**, with that exact case green at 51,241 ms, and the file alone
passed 27/27.

Attribution rests on structure rather than on the re-run alone. The program under test is 64
`read` functions that each return normally, called directly, writing into a placed array. **It
contains no function pointer, no indirect call and no non-returning function**, so half A's branch
— which lives inside the indirect-call lowering behind a test that every candidate never returns —
cannot be entered for it. Half B changes only the text of a refusal, and this case asserts
success, so it produces no diagnostic at all. Byte-identity across seven controls in four modes
and all seven examples agrees.

The file drives the emulator three times per profile under a 300-second budget, and the package
suite runs its 260 files in parallel workers, so the failure is load-dependent. That is the same
class as the already-tracked intermittent on the VIC collision latch, though a different file.

It is disclosed here rather than quietly re-run until green.

### A second one, in a different file, which makes it a pattern worth naming

The next full gate run failed once more — a different file, and this time the cause is explicit
rather than inferred:

```
FAIL test/rd05/input-saved-query-output.spec.test.ts > saved input output on
c64-pal-prg-kernal-6581 > fits the complete expert saved-query caller …
Error: Test timed out in 120000ms.
```

It took **121,013 ms against a 120,000 ms budget** — over by one second. The other three profiles
in the same file passed in the same run at 87, 66 and 55 seconds, the file passes 4/4 in isolation,
and an earlier run of the same tier passed all four profiles at 47–62 seconds. So the budget is
about twice the quiet-machine cost, and parallel load closes that gap.

Two consecutive gate runs, each with exactly one failure, in different files, both emulator-backed,
each passing in isolation and on sibling profiles. The pattern is not either file: **the host gate
carries fixed per-test timeouts sized for a quiet machine and runs its files in parallel**. That
makes a clean single-shot gate run load-dependent, which is a verification-policy problem rather
than a compiler defect, and it is the same class as the already-tracked VIC-latch intermittent.

Neither failure is an assertion about compiler output. The totals around them were
**5,471 of 5,472 passed** on the host tier and a clean **260 files / 4,360 passed** on the package
tier.

Whether this earns its own issue is a decision for the user: two issues were authorised for this
unit's remainders, and a third was not.

## Half B independent reviews

Two lenses. **0 critical. One major on each, and they are different findings.** Both reviewers run
read-only, so every empirical claim was re-checked by the parent before disposition.

### The semantics lens independently found #173

Asked to audit the proof's soundness, the semantics reviewer returned **soundness preserved** and
one major on the expressiveness axis — which turned out to be the same defect the machine-code
lens had found and the user had already ruled on: a direct call to a proved non-returning callee is
treated as preserving nothing rather than as making the remainder unreachable. It reached the same
remedy independently, mirroring the dispatch route's terminator rule at the direct call site.

That is worth recording as corroboration rather than as a new finding: two lenses with different
briefs, given no knowledge of each other, converged on the same defect and the same fix, and it is
already filed as **#173** with the user's ruling behind it.

Its soundness verdict rests on two things it verified rather than took on trust: recording is
observationally inert on the dataflow — it touches no cache, no active set, no work list, and
`machineProgramDefect` freezes only its own result — and the ordering `if (valid) return null`
before the fallback makes the unsafe direction unreachable **by construction**, so soundness does
not depend on every site remembering to record. It also confirmed the decimal flag is genuinely
the unproved one: the instruction grid declares `adc` as using carry and decimal, and `clc`
discharges only carry.

### RV-001 — the ruling's framing had excluded a whole axis · **fixed**

The correctness lens found that four production **consumers** discard the witness. This is the
finding that matters most about process: the earlier audit and the user's ruling were both phrased
around the five bind-error *producers*, and that phrasing silently excluded the consumers which
compute a witness and throw it away. Confirmed by search:

| Consumer | Disposition |
| --- | --- |
| `size-selection.ts` `closeCanonicalStorage` | already repaired |
| `size-selection.ts` `closeCanonicalObjectStorage` | **repaired here** |
| `size-selection.ts` `closeSizeCandidate` | **repaired here**, retaining the candidate plan |
| `shared-storage.ts:219` and `:255` | routed to **#174**, whose scope was explicitly widened to name the consumer axis so it cannot be lost the same way twice |

The re-review confirmed both new sites: correct fallback span for their scope, category unchanged
because the previous helper was already compiler-category, and a storage-only refusal through them
still emits the previous sentence verbatim.

### Minors, all applied

| ID | Finding | Disposition |
| --- | --- | --- |
| RV-002 | The new suite's equivalence assertion is a **tautology** — the boolean is *defined* as the finder compared against `null`, so it cannot detect the failure its comment claimed to guard | **Comment corrected** to claim only what it shows: that the two stay derived and that repeated calls agree, which would fail if the defect slot became shared state. The re-review advised keeping the assertion, and said so with a reason: it becomes real equivalence evidence the day the predicate stops being derived. This also corrects an overstatement in this unit's own earlier reporting, where those cases were presented as equivalence evidence |
| RV-003 | The opcode field was read by no production consumer | **Fixed** — the help line now reads `generated block 'X' at 'adc'`, so a reader gets the opcode without parsing the sentence |
| RV-004 | The stage name was spelled twice in one file despite a comment claiming it was spelled once | **Fixed** — one constant, with the capitalised form derived from it |
| RV-005 | No case covered the branch-terminator refusal or three of the four instruction-rejection arms, so a lost recording would silently degrade the message with nothing noticing | **Fixed** — four cases added. The re-review promoted this finding, because it is also what closes its own open verification gap about the structural extraction. Writing it found a further imprecision worth noting: the `operand` rejection also covers a *register*-metadata mismatch, so a wrong-registers instruction is reported as an operand that does not fit its addressing mode |
| RV-006 | The new suite duplicated four fixture builders from the validator's own suite | **Fixed** — one `machine-program-test-support.ts`, following the package's existing `-test-support` convention, imported by both |
| RV-007 | Relaxing an exact-equality assertion lost the guarantee that a storage-only refusal carries no witness, which the diagnostic's older-wording branch depends on | **Fixed** — that is now asserted directly |
| SM-002 | A flag-proof failure was announced as a *storage* failure | **Fixed** — the defect carries which obligation gave up, and the message follows it. The refusal now opens `Machine flag proof did not complete for 'main'`, which is what actually failed |
| SM-004 | The dispatch meet skips a non-returning candidate, which is sound only while two unstated invariants hold | **Fixed** — both are now stated at the skip, with the consequence if either stops holding |
| SM-005 | First-captured is traversal order, not source order | **Fixed** — stated where the recorder is defined, including that a program with two failing constructs may name either |

### Accepted residual

**SM-003**: when a call names a function the program gives no body, the defect is attributed to the
absent callee, so it resolves no span even though the calling instruction has one. Recorded rather
than fixed: the remedy moves where the defect is recorded, which is the one change in this area
that would alter *which* construct is reported, and this unit has already measured its evidence
against the current attribution. It belongs with **#174**, which owns the remaining locations.

### Verification after every fix

| Check | Result |
| --- | --- |
| Byte-neutrality — 7 controls × 4 modes, all 7 examples | **identical** to the half A baseline |
| `packages/compiler/src/machine`, every file | 89 files / 1,197 passed |
| Validator and defect suites | 47 passed — 31 unchanged validator cases and 16 defect cases |
| Validator, defect, contracts and the 3 frozen boolean oracles | 94 passed across 6 files |
| End-to-end refusal | 5 passed |
| `yarn build`, `tsc --noEmit`, `prettier --check` | exit 0 |
