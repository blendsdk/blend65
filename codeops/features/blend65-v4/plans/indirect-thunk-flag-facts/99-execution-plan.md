# Indirect-call thunk flag facts (#170, bounded unit)

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: T-35 / #170
> **Progress**: 4/6 tasks (67%)
> **Status**: Executing — repair verified and mutation-checked; reviews pending
> **Last Updated**: 2026-11-20 11:55
> **Baseline**: `e79c367b`, clean `feature/v4-rebuild`
> **Phase baseline tree**: `0ab13159e5e72c90e9f89df72a54b4ceb2f73116`
> **Scope**: strict; the flag summary of a tail-transferring dispatch thunk
> **Reasoning**: high — a machine-state validator whose facts must survive every validation site
> **Created**: 2026-11-20

## Objective and authority

Stop the compiler refusing a program that calls through a function pointer and then performs an
addition or subtraction. The cause is located and proved in [the findings](05-findings.md): the
`jmp (ptr)` dispatch thunk owns no returning block, so `validateMachineFlags` collapses its
summary to "preserves nothing", the next `adc`/`sbc` loses its decimal-flag producer, and the
whole program is reported as malformed machine state.

The emitted code is already correct and already qualified —
`test/rd04/expert-calls.impl.test.ts:83-101` pins the `jsr <thunk>` / `jmp (ptr)` shape as the
expert expectation and passes today. This unit changes no instruction, no storage home and no
cycle cost. It repairs bookkeeping about code that was always right.

**Smallest viable design:** record the thunk's finite candidate set on its own block, and have the
validator summarise the thunk as the meet of those candidates' existing summaries. Add no pass, no
solver, no cache, no diagnostic and no terminator kind.

## Requirements and boundaries

1. The refused program must build, in all four optimization modes and under `check`, and must
   still emit the thunk. A repair that replaces the `jmp (ptr)` dispatch with a comparison chain
   does not satisfy this unit.
2. The validator keeps its true-negative power. A thunk whose candidate genuinely clobbers a flag
   consumed after the call must still be refused.
3. The validator gains precision it is already designed for: when every candidate establishes a
   flag the caller consumes afterwards, the program must be **accepted**. An ABI-floor design
   fails this, and the test for it is what distinguishes the chosen design from that shortcut.
4. Soundness rests on exactly one assumption, named here rather than left to inference: the
   recorded candidate set is complete. That is the front end's existing finite-target obligation
   at `machine/lower-indirect.ts:44-46`; this unit inherits it and adds no new dependency.
5. The failure direction must stay safe. A dropped or stale recorded set degrades to today's
   `{ returns: 0, preserves: 0 }` and therefore to a refusal. No path may turn it into an accepted
   wrong program.
6. Accepted programs keep their bytes, costs and storage demands. The recorded set is validation
   metadata and must not reach the emitters or any cost model.
7. A candidate already under analysis contributes `{ returns: 0, preserves: 0 }` **without**
   marking the summary invalid, so a callable holding its own address keeps its current
   acceptance. `validate-flags.ts:88` returns `valid: false` for an active entry, and that value
   must not propagate into the meet.
8. Named exclusions, recorded in code rather than inferred:
   - the override keys on the **recorded set**, never on `hasReturn === false`. The latter equally
     describes callees that genuinely never return, such as the `returningBodies === false` arms at
     `machine/lower-indirect.ts:215-218`, whose summaries must not change;
   - the repair claims nothing about BCD safety. `validate-flags.ts:38-43` tracks whether a
     producer exists and whether a bit still equals the entry bit, not flag values, and `sed` is
     itself a producer (`:149-151`). A candidate that executes `sed` and returns stays accepted,
     exactly as a direct call to it is accepted today.
9. Still unqualified afterwards and explicitly not claimed:
   - the `COMPILER_INCOMPLETE` diagnostic's missing span, help and pointer. Named as a second
     defect in #170, spanning `services/services.ts:156,396,495` and
     `services/size-selection.ts:244,1017`;
   - worst-case cycle accounting through a thunk (`services/entry-path-cycles.ts:324` abandons a
     path on an `unreachable` terminator) and NMI wrapper inflation
     (`machine/nmi-entry.ts:46` calls `preserveAll()` on an indirect `jmp`). Both are the same
     terminator's victims, neither is a refusal;
   - the identical hole for a `jsr` the validator cannot resolve, pinned at
     `machine/validate-flags.impl.test.ts:202`. `machine/lower-load-unit.ts:174-175,197`
     compensates with an explicit `cld` for the KERNAL route. Whether user code can reach a raw
     `jsr` without that compensation is **unverified**; if it can, it is a separate defect of the
     same family and gets its own unit.

Existing `*.spec.test.ts` files, shared helpers, `spec/`, the frozen expert authority and release
records stay unchanged. The new specification file becomes immutable once its RED is recorded.

## Grounded design

### Why the meet is the sound summary

Every execution of `jsr T`, for thunk `T` with recorded set `S`, transfers control to the entry of
some candidate in `S` and returns exactly as a direct `jsr` to that candidate would: `jmp (ptr)`
consumes no stack slot, so the candidate's own `rts` pops the thunk's return address. The sound
summary of `T` is therefore the intersection over `S` — the same operation the validator already
applies at a control-flow join (`meetStatus`, `machine/validate-flags.ts:52-54`).

Two sub-conditions make the composition exact rather than approximate. Each candidate's summary is
computed under the entry assumption `ABI_FLAGS` (`:169`), which is the same assumption used for an
ordinary direct call, so no re-contextualisation is needed. And `machine/lower-indirect.ts:84-97`
admits the thunk route only when no candidate has an interrupt-context variant, so the stored
pointer is the canonical label of the ABI selected at that call site and the runtime value cannot
be an address outside `S`.

### Where the set is recorded

The set is in hand at `machine/lower-indirect.ts:34` as `targets` and is written onto the thunk
block at `:100-108`, as `bindingLabel("fn", candidate)` per entry. Labels rather than binding ids,
because `machine/lower.ts:177` sets a function's `id` to `bindingLabel("fn", semantic.id)` and
`validate-flags.ts:72,78` resolves a function id to its entry block label, so a recorded label
feeds `analyze` directly.

A block field is preferred over a program-level map on two grounds: the data is already in scope at
the write site, whereas a map must be threaded through `FunctionLoweringState` → `lower-function`
→ `lower.ts`; and it places the fact where the thunk terminator's other two victims would consult
it.

### Where the set is consumed

At summary assembly, `machine/validate-flags.ts:230-236` — not at the call site. The thunk body
still goes through the ordinary walk, so the duplicate-label check (`:74`), the stack-shape check
(`:190-198`) and the per-instruction checks (`:124-127`) keep applying to it. The call site at
`:107-115` already routes `jsr <thunk>` through `analyze`, and `:143` consumes the summary
unchanged, so neither needs editing.

### The hazard that decides the unit

`validateMachineProgram` runs at **six call sites**, not one: `machine/bind.ts:585`,
`services/size-observers.ts:123,124` (physical and final), `layout/c64-layout.ts:913,918`
(resolved and compacted) and `artifacts/acme-validate.ts:84`. The recorded set must survive every
block-rewriting pass up to ACME validation.

Audited and safe: `bindFunction` (`machine/bind.ts:283-297`) rebuilds with
`Object.freeze({ ...block, instructions })`, so optional fields pass through;
`shareBoundRootBodies` (`:493-543`) fingerprints `JSON.stringify([fn.sourceName, fn.blocks])`
excluding only observer fields, so the new field participates and two thunks with different sets
cannot merge; `redirectBoundLabels` (`:446-490`) would not rewrite the field, but its redirect keys
are only merged-away irq-root ids, which never match a plain `fn.<key>` candidate label — this
needs a comment at the field declaration so a future extension cannot silently invalidate it;
`shareBoundByteMultiplyHelpers` and `mergeObserverBlock` spread the existing block.

Unaudited and to be settled by evidence, not argument: `selectTerminalByteLeaves` and
`selectByteWindows` (`machine/lower-function.ts:1029-1049`), `selectSwitchDispatch` (`:1022`),
`machine/optimization-cleanup.ts`, and post-layout compaction. Precedent is encouraging but not
conclusive — the optional block field `observerBodies` is already read at post-layout stages. The
end-to-end artifact test in T-35.1 is the instrument that settles this, because compiling the
repro through the full CLI pipeline exercises every validation site, which a direct
`validateMachineProgram` unit call does not.

### Design challenge

An independent challenger received the defect, five candidate designs and the hazard question
without being told which was preferred. It selected this design, supplied the keying correction in
boundary 8, the active-candidate rule in boundary 7, the five-stage hazard, the "producer existence
is not a flag value" correction in boundary 8, and a sixth option not in the packet — emitting
`cld` after the thunk `jsr`, which is this codebase's own idiom at
`machine/lower-load-unit.ts:174-175`. That option is rejected on the expert-expectation directive:
the precedent applies where the hardware truth is unknown, while here the callees are known
Blend65 functions whose BCD sequences restore `cld` themselves
(`machine/lower-arithmetic.ts:193,217,237,272`), so it would pay two bytes and two cycles per
indirect call to re-establish an invariant that already holds.

The challenger's own strongest argument against the design is recorded rather than dismissed: it
adds a data channel that must survive many block-rewriting passes, whereas an ABI floor is three
lines and can never go stale. It is discharged by the safe failure direction in boundary 5 and by
the end-to-end test, not by denying the hazard.

## Specification-first evidence

The specification file is authored first, independently, and frozen by hash after a meaningful RED.
Its expectations come from the required behaviour, never from the implementation.

| Axis | Shape | Expected |
| --- | --- | --- |
| Repro, end-to-end | The refused program, compiled through the full pipeline to an artifact, in all four modes and under `check` | Builds, emitting `jsr <thunk>` and `jmp (ptr)`. This is the test that enforces metadata survival across every validation site |
| Precision | Both candidates establish a flag the caller consumes after the call, with no local producer | **Accepted.** An ABI-floor design refuses this |
| True negative | One candidate performs an opaque restore (`pha`/`plp`), then `adc` after the call | **Refused** — the meet drops the flag. An ABI-floor design wrongly accepts |
| Meet semantics | One candidate establishes a consumed flag, the other clobbers it | Refused |
| Thunk body checks still live | Thunk reached with an unbalanced stack shape, or a duplicate label | Refused, as today |
| Indirect recursion | A callable holding its own address, called through it | Acceptance unchanged from before the repair |
| Route coverage | Every row of the findings matrix: addition before the call, `i << 1` after, `i - 1` after, single target, call with arguments, struct-field and module-level callables | Each builds via its documented route |
| Accepted-output identity | The committed example corpus and the thunk-route controls | Byte-identical payloads in all four modes |

Controls that must stay red, unchanged: `machine/validate-flags.impl.test.ts:100,202,220,236`.
Frozen oracles that must stay green and unedited: `machine/status-provenance.spec.test.ts` and
`machine/terminal-legality.spec.test.ts`.

### Which axes the frozen oracle may own

Three axes above — Precision, True negative and Meet semantics — are stated as machine-program
shapes, because that is the level at which the behaviour is defined. An oracle author working only
from required behaviour may be unable to express them from Blend65 source without knowing how
candidates lower, and an oracle that encodes lowering knowledge is no longer
implementation-blind.

Settle this at authoring time rather than mid-RED. Any axis that cannot be reached from source
alone moves to the T-35.3 implementation tests, where `machine/validate-flags.impl.test.ts`
already constructs synthetic machine programs directly. The frozen oracle keeps the axes that are
genuinely source-expressible: the end-to-end repro, route coverage and accepted-output identity.
Record in T-35.1 which axes moved and why, so the division is evidence rather than convenience.

## Small execution chunks

- [x] T-35.1 Author the assigned specification tests independently, including the end-to-end
      artifact case that crosses every validation site, run meaningful RED, freeze the oracle
      hash and capture accepted-control baselines. No production code. ✅ (implemented:
      2026-11-20 09:18 · completed: 2026-11-20 09:27)
- [x] T-35.2 Record the candidate set on the thunk block and consume it as a meet at summary
      assembly, keyed on the recorded set, with the active-candidate rule and the redirect comment.
      Make the oracle green without editing it. ✅ (implemented: 2026-11-20 09:52 · completed:
      2026-11-20 10:01)
- [x] T-35.3 Add implementation tests for the meet, the active-candidate fallback, the keying
      distinction against genuinely non-returning callees, and survival of the recorded set through
      binding, body sharing and post-layout compaction. Confirm accepted programs keep their bytes,
      costs and storage demands. ✅ (implemented: 2026-11-20 10:08 · completed: 2026-11-20 10:13)
- [x] T-35.4 Run the related suites only: the new oracle, the flag-validation and expert-call
      suites, the callable suites, the compiler machine and service tests, and the serialized
      emulator case proving the dispatch returns the right value. Record the exact coverage.
      ✅ (implemented: 2026-11-20 11:40 · completed: 2026-11-20 11:55)
- [ ] T-35.5 Obtain the independent reviews below; repair or refute every finding and record the
      dispositions for the user's ruling.
- [ ] T-35.6 Run the complete checkpoint once, close the unit with its residual owners, sync the
      roadmap and commit locally. Never push automatically.

## T-35.1 evidence

### The frozen oracle

Authored by an independent author that received required behaviour only. The design documents and
the five repair-site source files were on an explicit forbidden list, and the author confirmed it
opened none of them; compiler types reached the oracle only through the public package import.

| File | Lines | Frozen blob | Owns |
| --- | --- | --- | --- |
| `test/rd04/function-pointer-arithmetic.spec.test.ts` | 256 | `e399500f78a467493cbd7897a128a9b5ff65ea18` | Build in four modes, `check`, route coverage, determinism |
| `test/rd04/function-pointer-arithmetic-vice.spec.test.ts` | 129 | `52f0a711c03cfe0aff15ee18e75a6852c90fee0f` | Runtime values on a real emulator |

Both hashes are recorded before any production change and must be unchanged at closeout. A failing
case in either file means the implementation is wrong.

### Meaningful RED, reproduced by the parent

| Tier | Result | Cause |
| --- | --- | --- |
| Host | 14 failed, 32 passed of 46 | Every failure is `COMPILER_INCOMPLETE` with category `compiler` |
| Emulator | 1 failed, 1 passed of 2 | The two-target case is refused; the single-target case ran on a real emulator and returned 11 with the arithmetic applied |

The failing host cases are exactly the required-behaviour axes — eight build cases (addition and
subtraction across four modes), two `check` cases and four determinism cases. All 32
route-coverage cases pass, confirming the controls are genuine controls rather than cases that
happen to be broken too.

The passing emulator case is load-bearing in two ways: it proves the harness and the breakpoint
work before the repair exists, and it pins that dispatch really reaches the second function, so a
repair that hardwires dispatch to one target cannot satisfy both cases.

Checks run alongside: `prettier --check` clean on both files, `yarn typecheck` exit 0, and the
ephemeral-artifact grep finds no reference to any plan, requirement, task or issue identifier in
either file.

### Accepted-output baselines, captured before any production change

Taken at `c2e78a92` on 2026-11-20, so the repair can be proved byte-neutral for every program
that already builds. Values are the first 16 hex digits of the payload SHA-256. The three
optimized modes agree with each other throughout and differ from `none`, which is the expected
shape.

| Control | `none` | `balanced` / `speed` / `size` |
| --- | --- | --- |
| The refused program itself | REFUSED | REFUSED |
| Arithmetic removed | `cd8de9b31bcf4b0a` | `c2ccac46ff4b3126` |
| Shift instead of addition | `ff67751273d55750` | `a72500bdbd7905b6` |
| Addition before the call | `29cf2fd15b7996f1` | `5f233245cd7a6117` |
| One distinct target | `e76ff7bb639271fc` | `e18b3b8dd6e09fe0` |
| Callable takes an argument | `e413b11e2b923a41` | `34fded61f5cd1345` |
| Callable in a local struct field | `3532fa8bf4c4a17b` | `f2752fb234b02131` |
| Callable in a module-level variable | `64a21367f31b35b9` | `6f725d0a52da977e` |
| Addition inside a callee after the call | `cd81c6d7b0913c97` | `08e528151970cc71` |

Example corpus, default manifest mode, combined payload digest per project:

| Example | Digest |
| --- | --- |
| `boing-ball` | `baf7889ae25c8cd8` |
| `foundation` | `a1ed15b5d43e08a4` |
| `m1` | `bbe8c9cfceb1380a` |
| `rd06-assets` | `07f6e17871ee4851` |
| `rd06-charpad` | `3ab1e58ecd733a1b` |
| `rd06-spritepad` | `b0316c1fe746a295` |
| `rd07-loadable` | `343409058c5a3aa6` |

No example declares callable-typed storage, so the corpus is expected to be untouched by this
repair; it is captured as an independent guard rather than as the primary evidence.

### Which axes the frozen oracle took

Applying the rule recorded above: the oracle owns the axes reachable from source alone — the
refused program building in all four modes and under `check`, correct runtime behaviour on the
emulator, route coverage for every program that already builds, and build determinism. The
Precision, True-negative and Meet-semantics axes are stated as machine-program shapes and cannot
be constructed from Blend65 source without knowing how candidates lower, so they move to the
T-35.3 implementation tests, where synthetic machine programs are already the established idiom.
The accepted-output identity axis is parent-side evidence rather than an oracle assertion, so that
no pre-repair hash is frozen into an immutable file.

## T-35.2 evidence

63 inserted lines across three files, which is the whole repair:

| File | Change |
| --- | --- |
| `machine/machine-types.ts` | `indirectTargets?: readonly string[]` on `MachineBlock`, documented with why a tail-transferring block cannot answer from its own exit, and with the label-redirection caveat recorded at the declaration |
| `machine/lower-indirect.ts` | The dispatch block records `bindingLabel("fn", candidate)` for each proved candidate |
| `machine/validate-flags.ts` | `dispatchCandidates` plus the meet at summary assembly |

### The soundness guard chosen during implementation

The plan called for keying on the recorded set. Composing a candidate meet onto the block's own
facts is only equal to a direct call while the block contributes nothing itself, so
`dispatchCandidates` returns the set only when the block is exactly one indirect `jmp` — which is
how it is built. A block that ever gained flag-setting work, a call, or stack traffic falls back
to the previous conservative summary and therefore to a refusal, never to an unsound acceptance.
This is a soundness precondition on the composition, not the returning-path proxy the design
rejected.

### Results

| Check | Result |
| --- | --- |
| Frozen oracle, host tier | **46/46 passed**, up from 14 failed / 32 passed |
| Frozen oracle, emulator tier | **2/2 passed**, up from 1 failed / 1 passed. The two-target dispatch returns 37 with the arithmetic applied; the single-target returns 11 |
| Oracle hashes | `e399500f…` and `52f0a711…` unchanged, and Git reports both files unmodified since their commit |
| `yarn test:fast` | 180 files / 2,845 passed, 2 skipped; 45 files / 1,282 passed. No failures |
| `yarn build`, `yarn typecheck` | exit 0 |
| Leak checks | No plan, requirement, task or issue identifier in the changed source |

### The dispatch survived, which was the point

For the formerly refused program the emitted assembly still contains `jmp ($0af2)` reached by
`jsr`, contains **zero** `cmp #<(…)` candidate comparisons, and still carries `clc` / `adc #$01`.
The repair did not buy buildability by degrading the dispatch to a comparison chain.

### Byte-neutrality for programs that already compiled

All eight control programs produce payloads identical to their pre-repair baselines in all four
modes. Every one of the seven example projects produces a byte-identical artifact, measured by
building the corpus at the pre-repair source state and again with the repair applied.

A first measurement appeared to show all seven examples changing. That was a defect in the
measuring script, which folded `sha256sum` output — including the artifact path — into the digest,
and generation directories carry a random identifier per build. Re-measured on artifact content
alone, pre and post agree exactly. The mistake is recorded because the corrected method is what
the closeout evidence depends on.

## T-35.3 evidence

Eight cases added to `machine/validate-flags.impl.test.ts` (12 with parameter expansion, file now
24 passing) and a four-mode case in `test/rd04/function-pointer-dispatch.impl.test.ts`.

### The cases, and which of them actually discriminate

The new cases were mutation-checked: the committed consumer was replaced with its pre-repair
version while the recorded field and its writer stayed in place, and the suite was re-run.

| Case | Without the consumer | Role |
| --- | --- | --- |
| Relies on a fact every reachable function establishes | **fails** | Discriminates the repair. Also the case an ABI-floor design would refuse |
| Requires every reachable function to establish the consumed fact (agreeing arm) | **fails** | Discriminates the repair |
| Requires every reachable function to establish the consumed fact (disagreeing arm) | passes | Pins the intersection as a real meet rather than "any candidate" |
| Stops trusting a fact the caller established when a reachable function discards it | passes | Retained true negative |
| Keeps the conservative answer when the targets are unknown | passes | Pins the keying: an unrecorded indirect transfer stays untrusted, so the repair is not keyed on a missing returning path |
| Keeps the conservative answer when the recorded set is empty | passes | Degenerate input |
| Keeps the conservative answer when the dispatch block carries work of its own | passes | Guards the composition precondition |
| Terminates on a pointer that can reach its own caller, both arms | passes | Cycle safety and unchanged acceptance |

Exactly two cases fail without the consumer, which is the honest count: the other six pin
behaviour that must **not** change and therefore guard against a future implementation reaching
further than this one. They are regression guards, not evidence for the repair.

### Survival across every validation site

`test/rd04/function-pointer-dispatch.impl.test.ts` builds the repaired program through the real
pipeline in all four modes and passes 4/4. Acceptance of that program depends on the recorded
facts, and the layout is validated again after binding, after cost selection, after address
resolution, after compaction and before assembly, so a published artifact is evidence the facts
survive every one of those sites. A stage that dropped them would reject the program there.

The same case carries the two assertions the implementation-blind oracle cannot make: the emitted
assembly contains the indirect transfer, and contains **zero** candidate address comparisons, so
the program was not made acceptable by replacing the pointer jump with a comparison chain.

| Check | Result |
| --- | --- |
| `machine/validate-flags.impl.test.ts` | 24/24 |
| `test/rd04/function-pointer-dispatch.impl.test.ts` | 4/4 across four modes |
| Mutation check | 2 of 8 new cases fail without the consumer, as predicted |
| `yarn test:fast` | 180 files / 2,854 passed, 2 skipped; 45 files / 1,282 passed |
| `prettier`, `typecheck` | clean, exit 0 |
| Leak checks | no plan, requirement, task or issue identifier in either file |

## T-35.4 evidence

Directed coverage only. The complete corpus is T-35.6's single checkpoint.

| Suite | Files | Result |
| --- | --- | --- |
| `test/rd04` host tier, the whole callable and function-value area | 113 | 1,300 passed |
| Compiler package `machine/`, `services/`, `storage/`, `layout/` | 145 | 2,429 passed, 2 skipped |
| `yarn test:fast` | 180 + 45 | 2,854 passed / 2 skipped, and 1,282 passed |
| Frozen oracle, host | 1 | 46/46 |
| Frozen oracle, emulator | 1 | 2/2 |
| Dispatch survival, four modes | 1 | 4/4 |
| Directed emulator set | 5 | 9 passed |

No failures anywhere, and nothing skipped that was previously running.

### The emulator result that matters most

`test/rd04/expert-calls.impl.test.ts` passes. That case independently requires the published
assembly to contain at least three dispatch blocks of the exact form `jsr <label>` into
`<label>: jmp ($xxxx)`, and requires the pointer's low byte not to be `$FF`. It is the repository's
existing statement of what expert output for a pointer call looks like, it was written before this
unit, and it is unchanged. Its passing is the strongest available evidence that the repair left the
generated dispatch alone rather than buying buildability with worse code.

`test/rd04/callable-field-helper-vice.spec.test.ts` (4 cases) and
`test/rd04/function-values.spec.test.ts` cover the neighbouring callable routes on a real emulator
and are likewise unchanged and green.

## Verification

| Stage | Command |
| --- | --- |
| Inner loop | `yarn test:fast` |
| Directed | the new oracle, `machine/validate-flags.impl.test.ts`, `test/rd04/expert-calls.impl.test.ts`, `test/rd04/function-values.spec.test.ts` |
| Before the commit checkpoint | `yarn test:changed --host`, then `yarn test` |
| Phase closeout | `yarn install`, `yarn build`, `yarn typecheck`, then `yarn test:full` |

Commits use the git-commit skill. Pushing is never automatic.

## Specialist Agents

| Role | Bounded responsibility at review |
| --- | --- |
| correctness-reviewer | Scope, maintainability, oracle authority, evidence honesty |
| machine-code-auditor | The meet's soundness, the keying distinction, accepted output keeping its bytes and costs |
| sfa-abi-auditor | The claim that `jmp (ptr)` consumes no stack slot and the candidate's `rts` returns to the thunk's caller |
| semantics-reviewer | Retained true negatives, the new precision, and the completeness of the recorded set |
| performance-auditor | Added host validation cost of the meet across every validation site |

Specialist check: **None new** — these existing roles already own machine-state validation and the
call ABI, and the unit adds no contract they do not already review.

## Scope of later implementation

Expected production edits: `machine/machine-types.ts` (the optional block field),
`machine/lower-indirect.ts` (the write site) and `machine/validate-flags.ts` (summary assembly).
Owned tests: the new specification file and new or affected `*.impl.test.ts`.

## Residual owners

| Residual | Observed behaviour | Owner |
| --- | --- | --- |
| `COMPILER_INCOMPLETE` carries no span, help or pointer | An author is told only that an internal stage did not finish | #170, second defect. **On T-35.6 closeout, either keep #170 open for it or file the successor issue first** — this repair makes the path unreachable for this program class but leaves the diagnostic unchanged, so closing #170 on the strength of this unit would orphan a defect with no owner |
| Cycle accounting abandons any path through a thunk | Worst-case cycle proofs give up rather than refuse | Same terminator, own unit |
| NMI wrappers over-save around an indirect `jmp` | Larger wrapper than necessary | Same terminator, own unit |
| A `jsr` the validator cannot resolve collapses the same way | Would refuse arithmetic after a raw KERNAL call; reachability from user code unverified | Separate unit once reachability is established |
| #164 remainder | Handler/mainline interference, relocation, dual-domain helpers, machine-created storage, borrowed-address bytes, runtime-address writes | #164, still open |
