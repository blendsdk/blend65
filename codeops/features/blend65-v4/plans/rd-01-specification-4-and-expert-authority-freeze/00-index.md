# Specification 4.0 and Expert Authority Freeze Implementation Plan

> **Feature**: Replace the active language and expert authorities with one qualified C64-only
> Specification 4.0 baseline
> **Status**: Planning Complete
> **Created**: 2026-09-13
> **Implements**: blend65-v4/RD-01
> **CodeOps Artifact Schema**: 1

## Overview

This plan turns the approved Blend65 v4 language decisions into one active Specification 4.0 tree,
then reconciles and qualifies the single active `blend65-domain-expert` skill as version `2.0.0`.
The work freezes exact content identities before any v4 compiler semantics are implemented.

The transition preserves unchanged Specification 3 behavior, replaces only behavior authorized by
the v4 ambiguity register, makes C64 the only normative target family, and records a checked P3→4
crosswalk. Existing compiler code remains audit evidence, never semantic authority.

## Minimum-Sufficient Baseline

**Original goal:** Publish one internally consistent, qualified Specification 4.0 and one matching
expert `2.0.0` authority that later RDs can implement without semantic drift.

**Smallest viable design:** Edit the existing `spec/` tree in place; reuse the current Markdown
expert references, five casebooks, coverage matrix, composed-evidence qualification, and one active
release record; add only the normative inventory, plan-local oracle/evidence files, new required
cases, and RD closeout. See AR-P1, AR-P3, AR-P5, and AR-P6.

**Excluded machinery:** No parallel spec tree, compiler changes, generalized documentation or test
framework, evidence database, new runtime, target plugin system, evaluator service, or second skill
release tree. See AR-P1, AR-P3, and RD-01 Won't Have.

**Approved complexity:** Eight bounded execution phases and the normalized content-identity rule.
See AR-P2 and AR-P5.

## Document Index

| # | Document | Description |
|---|---|---|
| AR | [Ambiguity Register](00-ambiguity-register.md) | All six resolved plan decisions |
| 00 | [Index](00-index.md) | Goal, minimum design, and navigation |
| 01 | [Requirements](01-requirements.md) | Thin RD-01 scope delta |
| 02 | [Current State](02-current-state.md) | Existing authority and gap analysis |
| 03-01 | [Authority and Identity](03-01-authority-and-identity.md) | Bootstrap, inventory, crosswalk, digest, and freeze records |
| 03-02 | [Core Language Reconciliation](03-02-core-language-reconciliation.md) | Control flow, scope, integers, arrays, aggregates, and addresses |
| 03-03 | [Closed Program Semantics](03-03-closed-program-semantics.md) | Function values, comptime, placement, loading, intrinsics, and safety |
| 03-04 | [C64, Guard, and Diagnostics](03-04-c64-guard-and-diagnostics.md) | Honest target authority and whole-spec integrity |
| 03-05 | [Expert Authority](03-05-expert-authority.md) | Router, knowledge, sources, cases, and product boundary |
| 03-06 | [Qualification and Activation](03-06-qualification-and-activation.md) | Evidence, approval, atomic activation, and closeout |
| 07 | [Testing Strategy](07-testing-strategy.md) | Immutable ST cases and direct verification |
| 99 | [Execution Plan](99-execution-plan.md) | Eight phases and task checklist |

## Quick Reference

### Execution Boundary

Use `codeops:exec-plan` on this plan only. Phases 1–7 prepare and qualify immutable candidate
content. Phase 8 stops for the explicit user approval required by RD-01 R1.24 before the sole active
release record is changed.

### Key Decisions

| Decision | Outcome |
|---|---|
| Planning scope | RD-01 only; implementation starts in RD-02 (AR-P1) |
| Decomposition | Eight reviewable phases (AR-P2) |
| Oracle method | Existing Markdown casebooks and composed evidence (AR-P3) |
| Verification | Direct documentation/skill checks only (AR-P4) |
| Spec identity | Inventory-selected, normalized SHA-256 corpus digest (AR-P5) |
| Artifact owners | Inventory in `spec/`; summary in feature index; crosswalk/freeze in `08-closeout.md` (AR-P6) |

## Related Files

- `spec/**/*.md` and `.clinerules/language-guard.md`
- `.agents/skills/blend65-domain-expert/{SKILL.md,agents,references,qualification}`
- `codeops/features/blend65-v4/requirements/00-ambiguity-register.md`
- `codeops/features/blend65-v4/requirements/RD-01-specification-4-and-expert-authority-freeze.md`
- `codeops/features/blend65-v4/00-phase-0-handoff.md`
- `codeops/features/blend65-v4/00-roadmap.md`
