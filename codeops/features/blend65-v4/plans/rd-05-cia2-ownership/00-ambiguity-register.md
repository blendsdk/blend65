# Ambiguity Register: remaining CIA2 ownership

> **Status**: ✅ GATE PASSED — approved bounded contract; machine proof obligations remain executable work
> **Last Updated**: 2026-10-06
> **CodeOps Artifact Schema**: 1

## Planning boundary

| Boundary         | Scope                                                                                                                                                                                                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Target           | Finish the remaining `blend65-v4/RD-05` CIA2 ownership work on the four existing cooperative PRG profiles. The user confirmed xhigh for the named assessment, planning, implementation and verification batch on 2026-10-06.                                                                                                                                       |
| Context          | Frozen Specification 4, qualified expert 2.0.3/content `22cc5f00`, RD-05 R5.15–R5.18/R5.20, completed stock-chained NMI and CIA1-return plans, existing CIA2 API, primary MOS 6526 and pinned Commodore KERNAL source.                                                                                                                                             |
| Modification set | This register and the feature roadmap's derived next-work pointer during discovery; a bounded executable plan only after the contract gate. Compiler changes and new tests follow the settled contract and specification-first ordering. AR-P3 authorizes only its three exact old-oracle changes. Frozen specification and expert-skill changes remain forbidden. |

## Decisions

| ID    | Category                                    | Question                                                                                                                                     | Authority / disposition                                                                                                                                                                                                           | Status      |
| ----- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| AR-P1 | Scope / effort                              | Which work and effort are confirmed?                                                                                                         | User: “xhigh is confirmed. Finish it.”, replying to the named remaining-CIA2 batch. Keep keyboard acquisition, raw/takeover profiles, a general optimizer and game policy outside this batch.                                     | ✅ Resolved |
| AR-P2 | Source behavior / integration — sensitive   | Which entry, event and final-release contract is intended for an application-owned CIA2/NMI epoch?                                           | User: “I approve”, accepting the explicit ownership, idle-entry and shutdown contract presented on 2026-10-06. The detailed contract below is approved; proof remains required.                                                   | ✅ Resolved |
| AR-P3 | Exact existing specification-test exception | How may the two temporary blanket-exclusive rejection fixtures and the corresponding ledger row change when positive ownership is qualified? | User: “Yes, approve this exact three-file exception”, in the asynchronous reply on 2026-10-06. Only the changes below are authorized; ledger retirement still requires full qualification.                                        | ✅ Resolved |
| AR-P4 | Compiler implementation / release ordering  | Which smallest direct sequence implements the approved shutdown without letting an old handler undo it?                                      | Compiler decision under AGENTS.md PRIME DIRECTIVE item 4: use the vector-first sequence below. Independent platform review confirms conditional feasibility. No product contract, runtime support surface or public API is added. | ✅ Resolved |

## Grounded discovery

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
