# CIA Timer and Interrupt Slice Evidence

> **Scope**: Bounded RD-05 CIA slice on four cooperative C64 profiles, not RD-05 closeout
> **Status**: Complete — CIA1 route and direct operations verified
> **Date**: 2026-09-29

## Qualified route and device effects

The source-visible handoff saves processor status, masks IRQs, installs a selected
`setIRQExclusive` handler, disables all CIA1 sources, consumes the old pending bits once,
handles that returned value in source, and restores status. Only then does source enable
Timer A/B. The ownership check follows the active route, known source mask, handler/helper
effects, calls, joins and loops. A nested vector restore does not erase a CIA1 device
mutation. Known CIA1 register writes, including mirrors at `$DC10–$DCFF`, invalidate or dirty
the relevant proof; an unresolved `poke()` address remains an explicit caller-owned hardware
escape. Unproved routes and reverse handoffs fail before emission with source-linked E10278.

The API reads either CIA's timer counter low then high without claiming an atomic running
snapshot. Under the proved CIA1 route, latch writes are low then high; control configuration
reads and writes each register once while preserving shared fields; ICR mask changes write
once without reading the mask; and one consuming ICR read returns all pending bits for ordinary
source branches. Dynamic flags are bounded to the owned fields. The compiler adds no IRQ
scheduler, acknowledgement branch checker, runtime mask shadow, or function storage after SFA
closure. The prior selected IRQ wrapper, callback identity, saved links, bank visibility,
stack/SFA and KERNAL terminal owner remain the [qualified IRQ route](../rd-05-handler-irq/08-closeout.md),
not a newly claimed NMI route.

The [four-profile VICE cases](../../../../../test/rd05/cia-vice.spec.test.ts) observe the
masked vector/mask/pending-read order with an old Timer A event armed at the boundary. They
also observe stopped and running latch behavior, LOAD transfer, preserved unrelated control
bits, both Timer A/B pending bits (`$83`), both source branches, and a subsequent cleared read.
The status is **VICE-verified / hardware-unverified**. CIA edge timing and revision-sensitive
behavior still need targeted physical QA near release.

## Expert output and cost

The [independent selected-output tests](../../../../../test/rd05/cia-output.spec.test.ts)
compile real artifacts with optimization `none`, check exact volatile access order/count,
reconcile program-byte accounting with ACME, and recount these emitted NMOS fragments:

| Constant/simple operation | Emitted sequence | Emitted bytes/cycles | Equal-contract expert delta |
|---|---|---:|---:|
| Counter read into A/X | `LDA $DC04; LDX $DC05` (or selected B/CIA2 pair) | 6 / 8 | 0 / 0 |
| Enable Timer A | `LDA #$81; STA $DC0D` | 5 / 6 | 0 / 0 |
| Disable all CIA1 sources | `LDA #$1F; STA $DC0D` | 5 / 6 | 0 / 0 |
| Read pending byte | `LDA $DC0D` | 3 / 4 | 0 / 0 |
| Configure A constant mode | `LDA $DC0E; AND #$C6; ORA #mode; STA $DC0E` | 10 / 12 | 0 / 0 |

These are local instruction costs, not a claim that complete program execution beats expert
assembly. The selected-output checks also exclude helper calls and hidden IRQ masking from
the counter path, and check direct dynamic-mask bounds and the source-visible handoff. They
do not measure a whole-game cycle total or physical-chip timing. The local sequences meet the
irreducible same-effect floor; [issue #92](https://github.com/blendsdk/blend65/issues/92)
tracks a narrow RD-08 path to a measured program-scale win through proved register-value
reuse while retaining every volatile store. No weaker MMIO contract was accepted for a
smaller instruction count.

Expert authority lineage: `skillVersion=2.0.0`, qualified content commit
`c9e70fab6039e9ced3108e88f0ea9730d4fd3007`,
`references/c64-hardware.md#CIA-register-effects-and-ownership`,
`references/c64-memory-and-runtime.md#interrupt-entry-and-exit-contracts`, and
`references/sfa-and-abi.md#interrupt-route-completion-gate`; primary keys
`MOS-6526-1981` and `CBM-C64-KERNAL-03`.

## Verification and remaining ownership

The final checkpoint passed `yarn install --frozen-lockfile`, `yarn build`,
`yarn typecheck`, and `yarn test`: compiler 1,561/1,561, root 1,008/1,008, CLI 62/62,
language server 14/14, and VS Code 6/6. Four CIA VICE cases ran sequentially within the
root suite. Targeted Prettier, frozen-specification/expert-skill, source-key, output-cost,
plan-progress and diff checks passed. The independently authored CIA specification cases
were red before implementation and green after it. Independent review findings were
corrected; one scoped re-review cleared semantics and correctness, and its remaining
nonreturning memoization case was fixed within the approved performance finding and
verified with 24-layer returning and nonreturning helper diamonds. No further review cycle
was started.

Two boundaries remain deliberate and owned:

| Open item | Current safe behavior | Owner before whole-RD closeout |
|---|---|---|
| DEF-14 — return to BASIC after CIA1 timer/mask takeover | Reject `restoreIRQ()` or a normal BASIC-returning path after takeover; handler return is not BASIC return. This is a temporary guard, not a permanent game-language restriction. | RD-05 follow-on must prove bounded reverse device/vector/status handoff. |
| DEF-7 — CIA2/NMI/RESTORE source handoff | Permit non-consuming CIA2 counter reads; reject CIA2 state-changing operations and consuming ICR reads. | RD-05 R5.15–R5.17 must prove NMI update/re-entry, RESTORE and CIA2 ownership before enabling those operations. |

## Deferral-expiry answer

**Did this slice's deliverables expire any deferral's stated rationale? No.** The CIA1
exclusive IRQ handoff does not prove a safe NMI vector update, bounded NMI self-reentry, or
RESTORE/CIA2 source ownership, so DEF-7 remains due in RD-05. It does not restore the old
CIA1 device state before a BASIC return, so DEF-14 remains due in RD-05. Neither names this
closing CIA slice as its future landing place. The [RD-05 Won't Have list](../../requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md#wont-have-out-of-scope),
the active ambiguity registers, the [expressiveness ledger](../../../../../test/rd04/expressiveness-ledger.json),
and the reconsideration criteria in [future considerations](../../../../../spec/future-considerations.md)
were checked for this bounded work. No asset, loading, optimizer, editor, other-target,
stack-free-call, barrier, or separate-volatile-intrinsic trigger is met. Whole-RD R5.53
and AC-42 audits remain due at RD-05 closeout. RD-05 stays **Executing**, not Done.
