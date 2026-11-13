# RD-08 NMI Boolean Mask Materialization Plan

> **Feature**: Materialize the remaining NMI Boolean mask forms without private storage
> **Status**: Done — 30/30 tasks; final verification recorded
> **Created**: 2026-11-13
> **Implements**: blend65-v4/RD-08; closes issue #149
> **CodeOps Artifact Schema**: 1

## Overview

Issue #148 delivered constant masks `2` and `4` as branchless shift-normalized Booleans. Every
other materialized Boolean from a bit test still fails `E10245`:

- single-bit constant masks `8` and above, where the shift chain exceeds the expert's path-max
  cycles;
- multi-bit constant masks (`3`, `6`, …), which a shift cannot normalize;
- the zero constant mask, which is a constant fold;
- a runtime addressable mask, which has no fixed shift count;
- a wider-than-byte operand, which needs a zero-extension proof;
- a masked value shared by several consumers and several simultaneously retained samples, which
  need storage the private-home-free route does not provide.

The first five are materialization gaps. The expert hand-written sequence for a nonzero mask is:

```asm
lda read
and #mask
beq done
lda #1
done: sta flag
```

That is an inline branch, not a private home. This plan adds one inline machine-block
materialization for a modeled `== 0`/`!= 0` comparison, folds `x & 0`, and proves the high byte of
a byte-masked word is zero so only the low byte is tested. No storage request is created; the NMI
private-home proof is unchanged.

The two retention classes are a different subsystem: they need bounded storage live across
consumers or volatile reads. They are re-owned by a follow-up issue before this issue closes.

Two branch forms are `VICE-verified / hardware-unverified` on PAL/6581; the fold, runtime-mask and
word forms have four-profile assembled-byte evidence only.

## Minimum-Sufficient Baseline

**Original goal:** materialize every remaining Boolean mask form that can meet or beat the expert
without relaxing the NMI private-home proof.

**Smallest viable design:**

1. select a single-use byte (or zero-extended word) `&` with a nonzero mask, whose sole consumer is
   a materialized `== 0`/`!= 0` with one A consumer;
2. lower the comparison to the expert branch shape:
   `BEQ done; LDA #1; done:` for `!=`, and `BEQ zero; LDA #1; zero: EOR #1` for `==`;
3. fold `x & 0` to constant zero and materialize the comparison as `LDA #0`/`LDA #1`;
4. accept a zero-extended word masked value and test only its low byte;
5. elide a single-use constant local in the NMI domain so the issue's `let w: word = 2` form has no
   home.

No new pass, allocator, storage class or optimizer framework is introduced. The branch blocks are
the same structured machine blocks used by checked division and guarded shifts.

**Measured starting evidence (2026-11-13, tree `9c41b8a9`):** masks `8`, `3`, `0`, a runtime mask,
a word global and both word locals all fail `E10245` in the NMI domain. Mainline equivalents retain
the masked and comparison bytes.

**Excluded machinery:** no NMI proof relaxation, no stack-retention class, no multi-sample support,
no shared-value allocation, no frozen specification edit, no physical-hardware claim.

## Document Index

| Document | Purpose |
|---|---|
| [Ambiguity register](00-ambiguity-register.md) | Delivered forms, expert threshold, residual ownership |
| [Requirements delta](01-requirements.md) | Exact issue #149 relationship and acceptance |
| [Current state](02-current-state.md) | Reproduced witnesses, mainline retention, seams |
| [Design](03-design.md) | Selection/lowering rules, block shapes, exact costs |
| [Testing strategy](07-testing-strategy.md) | Spec, impl and VICE cases |
| [Execution plan](99-execution-plan.md) | Sole task-progress checklist |
| [Preflight report](00-preflight-report.md) | Independent findings and dispositions |
| [Closeout](08-closeout.md) | Delivered boundary, measured costs, residual owner |

## Quick Reference

After this plan, `flag = ((read() & 8) != 0)`, the `== 0` inverse, multi-bit masks, the zero mask,
an addressable runtime mask, the all-ones mask, and a byte-masked word (mask `1` identity, mask `2`
shift, other byte masks branch) build with zero private storage on all four cooperative profiles.
The emitted handler is the expert branch, identity, shift or constant load.

A masked value shared by several consumers, several simultaneously retained samples, a 16-bit word
mask, a runtime word local that needs a zero-extension staging home, a computed runtime mask, and a
masked value compared to a nonzero constant still fail `E10245` and are recorded with a live
follow-up owner (#150).

## Exit Boundary

Issue #149 is done only when the materialized forms build on all four cooperative profiles, emitted
assembly and path-max costs meet or beat the expert branch, sequential VICE proves a genuine NMI for
at least one delivered branch form, the retention negatives still fail, the ledger and docs record
the exact boundary with a live owner, the complete compiler suite and affected root suites are
green, `spec/` is untouched, and the green tree is committed without a push.
