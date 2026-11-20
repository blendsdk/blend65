# Dispatch residual closure (#170, bounded unit)

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: T-36 / #170
> **Progress**: 6/7 tasks (86%) · [findings](05-findings.md)
> **Status**: Executing — oracle frozen at reproduced RED; preflight returned 3 majors, two
> fixed here and PA-003 awaiting a ruling before half B is implemented
> **Last Updated**: 2026-11-20
> **Baseline**: plan authored at `26c316db`; accepted-output digests captured at `c6266da9`,
> both on a clean `feature/v4-rebuild`
> **Scope**: strict; the dispatch thunk's block termination and the machine-stage refusal diagnostic
> **Reasoning**: high — a lowering terminator and a validator, both on the refusal path, where a
> wrong answer either accepts a malformed program or refuses a legal one
> **Commit mode**: `--auto-commit` (commit and push after each verified task; a critical or major
> review finding still stops for a ruling)
> **Created**: 2026-11-20

## Objective and authority

Close the two residuals that keep issue #170 open. Neither is a new investigation: the preceding
unit proved both causes and specified both remedies, and this unit applies them.

| Half | Residual | Why it was not fixed in the preceding unit |
| --- | --- | --- |
| A | A dispatch whose every candidate never returns is refused on the thunk route and accepted on the comparison-chain route, so the **argument count decides whether the program compiles** | The lowering change would have invalidated that unit's byte-neutrality evidence. The objection expired when the unit closed |
| B | The machine-stage refusal carries no span and names no construct | Out of that unit's scope; it is a diagnostic contract, not a flag-fact repair |

The authority for half A is the comparison chain, which already answers this shape correctly. The
authority for half B is the prime directive: an author on a C64 has no debugger, so a refusal that
names neither a file nor a construct leaves nothing to act on, and that message is itself the
defect.

## Measured starting state

Reproduced at this baseline, not recalled. Both programs are identical except for one unused
parameter, which is the whole point.

| Program | Dispatch route | Result |
| --- | --- | --- |
| Two never-returning candidates, call takes **zero** arguments | Thunk (`jmp (ptr)`) | **Refused** — `error[COMPILER_INCOMPLETE]: The machine storage binding stage is not complete for this program` |
| Two never-returning candidates, call takes **one** argument | Comparison chain (`cmp #<(b65_Game_spinA_…)`) | **Builds**, two unused-parameter warnings only |

The refusal envelope carries `code = COMPILER_INCOMPLETE`, `span = None`, and the message above.
No file, no line, no construct.

**No test anywhere in the repository asserts `COMPILER_INCOMPLETE`.** A search of every TypeScript
file outside `node_modules` finds the code only in two files, across five emission sites — three in
`services/services.ts` and two in `services/size-selection.ts` — of which the one reached by a bind
error is `size-selection.ts:244`. This refusal is reached by no test in the
repository, which is why its wording was never pinned.

**An earlier draft of this plan went further and said the refusal has no demonstrated legal
trigger. That is now false, by this unit's own measurement** — see the MC-004 table below. A plain
direct call to a never-returning function followed by arithmetic is a legal program, is refused
with this exact diagnostic, and reaches it through the validator path: the callee's summary
preserves nothing, the `jsr` clears what is available, and the following `adc` loses its producer.
That program is the author experience the issue describes, and it changes half B's acceptance for
the better.

## Half A — smallest viable design

Mirror the comparison chain. The chain terminates an arm `unreachable` when the whole-program
summary proves that candidate never returns (`lower-indirect.ts:233-258`), and it reaches the
`returningBodies` map through `state.input.program.interruptOwnership`, which the thunk route can
read at the same point. The thunk route currently keeps the caller's block open and appends `jsr`
to it (`lower-indirect.ts:120-164`), so the fix is to close that block instead:

- When **no** candidate returns, push the caller's block with the `jsr` appended and an
  `unreachable` terminator, then continue at a fresh `${prefix}.continue` label with no
  instructions — structurally what `lower-indirect.ts:249-260` already does for the chain.
- When **any** candidate returns or is unknown, the current behaviour is correct and unchanged.

The change must be **uniform over the result branch**, which is the combination most easily missed.
The route already splits on whether the call has a result (`lower-indirect.ts:135`), and a consumed
result is affected too — measured:

| Program | Route | Result |
| --- | --- | --- |
| `let v: byte = hook();` with both `fn(): byte` candidates looping forever, zero arguments | Thunk | **Refused**, same diagnostic |
| The same program with one argument | Chain | **Builds** |

So the result's retention instructions and its `state.values` entry are still produced on the
non-returning path; only the block boundary moves. Stated exactly, to remove an ambiguity a
reviewer raised: the pushed block's instructions are `retained.instructions` (which already contain
the prefix, the `jsr` and the retention), `state.values.set(operation.result, retained.value)` is
unchanged, and `${prefix}.continue` starts empty. Dropping the retention would make the
subsequent lowering unable to find the value, and dropping the `state.values` entry would fail
lowering outright. The code after the call is unreachable, which is legal, and the comparison chain
already emits it the same way.

The route is only reachable with zero arguments, but it is **not** true that every program on it is
refused today, and an earlier draft of this plan claimed so. The refusal needs a post-call flag
consumer: a non-returning dispatch summarises as preserving nothing, the `jsr` clears what is
available, and the verdict only turns false when a later instruction actually requires a flag that
is now missing. A program with no arithmetic after the call therefore **builds today** on exactly
the path this half changes, in all four modes, and it is pinned as
`thunk-nonreturning-no-consumer` in the baseline table.

That is also why this half is not structurally neutral by construction: an `unreachable` terminator
is itself an optimizer input (`optimization-cleanup.ts:183` returns `false` from `flagsDead` for
that terminator kind), and moving post-call instructions into a fresh continuation takes them out
of the pre-`jsr` block's peephole window. Byte-neutrality for that control is therefore a measured
acceptance check, and if its bytes move the delta is stated and justified rather than asserted
away.

## Half B — smallest viable design

The refusal path is `bind.ts:585` → `{ kind: "error", reason: "invalid-storage" }` →
`size-selection.ts:512` → `incomplete("machine storage binding")`, whose body at
`size-selection.ts:240-249` passes `null` as the span. A span is available: `projectDiagnostic`
accepts `primarySpan` (`project/diagnostics.ts:105-117`) and `MachineInstruction.source` is a
`SourceSpan | null` (`machine-types.ts:430`).

The constraint is that `validateMachineProgram` is consumed as a bare boolean at **six** sites, and
five of them are not the refusal path:

| Site | Purpose |
| --- | --- |
| `machine/bind.ts:585` | The refusal path |
| `services/size-observers.ts:123`, `:124` | Size observation |
| `layout/c64-layout.ts:913`, `:918` | Layout and compaction decisions |
| `artifacts/acme-validate.ts:84` | Artifact validation |

**Settled** (see the design decision section for the challenger's reconciliation): keep the boolean
predicate and express it through one defect finder that returns the first failing check or `null`.
`validateMachineProgram` becomes that finder compared against `null`, so its signature does not
move; the refusal path at `bind.ts:585` reads the defect and carries it on the bind error; and the
message is formatted in `services/`, which is the layer that already owns span fallbacks.

**Modules are named, because both candidate hosts are near the size limit** (`bind.ts` is 592 lines
and `size-selection.ts` is 1,038, against a split threshold of about 700): the defect type and
finder live in a new `machine/machine-defect.ts`, and the formatter in a new small module under
`services/`. The no-ephemeral-identifier rule applies to the **user-facing strings** here as well as
to comments: neither the message nor the `help` line may name a plan, task or issue.

**One of the six consumers changes.** The decisive reason is not taste: **frozen specification
oracles assert the boolean directly** — `machine/terminal-legality.spec.test.ts:58`,
`machine/status-provenance.spec.test.ts:139,149,165,199,224` and
`machine/optimization-rules.spec.test.ts:147`, seven assertions of the form
`expect(validateMachineProgram(...)).toBe(...)`. Those files may never be edited, so a result-object
signature is not available at any price. Verified by direct search, not assumed.

A witness must name a construct rather than a stage. The failing check's phrasing and the
instruction's `source` span carry the message; the function identity, block label and opcode belong
in a `help` line as bug-report evidence, never in the primary sentence. A dispatch thunk's own
instructions are built with the call site's span (`lower-indirect.ts:110` and `:122-129`), so the
synthesized-block fear is narrower than it first appears; the genuinely span-less case is generated
startup, where the fallback lands on `main` and the message must name the stage rather than invent
a construct.

### How half B is proved — revised after the MC-004 measurement

This section previously argued for unit-level proof only, on the grounds that half A's fix would
leave no legal program able to reach the refusal. That premise is gone: a plain direct call to a
never-returning function followed by arithmetic still reaches it, and so does a single-candidate
pointer call. Half B therefore gets the stronger acceptance it was denied:

| Layer | What it proves |
| --- | --- |
| End to end | Build the refused direct-call program and assert the diagnostic carries a **non-null span naming the construct**. This is the author experience the issue describes, not a contrived shape |
| Unit | The validator's existing tests construct `MachineProgram` values directly, so each defect class and the synthesized-block span fallback are provable without inventing source for each one |

This also argues for landing half B **before** the wider non-returning-call repair: while those two
shapes are still refused, a located diagnostic is exactly what an author hitting them needs. It
closes the unconfirmed lead that the earlier wording was too strong, by refuting that wording
rather than narrowing it.

## Tasks

- [x] T-36.1 Record the measured starting state as evidence: both programs, both routes, the
      refusal envelope with its null span, and the absence of any `COMPILER_INCOMPLETE` assertion
      in the repository. Capture pre-change baselines for the dispatch controls and all seven
      examples so byte-neutrality is measurable rather than asserted ✅ (evidence below; both
      tables reproduced from independent working directories)
- [x] T-36.2 Author the specification oracle for half A from the issue acceptance only, with
      implementation-blind authorship, and reproduce RED. A never-returning dispatch must compile
      the same way whether or not the call takes an argument. Freeze the oracle by hash; never edit
      it afterwards ✅ (`test/rd04/nonreturning-dispatch-candidates.spec.test.ts`, frozen at
      `22e01e757bb305d770226f1a8280260b1ac31025`; RED reproduced parent-side)
- [x] T-36.3 Settle the witness-channel design: reconcile the independent challenger's verdict with
      the recommendation above, record the decision and the rejected options with their reasons,
      then enumerate every consumer the chosen channel touches before writing code ✅ (D-2, D-5,
      D-6; the challenger ran before any code was written, and its frozen-oracle finding was
      verified by direct search rather than accepted on report)
- [x] T-36.4 Implement half A: terminate the caller's block `unreachable` on the thunk route when
      no candidate returns, uniformly over the result branch. Acceptance is split, because two
      controls are refused today and so have no digest to preserve: the six controls that build —
      **including `thunk-nonreturning-no-consumer`, which travels the changed path** — stay
      byte-identical along with all seven examples, while the two previously-refused shapes must
      reach a stated expected shape (the `jsr`, an `unreachable` terminator, the retention present,
      a dead tail) proved in T-36.6 rather than merely stopping being refused. The frozen oracle
      must turn GREEN at 50/50 ✅ (evidence below)
- [x] T-36.5 Implement half B behind the settled design: the witness, the span on the refusal, and
      a message that names the construct. Accepted output must stay byte-identical, since a
      diagnostic may not move a single emitted byte
- [x] T-36.6 Add implementation tests for both halves — **half A's portion is delivered**
      (`test/rd04/nonreturning-dispatch-shape.impl.test.ts`, 30 passed, watched failing without
      the fix); half B's portion waits on the PA-003 ruling: the thunk route's terminator for every
      returning/non-returning candidate combination, the witness for a failing bound program
      including the synthesized-block fallback, and the non-regression controls the public oracle
      cannot express
- [ ] T-36.7 Independent reviews for the affected contracts, then the closeout: disposition every
      finding, run the checkpoint, sync both roadmap tiers, and post the issue evidence. A critical
      or major finding stops for a ruling

## Verify

Per task: the targeted suites for the files the task touched, run from the owning package
(`packages/compiler` needs its own config: `yarn vitest run src/...`; the root config only includes
`test/**`). Before each commit: `yarn test:changed --host` and `yarn test`.

At closeout, a **split checkpoint with a written containment argument** rather than `yarn test:full`,
following the established policy that the full corpus is not run unless it is necessary. The
argument must name which emulator files can reach a dispatch block or a machine-stage refusal and
why the excluded ones cannot; the preceding unit's twelve-file affected list is the starting point
and must be re-derived, not inherited.

## Out of scope

| Item | Owner |
| --- | --- |
| Unfolded signed comparison against a constant | #172 |
| Sibling lowering routes that retain a register value and could drop the same metadata | #171, pending the user's close-or-audit ruling |
| Raw-write residuals from the preceding unit's reviews | #164 |
| Unifying the two span-less refusal constructors across the service layer | Left separate by D-6 — they return different types and the service-stage one has no program to witness |
| Any call to a provably non-returning callee refused when work follows it — the direct-call and single-candidate shapes | **#173**, by the MC-004 ruling |
| The four bind-error producers that still emit a span-less refusal | **#174**, by the PA-003 ruling |

## Decisions ruled by the user — 2026-11-20

Both were put to the user with options and a recommendation, and both were ruled. The options and
costs are kept below rather than collapsed to the answer, so a later reader can see what was
weighed and not merely what was chosen.

| Decision | Ruling | Consequence |
| --- | --- | --- |
| MC-004 — the defect class is wider than dispatch | **B** — close this unit on dispatch, own the rest separately | Filed as **#173**. The two still-refused shapes have a tracked owner, and this unit keeps its measured evidence intact |
| PA-003 — half B's producer scope | **A** — qualify to the validator path | Filed as **#174** for the four remaining bind-error producers. Half B witnesses the one producer with a measured trigger |
| Where the remainders live | **Two separate issues**, not #170 and not one combined | #170 can honestly close at closeout, and a lowering defect is not filed together with a service-layer diagnostic contract |
| #171, unrelated and long parked | **Closed** against `ee262fb1`, with the evidence posted | The sibling-site class audit was weighed and deliberately not bundled |

### MC-004 — the defect class is wider than this unit

A review of half A asked whether the single-candidate route, which devirtualizes to a direct call,
ever had the non-returning test applied. The probe answered that and more:

| Shape | Result |
| --- | --- |
| Two candidates through a pointer, no candidate returns, arithmetic after | **Builds** — this unit's fix |
| One candidate through a pointer, candidate never returns | **Refused** |
| A plain direct call to a never-returning function | **Refused** |

So this is not a dispatch defect. It is any call to a provably non-returning callee followed by
work that consumes processor state, and the unit has repaired one of three shapes. By the prime
directive `spin(); i = i + peek($C003);` is a legal program an expert expects to compile.

| Option | Consequence |
| --- | --- |
| **A — extend this unit to the direct-call path** | Repairs the whole class, same facts and same rule. **Cost:** the blast radius is every call site in the language rather than one narrow route, the frozen oracle covers only pointer dispatch so a second oracle is needed, and the unit stops being bounded |
| **B — close this unit on dispatch and own the rest separately** (recommended) | Keeps the delivered repair verified and bounded, and treats a call-site-wide terminator change as the distinct unit it is. **Cost:** the compiler still refuses two legal shapes when this unit closes, so the remainder must be recorded as owned work — which needs a new issue, and filing one is outward-facing |

Recommendation: **B**, because the measured defect behind #170 was the dispatch route and because a
terminator rule applied at every call site deserves its own oracle and its own byte-neutrality
evidence rather than being appended to a unit that has already measured its own.

### PA-003 — half B's producer scope

Implementation of half B is held until this is answered. The preflight found that
`size-selection.ts:511-512` maps **any** bind error to the same span-less sentence and discards
`reason` and `requestId`, and that `bindMachineProgram` has five error returns of which only one is
the validator. As planned, half B gives a span to one of five producers of an identical message, so
four paths keep emitting the message this plan calls the defect.

| Option | What it means | Cost |
| --- | --- | --- |
| **A — qualify the scope** (recommended) | Only the validator-detected defect gains a witness. The other four bind reasons keep today's message, and the boundary is written into the plan with a named owner for the rest | Smallest sound change, and it keeps this unit bounded. An author hitting one of the other four paths still sees nothing useful. Needs somewhere to record the remainder, which means either filing an issue or adding it to #170's residual list |
| **B — extend the witness to all five** | The witness also carries `reason` and `requestId`, which `bind.ts:561` and `:569` already compute, so all five producers get a located message | Larger: `certificate` and `missing-storage` have no instruction to witness, so each needs its own span derivation, and the unit grows a second design question |

**Recommendation: A**, because the unit's measured defect is the validator path and option B adds
span derivation for three failure classes with no measured trigger. The honest cost of A is that
the plan's own framing — that a span-less refusal is itself a defect — stays true for four paths
after this unit closes, so the remainder must be recorded as owned work rather than dropped.

### Where the remainders live, and why it is not #170

An earlier draft proposed recording this remainder on #170 because that needs no new issue. That is
wrong on its own terms: **this unit exists to close #170**, and a remainder parked there keeps it
open at closeout. The same applies to MC-004's remainder under option B.

So if #170 is to close with this unit, each remainder needs its own issue, and they are distinct
defects that must not be merged into one:

| Remainder | Why it is its own issue |
| --- | --- |
| Any call to a provably non-returning callee is refused when work follows it — the direct-call and single-candidate shapes | A lowering defect reachable from every call site, needing its own oracle and its own byte-neutrality evidence |
| Four of five bind-error producers still emit the span-less refusal | A diagnostic contract in the service layer, sharing no mechanism or evidence with the above |

Filing an issue is outward-facing, so neither is filed without an explicit go-ahead.

## Design decisions

| # | Decision | Status |
| --- | --- | --- |
| D-1 | Half A mirrors the comparison chain's non-returning test rather than introducing a second mechanism | Settled — the chain is the existing authority for this shape |
| D-2 | The witness channel: a null-returning defect finder behind the unchanged boolean, the defect carried on the bind error, the message formatted in `services/` | Settled by the reconciliation below |
| D-3 | Half B's acceptance is proved at unit level, with the reason recorded | Settled, and stated so a reviewer can reject it |
| D-4 | Half A lands before half B, because half B's message is only reachable once the known defect on that path is gone | Settled |
| D-5 | `validate-flags.ts` captures its first defect into a side slot, at the `&&=` sites **and** the five bypass sites, only on `check === true`, with a guaranteed non-null fallback | Rewritten after preflight — the first version could accept a malformed program |
| D-6 | The two span-less refusal constructors stay separate | Settled — they return different types, and the service-stage one has no program to witness |

### D-2 and D-5 — challenger reconciliation

An independent challenger decided the witness channel without being told any preference. It
converged on the same channel this plan recommended, and it supplied a constraint the plan did not
have, which is the reason the decision is now closed rather than merely agreed:

| What the challenger contributed | Effect |
| --- | --- |
| Frozen spec oracles assert `validateMachineProgram` as a boolean at seven assertions in three files | Converting all six consumers is **impossible**, not merely noisy. Confirmed by direct search before adoption |
| `c64-layout.ts:913/918` guards a compaction decision and `size-observers.ts` contributes one clause to a multi-term certificate predicate | Neither has any consumer for a witness, so changing them would add noise for nothing |
| No production module under `machine/` imports `project/diagnostics` at all — the challenger said "as a type only", and the corrected fact is stronger — and it cannot reach the span-fallback inputs | The message must be formatted in `services/`, matching how machine lowering failures are already reported |
| `validate-flags.ts` accumulates `valid &&= …` **deliberately** without short-circuiting, and its summary cache fill order affects precision | **Do not convert it to early returns.** Capture the first defect into a side slot and leave the dataflow byte-for-byte. This is what makes "no accepted program changes" checkable rather than hoped for |
| No test anywhere pins the diagnostic code or its message text | Message, span and help text are free to change. Independently confirmed |
| The eager-witness option costs allocation on the accepted path, and these validators run per size-mode candidate | A `T \| null` finder allocates nothing when the program is accepted, which is also the existing house idiom (`validateHomes` returns `string \| null`) |

### D-5 as rewritten after preflight

The challenger's prescription was necessary but not sufficient, and the preflight caught why. The
verdict also turns false at five sites that never pass through the `valid &&= …` dataflow:
`validate-flags.ts:100` (a duplicate block label, a top-level `return false`), `:115` (an active or
absent entry), `:125` (an absent successor), `:162` (a missing stack byte, a plain assignment
already gated on `check`), and `:224` (unequal stack shapes at a join). Since the boolean is
*derived from* the finder, a false verdict with no captured defect would yield `null` and the
wrapper would read it as `true` — **accepting a malformed program**, which is worse than the defect
being repaired. The capture implication is one-way: a capture always reaches a false verdict, but a
false verdict does not imply a capture.

`transfer` also runs twice per block — the fixpoint pass at `:206` with `check = false` and the
verdict pass at `:250` with `check = true` — so a capture that is not gated on `check` records
phantom defects from the propagation pass.

The rule, therefore: capture at the `&&=` sites and at all five bypass sites, only on
`check === true`, and guarantee a **non-null fallback defect whenever the verdict is false**. An
equivalence test asserts that the finder returning `null` matches the pre-change boolean exactly
across the existing validator cases and the frozen assertions. Without the fallback, the
signature-preservation argument does not hold at all.

**The challenger's strongest objection is accepted, not dismissed:** a span on a
compiler-limitation message points a caret at innocent, correct source, and an author who trusts
the caret will start editing a line that is not wrong. That is arguably worse than no location at
all. The mitigation is that the message must say plainly that this is a compiler limitation rather
than an error on that line, and the `help` line must carry the report-this evidence. A reviewer
should judge the final wording against exactly this objection.

Two further cautions carried into implementation: the defect reported first is deterministic per
program but not canonical, because it follows a work-list order, so tests pin the code, the
category and the **presence** of a non-null span, never a span offset. And `MachineFunction.sourceName`
is optional, so the formatter reuses the existing name derivation rather than assuming it is
populated.

## T-36.1 evidence — accepted-output baselines before any production change

Captured at `c6266da9` on 2026-11-20. Values are the first 16 hex digits of a SHA-256 over emitted
bytes only. **Both tables were produced twice from independent working directories and agree
exactly**; a first attempt did not, because the digest covered `.build.json` and `current.json`,
which record the generation identity and change on every run. Those two files are excluded, and
everything else an example emits is included.

| Control | `none` | `balanced` | `speed` | `size` |
| --- | --- | --- | --- | --- |
| `thunk-returning` — two returning candidates, zero arguments | `7747321da81ddd4a` | `63441a4adb873dc6` | `63441a4adb873dc6` | `63441a4adb873dc6` |
| `thunk-mixed` — one returning, one never-returning | `981f9f52d2780665` | `1447854d79000d08` | `1447854d79000d08` | `1447854d79000d08` |
| `thunk-result` — two returning candidates with a consumed result | `4cdd3773fcdf2ee3` | `4bdc1996fbccadc0` | `4bdc1996fbccadc0` | `4bdc1996fbccadc0` |
| `thunk-nonreturning` — **the defect**: no candidate returns, zero arguments | `REFUSED` | `REFUSED` | `REFUSED` | `REFUSED` |
| `thunk-nonreturning-no-consumer` — no candidate returns, **no post-call flag consumer** | `044801b51c3f54bc` | `39a2c88bc1e0bbcf` | `39a2c88bc1e0bbcf` | `39a2c88bc1e0bbcf` |
| `chain-nonreturning` — the same program with one argument | `9b933bfd10918db9` | `15d915955d9f73e6` | `15d915955d9f73e6` | `15d915955d9f73e6` |
| `chain-returning` — returning candidates with one argument | `e291985f6f25f9f3` | `ca42881e1ddabbdf` | `ca42881e1ddabbdf` | `ca42881e1ddabbdf` |
| `single-target` — one candidate, no dispatch | `ae6b8adac5c9940e` | `d74b449a402f14bc` | `d74b449a402f14bc` | `d74b449a402f14bc` |

One further shape was measured after the table was captured and is not in it, because it is refused
and therefore has no digest: a **consumed result** with no returning candidate
(`let v: byte = hook();`, both candidates `fn(): byte` looping forever) is refused at zero
arguments and builds at one argument, exactly like the void case. It is recorded in the half A
design above because it decides whether the fix is uniform over the result branch.

The two rows that matter are adjacent: `thunk-nonreturning` is refused and `chain-nonreturning`
builds, and they differ only by one unused parameter. The
`thunk-nonreturning-no-consumer` row was added after the preflight and is the most important one
for byte-neutrality: it is the same never-returning dispatch with nothing after the call, it
**builds today**, and it travels the exact path this unit changes. It was measured in all four
modes and reproduced across two independent runs, and its `none` digest matches an independent
single-program probe. The three optimized modes agree with each
other and differ from `none` throughout, which is the expected shape.

| Example | Digest |
| --- | --- |
| `boing-ball` | `75fecef4c692b1eb` |
| `foundation` | `aafbc004571cc57c` |
| `m1` | `edcd65feab8c43c5` |
| `rd06-assets` | `93b812b661aac655` |
| `rd06-charpad` | `c9eb256171b24324` |
| `rd06-spritepad` | `a4d7702851e776a4` |
| `rd07-loadable` | `811dd3d3e6d7d011` |

A control for a module-level callable was dropped rather than recorded as refused: its source
declared an initializer at module level, which is `E10010` — a language rule about executable
statements, with nothing to say about dispatch. Keeping a `REFUSED` row for it would have implied a
dispatch defect that does not exist.

No example declares callable-typed storage, so the corpus is expected to be untouched by either
half. It is captured as an independent guard, not as the primary evidence.

## T-36.2 evidence — the frozen oracle and its reproduced RED

`test/rd04/nonreturning-dispatch-candidates.spec.test.ts`, frozen at blob
`22e01e757bb305d770226f1a8280260b1ac31025`. Ten programs — a function variable that may hold
either of two candidates chosen at run time, a call through it, then ordinary arithmetic and a
write — each judged by `build` in all four optimization modes and by `check`, for 50 cases. It
asserts **acceptance only**: no instruction sequence, no diagnostic code, no message, no span, so
the diagnostic half of this unit cannot make it fail.

**RED reproduced by the parent, not taken on the author's report: 10 failed / 40 passed of 50.**

| Group | Outcome | What it establishes |
| --- | --- | --- |
| Zero arguments, both candidates loop forever, `void` and `byte` results, four modes | 8 failed | The defect, in both result shapes |
| The same two programs under `check` | 2 failed | `check` agrees with `build` in refusing, so an author is not told the program is fine and then refused |
| One argument, both candidates loop forever | passed | The asymmetry: the twin differing only by an ignored parameter is accepted |
| Both candidates return, four modes plus `check` | passed | The ordinary surrounding case a repair may not break |
| Mixed candidates, both declaration orders | passed | A mixed set already works at zero arguments, so the gap is specifically *all* candidates non-returning |

Every failure reports `COMPILER_INCOMPLETE` at error severity — a genuine refusal, not a harness,
import or type error. Checked independently: the file imports only the public compiler API, the
shared profile fixture and vitest, so it reaches no machine internals; it carries no plan, task or
issue identifier; `prettier --check` is clean and `tsc --noEmit -p tsconfig.json` exits 0. The
repository's `yarn typecheck` reported a full cache hit and would not have checked this file, so
the direct compiler run is the real evidence.

The author disclosed two things, both recorded rather than waved through. A markdown-scoped search
for the diagnostic code matched this repository's own plan files, so some baseline text was seen;
it cannot have shaped the oracle, which asserts acceptance only and can distinguish no dispatch
shape from another. And the pre-authoring measurement that a never-returning `byte` function is
accepted today ran through the public API from stdin rather than by reading implementation sources.

## T-36.4 evidence — half A implemented and measured

The frozen oracle is **GREEN at 50/50** and was never edited: its blob is still
`22e01e757bb305d770226f1a8280260b1ac31025`, and `git status` reports nothing modified under `test/`
or `spec/`.

**Byte-neutrality, measured rather than argued.** The capture was re-run after the change and
compared against the baseline. Exactly one line differs across every control in all four modes and
all seven examples:

| Control | Before | After |
| --- | --- | --- |
| `thunk-nonreturning` | `REFUSED` in all four modes | `64f3c0c7fc99a2f0` / `08cc39084bbd716b` ×3 |

Everything else is identical, **including `thunk-nonreturning-no-consumer`** — the control the
preflight required, which travels the changed path and built before the change. Its digests are
unmoved at `044801b51c3f54bc` and `39a2c88bc1e0bbcf`. That is the finding PA-001 raised, answered
by measurement.

**The emitted shape for the newly accepted program**, which is the acceptance PA-005 asked for
instead of "no longer refused":

```
block_3:
  jsr+2 block_5
block_4:
  lda $c002
  ...
  clc
  adc $0af3
  ...
  jmp+2 b65_startup_block_1
block_5:
  jmp ($0af1)
```

The call block ends at the `jsr` with no instruction after it — the `unreachable` terminator,
inventing no executable edge. The dispatch thunk's `jmp ($0af1)` is untouched, so the shape the
pre-existing expert-call authority demands is preserved. The dead tail sits in the continuation
block, exactly as the comparison chain already emits it.

**One DRY change beyond the fix.** The non-returning test existed twice inline in the comparison
chain and would have become three copies. It is now one documented helper used by all three sites,
which is why the chain controls are byte-identical above — that is the check that the extraction
changed nothing.

### Half A implementation tests

`test/rd04/nonreturning-dispatch-shape.impl.test.ts`, **30 passed**. These cover what the public
oracle cannot express, since it judges acceptance only:

| Case | What it pins |
| --- | --- |
| The calling block ends at the `jsr` | Nothing follows it before the next label, in all four modes — the `unreachable` terminator invents no edge |
| The indirect transfer survives, and no candidate comparison appears | Acceptance was not bought by abandoning the cheap pointer jump for an address-comparison chain |
| The arithmetic after the call is still lowered | Unreachable work is still emitted, so the two routes do not disagree about it |
| All four candidate profiles, both declaration orders | The block gets an ordinary exit exactly when some candidate can return, and none when none can |
| The one-argument twin takes the comparison chain | The contrast between the routes is a route difference, never a difference in acceptance |

The thunk is located by its body rather than its name, because emitted labels are hex-encoded and
a name match silently never fires — the first draft of this file did exactly that and reported a
false failure.

### Targeted suites

| Suite | Result |
| --- | --- |
| The frozen oracle | 50/50 |
| `test/rd04` dispatch, the frozen prior oracle, and the expert-call authority | 107 passed across 4 files |
| `packages/compiler` validator plus the three frozen boolean oracles | 70 passed across 4 files, validator 31/31 |
| `yarn test:changed --host` | 256 files / 5,437 passed |
| `yarn test` — host tier | 257 files / 5,467 passed |
| `yarn test` — package tier | compiler 259 files / 4,348 passed with 2 skipped; CLI 70; language server 21; VS Code 18 |
| `yarn build`, `yarn typecheck`, `prettier --check` | exit 0 |
| After the three review minors | the capture re-run is identical to the post-fix measurement; the two impl suites and the oracle are 90 passed across 3 files |

### The tests were watched failing, not assumed to be meaningful

The fix was reverted, the compiler rebuilt, and both new suites run again: **27 failed / 53 passed
of 80**. With the fix restored they are **80/80**, and the restored source is byte-identical to what
was tested (same checksum). So neither suite passes for a reason other than the change.

An earlier run of `yarn test` had its package-tier counts swallowed by a `tail` in the command, so
those numbers come from a separate `yarn test:package` run served entirely from the task cache
rather than from the chain's exit status alone.

## T-36.5 and T-36.6 evidence — half B implemented and measured

The refusal now locates itself. Before and after, for the direct-call program that the MC-004
probe showed still reaches the validator path:

| | Message | Span |
| --- | --- | --- |
| Before | `The machine storage binding stage is not complete for this program` | `null` |
| After | `Machine storage binding did not complete for 'main' — the selected 'adc' has no proved producer for its decimal flag` | `src/game.blend` bytes 125..140 |

Bytes 125..140 are exactly `i + peek($C003)` — the addition that lost its producer, not the
function header and not a guess. The `help` line reads *"Compiler limitation in generated block
'…', not an error on this line; please report it with the source shown"*, which is the answer to
the challenger's objection that a caret under correct source invites an author to edit a line that
is not wrong.

The validator's finding turned out to be more precise than the design packet's own example
prose, which guessed the carry flag: `clc` proves carry, and it is the `jsr` that loses the
**decimal** flag. The message says so.

### The one-way safety property, checked in the code rather than taken on report

The finder ends `if (valid) return null; return defect ?? <synthesised defect>`. So `null` is
returned only on a positive verdict, and a negative verdict cannot return `null` even if every
recording site were to miss. Verified directly: the duplicate-label path now returns a defect where
it returned `false`; the verdict expression `functions.every(…)` is unchanged; the `valid &&= …`
sites only extract their condition into a local and record beside it, so the deliberate
non-short-circuiting is intact; and every recording site inside the transfer remains gated on
`check`, so the fixpoint pass records nothing.

### Verification

| Check | Result |
| --- | --- |
| Byte-neutrality — all 7 controls × 4 modes and all 7 examples | **identical** to the half A measurement. A diagnostic moved no byte |
| Equivalence — 31 validator cases, the 3 frozen boolean oracles, the new defect tests, the contracts test | 90 passed across 6 files |
| End-to-end refusal tests (`test/rd04/machine-binding-refusal.impl.test.ts`) | 5 passed, and **4 of the 5 fail with half B reverted** |
| Frozen oracles and `spec/` | untouched; `git status` reports nothing modified, and the dispatch oracle's blob is unchanged |
| `yarn build`, `tsc --noEmit`, `prettier --check` | exit 0 |
| Compiler package, full | 260 files / 4,360 passed, 2 skipped |
| Host tier, full | 5,471 of 5,472 passed; the one failure is an explicit 120-second timeout at 121,013 ms in an emulator-backed file that passes 4/4 in isolation and passed all four profiles at 47–62 seconds in an earlier run. Disclosed with its attribution in the findings, not re-run until green |

The end-to-end layer exists only because the MC-004 probe refuted this plan's earlier claim that
no legal program could reach the refusal. It pins the code, the presence of a span and the span
falling inside the author's own file — never an offset, because which internal check reports first
follows a work-list order that is deterministic per program but not canonical.

One existing implementation test was edited and the change is a strengthening, not a relaxation:
it asserted exact object equality on the bind error, which the new optional field broke, so it now
asserts the same three fields through `objectContaining` **and additionally requires** the refusal
to carry a witness naming the failed check.

### Scope held

Only the validator-detected producer gains a witness, per the ruling. `bind.ts:556`, `:561`,
`:569` and `:574` are untouched and owned by **#174**. The size-candidate path at
`size-selection.ts:978` is likewise unchanged.

## T-36.1 appendix — the control programs the digests were taken from
These are recorded so the pinned digests above can be re-derived rather than remembered. Each
builds against the same manifest: entry `Game`, target `c64-pal-prg-kernal-6581`, source root
`src`, with the optimization mode supplied per build.

### `thunk-returning`

```
module Game;
function one(): void { poke($C100, 1); }
function two(): void { poke($C100, 2); }
function main(): void {
  let hook: fn(): void = &one;
  if (peek($C000) == 1) { hook = &two; }
  hook();
  let i: byte = peek($C002);
  i = i + peek($C003);
  poke($C101, i);
}
```

### `thunk-mixed`

```
module Game;
function one(): void { poke($C100, 1); }
function spin(): void { while (true) { } }
function main(): void {
  let hook: fn(): void = &one;
  if (peek($C000) == 1) { hook = &spin; }
  hook();
  let i: byte = peek($C002);
  i = i + peek($C003);
  poke($C101, i);
}
```

### `thunk-nonreturning`

```
module Game;
function spinA(): void { while (true) { } }
function spinB(): void { while (true) { } }
function main(): void {
  let hook: fn(): void = &spinA;
  if (peek($C000) == 1) { hook = &spinB; }
  hook();
  let i: byte = peek($C002);
  i = i + peek($C003);
  poke($C101, i);
}
```

### `thunk-nonreturning-no-consumer`

```
module Game;
function spinA(): void { while (true) { } }
function spinB(): void { while (true) { } }
function main(): void {
  let hook: fn(): void = &spinA;
  if (peek($C000) == 1) { hook = &spinB; }
  hook();
  poke($C101, 1);
}
```

### `chain-nonreturning`

```
module Game;
function spinA(n: byte): void { while (true) { } }
function spinB(n: byte): void { while (true) { } }
function main(): void {
  let hook: fn(byte): void = &spinA;
  if (peek($C000) == 1) { hook = &spinB; }
  hook(7);
  let i: byte = peek($C002);
  i = i + peek($C003);
  poke($C101, i);
}
```

### `chain-returning`

```
module Game;
function one(n: byte): void { poke($C100, n); }
function two(n: byte): void { poke($C100, n); }
function main(): void {
  let hook: fn(byte): void = &one;
  if (peek($C000) == 1) { hook = &two; }
  hook(7);
  let i: byte = peek($C002);
  i = i + peek($C003);
  poke($C101, i);
}
```

### `single-target`

```
module Game;
function one(): void { poke($C100, 1); }
function main(): void {
  let hook: fn(): void = &one;
  hook();
  let i: byte = peek($C002);
  i = i + peek($C003);
  poke($C101, i);
}
```

### `thunk-result`

```
module Game;
function one(): byte { return peek($C100); }
function two(): byte { return peek($C101); }
function main(): void {
  let hook: fn(): byte = &one;
  if (peek($C000) == 1) { hook = &two; }
  let v: byte = hook();
  v = v + peek($C003);
  poke($C102, v);
}
```
