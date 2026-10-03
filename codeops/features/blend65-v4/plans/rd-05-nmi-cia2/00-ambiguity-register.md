# Ambiguity Register: RD-05 NMI and CIA2

> **Status**: ❌ GATE BLOCKED — source investigation complete; all-source bound remains unqualified
> **Last Updated**: 2026-10-03
> **CodeOps Artifact Schema**: 1

| Planning boundary | Scope                                                                                                                                                                                                                                                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Target            | The next bounded `blend65-v4/RD-05` NMI/CIA2 planning task, including DEF-7. The user confirmed xhigh effort and continuation on 2026-09-30. This is not implementation authority or whole-RD closeout.                                                                                                                                  |
| Context artifacts | Frozen Specification 4; RD-05 R5.15–R5.18/R5.20; the RD-04 DEF-7 decision; completed IRQ, CIA and CIA1-return plans; qualified expert 2.0.1; primary CPU/CIA/KERNAL evidence; current profile, semantic, storage and machine code.                                                                                                       |
| Modification set  | For the approved 2026-10-03 bounded RESTORE investigation: only this existing register and the feature roadmap at a justified lifecycle change. No compiler, test, requirement, frozen specification or expert-skill change, new executable plan, hook or other support surface is authorized. Earlier discovery is retained as history. |

| #     | Category                                             | Ambiguity / Gap                                                                                                                                                          | Options Presented                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | User Decision                                                                                                                                                                                                | Status                                               |
| ----- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| AR-P1 | Planning target / effort                             | Which next work item is authorized?                                                                                                                                      | The named RD-05 NMI/CIA2 planning task, with xhigh effort.                                                                                                                                                                                                                                                                                                                                                                                                                                                  | User: “xhigh effor is confirmed, proceed further” on 2026-09-30, replying to the explicitly named planning task.                                                                                             | ✅ Resolved                                          |
| AR-P2 | Scope / source safety (complex)                      | What is the smallest scope that can progress DEF-7 without inventing hardware guarantees or a runtime manager?                                                           | **Recommended:** a bounded proof-first slice on the four existing cooperative PRG profiles, using existing NMI/CIA2 APIs. Close permitted-source and live-handler re-entry facts first, then safe vector replacement and exact CIA2 handoff. If a permitted source remains unbounded or unknown, stop with the exact missing fact and retain the existing guard; do not invent a profile, promise a positive implementation, or silently defer the obligation. Raw takeover remains a separate RD-05 slice. | User: “Make sure we are not overcomplicating or overengineering. proceed further.” on 2026-10-01, accepting the sole scope recommendation presented immediately before the reply.                            | ✅ Resolved                                          |
| AR-P3 | Verification / inherited project rule                | Which existing verification policy applies if this plan becomes executable?                                                                                              | Directed specification, assembly/cost and implementation tests; frozen-lockfile install, build, typecheck and complete tests at phase checkpoints; sequential four-profile VICE cases; revision-sensitive physical QA at RD-10. Planning-only documents use link, authority and consistency checks.                                                                                                                                                                                                         | Import the unchanged approved CIA1-return AR-P4 verification policy and current AGENTS.md impact-based rules; no new verification surface.                                                                   | ✅ Resolved                                          |
| AR-P4 | Upstream profile qualification                       | The unchanged profile admits unbounded NMI nesting, which cannot fit a finite hardware stack. What qualified source contract could justify a finite bound?               | Reopen positive planning only with a qualified all-source nesting bound, or complete edge-spacing and worst-case route-time proof. Any correction to the frozen profile needs separate authority. Retain the existing DEF-7 guards meanwhile.                                                                                                                                                                                                                                                               | No source bound or frozen-spec correction is authorized. AR-P2's approved failure exit applies; DEF-7 remains open under RD-05.                                                                              | ❌ Open — positive implementation blocked            |
| AR-P5 | Scope / bounded source investigation                 | May the keyboard prerequisite return to its existing DEF-7 owner for one new evidence check?                                                                             | Inspect missing RESTORE/all-source guarantees, not another T-04 replay or repetition of the completed unbounded-profile check. Exit with new qualifying evidence or the specific user-owned source-contract fork. No compiler/spec edits or new subsystem.                                                                                                                                                                                                                                                  | User: “proceed” on 2026-10-03, replying to the named high-effort, docs/evidence-only RESTORE investigation and its exact modification set.                                                                   | ✅ Resolved — investigation only; AR-P4 remains open |
| AR-P6 | Product / source-contract reconciliation (sensitive) | Should positive NMI planning retain the unrestricted arrival guarantee, or seek explicit supported-machine/source conditions while preserving ordinary RESTORE behavior? | **Best option:** authorize one separate, bounded source-contract reconciliation task under DEF-7. Produce a concrete candidate and its remaining proof obligations for user decision; do not invent a finite number, assert that the frozen hardware fact is false, disable RESTORE, or add a hook/framework. The immediate safe alternative is to retain the unchanged contract and keep positive NMI/keyboard planning blocked.                                                                           | Recommendation only; no contract correction, source restriction or implementation is approved. The next task would modify only this existing register and the feature roadmap, not the frozen specification. | ❌ Open — next task needs user authority             |

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

The original bounded check is complete. The executable plan is not created,
DEF-7 remains unresolved, and RD-05 is not closed. Its then-next independent
PE-001 compiler-analysis memoization item has since completed as T-02/T-03; it
is not the current next task. AR-P5 authorizes the separate source investigation
recorded below, not another NMI support layer.

### AR-P5 source investigation — complete, 2026-10-03

**Result:** new board and firmware distinctions are verified, but a qualifying
all-source nesting bound is still **Unknown**. This is not another execution of
T-04 or the 79-frame contract counterexample. No physical pulse-rate or silicon
safety result is claimed.

| Evidence boundary                  | Status / claim kind                                                                      | Decisive observation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Older RESTORE circuitry            | Verified complete / Fact for the identified drawings                                     | Original Commodore diagrams [326106 sheet 1](https://www.zimmers.net/anonftp/pub/cbm/c64/schematics/manual/c64-21r.gif), [251138 sheet 2](https://www.zimmers.net/anonftp/pub/cbm/c64/schematics/manual/c64-27r.gif), and [251469 sheet 2](https://www.zimmers.net/anonftp/pub/cbm/c64/schematics/manual/c64-32r.gif) use U20's pins 1/2/6 RESTORE section with R33 = 47 kΩ and C23 = 360 pF. Power-on RESET uses its other section with R34/C24. The RESET duration cannot be substituted for a RESTORE spacing guarantee.                                                                    |
| Board coverage                     | Verified complete / Fact for the 1985 identification table                               | [Printed page 17](https://www.zimmers.net/anonftp/pub/cbm/c64/schematics/manual-html/Page_17.html) maps 326298-01 to 326106, 250407-04 to 251138, and 250425/250441-01 to 251469. These mappings do not qualify every later board.                                                                                                                                                                                                                                                                                                                                                             |
| Later wiring distinction           | Verified complete / Fact for the inspected drawing; exact revision applicability Unknown | The original Commodore-64 BN/E scan archived as 252312 ([left](https://www.zimmers.net/anonftp/pub/cbm/schematics/computers/c64/252312-left.gif), [right](https://www.zimmers.net/anonftp/pub/cbm/schematics/computers/c64/252312-right.gif)) connects keyboard RESTORE to the shared CPU NMI/CIA2 interrupt net without the older U20 RESTORE timer section. Its visible title does not establish a complete assembly/revision qualification. No timing bound is transferred from the older boards. Third-party redraws and corrected scans were not used as authority.                       |
| Retained firmware completion time  | Verified complete / Fact at the source boundary                                          | Pinned [`time::UD60/UD70`](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/time), source lines 49–58, repeat paired CIA1 PB reads until they match, without an iteration limit. No input-settling guarantee was established. A short generated scan or bounded scan retries do not give this retained route a finite worst-case completion time.                                                                                                                                                                                        |
| CIA2 acknowledgement and re-enable | Verified complete / Fact at the source boundary                                          | [MOS 6526 printed page 7](https://myoldcomputer.nl/Files/mos_6526_cia.pdf) defines Timer A, Timer B, TOD alarm, serial and FLAG sources and distinguishes consuming ICR reads from mask writes. Pinned [`rs232nmi::NNMI10/NMIRTI/T2NMI`](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/rs232nmi) clears masks, consumes ICR, and later re-enables sources; some paths re-enable before the terminal restore. A once-only RESTORE calculation or entry-side CIA2 mask does not close every admitted source or the complete live route. |
| Positive NMI/keyboard hook         | Unknown / Unknown                                                                        | No finite simultaneous-entry bound, complete source-spacing/route-time proof, safe publication/removal proof or complete cost was established. E10245/E10278 and keyboard AR-P2/AR-P3 remain unchanged.                                                                                                                                                                                                                                                                                                                                                                                        |

Nominal component values are not a qualified minimum interval. Such a claim
would need the exact circuit, component tolerances, triggering/recovery behavior,
input conditions, shared-line effects and CPU acceptance, plus the full route's
worst-case time including firmware loops and bus stalls. The later drawing is
supplemental primary evidence, not a new active expert source or a qualified
replacement profile. No new numeric bound is proposed.

For CIA2, each admitted source must be individually owned, proved inactive, or
bounded through its acknowledgement and re-enable points. The stock/unexpanded
machine assumption already excludes cartridges and expansions; it does not by
itself establish all user-port or retained RS-232 source conditions. RESTORE
must be accounted for independently. These observations identify missing proof,
not new source restrictions.

**Complete relevant cost:** this documentation-only task emits no instructions,
data, SFA homes, links or stack frames and adds no runtime work. For a future
hook, output/ROM bytes, link/marker storage, SFA overlap, stack peak and complete
entry/body/acknowledgement/restore/exit timing remain **Unknown**. The existing
independent obligations below still apply, including callback-only identity,
reachable variants, full A/X/Y/status/D restoration and bank-safe links.

#### Reproducible source identities

The downloaded originals and renders are captured in
`/tmp/blend65-restore-safety.XTgULP/`; temporary files are not distribution assets.
The source URLs above and hashes below preserve identity after that capture expires.

| Source                                          | SHA-256                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| PN 314001-02 PDF, linked in the original check  | `cda2d51b995008660c592c66669c44c3340e2b86a990c2e9207d2c83555e43a0` |
| Original 326106 sheet 1                         | `841d3c318e302affe9c9e38253406ffeb362d4b0e4a4d1f9d6f48f9dfcf23677` |
| Original 251138 sheet 2                         | `7016c04aff5a85b7941769a8b6012c216424bfb274d2a679412e939265f01698` |
| Original 251469 sheet 2                         | `1c1459c4b06418201dc0370bcb5f184130e2ddafb78f5d602e14a383887721bc` |
| Supplemental BN/E left scan archived as 252312  | `3650bdae9630add7dafcf4ddd4adcfb6fd04f1c861d8083b159dc4bd80bda74b` |
| Supplemental BN/E right scan archived as 252312 | `a1b8b30a0457fde14fbfd021d720fdc64061ca95d52e93f79f0f4666ca527645` |
| MOS 6526 November 1981 PDF                      | `3c0e8403c3b46c0b74980e6cc7bec41a72d7aa82deabd58cc7884a11532ac78f` |
| Pinned KERNAL `time`                            | `f62d5bff4bdac9934c91d709ad0050ce3ba6b19b4bc755e5fd5005272fa2fbaf` |
| Pinned KERNAL `rs232nmi`                        | `48b51552deca6f181cd1257aa71041deb5781fd69fb8c9fcb6e44f88dbd8cd03` |

#### Investigation exit and user-owned decision

**Best option — AR-P6:** a separate bounded source-contract reconciliation task,
not another identical source probe. The current frozen hardware row is not
proved false: NMI is not automatically self-masking. The unresolved product
choice is whether positive support must cover unrestricted repeated external
arrivals, or may depend on an explicit, qualified set of machine, peripheral and
source conditions. The latter could make a finite per-route proof possible;
it does not establish one now or authorize a silent source restriction.

The next task's deliverable would be one concrete contract candidate in this
register: exact admitted machines/sources, observable RESTORE/firmware behavior,
each proposed assumption or exclusion, evidence that can qualify it, and the
remaining entry/exit, resource and timing obligations. It must state any effect
on ordinary game input in plain language. If the candidate cannot support a
finite proof, it must return that specific product fork instead of starting
another open-ended investigation. Only this register and the feature roadmap
would change. Exact frozen-spec corrections, tests and implementation remain
separate approval boundaries.

Normal keyboard ergonomics, both joystick ports and ordinary RESTORE remain the
intended behavior. Neither a no-RESTORE rule nor raw/best-effort samples in place
of named-key results are approved. A duplicate keyboard NMI subsystem, general
interrupt manager or software guard that merely ignores already-entered nested
frames cannot satisfy the unchanged all-source requirement.

Confidence: **High** for this next decision boundary; positive safety remains
**Unknown**. Hardening: a fresh blind `design-challenger` independently inspected
the frozen contract, current guards, pinned firmware and original drawings and
converged on the bounded reconciliation task. Verdict: **Simplify** — one DEF-7
owner, no new support machinery. The strongest counterargument is that even
ordinary stock operation may not yield a defensible finite guarantee. A failed
candidate must finish blocked; more research is not the default exit.

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

## Historical verification — original bounded check

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

## Verification — AR-P5 investigation

Artifact checks pass for the exact two-document modification set, 54 local
links, six primary source keys, four expert anchors, nine original-source hashes,
the pinned firmware instructions, blocked gates, whitespace and frozen-authority
cleanliness. Forced targeted Prettier passes for this register; the roadmap
retains its authored-documentation exclusion. Capture:
`/tmp/blend65-restore-safety.XTgULP/artifact-check.log`, `format-check.log` and
`roadmap-check.log`. Independent `correctness-reviewer` review returned **no
findings** across correctness, maintainability, standards, API surface and
concurrency; it also checked the captured originals and source hashes. The
review was read-only.

This is documentation and primary-source inspection only; no new compiler,
assembly, VICE or physical hardware qualification is claimed. Compiler tests
and performance/security auditors are not applicable to this docs-only change.
The feature remains 4/10 with RD-05 executing. The portfolio's existing 1/10
roll-up mismatch is deferred on this non-integration branch; the roadmap engine
reports no counter drift in the feature roadmap.
