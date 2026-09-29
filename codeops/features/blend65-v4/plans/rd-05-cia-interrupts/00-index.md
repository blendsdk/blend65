# RD-05 CIA Timer and Interrupt Operations

> **Feature**: Direct, ownership-checked CIA timer and interrupt operations
> **Status**: Plan Preflighted — ready for execution
> **Created**: 2026-09-29
> **Implements**: blend65-v4/RD-05
> **CodeOps Artifact Schema**: 1

## Overview

This plan covers the approved CIA slice of RD-05 on the four qualified cooperative C64 profiles. It gives Blend65 source named timer-counter observations, CIA1 timer programming and interrupt-control operations, and precise volatile lowering. A CIA1 timer/mask takeover cannot return to BASIC in this bounded slice because the prior write-only interrupt mask cannot be recovered. Safe return is an explicit RD-05 follow-on (DEF-14), not a permanent game-language restriction. The plan does not claim completion of RD-05 R5.20 or AC-16 while CIA2 state-changing operations remain blocked by DEF-7.

The source-facing and emitted contracts are owned by [the CIA design](03-cia-operations.md); independent expected outcomes live in [the test strategy](07-testing-strategy.md). The [decision register](00-ambiguity-register.md) is complete at AR-P1–AR-P7.

## Minimum-Sufficient Baseline

**Original goal:** plan CIA timer operations, exact ICR effects, and source ownership without widening the unfinished NMI work (AR-P1–AR-P4).

**Smallest viable design:** extend selected-profile declarations, one focused semantic ownership check, existing direct C64 lowering, and existing VICE tests. Keep source logic responsible for interpreting returned ICR bits (AR-P3–AR-P7).

**Excluded machinery:** no runtime manager, shadow-mask service, scheduler, generalized register framework, new harness, or extra dependency (AR-P1–AR-P3, AR-P6).

**Approved complexity:** none beyond the direct existing-pipeline extension.

## Document Index

| Document | Owns |
|---|---|
| [Ambiguity register](00-ambiguity-register.md) | Approved scope and API decisions |
| [Requirements delta](01-requirements.md) | This slice's relationship to RD-05 |
| [Current state](02-current-state.md) | Existing compiler seams and gaps |
| [CIA design](03-cia-operations.md) | Signatures, effects, ownership, diagnostics, and machine sequences |
| [Testing strategy](07-testing-strategy.md) | Independent ST input-to-result cases and verification |
| [Execution plan](99-execution-plan.md) | Sole implementation-task checklist |

## Quick Reference

The accepted API reads the current counter separately from writing its reload latch. CIA1 state-changing calls are only legal while its IRQ source has a proved exclusive owner; CIA2 remains counter-read-only. The exact names and safe clock modes are in 03-cia-operations.md §Source API (AR-P5–AR-P7).

This plan is a partial RD-05 delivery. DEF-7 still owns positive NMI installation, CIA2 source handoff, and the missing finite re-entry proof. DEF-14 owns a proved return-to-BASIC hand-back for CIA1 takeover before RD-05 closeout; counter-only programs and the existing M1 exit remain unaffected. The four selected profiles remain NMOS 6510, KERNAL 901227-03, ACME 0.97, and VICE 3.10 for runtime qualification; physical CIA edge behavior stays hardware-unverified until targeted QA.
