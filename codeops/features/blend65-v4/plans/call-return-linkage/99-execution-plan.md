# Call and return linkage

> **Owner**: [#118](https://github.com/blendsdk/blend65/issues/118),
> [#124](https://github.com/blendsdk/blend65/issues/124),
> [#126](https://github.com/blendsdk/blend65/issues/126) · **Type**: Task
> **CodeOps Artifact Schema**: 1
> **Status**: Part A complete and verified (#124, #126); part B (#118) in progress
> **Progress**: 9/9 tasks for part A; part B below
> **Last Updated**: 2026-11-27

## Tasks

| # | Task | State |
| --- | --- | --- |
| 1 | Measure every witness on the current tree at `none`, `balanced` and `size` | Done |
| 2 | Requirements frozen from the issues and the measurement; the implementation-blind oracle commissioned from them | Done — three correction rounds, below |
| 3 | RED measured on this tree before any source change | Done — 16 / 30 and 2 / 7, exactly as predicted |
| 4 | Inventory every observer and VICE oracle that enumerates calls or pins stack depth, and run the depth pins against a spike before committing to a shape | Done — the depth pins pass the spike, 168 / 168 |
| 5 | Implement in the existing call, terminator and layout owners | Done for part A; part B split out |
| 6 | Canonical identities, integration tier, frontier guards and the affected VICE files | Done |
| 7 | Behaviour oracle in VICE: results, stores, stack balance and restoration | Done |
| 8 | Independent reviews (correctness, machine code, SFA/ABI, platform) and dispositions | Done — two rounds, all findings dispositioned |
| 9 | Complete gate and closeout | Done — the first gate found a reference conflict, fixed; the second is green |

## The witnesses, measured

The issues' bodies are weeks old, and three earlier rows each found the baseline
had moved. Measured on `ecf3af6f`, PAL/6581, programBytes of the shipped PRG:

| Witness | `none` | `balanced` = `size` | Shipped tail at `balanced` | Remaining gap |
| --- | --- | --- | --- | --- |
| #124 byte `next(7)` | 218 | 184 | `lda param / clc / adc #1 / rts` | **none** — the staging the issue quotes is already gone at every goal, `none` included |
| #124 word `next($12FF)` | 259 | 224 | `… adc #0 / sta hi / tax / lda lo / rts` | the high-byte store is dead: 3 B / 4 c |
| #124/#126 `calculate(3, 4)` | 270 | 244 | `jsr helper / rts`, helper immediately after | the result staging is gone; the call is in tail position and its target is the next instruction: 4 B / 12 c by falling through, more than the issue's `jmp` (1 B / 9 c) |
| #126 `touch` → `child` | 240 | 196 | `jsr child / rts` | `jmp child`, 1 B / 9 c; 4 B / 12 c where `child` can be placed next |
| #118 `main` → `work` | 205 | 133 | `jsr work / jmp restore`, `work` ends `rts` | main into work into restoration: 7 B / 15 c |

So the batch is one seam with three shapes, not three seams: **a call in tail
position** — nothing between the call's return and the caller's own exit — plus
one dead store in the word return. #124's measurement question is settled by
the measurement itself: the staging half is delivered, and the helper witness is
measured once, as the tail transfer.

## Requirements

Frozen before implementation. They restate the issues against the measured
tree; nothing here is new authority.

1. **Tail transfer.** In an optimizing build, a call whose caller does nothing
   after it returns except return itself — no store, no flag or register use, no
   stack cleanup, no restoration of any saved state — is lowered as a transfer to
   the callee, so the callee's own return goes straight to the caller's caller.
   Where the callee's entry is the next instruction, the transfer is omitted.
2. **What the caller's caller observes is unchanged.** The returned value (none,
   A, or A/X), the flags at that return, every memory effect and its order, and
   the decimal and interrupt-disable flags. The return address the callee leaves
   through is the caller's, so the stack is balanced exactly as before; only the
   peak depth falls by two bytes.
3. **Where it may not apply.** An interrupt handler (it leaves through `RTI` or
   a chained vector), a caller with pending stack or status restoration, a
   callee that reads the hardware stack above its own frame, and the program
   entry — whose exit is the startup restoration, not a return (requirement 5
   owns that shape). A result the caller discards, or narrows to the byte the
   callee already leaves in A, is still tail position: no instruction runs
   between the call and the return, and an expert writes `jmp` for both. Any
   shape change that needs code puts that code after the call, so it is
   excluded by the definition rather than by a separate rule. (Ruled while the
   oracle was authored; the first draft of this requirement excluded every
   shape difference, which would have forbidden two legal transfers.)
4. **`main`'s continuation is the restoration.** Never replace it with a return
   that would skip the restoration.
5. **Sole void leaf (#118).** When `main` ends by calling a void function that is
   called from nowhere else and is not recursive, address-taken or an interrupt
   entry, the call and `main`'s own transfer to the restoration may be replaced by
   continuing into that function and leaving it into the restoration. Every exit
   of that function must reach the restoration.
6. **Word return (#124).** A word result whose high byte goes straight to X does
   not also store it.
7. **`none` is byte-identical.** Canonical lowering is the reference every build
   is measured against.
8. **Evidence is honest.** A removed call is recorded as removed in the cost and
   debug evidence; no instruction is emitted, and no observer is satisfied, by
   pretending a call still happens.

## Shape pins to run before the complete gate

Two existing VICE oracles assert the stack depth at a function's entry, which is
exactly what a tail transfer changes: `input-startup-selection.spec.test.ts:209`
and `:254`, and `input-size-runtime.spec.test.ts:506-507`. They run against the
first spike, before the shape is settled, not after the complete gate.

## Spike: the naive rule, in an isolated worktree

A cleanup rule that turns a block ending `jsr <label>` with a `return`
terminator into a `jump` terminator, in mainline functions only, with no other
condition. It is a measurement, not the implementation: it has none of
requirement 3's exclusions.

| Witness | Shipped | Spike |
| --- | --- | --- |
| `touch` → `child` | `jsr child / rts`, PRG 196 | `jmp child`, PRG 195 |
| `calculate` | `jsr helper / rts`, PRG 244 | falls straight into the helper, PRG 240 (4 B / 12 c) |

Every observer accepted it, the fast tier is green (compiler 190 / 3,108, root
48 / 1,357), and all nine canonical identities are unchanged — none of the three
examples has a call in tail position. What the spike exposed:

- **Stack accounting stays conservative.** Generated stack demand is computed
  from the semantic call graph before lowering (`storage/call-stack.ts`), so it
  still charges the transferred call. Safe, but the two-byte peak saving is not
  credited.
- **Cycle evidence already follows the transfer.** `services/entry-path-cycles.ts`
  inlines a `jsr` into its callee, and its successor walk already enters a
  function named by a `jump` at that function's entry
  (`walkSuccessor`), so no change was needed there.

## Part A and part B

#118 needs the entry function to fall into its sole leaf and the leaf to fall
into the restoration. Layout places functions first-fit and the restoration
after them (`layout/c64-layout.ts`), and the only cross-body fall-through it
models is startup into `main`. Without that, the fusion is `jmp work` plus a
`jmp restore` in place of an `rts` — only 1 B smaller than today (7 → 6; the
first form of this note said larger, which was wrong for a leaf with one
return), against the expert's 7 B. So #118 is part B, its
own unit: a layout contract that places a body directly after its sole caller
and proves the fall-through. Its oracle is frozen beside this record as
`sole-leaf-continuation.spec.test.ts.frozen` — kept out of `test/` because it
is RED until part B lands — and measured 2 RED / 5 pass on the pre-change
tree. Part A is #124 and #126.

## The oracle

Implementation-blind, from the requirements above and the public helpers only.
Three correction rounds, none of which moved an expectation to fit output:

1. The ruling on requirement 3 (discarded and narrowed results are tail
   position), recorded in the requirement itself, and a setup defect: an
   interrupt handler is emitted as a route-specialised routine, not under its
   source name.
2. The split into part A and part B.
3. A structural assumption: the multiply helper is emitted inside `calculate`'s
   own routine, so after the fall-through its `rts` is `calculate`'s only exit.
   The case now states that directly.

RED on the pre-change tree: `call-return-linkage.spec.test.ts` 16 failed / 14
passed, every failure a delivery case and every pass a control or reference
case; `sole-leaf-continuation` 2 / 5. The behaviour oracle,
`call-return-linkage-vice.impl.test.ts`, is implementer-authored and supporting
evidence, so it carries the implementation suffix: it confirms the constructions are emitted, runs 300 tail-transferred
calls from a loop, and checks every result and that the stack pointer at the
restoration equals the one `main` started with.

## Delivered

| Seam | Change |
| --- | --- |
| `machine/tail-transfer.ts` (new) | A block whose last instruction calls a whole label and which then returns becomes a `jump` to that label. Mainline caller and callee only, never a KERNAL load call, and refused when anything reachable from the callee reads or moves the stack pointer. Layout turns a jump to the next block into a fall-through, which is how the helper case costs nothing |
| `machine/dead-byte-store.ts` (new) | A store to one byte of a private mainline temporary is removed when no body reads that byte. The request-level rule needed the whole temporary to be dead; a word result's high byte often is while its low byte is not. Homes are unchanged |
| `machine/optimization-cleanup.ts` | The byte rule runs before forwarding as well as after, because an unread high-byte store can split a store/reload pair — a word result narrowed to its low byte stores a high byte nothing reads, between the low store and its reload. With that store gone the existing forwarding, whose callee-flag proof already holds, removes the reload |

| Witness (PRG file bytes, including the 2-byte load address) | `balanced` / `size` before | After |
| --- | --- | --- |
| #126 `touch` → `child` | 196, `jsr child / rts` | **195**, `jmp child` — the issue's expert form |
| #124/#126 `calculate` | 244, `jsr helper / rts` | **240**, falls into the helper: 4 B / 12 c, beating the issue's `jmp` by 3 B / 3 c |
| #124 word `next` | 224, high byte stored and dead | **221**, the issue's expert sequence exactly |
| `outer` narrowing a word callee | `jsr / sta / stx / lda / rts` | `jmp inner` |
| acquisition frontier workload (loaded payload, excluding the load address) | 935 | 935 — the two staging stores this row first removed are kept; see the complete gate below (#230) |

Measured `none` identity: the nine canonical identities (boing-ball, m1 and
rd06-spritepad at `none`, `balanced` and `size`) are unchanged — none of those
examples has a call in tail position or an unread temporary byte — and every
witness above emits its `none` form unchanged. That `none` is untouched in
general is an implementation invariant rather than a measurement: every rule
here runs only when optimization facts are present.

## Guards, and whether anything fails without them

| Guard | Witnessed | By |
| --- | --- | --- |
| Tail position is exact: call last, then a return | yes | public oracle, trailing-work and widening controls; impl test |
| Caller and callee mainline | yes | public oracle, two IRQ installers; impl tests for both directions |
| Nothing reachable from the callee reads or moves SP | yes | impl tests (`tsx` one call down, `txs` in the callee) |
| Data labels are not walked; unknown control targets refuse | yes | impl tests |
| Not a KERNAL load call; whole-label operand only | yes | impl tests |
| Byte rule: byte read anywhere keeps the store | yes | the word-return witness keeps its low store |
| Byte rule: an indexed read keeps the whole request | yes | impl test, verified by deletion (review RV-001) |
| Byte rule: only a direct store is removed | yes | impl test, verified by deletion |
| Byte rule: an address-forming load keeps the whole object | yes | covered by the indexed-mode rule (immediate is not a direct mode); VICE case `picked = second([…])` (review SF-001) |
| Byte rule: the census covers every body, rewritten or not | yes | impl test, verified by deletion (review RV-002) |
| Byte rule: an indirect pointer keeps the whole request | yes | impl test, verified by deletion |
| Byte rule: a read memory effect keeps the whole request | **no** | fail-closed; no source form found that reaches it |
| Tail rule: never into a dispatch block through a function value | yes | impl test, verified by deletion; VICE case (review SF-003) |
| Helper sharing redirects a tail jump or fall-through, not only a call | yes | VICE case with two multiply functions (review SF-002) |
| Reload after a call needs the callee's flag proof (existing) | yes | removing it fails twelve corpus cases, among them the earlier row's "should keep the reload where one exit settles nothing" on four profiles. A second, dead-flags proof was added and then removed: the narrowing witness passes without it, and no public form reaching it alone was found |

## Oracle and pin changes

| File | Change | Authority |
| --- | --- | --- |
| `test/rd04/wrapper-call-flag-settlement.spec.test.ts` | "should leave the wrapper itself as a plain call and return" → "should leave the wrapper through its callee", expecting `jmp b65_Game_inner_`. It was that unit's scope control and pinned exactly the limitation #126 removes; its delivery cases are unchanged and pass | User, 2026-11-26, in this session |
| `test/rd08/optimizer-exact-output.impl.test.ts` | acquisition payload 935 → 929 and its digest, then back to 935 and the original digest when the byte rule became reference-consistent; the file ends identical to the pre-row tree | implementation identity pin |
| `packages/compiler/src/machine/optimization-cleanup.impl.test.ts` | two cases now expect `cleanup.dead-byte-store` after `cleanup.copy-forward` — forwarding leaves the store unread | implementation test |

## Residuals

| Issue | What |
| --- | --- |
| #118 | Part B: the sole-leaf continuation needs a layout contract |
| #225 | Place a tail-called body after its caller so the jump becomes a fall-through (3 B / 3 c), the same contract as part B |
| #226 | Stack demand still charges a call that became a tail transfer |
| #227 | A call through a function value in tail position keeps its call (refused for SF-003) |
| #228 | A call followed only by a jump to a return is not seen as a tail call |
| #222 | The byte multiply helper copies parameters it could use in place: 8 B / 12 c / 2 ZP |
| #223 | A word result parked in RAM and staged again by its caller: 16 B / 20 c |
| #224 | A global word update reloads the high byte it has just stored: 3 B / 4 c |
| #229 | Block layout does not place a tail jump like the return it replaced: 20 B against 17 in a constructed shape |
| #230 | A temporary byte unread only in the selected layout keeps its store: 6 B / 8 c on the acquisition workload |

## Review dispositions

Four independent reviews of `01c63461`: correctness, SFA/ABI, machine code and
platform. Three auditors first stopped for want of exact skill paths, were given
them, and completed. Every finding was checked against the code before it was
dispositioned, and the four correctness defects were reproduced first.

| Finding | Severity | Disposition |
| --- | --- | --- |
| RV-001: an indexed storage read was counted as reading only its fixed offset | major | **Fixed.** A read counts as one byte only in a direct mode; any other mode marks the whole request read |
| SF-001: an address-forming load (`lda #<T`) marked only byte 0, so element 1 of an anonymous aggregate passed by address could lose its store | major | **Fixed by the same rule** (immediate is not a direct mode); the auditor's probe keeps both stores and returns 9 in VICE |
| RV-002: the byte census read only the bodies the pass rewrites | major | **Fixed.** The census, and the tail rule's callee walk, cover every body in the program with the rewritten ones in their current form |
| SF-002: helper sharing redirected only `jsr`, so a tail jump to a shared multiply helper dangled and binding refused a legal program | major | **Reproduced and fixed.** `redirectedHelperExit` redirects a jump, and turns a fall-through into a jump, to the shared copy |
| SF-003: a tail jump into a dispatch block lost the caller's decimal-flag proof, refusing a legal program | major | **Reproduced; fail-closed.** No transfer into a dispatch block; the beat is #227 |
| MC-001: a tail jump lost the return-tail classification in block layout, 20 B against 17 B in a constructed shape | major | **Fixed, then reverted, and filed as #229.** Classifying a marked tail jump as a terminal tail fixed this shape and was worth 6 B on a real dispatch program, but the follow-up audit showed it regressed the mirrored shape (32 B against 29) and, with a padded tail, let a second layout pass drop a bridge and leave a branch at −135 — unencodable (MC-007). Block layout is back to its pre-row form; both shapes are pinned (29 B, and re-layout keeps its size). The 20 B shape is a constructed regression against the pre-row 18 B, not observed in the corpus; #229 carries all three shapes as acceptance |
| MC-002, MC-003, MC-004 | major (existing debt) | Filed as #222, #223, #224 with measured deltas and paths |
| MC-005: a wrapper `jmp` meets only the non-adjacent floor | minor | Filed as #225 |
| MC-006: witness totals mixed file and payload bytes | minor | Fixed: the table names its units |
| MC-007: a second layout pass could drop a bridge and leave an unencodable branch | major | Caused by the MC-001 classification; gone with its revert, and pinned |
| MC-008: #227 and #228 mixed the jump and fall-through figures | minor | Corrected on both issues |
| RV-003: "`none` is byte-identical everywhere" exceeded the evidence | minor | Fixed: the nine measured identities are named and the general claim is stated as an invariant |
| RV-004: the VICE file was spec-tier but implementer-authored | major | Fixed: renamed `call-return-linkage-vice.impl.test.ts`; its tier comes from its imports. The follow-up review asked for user approval of the rename. None is needed: the file was written by the implementer in this row (`bfec69f5`), never was an independent oracle, and the rename changes no expectation — it corrects the suffix to what the file always was. Oracle-edit authority governs independently authored expectations, as with the `rd04` case above |
| TP Unknown: whether the two removed acquisition homes alias the saved NMI link | — | **Closed.** On the unnormalized pre-change listing the removed stores wrote `$0BC8`/`$0BC9`; the saved link is `$0BC6`/`$0BC7` (`jmp ($0BC6)`). The only readers of `$0BC8`/`$0BC9` are `c64.input.keyState`'s own temporaries at the same SFA-shared addresses, which that routine writes immediately before reading |

Fix commit `6dff7a90`'s message says every guard is witnessed; the guard table
above is the accurate statement — one guard is unwitnessed.

A follow-up round reviewed `6dff7a90`. The correctness and SFA/ABI follow-ups
closed RV-001 to RV-003 and SF-001 to SF-003 with no new findings; the
machine-code follow-up reopened MC-001 and found MC-007, dispositioned above.
Against the pre-row tree the two dispatch probes are no worse — 691 against 691,
and 862 against 867 — and the two-multiply probe 183 against 188.

The platform audit otherwise found no defect: interrupts push their own frame, so
KERNAL's stacked-status test is unaffected; handler and dual-domain bodies are
specialised before cleanup and excluded; the restoration sees the same stack
pointer. Status remains `VICE-verified / hardware-unverified`, and the VICE
oracle stops at restoration entry rather than following BASIC's return.

## The complete gate found a reference conflict

The first complete gate failed one VICE case on all four profiles,
`input-loop-storage.spec.test.ts` "should preserve eight ordinals and ordered
nested pairs in size mode". Its values were right; its evidence check that the
word counter is narrowed in `size` was not. On the pre-row tree `size` selects
the narrowed `low-byte` construction at 1085 B; with this row every candidate
was refused and the canonical fallback shipped at **1190 B**.

The byte rule judged each layout from its own reads. The narrowed layout no
longer reads the high byte of the `column + 1` staging temporary, so its store
went in that layout and stayed in the reference, and the low-byte observer —
which proves the parent sum against the reference's seven-instruction word
increment — refused it. The existing request-level rule avoids exactly this by
design: every layout receives the reference's dead-home set. The byte rule now
does the same. The reference publishes the temporary bytes its final lowering
never reads, and any other layout removes a byte store only inside that set
(and only where it has no reader of its own); with no feasible reference, each
layout judges alone. `size` selects `low-byte` again, at **1082 B**.

The price is the acquisition workload's 6 B: its two staging bytes are unread in
the selected layout but read in the reference. That is #230, with the observer
change that would recover it. Every other figure is unchanged.

This is the fourth time across rows 6–8 that a layout's reference decided what
another layout may do. The VICE file that caught it was not among the affected
VICE tests run before the gate; any rule that changes instruction shapes per
layout should run the VICE files that pin a selected construction
(`input-loop-storage`, `input-byte-selection`, `input-size-runtime`,
`optimizer-saved-output`) before the gate, not after.

## Verification

| Gate | Result |
| --- | --- |
| Public oracle RED on the pre-change tree | `call-return-linkage` 16 / 30 failed; `sole-leaf-continuation` 2 / 7 |
| Public oracle on the final tree | 30 / 30 |
| Implementation tests | tail transfer 13, dead byte store 7, terminal layout 8; every guard verified by deletion except the read-memory-effect guard |
| VICE depth pins against the naive spike | 168 / 168 |
| Complete gate `yarn test:full`, first run (`5f13bdcb`) | host green; VICE 4 failed — `input-loop-storage` on four profiles, fixed in `460f5dd5` |
| Complete gate `yarn test:full`, on `460f5dd5` | install, build and typecheck clean; nine identities unchanged; host **289 / 6,286**, compiler 272 / 4,623; VICE tier **2,445 passed, 0 failed** (4 skipped) |
| Review coverage | four reviews of `01c63461`; follow-up reviews of `6dff7a90` (correctness, SFA/ABI, machine code). `5f13bdcb` (a revert to the pre-row layout and removal of an unused proof) and `460f5dd5` (the reference-consistent byte rule) are covered by the gates above, not by an independent review |

### Deferral expiry

Did this row's deliverables expire any deferral's stated rationale? One: T-124's
"word high-byte staging remains the measured 0-byte residual" — it was not
zero, and is removed (3 B / 4 c). #118 was deferred into this row and is now
deferred again, to part B, for a stated reason (a layout contract) with its
oracle frozen; it does not name a finished slice as its landing place. No
expressiveness-ledger row changes: every form this row touches already
compiled, and the two legal programs the first form refused (SF-002, SF-003)
were fixed before any commit reached the gate.

## Part B — the entry continues into its sole leaf (#118)

| # | Task | State |
| --- | --- | --- |
| B1 | Measure the witness at `balanced` and `size`: 133 B, X-counter construction (`flat-eight-x-first:compact-unrolled`, 131) in both | Done |
| B2 | Fusion rule `cleanup.sole-continuation` in cleanup, ahead of the tail rule | Done |
| B3 | Layout contract: a marked continuation jump becomes a fall-through when its target is placed right after it | Done |
| B4 | Zero-byte entry body through debug and memory evidence | Done |
| B5 | Teach the selected-loop observer the continuation exit and entry | Done |
| B6 | Activate the frozen oracle unchanged; impl tests; emulator behaviour case | Done — oracle 7 / 7 (2 / 7 RED before), impl 9 + 4 |
| B7 | On/off differential over the captured test corpus at `balanced` and `size` | Done — below |
| B8 | Affected VICE files, host checkpoint, reviews, complete gate, closeout | In progress — reviews done, VICE tier run, oracles approved |

### The rule

When the entry function's block ends `jsr W` and then continues into the
restoration, and `W` is reached by that call and nothing else, the call and
`W`'s return cancel out: the entry jumps to `W`, and `W`'s return becomes the
jump to the restoration. Both jumps are marked as continuations. The same
check then runs on `W`, so a chain of last calls continues the same way.

`W` qualifies only when:

- `directCallSites` enumerates exactly this one call (no address taken, no
  dispatch candidate, no jump into it);
- it runs mainline, is a source function, and is not an NMI publication entry
  or a shared body;
- every exit but one return stays inside it: no `rts`, `rti`, `brk` or `jmp`
  among its instructions, no dispatch block, no branch or jump to a foreign
  label;
- it has exactly one return block, so the rule is never larger: 7 B / 15 c of
  `jsr`+`jmp`+`rts` become 6 B / 6 c of two jumps before layout helps at all;
- nothing reachable from it reads or moves the stack pointer.

The rule runs before the tail rule: a callee whose return became a
continuation must not later gain a tail transfer whose callee would return
past the restoration.

### The layout contract

A jump marked `continuation` is dropped only by layout, and only from a body's
physically last block, after branch repair (block ordering rejects a
fall-through to a foreign label). Right after placing a body, layout tries to
place its continuation target at exactly the end minus the jump: another
function, or the restoration. The target must fit there by the same
`freeSourceStart` test every placement uses; otherwise the jump stays and the
target is placed like any other body. Fixed-placement bodies start chains
after every fixed body is reserved. A body that falls into another is never
laid out again by compaction, and a body with no bytes left contributes no
code piece, memory range or debug range. Unmarked jumps never move anything,
so `none` and every program without a continuation keep their layout.

### The observer

`side()` accepts a loop owner whose exit continues into the restoration as well
as one that returns, when the symbolic and placed exits agree.
`continuations()` requires both constructions to leave the same way, and walks
into the restoration when they continue. `callers()` accepts the entry's
continuation edge only when it names the owner's entry, comes from the entry
function's only body in the ordinary context, and carries the very source span
of the one call; the register mask a returning call's continuation would get is
then proved unobserved through the restoration. An edge into a body with no
bytes that falls into the owner enters through that body's own edge, which is
checked separately.

### Measured

| Witness | Before | After |
| --- | --- | --- |
| #118 sole leaf, `balanced` and `size` | 133 B, `jsr work / jmp restore` + `rts` | **126 B**, same construction, `main` empty, `work` falls into the restoration (the issue's 7 B) |
| Nine example identities | unchanged | unchanged |

### Review dispositions (round 1)

| ID | Finding | Disposition |
| --- | --- | --- |
| TP-001 | A restoration chained after a body near `$A000` runs under BASIC ROM once it writes the CPU port | Fixed: `restorationVisible` refuses a chained restoration touching `$A000-$BFFF`; load-bearing layout test. The same gap in ordinary first-fit placement predates this row: #237 |
| TP-002 | The emulator case did not observe `$00`, `$DD02` or CIA2 port A | Fixed: `$00`, `$01` and `$DD02` compared at hand-over and at `$E147`; no `$DD00` access allowed |
| SF-001 | The stack-pointer walk skipped calls and jumps to numeric addresses (shared with the part-A tail rule) | Fixed in `stackAboveFrameUnread`: a numeric transfer answers no, like a label no body owns; load-bearing tests for both rules |
| RV-001 | The observer accepted a fall-through by its target's name without proving adjacency | Fixed: the exit, the entry edge and the pass-through body are checked by address; four fused-shape observer tests, two of them load-bearing by mutation |
| RV-002 / MC-008 | A shortened fixed body kept its stale reservation | Moot: fixed bodies no longer start chains (MC-001) |
| MC-001 | A chain started from a fixed body can extend the program past its last byte (+25 B constructed) | Fixed: fixed bodies start no chain |
| MC-002 | The entry's chain took the gap the NMI publication entry is placed into (+175 B constructed) | Fixed: chains wait until every NMI publication entry is placed |
| MC-003 | A continuation exit can push a branch out of range when no fall-through is taken (142 -> 144 B constructed) | Filed #231 |
| MC-004 | Several returns are refused even when layout could help (5 B) | Filed #232 |
| MC-005 | A continuation exit that is not the last block keeps its jump (3 B) | Filed #233 |
| MC-006 | An exclusive tail chain under the entry is not continued (10 B) | Filed #234 |
| MC-007 | A body that falls into another loses post-placement folding (3 B per site) | Filed #235 |
| MC-009 | The witness loop itself is 2 B / 8 c above a biased-index expert loop (pre-existing) | Filed #236 |
| — | The stack peak still charges the removed call (3 reported, 2 actual) | Commented on #226 |

The first corpus differential found a second observer family the continuation
broke: `validateOriginalCallSites` refused a loop in the entry function whose
last call became a continuation, and once taught, `size-observer-effects`
raised a hard error (not a refusal) on the same edge. Both now accept a
continuation that carries the call's exact source span from the entry function;
`sole-continuation-selection.impl.test.ts` pins both shapes (126 B and 191 B,
with the constructions selection chooses without the rule).

### The corpus differential

Every project the host tier and the five construction-pinning VICE files built
was captured (5,479 projects; 5,020 distinct). Each was built at `balanced`
and `size` with the rule on; the 1,954 whose `main` lost its restoration jump
or whose build failed were built again with the rule off.

| Run | Compared | Smaller | Same | Larger | Selected construction differs | Build fails only with the rule |
| --- | --- | --- | --- | --- | --- | --- |
| First, before the review fixes (1,321 projects) | 2,572 | 158 | 2,408 | 6 (one program, +28 B: the original loop construction refused) | 6 | 0 |
| Second, current code | 3,908 | 424 | 3,476 | 8 (one program, +2 B) | 0 | 0 |
| Third, with the fixed-address guard | 3,908 | **424 (3,268 B)** | 3,484 | **0** | **0** | **0** |

The first run's loss taught two more observers (above). The second run's +2 B
was a callee placed at a fixed address at the top of the image: its exit can
never fall into the restoration, so its `rts` became a jump at the end of the
PRG while `main`'s saving only became fill. The rule now refuses a callee with a
fixed address; load-bearing test. The 3,254 failed builds fail the same way
with the rule off: they are projects their tests expect to fail.

### Oracle changes (approved 2026-11-27)

The user approved shape-only edits: a routine may end in `rts` or continue into
the startup restoration (a jump to it, or ending exactly where it begins), and
an empty wrapper falling into its callee leaves through it. Every value, store,
order and byte or cycle figure stays as written.

| File | Change |
| --- | --- |
| `test/rd08/sole-leaf-continuation.spec.test.ts` | Activated: moved unchanged from the frozen copy (same SHA-256) |
| `test/rd04/wrapper-call-flag-settlement.spec.test.ts` | An empty routine reads `falls into <next>`; the wrapper may be `jmp inner` or fall into `inner` |
| `test/rd04/private-home-repeated-read.spec.test.ts`, `test/rd04/return-boundary-delivery.spec.test.ts` | The reader marks a routine that falls into what follows; the exit may be `rts`, a jump to the restoration or a fall into it |
| `test/rd08/finite-loop-invariant-load.spec.test.ts` | The loop owner's continuation exit, proved by address, is read as the `rts` it replaced; the 7-instruction shape and the 13/14-byte and 57/59/107-cycle figures are unchanged |
| `test/rd08/word-update-support.ts` (used by `word-views-direct-indexing`) | Evaluation also ends when the routine falls exactly onto a label it does not own |
| `test/rd08/call-linkage-support.ts` (used by `call-return-linkage`) | The reference's restoration label is `main`'s only unconditional transfer out, not necessarily its last instruction |
| `test/rd08/input-object-facts.spec.test.ts` | `make`'s ten store bytes unchanged; its exit is `rts`, a jump to the restoration, or ends at the restoration's address |

Implementer-owned tests changed: `word-views-guards.impl.test.ts` stops reading
at the restoration label as well as at `rts`; `call-return-linkage-vice.impl.test.ts`
gained the fused-witness case. The VICE tier on the uncommitted tree failed only
these shapes plus the known flake #191 (passes alone, 16 / 16).
