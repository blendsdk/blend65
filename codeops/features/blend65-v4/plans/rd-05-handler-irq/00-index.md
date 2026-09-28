# RD-05 Handler-Side IRQ Updates

> **Feature**: Safe temporary IRQ installation from a running handler
> **Status**: Complete — bounded IRQ slice verified
> **Created**: 2026-09-27
> **Implements**: blend65-v4/RD-05
> **CodeOps Artifact Schema**: 1

## Overview

An IRQ handler may temporarily install another handler, then restore the previous vector.
This plan removes the blanket rejection of that ordinary source form while retaining exact
ownership, finite interrupt nesting and static storage safety. It implements the bounded IRQ
portion of RD-05, not all remaining platform work.

## Minimum-Sufficient Baseline

**Original goal:** finish the handler-side IRQ capability carried from RD-04 as DEF-8.
**Smallest viable design:** extend the current ownership/context records, selected-instruction
IRQ walk, SFA interference and machine specialization. Installation links and private handler
storage have separate lifetimes. See [the selected design](03-handler-irq.md) and AR-P2.
**Excluded machinery:** runtime manager/dispatcher, new graph framework, early instruction
skeleton, outer re-lowering loop, new harness and dependency.
**Approved complexity:** none beyond the direct extension; a larger mechanism requires a new
explicit complexity ruling. Scope and authority are owned by [AR-P1–AR-P10](00-ambiguity-register.md).

## Document Index

| Document | Owns |
|---|---|
| [Ambiguity register](00-ambiguity-register.md) | Decisions and exact old-test permissions |
| [Requirements delta](01-requirements.md) | This slice's boundary within RD-05 |
| [Current state](02-current-state.md) | Grounded code inventory |
| [Handler IRQ design](03-handler-irq.md) | Compiler contracts and failure handling |
| [Testing strategy](07-testing-strategy.md) | Independent input-to-result cases and verification |
| [Closeout evidence](08-closeout.md) | Qualified route, cost, review and deferral evidence |
| [Execution plan](99-execution-plan.md) | Sole task-progress checklist |

## Quick Reference

The direct source form is `setIRQ(&next); restoreIRQ();` inside an interrupt function or its
ordinary helper. Legal nesting and invalid counterexamples are specified in the testing strategy,
not inferred from this example. Only the four already qualified cooperative C64 profiles are in
scope. NMI remains separate under AR-P4.

One implementation phase kept the ownership, storage and emitted-entry changes together.
Independent specifications preceded implementation. The bounded IRQ capability is verified
by source, storage, emitted-output and sequential VICE cases. RD-05 and NMI work remain open.
