# Keyboard and combined input — planning decisions

> **Status**: ❌ GATE BLOCKED — discovery in progress; no executable plan
> **Last Updated**: 2026-10-02 21:06 CEST
> **CodeOps Artifact Schema**: 1

## Planning scope contract

| Boundary | Authority |
| --- | --- |
| Planning target | `blend65-v4/RD-05` R5.25/AC-20 and the remaining R5.24/AC-19 keyboard-coexistence obligation. The user confirmed high effort and continuation after the proposed focused keyboard/combined-input planning task. |
| Context artifacts | RD-05 and its requirements decisions; the live feature roadmap; the completed joystick/library pilot; current source loading, profile declarations, semantic/lowering/storage and startup seams; frozen Specification 4 and expert baseline; primary CIA/KERNAL evidence. Reading does not authorize edits. |
| Modification set | This new plan folder only during discovery. While the gate is blocked, only this register may be written. No compiler, tests, upstream requirements, frozen spec or expert-skill changes are authorized by planning. |

## Ambiguity register

| ID | Category | Decision needed | Recommendation / authority | Status |
| --- | --- | --- | --- | --- |
| AR-P1 | Scope / product boundary | What is the next planning task? | User confirmed the focused RD-05 keyboard/combined-input plan. Preserve both existing raw joystick reads and the approved library-first direction. The existing product boundary excludes an input manager, event queue, scheduler, debounce and repeat policy. | ✅ Resolved — existing scope and product authority |
| AR-P2 | Data/state / technical — sensitive | What port-state and firmware-ownership contract permits exact scan restoration? | Prove the bounded known-state transaction first. CIA reads observe pins, not the hidden output latch; saving a port read is not proof of arbitrary latch restoration. Stock returning NMI can also change the selected column. No hidden state manager or profile correction is approved. | ❌ Open |
| AR-P3 | Behavior / integration / user-facing API — sensitive | What does a combined keyboard/joystick observation promise when shared lines or multiple keys prevent a unique interpretation? | Preserve raw observations and expose affected-key uncertainty, not blanket keyboard invalidation or invented input. Eight row bytes and two port observations are a candidate, not an accepted API. Names, acquisition-quality representation and certainty contract await the proof. | ❌ Open |
| AR-P4 | Scope / delivery | Should the next executable slice be proof-only rather than positive keyboard support? | Best option: one bounded proof task using pinned ROM and existing VICE support, before accepting the keyboard API plan. No production changes, new framework, NMI adapter, profile correction or optimizer. Keep AR-P2/AR-P3 open for the positive plan. | ❌ Open — awaiting explicit scope decision |

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

A post-row port-A comparison is a useful proof candidate, not a settled remedy. The challenger
found a source-derived counterexample for column `$7F` involving two returning NMIs and changing
keys: an earlier NMI can leave another column driven during the PB sample, while a later NMI
restores `$7F` before the PA comparison. A matching final pin observation therefore is not by
itself evidence of the earlier driven column. This inference has not been replayed in VICE.

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
