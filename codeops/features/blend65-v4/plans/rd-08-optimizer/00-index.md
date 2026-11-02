# Full RD-08 Optimizer Implementation Plan

> **Feature**: A shared optimization pipeline that makes the correct `none` compiler produce smaller, still-equivalent C64 output, with `size` reaching the saved 725 and acquisition 963 workloads.
> **Status**: Executing — Phase 1 GREEN; saved 725 RED; 16/41 tasks
> **Created**: 2026-11-01 16:31
> **Implements**: `blend65-v4/RD-08`
> **CodeOps Artifact Schema**: 1

## Overview

RD-08 is the optional optimization layer above the correct `none` compiler. The
stopped whole-input slice proved the candidate/evidence mechanics but left
1623 bytes for saved and 2442 for acquisition against 725/963. Compact-startup
composition and observer cleanup now select a 1034-byte saved candidate; the
remaining gap is the query/caller forwarding and address-form tranche. The missing work
is a reusable optimizer, not another fixed recipe family.

This plan builds one immutable optimization-facts bundle and an explicit ordered
machine-rule pipeline inside the existing lowering producer. Rules return their
own behavior, effect, alias, layout and cost obligations. The existing
storage/SFA closure, final observers, evidence schema and VICE route remain the
authorities; no new IR, SSA, runtime, dependency or ACME-text rewriting is added.

`size` is qualified first against the two real workloads. `balanced` and `speed`
are then added on the same B/R/T pipeline. The correctness `none` compiler is a
separate release track and must not depend on this plan.

## Minimum-Sufficient Baseline

**Original goal:** Complete the optimizer so the saved-query workload fits 725
bytes and the acquisition workload fits 963 bytes, while preserving every
behavior, ABI, interrupt, MMIO, placement, resource and evidence obligation.

**Smallest viable design:** Reuse the existing semantic `WholeProgram`, machine
lowering, SFA closure and final observers. Add one shared facts bundle, one
ordered rule runner, per-rule obligations and complete B/R/T evidence. Add no
new IR or pass framework.

**Excluded machinery:** New optimizer IR/SSA, plugin/pass registry, rule DSL,
runtime, scheduler, game policy, new dependency, ACME-text peepholes, and
benchmark-name recognition.

**Approved complexity:** AR-003, AR-006, AR-007 and AR-008 in the
[Ambiguity Register](00-ambiguity-register.md).

## Document Index

| # | Document | Description |
|---|---|---|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions |
| 00 | [Index](00-index.md) | This document |
| 01 | [Requirements](01-requirements.md) | RD-08 delta scope and plan-local decisions |
| 02 | [Current State](02-current-state.md) | Existing pipeline, reusable facts and measured gaps |
| 03-01 | [Facts and Pipeline](03-01-facts-and-pipeline.md) | Shared facts, rule runner, lowering integration |
| 03-02 | [Rules and Obligations](03-02-rules-and-obligations.md) | Rule catalogue, proof obligations and per-rule acceptance |
| 03-03 | [Cost, Modes and Evidence](03-03-cost-modes-and-evidence.md) | B/R/T, mode selection, evidence and debug |
| 07 | [Testing Strategy](07-testing-strategy.md) | Spec cases, benchmark gates and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, tasks and progress authority |

## Quick Reference

### Usage Examples

The public build modes remain `none` and, while experimental, `size`. The
optimizer does not add source syntax or a tuning API.

```text
blendc build --optimization none   # correctness release baseline
blendc build --optimization size   # experimental optimizer tier
```

### Key Decisions

| Decision | Outcome |
|---|---|
| Optimizer shape | Shared immutable facts + ordered machine rules inside the lowering producer |
| Provenance | Rules run before `projectMachineStorage`; sealed programs are never rewritten afterward |
| Proof model | Per-rule obligations; untouched code keeps canonical fallback/proof; no weakened oracle |
| Cost | Existing B/R/T schema; `size` orders B → R → T; unknown is never zero or a tie |
| Modes | Size first; balanced/speed on the same pipeline afterward |
| Release | `none` ships independently; `size` remains experimental until measured |
| Limits | 963/725 stay unchanged as optimizer targets; no limit or test is deleted |
| New surface | Facts ≤600, rules ≤700, cost ≤400, focused tests; no new dependency/runtime/public API |

## Specialist Agents

| Role | Kind | Use | AR Ref |
|---|---|---|---|
| `machine-code-auditor` | Existing reviewer | Every machine-rule phase and the saved/acquisition cost gates | AR-003, AR-008 |
| `sfa-abi-auditor` | Existing reviewer | SFA, ABI, returns, interrupt/frame obligations | AR-003, AR-007 |
| `target-platform-auditor` | Existing reviewer | MMIO, NMI/IRQ, banking, visibility and VICE claims | AR-015 |
| `correctness-reviewer` | Existing reviewer | Phase diffs, provenance, tests and scope | AR-011 |
| `semantics-reviewer` | Existing reviewer | Behavior preservation and expressiveness | AR-002, AR-012 |
| `performance-auditor` | Existing reviewer | Host-time/RSS of optimization and candidate evaluation | AR-010 |

No new specialist role is proposed. The capability-gap check found that the
existing output, SFA/ABI, platform, correctness, semantics and performance roles
cover the plan; adding another role would duplicate ownership without a bounded
missing capability.

## Related Files

- `codeops/features/blend65-v4/requirements/RD-08-optimization-and-expert-output.md`
- `codeops/features/blend65-v4/plans/whole-input-cost-closure/`
- `packages/compiler/src/machine/optimization-facts.ts` (new)
- `packages/compiler/src/machine/optimization-rules.ts` (new)
- `packages/compiler/src/machine/optimization-cost.ts` (new)
- `packages/compiler/src/machine/lower.ts`
- `packages/compiler/src/services/size-selection.ts`
- `packages/compiler/src/services/evidence.ts`
- `packages/compiler/src/services/size-observers.ts`
- `packages/compiler/src/storage/selection.ts`
- `packages/compiler/src/layout/c64-layout.ts`
