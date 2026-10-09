# Keyboard and combined input — planning decisions

> **Status**: ❌ POSITIVE KEYBOARD IMPLEMENTATION GATE BLOCKED — behavior decisions accepted; acquisition/decoder technical closure pending
> **Last Updated**: 2026-10-09 20:02 CEST
> **CodeOps Artifact Schema**: 1

## Planning scope contract

| Boundary          | Authority                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planning target   | `blend65-v4/RD-05` R5.25/AC-20 and the remaining R5.24/AC-19 keyboard-coexistence obligation. The user confirmed high effort and continuation after the proposed focused keyboard/combined-input planning task.                                                                                                                                                                                                                                                       |
| Context artifacts | RD-05 and its requirements decisions; the live feature roadmap; the completed joystick/library pilot; current source loading, profile declarations, semantic/lowering/storage and startup seams; frozen Specification 4 and expert baseline; primary CIA/KERNAL evidence. Reading does not authorize edits.                                                                                                                                                           |
| Modification set  | This register, the approved R5.25/AC-20 clarification and, after technical gate closure, this bounded keyboard plan and normal roadmap updates. AR-P6 approves only the nine-name extension of one old export inventory. AR-P7 approves the bounded ordinary closed-program root/private-storage correction. Implementation remains specification-first and plan-gated; other old test edits, requirement clauses, frozen spec and expert changes are not authorized. |

## Ambiguity register

| ID     | Category                                                               | Decision needed                                                                                                                | Recommendation / authority                                                                                                                                                                                                                                                                                                                                              | Status                                                                                                                                                                                                                  |
| ------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AR-P1  | Scope / product boundary                                               | What is the next planning task?                                                                                                | User confirmed the focused RD-05 keyboard/combined-input plan. Preserve both existing raw joystick reads and the approved library-first direction. The existing product boundary excludes an input manager, event queue, scheduler, debounce and repeat policy.                                                                                                         | ✅ Resolved — existing scope and product authority                                                                                                                                                                      |
| AR-P2  | Data/state / technical — sensitive                                     | What port-state and firmware-ownership contract permits a usable standard scan?                                                | User accepted the narrowly cooperative whole-byte PA handback to `$7F`, exact saved DDR restoration and untouched PB latch, and authorized the exact R5.25/AC-20 amendment. Preserve timer/CIA2/CPU/interrupt/vector/link/RESTORE obligations; other routes need proved prior state and ownership. No state manager or frozen-authority edit.                           | ✅ Resolved — user: “I approve - proceed further” on 2026-10-08; contract only, not positive implementation qualification                                                                                               |
| AR-P3  | Behavior / integration / user-facing API — sensitive                   | What does a combined keyboard/joystick observation promise when shared lines or multiple keys prevent a unique interpretation? | User accepted the ordinary-source saved-observation API below: one 11-byte logical snapshot, acquisition quality and three-result named queries, with no atomic or unconditional physical-state certificate. The approved clarification is confined to R5.25/AC-20.                                                                                                     | ✅ Resolved — user: “I approve” on 2026-10-08; public contract, not runtime qualification                                                                                                                               |
| AR-P4  | Scope / delivery                                                       | Should the next executable slice be proof-only rather than positive keyboard support?                                          | One bounded proof task using pinned ROM and existing VICE support, before accepting the keyboard API plan. No production changes, new framework, NMI adapter, profile correction or optimizer. Keep AR-P2/AR-P3 open for the positive plan.                                                                                                                             | ✅ Resolved — user replied “proceed” to the proof-only recommendation; [T-04 mini-plan](../keyboard-scan-proof/99-execution-plan.md) owns execution                                                                     |
| AR-P5  | Scope / delivery / developer experience                                | May one scan-aware ingress candidate test the approved ordinary-input direction?                                               | Reuse DEF-7 and existing diagnostic facilities. Test eight saved rows, both raw port observations and stock NMI coordination, without accepting public certainty semantics or changing frozen authority.                                                                                                                                                                | ✅ Resolved — user replied “I approve” on 2026-10-03 to the deeper assessment; [T-05](../keyboard-ingress-proof/99-execution-plan.md) owns the proof; AR-P2/AR-P3 remain open                                           |
| AR-P6  | Test-oracle authority                                                  | May the old bundled-source export inventory include the accepted API?                                                          | Extend only the exact exported-name expectation in `test/rd05/bundled-input-library.spec.test.ts` with the nine accepted top-level names; preserve all six old masks and every other fixture/assertion. Independent new tests own the new behavior.                                                                                                                     | ✅ Resolved — user: “I approve” on 2026-10-08 to the exact named AR-P6 follow-up                                                                                                                                        |
| AR-P7  | Technical (complexity escalation) / library reachability — sensitive   | How can source-library exports remain usable without adding unused acquisition code/state to legacy input programs?            | Correct visibility versus execution-root classification for ordinary closed-program builds in the existing whole-program closure. Retain real callable entries, address dependencies, initializer effects and selected interrupt routes. Omit only proved unused private uninitialized/unplaced/non-escaped storage; no library-name special case or general optimizer. | ✅ Resolved — user: “I approve” on 2026-10-08 to the one named bounded support correction; independent verdict Justified                                                                                                |
| AR-P8  | Technical (complexity escalation) / indexed-place proof — sensitive    | How can a normal masked saved-row query avoid retaining unused acquisition state?                                              | One local constant-mask containment proof in the existing helper; preserve exact-literal/raw-address semantics and every complete object-footprint guard. No general range/branch/interprocedural solver, new pass or decoder workaround.                                                                                                                               | ✅ Resolved — user replied “proceed” to the named bounded extension on 2026-10-09; independent verdict Justified, narrowly                                                                                              |
| AR-P9  | Technical (complexity escalation) / aggregate construction — sensitive | May the existing aggregate builder construct pure nested constants directly in a proved fresh final destination?               | Recommended bounded compiler-wide correction for the independently reproduced extra array temporary/copy. Reuse current aggregate/destination machinery before SFA closure; retain effect/alias/borrow fallbacks. No new pass, IR kind, general optimizer, runtime, API or old-oracle exception.                                                                        | ✅ Resolved — user: “i approve” on 2026-10-09 to the exact AR-P9/T-12 support packet; bounded T-12 qualification 14/14 complete; [closeout](../constant-nested-construction/08-closeout.md), not keyboard qualification |
| AR-P10 | Behavioral / saved-observation compatibility — sensitive               | What should queries return for a `COMPLETE` snapshot whose bytes cannot represent any stable compatible electrical state?      | Accepted: retain directly justified `OBSERVED_UP`; other answers require a nonempty set of compatible stable explanations and agreement across that set. Incompatible data otherwise yields `UNCERTAIN`. Preserve raw bytes and acquisition quality; no retry, cache, component reconstruction or new API. See the accepted policy below.                               | ✅ Resolved — user: “i approve” on 2026-10-09 to the single named AR-P10 policy; technical proof and costs remain pending                                                                                               |

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

| Candidate                                                           | Constructed ingress                                                            | Other measured resources                                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Scoped constant PA-idle write and shared interference flag          | 18 bytes; 33 nominal cycles to the saved predecessor jump                      | One shared flag, one 2-byte lifetime-owned link; PRG 883 bytes, resident 933 bytes, padding 205 bytes  |
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
The user accepted this exact proposal with “I approve - proceed further” on 2026-10-08, replying
to the request to amend **only R5.25 and AC-20**. Those two clauses now carry this contract.
No other requirement clause or existing test changed. This accepts AR-P2's product contract,
not a chosen API, route placement, positive implementation or runtime qualification.

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
This is discovery evidence only. AR-P2's exact requirement correction is accepted and applied;
the positive-plan gate remains blocked on AR-P3. No additional plan file, compiler/test change,
other upstream amendment or frozen-authority edit is authorized.

### Discovery checkpoint validation — before AR-P2 approval

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

## AR-P3 — accepted saved-observation API

**Accepted option:** reuse `c64.input` and its installed normal-source module.
Return one caller-owned snapshot and let ordinary Blend65 functions interpret it without fresh
hardware reads. The user replied “I approve” on 2026-10-08 to this API and the observation-based
clarification confined to R5.25/AC-20. Accepted public signatures, not yet implemented:

```blend65
readInputSnapshot(): InputSnapshot
keyState(snapshot: const InputSnapshot, key: Key): InputState
joystickState(snapshot: const InputSnapshot, port: JoystickPort, control: JoystickControl): InputState
```

`InputSnapshot` contains eight active-low row bytes in declared PA-column order, two full raw
port observations for joystick 1/PB and joystick 2/PA, and one `SnapshotQuality` byte. Its logical
packed size is **11 bytes**, per frozen [SR-2](../../../../../spec/07-structs.md); this is not
the complete storage, code, stack or timing cost. `Key` names the exact 64 matrix coordinates;
RESTORE is not a member, and Shift Lock operates the existing left-shift coordinate.
`JoystickPort` selects ports 1/2, and `JoystickControl` names up/down/left/right/fire.

The accepted byte-backed `InputState` members are `OBSERVED_DOWN`, `OBSERVED_UP` and `UNCERTAIN`.
They interpret retained samples under an explicitly declared stable-contact electrical model,
not an atomic instant or an unconditional physical-switch certificate. Undetected contact
changes can defeat physical attribution even when there is no firmware interference. The
accepted `SnapshotQuality` members are `COMPLETE`, `INTERRUPTED` and `UNAVAILABLE`: completion
reports acquisition, not contact stability. Interrupted acquisition yields uncertain named
results; unavailable means no fresh compatible acquisition, not fabricated fresh observations.
Its raw fields must not be treated as valid input. Exact initialization and failure paths must
be closed in the technical design before the positive gate opens.
The technical design must also cover legal unnamed byte-enum values in query arguments or saved
quality: no out-of-range row access, extra hardware read or fabricated named result may follow.

Electrical uncertainty is local to affected results where the declared model proves that
distinction. Preserve useful unaffected observations; do not turn one ambiguous chord into
blanket electrical invalidation. Joystick grounds and ghost paths can propagate through connected
keys. Timer PBON overrides DDRB, so its contamination need not be confined to PB6/PB7. Do not
silently disable timers to make a scan appear complete. With only an attempt-wide firmware marker,
claiming particular retained rows survived would require a separate proof; raw disrupted bytes
cannot silently become named key states. Neither existing raw joystick read changes its meaning.

One bounded local attempt is the smallest candidate. There is no hidden retry, cached last-good
state, queue, scheduler, input manager or fallback. Application source chooses whether to retry,
skip or retain its own prior state. A bounded attempt count does not prove a finite wall-clock
deadline under unrestricted NMI arrival or retained-ROM work. Acquisition reuses the existing
entry/storage/volatile/proof boundaries; saved-data decoding is normal Blend65, not name-dispatched
compiler-special functions. Scope remains the four cooperative PRG profiles and AR-P2's exact
preservation/handback contract.

### Why this does not promise physical certainty

An analytical counterexample uses no joysticks, PBON off and no firmware interference. Delete
at `(PA0, PB0)` is never held. Hold Return `(PA0, PB1)`, W `(PA1, PB1)` and 3 `(PA1, PB0)` while
sampling PA0: their ghost path produces `$FC`. Release them before PA1: the remaining seven
column samples and both released-drive port observations can be `$FF`. Those bytes also describe
a stable Delete+Return chord. A decoder seeing only these bytes cannot distinguish the two
histories. This is an inference from the governing matrix model, not a new VICE or hardware result.
No contact-speed bound or physical certificate follows from it.

The earlier R5.25/AC-20 wording admitted correct coordinate decoding and declared ghosting, but
did not explicitly define this saved-observation meaning. Prior time-skew acceptance and PA
handback approval did not decide AR-P3. **Approved modification set:** this register and a short
clarification to **only R5.25/AC-20** that named results interpret saved observations, with declared
uncertainty, not instantaneous or unconditionally certified physical switch state. That
clarification is now applied. Frozen spec/expert and existing tests remain outside this authority;
no normative conflict is established and no positive implementation is approved.

The viable alternative is observation bitsets plus separate certainty masks. That may amortize
many queries, but makes ordinary callers check two results correctly and has the same temporal
limitation. Measured internal reuse can later serve the enum API without exposing that burden.
The strongest objection to the recommendation is that callers may still overread the simple
state names, and repeated decoding could be costly. Conspicuous semantics and complete equivalent
behavior/output proof are required; no cost waiver or new general optimizer is accepted.

A fresh native `design-challenger` independently inspected the amended requirement clauses,
library/loader and frozen function/struct rules. It converged on this surface and exposed the
temporal-alias counterexample above. Complexity verdict: **Simplify** — no larger machinery.
Confidence: **Medium** for the unqualified complete capability; **High** for the proposed surface.
Hardening: made observed-state semantics explicit and separated acquisition quality from physical
contact stability. Complete acquisition, decoder soundness, scoped/persistent route placement,
restoration, expert parity and runtime qualification remain **Unknown**. Current lineage and
governing source keys are unchanged from the current reassessment above.

### Historical AR-P2 amendment checkpoint validation — 2026-10-08

Targeted Prettier, 23 local link targets, four governing source keys and whitespace checks pass.
An exact comparison with baseline `4e6104d26766a09b336d1150aa66bd42ca4acd3f` confirms every
requirement byte outside R5.25/AC-20 is unchanged. Only the two authorized documents changed;
code/tests/spec/expert remain untouched. Captured foundation verification passes **12/12** at
15:11:59 CEST, duration 5.08 seconds. Logs remain outside the source tree at
`/home/gevik/workdir/github/blend65.ri/blend65/.git/worktrees/v4/keyboard-contract-acceptance.1ZNFsS/`.
No full compiler suite or VICE replay was rerun for this documentation-only checkpoint.

Fresh reviewer-thread creation was unavailable at the thread limit. Two existing independent
agents instead received complete bounded read-only charters: base correctness/scope/oracle
integrity and target-platform contract truth. Both report **no findings** in requirement blob
`58b61c301e30540b12a9440c581ca4866869fd37` and register blob
`f20fb78d3402492c145d550cd5bac8cb9dc786c2`; only this validation footer and the final timestamp
follow their substantive review. Their prior T-09 work is unrelated to this two-document diff.
No test or runtime qualification is inferred from agreement. Security/performance auditors skip:
no host-input or hot-path code changed. No language semantics, SFA or emitted-code change is made.

A main-agent reference read included an old semantic-evaluation preamble before the normative
heading. It is unused and non-decisive; no blind qualification is claimed here. The `/tmp`
inventory was inspected; this task created no temporary folder there and did not delete other
retained evidence. Roadmap lifecycle/counts remain unchanged: RD-05 is Executing, 4/10 RDs Done,
and AR-P3 still blocks the positive keyboard plan. This is a green local checkpoint, not push
authority or an accepted API.

## AR-P6 — accepted exact old export-inventory exception

The installed-library test's [exact inventory assertion](../../../../../test/rd05/bundled-input-library.spec.test.ts),
line 135, currently requires exactly the six existing mask constants. AR-P3 adds ordinary source
declarations to that same module, so this assertion would reject the approved surface even if
every old mask remained correct. This is a necessary inventory extension, not a behavior waiver.

**Best option:** permit only that exported-name expectation to contain the old six names plus:

```text
InputSnapshot, InputState, SnapshotQuality, Key, JoystickPort, JoystickControl,
readInputSnapshot, keyState, joystickState
```

Preserve the installed-byte/path/hash checks, source identity/order, every old mask's value/type/
span assertion, fixtures, aliases, overlay protections and negative cases. No other old test is
included. In particular, ordinary source functions do not enter the compiler-intrinsic profile
inventories. New independent keyboard/combined-input specification cases must prove the types,
members, behavior and output; adding names to an inventory is not that proof.

The [module binder](../../../../../packages/compiler/src/frontend/modules.ts), lines 61–62 and
110–123, creates one top-level binding per exported enum, struct or function. Enum members are
not separate names in this test's binding inventory. Thus the exact extension is **nine**
top-level names, not 64 separate key entries or new profile operations.

Confidence: **High** for this bounded exception; a different actual export set would reopen it.
Hardening: confined the proposal to the single real inventory assertion, not the profile API
tests or any behavior expectation. The strongest objection is that extra exports could otherwise
hide unintended additions; the expectation remains an exact list. The user replied **“I approve”**
on 2026-10-08 to the final response naming AR-P6 and AR-P7. The exception is accepted, not yet
exercised; changing any additional old oracle still needs its own exact authority.

## AR-P7 — selected-library reachability discovery

Current source facts, not yet a generated-artifact measurement:

- [Source preparation](../../../../../packages/compiler/src/frontend/bundled-sources.ts), lines
  93–126, admits installed input bytes into C64 analysis inputs.
- [Module resolution](../../../../../packages/compiler/src/frontend/modules.ts), lines 296–448,
  then selects entry-reachable modules. A program that never selects `c64.input` does **not**
  thereby execute all installed declarations. Preserve this existing boundary.
- Once `c64.input` is selected, [callable-root closure](../../../../../packages/compiler/src/semantic/whole-program.ts),
  lines 201–225, treats every exported ordinary function as an independent root. Adding the
  accepted acquisition export can therefore retain it when an old program uses only a mask.
- [Semantic global construction](../../../../../packages/compiler/src/semantic/lower.ts), lines
  230–259, and [machine data construction](../../../../../packages/compiler/src/machine/lower.ts),
  lines 73–98, retain ordinary module data separately. Function omission alone is not evidence
  that an unused interference flag also disappears.

Frozen [module export semantics](../../../../../spec/10-modules.md#41-export) define visibility;
the current root policy is an audit subject, not a new language law. The library must remain
normal Blend65 source. Do not identify trusted installed declarations by a user-forgeable module
name or source-ID prefix, alter unrelated user exports just to make the library fit, add hidden
startup installation, or introduce function-name dispatch/general loader or optimizer machinery.
Merged contributions and source-ID collisions must retain their real owners.

The decisive future checks are old mask/raw-joystick programs with zero additional keyboard
code/state/links/startup effect, saved-data-only queries with no acquisition MMIO, and selected
acquisition with its actual complete resource/output proof. These are required compatibility
checks, not present passing results. No source library function has been added; the complete
artifact impact remains **Unknown**.

### Best option — one bounded correction in the existing closure

Correct source visibility versus executable-entry classification for ordinary closed-program
builds, instead of giving otherwise identical installed source a special meaning. Normal source
calls keep selected library functions live. Preserve real independently callable ABI entries,
normative address dependencies, explicit initializer effects/order and selected interrupt routes.
Do not add or redefine a library-build/ABI mode to solve this keyboard task; frozen Chapter 10
also mentions `--library`, so any real existing entry contract must be checked before changes.
An established incompatible ABI contract reopens this decision rather than being silently erased.

Cold storage needs its own proof before zero-page reservation/SFA/layout. Bound the initial
correction to proved unused private, uninitialized, unplaced and non-escaped storage; keep explicit
initializers and all observable effects, addresses, externally visible data and fixed placement.
The acquisition flag must be written before publication/read, not installed or cleared by a hidden
module initializer. This is not a general dead-global optimizer or a new compiler stage.

**Accepted support-surface packet:** reuse the existing frontend/semantic identities and
whole-program/storage consumers; add no dependency, resolver, runtime manager, hidden startup,
function-name dispatch or package-provenance semantics. The exact producer/consumer interface and
failure behavior must be closed before plan authoring. This cross-stage correction is necessary
for the accepted source-library contract. The user now accepts this support scope; implementation
still waits for technical closure, plan readiness and specification-first ordering. Existing
specification tests stay immutable except the exact accepted AR-P6 extension; any
additional exact old-oracle exception must be surfaced, not inferred.

Cost contract: unused acquisition adds **zero** code/data/link/ZP/SFA/stack/startup-effect bytes or
cycles; saved-data-only queries perform **zero** acquisition MMIO. These are future acceptance
bounds, not measured results. Selected acquisition still owes its complete behavior/resource/
assembly/artifact/runtime proof and the expert floor, without borrowing a joystick output waiver.
Host-analysis cost and any changed user-program resource/diagnostic result require directed and
full-checkpoint verification. No runtime or artifact saving is claimed by this document change.

A second bounded independent challenge inspected the actual module, root, global-data and storage
paths. It recommended this direction and found that helper-module splitting alone would not
remove callable roots or cold data. The viable alternative is trusted installed-source liveness,
if a real independently callable export ABI prevents the normal-source correction; its risk is
different semantics for identical source and merged-contribution ownership. No fallback is
silently accepted. The strongest objection to the recommendation is its effect on existing
entry assumptions and resource/diagnostic results; preserve actual contracts and prove the exact
delta rather than changing old expectations wholesale.

Confidence: **Medium** — a demonstrated exported-entry ABI would change the chosen remedy.
Hardening: corrected the initial all-loaded-source concern to selected-module retention, and
included cold private data before reservation rather than stopping at function emission.
Challenger: **converged**; complexity verdict **Justified with a narrow scope**. Expert lineage:
`2.0.4`, content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`,
`compiler-architecture.md#information-that-cannot-be-erased-early` and
`blend65-semantics.md#authority-and-use`; frozen Chapter 10 is decisive for export meaning.
**Direct user decision: approved bounded support correction** — “I approve” on 2026-10-08,
responding to the two named follow-ups AR-P6/AR-P7, with exactly one complexity correction pending.
Original goal: the accepted ordinary-source keyboard/both-joystick API without charging old users
for unused acquisition. Extra support code: the existing closed-program root/private-storage
producer-to-consumer correction, not a new layer. Necessity/evidence, smallest solution, complete
cost obligations and independent Justified verdict are recorded above. Extra maintenance cost is
the bounded identity/root/data consumers and their direct regressions, with no dependency/runtime.
Remaining acquisition/decoder technical closure stays with this owner; approval is not runtime
qualification or a gate pass. The earlier checkpoint footer below is historical.

### AR-P7 prerequisite completion — 2026-10-09

The [source-library prerequisite](../rd-05-source-library-reachability/08-closeout.md)
is complete, 10/10 verified. The exact export-root and proved cold-data correction,
approved fixed-address/resource repair and necessary indirect-hardware/scaling fixes
pass 456 independent specification cases, 57 directed internal cases and fresh Linux
install/build/typecheck/full test: 5,690 passes, two existing skips. All six fix-only
reviews are clear. Frozen spec/expert and old specification tests are unchanged.
This removes the named prerequisite, not the remaining technical closure or the
whole library's cost proof. The new masked-index observation below has its own scope
gate; no unresolved work is left owned by the completed prerequisite.

## AR-P8 — masked saved-row query retains cold state

The source-library prerequisite's approved proof deliberately stops at literal/conversion
indices. That conservatism is sound, but it does not prove the whole keyboard library's
zero-unused-acquisition-cost contract. A new public `buildProject` / ACME diagnostic
uses ordinary source:

```blend65
struct Snapshot { rows: byte[8]; }
let coldFlag: byte;
function coldAcquisition(): void { coldFlag = 1; }
function sample(data: const Snapshot, column: byte): byte {
    return data.rows[column & 7];
}
```

The caller supplies eight saved row bytes and a dynamic column. Both the control and
cold variant build on PAL/6581, optimization `none`. The cold function disappears,
but `coldFlag` remains: payload 826 bytes in both; ZP 8, reported stack component 2,
scratch zero; resident RAM 911 versus 912. Current generations are
`97095144-aeaa-4149-9b57-9ab341ab33d9` and
`4f00e109-9f91-4f53-beec-41d59a433d20`, recorded in Git-private
`keyboard-technical-closure.PHqrhM/capture-final.log`. This is an artifact diagnostic,
not a complete decoder/acquisition or VICE/physical qualification.

**Best option:** extend only local indexed-place containment for a constant nonnegative
mask. A value AND 7 lies between zero and seven; that is a bound, not the exact value 7.
Keep `literalResolver` exact because raw CPU/hardware address proofs also consume it.
Use a private ordinal-bound query for indexed places only, respecting recorded runtime
width/signedness and only proved value-preserving conversions. Unsafe masks, sign-bit
ambiguity, unknown arithmetic/conversions and incomplete object footprints retain data.
Preserve field offsets, strides, nested extents and full final access-width/root-size checks.
No operation/effect moves, no new semantic pipeline interface or runtime check.

**Exact proposed modification set:** the existing
[global selector](../../../../../packages/compiler/src/semantic/reachable-globals.ts),
focused new `*.impl.test.ts` coverage and an independently authored new
`test/rd05/source-library-masked-index.spec.test.ts` using the existing public fixture;
this register, a bounded task plan and normal roadmap updates. No old spec-test, frozen
spec/expert, library API, frontend type rule, SFA/ABI, raw-address proof, dependency,
general optimizer or acquisition implementation change. Approval permits planning this
bounded correction; readiness/preflight/spec-first/verification/review still apply.

The genuinely viable alternative is a normal-source constant-index decoder with equal
complete behavior/output and lower complexity. No such construction/cost evidence is
present; a branching rewrite solely to evade analysis is not established as equivalent
expert output. A wider range/branch/loop/interprocedural solver is not justified here.
This one witness does not prove that every possible decoder shape needs the extension,
nor that it will settle all remaining indexed uses or the complete keyboard cost.

A fresh independent native `design-challenger` recommends the same bounded direction;
complexity verdict **Justified, narrowly**. Safe local file readers were unavailable to
that no-Bash role, so exact source/contract/code excerpts and measurements were supplied
by the primary, not independently byte-inspected. It separately identified the crucial
bound-versus-literal distinction and refuses wider inference or a cold-cost waiver.
Confidence: **Medium** for this remedy being the smallest complete library route;
**High** for the local mask mathematics. Hardening: preserve the shared exact resolver
and limit the new proof to indexed containment. Challenger: **converged**. A measured
equal-cost simpler decoder, or missing integer facts requiring a new representation,
would change the recommendation. The user replied **“proceed”** on 2026-10-09 to the
single final question requesting this exact small extension. Its scope is now accepted;
implementation still requires the bounded plan, preflight and specification-first checks.

**Approval evidence:** Original goal: ordinary saved-row queries without unused acquisition
storage. Extra support code: a private local constant-mask containment query in the existing
global selector, separate from exact raw-address resolution. Why needed/evidence: the public
diagnostic above retains one cold byte despite a bounded eight-row access. Smallest solution:
reuse existing integer facts, definitions and object-footprint guards; no general solver,
pass, pipeline API or runtime. Extra cost: one existing production file, focused new tests,
one task plan and ordinary workflow evidence; zero dependency/runtime cost. Independent
verdict: **Justified, narrowly**, with the inspection limit above. Direct user decision:
**approved named extension**. The [T-11 mini-plan](../masked-index-containment/99-execution-plan.md)
owns execution. This conservative scope gate approved an ordinary small helper, not a larger
support subsystem; the lightweight task lane remains appropriate. Other keyboard decisions
and the full positive implementation gate are unchanged.

**Qualified completion (2026-10-09):** [T-11 closeout](../masked-index-containment/08-closeout.md)
settles this diagnostic with one existing selector change, not a decoder workaround or general
solver. Its immutable new oracle first produced 56 genuine omission failures / 76 prepasses;
all 132 new cases then passed. Final install/build/typecheck and all 5,866 tests pass with two
existing package skips; six independent native reviews have no in-scope findings. Fresh actual
diagnostic builds omit only the cold BSS byte: resident RAM 912→911, payload 826/container 828,
SFA 28/ZP 8/generated stack component 2/scratch zero unchanged. Four-profile sequential VICE
checks validate saved lookup values and ordered watchpoint/source-access observations, not
complete silicon bus traffic or keyboard acquisition. Existing index-code expert-output debt
remains with open #89; it is neither fixed nor waived here. The original exact raw-address
resolver, old spec tests and frozen authorities remain unchanged. The full positive keyboard
gate and RD-05/DEF-7 remain open; resume the approved keyboard technical closure next.

Current expert lineage remains 2.0.4/content `0e2a6280`; normative owners are
`il-and-optimization.md#arithmetic-and-constant-evaluation`,
`#memory-effects-and-volatility`, and
`compiler-architecture.md#information-that-cannot-be-erased-early`. Frozen array ordinal
promotion, narrow barriers, effects and wrapping govern; source `byte` alone never
justifies an eight-bit intermediate. Legal unnamed key values still need explicit
uncertain results, independently of the containment proof.

## AR-P3 acceptance checkpoint validation — 2026-10-08

Against baseline `962888b1`, an exact comparison confirms every requirement byte outside
R5.25/AC-20 remains unchanged. Whitespace, 31 local file-link targets and forced register-only
Prettier checks pass. Requirements keep their authored formatting under the project's Markdown
exclusion; an intermediate forced-format indentation change was removed before final verification.
Only the two authorized documents changed. Code/tests/spec/expert remain untouched.

Fresh `yarn vitest run test/foundation.spec.test.ts`: **12/12 PASS**, start 17:40:57 CEST,
duration 5.78 seconds. Captured logs and the checkpoint message remain outside the source tree at
`/home/gevik/workdir/github/blend65.ri/blend65/.git/worktrees/v4/keyboard-observation-acceptance.XhatbE/`.
No full compiler suite, assembly construction or VICE replay was rerun for this docs-only change.

Two fresh native independent reviewers report no surviving findings: base correctness/scope/
oracle integrity and semantics/modern-source DX with the affected platform-contract interface.
Reviewed requirement blob `516f623a2dcfb674c91a17ea6c776f9a08a711f1` and substantive register blob
`e5881a53564fce704539be89a6ef18460f315010`. The semantics reviewer identified one minor source-line
pointer; the primary independently verified and corrected it to module lines 61–62/110–123.
Only that citation, this factual validation footer and final timestamp follow substantive review.
Security/performance auditors skip: no host-input or hot-path code changed. The root/data scope
has an independent challenger verdict, not implementation qualification.

The `/tmp` inventory was inspected without deleting unknown or still-retained evidence; no new
task evidence folder was left there. Roadmap lifecycle/counts stay unchanged: RD-05 Executing,
4/10 RDs Done. AR-P3 is accepted; AR-P6/AR-P7 and remaining technical closure keep the positive
implementation gate blocked. This is a green local checkpoint only, not push authority.

## AR-P9 — ordinary nested-constant construction prerequisite

**Best option / Recommendation:** correct one existing aggregate-construction seam
before the positive keyboard plan. The defect is ordinary array-in-struct initialization,
not a keyboard-specific requirement. Do not change the public API, substitute an
assembly-only library or borrow the joystick output waiver.

Baseline: clean `8cfc3f28ce2d49ca782b80390dc1813c1f17d119`. Public `checkProject` /
`buildProject`, Node 22.23.1 and real ACME 0.97 constructed private ordinary-source
projects on PAL/6581, NMOS 6510, optimization `none`, safety off. This is construction
evidence, not new specification tests, a selected acquisition route or runtime proof.
Sources, manifests, logs and exact generations remain at
`/home/gevik/workdir/github/blend65.ri/blend65/.git/worktrees/v4/keyboard-construction.wF92Zh/`.

| Boundary                         | Actual evidence / limit                                                                                                                                                                                                                                                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scoped acquisition candidate     | Generation `917dd693-5d5d-4b53-bc9a-8f0dae537a41`, PRG SHA-256 `8c0b0a485dcd4b1a1c993a7b0e645705879690fc960bd8c5bea83b69d7b9cdc8`. Services succeed with W10211 at the pre-publication flag clear; its lifetime-specific truth is unqualified.                                                                                                       |
| Complete acquisition artifact    | 1,149 container / 1,147 payload bytes; acquisition 472, ingress 28, caller 26, startup 328, restoration 281, BASIC 12. Occupied 1,261 includes 50 BSS, 52 RAM SFA and 12 ZP; zero padding/helper scratch. Stack five is bounded generated/per-entry use, not an external peak.                                                                       |
| Saved-only device observer       | Generations `bfa848ba-34d9-4451-adb9-7c962c1bfd09` / `b76da98f-ab64-45aa-94f6-2b7f698d4062`; PRG SHA-256 `e0d29e7bba362f76b3c335409583b77386f1a5079629558f5e084d9465165501`, cost totals, physical intervals and stack domains match exactly. Only main/saved-row helper emit; no acquisition flag/link/ingress. This is not the full decoder.       |
| Raw-RAM observer control         | Earlier `$C000` output correctly retains conservative private state. Original source `raw-observer-game.blend`, generations/logs and `construction-evidence.jsonl` remain; fresh device-only identities are in `saved-only-evidence.jsonl`. This is required observability, not a T-11 regression.                                                   |
| Ordinary non-keyboard reproducer | `nested-constant`, generation `cdd2a17b-db7c-4ff5-aebd-0d6c8c634ab1`, PRG SHA-256 `9bba059b5c8bc597f02f3c641cc6c2a745b7dce0e37b5bc4736bd47077d99677`. No keyboard operation/NMI hook; services succeed without diagnostics. Main 121 bytes; container 744 / payload 742; occupied 814 includes 49 BSS, 19 RAM SFA and four ZP; zero padding/scratch. |

The nested eight-zero-byte initializer uses **97 code bytes, eight extra RAM bytes
and four ZP bytes**. Calculated NMOS cost: **244 cycles** in acquisition, including
seven taken page-cross branches; **237 cycles** in the independent ordinary artifact,
with same-page branches. A stricter equivalent analytical component is `LDY #8;
LDA #0;` eight absolute stores to final rows; `SEC`: **29 bytes / 38 nominal cycles**.
It matches generated outgoing A/Y/N/Z/C and leaves X/V/D/I unchanged. That reference
is unassembled/unexecuted. Available component delta: 68 bytes, 206 / 199 nominal
cycles, redundant RAM/ZP homes. Complete packaged savings require fresh layout.

One native output auditor independently inspected source, actual assembly, labels,
PRGs and public artifact/resource records. Other measured baseline gaps stay separate:

| Gap                                             | Analytical component delta / existing owner                                                                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Adjacent read/store and drive/column forwarding | 42 code bytes, seven RAM homes, 224 COMPLETE-path nominal cycles; [#70](https://github.com/blendsdk/blend65/issues/70), existing local forwarding.                                                     |
| Two unused terminal return-address setups       | 16 code bytes, four ZP bytes, ten nominal cycles on either return; [#82](https://github.com/blendsdk/blend65/issues/82), aggregate-address selection. Full caller-destination rebinding is not proved. |
| Generic masked row address                      | 63 bytes / 86 cycles per stored row versus analytical 12 / 17 with available X and proved route preservation; [#89](https://github.com/blendsdk/blend65/issues/89), bounded array-address selection.   |
| PBON read/combine/branch spills                 | 36 bytes / 46–47 cycles versus analytical 10 / 12–13, same two ordered volatile reads; [#95](https://github.com/blendsdk/blend65/issues/95), shared condition seam, not its joystick waiver.           |

Expert targets remain unassembled/unexecuted, not approved fixes or waivers. Calculated
no-NMI acquisition entry-to-RTS costs are 1,994 COMPLETE / 522 UNAVAILABLE nominal
cycles. The 28-byte ingress takes 45 nominal cycles to its predecessor; CPU acceptance
and four existing-ROM entry bytes add 14. Complete timing/traffic, retained predecessor
work, external stack/deadline, restoration, released-pin-window safety and genuine
RESTORE proof remain Unknown. No acquisition route is selected here.

**Proposed exact scope:** recursively pure, fixed constant nested array/struct literals
into a proved fresh, exclusively owned final destination, starting with local initialization.
Reuse [expression construction](../../../../../packages/compiler/src/semantic/lower-expressions.ts),
lines 479–526, [nested-member lowering](../../../../../packages/compiler/src/machine/lower-aggregate-build.ts),
lines 376–578, and [destination selection](../../../../../packages/compiler/src/machine/lower-aggregate.ts),
line 579 onward. Close changed homes before emission; preserve effects, snapshot/alias/
lifetime/interrupt behavior, widths and source/debug identity. Unproved, borrowed,
overlapping or effect-interleaved cases retain the safe existing path. Only necessary
existing consumers and new independent behavior/output regressions using current
fixtures belong in T-12. No old-oracle edit, new pass/IR kind/solver/runtime/API/dependency/
harness or broader RD-08 work is included. New support beyond that scope reopens the gate.

**Complexity packet:**

| Required field                     | Bounded proposal                                                                                                                                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original goal                      | Accepted ordinary-source keyboard/both-port library with expert output.                                                                                                                                               |
| Extra system or support code       | Existing aggregate-construction producer/consumer correction, owned by T-12.                                                                                                                                          |
| Why it may be needed               | Constant array-in-struct initialization currently creates an unnecessary temporary and copy.                                                                                                                          |
| Evidence                           | Standalone non-keyboard source builds successfully; its nested initializer uses 97 code bytes, eight redundant RAM bytes and four ZP bytes.                                                                           |
| Smallest solution that still works | Direct constant construction into a proved fresh/exclusive final destination using existing aggregate machinery.                                                                                                      |
| Extra cost                         | Necessary changes to the existing expression/destination/member consumers and focused independent behavior/output regressions; no new pass, dependency, framework or runtime. Maintenance stays with those consumers. |
| Independent verdict                | Justified, narrowly — proof must include destination ownership; constantness alone is insufficient.                                                                                                                   |
| Direct user decision               | User: “i approve” on 2026-10-09, answering the single exact AR-P9/T-12 packet. Approved bounded support only; no broader optimizer, oracle exception or keyboard qualification.                                       |

The fresh `design-challenger` recommends this correction over source shaping or premature
general RD-08 work. Its role lacked a permitted local reader: it used supplied exact code
excerpts/measurements, not independent byte inspection. The native output auditor did
independently inspect source/artifacts. Strongest counterargument: one correction does
not resolve every measured output gap. T-12 therefore cannot close keyboard parity or
authorize the positive library by itself. Confidence: **Medium**; inability to reuse
existing destination machinery reopens the choice. Hardening: fresh/exclusive destination
proof, not constantness alone; stricter live-flag equivalent reference. Challenger:
**converged** on the bounded first correction. Standing parity-debt authority permitted
filing distinct [#102](https://github.com/blendsdk/blend65/issues/102); no push was made.

### Saved decoder assessment and AR-P10 boundary

A separate native platform auditor derived saved-byte equality/bit tests and at most
eight row inspections, without traversal or graph storage. Under stable compatible
contacts, ungrounded rows form equal-or-disjoint connectivity blocks. A sampled-low
key in a one-row/one-column block is forced down; larger blocks admit ghost edges.
Full released-drive port bytes also distinguish grounded endpoints and some forced
grounded stars. Preserve useful unrelated observations. Ephemeral 3×3 enumeration
checked 8,192 worlds / 479 snapshots without formula mismatches: analytical support,
not compiler/runtime or full 8×8 qualification. Actual decoder costs remain Unknown.

AR-P10 records the still-unselected inconsistent-`COMPLETE` policy. PBON also makes
released PB pins incompatible even with DDRB zero; connected keys can propagate
contamination to other rows. Two non-consuming control reads can reject a PBON attempt
without changing timers, but must prove no concurrent PBON writer. No timer is disabled
and no graph validator is added. Authority: [keyboard matrix](https://www.devili.iki.fi/Computers/Commodore/C64/Programmers_Reference/Chapter_2/page_094.html),
[game-port wiring](https://www.devili.iki.fi/Computers/Commodore/C64/Programmers_Reference/Chapter_6/page_343.html)
and [manufacturer CIA sheet](https://myoldcomputer.nl/Files/mos_6526_cia.pdf).

Lineage: expert **2.0.4**, content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`,
frozen Specification 4.0; normative aggregate/copy/ABI/volatility, SFA closure, NMOS
timing and CIA/firmware headings. Keys: BLEND65-SPEC-4-038b70e9, MOS-PGM-1976,
MOS-6526-1981, CBM-C64-PRG-1982, CBM-C64-KERNAL-03 and ACME-097-R266.
The platform read overshot an old register footer/recommendation: unused, not a blind
qualification check. No qualification-case answer or manifest audit map was used.
Frozen authorities and old tests were not edited. This assessment created no new `/tmp` folder.

### Discovery checkpoint validation — 2026-10-09

Fresh independent native correctness review: **no findings** on the two-file
documentation diff from `8cfc3f28`; substantive reviewed register/roadmap blobs
`c48513dc30f58e5dddd8946db0c1a841c732c889` /
`e37adaad044b1253375111201e73fc76fdb5cf74`. Only timestamp/validation metadata follows.
Forced touched Markdown formatting, 100 local file-target links, the new T-12 anchor,
selected normative source keys, prior-register content preservation, whitespace and
empty frozen-authority guards pass. `yarn vitest run test/foundation.spec.test.ts`:
**12/12 pass**; private `foundation.log` retains the result. No full compiler-suite
rerun or new keyboard runtime qualification is claimed. The read-only sync engine
confirms feature counters; its sole reported drift is the pre-existing portfolio
`1/10` versus feature `4/10`, deferred to integration by the feature-branch rule.
AR-P9 and AR-P10 remain open. Green local checkpoint only; no push authority.

### AR-P10 — accepted inconsistent-observation policy

**Accepted option:** preserve directly justified release observations;
do not infer a press from bytes that have no compatible stable explanation.

| Saved evidence                                                                        | Accepted named result                       |
| ------------------------------------------------------------------------------------- | ------------------------------------------- |
| `COMPLETE`; designated released-drive raw joystick bit HIGH                           | `OBSERVED_UP` for that joystick control     |
| `COMPLETE`; queried PB bit HIGH with that key's PA column correctly driven            | `OBSERVED_UP` for that key                  |
| Other evidence; a nonempty set of compatible stable electrical explanations all agree | The agreed `OBSERVED_DOWN` or `OBSERVED_UP` |
| Other evidence; explanations disagree or no whole-snapshot explanation exists         | `UNCERTAIN`                                 |

The two HIGH implications require the accepted trustworthy acquisition, released-drive
and electrical conditions. A directly closed switch would necessarily pull its pin
LOW. These are inferences about retained observations, not current physical state or
contact stability across the attempt. Remote contradictory bytes cannot turn that
local HIGH implication into an invented press. `INTERRUPTED`, `UNAVAILABLE` and legal
unnamed enum handling retain AR-P3's existing rules.

For a concrete analytical witness, both released-drive bytes are `$FF`; saved column
rows are `$FC,$FD,$FB,$FF,$FF,$FF,$FF,$FF`. The first two low masks overlap but differ,
so no stable whole-matrix explanation exists. Direct joystick release observations
remain useful. D at `(PA2,PB2)` is LOW, but must remain `UNCERTAIN`: a temporary PB2
joystick ground during that column, released before the raw observation, can produce
the same apparent singleton without D ever closing. Preserving D as an inferred DOWN
would instead require an explicitly approved component-local stability contract.
This is analytical model reasoning, not a new VICE or silicon qualification.

Compatible ghost chords are different: their explanation set is nonempty, and only
results on which explanations differ are uncertain. The accepted policy therefore does not
make ordinary ghosting invalidate unrelated controls. It keeps raw bytes and
`COMPLETE` unchanged, and adds no retry, repair, cache, status, public API, graph
storage or validator service. Application source still owns skip/retry/prior-state
policy. The accepted authority is this register's public saved-observation policy;
no requirement, frozen authority, existing test or production edit is granted by it.

Independent native design challenger: **converged** on direct release certificates
plus conservative inference. The challenger had the exact accepted contract excerpts
and electrical model, but no callable local reader; it did not independently inspect
repository bytes. It rejected blanket uncertainty for losing direct evidence and a
component model for requiring a larger stability contract. Strongest counterargument:
a rigorously proved component model could preserve additional useful DOWN results.
Confidence: **Medium** for the complete product recommendation; the direct implications
and nonempty-model requirement have stronger analytical support. Hardening changed
blanket invalidation by retaining the independently supported HIGH observations.

Compatibility checks before inferred answers may inspect the whole matrix. The earlier
eight-row per-query assessment does not prove this policy's bound. Repeated consumer
queries may repeat that work; emitted bytes, cycles and complete acquisition/decoder
costs remain **Unknown**. Full 8×8 classification with both joystick ground domains,
exact acquisition preconditions, independent behavior/output oracles and expert parity
remain technical gates. No implementation machinery or cost waiver is approved.
Lineage: expert `2.0.4`, content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`,
`c64-hardware.md#ports-and-data-direction`; governing MOS-6526-1981 and
CBM-C64-PRG-1982. Primary keyboard/game-port pages above were rechecked.

Historical proposal checkpoint: one fresh native correctness review reports **no findings** on
the single-document diff from `7b748659`. Foundation verification passes **12/12**
with no skips; log `ar10-foundation.log` is retained in the private T-12 verification
root. Forced Markdown formatting, local links, selected source keys, whitespace and
unchanged frozen-authority/oracle guards pass. AR-P10 remained **Open** at that checkpoint;
no full compiler-suite rerun or new input runtime qualification is claimed. `/tmp`
cleanup moved only the obsolete `blend65-profile-build-664FDV` test fixture and
`blend65-cia2-discovery.rOjBzc` planning logs to recoverable trash; referenced
qualification evidence and other temporary files were not changed.

**Acceptance (2026-10-09):** the user replied **“i approve”** to the final message's
single named AR-P10 behavior policy. This resolves the public inconsistent-input
choice without changing raw bytes, acquisition quality or the existing API. It does
not select installation placement, prove acquisition/decoder costs or authorize a
new support framework. Continue the bounded acquisition/decoder technical closure;
the positive implementation plan is not yet executable.

### Full-matrix technical closure for the accepted saved-data policy

**Status: Verified complete / Inference at the mathematical-model boundary.**
The following characterizes all eight PA and eight PB endpoints, with both
joystick ground domains. It is not an implementation, acquisition, timing or
silicon result. The model is the accepted stable-contact, ideal active-low
propagation model; the API does not certify that actual contacts stayed stable.
No graph, search, enumeration or stored explanation set is needed in the library.

Use byte-wide complements and intersections. Let `A = ~rawJoystick2` and
`B = ~rawJoystick1` be released-drive grounded endpoint masks. For column `c`,
let `L[c] = ~rows[c]` and `R[c] = L[c] & ~B`. Only bits 0–4 can have a direct
joystick ground. Count eligible endpoints in the two ports separately:
`k = popcount(A & $1F) + popcount(B & $1F)`, **not** a population count of their
union. A PB0 ground and a PA0 ground are two different possible sources.

A nonempty stable explanation set exists **if and only if** all six conditions
hold:

1. Every column contains all baseline grounded PB endpoints: `(L[c] & B) == B`.
2. A grounded PA column has no additional low PB endpoint: if its bit is in
   `A`, then `R[c] == 0`.
3. Every unordered pair of residual masks is equal or disjoint:
   `R[i] == R[j] || (R[i] & R[j]) == 0`.
4. If either baseline mask is nonzero, `k > 0`.
5. A grounded PA bit above bit 4 requires at least one grounded PB endpoint:
   `(A & $E0) != 0` implies `B != 0`.
6. A grounded PB bit above bit 4 requires at least one grounded PA endpoint:
   `(B & $E0) != 0` implies `A != 0`.

Necessity follows from low propagation: ungrounded connected components produce
identical nonempty residual PB masks, different components are disjoint, and
every grounded component needs an eligible direct source. An ineligible endpoint
can only be grounded through an opposite-port vertex. For sufficiency, construct
a complete bipartite component for each group of equal nonempty residual masks;
their disjoint row sets prevent unwanted joins. Leave remaining ungrounded
vertices isolated. If both baseline sets are nonempty, connect their complete
bipartite graph and close the eligible ground contacts. If only one baseline set
is nonempty, conditions 5/6 make every member directly eligible. Each construction
reproduces every observed byte. This establishes nonemptiness rather than using
agreement over an empty set.

Classification first validates named arguments and `COMPLETE` quality, before
any indexed access. Unnamed byte-enum values, `INTERRUPTED` and `UNAVAILABLE`
yield `UNCERTAIN`, without out-of-bounds access or hardware reads. A directly
observed queried HIGH bit yields `OBSERVED_UP` even if the other bytes are
incompatible, per AR-P10. All other answers first require the six conditions.

| Compatible queried LOW observation  | Necessary result under every explanation                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Key column not in `A`, row in `B`   | `OBSERVED_UP`: closing this edge would ground the column, contradicting `A`.                                    |
| Key in an ungrounded residual block | `OBSERVED_DOWN` iff the block has one column **or** one row; otherwise `UNCERTAIN`.                             |
| Key column in `A`, row in `B`       | Apply the grounded-key condition below; otherwise `UNCERTAIN`.                                                  |
| Joystick control                    | `OBSERVED_DOWN` iff the opposite port's baseline grounded mask is empty **or** `k == 1`; otherwise `UNCERTAIN`. |

For a grounded key, let `m = popcount(A)` and `n = popcount(B)`. Its result is
`OBSERVED_DOWN` if and only if:

```text
(m == 1 && (row >= 5 || k == 1)) || (n == 1 && (column >= 5 || k == 1))
```

For an ungrounded block with at least two vertices on each side, deleting the
queried edge from the complete bipartite graph leaves a compatible connected
explanation without that key. In a grounded star, a leaf edge can be omitted
only if the leaf has its own eligible ground **and** another eligible ground
can supply the remaining component. In a larger grounded block, deleting an
edge preserves connectivity. A joystick contact can be omitted only when an
opposite-port path leads to another eligible source. These constructions prove
both explanations for the uncertain cases; the one-row/one-column and sole-source
cases force the edge or contact.

The sole-source term matters. `A={PA5}`, `B={PB0,PB5}` forces both keys: PB5 has
only its star edge, and PB0 is the component's only eligible ground source. With
`A={PA5}`, `B={PB0,PB1}`, either eligible PB source can ground PA5, so each star
key is uncertain. No assumption forbids simultaneous or opposite joystick
directions; all 32 electrical control combinations on each port remain admitted.

The logical compatibility bound is eight column checks, at most 28 unordered
pair checks and three groundability checks. Block multiplicity requires at most
eight comparisons. These are logical work bounds, **not** emitted instruction,
memory-read or cycle measurements. Repeated public queries can repeat that work;
no hidden cache or acquisition is added to amortize it. Complete ordinary-source
behavior and equivalent expert-output proof still belong to later specification-
first implementation and qualification.

One fresh native platform auditor independently derived the characterization and
case proofs from the accepted model and normative hardware headings, with **no
findings**. The primary independently derived the same conditions and grounded
star exception. Earlier 3×3 enumeration is supporting evidence only, not this
full-domain proof and not a runtime oracle. Expert lineage: `2.0.4`, qualified
content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`,
`c64-hardware.md#ports-and-data-direction`; MOS-6526-1981 and CBM-C64-PRG-1982.
An incidental routing read exposed historical setup smoke identifiers; they were
excluded and no evaluator/grader answers were used as this model's authority.

### Existing call-scoped route — representation assessment

**Status: Verified partial / Fact and Inference.** A fresh native SFA/ABI auditor
inspected the existing balanced ownership, link-observer, storage-inventory,
binding and machine-update consumers. Existing `setNMI`/`restoreNMI` can represent
one balanced helper invocation and a balanced loop, using a lifetime-owned
two-byte predecessor link. No dynamic frame, second route owner, parallel active
flag or runtime is required merely to represent that scope.

Decisive current consumers are
[ownership](../../../../../packages/compiler/src/semantic/interrupt-ownership.ts),
lines 411/479;
[link observers](../../../../../packages/compiler/src/semantic/interrupt-context-facts.ts),
lines 458/497;
[storage inventory](../../../../../packages/compiler/src/storage/inventory.ts),
line 540; and
[machine publication](../../../../../packages/compiler/src/machine/lower-c64-interrupt.ts),
line 255. Logical removal does not erase a suspended link reader. Re-capture of
a live link is allowed only when its complete captured value is proved identical;
unproved vector writers invalidate the existing scheme. Generated NMI code still
requires no invocation-private homes, preserves entry A/X/Y/full status and D,
and leaves the consuming CIA2 ICR read with the retained owner.

Retained bare-route diagnostic evidence is under
`/home/gevik/workdir/github/blend65.ri/blend65/.git/worktrees/v4/keyboard-contract-discovery.xwm6JH/probes/`.
It does **not** contain a complete qualified scanner. The scoped constant body
only writes idle PA and the interruption byte. Its old actual ingress is 18
generated bytes / 33 nominal cycles; CPU acceptance plus the four existing-ROM
entry bytes add 14 cycles, with five CPU-inclusive per-entry stack bytes. The
21-byte/36-cycle installation and 10-byte/22-cycle removal total 58 nominal
cycles per attempt, excluding the scan/call/status/output work. Link RAM is two
bytes, marker RAM one, helper scratch and ZP zero. The actual old PRG is 883
container bytes with 205 bytes of placement padding and a 933-byte resident
span. These complete artifact quantities are historical diagnostic facts,
not current scanner costs or a universal placement advantage.

The old persistent conditional alternative is 31 ingress bytes, 32 inactive/45
active cycles, two marker/activity bytes, 896 container bytes, 192 padding bytes
and a 947-byte resident span. Existing source/branch debt can explain some of that
difference; packaged differences alone do not prove a universal winner. The
joystick pilot's cost exception does not apply to keyboard acquisition.

**Remaining technical gate:** close the actual acquisition sequence, including
released-pin sampling, compatible prior CIA1 owners, PBON races, exact DDR
restoration and genuine RESTORE at every publication/removal/restoration boundary.
The full construction candidate's DDR-changing ingress is not the bare 18-byte
body above, and its successful build does not prove those obligations. Ordinary
11-byte return/borrow closure, repeated calls, final layout, complete expert costs
and sequential four-profile runtime cases are also unqualified. Do not add a
support mechanism or narrow the accepted developer contract to make the diagnostic
candidate pass. External nesting/stack/retained-ROM completion and physical
edge behavior remain explicitly unproved. Expert lineage is unchanged; normative
owners are `sfa-and-abi.md#interrupt-route-completion-gate` and
`c64-memory-and-runtime.md#interrupt-entry-and-exit-contracts`, with
BLEND65-SPEC-4-038b70e9, MOS-PGM-1976 and CBM-C64-KERNAL-03.

### Acceptance and model-proof checkpoint validation

Fresh native correctness review independently checked the original complete
formula, constructive counterexamples, quoted retained PRG quantities and current
consumer locations. One minor rendered-table defect was corrected by moving the
grounded-key formula to a standalone block; bounded re-review reports **no
findings**. Historical setup-case exposure is excluded, not blind interrupt-route
qualification. No production, old oracle, requirement or frozen-authority edit
is made by this checkpoint.

Forced touched Markdown formatting, 108 existing local file targets, selected
normative source keys, accepted-policy/blocked-gate guards, whitespace and empty
immutable-path guards pass. Fresh foundation suite: **12/12 pass**, no skips,
duration 5.24 seconds at 20:00:27 CEST; retained log
`/home/gevik/workdir/github/blend65.ri/blend65/.git/worktrees/v4/nested-constant-fix.6ev3Cu/ar10-acceptance-foundation.log`.
No compiler-suite rerun or new emulator result is claimed. RD-05/DEF-7 remain
open, 4/10 RDs complete. This task created no new `/tmp` evidence directory and
removed no other user's files. Local green checkpoint only; no push authority.
