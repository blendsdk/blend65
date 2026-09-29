# Requirements Delta: RD-05 CIA Timer and Interrupt Slice

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-05](../../requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md) — owning requirements document

## Scope of This Plan

| RD keys | Treatment |
|---|---|
| R5.11–R5.13 | Apply their named-platform, exact-MMIO-effect and ownership rules to this CIA slice only. |
| R5.15–R5.17 | Reuse the existing exclusive IRQ route, qualify a source-visible masked handoff, and require a closed CIA1 source owner; no new interrupt entry or NMI installation. |
| R5.20; AC-16 | Implement counter/latch distinction, safe timer control, ICR set/clear/read effects and simultaneous-source qualification within AR-P1/AR-P4's cooperative boundary. Full RD keys remain open. |
| R5.47–R5.56 | Apply relevant diagnostics, independent behavior/output evidence and expert-cost checks to this slice; whole-RD evidence remains later work. |

AR-P1 excludes a hidden scheduler, takeover profiles, NMI installation, and RESTORE re-entry proof. AR-P4 leaves CIA2 writes and consuming ICR reads under DEF-7. The accepted PF-002 correction rejects a return to BASIC after CIA1 timer/mask takeover in this slice; DEF-14 owns the safe hand-back before RD-05 closeout. This temporary guard must not become a permanent game-language restriction. No frozen-specification or expert-skill file changes are part of this plan.

## Plan-Local Decisions

| Concern | Owning decision |
|---|---|
| Source and acknowledgement boundary | AR-P3–AR-P4 |
| Direct API and counter/latch semantics | AR-P5 |
| Safe shared-control update | AR-P6 |
| Constant names and supported source/clock modes | AR-P7 |
| Phase verification | AR-P2 |
| Handoff, temporary exit guard, existing-test impact, and small coverage corrections | Accepted PF-001–PF-005 in [preflight report](00-preflight-report.md) |

## Slice Acceptance

The slice is complete only when all planned tasks and [ST cases](07-testing-strategy.md#specification-test-cases) pass, the emitted routines meet the direct expert sequences and cost expectations in [the design](03-cia-operations.md#lowering-and-cost), independent review is clear, and the roadmap still assigns DEF-7, DEF-14 and the remaining RD-05 work. CIA1 takeover programs that need a normal Quit-to-BASIC path wait for DEF-14; a full RD-05 closeout is not claimed (AR-P1, AR-P4, PF-002).
