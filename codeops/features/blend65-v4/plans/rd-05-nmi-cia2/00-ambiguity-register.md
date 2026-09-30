# Ambiguity Register: RD-05 NMI and CIA2

> **Status**: ❌ GATE BLOCKED — bounded check complete; unchanged profile cannot certify NMI nesting
> **Last Updated**: 2026-10-01
> **CodeOps Artifact Schema**: 1

| Planning boundary | Scope |
|---|---|
| Target | The next bounded `blend65-v4/RD-05` NMI/CIA2 planning task, including DEF-7. The user confirmed xhigh effort and continuation on 2026-09-30. This is not implementation authority or whole-RD closeout. |
| Context artifacts | Frozen Specification 4; RD-05 R5.15–R5.18/R5.20; the RD-04 DEF-7 decision; completed IRQ, CIA and CIA1-return plans; qualified expert 2.0.1; primary CPU/CIA/KERNAL evidence; current profile, semantic, storage and machine code. |
| Modification set | This new plan's documents, and the feature roadmap at a justified lifecycle transition. No compiler, existing oracle, requirement, frozen specification or expert-skill change is authorized by plan creation. |

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|---|---|---|---|---|
| AR-P1 | Planning target / effort | Which next work item is authorized? | The named RD-05 NMI/CIA2 planning task, with xhigh effort. | User: “xhigh effor is confirmed, proceed further” on 2026-09-30, replying to the explicitly named planning task. | ✅ Resolved |
| AR-P2 | Scope / source safety (complex) | What is the smallest scope that can progress DEF-7 without inventing hardware guarantees or a runtime manager? | **Recommended:** a bounded proof-first slice on the four existing cooperative PRG profiles, using existing NMI/CIA2 APIs. Close permitted-source and live-handler re-entry facts first, then safe vector replacement and exact CIA2 handoff. If a permitted source remains unbounded or unknown, stop with the exact missing fact and retain the existing guard; do not invent a profile, promise a positive implementation, or silently defer the obligation. Raw takeover remains a separate RD-05 slice. | User: “Make sure we are not overcomplicating or overengineering. proceed further.” on 2026-10-01, accepting the sole scope recommendation presented immediately before the reply. | ✅ Resolved |
| AR-P3 | Verification / inherited project rule | Which existing verification policy applies if this plan becomes executable? | Directed specification, assembly/cost and implementation tests; frozen-lockfile install, build, typecheck and complete tests at phase checkpoints; sequential four-profile VICE cases; revision-sensitive physical QA at RD-10. Planning-only documents use link, authority and consistency checks. | Import the unchanged approved CIA1-return AR-P4 verification policy and current AGENTS.md impact-based rules; no new verification surface. | ✅ Resolved |
| AR-P4 | Upstream profile qualification | The unchanged profile admits unbounded NMI nesting, which cannot fit a finite hardware stack. What qualified source contract could justify a finite bound? | Reopen positive planning only with a qualified all-source nesting bound, or complete edge-spacing and worst-case route-time proof. Any correction to the frozen profile needs separate authority. Retain the existing DEF-7 guards meanwhile. | No source bound or frozen-spec correction is authorized. AR-P2's approved failure exit applies; DEF-7 remains open under RD-05. | ❌ Open — positive implementation blocked |

## Discovery evidence

### Current capability — Verified partial / Fact

The four selected cooperative profiles expose NMI sink facts but deliberately
leave external re-entry unbounded and self-masking false in
[`target/profile.ts`](../../../../../packages/compiler/src/target/profile.ts).
[`whole-program.ts`](../../../../../packages/compiler/src/semantic/whole-program.ts)
rejects such reachable sinks with E10245 before emission.
[`cia-ownership.ts`](../../../../../packages/compiler/src/semantic/cia-ownership.ts)
allows CIA2 counter observation but rejects its state-changing and consuming
operations with E10278. These guards are not positive NMI qualification.

The existing
[`lower-c64-interrupt.ts`](../../../../../packages/compiler/src/machine/lower-c64-interrupt.ts)
has exact entry wrappers and IRQ-safe two-byte vector transactions. Its
`PHP; PHA; SEI` transaction is not an NMI safety proof. The current
[`profile-interrupts.spec.test.ts`](../../../../../test/rd05/profile-interrupts.spec.test.ts)
requires NMI rejection. It may not be rewritten merely to make new code pass.

The common machine contract in
[`appendix-c64.md`](../../../../../spec/appendix-c64.md) already excludes
cartridges and expansions. Their absence needs no new product restriction.
The current
[`irq-stack.ts`](../../../../../packages/compiler/src/storage/irq-stack.ts)
measures IRQ overlap and I-bit eligibility. Existing NMI domain labels do not
make that algorithm an NMI nesting or whole-route stack proof.

### Bounded check result — negative certification, not hardware impossibility

The frozen source record in
[`appendix-c64.md`](../../../../../spec/appendix-c64.md), lines 877–886,
allows NMI to preempt NMI, does not mask it on entry, and leaves external
re-entry unbounded. Section 10's closed deltas retain these facts in all four
cooperative PRG profiles. This is normative contract evidence, not a restriction
inferred from current compiler code.

[`06-functions.md`](../../../../../spec/06-functions.md) §7.9 assigns three
CPU-stack bytes to each interrupt entry and accumulates overlapping live entries.
The profile supplies 256 bytes with a 20-byte reserve: 236 usable bytes. Just
79 simultaneously live CPU frames require 237 bytes, before caller, wrapper or
helper costs. The admitted unbounded nesting therefore cannot have a finite
certified peak. E10245 explicitly covers hardware-stack consumption even when
the application body needs no invocation-private storage.

A generated guard runs after CPU/ROM entry; it cannot bound arbitrary repeats
before it executes. Masking CIA2 alone does not cover independent RESTORE entry.
A matching-low-byte vector does not close this source obligation either. No
new guard, manager, profile, storage mechanism or compiler change is justified
by this result.

The [Commodore C64 service manual, PN 314001-02, printed page 12](https://oldcrap.org/wp-content/uploads/2023/04/commodore-c64-service-manual-314001-02.pdf)
describes RESTORE's U20/U8 NMI path but provides no qualified minimum RESTORE
edge-spacing guarantee there. Its half-second RESET description is not a RESTORE
bound. This supplemental primary-source probe does not activate a new expert
authority or qualify board-specific timing.

**Exact reopening fact:** a qualified finite simultaneous-entry bound covering
RESTORE and every admitted CIA2/retained firmware source over the complete
CPU/ROM/body/acknowledgement/exit route. A spacing argument also needs complete
worst-case route timing and coverage of admitted board variants. Such evidence
would require reconciliation with the frozen unbounded source row before code.
Physical feasibility remains **Unknown**; this result does not claim that real
RESTORE hardware can produce the abstract counterexample schedule.

The approved bounded check is complete. The executable plan is not created,
DEF-7 remains unresolved, and RD-05 is not closed. The smallest next independent
RD-05 item is the already recorded PE-001 compiler-analysis memoization debt;
starting it requires its own task handoff, not another NMI support layer.

### Independent obligations — Unknown positive safety

1. **Vector replacement:** both bytes, every intermediate target, saved-link
   publication, handler-side updates and restoration must be safe even if an
   NMI arrives during the transaction. `SEI` alone is insufficient.
2. **Live-handler re-entry:** every source capable of another NMI edge must have
   a proved finite overlap/stack bound. Human input being infrequent is not a
   bound. A placement-based vector solution alone does not settle this.
3. **CIA2 handoff:** assign the consuming ICR read and each enabled source to
   an exact owner; account for RESTORE and retained firmware behavior. Do not
   reconstruct write-only masks or timer latches from readback, or silently
   widen ownership of VIC-bank and serial-port fields.
4. **Observable behavior and cost:** retain callback-only identity, reachable
   entry variants, A/X/Y and full status restoration, binary body entry, exact
   predecessors and page-safe indirect links. Account separately for emitted
   bytes, existing ROM, SFA homes, hardware stack, volatile effects, and path
   costs. No generated NMI artifact or runtime pass is claimed at this stage.

The [pinned KERNAL NMI source](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/rs232nmi)
dispatches through NMINV without saving registers first. Its stock handler
consumes CIA2 ICR and retains source-dependent RS-232/cartridge/RESTORE+STOP
behavior. The [MOS 6526 data sheet](https://myoldcomputer.nl/Files/mos_6526_cia.pdf)
distinguishes consuming interrupt-data reads from write-only mask state and
timer counters from write-only reload latches. Both primary sources were
inspected during this planning task; neither supplies a universal RESTORE
re-entry bound or an arbitrary prior-device snapshot.

## Authority and scope guard

`skillVersion=2.0.1`, qualified content
`1ce4852016e2a883cf1f733c6014c45e176bfc69`; specification identity
`BLEND65-SPEC-4-1c2a2d7544e263020c6b7c5b40dc15aa23178d15e6b12b4e0224b18667e48dcf`.
Governing expert boundaries are `sfa-and-abi.md#interrupt-route-completion-gate`,
`c64-memory-and-runtime.md#revision-pinned-nmi-contracts-and-costs`,
`c64-hardware.md#cia-register-effects-and-ownership`, and
`mos-6502-family.md#reset-interrupt-and-stack-behavior`.
Primary keys: MOS-PGM-1976, MOS-HW-1976, MOS-6510-1982, MOS-6526-1981,
CBM-C64-KERNAL-03. Revision-sensitive board claims additionally need an exact
CBM-C64-SVC-1985 schematic/model; emulator checks cannot replace physical QA.

No new profile, source restriction, language API, runtime trampoline/gate,
dispatcher, shadow manager, dependency or harness is approved. Any such
necessary proposal must be grounded and receive the applicable explicit
product/complexity decision before entering executable work. DEF-7 remains
owned by RD-05; this register does not close or silently re-defer it.

The complete 12-category scan, technical resolutions, specification-first test
cases and executable plan remain pending. The approved failure exit does not
turn this into a passed planning gate. Only this incremental register may be
written while the planning gate is blocked.

## Independent simplicity and safety challenge

One blind `design-challenger` reviewed three candidate directions: immediate
direct implementation with derived proofs; a bounded proof-first cooperative
slice; or a separately approved source-restricted profile/runtime gate. It
selected the proof-first slice. No new profile/runtime system is justified by
the evidence now. Source/nesting closure is the first pass/fail condition, not
an open-ended research phase. A failure must identify the unclosed permitted
source and the missing fact, with DEF-7 still owned by RD-05.

A matching-low-byte layout (stock predecessor `$FE47`, generated entry `$xx47`)
is a real candidate for publishing only the vector's high byte. This is an
analytical possibility, not an approved or qualified lowering. Saved-link
publication, placement/padding, nesting and restore obligations still need
proof. It solves neither RESTORE re-entry nor CIA2 ownership by itself; no
placement mechanism or runtime gate is added by this register.

The strongest counterargument to the recommended order is that it may finish
without a new usable NMI capability. That is preferable to recording a false
finite bound or building unneeded support machinery: the gate returns a
specific fact to resolve, not a claim that NMI is permanently impossible.

The final bounded independent challenge confirmed that the normative unbounded
row makes certification fail under the unchanged contract. The strongest
counterargument is that actual RESTORE circuitry and source control may allow
a small direct implementation once their guarantees are qualified. That keeps
physical feasibility Unknown without invalidating the contract-level result.

Confidence: High for the negative certification result under the unchanged
contract. Hardening: two bounded independent challenges; no further research
or support machinery in this task. The user confirmed AR-P2 with an explicit
simplicity constraint. No new RESTORE behavior, source restriction or runtime
support approval is granted by that planning-scope confirmation.

## Verification

All 20 cases in `test/rd05/profile-interrupts.spec.test.ts` pass with one worker:
the existing four-profile NMI rejection cases and positive IRQ controls. Capture:
`/tmp/blend65-nmi-check-5H6m3D/profile-tests.log`. No oracle or compiler file
changed. Checks pass for 47 local links, six primary source keys, four expert
anchors, whitespace and frozen-authority cleanliness. Markdown retains the
project's authored-documentation formatter exclusion.

The roadmap engine confirms the feature's 2/10 counter. It reports the existing
portfolio mismatch (1/10 and its rolled-up status); that separate write remains
deferred on `feature/v4-rebuild` until integration, as the roadmap rule requires.
The portfolio is unchanged. No new assembly, VICE, physical-hardware or
whole-compiler qualification is claimed by this planning-only task.
