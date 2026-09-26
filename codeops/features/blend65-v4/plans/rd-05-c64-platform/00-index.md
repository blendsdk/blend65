# RD-05 C64 Platform — Stage A Plan

> **Feature**: Cooperative C64 profiles and compile-time profile facts
> **Status**: Planning Complete for Stage A; preflight pending; full RD-05 planning incomplete
> **Created**: 2026-09-27
> **Implements**: blend65-v4/RD-05
> **CodeOps Artifact Schema**: 1

## Overview

Stage A extends the existing cooperative compiler path to PAL and later NTSC, each with a
6581 or 8580 SID. Programs can use the selected machine's facts as ordinary constants. This
is the independently settled first part of RD-05, not the complete platform implementation.

The user approved staged planning in AR-P3. Positive NMI safety remains an unresolved,
explicitly deferred RD-05 obligation. This document set neither authorizes its implementation
nor declares the complete RD ready. The scope owner is [01-requirements.md](01-requirements.md).

## Minimum-Sufficient Baseline

**Original goal:** Continue RD-05 without overengineering, preserving modern source ergonomics,
expert-quality output and the frozen language.

**Smallest viable design:** A closed fact table feeds existing frontend constants and selected
target facts. Reuse constant evaluation, mandatory branch removal, startup/layout, version-1
evidence, ACME and the current sequential VICE tests. AR-P4–AR-P8 own these choices.

**Excluded machinery:** Configurable profile registry, runtime profile dispatch, rational-number
runtime, new optimization pass, evidence schema, runner and interrupt dispatcher.

**Approved complexity:** None beyond the direct feature data and bounded existing test controls
in AR-P6/AR-P8. A materially larger support surface requires a new decision.

## Document Index

| Document | Owner |
|---|---|
| [Ambiguity register](00-ambiguity-register.md) | Decisions and the named NMI deferral |
| [Requirements delta](01-requirements.md) | Stage boundary and retained RD ownership |
| [Current state](02-current-state.md) | Observed implementation and gaps |
| [Profile facts](03-01-profile-facts.md) | Source bindings and constant semantics |
| [Cooperative pipeline](03-02-cooperative-pipeline.md) | Target, startup, evidence and emulator identity |
| [Testing strategy](07-testing-strategy.md) | Independent input → expected-output cases |
| [Execution plan](99-execution-plan.md) | Sole task-progress authority |

## Quick Reference

For ordinary source usage, see [Profile facts — Source contract](03-01-profile-facts.md#source-contract).
For exact target identities and emulator settings, see
[Cooperative pipeline — Selected identities](03-02-cooperative-pipeline.md#selected-identities).

The execution plan has three dependent phases. It must pass a scoped preflight before execution.
Finishing Stage A leaves RD-05 open; the handoff must identify the next independently plannable
platform work and retain the AR-P3 decision with its existing revisit trigger.

## Authority

Frozen Specification 4 and the explicit decisions in the register govern behavior. Expert baseline
`2.0.0`, content commit `c9e70fab6039e9ced3108e88f0ea9730d4fd3007`, governs the domain review.
The current normative content digest is
`ee2be7c2139ff82f22d1d8f169251bae1d2244e5e4a74bddbdfc4903af39fff8`; RD-04's approved diagnostic
erratum does not authorize changing the frozen expert release record.

Current code is evidence, not authority. No compiler, test, specification or expert content was
changed by creating this plan. Local commits follow project policy; pushing is never automatic.
