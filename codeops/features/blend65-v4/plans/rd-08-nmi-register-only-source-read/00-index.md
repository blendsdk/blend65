# RD-08 NMI Register-Only Source Reads Plan

> **Feature**: Keep ordinary NMI consuming-read assignment and bit conditions register-only
> **Status**: Done — 24/24 tasks; root verification pending in the final checkpoint
> **Created**: 2026-11-12
> **Implements**: blend65-v4/RD-08; closes issue #100
> **CodeOps Artifact Schema**: 1

## Overview

A correct NMI handler that assigns a consuming CIA2 read to a module global now compiles, but the
same read used in a bit condition still fails `E10245`. Issue #100 recorded both forms. The current
tree builds the assignment witness on all four cooperative profiles; the conditional witness
`if ((readAndClearPendingSources() & sourceTimerA) != 0)` fails because the machine layer stores the
read result in a private one-byte temporary instead of leaving it in A.

The freeze on the NMI private-home proof stays intact: a handler that genuinely needs private
storage must still fail. This plan removes only compiler-invented scratch for one adjacent,
single-use byte chain, so the existing proof keeps rejecting real cases while ordinary source stops
being rejected.

The bounded result is `VICE-verified / hardware-unverified`. No physical C64, drive or SID exists
for this candidate.

## Minimum-Sufficient Baseline

**Original goal:** close issue #100's two normal forms on every cooperative profile without weakening
the NMI reentrancy gate.

**Smallest viable design:** extend the existing `selectRegisterForwarding` byte rule so a single-use
byte result from a platform read or a byte call is forwarded into an adjacent byte bitwise operation
with a constant right operand. No new pass, allocator, runtime, dispatcher or optimizer framework is
introduced, and no storage request is moved or invented later than closure.

**Measured starting evidence (2026-11-12, tree `a5717bc5`):**

| Form | All four cooperative profiles |
|---|---|
| `global = readAndClearPendingSources();` | Builds; the read result is already forwarded into one fixed store |
| `if ((readAndClearPendingSources() & sourceTimerA) != 0) { global = true; }` | Fails `E10245`; one one-byte `temporary` request |
| `if (readAndClearPendingSources() != 0)` | Fails `E10245`; one one-byte `temporary` request |
| `let pending = readAndClearPendingSources(); if ((pending & mask) != 0)` | Fails `E10245`; one local request |

**Excluded machinery:** no general local-storage elision, no runtime selector, no shadow of private
scratch into shared storage, no new optimizer framework, no frozen specification edit, no takeover
source-NMI work.

## Document Index

| Document | Purpose |
|---|---|
| [Ambiguity register](00-ambiguity-register.md) | Decisions, rejected alternatives, remaining restrictions |
| [Requirements delta](01-requirements.md) | Exact issue #100 and RD-08 relationship |
| [Current state](02-current-state.md) | Reproduced witnesses, requesting seam, evidence |
| [Design](03-design.md) | Forwarding rule, proof obligations, output and costs |
| [Testing strategy](07-testing-strategy.md) | Spec, impl and VICE cases |
| [Execution plan](99-execution-plan.md) | Sole task-progress checklist |
| [Preflight report](00-preflight-report.md) | Independent findings and dispositions |
| [Closeout](08-closeout.md) | Delivered boundary, measured costs, residual finding |

## Quick Reference

After this plan, both issue witnesses build with zero private storage on
`c64-{pal|ntsc}-prg-kernal-{6581|8580}`. The conditional handler lowers to a compiler A save, one
consuming read, one immediate mask, one branch, one shared-global store and `RTI`. A handler that
retains several samples, declares a local, or otherwise needs a private home still fails `E10245`.

## Exit Boundary

Issue #100 is done only when both normal forms build on all four cooperative profiles, the emitted
assembly has zero private-storage requests and matches the expert sequence, sequential VICE proves
the handler stores the expected value and returns, the multi-retained and local negatives still fail,
the expressiveness ledger reflects the narrowed restriction, and the complete compiler suite is
green. `spec/` stays untouched.
