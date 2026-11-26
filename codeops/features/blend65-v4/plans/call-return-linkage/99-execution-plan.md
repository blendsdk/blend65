# Call and return linkage

> **Owner**: [#118](https://github.com/blendsdk/blend65/issues/118),
> [#124](https://github.com/blendsdk/blend65/issues/124),
> [#126](https://github.com/blendsdk/blend65/issues/126) · **Type**: Task
> **CodeOps Artifact Schema**: 1
> **Status**: In progress — measured; oracle commissioned before any implementation
> **Progress**: 1/9 tasks
> **Last Updated**: 2026-11-26

## Tasks

| # | Task | State |
| --- | --- | --- |
| 1 | Measure every witness on the current tree at `none`, `balanced` and `size` | Done |
| 2 | Requirements frozen from the issues and the measurement; the implementation-blind oracle commissioned from them | In progress |
| 3 | RED measured on this tree before any source change | Pending |
| 4 | Inventory every observer and VICE oracle that enumerates calls or pins stack depth, and run the depth pins against a spike before committing to a shape | In progress — spike measured below |
| 5 | Implement in the existing call, terminator and layout owners | Pending |
| 6 | Canonical identities, integration tier, frontier guards and the affected VICE files | Pending |
| 7 | Behaviour oracle in VICE: results, stores, stack balance and restoration | Pending |
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
3. **Where it may not apply.** An interrupt handler (it leaves through `RTI`), a
   call whose callee and caller return different value shapes, a caller with
   pending stack or status restoration, any function whose address is taken or
   that reads the hardware stack, and the program entry — whose exit is the
   startup restoration, not a return (requirement 5 owns that shape).
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
- **Cycle evidence needs the transfer walked.** `services/entry-path-cycles.ts`
  inlines a `jsr` into its callee; a `jump` to another function's entry has to
  be walked as that callee's entry at the same depth, or the cost evidence loses
  the path.
