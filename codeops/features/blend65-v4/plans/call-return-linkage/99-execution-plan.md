# Call and return linkage

> **Owner**: [#118](https://github.com/blendsdk/blend65/issues/118),
> [#124](https://github.com/blendsdk/blend65/issues/124),
> [#126](https://github.com/blendsdk/blend65/issues/126) · **Type**: Task
> **CodeOps Artifact Schema**: 1
> **Status**: In progress — part A implemented and host-verified; reviews and the complete gate remain. Part B (#118) is its own unit
> **Progress**: 7/9 tasks
> **Last Updated**: 2026-11-26

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
| 8 | Independent reviews (correctness, machine code, SFA/ABI, platform) and dispositions | Pending |
| 9 | Complete gate and closeout | Pending |

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
`jmp restore` in place of an `rts` — larger than today. So #118 is part B, its
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
| acquisition frontier workload (loaded payload, excluding the load address) | 935 | **929** — two dead staging stores in `c64.input.readInputSnapshot` |

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
| `test/rd08/optimizer-exact-output.impl.test.ts` | acquisition payload 935 → 929 and its digest, at `balanced`, `speed` and `size`; the harness reproduced the old digest on the pre-change tree first | implementation identity pin |
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
