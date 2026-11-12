# RD-08 NMI Residual Source Reads Plan

> **Feature**: Close the remaining ordinary NMI source-read restrictions
> **Status**: Done — 29/29 tasks; final verification recorded
> **Created**: 2026-11-12
> **Implements**: blend65-v4/RD-08; closes issue #147
> **CodeOps Artifact Schema**: 1

## Overview

Issue #100 delivered the global-assignment and masked-bit-condition forms, but four ordinary source
forms still fail `E10245` because the compiler allocates compiler-invented private storage:

| Form | Current failure |
|---|---|
| `if (read() != 0)` | one retained-value temporary |
| `flag = ((read() & 1) != 0)` | two retained-value temporaries |
| `if ((read() & maskGlobal) != 0)` | one retained-value temporary |
| `let sample: byte = read(); ...` | one local home |

All four have a register-only expert sequence. This plan delivers them without relaxing the NMI
private-home proof, without touching `spec/`, and without adding storage after SFA closure.

The bounded result is `VICE-verified / hardware-unverified`. Multi-retained samples remain a real
negative; a Boolean value from a mask other than `1` remains tracked as a separate restriction.

## Minimum-Sufficient Baseline

**Original goal:** close issue #147's four expressiveness forms on every cooperative profile.

**Smallest viable design:** four narrow rules on existing seams:

1. a direct volatile byte read can own the Z flag for an adjacent zero test;
2. `AND #1` already produces `0`/`1`, so `(x & 1) != 0` is the value itself;
3. a direct byte read can stay in A when the other bitwise operand is a directly addressable byte;
4. an NMI handler's single-use byte local is eliminated before SFA closure when its initializer is a
   direct byte read and its only consumer is adjacent.

No new pass, allocator, runtime, dispatcher or optimizer framework is introduced.

**Measured starting evidence (2026-11-12, tree `a9f3026c`):** all four forms fail `E10245` on all
four cooperative profiles. Mainline equivalents emit the retention pair (or local home) that the NMI
proof rejects.

**Excluded machinery:** no NMI proof relaxation, no general local elision outside NMI, no runtime
boolean helper, no frozen specification edit, no takeover source-NMI work.

## Document Index

| Document | Purpose |
|---|---|
| [Ambiguity register](00-ambiguity-register.md) | Decisions, rejected alternatives, remaining restrictions |
| [Requirements delta](01-requirements.md) | Exact issue #147 relationship and acceptance |
| [Current state](02-current-state.md) | Reproduced witnesses, seams and baseline |
| [Design](03-design.md) | Four rules, proof obligations, output and costs |
| [Testing strategy](07-testing-strategy.md) | Spec, impl and VICE cases |
| [Execution plan](99-execution-plan.md) | Sole task-progress checklist |
| [Preflight report](00-preflight-report.md) | Independent findings and dispositions |
| [Closeout](08-closeout.md) | Delivered boundary, measured costs, residual finding |

## Quick Reference

After this plan, all four forms build with zero private storage on
`c64-{pal|ntsc}-prg-kernal-{6581|8580}` and emit the expert sequence. A handler that retains several
samples, or that needs a Boolean from a mask other than `1`, still fails `E10245` and is recorded.

## Exit Boundary

Issue #147 is done only when all four forms build on all four cooperative profiles, emitted assembly
matches the expert sequences, sequential VICE proves the handler values and return, the multi-retained
negative still fails, the ledger and docs record the exact remaining restriction with a live owner,
the complete compiler suite and root affected suites are green, and `spec/` is untouched.
