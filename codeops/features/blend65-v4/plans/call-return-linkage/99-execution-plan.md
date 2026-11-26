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
`call-return-linkage-vice.spec.test.ts`, is implementer-authored and supporting
evidence: it confirms the constructions are emitted, runs 300 tail-transferred
calls from a loop, and checks every result and that the stack pointer at the
restoration equals the one `main` started with.

## Delivered

| Seam | Change |
| --- | --- |
| `machine/tail-transfer.ts` (new) | A block whose last instruction calls a whole label and which then returns becomes a `jump` to that label. Mainline caller and callee only, never a KERNAL load call, and refused when anything reachable from the callee reads or moves the stack pointer. Layout turns a jump to the next block into a fall-through, which is how the helper case costs nothing |
| `machine/dead-byte-store.ts` (new) | A store to one byte of a private mainline temporary is removed when no body reads that byte. The request-level rule needed the whole temporary to be dead; a word result's high byte often is while its low byte is not. Homes are unchanged |
| `machine/optimization-cleanup.ts` | The byte rule runs before forwarding as well as after, because an unread high-byte store can split a store/reload pair. A reload after a call is also redundant when nothing, the body's own callers included, reads N or Z before they are rewritten — a word result leaves them describing X |

| Witness | `balanced` / `size` before | After |
| --- | --- | --- |
| #126 `touch` → `child` | 196, `jsr child / rts` | **195**, `jmp child` — the issue's expert form |
| #124/#126 `calculate` | 244, `jsr helper / rts` | **240**, falls into the helper: 4 B / 12 c, beating the issue's `jmp` by 3 B / 3 c |
| #124 word `next` | 224, high byte stored and dead | **221**, the issue's expert sequence exactly |
| `outer` narrowing a word callee | `jsr / sta / stx / lda / rts` | `jmp inner` |
| acquisition frontier workload | 935 | **929** — two dead staging stores in `c64.input.readInputSnapshot` |

`none` is byte-identical everywhere, and the nine canonical identities are
unchanged: none of the three examples has a call in tail position or an unread
temporary byte.

## Guards, and whether anything fails without them

| Guard | Witnessed | By |
| --- | --- | --- |
| Tail position is exact: call last, then a return | yes | public oracle, trailing-work and widening controls; impl test |
| Caller and callee mainline | yes | public oracle, two IRQ installers; impl tests for both directions |
| Nothing reachable from the callee reads or moves SP | yes | impl tests (`tsx` one call down, `txs` in the callee) |
| Data labels are not walked; unknown control targets refuse | yes | impl tests |
| Not a KERNAL load call; whole-label operand only | yes | impl tests |
| Byte rule: byte read anywhere keeps the store | yes | the word-return witness keeps its low store |
| Byte rule: indirect pointer or memory-effect read keeps the whole request | **no** | fail-closed; no source form found that reaches it |
| Reload after a call when N/Z are dead at every caller | yes | the narrowing witness; `callersIgnoreFlags` is the existing census |

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
| new | Placing a tail-called body directly after its caller would turn #126's `jmp` into a fall-through (4 B / 12 c instead of 1 B / 9 c); same layout contract as part B |
| new | Generated stack demand is computed before lowering and still charges a transferred call, so the two-byte peak saving is real on the machine but not credited in the evidence |
