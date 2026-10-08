# Keyboard and combined input — planning decisions

> **Status**: ❌ POSITIVE IMPLEMENTATION GATE BLOCKED — diagnostic proofs do not approve the public API
> **Last Updated**: 2026-10-08 09:10 CEST
> **CodeOps Artifact Schema**: 1

## Planning scope contract

| Boundary          | Authority                                                                                                                                                                                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planning target   | `blend65-v4/RD-05` R5.25/AC-20 and the remaining R5.24/AC-19 keyboard-coexistence obligation. The user confirmed high effort and continuation after the proposed focused keyboard/combined-input planning task.                                                                                                 |
| Context artifacts | RD-05 and its requirements decisions; the live feature roadmap; the completed joystick/library pilot; current source loading, profile declarations, semantic/lowering/storage and startup seams; frozen Specification 4 and expert baseline; primary CIA/KERNAL evidence. Reading does not authorize edits.     |
| Modification set  | During positive-plan discovery, only this register may be written. AR-P4 approves T-04 and its feature-roadmap update; AR-P5 separately approves T-05, both existing decision registers and the feature roadmap. No compiler, tests, upstream requirements, frozen spec or expert-skill changes are authorized. |

## Ambiguity register

| ID    | Category                                             | Decision needed                                                                                                                | Recommendation / authority                                                                                                                                                                                                                                                                | Status                                                                                                                                                                        |
| ----- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AR-P1 | Scope / product boundary                             | What is the next planning task?                                                                                                | User confirmed the focused RD-05 keyboard/combined-input plan. Preserve both existing raw joystick reads and the approved library-first direction. The existing product boundary excludes an input manager, event queue, scheduler, debounce and repeat policy.                           | ✅ Resolved — existing scope and product authority                                                                                                                            |
| AR-P2 | Data/state / technical — sensitive                   | What port-state and firmware-ownership contract permits a usable standard scan?                                                | Recommend a narrowly cooperative stock keyboard handback, with exact restoration only where the prior state is proved. The whole-byte CIA1 PA-latch exception and exact R5.25/AC-20 amendment need the user's product decision. No frozen conflict is established; no state manager or frozen-authority edit is approved. | ❌ Open — proposed contract; not implementation authority                                                                                                                     |
| AR-P3 | Behavior / integration / user-facing API — sensitive | What does a combined keyboard/joystick observation promise when shared lines or multiple keys prevent a unique interpretation? | Preserve raw observations and expose affected-key uncertainty, not blanket keyboard invalidation or invented input. Eight row bytes and two port observations are a candidate, not an accepted API. Names, acquisition-quality representation and certainty contract await the proof.     | ❌ Open                                                                                                                                                                       |
| AR-P4 | Scope / delivery                                     | Should the next executable slice be proof-only rather than positive keyboard support?                                          | One bounded proof task using pinned ROM and existing VICE support, before accepting the keyboard API plan. No production changes, new framework, NMI adapter, profile correction or optimizer. Keep AR-P2/AR-P3 open for the positive plan.                                               | ✅ Resolved — user replied “proceed” to the proof-only recommendation; [T-04 mini-plan](../keyboard-scan-proof/99-execution-plan.md) owns execution                           |
| AR-P5 | Scope / delivery / developer experience              | May one scan-aware ingress candidate test the approved ordinary-input direction?                                               | Reuse DEF-7 and existing diagnostic facilities. Test eight saved rows, both raw port observations and stock NMI coordination, without accepting public certainty semantics or changing frozen authority.                                                                                  | ✅ Resolved — user replied “I approve” on 2026-10-03 to the deeper assessment; [T-05](../keyboard-ingress-proof/99-execution-plan.md) owns the proof; AR-P2/AR-P3 remain open |

## Evidence and lineage

- Current declarations provide only the two raw joystick reads and five saved-byte predicates:
  [profile declarations](../../../../../packages/compiler/src/frontend/profile.ts), lines 242–251.
  No keyboard capability is present in that inventory.
- [Pilot closeout](../rd-05-joystick-library/08-closeout.md) leaves combined scanning and the
  remaining joystick-coexistence cases with RD-05. Callable-source migration remains conditioned
  on equal-cost RD-08 function expansion, not an early optimizer in this plan.
- Current [startup](../../../../../packages/compiler/src/layout/startup.ts) does not capture
  CIA1 port latches. Its existing save area is not evidence of an input-latch shadow.
- Hardware authority: MOS-6526-1981, printed p.5, states that both input and output port reads
  reflect actual pin levels. The [manufacturer datasheet](https://myoldcomputer.nl/Files/mos_6526_cia.pdf)
  was rechecked during discovery. Exact output-latch restoration cannot be inferred from pin reads.
- Firmware authority: CBM-C64-KERNAL-03, content `01bd60f162ef92212ef0cb67546ae8f42be34168`,
  `init::IOINIT` and `editor.2::SCNKEY/SCNRTS`. These establish stock port directions and the
  `$7F` port-A idle write, not permission to replace arbitrary application-owned state.
- A returning stock NMI is also a port owner: `rs232nmi::NNMI19` calls `time::UD60` before
  checking STOP. When the observed PB7 is low, `UD60` temporarily writes `$BD` to port A,
  then writes its earlier port-B sample to port A. It does not restore an interrupted scan's
  selected column. `PHP; SEI; ...; PLP` alone cannot exclude that NMI or certify a row's column.
  Sources: [pinned NMI source](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/rs232nmi)
  and [pinned time source](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/time).
  The same interaction is reachable during stock `SCNKEY`; this is not claimed to be a new
  universal firmware defect introduced by Blend65.
- Expert identity: version `2.0.1`, qualified content
  `1ce4852016e2a883cf1f733c6014c45e176bfc69`; references
  `c64-hardware.md#ports-and-data-direction`,
  `c64-memory-and-runtime.md#interrupt-entry-and-exit-contracts`,
  `compiler-architecture.md#target-composition`, and `sfa-and-abi.md#final-storage-closure`.
  Governing source keys: BLEND65-SPEC-4-1c2a2d75, MOS-6526-1981,
  CBM-C64-PRG-1982, CBM-C64-KERNAL-03. Neither frozen authority is changed.

## Discovery boundary

### Latest approved direction and diagnostic evidence

AR-P5 approves the ordinary-input/internal-coordination direction and its single
[T-05 proof](../keyboard-ingress-proof/99-execution-plan.md). This supersedes the
earlier next-task authorization wording below, not AR-P2/AR-P3 or frozen authority.
The shared DEF-7 owner remains the only NMI safety owner.

T-05 confirms the false-STOP inference in stock PAL VICE and demonstrates a small
conditional remedy: restore the declared idle drive before stock NMI scanning and
mark the interrupted acquisition invalid. The isolated ingress preserves tested
state, survives a two-entry generated overlap and keeps genuine STOP reachable.
The snapshot includes eight raw rows and two raw port samples; no joystick was
pressed and no unique input interpretation or atomic snapshot is qualified.

This is **Verified partial — VICE-verified / hardware-unverified**. It does not
accept arbitrary old-latch restoration, full firmware/stack safety, all-64-key
decoding or the public acquisition-quality representation. NMI AR-P7 still needs
exact frozen proof-scope authority; keyboard AR-P2/AR-P3 remain open. The component
cost is now measured in the linked diagnostic ledger; production acquisition cost
and expert-output parity remain Unknown. No library, compiler or test file changed.

Status is **Verified partial**: existing joystick support and the missing keyboard API are
inspected facts; scan implementation, emitted cost and runtime qualification remain **Unknown**.
No compiler code, test oracle, optimization exception, latch manager or NMI route is approved here.
The next step is a bounded contract recommendation and the material user decisions, not execution.

### Independent challenge and recommended next boundary

One blind `design-challenger` reviewed the scan contract as required by the planning skill.
Its recommendation converges on **proof first**, aimed toward a small known-state typed
transaction. It rejects accepting an IRQ-only protection claim over the returning-NMI path.
PB6/PB7 timer output can also override DDRB; readable directions alone do not establish all
64 keyboard inputs. No generalized state service, optimizer, NMI adapter or profile correction
is justified by this discovery.

A post-row port-A comparison was a proof candidate, not a settled remedy. The challenger's exact
held-key example predicted matching `$7F`, but [T-04 replay](../keyboard-scan-proof/99-execution-plan.md#results)
observed `$7D`: STOP + Left Shift also pull a PA pin low. That exact example is rejected by the
guard, not a false acceptance. A variant releasing all keys after the second returning NMI and
before the PA read preserves the wrong earlier PB0 sample yet observes matching `$7F`. Thus a
final matching pin observation does not by itself certify the earlier driven column under that
explicit changing-input schedule. No fixed-key, physical-cadence or nested-NMI result is claimed.

The smallest proposed proof replays the exact stock route and observes column writes, row samples,
quality checks and restoration, with the simpler single-returning-NMI case as control. It also
checks both caller I states and PB timer-output ownership. Actual keyboard-event/NMI injection
through the existing VICE facilities must be confirmed before the probe is called runnable;
no new monitor driver or harness is authorized by this recommendation.

Confidence: **High** for the proof-first next boundary; **Medium** for the guard's sufficiency.
Hardening changed the initial known-state-scan candidate by exposing a returning firmware owner.
Challenger: **converged** on not accepting positive support before that ownership/quality proof.
The strongest counterargument is that this delays useful input support if a small guard is enough;
the focused proof is intended to answer that without adding production machinery.

AR-P4's proposed modification set is this discovery register plus, after approval, one separate
lightweight proof-task plan and the normal feature-roadmap update. The positive keyboard plan
remains blocked; no upstream requirement, frozen spec or expert-skill edit is proposed.

AR-P4 is now approved. T-04 confirms the genuine returning stock route, both caller I states,
known-state restoration at its stated boundary and PB6/PB7 timer-output override in the selected
PAL VICE model. The positive API decisions AR-P2/AR-P3 remain open; proof does not choose them.

### Post-proof decision for AR-P2

**Best option:** Define the smallest keyboard/stock-firmware coordination contract before
accepting positive scanning. Preserve stock RESTORE behavior and use the existing RD-05 NMI
owner as context. This requests authority for focused contract design only, not a chosen
adapter, NMI subsystem, profile/spec correction or compiler implementation. The modification
set remains this discovery register until the positive plan gate passes; no T-04 replay is due.

Ordinary time skew between key samples is acceptable: a saved snapshot need not represent one
atomic physical instant. The demonstrated conflict is different: firmware changes the column
being driven, so a row can be attributed to the wrong column. An exact PA pin comparison also
rejects valid connected keys; bounded retries alone do not prove attribution. The current
requirements [R5.25/AC-20](../../requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md)
require correct named-key attribution, not merely delivery of raw attempted observations.
Stock SCNKEY publication is not a saved 64-position matrix. A proved NMI-quiescent precondition
could be smaller, but the current cooperative route supplies none; an implicit “do not press
RESTORE” restriction is not accepted.

The strongest counterargument is that documented best-effort input may be adequate for games.
That is a real weaker product contract, but accepting it silently would weaken the existing
named-key requirement. No particular coordination mechanism is yet proved necessary or sufficient.

Confidence: **Medium** for the smallest coordination design; **High** that the present final-PA
guard is not an unconditional certificate. Hardening: corrected the exact held-key counterexample
and separated normal input time skew from a competing column writer. Challenger: **converged**
on focused ownership-contract design, with no positive contract accepted inside the proof scope.
The user approved resuming this focused design boundary with “resume, proceed” on
2026-10-03. This resumes the already confirmed high-effort keyboard planning task;
it does not approve an NMI hook or expand the modification set. AR-P2/AR-P3 stay open.

### Contract-design result: reuse the existing NMI safety owner

**Best next direction:** qualify the shared NMI prerequisite under the existing
[DEF-7 owner](../rd-05-nmi-cia2/00-ambiguity-register.md), before accepting a keyboard
interception mechanism. Do not create a parallel keyboard-owned NMI subsystem.
This is a recommendation for the next bounded task, not an executable keyboard plan.

| Boundary                                         | Result and decisive evidence                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stock returning NMI can change the driven column | **Verified complete / Fact** for T-04's bounded PAL VICE replay; [results](../keyboard-scan-proof/99-execution-plan.md#results) remain hardware-unverified. No replay or stronger qualification is added here.                                                                                                                                                                                                                                    |
| Stock STOP interpretation during a scan          | **Verified partial / Inference** from pinned ROM instructions. With only Cursor U/D held, PA=$FE yields PB=$7F. `UD60` then drives $BD, observes $FF, and stores the earlier $7F in STKEY. `NSTOP` treats $7F as STOP; `NNMI19` takes the warm-start path although physical STOP is not held. T-04 deliberately used a returning shifted-key case and STKEY=$FF; it did not test this exit. Runtime and physical confirmation remain Unknown.     |
| A firmware-clock guard                           | **Incorrect / Fact** as an interference detector: `NNMI19` calls `UD60`, after the clock increment in `UDTIM`. This returning path need not change the clock.                                                                                                                                                                                                                                                                                     |
| Marker-only NMI chaining                         | **Incorrect / Inference** as the complete proposed remedy: detecting a contaminated sample after return cannot prevent the earlier false-STOP exit. A counter also needs a wrap proof; an idempotent flag avoids that extra problem, not the exit problem.                                                                                                                                                                                        |
| A scan-aware NMI hook                            | **Unknown / Unknown** positive safety. Re-establishing stock-compatible CIA1 state before firmware scans, marking interference, and chaining is a conditional candidate only. Source/nesting, safe publication/removal, ownership, exact entry/exit state and full cost are not qualified.                                                                                                                                                        |
| Current NMI source contract                      | **Verified complete / Fact** at the contract boundary: the unchanged [frozen profile](../../../../../spec/appendix-c64.md), lines 877–886, admits unbounded NMI self-preemption. The current [sink facts](../../../../../packages/compiler/src/target/profile.ts), lines 174–191, and [E10245 guard](../../../../../packages/compiler/src/semantic/whole-program.ts), lines 348–355, retain that restriction. A keyboard hook must not bypass it. |

ROM authority is the unchanged `CBM-C64-KERNAL-03` content already pinned above:
[time::UD60/UD70/UD80](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/time),
[errorhandler::NSTOP](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/errorhandler)
and [rs232nmi::NNMI19/TIMB](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/rs232nmi).
The isolated source example assumes stable keys and no intervening second NMI; it is
not a new observed VICE trace or a claim about every electrical input combination.

#### Smallest conditional coordination contract

If DEF-7 becomes qualified and separate authority accepts interception, a direct
scan transaction could mark firmware interference and give the stock handler its
declared CIA1 scan state before chaining. Captured rows affected by interference
must not become named-key results. A bounded attempt policy can return acquisition
uncertainty rather than invent input; that policy remains AR-P3's decision.
It is distinct from electrical ghosting and joystick ambiguity.

The acquisition window must include state restoration: clear the marker only when
discarding an old attempt before any new column drive; restore the declared idle
state before the final marker read. A later NMI cannot retroactively change saved
rows. This is an analytical candidate, not an approved scan algorithm. Finite scan
attempts do not bound NMI nesting or the stock `UD60`/`UD70` settling loops.

Any later route must preserve the exact predecessor, entry A/X/Y and status,
binary generated-body state and final full-status RTI behavior; leave the consuming
CIA2 ICR read with firmware; and charge every shared byte, SFA home, saved link,
hardware-stack path, emitted byte, existing-ROM path and placement/padding cost.
Only reachable entry variants may be emitted; source interrupt handlers remain
callback-only and ordinary helpers remain JSR/RTS. No positive route or cost is
certified here. No state or code has been added, so this task's runtime-cost delta
is zero; the conditional mechanism's complete cost remains Unknown.

The [existing vector transaction](../../../../../packages/compiler/src/machine/lower-c64-interrupt.ts),
lines 211–215 and 235–310, is IRQ-masked and writes two vector bytes. It is not safe
NMI publication evidence. Matching the stock $FE47 low byte and publishing one
high byte could avoid a torn vector, but neither the required placement nor its
install/remove boundaries are proved. It does not solve nesting. The
[startup save area](../../../../../packages/compiler/src/layout/startup.ts), lines
14–37, supplies no CIA1 latch shadow. Do not add a manager to claim arbitrary
old-latch restoration.

#### Next authorization boundary

The exact missing prerequisite is DEF-7's qualified finite simultaneous-entry
bound covering every admitted NMI source, together with safe route publication
and restoration. Human infrequency, one VICE event, SEI or a short scan is not that
bound. The frozen unbounded row cannot be silently narrowed. Qualification might
identify a necessary profile correction; changing the frozen specification or
expert baseline would still require a separate, explicit authority and their
existing qualification process.

The recommended next task modifies only the existing DEF-7 discovery register
and, at a justified lifecycle change, the feature roadmap. It has a finite exit:
record a supportable source contract from new qualifying evidence or surface the
specific user-owned source-contract fork and stop. Do not repeat DEF-7's completed
negative nesting check or turn this into recurring proof/marker variants. No
hook, compiler/test change, generalized NMI facility, new profile, dependency,
harness or further T-04 replay is part of that recommendation. This expanded
modification set awaits the user's approval; this task writes only the keyboard
register. Raw best-effort observations or stock selected-key publication cannot
silently replace the accepted all-64 named-key requirement.

One fresh blind `design-challenger` independently selected the shared DEF-7
direction. Its complexity verdict is **Simplify**: no second NMI owner, manager,
dispatcher or harness; keep scan-scoped coordination only as a conditional
analytical candidate. No larger support surface is recommended or approved.
The source-library direction remains unchanged: saved-data interpretation belongs
in ordinary Blend65; exact hardware/firmware ownership belongs at the platform
primitive boundary. The joystick pilot's cost exception is not a keyboard waiver.

The strongest counterargument is that a direct hook may work on real machines and
this prerequisite delays useful input. That changes the decision only when the
missing all-source and transition guarantees are qualified; a plausible shim is
not the required proof. Confidence: **High** for sharing the existing prerequisite;
the positive mechanism remains **Unknown**. Hardening: eliminated marker-only
chaining using the false-STOP path and included restoration in the acquisition
window. Challenger: **converged**. Expert lineage remains `2.0.1`, qualified content
`1ce4852016e2a883cf1f733c6014c45e176bfc69`, with the already recorded interrupt-route,
CIA-port and final-storage-closure boundaries. No frozen authority is changed.

## Current contract reassessment — 2026-10-08

This section supersedes the earlier next-prerequisite recommendation, not its historical
observations. Baseline: clean implementation checkpoint `a05b461e60e0d543270cdb15866196af66337dc5`.
The [shared NMI closeout](../rd-05-nmi-cia2/08-closeout.md),
[CIA2 closeout](../rd-05-cia2-ownership/08-closeout.md) and
[T-09 startup repair](../cia2-startup-preservation/99-execution-plan.md) have completed their
bounded qualification. Ordinary private-home-free NMI source is no longer rejected merely
because this support was unfinished. That does not prove a keyboard scan or CIA1 latch provenance.
External aggregate stack, retained-ROM completion and physical input behavior remain unproved.

### Two current construction probes

Public `buildProject` and real ACME 0.97 constructed two ordinary-source ingress candidates
on `c64-pal-prg-kernal-6581`, NMOS 6510, optimization `none`, both safety checks off. These are
diagnostic builds, not new specification tests, a chosen public API or runtime qualification.

| Candidate | Constructed ingress | Other measured resources |
| --- | --- | --- |
| Scoped constant PA-idle write and shared interference flag | 18 bytes; 33 nominal cycles to the saved predecessor jump | One shared flag, one 2-byte lifetime-owned link; PRG 883 bytes, resident 933 bytes, padding 205 bytes |
| Persistent shared-active-byte conditional, then the same write/flag | 31 bytes; 32 inactive / 45 active nominal cycles to the saved predecessor jump | Two shared flags, one 2-byte lifetime-owned link; PRG 896 bytes, resident 947 bytes, padding 192 bytes |

Both builds succeed without diagnostics, invocation-private RAM/ZP homes or scratch. Their
reported NMI per-entry stack is 5 bytes: the CPU frame plus two temporary saves, not a complete
external peak. CPU acceptance and the pinned ROM entry add 14 nominal cycles and 4 existing-ROM
bytes before these measured ingress sequences. Stock predecessor work remains variable. Nominal
cycles exclude bus stalls and interrupted-instruction completion; no finite whole-route deadline
is established. These construction facts do not select scoped versus persistent installation:
the full acquisition, installation/removal, steady-state and restoration costs remain Unknown.

The ordinary conditional succeeds. The separate consuming-read/bit-condition source debt in
[#100](https://github.com/blendsdk/blend65/issues/100) must not be generalized into a ban on all
conditional NMI source. The persistent candidate nevertheless has an output defect: an equivalent
compact expert guard is analytically 23 bytes / 28 inactive / 39 active nominal cycles, a gap of
8 bytes / 4 inactive / 6 active cycles. That reference is not assembled or runtime-qualified.
[#95](https://github.com/blendsdk/blend65/issues/95) identifies the related shared condition/branch
layout seam; its joystick-only exception does not authorize this keyboard gap. No keyboard output
waiver or optimizer implementation is approved here, and the gap must be resolved before claiming
expert-quality positive support. Full packaged savings cannot be inferred from this component.

Raw evidence is byte-compared and retained outside the source tree at
`/home/gevik/workdir/github/blend65.ri/blend65/.git/worktrees/v4/keyboard-contract-discovery.xwm6JH/probes/`.
`probe-results.jsonl` contains returned debug/memory/cost records; the two project folders retain
sources, manifests and actual PRGs. The original source SHA-256 values are
`974efa7e2577e6acb7b7d67a7be10dfaeae8deb0e43d1c4edb2045fe3a766908` (scoped) and
`874f884fbed0f3312ae78a778dad252df90243dae54ebe5d5a97ceff1f5d4e77` (persistent).
PRG SHA-256 values are `d7caf828ae63943629882e0f194acbe78f19e36cb5ea4157fd0457699110956c`
and `399287cdede2ffc3e0583d240bbd8054764214eba1439651e8c876ed4dd42581`, respectively.

### Best proposed default — narrowly cooperative CIA1 handback

**Recommendation / Verified partial:** let the standard acquisition temporarily own the keyboard
columns, then hand CIA1 PA back to the pinned stock keyboard idle value `$7F`. This is a proposed
**whole-byte PA-latch** contract, including bits 5–7, not restoration of an unknown earlier latch.
Restore applicable exact DDR/CPU/interrupt/vector/link state, avoid PB-latch writes, preserve
timer configuration and CIA2, and retain RESTORE behavior. A custom port owner needs a separately
proved compatible contract; stock compatibility must not silently overwrite another owner's state.
The initial candidate scope is the four cooperative PRG profiles, not automatic D64/raw admission.

The genuinely viable alternative is exact prior-state restoration under a proved known-state
input lease. It is appropriate for a custom owner, but cannot be the ordinary default until that
provenance can be established without making users manage CIA hardware. Pin reads and an
uninstrumented firmware writer do not establish a reliable latch shadow. No manager, queue,
dispatcher, hidden retry policy or compiler-special decoder is justified by this limitation.

The strongest objection is that the proposed default changes the literal DDR/latch promise in
[R5.25 and AC-20](../../requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md).
T-05's seeded state and the existing exclusive-IRQ timer handback do not authorize that change.
User approval must select this product direction explicitly. It must not be inferred from the
previous startup correction or general permission to continue.

Frozen compatibility is a separate interpretation checked inside AR-P2.
[Appendix C64 §5.1](../../../../../spec/appendix-c64.md) requires exact captured compiler-owned
state and gives explicit CPU-port and CIA1-timer scopes. It neither lists a captured CIA1 PA
latch nor defines keyboard acquisition's ownership contract. Reading the complete subsection
establishes a missing accepted library contract, not a demonstrated frozen-spec conflict. It
does not itself authorize whole-byte PA handback. Positive implementation must prove its exact
selected-profile ownership and normal-return obligations; do not widen compiler-owned startup
state silently. No frozen edit is established as necessary. If a real normative conflict later
appears, use its separate authority gate, not a silent requirements-only correction.

The proposed expanded modification set is **only R5.25 and AC-20** in the linked RD-05 requirement
document, plus this register; compiler, test, spec and expert files remain excluded. Replace the
unconditional latch-preservation wording with this explicit rule: preserve exact saved DDRs;
preserve the PB output latch without writing it; on the declared stock-cooperative input route,
acquire the whole CIA1 PA latch and hand it back to `$7F` rather than claiming arbitrary prior-latch
restoration. Keep timer/CIA2, CPU/IRQ/NMI/vector/link and RESTORE obligations unchanged. Outside
that declared route, restoration needs proved prior-state/ownership rather than pin-read inference.
All other R5.25/AC-20 clauses, all of R5.24/AC-19 and existing test expectations remain unchanged.
This proposal is not yet accepted. Approval of the direction without that exact amendment authority
does not permit an upstream edit or positive implementation.

AR-P3 also remains open. All 64 coordinates and both joystick observations stay in scope.
Normal sampling time skew is not an atomic snapshot; electrical ambiguity affects particular
keys, while a firmware-disrupted acquisition needs honest quality information. Raw observations
must not become invented key presses or a blanket claim that unaffected keys are unknowable.
Representation, names, decoding and route placement are not selected here.

Confidence: **Medium** for the proposed default. Proved ordinary-entry latch provenance without
new machinery or user hardware setup would favor exact restoration. Hardening: narrowed the
exception to necessary PA writes and kept frozen compatibility distinct from product approval.
Challenger: **converged** on the default recommendation and missing-contract interpretation;
complete implementation compatibility remains **Unknown**.
The fresh native `design-challenger` independently read primary CIA/KERNAL sources but had no
local file reader, so repository facts and normative excerpts were supplied, not independently
byte-inspected. No complete scan or physical result follows from that agreement.

Current lineage: expert `2.0.4`, qualified content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; references
`c64-hardware.md#ports-and-data-direction`,
`c64-memory-and-runtime.md#interrupt-entry-and-exit-contracts`,
`c64-memory-and-runtime.md#stock-cia1-service-on-final-exclusive-release`, and
`sfa-and-abi.md#interrupt-route-completion-gate`.
Governing keys: BLEND65-SPEC-4-038b70e9, MOS-6526-1981, CBM-C64-KERNAL-03 and MOS-PGM-1976.
This is discovery evidence only. The positive-plan gate remains blocked on AR-P2/AR-P3; no
additional plan file, compiler/test/requirement change or frozen-authority edit is authorized.

### Discovery checkpoint validation

Targeted Prettier, 20 local link targets, all four governing source keys, exact source/PRG hashes,
archive byte comparison and whitespace checks pass. The relevant foundation suite passes 12/12.
No compiler suite or VICE replay was rerun for this documentation-only checkpoint; T-09's
5,201-pass/two-existing-skip result remains the unchanged implementation checkpoint, not new
keyboard qualification. Security/performance auditors are not selected: no host input, execution
or hot-path code changed. No new role, harness or validation framework is added.

One fresh native correctness review reports no findings in the substantive register blob
`f62efe699b671524530e2d5d29afd3981ca9d7f4` against the baseline above. It independently checked
retained source/PRG bytes, hashes, resources, cycle arithmetic and pending-versus-approved scope.
Only this validation footer follows that review. An initial reviewer routing read and a primary
manifest-heading search exposed historical qualification/setup identifiers; these were unused
and are not decisive evidence. This discovery is not a blind qualification run.
