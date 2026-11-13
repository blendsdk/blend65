# RD-08 Residual Boolean Masks Plan

> **Feature**: Close the remaining actionable NMI Boolean-mask restriction
> **Status**: Done — 25/25 tasks; final verification recorded
> **Created**: 2026-11-13
> **Implements**: blend65-v4/RD-08; closes issue #148
> **CodeOps Artifact Schema**: 1

## Overview

Issue #147 delivered the ordinary NMI forms, including a Boolean value from a constant mask `1`.
A materialized Boolean from any other constant mask still fails `E10245` because the masked value is
`0` or `mask`, not `0`/`1`, so the comparison retains a private byte.

A single-bit constant mask can be normalized branchlessly: `AND #mask` leaves `0` or `mask`, and one
`LSR` per bit position shifts that value to exactly `0` or `1`. The sequence adds one byte and two
cycles per shift after the existing `AND`, so it meets or beats the expert branch materialization
only for masks `2` (one shift) and `4` (two shifts). Higher single-bit masks and multi-bit masks stay
deferred with measured evidence.

The multi-sample restriction is a genuine storage requirement of the cooperative private-home-free
NMI route. It stays `E10245` as a documented contract boundary, not compiler-invented scratch.

The bounded result is `VICE-verified / hardware-unverified`.

## Minimum-Sufficient Baseline

**Original goal:** close issue #148's actionable non-`1` Boolean-mask form without relaxing the NMI
private-home proof.

**Smallest viable design:** extend the existing mask-`1` Boolean identity with a shift count:

1. select a single-use `binary &` with a compile-time constant mask `2` or `4`;
2. require the sole consumer to be a materialized `== 0`/`!= 0` comparison whose result has one A
   consumer;
3. emit one `LSR A` per bit position, then one `EOR #$01` for `== 0`;
4. forward the masked value and the comparison result into that single consumer.

No new pass, allocator, block, label, helper or optimizer framework is introduced.

**Measured starting evidence (2026-11-13, tree `89125842`):** every non-`1` materialized Boolean form
fails `E10245` on all four cooperative profiles. Mainline equivalents retain the masked byte and then
materialize with `CMP #$01; LDA #$00; ADC #$00`.

**Excluded machinery:** no NMI proof relaxation, no inline branch materialization, no runtime
boolean helper, no frozen specification edit, no multi-sample support.

## Document Index

| Document | Purpose |
|---|---|
| [Ambiguity register](00-ambiguity-register.md) | Delivered masks, threshold, rejected alternatives, remaining restrictions |
| [Requirements delta](01-requirements.md) | Exact issue #148 relationship and acceptance |
| [Current state](02-current-state.md) | Reproduced witnesses, exact mainline retention, seams |
| [Design](03-design.md) | Selection/lowering rules, threshold proof, exact costs |
| [Testing strategy](07-testing-strategy.md) | Spec, impl and VICE cases |
| [Execution plan](99-execution-plan.md) | Sole task-progress checklist |
| [Preflight report](00-preflight-report.md) | Independent findings and dispositions |
| [Closeout](08-closeout.md) | Delivered boundary, measured costs, residual finding |

## Quick Reference

After this plan, `flag = ((read() & 2) != 0)` and `flag = ((read() & 4) != 0)` build with zero
private storage on `c64-{pal|ntsc}-prg-kernal-{6581|8580}`, in both polarities, including an elided
single-use local. The emitted handler is `LDA $DD0D; AND #mask; LSR ×k; [EOR #$01]; STA flag`.

A handler that retains several samples, or materializes a Boolean from a constant mask other than
`1`, `2`, or `4`, or from a runtime mask, still fails `E10245` and is recorded with a live owner.

## Exit Boundary

Issue #148 is done only when masks `2` and `4` build on all four cooperative profiles, emitted
assembly and selected-CPU path-max bytes/cycles meet or beat the expert branch materialization, sequential VICE
proves a genuine Timer B NMI for the mask-`2` form, the multi-sample and remaining-mask negatives
still fail, the ledger and docs record the exact boundary with a live owner, the complete compiler
suite and affected root suites are green, `spec/` is untouched, and the green tree is committed
without a push.
