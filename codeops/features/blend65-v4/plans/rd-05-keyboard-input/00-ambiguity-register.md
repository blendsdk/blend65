# Keyboard and combined input — planning decisions

> **Status**: Blocked — AR-P38 whole-input cost-closure design is unresolved; approved corrections and all current input behavior checks pass, but complete output remains RED
> **Last Updated**: 2026-10-11 22:18 CEST
> **CodeOps Artifact Schema**: 1

## Planning scope contract

| Boundary          | Authority                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planning target   | `blend65-v4/RD-05` R5.25/AC-20 and the remaining R5.24/AC-19 keyboard-coexistence obligation. The user confirmed high effort and continuation after the proposed focused keyboard/combined-input planning task.                                                                                                                                                                                                                                                       |
| Context artifacts | RD-05 and its requirements decisions; the live feature roadmap; the completed joystick/library pilot; current source loading, profile declarations, semantic/lowering/storage and startup seams; frozen Specification 4 and expert baseline; primary CIA/KERNAL evidence. Reading does not authorize edits.                                                                                                                                                           |
| Modification set  | This register, the approved R5.25/AC-20 clarification and, after technical gate closure, this bounded keyboard plan and normal roadmap updates. AR-P6 approves only the nine-name extension of one old export inventory. AR-P7 approves the bounded ordinary closed-program root/private-storage correction. Implementation remains specification-first and plan-gated; other old test edits, requirement clauses, frozen spec and expert changes are not authorized. |

## Ambiguity register

Current runtime authority additionally includes AR-P13's exact two-file test-setup
exception. All other old-test, frozen-specification and expert changes remain
unauthorized. The chronological proposals below retain their original gate state.

| ID     | Category                                                                                     | Decision needed                                                                                                                               | Recommendation / authority                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Status                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AR-P1  | Scope / product boundary                                                                     | What is the next planning task?                                                                                                               | User confirmed the focused RD-05 keyboard/combined-input plan. Preserve both existing raw joystick reads and the approved library-first direction. The existing product boundary excludes an input manager, event queue, scheduler, debounce and repeat policy.                                                                                                                                                                                                                                            | ✅ Resolved — existing scope and product authority                                                                                                                                                                                                                                                                                                                                             |
| AR-P2  | Data/state / technical — sensitive                                                           | What port-state and firmware-ownership contract permits a usable standard scan?                                                               | User accepted the narrowly cooperative whole-byte PA handback to `$7F`, exact saved DDR restoration and untouched PB latch, and authorized the exact R5.25/AC-20 amendment. Preserve timer/CIA2/CPU/interrupt/vector/link/RESTORE obligations; other routes need proved prior state and ownership. No state manager or frozen-authority edit.                                                                                                                                                              | ✅ Resolved — user: “I approve - proceed further” on 2026-10-08; contract only, not positive implementation qualification                                                                                                                                                                                                                                                                      |
| AR-P3  | Behavior / integration / user-facing API — sensitive                                         | What does a combined keyboard/joystick observation promise when shared lines or multiple keys prevent a unique interpretation?                | User accepted the ordinary-source saved-observation API below: one 11-byte logical snapshot, acquisition quality and three-result named queries, with no atomic or unconditional physical-state certificate. The approved clarification is confined to R5.25/AC-20.                                                                                                                                                                                                                                        | ✅ Resolved — user: “I approve” on 2026-10-08; public contract, not runtime qualification                                                                                                                                                                                                                                                                                                      |
| AR-P4  | Scope / delivery                                                                             | Should the next executable slice be proof-only rather than positive keyboard support?                                                         | One bounded proof task using pinned ROM and existing VICE support, before accepting the keyboard API plan. No production changes, new framework, NMI adapter, profile correction or optimizer. Keep AR-P2/AR-P3 open for the positive plan.                                                                                                                                                                                                                                                                | ✅ Resolved — user replied “proceed” to the proof-only recommendation; [T-04 mini-plan](../keyboard-scan-proof/99-execution-plan.md) owns execution                                                                                                                                                                                                                                            |
| AR-P5  | Scope / delivery / developer experience                                                      | May one scan-aware ingress candidate test the approved ordinary-input direction?                                                              | Reuse DEF-7 and existing diagnostic facilities. Test eight saved rows, both raw port observations and stock NMI coordination, without accepting public certainty semantics or changing frozen authority.                                                                                                                                                                                                                                                                                                   | ✅ Resolved — user replied “I approve” on 2026-10-03 to the deeper assessment; [T-05](../keyboard-ingress-proof/99-execution-plan.md) owns the proof; AR-P2/AR-P3 remain open                                                                                                                                                                                                                  |
| AR-P6  | Test-oracle authority                                                                        | May the old bundled-source export inventory include the accepted API?                                                                         | Extend only the exact exported-name expectation in `test/rd05/bundled-input-library.spec.test.ts` with the nine accepted top-level names; preserve all six old masks and every other fixture/assertion. Independent new tests own the new behavior.                                                                                                                                                                                                                                                        | ✅ Resolved — user: “I approve” on 2026-10-08 to the exact named AR-P6 follow-up                                                                                                                                                                                                                                                                                                               |
| AR-P7  | Technical (complexity escalation) / library reachability — sensitive                         | How can source-library exports remain usable without adding unused acquisition code/state to legacy input programs?                           | Correct visibility versus execution-root classification for ordinary closed-program builds in the existing whole-program closure. Retain real callable entries, address dependencies, initializer effects and selected interrupt routes. Omit only proved unused private uninitialized/unplaced/non-escaped storage; no library-name special case or general optimizer.                                                                                                                                    | ✅ Resolved — user: “I approve” on 2026-10-08 to the one named bounded support correction; independent verdict Justified                                                                                                                                                                                                                                                                       |
| AR-P8  | Technical (complexity escalation) / indexed-place proof — sensitive                          | How can a normal masked saved-row query avoid retaining unused acquisition state?                                                             | One local constant-mask containment proof in the existing helper; preserve exact-literal/raw-address semantics and every complete object-footprint guard. No general range/branch/interprocedural solver, new pass or decoder workaround.                                                                                                                                                                                                                                                                  | ✅ Resolved — user replied “proceed” to the named bounded extension on 2026-10-09; independent verdict Justified, narrowly                                                                                                                                                                                                                                                                     |
| AR-P9  | Technical (complexity escalation) / aggregate construction — sensitive                       | May the existing aggregate builder construct pure nested constants directly in a proved fresh final destination?                              | Recommended bounded compiler-wide correction for the independently reproduced extra array temporary/copy. Reuse current aggregate/destination machinery before SFA closure; retain effect/alias/borrow fallbacks. No new pass, IR kind, general optimizer, runtime, API or old-oracle exception.                                                                                                                                                                                                           | ✅ Resolved — user: “i approve” on 2026-10-09 to the exact AR-P9/T-12 support packet; bounded T-12 qualification 14/14 complete; [closeout](../constant-nested-construction/08-closeout.md), not keyboard qualification                                                                                                                                                                        |
| AR-P10 | Behavioral / saved-observation compatibility — sensitive                                     | What should queries return for a `COMPLETE` snapshot whose bytes cannot represent any stable compatible electrical state?                     | Accepted: retain directly justified `OBSERVED_UP`; other answers require a nonempty set of compatible stable explanations and agreement across that set. Incompatible data otherwise yields `UNCERTAIN`. Preserve raw bytes and acquisition quality; no retry, cache, component reconstruction or new API. See the accepted policy below.                                                                                                                                                                  | ✅ Resolved — user: “i approve” on 2026-10-09 to the single named AR-P10 policy; technical proof and costs remain pending                                                                                                                                                                                                                                                                      |
| AR-P11 | Technical (complexity escalation) / aggregate-return ownership — sensitive                   | May the existing aggregate-destination machinery eliminate a proved unnecessary local-to-caller return copy before SFA closure?               | Accepted narrower whole-function correction: one completely initialized returned local, contained accesses, no observable address or alias, and every actual stable call supplying a fresh private destination. Any unknown preserves the entire existing function/copy. No per-call variants, forced temporaries, solver, new pass, IR kind, API, runtime or old-oracle exception.                                                                                                                        | ✅ Resolved — user: “I approve” on 2026-10-09 to the single narrower AR-P11 packet; T-14 implementation qualified 19/19 on 2026-10-10. Positive keyboard plan and qualification remain separate.                                                                                                                                                                                               |
| AR-P12 | Technical (complexity escalation) / exact emitted-output scope — sensitive                   | May the keyboard plan include the three demonstrated existing-consumer output corrections below?                                              | Preserve the approved source API and compatible-owner contract. Name only masked byte addressing, adjacent expression/flag use, and fixed-address/immediate call-result use in existing lowering consumers; retain all general fallbacks. No automatic admission mechanism, new pass, IR kind, solver, runtime, API, dependency, harness or old-oracle exception.                                                                                                                                          | ✅ Resolved — user: “I approve” on 2026-10-10 to this exact three-family correction batch; independent verdict Justified. Implementation and qualification remain pending.                                                                                                                                                                                                                     |
| AR-P13 | Runtime / exact old-specification fixture authority                                          | May two existing timer fixtures establish a stopped Timer-A precondition before their source's initial ICR read?                              | At their existing stopped startup/main checkpoints only, read CIA1 CRA and write `CRA & $EE`; preserve other readable control bits and suppress START/LOAD. No source, assertion, timeout, controlled injection, observed interval or shared-harness change; no added ICR acknowledgement.                                                                                                                                                                                                                 | Resolved — user: “I approve, proceed and don't stop unless you really have to” on 2026-10-10 to the exact two-file packet. Qualification remains pending.                                                                                                                                                                                                                                      |
| AR-P14 | Runtime / exact fresh-specification observer identity                                        | May the new installed-library inventory exclude bindings supplied by the separate profile producer?                                           | Add only the installed-source identity predicate to `test/rd05/input-saved-data.spec.test.ts:79–82`. Keep the exact fifteen expected names, namespace/export predicates, all other tests and every existing raw joystick capability unchanged. No source or compiler workaround.                                                                                                                                                                                                                           | Resolved — user: “i approve” on 2026-10-10 to the exact one-filter correction. Fresh RED and eventual complete GREEN/exact-fix review remain due.                                                                                                                                                                                                                                              |
| AR-P15 | Runtime / exact fresh-specification debug identity                                           | May the eleven fresh runtime tests use the existing source-qualified debug identities and make the saved-only resource selectors non-vacuous? | Correct only the twenty-eight lookup literals and three identity-selection sites listed below. Preserve all source fixtures, answers, traffic, flags, checkpoints, timeouts, output/resource bounds and shared helpers. No compiler/debug schema or public API change.                                                                                                                                                                                                                                     | Resolved — user: “I approve” on 2026-10-10 to this exact observer-only correction; fresh runtime and final exact-fix review remain required.                                                                                                                                                                                                                                                   |
| AR-P16 | Runtime / exact fresh-specification signature and evidence-identity observers                | May two fresh tests read complete call signatures and the existing resource/CPU evidence identities correctly?                                | Select the three existing caller initializers by exact callee binding identity and check their `signature`, retaining callable return-type/mode/effect and parameter/readonly expectations. In the complete-output test only, read standard resource names from `id`, require `kind === "standard"`, retain the numeric limits, and use the established `cpuId: "nmos6510"` evidence identity. The normative profile CPU spelling remains unchanged.                                                       | Resolved — user: “I approve.” on 2026-10-10 to this exact two-file correction. Directed verification and final independent exact-fix review remain due.                                                                                                                                                                                                                                        |
| AR-P17 | Runtime / residual complete-output and cold-state scope — sensitive                          | What further existing-consumer corrections are necessary after the three approved families?                                                   | Exact baseline/normal-return correction and AR-P18 cleanup qualified at their bounded endpoints. AR-P25 now supplies and approves the narrowed residual consumer packet; complete compiler comparisons remain RED.                                                                                                                                                                                                                                                                                         | Direction resolved by approved AR-P25 — complete compiler output and cold-state qualification remain due. Timers and bounded predecessor behavior pass; no phase/output acceptance follows.                                                                                                                                                                                                    |
| AR-P18 | Runtime / exact protected expert-baseline cleanup                                            | May the two proved redundant instruction sequences be removed before accepting the expert floor?                                              | Exact seven-file change applied; strict assembly and 192 sequential native return/bank checks pass. Actual complete costs independently rederived, three derivative observers updated, exact output/platform/correctness reviews clear.                                                                                                                                                                                                                                                                    | Resolved — benchmark boundary qualified; no compiler or whole-phase GREEN claim.                                                                                                                                                                                                                                                                                                               |
| AR-P19 | Technical (complexity escalation) / bounded guard-based footprint proof — sensitive          | May the existing footprint proof consume unsigned bounds established by actual reaching source guards?                                        | Applied: literal unsigned comparison-edge bounds, fixed right shift and value-preserving conversions at the access; conservative mutation/alias/call/join invalidation. Deterministic cast/shift frontend corrections preserve legal source. No recurrence/termination/interval/interprocedural solver, source workaround, runtime or new pass.                                                                                                                                                            | Resolved at the bounded unit endpoint — 168 new specifications, 76 existing semantic, 12 new internal and 66 frontend cases pass; three independent unit reviews report no findings. Complete cold-state/output and phase qualification remain open.                                                                                                                                           |
| AR-P20 | Runtime / exact fresh timer-fixture setup exception                                          | May one setup argument use the existing CIA LOAD strobe to establish the asserted stopped counter after prior running configurations?         | Applied: only the final pre-observation control-write argument in `input-acquisition-timers.spec.test.ts` ORs each existing control with `$10`; its setup comment is replaced. Every source, expected counter/control, trace, status/stack assertion, profile and timeout stays unchanged.                                                                                                                                                                                                                 | Resolved — all eight complete native cases pass; exact raw-hash reversal passes. Final independent phase oracle review remains due.                                                                                                                                                                                                                                                            |
| AR-P21 | Technical (complexity escalation) / bounded constant-offset footprint — sensitive (runtime)  | May the same helper transfer an already proved unsigned bound through addition of one exact nonnegative literal?                              | One existing-owner transfer, either operand order, only with unsigned result/value and a mathematical maximum fitting the result width. Preserve every identity, mutation, alias, join, raw and complete-footprint fallback. Independent new tests first; no general arithmetic/interval solver, recurrence, machine narrowing, startup, runtime or old-oracle edit.                                                                                                                                       | Qualified at the bounded static unit —124 new specifications,18 helper internals and complete compiler1,980 pass; independent correctness/SFA review clear except two missing comments (RV-001 MINOR/AR-P24). Full native purity/output and phase qualification remain due.                                                                                                                    |
| AR-P22 | Runtime / exact old profile-call observer exception                                          | May one old call-count assertion measure only its existing Game fixture, rather than cold library bodies?                                     | In `packages/compiler/src/frontend/profile.spec.test.ts:351`, filter calls by `caller.sourceId === "src/game.blend"` and retain `toHaveLength(12)`. Keep the entire fixture, completion, diagnostics, selected-profile and every other expectation unchanged. Do not change the count to eighteen or alter the frontend call inventory.                                                                                                                                                                    | Resolved at the bounded unit — exact diff/reverse hash, old profile28 and complete compiler1,980 pass; independent oracle review clear. Final phase review remains due.                                                                                                                                                                                                                        |
| AR-P23 | Technical (complexity escalation) / demand-qualified startup ownership — sensitive (runtime) | May a program proved independent of VIC state omit the unconditional display save/setup/restore work?                                         | One compile-time startup choice shared by existing startup, lowering and layout owners; preserve required CPU/CIA2/return duties and derive borrowed-BASIC protection from actual bindings. Full startup remains the default and fallback for unknown observers, aliases, calls, interrupt dependencies or reliance on display defaults. No general effect solver, runtime switch, pass, engine or public API. Independent new positive/fallback tests first; actual complete costs remain mandatory.      | Approved — exact user pair decision recorded 2026-10-11 01:15 CEST. Bounded startup136, existing banking/output76 and compiler2,019 pass (two existing unrelated skips). Compact60 code bytes/94 nominal cycles/4 saved bytes plus actual BASIC borrows; known whole-global call identity/use refinement is independently qualified. Unknowns still fall back; whole-input output remains RED. |
| AR-P24 | Runtime / exact startup and test-comment oracle exception                                    | May only the named obsolete fixed save-size/register promises and missing new-test comments be synchronized?                                  | After independently qualifying AR-P23, update only the two exact 49-byte expectations in `cia2-startup-output.spec.test.ts` to the qualified empty-program save size and remove only A/X/Y actual/expected keys from two return objects in `cia2-startup-vice.spec.test.ts`. Preserve all SP/P, banking, MMIO, source, negative and resource-uniqueness checks. Add only a plain-language acceptance comment to each new offset specification; fixtures/assertions unchanged. No input output-budget edit. | Approved — exact four-file exception applied after independent qualification. Empty state4 is independently measured; all four in-memory reversals recover original hashes. Original SP/P, source, banking/MMIO, resource and input-budget checks remain. Existing76 cases pass; final phase oracle review stays due.                                                                          |

| AR-P25 | Technical (complexity escalation) / measured missing output consumers — sensitive (runtime) | May the four named existing consumers be corrected using only already proved facts and an exact byte-expression whitelist? | One bounded batch: eligible borrowed constant offsets, adjacent byte complement/bitwise delivery, already proved unsigned stride-one address bounds, and branch-only short circuit. MC-005's unused source-pointer setup may be removed only if existing facts prove it unobserved. No general arithmetic/conversion completion, recurrence, provenance/alias solver, new pass/runtime/API, protected edit or cost waiver. | Approved — user expressly approves compiler improvements described in the sole pending narrowed AR-P25 packet on 2026-10-11; exact four-consumer batch and conditional MC-005 correction only. Separate specification-first qualification remains due. |
| AR-P26 | Technical / necessary bounded output correction (runtime) | How is the byte-chain review's remaining two-byte/two-cycle waste corrected without new machinery? | Collapse only three consecutive official immediate EOR/AND/EOR instructions at the existing instruction append owner, retaining memory/effect barriers, surviving source spans and actual emission inventory independently of net list length. New independent 11-byte/18-cycle oracles supplement, never replace, the original delivery tests. | Resolved and locally qualified under standing approval: new and unchanged byte188, private35 and independent correctness/SFA/output reviews pass. The complete input/phase remains unqualified; no cost waiver or new support surface. |

## Evidence and lineage

The sections below preserve a chronological discovery log. Earlier pending-gate
wording, proposals and expert versions describe their dated checkpoints, not the
current state. The table above and latest accepted AR-P2/AR-P3/AR-P10/AR-P11/AR-P12
sections govern this plan. The current planning gate does not qualify execution.

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

### Acquisition design closure — direct existing scoped ingress

**Plan-owned smallest direction, within accepted AR-P2/AR-P3:** use existing
balanced `setNMI`/`restoreNMI` with the PA-only ingress and one interruption byte.
No persistent activity byte, DDR-writing ingress, new NMI route or state manager
is selected. This is an internal plan choice under the project's workflow prime
directive, not a newly attributed user decision or positive qualification.

The candidate order is: balanced status save/IRQ exclusion; two non-consuming
PBON reads; coherent saved DDR capture; idle PA write and scan-compatible DDR
setup while the prior compatible route still owns NMI; marker clear before
publication; scoped installation; released-drive PA=`$FF` pin observations with
DDRA=`$FF`; the eight one-low column observations; final idle PA=`$7F` write;
route removal; exact saved DDR restoration; final marker read; status restoration.
Every acquisition-driven non-idle column is protected. The ingress only writes
idle PA and the shared marker, preserves its entry state, and chains through the
existing proved predecessor. Port reads observe pins even with DDR output bits;
released observations do not require DDRA=`$00`.

AR-P2's **compatible prior owner** remains a real condition, not an assumption
that every arbitrary register state is stock-compatible. For the pinned stock
NMI STOP path, idle PA7 must be driven low, PA1/PA6 must support the `$BD` shift
check, other PA and all PB lines must be released, and PBON must remain clear.
An output-configured PB line requires independently known high-latch provenance;
pin reads cannot prove that provenance. The full retained stock IRQ scan can
require stronger conditions. DDRA=`$FF`/DDRB=`$00` is a sufficient default,
**not** a blanket source restriction or newly chosen runtime rejection rule.
Custom composed chained/exclusive owners need their actual effects and terminal
contracts proved; no `$FE47`-at-every-call or no-custom-handler rule is introduced.
The existing generated installation entry and whole-program vector/link proof
remain mandatory. Coherent DDR/PBON facts cannot survive an unaccounted concurrent
writer merely because the scanner set I.

A proposed DDRA=`$7F` handoff counterexample was refuted: stock already cannot
drive STOP in that prior state, so its later missed STOP alone is not an
acquisition-introduced failure under a compatible-owner contract. Conversely,
holding a DDR-writing ingress through final restoration could overwrite the
restored directions. The PA-only candidate avoids needing that extra mechanism.

The handback oracle separates the library's own final `$7F` write/release order
from legitimate later retained-owner writes. For example, pinned `UD60` can write
PA=`$7E` after its shift check when STOP+1 are held and the stock route returns.
This is not an invented key or a scan-induced STOP error. The library does not
promise to suppress firmware or freeze its registers indefinitely after handing
ownership back. A stronger exact-at-RET latch predicate would be a different
contract, not an excuse to add an adapter. Authority: pinned
[UD60](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/time)
and
[NNMI](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/rs232nmi).

The fresh SFA/ABI auditor independently inspected the full earlier candidate and
primary firmware, then refuted the counterexample and found **no surviving
findings** in this bounded direction. **Verified partial / Inference**, not a
complete acquisition artifact or runtime result. Exact source/ABI, composed owner
effects, ordinary 11-byte return storage, MMIO traces, repeated helpers/loops,
four-profile sequential VICE, complete costs and physical checks remain due.
External nesting, total stack, retained-ROM completion and deadlines remain
Unknown. Expert `2.0.4`/content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`;
`c64-hardware.md#ports-and-data-direction`,
`c64-memory-and-runtime.md#interrupt-entry-and-exit-contracts` and
`sfa-and-abi.md#interrupt-route-completion-gate`; MOS-6526-1981,
CBM-C64-KERNAL-03 and BLEND65-SPEC-4-038b70e9. Historical routing setup evidence
exposed by the bounded read was excluded from decisive checks.

## AR-P11 — ordinary aggregate-return copy, not an input workaround

Current baseline: clean `275848be07919eadda79c3dd0ab9322daecc2222`, Node 22.23.1,
real public `checkProject`/`buildProject`, ACME 0.97, PAL/6581 cooperative PRG,
NMOS 6510, optimization `none`, safety off. The diagnostic contains no keyboard
operation, library import, NMI hook or hidden runtime:

```blend65
struct Sample { values: byte[8]; first: byte; second: byte; quality: byte; }
function sample(): Sample {
    let result: Sample = {
        values: [0,0,0,0,0,0,0,0], first: 0, second: 0, quality: 2
    };
    result.values[0] = peek($D020);
    return result;
}
function main(): void {
    let received: Sample = sample();
    poke($D021, received.values[0]);
}
```

Both public services succeed without diagnostics. Full sources, manifest, exact
assembly/labels/PRG and cost/storage records remain at
`/home/gevik/workdir/github/blend65.ri/blend65/.git/worktrees/v4/aggregate-return-discovery.oO7u6X/`.
Generation `dd4572ea-7155-4c45-809b-685d72941e16`, PRG SHA-256
`38509116150cd46edbf119bb570aff06a810dd6c8439169a1cfa4e939c1cb100`.
Actual artifact: 713 container / 711 payload bytes, resident span 787, zero
padding, four ZP bytes, 23 ordinary SFA bytes, 49 platform-state bytes, two
bounded generated stack bytes, zero helper scratch. Sample is 70 code bytes:
37 constant initialization, 12 read/spill/reload/store, 21 return tail. The tail
initializes a two-byte source pointer that its absolute-indexed reads do not use,
then copies the eleven-byte result from its local home into the caller's object.
Caller and callee each reserve eleven bytes; the device-read spill reserves one.
This is **Verified partial / Fact** at construction/actual-byte evidence, not
runtime or transformation qualification. The report leaves path cycles Unknown;
manual byte-based calculation gives 208 actual tail cycles including RTS:
204 base cycles plus four indexed-read page crossings at offsets 7–10.

The unchanged earlier full scan candidate was also rebuilt, not modified:
generation `7a07835c-de91-419d-8855-19b33dd14577`, PRG SHA-256
`bd31556c45e4b35bcd125af7ab8745d4657cf3ef6eadc1f804ea8bc8ed77ce8b`.
T-12 reduces its acquisition body from 472 to 397 bytes and removes eight RAM
and four ZP bytes. Placement adds 75 padding bytes, so its actual container
remains 1,149 bytes; resident span is 1,249, ZP eight, ordinary SFA 44, BSS 50,
ingress 28, startup 328, restore 281, caller 26, BASIC 12, scratch zero.
The same W10211 warning remains; its truth at that installation lifetime is
unqualified. This old DDR-writing construction is **not** the selected PA-only
direction and is not new scan or decoder qualification.

The candidate correction must reuse the existing aggregate destination and
return consumers, before SFA closure: fresh non-observable caller destination,
exclusively returned local, complete alias/lifetime/effect/nested-call/interrupt
proof, and unchanged safe fallbacks wherever that proof fails. Current anchors:
[expression destinations](../../../../../packages/compiler/src/semantic/lower-expressions.ts),
line 54;
[aggregate construction](../../../../../packages/compiler/src/machine/lower-aggregate.ts),
line 549;
[return delivery](../../../../../packages/compiler/src/machine/lower-aggregate-return.ts),
line 220; and
[hidden result inventory](../../../../../packages/compiler/src/storage/inventory.ts),
line 399. No speculative pass, new IR kind, new storage model, special library
name, public API or old-test amendment is proposed. General inlining, condition,
index, read-forwarding and unrelated RD-08 debt remain separate; a return-only
correction does not prove the entire keyboard artifact meets the expert floor.

### Independent output boundary and proposed support packet

The native output auditor independently decoded the actual bytes: sample
**70 bytes / 272 nominal cycles**, main **20 bytes / 27 cycles**, including its
JSR. Their complete local work is **90 bytes / 299 cycles**. Startup is 328
bytes / 441 cycles, restoration 281 / 385, and BASIC stub 12 bytes. Generated
entry-through-restoration work is 1,125 nominal cycles, excluding BASIC execution,
retained firmware, asynchronous events and DMA. Two stack bytes are the bounded
generated call component, not unrestricted external nesting or firmware proof.

An independently derived analytical body using the **same hidden destination
ABI**, with current outgoing A=2, Y=11, N=0, Z=1, C=1 and unchanged X/V/D/I,
is **26 bytes / 134 nominal cycles**, assuming its loop branches share a page.
It initializes the fresh destination in place, omits the unobservable zero later
overwritten at offset 0, and reads the device once into that offset. Target local
work is 46 bytes / 161 cycles with the unchanged main. This target requires a
fresh private caller object, unobservable local address/identity, and no relevant
argument/callback/nested-call/raw/opaque/asynchronous observer. Its code is
**unassembled/unexecuted**; storage binding, layout, runtime and the actual
correction remain Unknown. The comparison establishes a plausible full-body
gap, **not** a promise that the return-only correction achieves this target.
Initializer and read-forwarding differences remain independent debts.

The smallest proof must govern the complete returned local, not only its first
initializer. Existing semantic return expressions already carry a caller
destination, but a local-name return becomes a place address. The machine then
materializes that pointer even when its copy loop recovers a direct source.
Changing only the initializer destination is insufficient: later member writes
still use the local root, and the nested-constant direct path requires a proved
fresh direct destination. Preserve or safely extend the existing proof through
every read/write and terminal use **before** storage closure, retaining current
materialization for unproved cases. This is not approval to add a general solver
or to hide new staging/storage in emission.

| Complexity field                   | Proposed bounded correction                                                                                                                                                                                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original goal                      | Accepted normal-source keyboard and both-joystick library with expert output; do not work around an ordinary return defect in its source.                                                                                                                                          |
| Extra system or support code       | One compiler-wide aggregate-return destination correction through the existing semantic/destination, storage-inventory and machine-return consumers.                                                                                                                               |
| Why it may be needed               | A fresh fixed result is built in an extra local object and copied into the already caller-owned result; an additional source pointer has no reader.                                                                                                                                |
| Evidence                           | The isolated non-keyboard artifact above has two eleven-byte objects, an unused two-byte ZP source pointer and a 208-cycle return tail. The same copy remains in the rebuilt earlier scanner.                                                                                      |
| Smallest solution that still works | Coalesce only a proved exclusively returned local into a fresh non-observable caller destination before SFA closure; preserve alias, lifetime, effects, nested calls and interrupt observations, with unchanged safe fallbacks. Remove only proved unused source-address setup.    |
| Extra cost                         | Necessary existing producer/consumer changes and focused new independent behavior/output/resource regressions. No new pass, IR kind, storage model, runtime, public API, package, dependency, harness or old-oracle edit. Any materially larger proof mechanism reopens this gate. |
| Independent verdict                | **Justified, narrowly**: the existing caller destination is the right boundary, but its presence alone does not prove safe whole-local substitution.                                                                                                                               |
| Direct user decision               | **Pending** — this exact support correction is AR-P11; AR-P10's behavior approval does not grant it.                                                                                                                                                                               |

**Best option:** approve that bounded return correction as the next prerequisite.
It helps ordinary programs returning fixed data, not only keyboard code. Removing
only the unused pointer is useful but leaves the hot copy; waiting for the whole
RD-08 optimizer conflicts with its present dependency on RD-05. Neither is a
substitute for qualifying this required component. No new runtime or source-level
workaround is selected, and no keyboard cost exception is requested.

One fresh independent design challenger converges on this direction with verdict
**Justified, narrowly**. It had no local reader and judged supplied exact code
anchors/artifact facts, not independent byte inspection or skill qualification.
The native output auditor did inspect the current source, actual assembly/PRG and
complete reports. Strongest counterargument: safe whole-local substitution may
need proof facts the present consumers lack; the tiny example does not prove the
full scanner or all returned locals safe. Confidence: **Medium**. Hardening:
guard every local access and nested-member construction rather than changing only
the initializer; retain fallbacks and reopen scope if new machinery is needed.
The actual implementation must have independent RED behavior tests, assembled
output/resource expectations and relevant runtime qualification before closure.

Fresh GitHub title/body checks distinguish the existing owners: #82 covers
redundant pointer setup for borrowed aggregate members; #81 covers alias-class
specialization; #70 covers ordinary forwarding/dead stores; #102 covers constant
nested construction. #83 concerns conditional function-value homes, **not** this
aggregate-return copy. The distinct measured return-copy debt is now
[#103](https://github.com/blendsdk/blend65/issues/103), filed under the standing
parity-defect rule. Filing it does not approve the proposed correction. No existing
issue was edited or closed. Remaining full-library costs and ordinary
initialization/read/condition/index debt stay explicit, not silently approved by
this packet. Expert lineage
is `2.0.4`/content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`,
`6502-lowering-casebook.md#calls-returns-abi-and-helpers`,
`6502-lowering-casebook.md#aggregates-copies-and-layout`,
`sfa-and-abi.md#modern-source-and-static-storage` and
`evidence-parity-and-recovery.md#equivalent-work-accounting`; MOS-PGM-1976,
BLEND65-SPEC-4-038b70e9 and ACME-097-R266. No new `/tmp` directory, production,
test or frozen-authority edit was made. The positive gate remains closed pending
the named support decision and its qualification.

Discovery checkpoint verification: the root foundation suite passes 12/12 with
no skips; forced formatting, local links/source keys, whitespace and protected
path guards pass. Independent correctness review found only an outdated pending
assessment phrase; it is corrected above. No production/test/frozen-authority
change, compiler-suite rerun or new emulator qualification is claimed. RD-05
remains Executing at 4/10 RDs Done; AR-P11 is Open. Local commit only, no push.

### AR-P11 approval — conservative whole-function boundary

The additional read-only analysis at baseline `3394f47b` narrowed the first
implementation to whole-function eligibility. The user then replied **“I
approve”** to that one pending packet. This closes AR-P11's decision, not its
implementation or the positive keyboard gate. Earlier pending wording above is
the retained discovery history, superseded by this acceptance.

| Complexity field                   | Approved boundary                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Original goal                      | Normal-source input support with expert output, without a source workaround for an ordinary returned-local copy.                                                                                                                                                                                                                     |
| Extra system or support code       | One bounded compiler-wide correction in the existing destination, whole-program, SFA inventory and machine-root/return consumers.                                                                                                                                                                                                    |
| Why it may be needed               | The independently reproduced ordinary return builds eleven bytes in a separate local, then copies them to the existing caller-owned result.                                                                                                                                                                                          |
| Evidence                           | The exact ordinary artifact and producer/consumer anchors in the preceding AR-P11 discovery; the fresh storage and semantics analyses additionally distinguish initializer coverage, contained indexing, address observation and actual call-site ownership.                                                                         |
| Smallest solution that still works | Qualify the whole function only when one fully initialized local is returned on every reachable return, every access stays inside it, its identity/address cannot be observed, and every actual stable call supplies fresh private result storage. Any missing proof keeps the whole current function and copy.                      |
| Extra cost                         | Small metadata and focused proof/root-binding changes in existing stages, plus independent behavior, output, storage and sequential runtime regressions. No per-call destination variants, forced caller temporaries, general solver, new pass, IR kind, storage model, public API, runtime, dependency, harness or old-oracle edit. |
| Independent verdict                | **Simplify** — the independent challenger narrowed the earlier conditional proposal to whole-function eligibility. Separate native SFA and semantics auditors support that bounded direction, not an implemented certificate or runtime result.                                                                                      |
| Direct user decision               | **Approved narrower boundary** — “I approve”, 2026-10-09, after the additional-analysis recommendation.                                                                                                                                                                                                                              |

The decisive alias counterexample is `v = make(v)`, where `make(source: const
Pair)` initializes local `{x:1,y:2}`, assigns `local.y = source.x`, and returns
it. With prior `v={x:7,y:9}`, required `v.y` is **7**; blind sharing with `v`
would produce **1**. `const` does not prove disjointness. Such an existing-object
call, an address-observing use, a partial initializer, an uncontained index or an
unknown observer therefore leaves the original implementation intact. These are
optimization guards, not new source errors.

Current bounded literal/mask, complete-footprint, raw-address and hardware-RAM
observer helpers in `semantic/reachable-globals.ts` are possible reuse evidence,
not a new general proof authority. `freshConstant` alone proves neither full
initialization nor call-result freshness. Address-taken/canonical or indirect
entries, borrowed/global/existing-object destinations, forwarded caller results,
and relevant generated asynchronous observers remain unproved in this first
slice. A forced temporary is not selected: the existing whole-borrowed-result
copy consumer has not been proved universal. Existing interrupt variants are not
per-caller destination variants.

Status **Verified partial / Inference**; overall confidence **Medium**. The actual
selected PA-only scanner, completed ownership certificate, net byte/cycle/storage
cost and runtime remain unqualified. A whole-function fallback can limit where
the optimization applies; no compiler behavior or output win is claimed merely
from approval. The return-only correction does not authorize the separate
initializer/read/condition/index debts. A larger mechanism reopens AR-P11 rather
than silently expanding it. Expert lineage remains `2.0.4`/content `0e2a6280`.

### AR-P11 implementation qualification — approved observer clarification

The approved [T-14 plan](../returned-local-destination/00-index.md) completes
19/19 task checkpoints. All six independent lenses are clear. MC-001's
introduced size growth and SM-001's persistent source-publication gap are
corrected, but TP-001 finds that incoming bitmap mode can expose the caller
result during direct construction. This defeated the initial plan's blanket
physical-invisibility promise, not a reason to add an input-library workaround
or bitmap-off source rule. The exact approved observer clarification below
retains this physical premise and every defined source/platform observation.

Final qualification and closeout resume under the approved
[AR-6 / RD-05 T-16](../returned-local-destination/00-ambiguity-register.md#ar-6-runtime--incoming-bitmap-display-invalidates-hardware-disjointness).
The earlier root run was intentionally halted, not counted as a PASS. The fresh
complete checkpoint passes 6,043 tests with two existing unrelated skips; final
base-review consistency is clear. Existing AR-P11 approval does
not grant startup/layout changes, protected-oracle edits or baseline rebasing.
The separately approved
[T-16 assessment](../returned-local-destination/09-entry-observation-assessment.md)
is complete. Physical overlap is established, not a defined semantic failure.
The user's 2026-10-10 “I approve” accepts the exact narrow plan-observer
clarification; all current guards remain unchanged and no startup/layout
implementation is approved. Fresh final verification and independent domain
disposition pass; assessment approval itself is not compiler qualification.
RD-05/DEF-7 and the positive keyboard gate remain open. Frozen spec/expert and
every old oracle are unchanged. The returned-local prerequisite is qualified;
the next owned work is the separate keyboard technical/positive plan gate.
This is a green local implementation checkpoint; no automatic push.

## Keyboard technical closure review — 2026-10-10

Read-only review baseline: clean `9bc2a4732d148ecb33bfd8ba9fcd5a21ff385f68`.
The platform and emitted-output auditors inspected the actual PA-only candidate,
its caller and all four resumed acquisition generations. Neither ran verification
or VICE. Their conclusions do not extend T-14's qualification to input support.

### Compatible-owner boundary: keep the accepted contract

The scoped PA-only ingress remains the smallest design under AR-P2/AR-P3. No
unconditional hardware defect survives against that conditional sequence.
Qualification still has to establish the selected predecessor's effects, coherent
capture, exact restoration, ordinary helper/repeated-call behavior and RESTORE.
A prior handler that writes a DDR between the two capture reads can produce a
torn saved pair; the existing no-unaccounted-writer condition excludes that case.
The interruption byte is not a universal certificate for the pre-install window.

Current internal facts distinguish vector/link/source-mask relations from input
compatibility: `semantic/interrupt-context-facts.ts:68–104` has no CIA1 port/DDRs/
PBON relation; `semantic/cia-ownership-facts.ts:61–93` excludes port/DDR offsets;
`semantic/interrupt-address-facts.ts:59–79` exposes internal write-address facts.
The public install/restore capabilities in `frontend/profile.ts:252–277` return
`void`, not a source-visible admission value. All these paths are relative to
`packages/compiler/src/`. Balanced ownership composition is supporting evidence,
not an automatic input-compatibility decision.

**Plan-owned direction within the existing approval:** specify and qualify the
stock route and compatible custom predecessors under the accepted precondition.
Do not introduce an automatic ownership checker, source-visible eligibility
primitive, library-name special case, blanket DDRA rule, custom-handler ban or
`$FE47`-at-every-call requirement. In particular, `UNAVAILABLE` does not silently
acquire a promise to diagnose every arbitrary incompatible owner. No public
behavior or supported-route expansion is selected here.

One blind design challenger independently recommended that direction. An extra
admission prototype would investigate a stronger automatic-admission promise,
not implement the accepted conditional contract. Its strongest counterargument
is the ease of violating the precondition; public documentation and qualification
must make the boundary explicit. Confidence **High** for this planning direction;
automatic admission, scanner runtime and full parity remain **Unknown**.
The challenger used root-supplied actual-file excerpts because its read-only
role lacked a file-reading tool; this is a decision challenge, not independent
runtime or byte qualification.

### Actual current output: defects, not a keyboard cost waiver

Raw evidence remains at
`/home/gevik/workdir/github/blend65.ri/blend65/.git/worktrees/v4/returned-local-execution.ljm6xa/acquisition/`.
The PAL/6581 generation is
`final-pal-6581/9faf9e4e-6b2e-41e5-8085-554ffba28db7`; the other three are
identified in the retained `resumed-artifacts.log`. The auditor directly
reconstructed the quantities below; all four PRG/assembly/labels/cost files
match byte-for-byte. ACME 0.97, NMOS 6510, optimization `none`; no runtime result.

| Current component                    | Output bytes |                   Nominal cycles |
| ------------------------------------ | -----------: | -------------------------------: |
| Startup entry                        |          328 |                              441 |
| Ordinary caller, including both JSRs |           55 |                               75 |
| Acquisition                          |          363 | COMPLETE 1,654 / UNAVAILABLE 154 |
| Diagnostic saved-row query           |           63 |                               91 |
| Ingress placement padding            |           17 |                                — |
| A-only ingress to predecessor        |           18 |                               33 |
| Startup restoration                  |          281 |                              385 |
| BASIC stub                           |           12 |         BASIC execution excluded |

Container **1,139**, payload **1,137**, resident span **1,227** bytes; PRG SHA-256
`dea6714d5d9916c1a3fecfeb981852209944c97aadbc4e350817a0907c083401`.
Residency includes 50 BSS, 34 ordinary SFA and six ZP bytes; no decoder tables or
generated helpers. Full generated paths are **2,646 / 1,146 nominal cycles**.
VIC stalls, external arrivals, predecessor ROM work and BASIC execution are not
included. The five-byte per-entry ingress stack cost is not an external peak.
Hardware acceptance plus the four existing ROM stub bytes add 14 cycles before
the ingress; those ROM bytes add zero bytes to the PRG. External nesting,
firmware completion and finite deadlines remain unproved.

| Finding                                                                  | Current → equivalent expert expectation                                                     | Existing correction consumers                                                                    |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| MC-001: masked byte addressing and selected-byte retention               | Row store **63 B/88 cycles → 23 B/34**; query **63 B/91 → 23 B/37**                         | `machine/lower-scalar.ts:20–77`, `lower-aggregate-index.ts:60–138`, `lower-aggregate.ts:304–440` |
| MC-002: disposable expression homes and recreated flags                  | PBON branch **36 B/46 or 47 cycles → 10 B/12 or 13**; marker `EOR #0` adds **2 B/2 cycles** | `machine/lower-register-forwarding.ts:58–140`, `lower-scalar.ts:456–533`                         |
| MC-003: fixed borrowed-address staging and immediate scalar-result spill | Caller **55 B/75 cycles → 41 B/55**                                                         | `machine/lower-call.ts:19–65,151–170` and the existing forwarding selector                       |

These are **MAJOR output defects**, with analytical expert expectations, not
assembled expert artifacts or whole-decoder costs. The row comparison retains
16-bit page carry/wrap, X, outgoing Y=`0`, C/V and result N/Z; the scan consumes
PB exactly once after PA and forms the destination before that read. The PBON
comparison retains both ordered CIA reads once, unchanged status boundaries and
all eleven initialization stores. The marker remains a fresh shared-state read.
The caller comparison retains the current hidden destination, parameter homes,
two calls and restoration jump. Overlapping/clobbering argument evaluation still
needs staging. Logical scratch savings do not establish final SFA/ZP savings;
placement padding may absorb local code-size changes.

The complete saved-data decoder has not been constructed or costed. The plan may
own concrete source, behavior, output and runtime tasks before qualification;
it may not mark those endpoints complete, transfer a joystick-only exception,
subtract local deltas to invent a packaged target, or use RD-08 ownership as a
keyboard output waiver. Unknowns discovered during implementation retain their
normal scope/ambiguity gate.

### AR-P12 — named existing-consumer correction scope

| Complexity field                   | Proposed boundary                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original goal                      | Ordinary-source combined input with the approved behavior and expert assembly output.                                                                                                                                                                                                                                              |
| Extra system or support code       | Only the three demonstrated compiler-wide pattern families in MC-001–MC-003, in the existing lowering/value/forwarding consumers.                                                                                                                                                                                                  |
| Why it may be needed               | The current artifact unnecessarily widens/retains masked ordinals, saves disposable expression values and stages fixed addresses/immediate results. T-14's return-only approval does not authorize these separate corrections.                                                                                                     |
| Evidence                           | The actual artifact and source/consumer locations above; each expert candidate preserves the original ABI and ordered effects.                                                                                                                                                                                                     |
| Smallest solution that still works | Separate small specification-first corrections in the keyboard plan, preserving every general fallback. No new pass, IR kind, solver, runtime, API, dependency, harness, state manager, forced source cast or unrolling policy.                                                                                                    |
| Extra cost                         | Focused changes to existing compiler consumers and narrow compile-time facts before existing SFA closure, plus independent behavior/output regressions and sequential runtime checks. No new persistent support subsystem.                                                                                                         |
| Independent verdict                | **Justified** — the same blind challenger independently assessed the additional output-scope packet. Each measured gap has an existing consumer; separate specification-first tasks avoid a combined cross-cutting patch. Fixed-place identity and scalar-result/flag availability still need explicit producer-to-consumer proof. |
| Direct user decision               | Approved — user: “I approve” on 2026-10-10 to this exact three-family packet. Approval authorizes separate specification-first plan tasks, not a larger mechanism or a completed output/runtime claim.                                                                                                                             |

**Best option / recommendation:** approve exactly these three pattern families
for separate small tasks in the keyboard plan. Retain the ordinary source API,
compatible-owner precondition, general lowering fallbacks and original oracles.
This is compiler-wide output correction, not a keyboard-specific special case.
Correcting one family first is viable sequencing, not a waiver of the other two.
The strongest counterargument is the caller correction's alias/ABI sensitivity
and the unconstructed decoder; independent behavior/output expectations and
separate green checkpoints address that risk without introducing an optimizer
framework. Confidence **High** for necessity/boundedness, **Medium** for eventual
sufficiency. Hardening: narrowed the direction to existing consumers and excluded
automatic admission machinery; **Challenger: converged**. Further mechanism or
scope growth requires its own exact ruling, not an inference from AR-P12.

All three findings must remain visible until corrected and qualified; fixing
only one is not permission to close the keyboard output gate. Exact full-plan
tasks and test cases follow only after the named correction scope is approved.
Every old oracle remains unchanged except AR-P6's already approved nine-name
inventory extension when its implementation task is reached.

Lineage: active frozen expert **2.0.4**, content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; frozen Specification 4.0 identity
`BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b`.
Selected normative headings: CIA ports/data direction, interrupt entry/exit,
SFA interrupt-route/final-closure, lowering loads/stores/pointers/calls/volatility,
CPU flags/addressing and equivalent-work accounting. Governing keys:
MOS-6526-1981, MOS-PGM-1976, MOS-HW-1976, MOS-6510-1982, CBM-C64-PRG-1982,
CBM-C64-KERNAL-03, ACME-097-R266 and BLEND65-SPEC-4-038b70e9.
Both artifact auditors reported exposure to historical summarized conclusions
in their bounded register reads; those summaries were excluded from decisive
checks. Current byte/cost reconstruction is distinct from a blind hardware
qualification. No frozen authority, production, test oracle or runtime evidence
changed. RD-05/DEF-7 remain open; 4/10 RDs Done. No new `/tmp` directory was
created and no unrelated temporary files were removed.

Checkpoint validation: forced formatting, local links, the new AR-P12 anchor,
selected source-key definitions, blocked/register-only gate, unchanged progress,
whitespace and empty immutable/code/test/portfolio guards pass. Fresh foundation
suite **12/12 pass**, no skips, started 08:08:59 CEST, duration 5.55 seconds.
Independent correctness review reports **no findings** and clean oracle integrity;
it verified documentation consistency and the foundation log, not scanner runtime
or expert output. No compiler-suite rerun or new emulator result is claimed.
AR-P12 remained Open at that green local documentation checkpoint; no push.

### AR-P12 approval — 2026-10-10

The user's subsequent **“I approve”** accepts exactly the packet above. All
twelve planning decisions are now resolved. The modification set additionally
permits the three named existing-consumer correction families, their new
independent specification/implementation tests and focused qualification evidence.
It does not permit automatic owner admission, a new optimization framework,
source restrictions or any additional old-test change. AR-P6 remains the only
approved old-oracle exception. Planning completion and preflight follow;
acquisition, saved-data decoding and complete expert-output qualification remain
pending, and RD-05/DEF-7 remain open.

### AR-P13 — deterministic setup for two existing CIA1 timer fixtures

Task 1.3.3's complete Linux checkpoint exits 1: **6,138 passes, two failures,
two existing skips**. The failures occur before the tests' controlled timer
injection, at `cia-basic-return-vice.spec.test.ts:200` and
`handler-irq-nesting-vice.spec.test.ts:350`. Two unchanged sequential reruns pass
all 13 cases each, with no skips. Neither rerun erases the failed checkpoint or
establishes its cause; the original timer transitions were not recorded.

Independent platform follow-up **TP-001 (MINOR, existing fixture setup)** finds
a valid timing counterexample in both fixtures. The stock CIA1 Timer A remains
running. Masking its interrupt does not stop its counter. A source ICR read
clears events already pending, but a later underflow can latch another event
while masked. LOAD does not acknowledge that event. The first fixture can
therefore enter its handler when the source enables Timer A, before
`beforeRelease`; the second can reach `beforeOpportunity` with pending bit 0
set but no handler entry. This demonstrates a setup dependency, not attribution
of the recorded failures to that mechanism or a compiler defect.

Authority: expert **2.0.4**, content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`, normative
`c64-hardware.md#timers-and-control` and `#interrupt-control`; primary
**MOS-6526-1981**, printed pp.6–8. The
[manufacturer datasheet](https://myoldcomputer.nl/Files/mos_6526_cia.pdf) was
rechecked. START controls counting independently of the interrupt mask; pending
data and interrupt masks are distinct; LOAD is a write strobe, not an ICR clear.

**Best option / recommendation:** approve only these two local test-setup changes:

| File and exact case family                                                                 | Permitted change                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/rd05/cia-basic-return-vice.spec.test.ts`, four existing profile cases                | At the existing stopped startup-entry checkpoint, after recording original entry CPU/state/stack and before resuming into source, read CIA1 CRA non-consumingly and write `CRA & $EE`.                        |
| `test/rd05/handler-irq-nesting-vice.spec.test.ts`, eight existing status-matrix cases only | At the existing stopped main checkpoint, after masking CIA1 sources and before resuming into the source's initial ICR read, make the same CRA-preserving stop. The separate nested-storage case is unchanged. |

The mask clears START and suppresses LOAD while preserving every other readable
CRA bit, including TOD selection. Add a short durable explanation beside each
setup write. Do not add an ICR read/acknowledgement, change Timer B, modify any
Blend65 source string, change or remove an assertion, relax a timeout, alter a
controlled injection or measured MMIO interval, or edit a shared fixture.
The source's existing consuming read clears old pending events; a stopped
Timer A cannot recreate them before intentional arming. All later timer,
restoration, register/status, firmware-service and output checks remain required.

The strongest counterargument is that this narrows the incoming timer state.
These cases deliberately inject and prove a subsequent underflow; they do not
promise to qualify every arbitrary live-counter phase before injection. Accepting
uncontrolled pre-injection events instead would expand checkpoint/trace handling
and change the zero-pending scenario. A compiler change would incorrectly hide
legal device behavior. No new timer framework, API or compiler correction is
needed.

Confidence: **High** for the setup counterexample and bounded remedy; the exact
cause of the original failures remains **Unknown**. Hardening: preserve all
readable CRA bits rather than writing a new complete control value, and leave
acknowledgement to the unchanged source. Independent correctness follow-up
converges on the exact two local read/write pairs and confirms non-vacuity:
deliberate timer injection, exact handback trace, complete status/register/stack,
vector restoration and later KERNAL service remain tested. Apply the status
setup only in its eight-case callback, never shared `inVice()`. Both independent
follow-ups are read-only and add no execution result. A complete GREEN checkpoint
and an independent exact-fix review remain due after any approval. AR-P6 remains the
only accepted old-oracle exception until the user explicitly accepts AR-P13.
Task 1.3.3 pauses at this authority gate; progress remains **18/35**, RD-05 and
DEF-7 remain open. No old specification test, frozen authority or compiler file
is changed by this proposal, and no RED phase is committed or pushed.

### AR-P13 approval — 2026-10-10

The user explicitly approves the exact two-file packet above and continued work:
“I approve, proceed and don't stop unless you really have to”. Apply only the
four BASIC-return profile cases and eight status-matrix setup sites, preserving
every stated boundary. AR-P6 and AR-P13 are now the only accepted old-oracle
exceptions. This resolves the runtime authority gate, not verification. Task
1.3.3 resumes at 18/35; fresh directed/full checks and independent exact-fix
review remain required. Make trivial implementation choices within the approved
contract without another prompt; material scope and protected-oracle expansion
still require exact authority. No automatic push is authorized.

## AR-P14 — fresh installed-source inventory counts a separate producer

The independent new [declaration test](../../../../../test/rd05/input-saved-data.spec.test.ts),
lines 79–82, selects every exported binding beginning with `c64.input.` and
expects the six masks plus nine approved source-library names. That namespace
also contains seven preserved profile-provided operations: `readJoystick1`,
`readJoystick2` and the five saved-byte switch predicates. The approved
[AR-P6](#ar-p6--accepted-exact-old-export-inventory-exception) contract separates
those existing compiler-intrinsic profile inventories from installed-source
exports. Removing or hiding them would break the accepted compatibility rule.

After adding only the six data types, a read-only public frontend overlay on
the existing foundation project succeeds on all four profiles. It exposes
twelve installed-source bindings with source identity
`@blend65/stdlib/c64/input.blend` and seven separate bindings from
`profile:<selected-profile>`. The new test's predicate therefore currently
collects nineteen, not twelve; after adding the three ordinary functions its
namespace set would contain twenty-two, not fifteen. The latter is a derived
counterexample, not an executed complete-library test result. The actual frozen
new test still fails earlier for the three absent functions. Packed size 11,
offsets 0/8/9/10 and the 64-member matrix declaration pass the separate public
probe. No helpers, query functions, scan or compiler behavior are implemented.

**Best option:** add exactly one source-identity condition to that fresh test's
existing filter:

```typescript
entry.id.sourceId === "@blend65/stdlib/c64/input.blend" &&
```

Keep `entry.exported`, the qualified-namespace condition, the exact fifteen-name
expectation and every other fixture/assertion unchanged. Do not filter by the
expected-name list: that would hide unintended additional library exports.
The existing [bundled-source test](../../../../../test/rd05/bundled-input-library.spec.test.ts),
lines 132–135, already identifies that same producer before checking its exact
name inventory. AR-P6's separately approved nine-name extension remains due;
this proposal changes neither that old test nor any other old oracle.

The alternative is to expand this fresh test to the whole merged namespace,
adding seven independently specified profile names. It is viable but expands
the file's oracle domain and couples two producers without a requirement for
that broader inventory. The strongest objection to the recommended correction
is that it no longer checks the complete user-visible namespace. Existing
profile/compatibility suites retain that separate responsibility. An unexpected
installed-source export still fails the unchanged exact-name comparison.

Confidence: **High** for the contract/producer mismatch. Hardening: root reads
the actual test, AR-P6, existing source-inventory predicate and profile
declarations, then repeats the public producer inventory on all four profiles.
The independent read-only challenger evaluates the supplied exact excerpts and
counterexample, rather than inspecting implementation answers, and converges
on the one-conjunct correction. Its file inspection is not claimed. Corrected
missing-function RED, eventual complete GREEN, the seven preserved profile
operations and independent exact-fix review remain due after approval.

No protected test is changed. Task 2.2.1 is blocked at this exact authority
gate; task 2.2.8 and final verification also depend on its resolution. All
twenty-eight independent test/fixture identities still match the pre-source
freeze manifest. The partial source declarations remain uncommitted; no RED
commit, push, frozen-authority or compiler change occurs. General continuation
and trivial-decision authority are not treated as a protected-oracle exception.

### AR-P14 approval — 2026-10-10

The user explicitly replies “i approve” to the exact one-filter correction.
Add only the installed-source identity condition, retaining every expected
name and every other fixture/assertion. Re-run the missing-function RED before
continuing the complete ordinary module; retain both pre-correction and corrected
oracle identities. Source functions, profile compatibility, output/resource
bounds and final independent oracle review remain required. No compiler behavior,
frozen authority, old specification test or automatic push is authorized here.

## AR-P15 — fresh runtime observers omit source-qualified debug identity

The first six-file saved-query run compiles and builds the exercised programs,
then stops before emulator execution at the existing `libraryEntry` lookup.
Four files record sixteen failures for missing unqualified names; the process
ends with exit 143 and no suite summary. The termination cause is **Unknown**;
neither the two unfinished files nor native behavior is counted as a result.
Raw output is retained in `phase2-pure-first-runtime.log` under the existing
`keyboard-plan-check.hzunZt` evidence root.

The existing [public-debug consumer](../../../../../test/rd05/source-library-fixture.ts), line 48,
compares complete `qualifiedName` values. Established
[source-identity specifications](../../../../../test/rd05/source-library-identity.spec.test.ts), line 44,
already use `src/library.blend::Hot.read`, and the existing debug producer
[functionName](../../../../../packages/compiler/src/services/evidence-records.ts), line 43,
retains the source prefix. A public `buildProject` probe using the unchanged
`SavedComponents` source fixture succeeds and publishes
`src/library.blend::SavedComponents.query` and
`src/library.blend::SavedComponents.completed`. The fresh test asks instead for
`SavedComponents.query` and `SavedComponents.completed`. This is an observer
mismatch, not absent generated functions or a reason to alter the compiler.

The probe's complete generation is retained at
`function-identity-probe/out/89fe0dc3-0598-46e2-807c-f06c138ee789` beneath that
evidence root. Its debug SHA-256 is
`64c98e310ad812138d72d4077adfed6f2a4c0cf6a8e29f2efbcf3f59eceee034`;
actual PRG SHA-256 is
`966cfd92c8f8e9a04e0026683e030a641d2dc6664bd59b7e90f256815a75027a`.
It proves build/debug identity only, not query behavior or expert parity.

**Best option:** one bounded observer-only correction across the eleven fresh
runtime files. The exact twenty-eight literal sites are:

| Fresh test                                   | Exact lookup correction                                                                                                                            | Sites |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `input-saved-simple.spec.test.ts`            | `SavedInput.query/completed` → `src/library.blend::SavedInput.query/completed`                                                                     | 2     |
| `input-saved-components.spec.test.ts`        | `SavedComponents.query/completed` → `src/library.blend::SavedComponents.query/completed`                                                           | 2     |
| `input-saved-grounded.spec.test.ts`          | `SavedGrounded.query/completed` → `src/library.blend::SavedGrounded.query/completed`                                                               | 2     |
| `input-saved-contact-graphs.spec.test.ts`    | `SavedContacts.query/completed` → `src/library.blend::SavedContacts.query/completed`                                                               | 2     |
| `input-saved-incompatible.spec.test.ts`      | `SavedIncompatible.query/completed` → `src/library.blend::SavedIncompatible.query/completed`                                                       | 2     |
| `input-saved-guards.spec.test.ts`            | `SavedGuards.query/completed` → `src/library.blend::SavedGuards.query/completed`                                                                   | 2     |
| `input-saved-query-purity.spec.test.ts`      | `SavedPurity.query/completed` → `src/library.blend::SavedPurity.query/completed`                                                                   | 2     |
| `input-acquisition.spec.test.ts`             | `Game.before/after` → `src/game.blend::Game.before/after`                                                                                          | 2     |
| `input-acquisition-unavailable.spec.test.ts` | `Game.before/after` → `src/game.blend::Game.before/after`                                                                                          | 2     |
| `input-acquisition-timers.spec.test.ts`      | `Game.probeTick/before/after` → `src/game.blend::Game.probeTick/before/after`                                                                      | 3     |
| `input-acquisition-owners.spec.test.ts`      | Prefix `Game.prior` in its entry lookup, direct function selector and byte lookup; prefix the four `installed/before/after/released` entry lookups | 7     |

Additionally correct only these three saved-only selector sites in
`input-saved-query-purity.spec.test.ts`:

1. Keep the typed interrupt-binding filter unchanged; map each binding to
   `${entry.id.sourceId}::${entry.qualifiedName}` before comparing against the
   published function identities. Do not guess private callback names.
2. Change the absent-acquisition identity from `c64.input.readInputSnapshot` to
   `@blend65/stdlib/c64/input.blend::c64.input.readInputSnapshot`.
3. Replace the global-name namespace test with its public source-origin join:
   require the installed input source in `debug.sources`, validate each source
   global's source-index reference, select input globals through that index,
   then keep the complete `symbol.qualifiedName` → memory-owner join and the
   unchanged `allocated === []` expectation. The actual debug global identity is
   source-based, not `c64.input.<name>`; the old prefix test could select nothing
   even if unwanted scanner state were allocated.

The third replacement is bounded to the existing selector, with no helper or
private identity convention:

```typescript
const sources = profileRecords(artifacts.debug.sources);
const inputSourceIndex = sources.findIndex(
  (entry) => entry.path === "@blend65/stdlib/c64/input.blend",
);
expect(inputSourceIndex).toBeGreaterThanOrEqual(0);
const globals = new Set<string>();
for (const symbol of profileRecords(artifacts.debug.symbols))
  if (symbol.kind === "global") {
    if (typeof symbol.qualifiedName !== "string") throw new Error("Missing global identity");
    const origin = profileRecord(symbol.origin);
    expect(origin.kind).toBe("source");
    const span = profileRecord(origin.span);
    if (
      typeof span.sourceIndex !== "number" ||
      !Number.isInteger(span.sourceIndex) ||
      span.sourceIndex < 0 ||
      span.sourceIndex >= sources.length
    )
      throw new TypeError("Global source indexes must resolve");
    if (span.sourceIndex === inputSourceIndex) globals.add(symbol.qualifiedName);
  }
```

Preserve every Blend65 caller/library fixture, input case, expected answer,
immutable-byte assertion, MMIO order/count, register/status/stack/link check,
checkpoint interval, timeout and no-skip requirement. All three output tests and
all thirteen independent assembly/source assets stay byte-identical. Do not
edit `source-library-fixture.ts`, debug production, the schema, old tests, frozen
authority, module names or compiler bodies to accommodate these observers.
AR-P14's inventory correction stays unchanged.

Considered: accepting short names in the shared fixture could make these calls
work, but it expands a shared contract and loses the explicit declaration-source
distinction exercised by established tests. Correcting the fresh consumers is
smaller. The strongest objection is that the pure queries remain behaviorally
unverified, so the identity correction must not be mistaken for GREEN. The
independent input/output oracles and eventual exact-fix review still determine
acceptance. Confidence: **High** for the observed identity mismatch; changing the
public debug-identity contract would require a separate product decision.

All twenty-eight corrected-AR-P14 oracle hashes still match. No protected test
is changed by this proposal. Session 2.2 pauses at the exact authority gate;
progress remains **36/48**. The source declarations/helpers/queries are
uncommitted and unverified; acquisition/callback implementation remains due.
No broken checkpoint is committed, nothing is pushed, and RD-05/DEF-7 stay open.

### AR-P15 approval — 2026-10-10

The user explicitly replies “I approve” to the exact eleven-file observer packet.
Apply only the twenty-eight lookup literals and three saved-only identity
selectors above. Preserve every source fixture, expected answer, hardware trace,
timeout and output/resource bound, as well as all old tests and shared helpers.
Retain the corrected oracle identities and prove this exact exception against
the preceding raw manifest. This closes the authority gate, not runtime/output
qualification. Session 2.2 resumes; local GREEN commits only, no automatic push.

## AR-P16 — fresh signature and resource checks read the wrong public fields

Status: **Resolved**. Category: runtime / exact protected-oracle authority.

The user replies “I approve.” on 2026-10-10 to the exact two-file AR-P16
handoff. This authorizes only the corrections in the table below. AR-P17 remains
open; no compiler support, startup baseline correction or numeric-budget change
is authorized. Record the exact applied diff and new raw manifest before
verification. Final independent exact-fix review remains required.

The completed data run records four failures at
`test/rd05/input-saved-data.spec.test.ts:166`: a source function binding's
`type` is its return type, not a `kind: "function"` record. The existing
typed caller already contains all three API calls. Its initializer expressions
publish the complete `signature` with `parameters` and `returnType`.
`frontend/semantic-analysis-types.ts:12–22` documents declared/return types;
`frontend/aggregates.spec.test.ts:581–615` exercises the call-signature field.
The unchanged-fixture public probe in `phase2-signature-observer-call-shape.log`
confirms zero parameters for acquisition, a readonly snapshot plus key for
`keyState`, and a readonly snapshot plus port/control for `joystickState`.

The retained real complete-output artifact also shows that
`costs.totals.resources` records use `kind: "standard"` and an `id` of
`zeroPage`, `residentRam`, `hardwareStack` or `scratch`. The fresh complete-output
test instead reads those names from `kind` at lines 122–124. This check has not
yet run: the earlier payload-size assertion fails first. It is a demonstrated
schema/observer mismatch, not permission to change production or a claim that
the remaining output checks pass.

The same fresh output file at line 30 substitutes the normative profile's
`cpu: mos6510-nmos` spelling for the established public sidecar's
`cpuId: "nmos6510"` identity. Frozen Chapter 15 defines the former profile field,
not a `cpuId` sidecar field. The unchanged public evidence producer publishes
the selected processor facts' ID; existing `profile-pipeline` and collision
specification tests independently expect `nmos6510`. The retained build/debug
artifacts confirm that identity. Correct only this fresh consumer's one literal;
do not amend the normative profile spelling, CPU facts, opcode set or schema.

**Best option:** approve these exact two-file observer corrections as one batch:

| File                                          | Exact permitted correction                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Expectations preserved                                                                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/rd05/input-saved-data.spec.test.ts`     | Inside only its existing three-function signature check, select `Game.main` by full binding identity; select exactly one of its existing variable-initializer calls for each API by full callee binding identity. Assert `callable.type` equals the expected return type and match that call's `signature` against the existing return type and parameter/readonly expectation. Remove only the inappropriate `kind: "function"` discriminator from that signature expectation. | Original source, packed layout/offsets, all members/enum values, ordinary mode, absent platform effect, exact return/parameter types and readonly borrow.                                |
| `test/rd05/input-library-output.spec.test.ts` | Change only the three standard resource-name uses from `resource.kind` to `resource.id`; additionally assert each resource's `kind` is `standard` and the complete unique ID inventory is exactly the existing four names. Change only its `cpuId` literal from `mos6510-nmos` to the established `nmos6510` evidence ID.                                                                                                                                                       | Same selected NMOS 6510 and opcode contract; all payload/RAM/ZP/stack limits, nonnegative integer values, source/assembly fixtures, placement, safety/mode, routes and other assertions. |

No other test, shared helper, timeout, fixture, source program, compiler code,
public schema, frozen specification or expert baseline may change. Retain the
preceding AR-P15 raw manifest and record a new exact manifest after approval;
read-only reversal must reconstruct every preceding input. Final independent
exact-fix review remains required. Confidence: **High** for these public-field
mismatches; this does not resolve the separate real output/retention failures.
The narrower return-type-only check is not sufficient because it would lose
parameter/readonly proof. Changing the public schema would be a larger unrelated
API change. No protected test is edited by this proposal.

### Approved exact correction and directed result

Applied at 19:15 CEST. The two predecessor Git blobs are
`1147460f764604aa4137b1c678ad19719b00d98d` (saved data) and
`f616baaf0b13314cc622ebe2c62c938f7122f7f8` (complete output); the exact
corrected blobs are `4e097a02501811bb6d80ccdf9aba83eb9add02c9` and
`9708327dbb284616238277f942c7f727a8485253`. Retained predecessors reconstruct
the preceding raw inputs; the other twenty-six files are byte-unchanged.
`phase2-ar16-oracle-sha256.txt` binds all twenty-eight inputs with SHA-256
`bc39b97d2dbd11a925e31ca1a7c7f11e4945f733efe38cfc04b1f10b273068b7`.

`phase2-ar16-build.log` passes all four workspace builds;
`phase2-ar16-typecheck.log` passes all six typecheck/dependency tasks.
`phase2-ar16-directed.log` finishes **16 PASS / 4 FAIL / zero skips** in
17.71 seconds: all declaration/signature cases pass; all four complete-output
cases fail their unchanged first payload bound, 3,441 versus 912 bytes. Later
CPU/resource/path assertions are not reached and remain unqualified.
Targeted formatting, whitespace, public/member documentation, no planning-reference
leaks and frozen-authority guards pass. Task 2.2.1 is verified; progress is 38/48.

The required independent `ar16_exact_correction_review` reports no findings for
the actual two-file diff, authorized scope, non-vacuous complete identities,
signature/readonly expectations, unique resource inventory or unchanged budgets.
It independently checks both before/after blobs and raw manifests. No reviewer
build, test, emulator or hardware qualification is claimed. The full final phase
review remains due after GREEN; AR-P17 is still open. No compiler, source fixture,
numeric limit, startup baseline or frozen file changes; no Phase 2 commit or push.

The roadmap engine's read-only check confirms the feature's 4/10 RD count and
reports only the inherited portfolio 1/10 versus 4/10 mismatch. Portfolio
synchronization stays deferred on `feature/v4-rebuild` under the non-integration
branch rule; preserved hand-maintained counters are informational, not new
defects. The four touched Markdown files pass actual local-link validation.

## AR-P17 — residual output must be assessed before additional machinery

Status: **Open**. This records a newly encountered implementation boundary,
not an approved support packet or a new executable task.

The complete library candidate has SHA-256
`d5c3129c80fea3cdc13e08edc22b53241b10f4a86cde9ef4524306baa23e29c7`.
The fresh complete-source purity run fails all four profiles before VICE at its
unchanged no-input-global-allocation guard. The retained byte is the ordinary
private `scanInterrupted` global, even though acquisition and its callback are
not selected. `semantic/reachable-globals.ts:78–80` retains all candidates when
an indexed place has an unproved escaping footprint. Current local proof knows
constant masks/conversions, not the source's guarded shifts and ordinary bounded
loops. The public saved-caller probe additionally has raw RAM observations;
these conservative fallbacks must not be removed merely to eliminate the byte.

All twelve fresh static output cases build/assemble but fail their first size
assertion: full **3,441 versus 912** bytes, saved-only **3,025 versus 683**. The
retained exact-source PAL-6581 artifacts reproduce these sizes. The saved-only
physical code owners are startup 609, main 286, compatibility 728, sole-source
123, key query 799, joystick query 468 and BASIC stub 12 bytes, totaling 3,025.
Remaining numeric/resource/path checks are not qualified. The independent
expert startup is 51 bytes and explicitly assumes no CIA2 bank operation;
the selected frozen startup/terminal obligations must be checked before this
comparison can justify a compiler change or a protected-oracle correction.

The required independent output and platform phase lenses are performing that
bounded equivalence assessment. They run no emulator and make no edits. Source
and prior output corrections remain uncommitted; no new pass, IR, solver,
allocation framework, runtime, profile, startup policy, library workaround or
budget change is authorized. Any necessary additional material support must
receive a named smallest-solution packet, independent challenge and direct user
decision before implementation. RD-08 is not a Phase 2 parity waiver.

### Subsequent acquisition diagnostic result

`phase2-first-acquisition-runtime.log` finishes **20 PASS / 12 FAIL / zero
skips**, 54.02 seconds. Normal and unavailable acquisition pass all sixteen
cases, and chained predecessor cases pass four. All eight timer cases fail in
the fixture's pre-acquisition setup observation: a nominally stopped Timer B
reads `$FFFD`, not the fixture's asserted `$FFFF`. No execution through the scan
is qualified by those failures; the setup's exact cause remains Unknown and no
fixture or expected counter is changed. Four exclusive predecessor cases fail
public `checkProject` with E10245 before generation: the unchanged witness stores
one consuming CIA2 read into a source global, matching the already recorded
normal-source NMI storage debt owned by RD-08/#100. This failure does not
establish a forbidden language form or authorize weakening the private-storage
guard. No ownership fixture is changed and no existing debt is silently waived
or reassigned.

### Independent selected-contract assessment

The required platform lens reports **TP-001 MAJOR**: all three handwritten whole
artifacts include `input-startup.a`, which omits the approved CIA2 DDRA
capture/`saved_ddra & $FC`/restoration duty. Frozen Appendix C64's shared entry,
the exact approved T-09 Objective, and expert
`c64-memory-and-runtime.md#vic-view-and-placement` fix this profile mode. An
entry with DDRA `$03` and PRA low bits `$02` remains bank 1 under the baseline
but enters bank 0 under the selected startup. No-VIC-source wording cannot
choose another startup policy. This requires only the approved DDRA sequence,
not the current implementation's entire VIC initialization/save area.

Both required lenses independently find the baseline's `JSR main` and main
`RTS` conflict with frozen `spec/10-modules.md:192,197` fall-through entry.
The complete expert comparison is therefore **Incorrect / not equivalent** at
the inspected static boundary; its 912/829/683-byte artifacts are assembled,
not valid full-contract parity oracles. Their existing limits remain untouched
while the precise correction scope is determined. A simple added-byte estimate
cannot fix topology, branch/page paths, matching-low NMI placement or stack
witnesses; all must be re-derived for one corrected complete artifact. Neither
review requires copying every current compiler save or silently assuming SYS
A/X/Y are dead. The exact caller/observation contract remains a proof obligation.

Platform costs and limits: the direct approved DDRA sequence itself is 17 bytes,
22 nominal CPU cycles and one platform save byte, not a corrected whole-artifact
total. The inspected generated chain wrapper is 18 bytes/33 nominal cycles;
CPU acceptance plus the four existing ROM bytes add 14 cycles before it. Prior
firmware work, external nesting, whole deadlines and physical silicon remain
Unknown. Saved-only selects no NMI route; the full route has no private callback
home at this inspected boundary. No new runtime or physical claim follows.

Lineage: expert 2.0.4, content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`,
Specification 4 identity recorded above; reference headings `VIC view and
placement`, `Startup contracts`, `Interrupt entry and exit contracts`,
`evidence-parity-and-recovery.md#equivalent-work-accounting`. Governing keys
include BLEND65-STARTUP-BANK0-20261008, MOS-6510-1982, MOS-6526-1981,
MOS-PGM-1976, CBM-C64-SVC-1985, CBM-C64-KERNAL-03 and ACME-097-R266.
The auditors exclude accidentally exposed workflow/history summaries from
authority and decisive evidence. These are bounded prequalification assessments,
not completed six-lens phase review or approval to edit protected inputs.

The completed output lens independently retains these phase-local findings:

| Finding      | Inspected boundary / current versus equivalent local candidate                                                                                                                          | Smallest existing seam and limit                                                                                                                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MC-001 MAJOR | Expert startup/main topology is not equivalent; whole ratios are not valid.                                                                                                             | Correct the expert shared startup/whole entry-exit layout under exact oracle authority, then assemble and re-derive full costs. No additive allowance or copied generated startup.                                                                                     |
| MC-002 MAJOR | Saved borrowed field-offset access is 27 bytes/39 cycles versus a proved non-crossing 14/21 candidate. Sole-source final predicate is 38/52 versus a same-parameter 17/22–23 candidate. | Existing `machine/lower-aggregate-place.ts`/`lower-aggregate.ts` displacement consumption and `lower-scalar.ts`/forwarding/retention. Unknown pointer/MMIO dummy footprints and alias/flag obligations retain fallback; local candidates are analytical, not executed. |
| MC-003 MINOR | Two return-copy branches each materialize an unused source pointer: 8 bytes/10 cycles per branch, 16 serialized bytes total.                                                            | Existing aggregate-place/return direct-home consumer can suppress only unused pointer production. The eleven-byte return copy remains; this is not fresh caller-destination or alias proof.                                                                            |
| MC-004 MAJOR | Full artifact pads 158 bytes before its matching-low callback. A return-terminated boundary offers a six-byte gap, a candidate 152-byte saving.                                         | Existing `layout/c64-layout.ts` order and `c64-layout-placement.ts` constraints. Actual relocated/page-path correctness and final bytes must be requalified; no new layout framework or combined budget is approved.                                                   |
| MC-005 MINOR | Fresh standard-resource observer reads the name from `kind`, not the canonical `id`.                                                                                                    | Exact AR-P16 observer gate; zero runtime bytes/cycles, every numeric bound preserved.                                                                                                                                                                                  |

The output auditor also records the profile CPU spelling versus sidecar-ID
mapping as unresolved by its packet, rather than choosing solely from emitted
data. AR-P16's explicit proposal names the established public identity and
unchanged normative profile spelling; it still requires the user's exact
authority. No additional production correction is authorized by these findings.

Complete inspected ledgers: saved payload 3,025 = stub12 + startup609 + caller286

- query bodies2,118; full payload 3,441 = stub12 + startup609 + caller122 + queries2,118
- acquisition404 + wrapper18 + padding158. Actual saved/full resident RAM is
  3,218/3,622, ZP14/12, bounded generated program stack4/5 and scratch0. The latter
  stack values do not bound external NMI nesting. Expert saved/full/small totals
  remain 683/912/829 payload and 713/943/860 declared resident bytes for their
  **unequal contracts**. These totals are inventory facts, not acceptance ratios.
  No build/test/VICE was performed by either auditor; root owns all native runs.

### Normal BASIC return follow-up

The platform lens completes its bounded primary-source follow-up. **TP-002
MAJOR** survives statically: `input-query-compatibility.a:39` borrows `$10`,
Commodore BASIC's `SUBFLG`, and an early incompatible exit can leave it one.
The concrete saved object is rows `FE, FC, FF, FF, FF, FF, FF, FF`, joystick
bytes `FF/FF`, quality zero, key zero, port one and control zero. The following
joystick-HIGH path does not reset this byte. Pinned BASIC `code11`'s integer
variable parser reads `SUBFLG` before resetting it; the audited stock SYS,
READY and next-command paths do not first clear it. Subsequent `A%=1` is
therefore predicted to fail. This is a **static source prediction**, not an
executed VICE result. The smallest native witness uses the unchanged whole
saved artifact and genuine BASIC return, then enters that command.

This is an expert-baseline defect, not a demonstrated generated `$10` defect:
the retained generated ZP intervals end at `$0D` full and `$0F` saved. Avoiding
the live borrowed byte through proved scratch placement is preferable to adding
save/copy work when legal. No blanket ZP restoration, new allocator or source
restriction follows. Exact scratch interference must still be proved before
changing the protected assembly.

Pinned BASIC `code26`'s `CSYS`/`CSYSRZ` loads and then captures A/X/Y/P through
`$030C–$030F`. These outgoing values are observable, but stock SYS does not
require incoming A/X/Y to remain unchanged. `$030F` holds P, not physical SP.
Frozen FN-4's `void` result does not by itself declare every SYS register dead;
the exact normal-return preserved/clobbered policy must be explicit. The
selected return clauses likewise do not explicitly settle ownership of borrowed
documented BASIC conversion vectors `$03–$06`. Their memory-map names alone
prove neither universal preservation nor permitted clobbering.

The required independent semantics/DX lens is assessing that narrow remaining
contract without compiler implementation, old test answers or the author's
preferred option. No complete equivalent baseline or replacement numeric bound
is accepted yet. Primary sources are the Commodore Programmer's Reference
memory map, printed page 311, and recovered Commodore BASIC source at immutable
pin `01bd60f162ef92212ef0cb67546ae8f42be34168` (`code26`/`code11` and named
continuation paths); governing key CBM-C64-PRG-1982. The root directly verifies
the SYS capture sequence and integer-variable check. Original expert/spec
lineage above remains unchanged. Neither follow-up executes VICE or proves
physical hardware.

The platform follow-up accidentally exposes an initially unfiltered generated
memory summary; only its subsequently isolated ZP intervals are used. Root's
reference lookup also exposes an unrelated historical semantic-module preamble.
Both exposures are excluded from authority and decisive semantic evidence;
the independent semantics packet excludes them and all prior verdicts.

### Exact next decision — baseline correction and normal-return ownership

**Approved, baseline correction not yet qualified:** on 2026-10-10 the user
replied “I approve” to the exact AR-P17 rule and ten-file correction request.
This authorizes only that named correction, not residual compiler machinery,
additional oracle edits, a budget waiver or a push. Keep normal `main(): void`
returning to usable stock BASIC by `RTS`, with no promised outgoing A/X/Y
values. Preserve the exact incoming `$03–$06` documented BASIC conversion
vectors whenever compiler allocation borrows them. Preserve or avoid every
other borrowed value proved live at BASIC continuation; this is not permission
to clobber unproved workspace. Existing P/SP, processor-port, CIA2, vector,
device and interrupt restoration obligations remain unchanged. No manual
user repair, nonreturning-main restriction, warm-start or new source API follows.

The independent semantics lens recommends this same direction. **SM-001 MAJOR**
duplicates TP-002's `$10` finding: on the supplied saved object, the pinned
`CSYSRZ → NGONE1 → NEWSTT → GLET → LET → PTRGET` continuation rejects the valid
next assignment in `SYS 2061:A%=1`, STOP unpressed. Its exact intervening
CHRGET and stock STOP paths do not reset `$10`. That closes the inspected
static witness, not native proof. The separate vector lookup finds declarations
and initialization but no ADRAY1/2 readers in the pinned BASIC source; absence
of readers does not grant clobber permission. Exact borrowed-vector preservation
is therefore the narrow explicit product ruling requested here. Source `void`
and stock SYS do not require incoming A/X/Y preservation; the latter would add
an optional guarantee rather than repair the established return failure.

The protected correction is confined to these **ten existing files**:

| Files                                                                                                                 | Exact permitted change after approval                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fixtures/input-startup.a`                                                                                            | Add the already approved DDRA transaction, implement the selected borrowed-vector handback, and separate entry/restore so `main` is entered by fall-through. Declare the exact normal-return observations. No copy of the compiler's entire startup or save inventory.                                                                                             |
| `fixtures/input-whole-fast.a`, `input-whole-small.a`, `input-whole-saved.a`                                           | Remove the main JSR/RTS topology, use the corrected entry/restore, and rederive complete placement, padding, physical owners, stack and CPU-path annotations/assertions from each assembled artifact. Preserve the exact input domain, outputs, guards and callback/link obligations.                                                                              |
| `fixtures/input-query-compatibility.a`                                                                                | Avoid the live `$10` column-mask cell by using `$07` only after proving it dead across both callers' compatibility calls. Preserve every predicate, guard, instruction form and effect; only the three column-mask operands and ownership annotation may change. If interference invalidates this placement, stop rather than introduce an unapproved alternative. |
| `fixtures/input-query-key.a`, `input-query-joystick.a`                                                                | Ownership/lifetime comments only, documenting the proved dead caller `$07` slot while compatibility executes. No instruction or behavior edit.                                                                                                                                                                                                                     |
| `input-library-output.spec.test.ts`, `input-saved-query-output.spec.test.ts`, `input-acquisition-output.spec.test.ts` | Only derivative payload/resident/ZP/generated-stack bounds and explanatory cost comments, taken from the corresponding corrected **complete, qualified** artifact. No additive allowance, arbitrary relaxed limit, mixed fast/small minima or assertion removal.                                                                                                   |

Paths in that table are relative to `test/rd05/`. The two ordinary `.blend`
callers, every saved-data/acquisition behavior fixture, both acquisition
assembly bodies, callback and sole-source helper stay unchanged. Preserve the
approved observer identities and raw predecessor hashes. Source/predicate
semantics, physical-window guards, MMIO/order/count expectations, exact
resource uniqueness, negative admission checks and Unknown external bounds
stay protected. The new scratch overlay and normal-return transaction require
independent storage/platform review and existing sequential native observation;
no replacement limit is accepted merely because ACME assembles it.

The whole correction is one approval boundary, not one oversized implementation
task. Execute it in the existing plan as small entry/exit, placement/lifetime
and derived-observer steps, respecting the existing per-step file/size limits.
No new compiler pass, IR, solver, allocator, runtime, dependency, framework,
production startup edit, bundled-library change, old-test edit or frozen-file
edit is authorized. Existing residual compiler, timer-setup and exclusive-NMI
failures remain open and require their own bounded scope. If further entry/exit
ownership is undetermined, return to its exact gate rather than invent a policy.

**Confidence: High** that the baseline must be corrected; **Medium** for a
complete replacement until assembly, native return and lifetime proofs finish.
**Hardening: changed** the unsupported blanket “void-ABI dead” assumption into
an explicit SYS boundary and narrowed restoration to owned live state plus
the four documented vectors. Independent platform/semantics recommendations
converge; no native result is borrowed from reviewer agreement. The strongest
objection is that SYS exposes A/X/Y and vector wording might already imply
preservation. Neither establishes the missing exact ownership promise; the
requested ruling makes it explicit without expanding the language API.
The semantics lens reports its unrelated routing setup-table exposure and
excludes it from evidence. Frozen expert/spec lineage remains as recorded above.

Approved execution resumes within task 2.2.8: first prove the exact scratch
overlay, then correct entry/restore and complete layout, then qualify native
return and independently rederive the three observers. Progress stays 38/48
until the actual task verification passes. The remaining compiler, timer and
exclusive-route failures retain their existing open gates.

### Approved correction evidence — 20:28 CEST

Only seven authorized assembly files changed. The three numerical observers
remain unchanged; all other fifteen-test/six-fixture identities match the
AR-P16 manifest. Both ordinary callers, acquisition bodies, callback,
sole-source helper, bundled library and production compiler remain unchanged.
Final strict ACME 0.97 documented-6502 assembly succeeds and `cmp` proves the
final instruction bytes match the actual native-qualified artifacts:

| Artifact | Payload / suffix / ZP | Generated stack               | PRG SHA-256                                                        |
| -------- | --------------------- | ----------------------------- | ------------------------------------------------------------------ |
| fast     | 963 / 21 / 14         | 5; one scoped NMI component10 | `94d929390973e54ed1de0125ff77ce8f27fca42c85a63bf2a267cb222f9b0761` |
| small    | 877 / 21 / 14         | 5; one scoped NMI component10 | `c144d6d3e84dd0f47cd9e330b370615553d234b3603a746cfc6a7a6687be0871` |
| saved    | 736 / 20 / 14         | 5; no installed hook          | `0ad9845bc8308675c9e1c33b4f465afd7b9f376b6a10e79026d3db1df3c4aa2e` |

Raw evidence stays under the existing `keyboard-plan-check.hzunZt` Git-metadata
root. `phase2-ar17-oracle-sha256.txt` has SHA-256
`637bbad08d5f70d517fb6eb755c43e3d4a45059546300481236d010f90401dc7`;
the previous manifest remains intact. `ar17-final-*.report/.sym/.prg` bind final
source/labels/bytes. `ar17-native-return-2.log` records12/12; the completed
`ar17-native-bank-states.log` records192/192 PASS in259.81 seconds, covering
three artifacts × four profiles × sixteen low PRA/DDRA combinations. Each
genuine shipped RUN/SYS entry returns through `$E147`, restores P/SP, port,
borrowed vectors, `$10` and DDRA, issues zero PRA accesses, and accepts the
next ordinary keyboard command `A%=1`. Low latent bank bits are independently
observed after the return interval; upper serial pins are not mistaken for
software-readable latch values. The initial diagnostic's incorrect full-PRA
assertion and failure remain retained; only that untracked probe was corrected.
This is VICE-verified / hardware-unverified for these endpoints, not a full
electrical matrix, NMI-arrival, firmware-completion or compiler qualification.

Independent storage, platform and exact correctness/oracle reviews report no
findings for this approved boundary. They independently exclude accidental
historical routing/release-summary exposures. Root's broad source-key lookup
likewise exposed unrelated manifest audit-map entries; these are excluded from
authority and decisive evidence. Current expert/spec lineage is unchanged.
The output reviewer verifies actual payload, physical owners, all branch-page
corrections and the29 nominal CPU-path totals now printed in the whole fixtures.
These are static official-instruction sums, not measured VICE wall-clock cycles.
Root separately recomputes all-high paths695/887/521. External aggregate stack,
retained-ROM completion/reentrancy and silicon-sensitive behavior remain Unknown.
Two output findings below prevent accepting these artifacts as the expert floor.

## AR-P18 — remove two proved benchmark redundancies

Status: **Resolved — exact protected-oracle exception qualified.** The user's continuation
instruction approves the immediately preceding named seven-file proposal;
it does not authorize unrelated oracle changes or material support surfaces.
No new compiler
support, product decision, source limitation or support framework is proposed.
The independent output reviewer reports two **MAJOR** expert-floor findings:

- **MC-001:** fast/small main repeat `LDA #<saved; STA $02; LDA #>saved; STA $03`
  after `key_state`; saved-only repeats the same block. Key and its complete
  helpers preserve `$02/$03`, and the existing context excludes external
  mutation of query bytes. The block performs no source evaluation or MMIO.
  Removing it saves8 instruction bytes/10 nominal cycles in each caller before
  whole layout; current full caller58→50 and saved86→78 instruction bytes.
- **MC-002:** startup's `TSX; INX; LDA $0100,X` can use `PLA; PHA`, retaining
  `AND #$F7; PHA; PLP` unchanged. Both reach A=original saved P with that P back
  at its original stack address. I stays1 and D stays0; a balanced returning
  NMI restores A/P/S and the following PHA replaces the temporarily freed slot.
  This requires no new returning-NMI guarantee: the existing LDA/STA captures
  and LDA/AND/PHA already need A preserved. SYS return bytes and generated stack
  peak are unchanged. Fixed-sequence savings are3 instruction bytes/1 nominal
  cycle; complete entry/return105/158→102/157 before placement.

The alternative `PLP; PHP; CLD` is rejected: it temporarily restores incoming
D/I and could change a retained interrupt route. No blanket interrupt or
nonreturning assumption is introduced. The actual serialized byte saving for
the proposed cleanup is **Unknown until reassembly**: callback padding can
absorb shorter code. Do not subtract11 from every payload budget.

**Single best option:** approve only this exact seven-file correction:

| Files relative to `test/rd05/`                                                                                        | Permitted change                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fixtures/input-startup.a`                                                                                            | Replace exactly TSX/INX/LDA-stack with PLA/PHA; retain following AND/PHA/PLP, DDRA, borrowed-vector, port and inline-return operations. Update derived cost annotations.                                                                                                                          |
| `fixtures/input-whole-fast.a`, `input-whole-small.a`, `input-whole-saved.a`                                           | Remove only the second four-instruction pointer setup after `key_state`; retain its first setup and every source input/output, call, predicate and effect. Rederive complete placement/padding/resource/stack/path annotations and assertions; preserve page-window and matching-low protections. |
| `input-library-output.spec.test.ts`, `input-saved-query-output.spec.test.ts`, `input-acquisition-output.spec.test.ts` | The same already named derivative-only numerical/comment corrections, now from the final complete qualified artifact. Preserve every other assertion and exact resource/CPU identity. No additive allowance, arbitrary loosened limit, mixed candidate minima or assertion removal.               |

All query/acquisition bodies, callback, sole-source helper, ordinary source and
behavior fixtures, bundled library, compiler and frozen authorities stay
unchanged. This is one small benchmark cleanup plus its existing derivative
observers, not permission to optimize arbitrary oracle code. Execute as bounded
substeps inside2.2.8; no new plan or framework. Reassemble complete artifacts,
rederive actual paths/owners, repeat the existing sequential native boundary
observations and obtain independent exact-fix review before accepting budgets.
If an assumption fails, stop at its exact gate; do not generalize the change.

**Confidence: High** for the two fixed-sequence removals; complete revised
placement and native qualification remain pending. **Hardening: changed** the
initial acceptance into a held expert-floor gate after independent review.
The strongest objection is a callee/interrupt clobber or differing status
window; actual callee writes, the already declared external-writer boundary
and unchanged I/D state refute it. Keeping known redundant expert code is not
a viable way to satisfy the prime directive. At proposal time no numerical
observer was changed, no task promoted, and no partial RED checkpoint committed
or pushed.

### Applied qualification — 22:50 CEST

The exact seven-file cleanup is complete. Strict ACME 0.97 assembly passes;
final commented assemblies reproduce the exact PRG bytes used in the native run.
Matching-low padding absorbs the eleven instruction bytes in fast/small; their
payloads stay 963/877. Saved-only falls from 736 to 725 bytes. Actual costs:

| Complete artifact | Payload / PRG bytes | General / ZP / combined resident bytes | Bounded generated stack                       |
| ----------------- | ------------------- | -------------------------------------- | --------------------------------------------- |
| Fast              | 963 / 965           | 984 / 14 / 998                         | 5 base, 10 with one scoped callback component |
| Small             | 877 / 879           | 898 / 14 / 912                         | 5 base, 10 with one scoped callback component |
| Saved-only        | 725 / 727           | 745 / 14 / 759                         | 5                                             |

There are **28**, not 29, annotated nominal paths: nine each for fast/small and
ten for saved-only. This corrects the preceding journal's count, not an input
case. All-high paths are 684/876/510 cycles; entry/return is 102 bytes/157
nominal cycles. Page-cross and callback-window assertions remain intact.
The three numerical observers now use these actual complete artifacts, including
the tighter ZP and stack limits. No behavior, source, predicate, trace, helper,
fallback or negative assertion is changed.

`ar18-native-bank-states.log` records **192/192 PASS**, exit zero: three artifacts,
four profiles and sixteen incoming PRA/DDRA low-bit states. The existing genuine
SYS-to-BASIC observer verifies P/SP, borrowed BASIC bytes, CPU-port/DDRA/latent
bank restoration and the next ordinary `A%=1` command. Direct NMI injection
between PLA/PHA was not performed; its returning-route safety is a static proof,
not a native transition observation. External route work/stack and physical
silicon remain Unknown. Status: **VICE-verified / hardware-unverified** only at
these endpoints.

Independent exact-fix output, platform and correctness reviewers report no
findings; this is the one fix-only re-review, not a full phase review. PRG hashes
for fast/small/saved are respectively
`735b4d3731b17f061672e0b169b96c1713605529f9a86932539725fa9b018c1c`,
`f68adba108bea487b541d607aedaf7c7584f8b29522d599acea67f50df333908`,
`c2b60a738240a4c5fbea375ffb3dfea5743319dc6d8b50e245d064f809984f4f`.
The existing evidence root retains `phase2-ar18-oracle-sha256.txt`, manifest hash
`78ed3ef4fdcc4e6e8e0d2222ea35d036f5ab4ac8a55bd671fc5d30ea82a36edd`.
Its 36 entries contain the 28 Phase 2 files plus eight unchanged Phase 1 input
tests. Exactly the named seven differ from AR-P17; independent in-memory reversal
of the three derivative observers recovers their preceding raw hashes.

Fresh build passes. All twelve compiler output comparisons remain RED at their
first payload bound: full 3,441 versus 963, saved-only 3,025 versus 725. Later
resource/path checks remain unqualified. The complete saved-simple native run
also fails all four profiles with monitor connection closure; the precise cause
is not yet established. Progress stays **38/48**, with no partial RED commit,
push, frozen-authority edit, output waiver or additional compiler mechanism.

### Approved-family follow-up and diagnosis — 23:05 CEST

The existing AR-P12 adjacent fixed-store family missed ordinary `store` operations
whose scalar place has no field/index path. The already present consumer emits a
direct home store without address setup. Extend only that existing selector arm;
retain byte width, sole use, same-block adjacency, no-instruction crossings and
all general fallbacks. No NMI admission, storage closure, source or protected
oracle is altered. This is completion of the approved family, not new support.

The unchanged predecessor specification now passes **8/8**, including all four
formerly rejected exclusive cases. Existing admission/storage/profile checks
pass **64/64** and directed compiler checks **39/39**, including one new internal
regression for direct homes, widths, selected paths, extra consumers and barriers.
Build/typecheck pass. The source library SHA remains the candidate above. No-event
composition is the native endpoint; this does not prove unrestricted NMI events.
Fresh output remains RED: full 3,441/963, saved-only 3,001/725; the saved caller
saves 24 bytes, while full matching-low padding absorbs the local reduction.

An unchanged-source saved-simple launch-bound probe completes 952 observations
at 100,000,000 cycles, then the child exits one/monitor closes. With only the
launch bound changed to 200,000,000, it reaches all 1,089; normal owned cleanup
then sends SIGTERM. It does not check all answers and is not a passing behavior
oracle. Keep the actual test/harness bound unchanged; planned generated-output
correction remains due. Raw evidence: `saved-simple-limit-probe.log`, SHA-256
`8226d95a487bafaa6fcd6745a2d48579cf64f860da8a976b5294ceac685102a6`.

The timer diagnostic reproduces the fixture's stopped `$FFFD` after switching
from a previously running configuration. At a held CPU clock, writing STOP and
the latch does not itself advance the CIA's pending count pipeline; it decrements
after execution resumes. The primary pinned VICE `ciatimer.h` count/control/load
state transitions corroborate that mechanism. Issuing the normal LOAD strobe in
the final setup control write reloads the desired latch before observation, while
the readable control keeps the original START/PBON configuration. Across four
profiles, both I states and three configurations, **24/24** candidate setup probes
show stopped counters exactly `$FFFF`, active progress over the NOP, unchanged
readable controls and stopped-counter stability through acquisition. The original
setup is also retained for comparison, 48 total observations. Raw evidence:
`timer-setup-all-profiles.log`, SHA-256
`d19812c026e904d557bd08d4cc508720818b40ba6473ad45beed78ec0189af29`.
The exact specification file is still byte-identical to AR-P18. These probes do
not substitute for its complete register/trace/stack/snapshot expectations.

Root accidentally loaded unrelated crosswalk/routing historical summaries during
reference navigation. They are excluded from authority and decisive evidence;
only selected normative headings, actual source and direct run results support
these conclusions. The independent challenger received no evaluator answers.

## AR-P19 — use source guards in the existing footprint proof

Status: **Resolved at the bounded guard/cast unit endpoint; complete phase qualification remains open.**

| Complexity field      | Bounded proposal                                                                                                                                                                                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original goal         | Ordinary saved-input queries select no unused acquisition state, with unchanged semantics and complete expert output.                                                                                                                                                                                           |
| Extra support         | Use-site unsigned bounds from actual reaching comparison edges in the existing semantic footprint owner.                                                                                                                                                                                                        |
| Demonstrated need     | `reachable-globals.ts:78–80` retains the scanner byte when any indexed footprint is unproved. Current `aggregate-place-proof.ts:72–124` knows literals/conversions/AND only; ordinary source has `<8` loop guards and `ordinal>=64` early return before `ordinal>>3`.                                           |
| Smallest solution     | Prove bounds only at the access from an actual dominating/reaching guard; carry them through fixed unsigned right shift and already value-preserving conversions. Consume them in the existing complete-root footprint check before SFA.                                                                        |
| Invalidation/fallback | Tie facts to the actual value, not a name. Writes, possible aliases/calls/effects invalidate affected facts; joins keep only bounds valid on every reaching path. Unknown, signed, raw, borrowed-unproved and OOB accesses preserve the existing conservative selection. Array extent grants no ordinal proof.  |
| Excluded              | Counted-loop recurrence/termination analysis, general interval/interprocedural solver, parallel range IR, new optimization pass, input special case, automatic admission, runtime, framework, dependency and protected-test edits. No word-counter narrowing or unrelated startup/layout change in this packet. |
| Extra cost            | A focused helper in the existing semantic owner if needed, direct current-consumer wiring and independent positive/negative specification tests using current project fixtures. No persistent subsystem or new harness.                                                                                         |
| Independent verdict   | **Simplify**: the actual true/continuation edge already bounds an unchanged unsigned value; recurrence support is unnecessary for this footprint obligation. Keep unrelated startup/output mechanisms outside.                                                                                                  |
| Direct user decision  | Approved on 2026-10-10 by the user's continuation with auto approval, in response to this exact AR-P19/AR-P20 recommendation. No broader mechanism or protected-test authority is inferred.                                                                                                                     |

**Best option:** approve this one guard-based footprint extension, not a broader
range/loop system. The word and nested loop bodies need no recurrence proof to
use their successful `<8` edge; the surviving unsigned early-return edge proves
`ordinal<64`, then shift three gives `0..7`. Actual value continuity and reaching
paths still need implementation proof. The strongest objection is unsound
invalidation or a missed join, addressed by independent alias/mutation/call/join,
signed/wrap and unguarded negative witnesses before implementation.

The fresh read-only design challenger independently selects this narrower scope.
It could not inspect files: no filesystem reader was available and its charter
forbids Bash. Its verdict is explicitly based on root's directly verified packet,
not independent code inspection, emitted output or native qualification.
**Confidence: Medium** for exact implementation placement, high for the necessity
of consuming source-established bounds. **Hardening: changed** the proposed
guard-plus-canonical-loop packet to guard facts only. **Challenger: converged**
on the simplified direction. Approval is not implementation qualification. Independent
specification tests precede the bounded production correction.

## AR-P20 — establish the timer latch with the normal LOAD strobe

Status: **Approved — exact setup correction and complete requalification in progress.**

**Best option:** permit only this setup correction in
`test/rd05/input-acquisition-timers.spec.test.ts`:

```typescript
// LOAD reloads the latch after a previous running configuration; it reads back clear.
await monitor.writeIo(
  CONTROL_A,
  Uint8Array.from(configuration.controls, (control) => control | 0x10),
);
```

It replaces only the existing final pre-observation
`Uint8Array.from(configuration.controls)` argument and the immediately related
setup comment. The initial STOP, four `$FF` latch bytes, port setup, source,
three configurations, original readable controls, `$FFFF` stopped expectations,
NOP progress, all I/P/SP/snapshot/ICR/control/timer traces, profiles, counts,
timeouts and shared helpers remain unchanged. No expected `$FFFD` is introduced.
No consuming ICR operation or timer restart policy is added to the library.

The preceding 24 candidate probes and pinned timer-state mechanism ground this
one-line setup correction; they do not qualify the still-unchanged protected
specification. After exact approval, re-run all eight complete cases and retain
raw-hash reversal plus final independent oracle review. **Confidence: High**
for the observed bounded setup; physical CIA-edge behavior remains unverified.
No other old/fresh oracle or arbitrary timeout exception is included.

### Exact pair approval — 23:14 CEST

The user requests continuation with auto approval until RD-05 is implemented.
This accepts the immediately presented AR-P19/AR-P20 pair. Their named boundaries,
independent tests, unchanged cost floors and complete qualification remain mandatory.
Routine implementation choices need no new pause; materially broader support and
unrelated protected-oracle edits are not authorized by this pair.

### AR-P20 applied qualification — 23:17 CEST

The exact argument and comment correction passes all eight complete timer cases,
zero skips, in 16.26 seconds. Log: `ar20-timers-native.log` in the existing
Git-metadata evidence root. All three configurations and original counter,
control, I/P/SP, immutable snapshot and consuming-register trace assertions execute.
Evidence is VICE-verified / hardware-unverified; no physical CIA-edge claim is made.

Reversing only these two approved text replacements recovers the AR-P18 raw SHA-256
`636bc992e9802d3c16895268fbefad692e218459a3616d6eb4d99f20e263074a`.
Current file SHA-256 is
`d0497ea6509afd499e44e262d3d0564026cc295e9af567be98f1a4804d1f151f`.
Of all 36 paths in the preceding manifest, this is the only changed path. Final
independent phase oracle review is still required; no other task is promoted.

### AR-P19 bounded qualification — 23:38 CEST

The independent specification-first unit passes all 168 new guard/cast cases,
including twelve sequential VICE cases. Existing semantic 76, frontend 66 and
new internal twelve cases pass. Build/final typecheck and fifty foundation,
import-boundary and old bundled-source cases pass. Three independent initial
correctness, semantics/DX and SFA/ABI unit reviews report no findings; they do
not replace the six-lens final Phase 2 review. The [execution journal](99-execution-plan.md#guardcast-unit-qualification-and-remaining-authority--2338-cest)
records raw RED/GREEN logs, independent-author scope, unchanged test hashes,
the two deterministic explicit-cast/shift corrections and review evidence limits.

Ten input-behavior files pass 68/68, including the full approved timer cases.
Remaining purity/output assertions are still four/twelve RED. The complete
compiler suite has 1,961 PASS, two existing unrelated SKIP and one protected
profile-count FAIL. The actual purity source now has only two unproved accesses,
`answers[64 + control]` and `answers[69 + control]`; both have a reaching
`control < 5` guard in `answers: byte[74]`. The current helper intentionally
has no arithmetic-addition transfer. Current output limits and the unchanged
saved-simple cycle bound remain actual qualification gates, not deferred debt.

## AR-P21 — prove a guarded constant offset in the existing helper

Status: **Qualified at the bounded static unit — full native purity/output and phase qualification remain due.**

| Complexity field                   | Bounded proposal                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original goal                      | Finish saved-data-only input queries with zero unused acquisition code/state and unchanged behavior/output expectations.                                                                                                                                                                                                                                                                        |
| Extra system or support code       | One constant-offset transfer in the already approved `semantic/guarded-place-proof.ts` owner.                                                                                                                                                                                                                                                                                                   |
| Why it may be needed               | The current helper transfers only loads, conversions and right shifts; the two remaining additions therefore make `reachable-globals.ts:90–99` conservatively retain the cold scanner byte.                                                                                                                                                                                                     |
| Evidence                           | Actual semantic diagnostic `guard-footprint-probe.log` identifies only `64 + control` and `69 + control`, with `control < 5` and a 74-byte answer array. Proven maximum four gives maxima 68 and 73. Four complete purity cases remain RED before native execution.                                                                                                                             |
| Smallest solution that still works | Add one transfer for an exact nonnegative literal plus an already proved nonnegative unsigned value, either operand order. Require the selected result and variable operand to be unsigned and the mathematical sum to fit the existing result width. Otherwise return unknown. Consume the bound at the same actual access through the complete-root footprint check.                          |
| Preserved/excluded                 | Preserve current captured-value identity, reload invalidation, alias/call/effect fallbacks, all-path joins and whole-object-width containment. No variable-plus-variable arithmetic, signed/wrapping inference, recurrence/termination, interval/interprocedural solver, counter narrowing, startup/layout mechanism, source special case, runtime, pass, dependency, harness or old-test edit. |
| Extra cost                         | Approximately fifteen lines in the current helper, direct internal cases and two focused independent positive/fallback specification files using existing project fixtures. No new production owner or persistent subsystem.                                                                                                                                                                    |
| Independent verdict                | **Justified**, narrowly: the existing guard proves the two maximum offsets without recurrence or a general range solver. Correctness depends on checking unsigned semantic width and rejecting potential wrap.                                                                                                                                                                                  |
| Direct user decision               | Explicit pair acceptance: "I approve, but before you proceedm tel me how much of RD-05 is left?", followed by the keyboard/input completion instruction. Recorded 2026-10-11 00:36 CEST. This approves only this named transfer, not broader output machinery.                                                                                                                                  |

**Best option:** approve only this constant-offset transfer. Retaining the
conservative fallback cannot satisfy the already accepted zero-cold-state
contract. A general range solver is unnecessary; rewriting the protected source
or relaxing its assertions is not an authorized alternative. Independent new
positive/negative specifications precede production changes and cover operand
order, unsigned width/no-wrap, signed/OOB rejection and write/alias/join fallback.
Their named owners are `test/rd05/source-library-guarded-offset.spec.test.ts`
and `test/rd05/source-library-guarded-offset-fallback.spec.test.ts`.
Then repeat the actual unchanged purity tests, their native observations,
existing guard/cast regressions and relevant compiler checks.

**Confidence: High** for necessity and minimum scope; implementation soundness
remains unverified. **Hardening: no change** after the independent challenge.
**Challenger: converged.** Its role has no filesystem reader and prohibits Bash;
its verdict uses root's directly verified line-numbered excerpts, not independent
file inspection, expert qualification or native evidence. The strongest objection
is making a new arithmetic proof without exact authority or a correct width/wrap
check; this packet holds both as explicit gates.

## AR-P22 — keep the old profile-call count scoped to its fixture

Status: **Resolved at the bounded unit — exact observer verified; final phase review remains due.**

The same exact pair acceptance recorded at 2026-10-11 00:36 CEST authorizes
only the replacement below. The later uninterrupted keyboard/input instruction
does not expand the protected-test exception.

**Best option:** in only
`packages/compiler/src/frontend/profile.spec.test.ts:351`, replace

```typescript
expect(result.program.calls).toHaveLength(12);
```

with

```typescript
expect(
  result.program.calls.filter(({ caller }) => caller.sourceId === "src/game.blend"),
).toHaveLength(12);
```

The test explicitly checks Game-facing profile calls. Its unchanged fixture has
eleven such calls plus `Game.main -> useProfile`, twelve total. Public analysis
of those actual bytes confirms the same twelve calls and six additional cold
installed-library calls: key/joystick classifiers each call compatibility and
sole-source helpers; acquisition calls `setNMI` and `restoreNMI`. The complete
frontend call graph is therefore correctly eighteen. Do not prune that graph,
change the fixture, bump the expected count or couple this test to private library
implementation details. Completion, zero diagnostics, exact selected declaration
environment and every other fixture/assertion remain unchanged.

The independent simplicity assessment agrees that selecting the existing caller
source identity preserves this test's intent better than expecting eighteen.
This is observer-only, with zero emitted-code/resource cost and no new mechanism.
After exact approval, reverse that replacement to match the original raw file
identity, run the entire old profile file and complete compiler suite, and include
the exception in the final independent oracle review. No other old test or
protected source/budget exception is proposed. The broader complete-output gate
remains open irrespective of this observer correction.

The current protected file is byte-identical to HEAD; both have SHA-256
`79e892f2b91ae71dcb147a9a0a080f6cddf339e93082737007fe177ed094f31c`.

### Applied bounded qualification — 2026-10-11 00:48 CEST

The exact AR-P22 replacement passes the old profile file (28/28) and the
complete post-offset compiler suite (1,980 PASS, two existing unrelated SKIP).
In-memory reversal recovers the original raw file hash above. No other old
profile assertion or fixture changes. Final whole-phase oracle review remains due.

AR-P21's independent positive/fallback files first record 64 RED / 60 unchanged
PASS, all legal sources checking/building. The fourteen-line existing-owner
transfer then passes all 124 cases; six added internal edge cases plus the
previous helper/proof tests pass 47/47. Fresh build and typecheck pass.
Independent correctness and SFA/ABI unit reviews find no logic/storage issue.
The correctness review records RV-001 MINOR: two new specification files lack
their required acceptance-criterion comment. AR-P24 names only those comments;
no fixture or assertion is proposed for change. The initially directed internal
command qualifies only its three matched files, not two unmatched arguments.
The complete compiler result includes the other current semantic tests.

The combined guard/cast and unchanged four-profile native purity run is still
running; no completed runtime claim is made. All twelve output cases remain
RED at the same first payload limits: full 3,441/963, saved-only 3,001/725.
This confirms the remaining startup/output boundary below, not a cost waiver.

## AR-P23 — qualify one smaller startup when display state is unobserved

Status: **Approved — bounded startup implemented and locally qualified; whole input output remains RED.**

| Complexity field                   | Smallest bounded proposal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original goal                      | Finish keyboard/input with normal source ergonomics, correct BASIC return and unchanged complete expert-output limits.                                                                                                                                                                                                                                                                                                                                                                                                            |
| Extra system or support code       | One compile-time startup choice in the existing startup/lowering/layout owners, with independent positive/fallback tests.                                                                                                                                                                                                                                                                                                                                                                                                         |
| Why it may be needed               | `layout/startup.ts:161–207`, `:209–306`, `:327–360` unconditionally capture, initialize and restore display/sprite state; the input caller does not need that work. Its startup occupies 609 bytes and fixes 49 save bytes. Local query selectors cannot remove this ownership.                                                                                                                                                                                                                                                   |
| Evidence                           | Fresh `guard-offset-output.log`: twelve failures, full3,441/963 and saved3,001/725. `c64-layout.ts:295–305` separately validates the fixed49 save area. Qualified equal-contract input expert startup is102 bytes with7 state bytes, but those are reference results, not a promised compiler inventory.                                                                                                                                                                                                                          |
| Smallest solution that still works | A conservative binary startup selection shared by construction and layout. Omit display captures/default writes/restore together only when existing closed-program identities and place/raw-footprint facts prove no relevant display dependency across source, initializers, helpers and declared handlers. Unknowns use the complete current startup.                                                                                                                                                                           |
| Preserved/excluded                 | Required CPU mapping order, unconditional CIA2 input-bank transaction, P/I/D/SP, exact normal BASIC return and actual borrowed-vector/live-BASIC protection remain. Derive saves from actual bindings, not a copy of expert scratch. No general per-device inventory, effect/interprocedural solver, runtime selector, new pass, public API, language restriction, input special case, engine, dependency or relaxed output limit. If existing facts cannot prove eligibility, retain fallback rather than build a new framework. |
| Extra cost                         | Changes in the three existing startup/lowering/layout owners and their structured internal handoff; two new focused specification files and direct internal cases. No new production subsystem or recurring external operation. Actual byte/resource savings are unknown until assembly/qualification.                                                                                                                                                                                                                            |
| Independent verdict                | **Justified**, narrowly. One demand-qualified startup choice addresses the demonstrated unconditional cost. Eligibility must cover display defaults, screen-data consumers, library/interrupt behavior and unknown indirect effects, not merely direct VIC register writes.                                                                                                                                                                                                                                                       |
| Direct user decision               | User: “I approve” on 2026-10-11, recorded at 01:15 CEST, accepts the exact AR-P23/AR-P24 pair presented immediately before this turn. This authorizes only the named binary startup choice and four-file exception, not additional support or output waivers.                                                                                                                                                                                                                                                                     |

**Best option:** approve the bounded variant, not a general startup framework.
Required machine state remains safe; proved unnecessary display work goes away.
Preserve the existing full default for direct startup construction and uncertain
programs. Avoid retaining unpromised outgoing A/X/Y merely to satisfy an old
observer, but first authorize its exact correction below. Retained-P stack use
needs its actual generated-stack and returning-interrupt proof; SEI does not
exclude NMI. Do not invent a new reentrancy or external firmware guarantee.

Independent specifications must be RED before implementation. Then check
actual assembly, complete PRG/resident/ZP/stack costs, all old startup/banking
cases and sequential SYS-to-usable-BASIC behavior on the four profiles.
This proposal alone cannot promise Phase 2 parity: substantial ordinary query
lowering remains after the hypothetical 507-byte startup reduction.

**Confidence: High** for necessity; **Medium** that the existing facts suffice
within this small scope. **Hardening: changed** the initial two-assertion estimate
to include the actual old A/X/Y observer boundary. **Challenger: converged.**
The challenger has no filesystem reader and uses directly verified supplied
line-numbered excerpts, not independent code/native inspection. Its strongest
objection is an eligibility proof expanding into a general solver; full fallback
and the explicit existing-facts boundary prevent that expansion.

## AR-P24 — exact startup observers and offset-test comments

Status: **Approved — exact four-file exception applied after independent startup qualification.**

Only these changes are proposed:

| File                                                             | Exact allowed edit after approval                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `test/rd05/cia2-startup-output.spec.test.ts:70` and `:79`        | Replace the two fixed49 size expectations with the actual independently qualified empty-program startup-state size. Preserve all source, interval identity/uniqueness, no-SFA/ZP/scratch, instruction decoding, CPU-port order, no-PRA, DDRA access/count/transaction cost and every other assertion. No arbitrary ceiling or allowance.   |
| `test/rd05/cia2-startup-vice.spec.test.ts:95–104` and `:192–201` | Remove only the A/X/Y keys in each actual/expected return object, matching the already approved AR-P17 void-return contract. Preserve original SP/P, all sixteen synthetic bank states, source, every checkpoint/MMIO/bank/DDR assertion, limits and timeout. Independent new startup tests prove usable BASIC, not merely removed checks. |
| `test/rd05/source-library-guarded-offset.spec.test.ts`           | Add only `// A reaching unsigned bound and a non-wrapping constant offset keep every access inside its complete array.` before the parameterized case body.                                                                                                                                                                                |
| `test/rd05/source-library-guarded-offset-fallback.spec.test.ts`  | Add only `// An overflowing, stale, signed, incomplete or raw-address fact cannot justify removing cold storage.` before the parameterized case body.                                                                                                                                                                                      |

No fixture, expectation or behavior changes in either offset file. No input
expert/output budget changes, no other protected-test edit and no frozen change.
The current old startup files match HEAD, with SHA-256 respectively
`ae8d749af1f9e6e8cf36e559b8906d47cfa81546bdae23d50a6e2e4becb53019`
and `4a77e7f7d19b0a328d7d6dcaf58adf2026d5d90475977db1752a1fcd8304eb18`.
The two new offset hashes and original RED log remain recorded above.
Exact in-memory reversal must recover all four identities after the exception,
and final independent phase oracle review remains mandatory.

The approved bounded startup now passes136 independent cases and76 existing
banking/output cases. The actual empty startup save size is4 after the two
necessary register/stack corrections, not an arbitrary allowance. Output review
independently confirms60 code bytes/94 nominal cycles, unchanged full/default
609/826/49 and preserved mapping/P/I/D/SP/BASIC obligations. The initializer's
unknown-A correction is independently clear. Exact source/byte/log identities
and evidence limits live in the execution journal. These bounded checks do not
clear whole Phase2, full-input budgets or the final independent oracle review.

## AR-P25 — finish the measured missing output consumers

Status: **Approved — exact narrowed four-consumer batch; specification-first implementation and qualification remain due.**

**Mode/ownership amendment, 2026-10-12:** the user directly approved
[whole-input AR-P4](../whole-input-cost-closure/00-ambiguity-register.md#ar-p4--exact-approved-complexity-decision)
with **“i approve”**. The three named complete-output gates now qualify explicit
`size`; `none` remains the canonical correctness/accounting reference. This
authorizes only the exact four-file mode exception recorded there and the
bounded early RD-08 prerequisite. It does not expand this historical four-consumer
batch, change numeric/behavior limits, waive remaining qualification, or permit
unspecified machinery. Existing tests are not yet edited.

| Required approval evidence         | Bounded proposal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original goal                      | Finish ordinary-source keyboard and both-port joystick queries, safe acquisition/return, and the unchanged complete expert-output costs. This remains the input slice, not RD-05 closeout.                                                                                                                                                                                                                                                                                                                                                                                                            |
| Extra system or support code       | Correct four existing compiler consumers, separately implemented and qualified: borrowed constant-field addressing; adjacent byte complement/bitwise delivery; consumption of an already proved unsigned access bound; and branch-only short-circuit control flow. Remove MC-005's unused pointer setup only if the existing copy facts already prove it unobserved.                                                                                                                                                                                                                                  |
| Why it may be needed               | Correct input behavior does not imply expert-quality output. Fresh complete artifacts still fail all twelve size cases. The ordinary two-byte Pair witness independently shows the borrowed-field defect outside this library.                                                                                                                                                                                                                                                                                                                                                                        |
| Evidence                           | The actual full/saved payloads are3,476/3,072 bytes against unchanged963/725 limits. MC-001–MC-005 below identify emitted instructions, existing owners and conditional local improvements. These local alternatives do not establish complete benchmark equivalence or sufficiency.                                                                                                                                                                                                                                                                                                                  |
| Smallest solution that still works | Reuse only the four current owners and their established facts; keep the existing general path whenever eligibility is unknown. Use the exact byte whitelist below, not general expression completion. A viable smaller execution order fixes branch-only and adjacent-expression consumers first, but postpones two already measured defects and can require another scope gate. Neither option is claimed to finish whole-artifact parity alone.                                                                                                                                                    |
| Extra cost                         | Changes in current aggregate-place, register-forwarding, semantic-control and existing branch-layout consumers, plus only the necessary handoff of already proved access facts before SFA closure. New concern-specific specification tests precede each change; current helpers and sequential VICE remain the test mechanism. Existing copy ownership may receive the one unused-setup correction. No new pass, IR kind, dependency, framework, solver, allocator, runtime or public API.                                                                                                           |
| Independent verdict                | **Simplify** — retain the four seams in one batch but replace broad scalar/arithmetic/conversion completion with an explicit byte-expression whitelist. Root accepts that reduction. The challenger used supplied verified excerpts because its allowed filesystem readers were unavailable; it performed no independent code/artifact/native qualification.                                                                                                                                                                                                                                          |
| Direct user decision               | **Approved, 2026-10-11 09:07 CEST.** After the sole pending AR-P25 packet and its explanation, the user expressly approves compiler/code-generation improvements “like you describe above” and directs continuation without routine interruptions. This accepts the exact narrowed four-consumer batch and conditional MC-005 removal. Routine choices within it need no new prompt. General future approval is not a named new support-surface, frozen/protected-oracle edit or budget-waiver authority; no `--auto-design` mode is inferred. Tasks2.2.2–2.2.6 and2.2.8 resume verification pending. |

### Exact permitted selections if approved

1. **Borrowed constant-field access:** select the existing pointer plus an8-bit
   Y displacement only when current facts prove the complete access, possible
   NMOS dummy-read footprint, alias and interrupt/interference obligations.
   Read-only source qualification alone does not prove safe RAM. Unknowns keep
   full16-bit displacement formation; no new interprocedural provenance proof.
2. **Adjacent disposable byte values:** same-block, sole-use delivery from a
   byte load/read or byte bitwise result into `~`, or `&`/`|`/`^` with an exact
   constant right operand. A byte complement/bitwise result may feed the same
   enumerated bitwise consumer, a proved fixed byte store, or a scalar byte
   return. Keep existing materialization, retention, MMIO and flag obligations.
   No new arithmetic, numeric-conversion, other-width, helper-backed, cross-call
   or cross-block forwarding is approved.
3. **Already proved index bound:** at a stride-one access whose existing
   unsigned fact establishes a maximum below256, consume its low byte through
   the current byte-ordinal address selector. Preserve source word type, home,
   update and condition, full pointer carry/wrap semantics and final Y-zero
   read. No loop recurrence inference, counter normalization or new range solver.
4. **Branch-only short circuit:** represent an `&&`/`||` result used only as a
   condition through the existing control-flow graph, without building and
   reloading an unused Boolean value. Preserve evaluation order and bypassed
   effects. Escaping or multiply used values retain materialization. Existing
   block layout and branch-range repair remain the owner of fallthrough/bridges.

MC-005 is solely removal of unobserved source-pointer setup before an unchanged
absolute-indexed return copy. If current facts cannot prove that, retain it.
This is not authority for return-copy elision or direct caller construction.

### Bounded residual output assessment

| Finding      | Actual code and current owner                                                                                                                                                            | Conditional expert alternative / evidence limit                                                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MC-001 MAJOR | Ordinary Pair callee28 bytes/45 nominal cycles; `machine/lower-aggregate-place.ts:93–118,320–343`. The full artifact has ten fixed-offset sites.                                         | Same-ABI indirect read15/27 saves13/18 at the actual same-page RAM witness. A runtime borrowed address does not establish every dummy-read footprint; retain fallback if unproved. |
| MC-002 MAJOR | Full artifact's adjacent borrowed read/complement/store19/27; `machine/lower-register-forwarding.ts:63–110`.                                                                             | Read/complement/final-store7/11 saves12/16 where the sole-use register and flag facts permit it. Only the byte whitelist above is proposed.                                        |
| MC-003 MAJOR | Full key guard's Boolean construction/copy/reload40 bytes/34 nominal valid-path cycles; `semantic/lower-control.ts:209–259`.                                                             | Direct condition branches and shared uncertain return10/8 save30/26 for the measured same-page path. Right-side bypass and escaping-value behavior remain independent oracles.     |
| MC-004 MAJOR | Full inner borrowed-row address/read41/59; existing byte-ordinal owner `machine/lower-aggregate-place.ts:224–285`; guard facts in `semantic/guarded-place-proof.ts`.                     | With an already proved unsigned maximum below256, the current full-carry address family is20/29, saving21/30. Source word updates/loop headers remain unchanged.                   |
| MC-005 MINOR | Full acquisition's absolute-indexed return-copy tail21/204, with an unused source-pointer setup; existing `machine/lower-aggregate-return.ts:255–357` delegates to packed-copy lowering. | Removing only that setup gives13/194, saving8/10, if no existing observer needs it. No aggregate destination/lifetime/alias expansion follows.                                     |

Measurements exclude asynchronous interrupts, ROM work and VIC stalls; they
are local instruction-derived alternatives, not newly assembled or executed
replacement qualification. The actual query bodies alone total2,106 bytes,
so compact startup or the field change alone cannot satisfy the963-byte full
limit. All original complete resident/ZP/stack/timing limits remain binding.

Artifact identity: full PRG SHA-256
`c44cf63cbbe08480b540a0d9d8abddaf0bc9a5a60a04f576c1294edd27fb4450`;
ordinary Pair PRG
`f6d1c2c7e780054fed01fbdfd4db87d4dfc5daa75165bf9ea889562ffab6fb5b`.
Qualified reference PRGs remain the current final fast963, small877 and saved725
artifacts, not older similarly named files. Their SHA-256 identities are
`735b4d3731b17f061672e0b169b96c1713605529f9a86932539725fa9b018c1c`,
`f68adba108bea487b541d607aedaf7c7584f8b29522d599acea67f50df333908`
and `c2b60a738240a4c5fbea375ffb3dfea5743319dc6d8b50e245d064f809984f4f`.

**Best option:** approve this narrowed four-consumer batch, with separate
qualification for each selection. It addresses measured generic compiler
defects without a decoder workaround, general optimizer or weakened budget.
The strongest objection is that the exact whitelist may still leave output
waste needed to reach the complete limits. A new mechanism is not silently
authorized if remeasurement reveals that gap; it needs its own bounded evidence.

**Confidence: Medium** for complete-budget sufficiency; high for the measured
local defects. **Hardening: changed** — broad expression completion is excluded.
**Challenger: converged on narrowed scope.** No final parity, full phase review,
frozen/protected edit, RED commit or push is authorized by this bounded approval.

Execution order after approval: adjacent byte delivery, branch-only conditions,
already-proved index-bound consumption, then eligible constant-field selection
and the conditional unused copy setup. Root implements tightly coupled changes
inline. Independent concern-specific specification authors receive only approved
contracts and existing public test helpers, not production implementation. Each
unit is RED first, then implemented, verified and independently reviewed where
its risk requires it. This sequencing adds no mechanism or task-count inflation.

## AR-P26 — remove the reviewed byte-chain waste at the existing append owner

Status: **Resolved and locally qualified — ordinary necessary compiler correction
under standing approval; complete input/phase qualification remains pending.**

The byte-delivery output review finds a remaining MAJOR local parity defect:
`(~x & $7f) ^ $20` emits EOR/AND/EOR,13 bytes/20 nominal cycles for a complete
absolute-read/fixed-store leaf. The equivalent AND/EOR leaf is11/18. The original
13/20 delivery oracle proves staging removal, not the expert floor; it stays
unchanged. No complete-input budget is relaxed.

**Best option: Simplify.** At the existing instruction append owner, collapse
only three adjacent official byte-immediate EOR/AND/EOR instructions:
`((x ^ a) & b) ^ c == (x & b) ^ ((a & b) ^ c)`. Retain the surviving AND source
and final EOR source. No read, write, call, flag observer, block or guard can
intervene. Immediate instructions have no memory effects; final A/N/Z agree,
C/V/I/D/X/Y/SP are unchanged. No transform state, new pass, IR, runtime, storage,
dependency or public surface is needed. Broader algebra catalogs are excluded.

The independent challenger inspects the actual append owner and returns
**Simplify**, ordinary necessary correction rather than material support code.
Its strongest objection is real: shortening three instructions to two leaves
the list length unchanged while appending the final source operation. The
existing length-based emission-site recorder would omit that operation and its
IRQ-analysis site. Record actual selected emission directly at this same owner,
independently of net list length; preserve source/lifetime/storage closure.

The user's 2026-10-11 standing approval for compiler/code-size corrections,
combined with prime directive4, resolves this routine technical choice without
another interruption. A wider support mechanism or protected/frozen edit still
requires its exact normal gate. No `--auto-design`, cost waiver or push follows.

New blind-authored output/native specifications own two nontrivial masks,
complete fixed-store11/18 and parameter-return8/14 bounds, exhaustive256-byte
results, ordered volatile accesses, saved/multiuse/call/word fallbacks and I/D/SP.
All24 static cases are RED after successful public builds before implementation.
After the bounded repair, all188 new and unchanged byte cases, including eight
new sequential native cases, pass. Private35 and independent correctness,
SFA/ABI and actual assembled-output reviews pass. Original hashes and RED/GREEN
logs are recorded in the journal. **Confidence: High. Hardening: converged on
Simplify.** Complete input costs and final phase reviews remain due.

## AR-P27 — close the existing ordinal selector and layout consumers

Status: **Resolved under standing approval — ordinary bounded corrections;
immutable output/native qualification remains due.**

The independent output audit finds four residual defects in the retained
ordinal artifacts: upper comparison36/50 versus29/41; identity mask23/37 versus
21/35; adjacent offset53/72 versus38/51; and equal-bound join61/61 versus a
bounded42/48 candidate. The original32 output cases remain RED and unchanged.

**Best option: reuse the current owners.** Branch-only unsigned word128/256
comparisons select existing Z conditions. Remove identity operations only when
the surviving instruction owns their consumed flags. The existing adjacency
matcher may select a nonwrapping word addition's low byte only for its sole
next instruction-producing stride-one consumer with that exact access's
already proved maximum below256. The word representation/home remains intact;
checked retention and all unknown/wider/signed/intervening cases keep fallback.
The proved adjacent ADC's zero carry may feed address formation only while it
actually remains live. No general producer/block range knowledge is published.

Existing block ordering may follow cycle-safe instruction-empty aliases and
defer a shared continuation behind an unplaced sibling, preserving every label,
origin, real guard, reject body and existing branch-repair owner. This is not
terminal merging, a new CFG stage or a general graph solver. Mechanical
comparison-module extraction keeps the existing selector contract and reduces
the oversized scalar file; it adds no compiler stage or public API.

The independent minimum-design challenger returns **A / ordinary correction**
for every inspected seam. Its strongest objections are accidentally promoting
an access fact into a general producer guarantee and expanding empty-alias
scheduling into general CFG optimization. The exact identity/adjacency/flags/
cycle boundaries above are mandatory. It independently adds the smaller
`(low & $80) | high == 0` comparison candidate. **Confidence: Medium** until
fresh complete assembled costs and native behavior pass; **Hardening: converged**
on these boundaries. Expert2.0.4/content0e2a6280 governs; no qualification answers
were inspected. New machinery, frozen/protected edits and budget waivers remain
outside approval. Equal/mixed join factoring and constant-local promotion are
separate measured expert debts, not silently qualified by these ceilings.

## AR-P28 — combine the existing opaque pointer copy and constant offset

Status: **Resolved under standing approval — ordinary existing field-consumer
correction; independent specifications must precede implementation.**

**Best option:** simplify the current full16-bit fallback itself. For a borrowed
base plus a fixed nonzero offset, read the base low byte, add the constant low,
store the effective low, then read/add/store the high with carry. The current
code first copies both base bytes to the pair and then reloads that pair for
the same addition. Those overwritten private stores/loads are unnecessary.

This is not the conditional borrowed-base/Y optimization. Form exactly the same
full effective pointer and use Y=0 for the final byte read. Keep high offsets,
16-bit carry/wrap, parameter homes, pointer identity/lifetime, original source
types, exactly one source read and all MMIO/alias/interrupt obligations. No RAM
assumption, provenance/availability fact, cross-block forwarding, new pass/IR,
runtime, solver, layer or dependency is added. Unknown/indexed selections retain
their ordinary address family. No frozen/protected test or budget edit follows.

The ordinary Pair witness's opaque second-byte leaf currently28/45 can be20/33
without a changed bus footprint. The cheaper15/27 borrowed-base/Y candidate
remains conditional and unqualified. Root uses the user's compiler/code-size
standing approval for this routine technical choice, not authority for new
support machinery. New concern-specific public output/native oracles are
authored blind; the static oracle must be meaningfully RED before production.
Private tests and independent correctness/SFA/output review follow GREEN.

Before its output oracle is written, the blind author independently corrects
root's nominal-cycle sum35→33: direct low/high addition costs20 cycles and the
Y-zero read/RTS costs13. Root verifies the instruction costs and strengthens the
contract to20/33. The saving is8 bytes/12 cycles, not8/10. No existing test or
expectation is edited; the stronger oracle is authored first.

## AR-P29 — keep a sole branch-only Boolean negation as a condition

Status: **Resolved under standing approval — ordinary current scalar/condition
consumer correction; independent RED-first specifications precede code.**

**Best option:** when `!value` is used only by its immediate branch, return the
existing zero condition instead of constructing a Boolean byte and immediately
testing it again. Only an actual current load or explicit compare establishes
the zero flag. An ordinary one-byte direct-call result may remain in A for its
sole adjacent Boolean-negation consumer, but the consumer must explicitly test
A; a call's returned value does not establish its flags. Existing single-use,
same-block forwarding and branch/materialization guards own the decision.

Preserve one call, argument/effect order, exact Boolean meaning, source types,
interrupt-domain and SFA closure. Escaping/multi-use/materialized negations,
intervening effects, cross-block uses and other scalar/call forms retain their
existing fallback. No interprocedural callee-flag proof, new fact model, stage,
IR, storage mechanism, runtime, API or protected/frozen edit is added. This
ordinary reduction is covered by the user's compiler/code-size approval; it
does not expand AR-P25's unrelated byte-bitwise whitelist.

Blind public output/native cases must prove both Boolean inputs, deliberately
disagreeing call-result flags, exact call/effect counts and stable I/D/SP. Charge
the complete leaf and its unchanged callee separately; private boundary tests
and independent reviews follow GREEN. Complete input budgets stay unchanged.

Before output authorship, the blind author independently derives the ordinary
absolute-parameter leaf11 bytes/14–15 nominal cycles and direct-call wrapper
13/18–19 excluding the separately charged callee. Root's initial16–17-cycle
wrapper estimate omitted the required two-cycle A test and is corrected now;
no returned-flags guarantee or existing oracle is changed.

## AR-P30 — strengthen the exact short-offset output oracle

Status: **Resolved — the user reaffirmed standing approval after the exact
two-file correction packet. Only the stronger one-file exception below applies.**

Independent output review finds a19-byte/33-cycle short-offset leaf versus the
current20/33. For a fixed offset1–255 with no runtime index, initialize the
already-required Y=0 first; add the low offset into the effective pointer; use
TYA to obtain zero without losing carry, then ADC the original high byte.
The same low/high source reads occur once in order, the full pointer is formed
before the sole indirect read, and Y remains zero. No RAM provenance or indexed
dummy-read assumption is introduced. This analytical candidate is not yet
assembled/native qualified; independent stronger oracles must precede code.

The existing `source-library-fixed-offset-output.spec.test.ts` pins the old
20-byte sequence and final LDY position, so a stronger supplemental test alone
cannot permit this correction. **Best option:** approve only this one-file
exception: add official TYA decoding; replace only offsets1–255's exact sequence
and tighten their byte ceiling20→19; require their Y=0 setup before arithmetic
and unchanged final read/RTS; count their high source read through ADC rather
than LDA. Keep zero/high offsets,33-cycle ceilings, all programs, homes, source
read order/count, pointer-only stores and all native/negative assertions unchanged.
No frozen spec, other existing test, general clobber proof or cost waiver changes.

## AR-P31 — select a one-byte A test before direct constant byte returns

Status: **Resolved under standing approval — bounded existing branch-consumer
selection; blind RED-first specifications and independent reviews required.**

The independently retained AR-P29 wrapper is13 bytes/18–19 nominal cycles,
excluding its separately charged4-byte/10-cycle callee. A one-byte TAX or TAY
can independently establish Z from the returned A in the same two cycles.
Its exact two branch continuations each only load an immediate byte and return;
neither observes the transfer register, and the byte-return ABI promises A only.
This local12-byte/18–19-cycle candidate requires no callee-flags assumption.

**Best option:** select it only when the existing function owner proves both
direct source successors are single constant byte-result returns, with no other
operations, merge, outgoing register use or startup return. Reuse the owner's
existing block index for bounded direct lookups; do not add a liveness pass,
state/fact cache, CFG traversal or selected-callee clobber solver. Pass this
single local eligibility result through the existing operation/unary consumers.
Absent or ineligible context keeps the explicit CMP#0 fallback. Fresh loads
still use their own Z; source/effect order, all homes and closure are unchanged.

The old AR-P29 decoder already supports official TAX/TAY and its ceilings are
upper bounds, not an exact CMP shape. A new stronger12-byte oracle can coexist
with that immutable oracle. All old specification hashes stay fixed. New blind
output/native cases cover arbitrary nonzero Boolean bytes, deliberately
disagreeing callee flags, normal source effects and conservative continuations.
No general X/Y availability promise or protected/frozen edit follows.

Pre-implementation SFA review identifies the whole-route cost boundary:
introducing the first X clobber in a selected NMI route adds one stack byte,
four wrapper bytes and11 cycles. The bounded selection therefore excludes
`interruptDepth.domain === "nmi"`; numeric NMI ownership depth alone is not
execution membership, because retained helpers normalize it to zero. Existing
main/IRQ/NMI labels already differ for these returning byte leaves, so the guard
does not introduce another physical variant. NMI retains its old CMP form;
actual transitive clobbers still reach wrapper construction before closure.
No new NMI runtime proof is claimed by this ordinary-mainline oracle.

Local qualification now passes: public44 (including24 sequential VICE), private42,
compiler2,077 with two existing skips, build/typecheck and independent correctness,
SFA/ABI and actual-output reviews. MC-010 is resolved for this exact scope. The
retained wrapper is12/18–19; including its unchanged callee is16/28–29. Diagnostic
payload677→676 and resident730→729; the complete input PRGs remain byte-identical
to the preceding endpoint. Existing #79 retains the separately scoped inlining
path to a whole-program win. AR-P30/#106 and all whole-library gates stay open.

## AR-P32 — reuse the existing count bound at a byte-shift consumer

Status: **Resolved under standing approval — ordinary bounded existing-consumer
selection; independent RED-first oracles and review precede qualification.**

The existing byte-result variable-shift selector always reads a word count's
high byte and branches to saturation, then compares its low byte with8. The
existing unsigned ordinal resolver already proves nonnegative inclusive maxima
from masks, value-preserving conversions and actual reaching guards. A maximum
below8 makes both saturation tests and their unreachable fill body redundant.

**Best option:** include a variable shift's exact count identity in the same
per-operation bound handoff already owned by `lower-bounds.ts` and the existing
`guarded-place-proof.ts` access collection. Both currently return only indexed
place identities; add the exact shift-right identity without changing any
transfer, comparison refinement, join or invalidation rule. At the existing
byte-result consumer, skip only the high-byte test, CPX#8/range branch and
unreachable saturation body when that exact fact proves0..7. Retain count-zero
handling, the complete signed/logical loop, original operand evaluation and
effect order and declared operand widths/homes. Result retention is unchanged
except for an exact sole terminal byte return, which reuses the existing
register-forwarding decision before storage closure. Unknown, negative,
wide or invalidated bounds keep the old saturated fallback. Word-result shifts
and register-held word-count fallbacks are outside this correction.

This is another consumer of the existing proof, not a new proof model or a
producer-wide range. No new pass, recurrence/liveness solver, cache, IR kind,
runtime, source/API restriction, dependency, shared harness, startup change or
protected-test edit is permitted. Existing guarded-bound invalidation remains
unchanged; captured immutable values and later mutable reloads stay distinct.
Independent behavior covers0/1/7 and wide fallback counts8/255/256/65535,
unsigned/signed results, source mutation/effects and count homes. Output proves
the bounded loop's actual bytes/cycles and the absence of saturation/high-count
work, while charging complete surrounding artifacts separately. Complete input
and phase budgets remain binding; this local selection is not a parity waiver.

The independent15/17-byte core floor also exposes a private result store/reload.
The smallest necessary companion change is to admit a byte shift's result to the
existing forwarding set only when it has one use, no following emitted operation
in the same semantic block, and that block directly returns this exact value.
This retains A through the already selected loop/continuation and elides its
otherwise redundant temporary before closure. No consumer traversal, register
availability state, general shift-to-store forwarding or callee/caller change
is added. All other result lifetimes keep their existing homes. This ordinary
existing-consumer correction uses standing approval, not another task/effort
pause, and is covered by the independent complete behavior/output oracles.

Output review finds two further ordinary defects in these same consumers.
For a proved bounded count and two private storage operands, load A before X
and use the fresh LDX zero flag; never reorder labels, deferred volatile reads
or live registers. For an exact sole adjacent byte/word AND-mask count proven
0..7, extend the existing mask-to-ordinal forwarding whitelist to this byte
shift. Its existing zero-extended low byte may remain in A until TAX; loading
the left operand afterward still requires an explicit count-zero test.
Genuine register-held word/AX counts retain their fallback. No general X
availability, conversion forwarding or cross-block guard reuse is introduced.
Standing approval covers these bounded remedies. A new blind whole-masked-leaf
oracle precedes production; old limits and native expectations stay unchanged.
The separate complete guarded-leaf register-reuse/layout debt is not waived.

The same whitelist also owns MC-014's exact unsigned scalar word-mask→single
byte truncation→byte-shift window. Both results have one use, and the next
emitted shift has its own exact0..7 count bound. The mask's byte-valued low A
survives that value-preserving conversion; existing conversion lowering and
preplanned staging remain authoritative. Signed/wider/other conversions,
additional uses, barriers and different consumers retain storage. This bounded
remedy introduces no general conversion or cross-block register model. The new
blind ST-34 oracle reaches16 meaningful RED cases before production; qualification
passes144 public and10 private cases with unchanged old oracles. The full input
budgets and the separate guarded-leaf debt remain open.

## AR-P33 — charge synthetic control instructions in the bounded-shift observer

Status: **Resolved — the user reaffirmed standing approval after the exact
two-file correction packet. Only this observer correction applies; meaningful
output RED still precedes AR-P32 production.**

The unchanged-production static run has80 observer failures and eight passing
unknown-count controls. Every bounded case fails before measuring the proposed
optimization: `cia2OperationGroups` requires continuous narrow source ranges,
but valid shift branches and return bridges carry the enclosing function's
source span. This is not evidence that the intended optimization is missing.
Do not change compiler source-origin semantics to make this observer pass.

Published raw proof: masked-word generation
`ebc27974-23e0-444e-a1b9-53de928cecb7`, build JSON SHA-256
`d3165cd2ee32e097e93b3afdf86cdcbb1f0bb8260cc1f70b824371993b25b4b9`,
places the42-byte function at2422–2464. Its exact shift ranges are separated
by function-origin branch/return ranges. Guarded-word generation
`778f98fd-083b-493d-88aa-c171cf42dcd5`, build JSON SHA-256
`2eb411fcd06131d76c39cd7faea84f09a4e10b1cf6a4df80059e4318df26af31`,
shows the same control gaps; its source guard and false-return arm precede
the shift's interval and remain separately charged complete-function bytes.
Both unmodified assembly artifacts also show a private result store/reload;
removing count checks alone will not meet the independent15/17-byte core floor.
This observation does not authorize an oracle ceiling increase.

**Best option:** change only
`test/rd05/source-library-bounded-shift-output.spec.test.ts`'s local region
observer. Remove its `cia2OperationGroups` use, retain `cia2FunctionVariants`,
and pass the published function/variant indexes into `shiftTail`. Select only
that physical variant's raw ranges with the existing minimum-containing-source
span rule. Validate selected range endpoints against the complete decoded
function's instruction boundaries. Charge every instruction between the first
and last selected endpoints, including all intervening control/bridge bytes;
retain private-count and complete-return boundary handling. Reject an interval
that contains separately source-owned guard/false-arm code with an explicit
observer-boundary error rather than silently excluding or undercharging it.

Preserve all88 programs, numeric behavior and saturation assertions, the
15/17-byte and existing cycle ceilings, no-high-count/no-fill checks, parameter
homes, complete prefix/artifact accounting and eight unknown-count controls.
The native oracle stays byte-identical. No shared helper/harness, production
debug metadata, frozen authority, source restriction or cost waiver changes.
After this exact exception, establish meaningful RED before AR-P32 production.

Authority clarification: after the exact AR-P30/AR-P33 packet, the user asks
“didn't I specifically ask you not to stop for trivial approvals?” This
reaffirms the preceding explicit approval of known-best compiler/code-size
corrections and the workflow directive that compiler/plan decisions are made
without another prompt. The parent corrects its unnecessary pause. These two
bounded changes strengthen or repair measurement without relaxing requirements;
no budget waiver, new support mechanism, frozen authority edit or unrelated
test exception is inferred. Their exact diff and new RED/GREEN evidence remain
subject to independent review.

## AR-P34 — retain the checked count in the exact guarded-shift leaf

Status: **Resolved under explicit standing approval for known-best compiler/code
size corrections and the Prime Directive's compiler-owned decision rule.**

Output debt [#107](https://github.com/blendsdk/blend65/issues/107) measures one
byte/three cycles of unnecessary guard-to-shift reload/layout work. The new
implementation-blind ST-35 complete-leaf oracle reaches32 meaningful RED cases
at23/25 byte-count bytes and28/30 word-count bytes versus22/24 and27/29 limits.
SHA-256 `9fe1df9b3b2606b9c0005ddf3310b70173c3f26facd03daf5dbc410cb03af11a`.
No old oracle or cost limit changes. Complete-path cycle limits remain analytical
in this supplemental byte oracle; immutable native/core cases supply separate
behavior/ABI/effect expectations, and output review audits final actual paths.

**Best option:** select the exact pure guarded-shift machine pattern locally,
before function storage closure, using its existing structured blocks and typed
private parameter homes. The ordinary byte-return leaf has a terminal unsigned
parameter comparison with8, a sole direct success edge into the bounded byte
shift's existing empty low/zero blocks, its exact shift/DEX loop and direct RTS,
and a constant byte-return rejection arm, either direct or behind the frontend's
one instruction-empty jump. The guard must be the entry and the function must
contain exactly those seven/eight blocks; no unrelated prefix/suffix is selected.
The function owner supplies its already-identified source metadata, avoiding a
second source-function scan. Every other predecessor, instruction,
effect, representation or return contract keeps the existing selection.

Load the count into X while checking it. Word counts reject nonzero high bytes
first. Keep that same X over only the direct success edge and its one private
value load; use explicit CPX#0 after that value load. Orient rejection branches
so the successful path falls through. No generic cross-block register model,
new proof solver, pass/IR kind, runtime, API, source workaround or late home is
added. A small focused machine-selection helper keeps the existing700-line
function owner from absorbing the matching logic; it is not another compiler
stage or framework. Startup/NMI domains and nonmatching functions stay unchanged.

The decision is compiler-owned and reversible; it changes neither product scope
nor a source/resource guarantee. The user's explicit auto-approval applies to
this bounded remedy, so no routine confirmation is requested. Independent
correctness/SFA/output review and unchanged whole-input qualification remain due.

## AR-P35 — exact guarded-shift measurement exception (runtime)

Status: **Resolved — exact user-approved instrumentation exception implemented;
176 unchanged public cases and independent correctness/output review pass.**

The user explicitly approved the preceding exact proposal with “Do apply”. The
approved edit is restricted to `shiftTail` and its sole call site in
`test/rd05/source-library-bounded-shift-output.spec.test.ts`. Every program,
behavior assertion and byte/cycle limit is preserved. The exact pre-edit file is
retained as `ar35-observer-before.ts` in the existing Git-metadata evidence root,
SHA-256 `220895fb7b91d474102f673d295c3d3676b08ef145f374b6ea7eed1dac5beede`.
This prospective baseline does not recover or waive AR-P33's historical Unknown.

AR-P34 passes the new unchanged32 complete-function byte cases and all eight
existing native groups. The combined176-case run has144 passes and32 old observer
failures: `shiftTail` requires an index-register load inside the source shift hull,
but the fixed private-count guard now supplies X before that hull. No generated
source origin is changed to satisfy the observer. All five oracle hashes remain
unchanged. This is not a meaningful behavior/cost regression, nor a GREEN result.

**Best option:** change only the measurement boundary in
`test/rd05/source-library-bounded-shift-output.spec.test.ts`. Keep every source
program, fixture, source span, decoder, execution/value/carry assertion, negative
case and byte/cycle limit unchanged. Existing tail discovery remains the first
choice. Only when a guarded case has no shift-local index load may its source-owned
CPX#0 begin the tail, after certifying the exact preceding published prefix against
the existing declared count/value homes: LDX count/CPX#8/BCS/LDA value, optionally
preceded by LDA count+1/BNE for a word. Both rejection branches must target the
same constant-return arm outside the tail. Immediate/indexed loads, any other
prefix or missing source-owned coverage reject measurement. The existing complete
function accounting and new32 whole-leaf caps remain binding; no uncharged byte or
executed cycle, new observer framework or cost waiver is permitted.

This is a narrow instrumentation repair, not a language/specification change.
Independent measurement review found the fixed-prefix approach viable; authority
clearance is not inferred from that opinion or from the standing general approval.
The repository's exact immutable-test exception gate caused the preceding pause;
the explicit approval now permits only the bounded edit above.
The historical AR-P33 text-integrity Unknown remains separate and unwaived.

The exact edit qualifies all176 public cases, including eight sequential VICE
groups, with zero skips. Typecheck, targeted formatting, whitespace and frozen
specification checks pass. A byte projection proves everything outside the two
approved edit regions unchanged; all four companion oracle hashes are unchanged.
Independent correctness and output reviewers report no findings and clear only
this exact exception. Complete-input budgets remain RED, not waived.

## AR-P36 — return a comparison predicate through existing condition edges

Status: **Implemented under standing approval —48 public/44 private cases pass;
bounded correctness/SFA clear, output review identifies a smaller return idiom.**

**Best option:** let the existing semantic return owner use `lowerCondition`
for an unconverted runtime comparison or an `&&`/`||` tree whose leaves are
unconverted runtime comparisons. Two existing constant Boolean return arms
replace materialization, merge/copy and immediate reload work. This uses the same
condition edges and return ABI as an ordinary source `if` with two returns; it
adds no pass, IR kind, solver, fact model, storage mechanism, runtime or API.

The retained full-artifact sole-source routine is104 bytes and contains repeated
comparison-result stores/reloads and a logical merge solely before return:
`phase2-full-output-probe/out/0cb38b42-5921-4868-958e-800280e4dea3/.asm`
lines413–477. Current owners are `semantic/cfg.ts:255–265` and the existing
`semantic/lower-control.ts:217–256`. This local defect does not prove that its
repair suffices for the unchanged963/725 complete-input ceilings.

Keep expression effect order, one evaluation, right-side bypass and original
comparison semantics. A Boolean's language truth is zero/nonzero, not a general
canonical-byte promise. Raw Boolean names/calls, arbitrary logical leaves,
constants, conversions, stored/multi-use values and non-Boolean/aggregate returns
retain their existing representation paths. Do not invent caller, provenance,
flag, range or interrupt facts. Existing SFA inventory/closure sees the chosen
CFG before emission. No old oracle or frozen specification edit follows.

The user's explicit compiler/code-generation standing approval covers this
routine smaller consumer route. It is not new support-surface authority and does
not widen the unrelated arithmetic/bitwise forwarding whitelist. Independent
public tests freeze complete11-byte/15-nominal-cycle direct byte-zero predicate
and16-byte/21-cycle ordered two-read predicate idioms, accounting actual taken
branch page penalties. Native cases verify truth, short-circuit reads, exact raw
Boolean preservation, no input writes, SP and I/D. All48 public and44 private
cases pass, as do2,116 compiler cases with two existing skips and build/typecheck.
The sole-source routine shrinks104→64 code bytes; full placement saves another216
padding bytes. Complete full/saved2,442/2,271 still exceed963/725. Output review
identifies redundant freshly-zero loads and duplicated RTS in11/16-byte leaves;
the8/13-byte candidate requires its own stronger RED-first oracle and fix review.

## AR-P37 — keep a directly proved zero return and share the ordinary RTS

Status: **Implemented and locally GREEN under standing approval —60 public,
46 private and2,138 compiler cases pass; bounded independent review clears code.**

**Best option:** in the existing machine function owner, remove a constant-zero
return load only when every direct incoming edge tests Z immediately after an
instruction which sets A and N/Z together, and reaches that return only for Z=1.
An unconditional, aliased, missing, unknown or nonzero incoming edge rejects the
rewrite. No predecessor traversal, flag availability, range solver or new facts.
Keep the scope to an ordinary Boolean function's two single-instruction0/1 return
arms; startup/aggregate/raw returns stay unchanged. Preserve all reads, calls,
stores, source labels, ABI and non-result flags. A neighboring constant-one arm
may reach the emptied ordinary RTS through the existing fallthrough edge and
block-order owner. No function storage is added, and selection precedes closure.

Grounding: retained `ar36-predicate-actual.json` shows direct inequality11 bytes
and conjunction/disjunction16 bytes. The CPU-equivalent canonical0/1 forms are
8/13/13 bytes, at most14/20/20 nominal cycles respectively, with actual taken
branch page penalties charged separately. Existing owners are
`machine/lower-register-forwarding.ts`, `machine/lower-function.ts:697–707` and
`machine/block-layout.ts:136–204`. This is an ordinary local terminal correction
covered by standing compiler/code-size approval, not permission for a general
support mechanism. Keep all earlier oracles immutable and freeze a new stronger
public output file before meaningful RED. Native/effects regressions and bounded
independent correctness/SFA/output review remain mandatory. Whole963/725 ceilings,
100million-cycle bound and historical-integrity Unknown remain unchanged.

The stronger oracle had12 meaningful RED failures before code and remains
SHA-256 `3bb8a06abb664a291157ebc84edf131d304d32627b15f987d12bffee51b8966f`.
All60 public cases now pass, as do46 directed private cases,2,138 compiler cases
with two existing skips and fresh build/typecheck. Independent correctness/output
reviews have no findings; output clears exact MC-0158/13-byte leaves. The final
bounded SFA/ABI review also reports no findings. Same-source
actual PRG bytes match8/13/13-byte expert idioms; no whole artifact saving follows.
Full2,442/963 and saved2,271/725 remain RED. Local meet's measured4-byte/12-cycle
eligible call-elimination route is owned by [#108](https://github.com/blendsdk/blend65/issues/108),
not silently settled or implemented as a new framework. No phase GREEN or push.

## AR-P38 — whole-input cost closure exceeds the current proof boundary (runtime)

Status: **Scope/mode approved — prerequisite planning/preflight is in progress; complete output remains unqualified.**
Category: **Technical (complexity escalation)**. Owner: root, within RD-05;
roadmap dependency: DEF-16. This records a boundary, not executable authority.

All fifteen original input specification files have now been rerun at the same
production endpoint:76 behavior cases pass and12 complete-size cases fail.
Saved-simple passes all four profiles at the original100-million-cycle limit,
with4,356 observations and322,344 answers. The separate72-case behavior run
passes without skips in1,905.34s. Full/saved payloads remain2,442/2,163 bytes
against963/725, leaving1,479/1,438-byte deficits. No numeric limit is waived.

The required independent emitted-output audit finds no existing-facts correction
which closes those deficits. It is an output audit, **not** a design-challenger
verdict. Its exact residual findings and corrected659/699-byte startup/restore
accounting are in the [execution journal](99-execution-plan.md#whole-input-residual-output-audit).
The659/699 includes allocated-ZP preservation, unlike the609-byte base figure.

| Required approval evidence         | Current bounded proposal / limit                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original goal                      | Finish ordinary-source keyboard and both-port joystick input with the unchanged complete expert-output limits and safe normal return.                                                                                                                                                                                                                                                                                                    |
| Extra system or support code       | A possible compile-time proof that a borrowed object stays in safe RAM across every relevant direct call. It would be consumed by the existing borrowed-field selector; any startup use needs its own complete display-independence proof. Current facts do not provide this proof. No code or new certificate is added.                                                                                                                 |
| Why it may be needed               | Current unknown-pointer fallbacks retain full address formation and full startup ownership. AR-P25 explicitly excludes a new interprocedural provenance proof, and AR-P23 requires existing facts or fallback. Additional local idioms do not explain a complete route to the remaining size limits.                                                                                                                                     |
| Evidence                           | Actual whole artifacts and all12 unchanged size failures; `machine/lower-aggregate-place.ts` retains full-carry borrowed addressing; `machine/lower-startup.ts` keeps conservative unknown-borrow/raw-write fallback. The independent audit confirms the missing observer fact for earlier word-local writes as a separate boundary.                                                                                                     |
| Smallest solution that still works | **Not yet proved.** Candidate scope is only known typed whole-object arguments and their direct parameter forwarding, with conservative fallback for unknown pointers/effects. A fresh whole-input cost-closure design must establish sufficiency and the exact minimum modification set before proposing implementation. Do not invent a general pointer solver, optimizer pass, inliner, register model, runtime or source workaround. |
| Extra cost                         | At least a semantic proof owner/handoff, its existing machine consumer and independent behavior/cost tests would be affected if that candidate survives. Exact files, proof rules, maintenance cost and actual whole-artifact benefit remain unqualified; they must be fixed by the named design before approval becomes executable.                                                                                                     |
| Independent verdict                | **Unavailable: current execution-run challenger budget exhausted.** The output auditor cannot replace that independent complexity review. No approval or general continuation can waive the missing verdict.                                                                                                                                                                                                                             |
| Direct user decision               | Pending. Standing routine-fix approval is preserved; it does not authorize this new support surface. Recommended next decision is a separately named **whole-input cost-closure design/preflight** task, not implementation of an unspecified proof.                                                                                                                                                                                     |

The pure bitwise and dynamic-shift store findings remain owned necessary
corrections, not waived. They need exact source-use/flag eligibility and new
independent oracles before code; their analytical savings are not counted in the
current artifact. Earlier low-byte word writes remain non-executable without
observer proof. No direct-call RAM assumption or selected-address guess is made.

Affected tasks2.2.2–2.2.6 and2.2.8 are visibly blocked; four2.3 tasks remain
pending. Progress stays38/48 and RD-05 remains open. Frozen spec/expert authority,
old oracles, historical pre-AR-P33 integrity Unknown and all complete output limits
are preserved. A fresh named design is a real additional scope decision, not a
budget reset inside this execution run.

**Best option:** start that narrow design/preflight, measure its whole-input
benefit and obtain the required independent complexity ruling before adding
proof machinery. **Confidence: Medium** for the eventual sufficient design;
high for the current measured deficits. **Hardening: changed** — byte idioms and
same-local identity alone do not establish cost closure or observer safety.
**Challenger: budget exhausted.** No phase clearance, commit or push.

### Authorized design continuation — 2026-10-11

The user answered **“you may”** to the separately named whole-input cost-closure
design/preflight. Its [incremental decision owner](../whole-input-cost-closure/00-ambiguity-register.md)
preserves all original programs, numerical limits, behavior and frozen authority.
This is a genuinely new design run, not an execution-budget reset or permission
to implement an unspecified RAM proof.

Discovery confirms that RAM identity alone does not explain a sufficient route.
The new independent blind verdict is **Simplify**: bring forward only a bounded
RD-08 optimization slice rather than putting optional transformations in `none`
or adding a general optimizer. The complete candidate and exact protected-test
mode reconciliation remain analytical and pending the new register's AR-P4
decision. The old execution cap remains exhausted; independent design analysis
does not clear that execution or replace final preflight.

All 76 original behavior cases remain GREEN and 12 complete-size cases RED at
the retained endpoint. Six tasks stay blocked, four pending and progress 38/48.
No compiler/library/test edit, phase clearance, RED commit or push follows.

**Direct scope ruling, 2026-10-12:** user **“i approve”** answers the sole
whole-input AR-P4 packet. Its bounded early RD-08 families and exact test-mode
exception are now approved; the [prerequisite plan](../whole-input-cost-closure/00-index.md)
owns implementation after preflight. AR-P25/ST-23 are amended only for explicit
size-mode whole-output qualification. Original none behavior and every resource,
timing, source and platform contract remain. Historical execution-cap and
pre-AR-P33 evidence limits are not reset or re-cleared. Parent progress stays
38/48 until actual original-file qualification and its pending closeout pass.
