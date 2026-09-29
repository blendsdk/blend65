# Ambiguity Register: RD-05 CIA Interrupt and Timer Slice

> **Status**: ❌ GATE BLOCKED — discovery in progress
> **Last Updated**: 2026-09-29

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|---|---|---|---|---|
| AR-P1 | Scope | Which RD-05 work belongs in this bounded plan? | Recommended: CIA1/CIA2 timer operations, exact ICR read/mask effects, and ownership checks on the four cooperative profiles; exclude NMI handler installation and RESTORE re-entry proof, takeover profiles, and a scheduler. | User: “Yes, use that narrow scope” on 2026-09-29. | ✅ Resolved |
| AR-P2 | Verification | Which existing commands close each implementation phase? | Recommended: directed CIA tests during tasks; `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, and `yarn test` at each phase checkpoint; run VICE cases sequentially. | User: “Yes, use the existing verification rule” on 2026-09-29. | ✅ Resolved |
| AR-P3 | Behavioral / source ownership (complex) | Does “dispatch every returned pending bit” require general proof of arbitrary handler branches, and who may consume each ICR result? | Recommended: statically prove the consuming-read and enabled-source owner, emit one read, let ordinary source code handle its returned bits, and qualify simultaneous bits; CIA1 read only on a proved exclusive IRQ route; CIA2 consuming read remains with KERNAL until NMI safety is proved. No generic branch-completeness checker. | User: “Yes, approve the narrow contract” on 2026-09-29. | ✅ Resolved |
| AR-P4 | Scope / KERNAL coexistence | Can cooperative source change CIA2 timers and masks before NMI/source handoff is proved? | Recommended: usable CIA1 timer/ICR operations require explicit exclusive IRQ ownership; CIA2 permits only non-destructive counter reads in this plan. Reject CIA2 timer/control/mask writes and ICR reads until the separate NMI/source handoff is proved. | Awaiting user answer. | ❌ Open |

## Resolution Notes

**AR-P1:** This plan implements a bounded part of RD-05 R5.11–R5.13 and R5.20/AC-16. It does not close RD-05 or DEF-7. Any CIA2 operation needing positive NMI handler safety remains blocked by the earlier named deferral.

**AR-P2:** The recommended commands come from the repository's `AGENTS.md`; no new harness or CI tier is proposed.

**AR-P3:** The [MOS 6526 data sheet](https://myoldcomputer.nl/Files/mos_6526_cia.pdf) defines ICR as a read-to-clear data register and a separate write-only set/clear mask. The [pinned 901227-03 KERNAL NMI handler](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/rs232nmi) consumes CIA2 ICR. The current compiler has no CIA binding in `packages/compiler/src/frontend/profile.ts` and only vector-level interrupt facts in `packages/compiler/src/target/profile.ts`. An independent design challenger converged on the recommended direct contract. Its strongest objection is that arbitrary application code can ignore a returned bit; the plan must not claim a compiler proof of arbitrary handler meaning. The user approved that boundary; the plan must test simultaneous bits without claiming semantic proof of arbitrary user work. Confidence: High for the approved boundary; a future product requirement for enforced per-branch service would reopen it. Hardening: the challenger ruled out a broad branch checker as costly and still unable to prove useful service.

**AR-P4:** The existing selected profile does not record a CIA2 source handoff or a known restorable CIA2 mask. The pinned KERNAL handler may use CIA2 timers/FLAG for RS-232 and reads/reenables CIA2 ICR. A cooperative program therefore cannot treat those registers as free merely because it has a typed library name. A CIA2 counter read is non-destructive; configuration or acknowledgement is not. This refinement keeps positive CIA2 ownership with DEF-7 rather than fabricating a guarantee.
