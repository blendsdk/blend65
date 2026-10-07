# Ambiguity Register: remaining CIA2 ownership

> **Status**: Complete — approved AR-P1–AR-P12 implemented and qualified within the bounded slice
> **Last Updated**: 2026-10-07
> **CodeOps Artifact Schema**: 1

## Planning boundary

| Boundary         | Scope                                                                                                                                                                                                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Target           | Finish the remaining `blend65-v4/RD-05` CIA2 ownership work on the four existing cooperative PRG profiles. The user confirmed xhigh for the named assessment, planning, implementation and verification batch on 2026-10-06.                                                                                                                                       |
| Context          | Frozen Specification 4, qualified expert 2.0.3/content `22cc5f00`, RD-05 R5.15–R5.18/R5.20, completed stock-chained NMI and CIA1-return plans, existing CIA2 API, primary MOS 6526 and pinned Commodore KERNAL source.                                                                                                                                             |
| Modification set | This register and the feature roadmap's derived next-work pointer during discovery; a bounded executable plan only after the contract gate. Compiler changes and new tests follow the settled contract and specification-first ordering. AR-P3 authorizes only its three exact old-oracle changes. Frozen specification and expert-skill changes remain forbidden. |

## Decisions

| ID     | Category                                                        | Question                                                                                                                                                | Authority / disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Status      |
| ------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| AR-P1  | Scope / effort                                                  | Which work and effort are confirmed?                                                                                                                    | User: “xhigh is confirmed. Finish it.”, replying to the named remaining-CIA2 batch. Keep keyboard acquisition, raw/takeover profiles, a general optimizer and game policy outside this batch.                                                                                                                                                                                                                                                                                   | ✅ Resolved |
| AR-P2  | Source behavior / integration — sensitive                       | Which entry, event and final-release contract is intended for an application-owned CIA2/NMI epoch?                                                      | User: “I approve”, accepting the explicit ownership, idle-entry and shutdown contract presented on 2026-10-06. The detailed contract below is approved; proof remains required.                                                                                                                                                                                                                                                                                                 | ✅ Resolved |
| AR-P3  | Exact existing specification-test exception                     | How may the two temporary blanket-exclusive rejection fixtures and the corresponding ledger row change when positive ownership is qualified?            | User: “Yes, approve this exact three-file exception”, in the asynchronous reply on 2026-10-06. Only the changes below are authorized; ledger retirement still requires full qualification.                                                                                                                                                                                                                                                                                      | ✅ Resolved |
| AR-P4  | Compiler implementation / release ordering                      | Which smallest direct sequence implements the approved shutdown without letting an old handler undo it?                                                 | Compiler decision under AGENTS.md PRIME DIRECTIVE item 4: use the vector-first sequence below. Independent platform review confirms conditional feasibility. No product contract, runtime support surface or public API is added.                                                                                                                                                                                                                                               | ✅ Resolved |
| AR-P5  | Exact new specification-test exception (runtime)                | May the draft no-hook control remove its unsupported exact empty-main RTS expectation?                                                                  | User: “I approve”, on 2026-10-07. Change only that assertion in `test/rd05/cia2-output-controls.spec.test.ts` to require no NMI-vector or CIA2 accesses in the actual emitted main body. Preserve all other fixtures, assertions, output costs and oracles.                                                                                                                                                                                                                     | ✅ Resolved |
| AR-P6  | Exact frozen specification-test extraction correction (runtime) | May the finite-call output case read the call's individual source-correlated instruction ranges instead of requiring all those ranges to be contiguous? | User: “Please do”, on 2026-10-07, approving the exact one-file extraction correction below. Preserve all behavior/cost assertions and every other case.                                                                                                                                                                                                                                                                                                                         | ✅ Resolved |
| AR-P7  | Exact frozen native specification-test correction (runtime)     | May the timer fixture replace its unsupported BASIC-ROM return-address range with the pinned SYS continuation `$E147`?                                  | User: “You may apply correction and fixes onwards”, on 2026-10-07, answering the exact proposed one-file correction. Change only the two range assertions and rationale comment; preserve all remaining source, behavior and output expectations.                                                                                                                                                                                                                               | ✅ Resolved |
| AR-P8  | Narrow native observer correction (runtime)                     | May the two non-consuming pending-source peeks ignore VICE's unsynchronized cached bit seven while retaining full CPU-captured results?                 | User's explicit authorization on 2026-10-07 to apply subsequent corrections/fixes, bounded to necessary existing-contract maintenance. Independent primary-source audit TP-002 supports only fixture167/200: compare low five source bits; preserve CPU $81/$82/$83, genuine NMI, read count, all shutdown/return and cost assertions.                                                                                                                                          | ✅ Resolved |
| AR-P9  | Native proof scope / existing startup defect (runtime)          | Does a newly added hidden CIA2 latch comparison block the new timer/NMI operation, or reveal an independently owned startup obligation?                 | Compiler-owned scope disposition under AGENTS.md PRIME DIRECTIVE item 4; independent challenger converged. Verify all port latches/DDRs unchanged across CIA2 operations and exact captured startup readback restoration. Retain TP-003 as a MAJOR R5.4 startup defect, owned by T-09 before RD-05 closeout. No preservation exception, frozen-oracle edit or startup implementation is authorized by this disposition.                                                         | ✅ Resolved |
| AR-P10 | Exact existing specification-test exception (runtime)           | May two ledger negative-test mutations explicitly select the deferred state after the real exclusive row retires?                                       | User: “I approve”, on 2026-10-07, accepting the exact two-case correction in the preceding final reply. Change only the setup for “a supported deferred restriction” and “active work assigned to the closing owner” in test/rd04/expressiveness-ledger.spec.test.ts to select deferred status; the closing-owner setup also supplies a failed synthetic observation using the row's existing diagnostic; preserve every fixture, assertion, expected violation and other case. | ✅ Resolved |
| AR-P11 | Additional bounded review cycle (runtime)                       | May the remaining semantic defects receive one additional correction/verification/review cycle after the normal fix-only review limit?                  | User: “I approve”, accepting the explicit request on 2026-10-07. Authorize exactly one additional bounded correction, verification and independent review cycle for SM-004/SM-005/SM-006. Preserve the existing contract, applicable review responsibilities and immutable oracles; no API, profile, runtime or general analysis framework is added.                                                                                                                            | ✅ Resolved |
| AR-P12 | Additional bounded CPU-return correction/review cycle (runtime) | May the newly confirmed RTI eligibility defect receive one additional focused correction and independent review after AR-P11's completed cycle?         | User: “I approve”, on 2026-10-07, answering the explicit preceding request. Authorize one focused CPU-return correction, verification and independent fix-review cycle for TP-004: derive IRQ eligibility from restored I only for actual returning interrupts. Preserve the no-arrival old-I delay and snapshot/masked controls. No new API, runtime, storage, solver, source restriction, frozen-authority or old-oracle edit.                                                | ✅ Resolved |

## Grounded discovery

### AR-P12 — actual interrupt return ends the prior old-I delay

The approved AR-P11 cycle corrects SM-004/SM-005/SM-006 and passes all 5,086
owned tests, with two existing compiler skips. Its independent platform review
nevertheless finds TP-004 MAJOR at `interrupt-context-proof.ts:257`: actual
interrupt returns restore `eligible: state.eligible`. This incorrectly retains
CLI's delayed IRQ eligibility after a quiet NMI returns through RTI.

A copied mask can be loaded before an ordinary pending IRQ without an NMI,
but a preceding quiet NMI's RTI restores I early enough for that IRQ to run
first. The IRQ can change the mask home before the resumed load. The existing
proof misses that early write and falsely retains a full-clear `$1F` fact.
This is a compiler CPU-proof defect, not a new language or game-specific rule.

Public check/build admit the exact source/assembly witness under
`/tmp/blend65-cia2-rti-probe.3kJqrT`. Its actual one-byte mask home is `$0B9D`;
the handler writes that same home and `CLI` is immediately followed by its
load. A separate acknowledged-IRQ variant reads CIA1 ICR before returning,
removing the objection that an uncleared IRQ might never let the load resume.
Its source SHA256 is
`cccf5a8827df53cb69a16574763010ec359bfbbc1133a1487803eacc3016f460`;
`ack-bound-home.log` and generation
`c360d880-b69e-4bb8-8df7-c753b30a5093` retain the exact public/assembled endpoint.
No native corruption execution is claimed. The pinned
[VICE 3.10 CPU source](https://raw.githubusercontent.com/VICE-Team/svn-mirror/4d283a2e7dd59b7e378524878e81ecc7826b700c/vice/src/6510core.c)
at its RTI implementation (raw source lines 1657–1669) confirms immediate IRQ eligibility after
restoring I=0. Physical-hardware proof remains separate.

**Best option:** authorize one additional narrow cycle. Derive eligibility from
restored I only on actual returning-interrupt alternatives; preserve the
absence branch's original old-I delay. Add independent regressions for the
NMI→RTI→IRQ ordering, masked returns and no-arrival/snapshot controls, then
verify and independently review the affected CPU/semantic/storage boundary.
The existing state key and same-point worklist already represent both facts.
No emitted instruction, new state domain, runtime, storage or source workaround
is needed. Do not silently extend AR-P11's explicit one-cycle allowance.
Confidence: High at the source/assembly/selected-CPU-model boundary.
Hardening: independent platform finding and separate advisory challenge converge
on the restored-I transfer. The challenge also requires unchanged no-arrival
delay, masked-return and snapshot controls. It grants no additional review-cycle
authority. Native corruption remains unexecuted.
The user explicitly approved this exact additional cycle with “I approve” on
2026-10-07. The gate is resolved; independent regressions must freeze RED before
the one existing return transfer changes. Any surviving major finding after
this additional fix-review cycle requires renewed authority; no push is authorized.

### AR-P10 — explicit negative-test state after ledger retirement

The approved AR-P3 ledger retirement leaves the actual acceptance probe GREEN,
but the existing gate reports nine passes and two failures. Both failed cases
reuse the real `v4-nmi-installation` row while implicitly assuming it is deferred.
It is now correctly retired, so supplying success or changing the owner alone
does not exercise the intended deferred-state rejection.

**Best option:** update only the two mutation setups in
`test/rd04/expressiveness-ledger.spec.test.ts`. In the supported-deferred case,
set `changed = { ...row, status: "deferred" }` alongside its existing successful
observation. In the closing-owner case, use
`{ ...row, status: "deferred", owner: closedOwner }` and
`changedResults = [{ kind: "failure", errors: [row.diagnostic] }]`.
That failed observation makes the deferred restriction valid except for its
closing owner; retaining success would trigger an additional retirement
violation and would not isolate the intended negative case. Keep all source fixtures,
baseline checks, exact expected violation arrays and other cases unchanged.
The rejection logic and compiler stay unchanged; no assertion is weakened.

The old specification-test file is outside AR-P3's exact three-file exception.
Subsequent-fix authority does not silently widen that protected modification
set. The primary requested this exact exception asynchronously and has not
edited the file. The corrected asynchronous request explicitly includes that
failed synthetic observation and replaces the earlier incomplete request.
The report is `task-134-ledger-results.json`, with command log
`task-134-ledger-verify.log`, under `/tmp/blend65-cia2-spec-kTWCbB`.
The user approved the exact correction on 2026-10-07 with “I approve”, in reply
to the self-contained AR-P10 request. Apply only those two setup changes and
reverify the complete gate. All assertions and source fixtures remain unchanged.
The full checkpoint resumes only after that directed gate passes; this approval
does not broaden any other protected-test exception.

### AR-P9 — separate operation proof from the real existing startup gap

The temporary native checker added an exact internal CIA2 PRA-latch comparison
from SYS entry to BASIC return. A genuine STOP/RESTORE warm-start followed by
another genuine SYS exposes `$D7 -> $97`, with DDRA `$3F`. This is a real
latent-input latch-bit-six change, not a cached observer discrepancy. VICE
`core/ciacore.c:802–809` stores the full PRA byte; CPU reads use physical pin
state (`c64/c64cia2.c:205–213`). Existing startup captures the readback `$97`,
writes it before the lease, and restores that exact capture on return. Its
unchanged blob is `bf9ab47c6a4e976e9aa115e51cb5d2d763641a26` in both the phase
baseline and current tree. No new timer/NMI operation writes PRA, PRB or DDRs.

**Best option:** retain the raw counterexample and its original failing checker,
verify the approved CIA2 slice's full operation-level port invariance and exact
captured-state restoration, and assign TP-003 to existing R5.4 startup ownership
under T-09. This is a scope disposition, not a hidden-latch preservation waiver.
Appendix C64 §9.3 and the expert VIC-view preservation rule remain unchanged;
RD-05 cannot close while the general startup gap is unresolved. No new shadow,
runtime, source restriction, scope-expanded startup fix or frozen-test edit occurs.

The strongest objection is that the user's full RD-05 goal still requires this
defect to be resolved. It does: the separate owner is mandatory, not a deferral
past RD-05. Prematurely adding conditional startup stores would address only some
entry states and invalidate all address-bound evidence without settling general
preservation. A product-contract decision is needed only if later resolution
would change that contract, not to distinguish these two proven boundaries.
Confidence: High. Hardening: an independent platform audit and fresh scope
challenger both grounded the cause; Challenger: converged on bounded sequencing.

Evidence under `/tmp/blend65-cia2-native.GjRTpE`: `boundary-pilot-stop.log`
and its monitor log record the original mismatch; the full STOP matrices retain
all internal latch values; `validate-boundaries-before-scope.mjs` retains the
original failing predicate. The corrected temporary diagnostic separately
reports each startup latch difference as Incorrect/not waived. It never masks
the raw byte or reports global startup qualification. Full native qualification
and independent phase review remain required for this slice.

### AR-P8 — non-consuming observer state versus real CPU ICR data

After AR-P7, all twelve cases reach genuine `$FE43` acceptance but initially fail the
pre-read monitor comparison: peek returns `$01/$02/$03`. This is not evidence
that the generated handler loses ICR bit seven. Pinned VICE 3.10
`src/core/ciacore.c:1429` returns cached `irqflags` without IFR catchup, whereas
the real CPU read at 1289–1341 updates timers/IFR and returns complete data.
The lookahead at 442–483 can schedule NMI without updating cached D7; after
an old-CIA read, D7 can also remain cached until delayed acknowledgement.
The independent platform auditor confirms both counterexamples and corrects
its earlier incomplete static assessment. The parent checked these primary
source paths independently.

Apply only the observer-specific predicates in `cia2-vice-fixture.ts`:
pre-read `(peek & $1F) == (scenario.pending & $1F)`; post-read low source bits
are zero. Preserve the full CPU-captured `$81/$82/$83` comparison, actual
hardware frame/RTI, consuming-read count and every shutdown assertion. No
extra CPU read, monitor write, API or generated byte/cycle/storage change.
This falls within the user's explicit subsequent-correction authorization;
it is not authority to weaken behavior or adapt an oracle to generated output.
Confidence: High; independent pinned-source diagnosis, not failing-value substitution.

Reports: `task-133-timer-ar7-results.json` records twelve peek failures and
zero skips under `/tmp/blend65-cia2-spec-kTWCbB`. The exact two-predicate
correction was applied at 11:44; `task-133-timer-observer-results.json` and
`task-133-timer-observer-verify.log` record all twelve cases passing, zero
skips, in 18.86 seconds. RESTORE/boundary qualification remains separate.

### AR-P7 — pinned SYS continuation, not a compiler workaround

All twelve sequential native timer cases stop before executing the generated
CIA2 program. The captured SYS return address is `$E147`, but
`test/rd05/cia2-vice-fixture.ts:138–139` assumes the continuation lies in
`$A000–$BFFF`. This unsupported range is not part of the language, ABI or
approved device contract.

The [original Commodore SYS source](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/BASIC_C64/code26)
at `CSYS`/`CSYSRZ` pushes the address immediately before its status-saving
continuation and transfers through the requested address. The admitted
901227-03 KERNAL bytes at `$E130` push `$E146`; `JMP ($0014)` at `$E144` is
followed by `PHP` at `$E147`. A normal RTS increments the stacked address and
therefore resumes at exactly `$E147`. The local ROM SHA-256 remains
`83c60d47047d7beab8e5b7bf6f67f80daa088b7a6a27de0d7e016f6484042721`;
the existing native bridge independently attests that pinned ROM before running.
The independent platform audit confirms this source/byte diagnosis. A BASIC
routine can reside in the KERNAL ROM extension; its name does not establish
an address range.

**Best option:** replace only those two range assertions with
`expect(basicReturn).toBe(0xe147)` and explain the pinned SYS continuation in
a durable comment. Leave stack-byte capture and the real return checkpoint
unchanged. Preserve all source programs, positive cases, timer bits, volatile
access counts/order, handler/RTI/register checks, final shutdown state,
artifact identities and costs. No compiler change, helper framework, monitor
write or general oracle-edit authority is requested.

The strongest objection is replacing an independent expectation with the
observed failing value. The original Commodore source and independently hashed
ROM bytes establish the value without reference to compiler output. An exact
continuation check is also stricter than accepting an entire ROM region.
Confidence: High. Hardening: independent primary-source and pinned-byte audit;
all device and generated-output expectations remain unchanged.

Evidence: `/tmp/blend65-cia2-spec-kTWCbB/task-133-timer-results.json` and
`task-133-timer-verify.log` record twelve identical failures, zero passes and
zero skips. This is fixture failure, not positive CIA2 runtime qualification.
No frozen test was changed or diagnostic oracle copy run before approval.
The user approved the exact one-file correction on 2026-10-07 and asked to
continue through RD-05 without unnecessary pauses. The approved correction
is applied; task 1.3.3 resumes sequential native verification. Ledger retirement
still requires complete positive qualification. Necessary subsequent fixes
must preserve independent behavior/cost oracles and remain within the approved
product boundary; new product choices, material machinery and frozen-authority
changes are not inferred from this continuation request.

### AR-P6 — finite-call extraction, not output expectations

The frozen finite-call case fails before checking a call target. Its common
extractor requires contiguous ranges carrying the narrow source span. Actual
finite dispatch has loads, comparisons and JSRs with the call's span, separated
by branch/jump terminators with the whole function's span. The existing debug
contract records both accurately; it does not promise that one source operation
has contiguous narrow-span coverage. `services/debug-machine-ranges.ts` assigns
terminators the function span; `test/rd05/cia2-output-fixture.ts:78` rejects those
gaps. No compiler change should be made to satisfy this unsupported assumption.

Independent actual-PRG inspection binds the narrow first-call ranges at
$09AE–$09B3, $09B5–$09BA, $09BC–$09BF and $09C2–$09C5. The intervening bytes are
the documented BNE/BNE/JMP dispatch transfers with the broader function span.
Both emitted first-call JSRs select clean bodies; both second-call JSRs select
the respective shutdown bodies. This inspection supports diagnosis only; it
does not replace the frozen tests or native qualification.

**Best option:** change only `test/rd05/cia2-release-output.spec.test.ts`'s
finite-call extraction. Read each individual narrow source-correlated range
within the actual main variant, validate its PRG bounds, decode actual bytes,
and inspect the resulting JSRs. Keep the source programs, positive-call count,
all selected-target/body/predecessor assertions, exact shutdown bytes, costs,
artifact hashes and every other case unchanged. Leave the shared contiguous
extractor unchanged for genuinely contiguous device/vector transactions.
This adds no production change, general harness or weakened output expectation.

The strongest objection is accidental inclusion of unrelated calls. Requiring
the same exact source occurrence, source index, main-variant range ownership
and narrowest matching span preserves those safeguards. Broadening the compiler's
debug mapping or weakening all contiguous-operation checks is not justified.
Confidence: High; the raw bytes and existing range producer agree on the cause.
Hardening: narrowed the correction to the finite-call consumer and preserved
every behavior/cost predicate. No additional independent challenge is required
for this bounded extraction decision under the execution protocol.

Evidence: `/tmp/blend65-cia2-spec-kTWCbB/task-128-results.json` records 48/52
GREEN and four identical extraction failures; diagnostic artifact identities
are in `task-128-finite-build.json`. Its owned input/artifact directory is
`/tmp/blend65-cia2-finite.fWXbbO`. Source-root `.` initially produced an evidence
error; the diagnostic was rerun with the normal `src` layout and succeeded.
All 24 direct output cases, sixteen direct/transitive release cases and eight
unaffected controls pass. No frozen test was edited before approval. The user
approved this exact correction on 2026-10-07; tasks 1.2.8/1.2.9 resume verification.

- `semantic/interrupt-routes.ts:45–63` admits only the qualified stock-chained
  NMI exception; exclusive installation still reports E10245.
- `semantic/cia-ownership.ts:318–328` rejects CIA2 state changes and consuming
  reads while the KERNAL route owns them. Its current diagnostic names the IRQ
  sink; this is not proof of NMI ownership.
- `machine/lower-c64-cia.ts:271–273` intentionally stops CIA2 write/read-clear
  lowering after permitting non-destructive counter observations.
- Frozen Appendix C64 §9.2 defines `setNMIExclusive` as ownership or replacement
  of CIA2, RESTORE, cartridge and all other NMI behavior, with an RTI terminal.
  Chapter 15's cooperative private-home-free exception does not itself settle
  source policy or an unreadable-state restoration contract.
- The pinned stock handler disables CIA2 masks, consumes ICR, and may restore
  sources from KERNAL's RS-232 state. A normal chain cannot consume and then
  forward the original event merely by jumping to that handler's entry.
- `machine/lower-c64-interrupt.ts:248–251,287,363` selects high-only vector
  publication only for a chained installation or a restore. Merely opening the
  exclusive admission guard would expose an NMI-unsafe two-byte publication.
  Its wrapper's placement/stack metadata is also chain-specific at lines 114/205.
  The existing proof, wrapper, layout and installer must agree for any extension.
- `layout/startup.ts:168–172` captures CIA2 port/direction, not timer/mask state.
  Stock NMINV `$FE47` does not prove inactive RS-232 or a restorable CIA2 state.

## AR-P2 — Approved observable contract

**Best option:** qualify the existing explicit `setNMIExclusive` route, rather
than add a second firmware dispatcher or modify ordinary `setNMI` chaining.

1. Ordinary `setNMI` continues to preserve the stock route and leaves CIA2
   consuming reads and state changes with KERNAL. Counter observation remains
   available without an exclusive lease.
2. An application choosing `setNMIExclusive` deliberately owns all NMI behavior
   during that epoch, including its treatment of RESTORE and any attached
   cartridge. It does not receive automatic stock RESTORE+STOP handling. The
   handler's source policy must be explicit in qualification examples; admission
   must not silently discard, coalesce, suppress or forward events.
3. Positive timer ownership is qualified from an idle KERNAL CIA2 entry, without
   an active KERNAL RS-232 session or another device owner of those timers/masks.
   `$FE47` alone does not establish this additional machine precondition. No new
   profile, runtime guard, state manager or general source restriction is proposed.
4. Final release ends the application's CIA2 timer epoch. It stops the owned
   timers, clears the owned masks and deliberately drains ending-epoch pending
   events once, then establishes the exact proved idle KERNAL-compatible state
   and returns ownership. This is a selected shutdown policy, not recovery of
   arbitrary previous reload latches/masks or resumption of an interrupted
   RS-232 session. The precise transition ordering remains an implementation
   proof obligation: no device state is declared safe from this prose alone.
5. Inner releases and handler/helper mutations are accepted only when the real
   prior owner, live observers, source/mask state and release effects remain
   proved. Reuse the existing context and ownership analyses; do not add a
   syntax ban, arbitrary nesting limit, runtime selector or shadow manager.

The user approved the explicit ownership/shutdown policy and
qualified entry boundary in items 2–4. Implementation choices in the existing
owners remain compiler decisions under AGENTS.md. No exclusive capability is
promised before all generated-storage, publication, device, output-cost and
runtime proof obligations close. Ordinary named APIs and normal source remain
the intended DX; selected storage proof, not source spelling, governs admission.

**Consequence:** ordinary programs keep their current RESTORE behavior. A program
that explicitly takes all-NMI ownership supplies its own RESTORE behavior while
the lease is active. It cannot transparently borrow CIA2 from an already-running
KERNAL RS-232 session. Releasing its timer lease is shutdown, not pause/resume.

**Independent challenge:** `/root/cia2_contract_challenger` recommends this
existing exclusive boundary with a proved known-state handback. It assessed the
supplied contract/code-location packet, not independently opened source. Its
strongest objection is the wider responsibility placed on a programmer seeking
only a timer. A stock-preserving composite is a materially different viable
product choice, but would require a separately approved and proved adapter;
it is not silently added to this batch.

**Independent platform check:** `/root/cia2_handoff_contract` inspected the actual
owners and primary sources. No finding survives against the current guarded
compiler. Positive ownership remains Unknown. In particular, stock vector
identity does not prove idle CIA2 state, and exclusive publication needs a
complete producer-to-consumer extension rather than a guard removal.

Confidence: **High** in the existing-API architectural direction; **Medium** in
final-release feasibility until the exact interleavings and native proof close.
Hardening: separated vector safety from device handback and made the idle-entry
and event-shutdown policy explicit. Challenger: **converged**.

## Verification and discovery integrity

Before production changes, the unchanged directed suites pass: CIA API 20,
NMI admission 36 and profile interrupts 20 — **76/76**, three files. This verifies
the existing admitted/guarded boundary, not the proposed exclusive capability.
No existing test or negative fixture was edited.

The primary's release-metadata read accidentally included current qualification
summary rows beyond the intended identity fields. A later semantics-reference
read also included its historical binding/evaluation preamble. Those materials
are excluded from decision evidence and establish no qualification verdict. Both new
independent packets excluded evaluator/grader payloads and historical verdicts;
the platform reviewer reports no qualification-answer exposure.

Primary evidence: [MOS 6526 datasheet, printed pp.6–8](https://myoldcomputer.nl/Files/mos_6526_cia.pdf)
and [Commodore 901227-03 NMI source](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/rs232nmi).
Knowledge lineage: expert `2.0.3`, immutable content
`22cc5f00f381c82d347cf342be4fcff16bc291c6`,
`sfa-and-abi.md#interrupt-route-completion-gate`,
`c64-memory-and-runtime.md#revision-pinned-nmi-contracts-and-costs`,
`c64-hardware.md#interrupt-control`; source keys BLEND65-SPEC-4-038b70e9,
MOS-6526-1981 and CBM-C64-KERNAL-03.

This is discovery, not positive capability or native-runtime qualification.
No production changes occur before the executable plan and specification-first
red phase. No ledger retirement occurs before positive qualification.

## AR-P3 — Approved exact exception

Existing empty-exclusive fixtures encode the unfinished-implementation guard,
not an enduring prohibition of a private-home-free, owned exclusive route.
Preserve their rejection coverage by replacing only their empty handler bodies
with the existing five-volatile-sample private-storage witness. Rename only the
corresponding case descriptions to match that storage condition.

| File                                         | Exact permitted change                                                                                                                                                                                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/rd05/profile-interrupts.spec.test.ts`  | In the sole `unsafe` fixture, replace the empty exclusive handler with five ordered volatile byte reads followed by a write of their sum. Rename that one case description. Keep its install/restore source, profiles, E10245, E10279 exclusion and no-generation assertions unchanged.     |
| `test/rd05/nmi-route-admission.spec.test.ts` | Replace only the empty exclusive body in the first rejection row with this file's existing `retainedReads` witness and rename that condition. Preserve every other row, fixture, helper, diagnostic/span and no-generation assertion.                                                       |
| `test/rd04/expressiveness-ledger.json`       | Only after complete exclusive source/storage/output/native qualification, change `v4-nmi-installation` from deferred to retired and update its reason/decision to that exact bounded evidence. Preserve its identity, source form, diagnostic and owner, and every other row byte-for-byte. |

Independent positive specification tests precede production and prove that
ordinary legal exclusive programs work. The stronger negative witnesses retain
the real generated-reentrancy/storage rejection. This exception never permits
weakening behavior, cost, source-kind, private-storage, alias, live-link or event
assertions. No general test-edit authority is requested.

## AR-P4 — Direct release and minimum-sufficient design

The final typed-device release saves P/A and masks IRQ, restores only NMINV's
high byte, clears all five CIA2 mask bits, writes stopped one-shot controls while
preserving `(CRA & $C6)` and `(CRB & $86)`, performs one generated ICR read, and
restores A/P. The high-byte publication is the end-of-epoch transition: subsequent
NMI enters stock firmware. Its returning paths with `ENABL=$00` cannot restart
the timers. Source-written reload latches are not reconstructed.

The qualified idle-entry condition includes stock `$FE47`, no resident vector
or CIA2 owner/suspended firmware writer, both timers stopped, all masks clear,
and KERNAL `ENABL` at `$02A1` equal to zero. Reset's RAMTAS/IOINIT establishes
that state at reset, not at every later SYS entry. Known source writes which
invalidate it prevent claiming this handback. No runtime entry probe is added.

Stock firmware may itself read ICR between generated release instructions.
Count those separately: **one generated drain**, not one total machine read.
Its existing source-indistinguishability and RESTORE+STOP/cartridge terminal
policy applies after publication. No compiler-added event suppression is used.
The stock warm-start path does not return to this transaction.

`/root/cia2_handoff_contract` independently checked the actual owners and pinned
`rs232nmi`, `init` and `declare`. Its initial concern about simultaneous RESTORE
was refuted against stock's existing policy, not dismissed by agreement.
Quiesce-first was rejected as the general form: a returning old handler can
restart a timer after the final stop. Actual shared-field and live-observer
proofs, assembled bytes and runtime interleavings still require qualification.

Reuse the current interrupt-context worklist, vector/link state and finite
ownership facts. A focused CIA2 fact/transition module holds device-specific
logic; it is not a new pass, value interpreter or whole-machine manager. The
existing worklist consumes its facts and the existing lowering consumes the
proved final-release facts in each existing emitted context. Without the facts, an unowned read or dirty inner
release could be emitted. No second solver, schema, profile, API, dependency,
harness, runtime flag, callback table, nesting guard or deferred optimizer is
introduced. Device facts can be omitted entirely on unaffected programs.

Primary source: [Commodore declaration source](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/declare).
The register's existing MOS/KERNAL sources govern the remaining instruction and
device facts. External aggregate stack, firmware completion, unrestricted
cartridge behavior and physical silicon remain unproved; bounded returning
qualification never implies those guarantees.

Preflight PF-001–PF-003 refine compiler-owned implementation details under the
same PRIME DIRECTIVE item 4 authority: preserve existing ordinary-helper context
specialization; name the existing GDB/text-monitor native RESTORE mechanism rather
than assume a binary-monitor input primitive; use immediate `$FE` only for an
exactly proved stock handback (38 bytes/56 nominal cycles instead of 39/58).
No approved source contract, old-oracle exception or product scope changes.

## AR-P5 — Draft no-hook control

The new no-hook control incorrectly requires an empty main body to be exactly
`RTS` (`$60`). ST-13 requires no added NMI entry or CIA2 precondition/output; it
does not specify main's terminal instruction. The independent author identified
this unsupported expectation before freezing task 1.1.2. The current run has
44 exclusive cases failing at the intended E10245 guard, four chained controls
passing and four no-hook controls failing only this extra expectation.

**Best option:** replace only the exact-RTS assertion with an instruction-aligned
check that the actual emitted main body contains no NMI-vector or CIA2 access.
Keep the source, four profiles, real public compiler/ACME build, ordinary-only
function assertion, absent NMI stack domains, external uncertainty checks and
every other output/behavior/cost expectation unchanged. Do not change compiler
output or replace RTS with the currently emitted JMP. This corrects the oracle
to the approved requirement, not to an implementation instruction choice.

The user explicitly approved this exact correction on 2026-10-07. Resume task
1.1.2 with the bounded assertion change and reverify before freezing its oracle.
Production and ledger retirement have not begun.

## AR-P11 — one additional bounded correction and review cycle

The six full phase reviews and the permitted fix-only review are complete.
Install/build/typecheck and all 5,017 tests pass, but the semantic review found
two remaining MAJOR defects and one MINOR diagnostic defect. The parent
reproduced all three through public services; evidence and exact review trees
are retained in [the phase review](09-phase-review.md#fix-only-review-and-remaining-necessary-corrections).
Passing the existing tests does not prove these missing cases safe.

**Best option:** correct these defects in the existing ordered interrupt and
argument proof, then permit exactly one additional bounded independent review:

- SM-004: carry possible parameter-home writes through actual helper execution,
  interrupt arrivals and returns, including a handler restored before return.
  Keep an already-evaluated value separate from its possibly changed home.
- SM-005: retain an exact parameter fact through taking its address and reading
  it. Invalidate the fact only for a possible modifying effect.
- SM-006: relate an unsupported actual flag value to its proving caller, while
  preserving the diagnostic code, severity and primary location.

Write independent regression cases before the additional production correction.
Run directed checks, sequential native cases and the full project checkpoint.
The one additional fix-only review must preserve the applicable independent
correctness, semantics/DX, SFA/ABI, platform, output and host-performance
responsibilities; it is not a new full planning or review framework.

No API, profile, runtime, source restriction, second solver, general optimizer,
frozen-authority change or old-specification-test exception is requested. The
confirmed xhigh batch remains in force. The user's standing authorization covers
necessary corrections, but this request explicitly identifies the execution
skill's exhausted review-cycle limit. No third review is silently dispatched;
task 1.3.6 remained blocked pending this narrow ruling. The user explicitly
approved the self-contained request with “I approve” on 2026-10-07. Resume that
task with exactly this additional cycle. No phase or RD closeout is implied.
