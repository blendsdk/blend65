# RD-05 Takeover Resident Profiles Plan

> **Feature**: Four raw-takeover C64 resident profiles (`V4-TAKEOVER-1`)
> **Status**: Executing — 29/30 tasks
> **Created**: 2026-11-12
> **Implements**: blend65-v4/RD-05; closes `V4-TAKEOVER-1`
> **CodeOps Artifact Schema**: 1

## Overview

The v4 production release qualifies four cooperative KERNAL PRG profiles and one D64
profile. The manifest recognizes four additional takeover IDs but selection rejects them
with `E10279`, startup always emits the cooperative BASIC/KERNAL constructor, and no raw
interrupt sink or VICE harness exists. This plan makes the four
`c64-{pal|ntsc}-prg-takeover-{6581|8580}` IDs executable, from manifest through a fresh
ACME artifact and a VICE 3.10 runtime observation.

Takeover is a raw ownership path, not a flag on the cooperative path. While application
code runs, BASIC and KERNAL execution are absent, I/O stays visible, RAM at `$E000–$FFFF`
is exposed, and the compiler owns both hardware vectors and every enabled interrupt
source. Startup writes complete underlying RAM vectors before the single processor-port
mapping change that exposes them. A normal `main` return restores the compiler-owned
machine state and returns to BASIC; an unbalanced interrupt owner or an unsafe vector or
bank transition is a compile-time error.

The frozen Specification 4.0 remains untouched. The bounded result is
`VICE-verified / hardware-unverified`; no physical C64, drive, or SID is available.

## Minimum-Sufficient Baseline

**Original goal:** remove the `V4-TAKEOVER-1` support gap by executing exactly the four
already-recognized takeover identities with the same language, assets, timing facts and
evidence contracts as their cooperative siblings.

**Smallest viable design:** extend the existing closed profile row, target-composition,
frontend-declaration, startup-constructor and interrupt-lowering seams. No new pass,
runtime, dispatcher, manager, heap, scheduler, or second toolchain is introduced.

**Excluded machinery:** no cooperative CIA1 stock handback on takeover returns, no
physical-hardware claim, no C64U target work, no CharPad/GoatTracker producer work, no
optimizer-roadmap reopening, and no `spec/` edit. Any discovered frozen-authority
discrepancy is recorded as a finding with an owner, not silently repaired.

**Approved complexity:** bounded raw startup, raw IRQ/NMI sinks, and one sequential VICE
harness extension. The work is high-risk because it touches vectors, banking, interrupts
and SFA closure, so it receives SFA/ABI, target-platform, machine-code and semantics
review before activation.

## Document Index

| Document | Purpose |
|---|---|
| [Ambiguity register](00-ambiguity-register.md) | Decisions, rejected alternatives, open findings |
| [Requirements delta](01-requirements.md) | Exact RD-05 relationship and acceptance mapping |
| [Current state](02-current-state.md) | Existing seams, rejection points and harness limits |
| [Takeover design](03-takeover-design.md) | Profile facts, startup/return, vectors, sinks, costs |
| [Testing strategy](07-testing-strategy.md) | Source, output, cost and VICE cases |
| [Execution plan](99-execution-plan.md) | Sole task-progress checklist |
| [Preflight report](00-preflight-report.md) | Independent plan/design findings and dispositions |
| [Closeout](08-closeout.md) | Delivered boundary, runtime matrix, costs, reviews and residual findings |

## Quick Reference

After this plan, `blendc check/build` accepts all eight resident PRG IDs. A takeover build
uses the same 12-byte `$0801` stub and enters at `$080D`, but immediately saves
`$0000/$0001`, writes complete default raw IRQ/NMI vectors into underlying RAM, switches
the owned low latch bits to `$05`, and runs with no KERNAL call path. `main` may return:
the epilogue restores the captured port, register, status and stack state and executes
`RTS` to BASIC. The raw IRQ source installers are `c64.system.setRawIRQ` and
`c64.system.restoreRawIRQ`; the cooperative KERNAL sinks are absent from takeover
profiles, and the raw IRQ sinks are absent from cooperative and D64 profiles.
Source-installed raw NMI is deferred (`V4-TAKEOVER-F2`): startup installs and owns a
complete default raw NMI entry, but the frozen text withholds the unbounded-NMI exception
from takeover, so no source installer is exposed in this slice.

## Exit Boundary

`V4-TAKEOVER-1` is done only when all four takeover IDs produce fresh ACME PRGs, each
runs only its own hashed PRG in the pinned VICE 3.10 `x64sc`, the observation proves the
vector/mapping transition, the default IRQ and NMI entries, and normal return, and the
evidence records `VICE-verified / hardware-unverified`. Physical rows remain `Unknown`.
Source-installed raw NMI is an explicit deferred limitation (`V4-TAKEOVER-F2`), not a
silent claim.
