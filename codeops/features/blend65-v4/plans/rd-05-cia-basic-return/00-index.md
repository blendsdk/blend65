# RD-05 CIA1 Return to BASIC Plan

> **Feature**: Safe cooperative-profile return after CIA1 timer/interrupt takeover
> **Status**: Executing — authority correction precedes compiler execution
> **Created**: 2026-09-29
> **Implements**: blend65-v4/RD-05
> **CodeOps Artifact Schema**: 1

## Overview

This plan closes DEF-14 for the four cooperative C64 PRG profiles. A game that takes exclusive CIA1 timer/IRQ ownership can release its final handler and return to a functioning stock KERNAL/BASIC timer service. The user approved a narrow correction to the impossible promise of bit-exactly restoring arbitrary pre-entry write-only CIA1 state (AR-P2). The original nonreturning guard stays until the corrected authority and implementation are qualified.

The [design](03-cia-basic-return.md) owns the source-visible and emitted behavior; [tests](07-testing-strategy.md) own independent expectations. The [decision register](00-ambiguity-register.md) records the approved scope, stock-entry precondition, verification, and controlled authority-edit set. This is a bounded RD-05 slice, not RD-05 closeout.

## Minimum-Sufficient Baseline

**Original goal:** permit a safe normal Quit-to-BASIC path after the previously delivered CIA1 takeover, without weakening expert output or widening DEF-7 (AR-P1–AR-P3).

**Smallest viable design:** correct the one normative CIA1 return contract and dependent expert baseline first; then extend the existing CIA ownership facts and direct `restoreIRQ()` lowering so the final exclusive pop restores stock Timer A inside its already interrupt-masked vector transaction (AR-P2–AR-P5).

**Excluded machinery:** no new source API, runtime shadow manager, scheduler, general device-state framework, new harness, or whole-ROM `IOINIT` call. No NMI/CIA2 handoff, raw takeover profile, custom resident-program compatibility, or unrelated RD-05 workload is included (AR-P1–AR-P3).

**Approved complexity:** none beyond the existing frozen-authority qualification procedure mandated by AR-P5.

## Document Index

| Document | Purpose |
|---|---|
| [Ambiguity register](00-ambiguity-register.md) | Approved decisions and Zero-Ambiguity Gate |
| [Requirements delta](01-requirements.md) | Bounded relationship to RD-05 |
| [Current state](02-current-state.md) | Existing guard and compiler seams |
| [CIA1 return design](03-cia-basic-return.md) | Ownership, handback order, lowering, diagnostics, costs |
| [Authority evidence](06-authority-evidence.md) | Candidate identity, blind qualification and activation evidence |
| [Testing strategy](07-testing-strategy.md) | Independent source, output, and VICE cases |
| [Execution plan](99-execution-plan.md) | Sole task-progress checklist |
| [Preflight report](00-preflight-report.md) | Accepted fixes and passing full-plan re-scan |

## Quick Reference

After a qualified, source-visible exclusive CIA1 handoff, a returning game still calls its existing `restoreIRQ()` before leaving `main`. The final exclusive restore is the one that performs the stock handback; balanced vector-only inner restores do not. A selected profile's stock BASIC/KERNAL entry contract is required. Exact custom pre-game CIA1 mask/latch state is not promised (AR-P2–AR-P3).

DEF-7 retains CIA2/NMI/RESTORE ownership. RD-10 retains physical CIA-edge QA and native Windows work. No implementation or frozen-authority file was changed by creating this plan.
