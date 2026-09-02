# RD-08 Complete C64 Rule Coverage Implementation Plan

> **Feature**: Complete C64 rule dispositions and generated semantic compiler coverage
> **Status**: Planning Complete
> **Created**: 2026-09-02
> **Implements**: compiler-readiness/RD-08
> **CodeOps Artifact Schema**: 1

## Overview

RD-08 expands the readiness seed from nine scalar/memory rules to the complete 2,112-rule C64
denominator. Its first phase deliberately starts with real generated Blend programs for arrays,
calls, branches and bounded loops so that the work exercises meaningful compiler semantics before
any denominator-wide publication work. Later phases classify every rule, add the remaining bounded
source/non-source evidence, run declared public routes and publish complete evidence.

The design is additive and local. It reuses the current independent generator, oracle, publication
and execution seams; it adds no dependency, generalized framework, optimizer profile, compiler
fix or readiness-execution subsystem. Normal development retains a hard-capped smoke selection,
while exhaustive and VICE campaigns remain explicit. (AR-1, AR-4, AR-7, AR-8)

## Document Index

| # | Document | Description |
|---|---|---|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions |
| 00 | [Index](00-index.md) | Overview and navigation |
| 01 | [Requirements](01-requirements.md) | RD delta and plan boundary |
| 02 | [Current State](02-current-state.md) | Grounded implementation analysis |
| 03-01 | [Vertical Generated Programs](03-01-vertical-generated-programs.md) | Phase-1 IR, source and semantics |
| 03-02 | [Rule Families and Dispositions](03-02-rule-families-dispositions.md) | Complete denominator model |
| 03-03 | [Publication and Execution](03-03-publication-execution.md) | Evolution, routes and evidence |
| 03-04 | [Smoke, Routing and Closeout](03-04-smoke-routing-closeout.md) | Fast gate, ownership and closure |
| 07 | [Testing Strategy](07-testing-strategy.md) | Concrete immutable ST cases |
| 99 | [Execution Plan](99-execution-plan.md) | Six bounded phases and task checklist |

## Quick Reference

### First vertical program shape

```blend
module ReadinessVertical;

function add(a: byte, b: byte): byte { return a + b; }
function nested(v: byte): byte { return add(add(v, 1), 2); }

function main(): void {
  let values: byte[4] = [1, 2, 3, 4];
  let total: byte = 0;
  for (let i: byte = 0 to 3) {
    if (values[i] > 1) { total = total + values[i]; } else { total = nested(total); }
  }
  poke($C000, total);
}
```

This is illustrative; the immutable inputs and expected observations live only in
`07-testing-strategy.md`. (AR-2, AR-3)

### Key Decisions

| Decision | Outcome |
|---|---|
| First work delivered | Real array/call/branch/loop programs and independent expected state (AR-2) |
| First population | Exact ST-owned inventory IDs in `firstVerticalRuleIds` (AR-3) |
| Structure | Small companion modules around existing closed seams (AR-4) |
| Publication | Cases first; minimal evolution before changed selection (AR-5) |
| Full denominator | Bounded family/evidence phases (AR-6) |
| Development cost | Maximum 4 smoke cases/family and 16 total (AR-7) |

## Related Files

- `packages/readiness/src/generator-ir.ts`
- `packages/readiness/src/structured-ir-validation.ts`
- `packages/readiness/src/structured-source-renderer.ts`
- `packages/readiness/src/structured-case-families.ts`
- `packages/readiness/src/structured-oracle-evaluator.ts`
- `packages/readiness/src/rule-family-model.ts`
- `packages/readiness/src/terminal-rule-disposition.ts`
- `packages/readiness/src/readiness-smoke-selection.ts`
- `packages/readiness-execution/src/structured-generated-programs.spec.test.ts`
- `readiness/rule-models/` and `readiness/publications/`
