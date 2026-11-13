# RD-08 Residual NMI Forms Plan

> **Feature**: Close every remaining NMI Boolean materialization and retention form
> **Status**: Done — 24/24 tasks; verification recorded
> **Created**: 2026-11-13
> **Implements**: blend65-v4/RD-08; completes issue #150
> **CodeOps Artifact Schema**: 1

## Overview

Issue #149 delivered the ordinary NMI Boolean masks and the bounded straight-line stack retention
forms. Five forms still fail `E10245` because they need a wider join, a staging-free runtime mask,
a general nonzero comparison, or a retention proof that is not one straight-line block.

This slice delivers all five without relaxing the NMI private-home proof:

1. **Wide-word-mask comparison** — a single-bit-per-byte word mask aligns both selected
   bits with one `LSR` and combines them with `ORA`/`AND`; a multi-bit mask materializes the
   zero/nonzero Boolean with a branch join over both masked bytes. No two-byte temporary.
2. **Computed runtime mask** — a byte mask computed at run time is retained on the handler's own
   hardware stack and consumed directly as an `AND absolute,X` operand. The volatile read stays in
   A and happens once.
3. **Nonzero masked comparison** — `(x & M) == C`/`!= C` materializes from A. A single-use mask
   equal to the constant uses the zero-test branch with the inverted sense; every other byte
   constant uses `EOR #C` before that branch.
4. **Capacity-bounded retention** — the fixed eight-byte cap is replaced by the existing proved
   hardware-stack capacity check. Nine or more retained bytes are admitted when the platform
   budget proves them, and the final top-slot use is consumed with `PLA`.
5. **Multi-block and calling retention** — a retained byte may live across a control-flow join or a
   stack-balanced call. Slot offsets come from a dominance plan, block entries reset the
   stack-pointer register fact, and every X/SP clobber is re-established before a stack load.

No private RAM or zero-page home is created. Every retained byte lives on the invocation's own
hardware stack and is counted in `hardwareStack`.

## Delivered forms

- `finished = ((w & 258) != 0)` with a placed word
- `let m: byte = maskValue | 1; finished = ((readAndClearPendingSources() & m) != 0)`
- `finished = ((readAndClearPendingSources() & 8) == 8)`
- nine simultaneously retained `peek` samples
- a sample retained across an `if`/`else` join
- a sample retained across a stack-balanced ordinary call

## Exit boundary

Four-profile build/storage oracles, an independent byte/path-cycle oracle, a sequential genuine-NMI
VICE case that observes the wide mask, the computed mask, the nonzero comparison, nine samples and
a cross-join/call lifetime, the complete compiler suite, the affected root suites, `spec/` untouched,
a green commit, the ledger row retired, and issue #150 closed with the delivered boundary.
