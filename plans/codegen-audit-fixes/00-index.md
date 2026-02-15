# Codegen Audit Fixes — Implementation Plan

> **Feature**: Fix 12 code generation bugs discovered by comprehensive assembly audit
> **Status**: Planning Complete
> **Created**: 2025-02-15
> **Source**: `bug-list.md` — full audit of `examples/spinning-line/main.blend` at O0-O3/Os/Oz

## Overview

A comprehensive audit of the Blend65 compiler's assembly output at all six optimization levels
(O0, O1, O2, O3, Os, Oz) uncovered **12 unique bugs** across 4 categories:

1. **Core Codegen** (C1-C3): Multi-argument passing and constant resolution — broken at ALL levels
2. **Inlining** (I1-I4): Ghost instructions, missing CLC, dead code — O1/O2/O3
3. **Loop Unrolling** (L1-L3): Corrupted unrolling, duplicate labels — O2/O3
4. **Optimizer** (O1-O2): barrier() not respected, flag clobbering — O2/O3

The core codegen bugs (C1, C2) make ANY compiled program with multi-arg functions or
constant comparisons produce wrong code at every optimization level. These are P0 critical.

## Document Index

| #  | Document                                         | Description                              |
|----|--------------------------------------------------|------------------------------------------|
| 00 | [Index](00-index.md)                             | This document — overview and navigation  |
| 01 | [Requirements](01-requirements.md)               | Feature requirements and scope           |
| 02 | [Current State](02-current-state.md)             | Root cause analysis per bug              |
| 03 | [Core Codegen Fixes](03-core-codegen.md)         | Fix C1 (multi-arg) + C2 (const cond)    |
| 04 | [Loop Unroller Fixes](04-loop-unroller.md)       | Fix L1-L3 + O1 + O2 (unroller rewrite)  |
| 05 | [Inlining Fixes](05-inlining.md)                 | Fix I1-I4 (ghost instrs, dead code)     |
| 07 | [Testing Strategy](07-testing-strategy.md)       | Test cases and verification              |
| 99 | [Execution Plan](99-execution-plan.md)           | Phases, sessions, and task checklist     |

## Quick Reference

### Priority Order

| Priority | Bugs      | Impact                                    |
|----------|-----------|-------------------------------------------|
| **P0**   | C1, C2    | All levels broken — programs produce wrong results |
| **P1**   | L1-L3, O1, O2 | O2/O3 produce corrupt or un-assemblable code |
| **P2**   | I3, I4, I1 | O1-O3 inlining produces ghost/wrong instructions |
| **P3**   | I2        | Minor: redundant JMP wastes 3 bytes per inline site |

### Key Decisions

| Decision                          | Outcome                                              |
|-----------------------------------|------------------------------------------------------|
| Fix order                         | P0 core → P1 unroller → P2 inlining → P3 quality    |
| Unroller approach                 | Disable unroller, then re-enable with correctness fixes |
| Regression testing                | Compile spinning-line at all 6 levels after each phase |

## Related Files

### Core Codegen (Bugs C1, C2, C3)
- `packages/compiler/src/il/generator/expressions.ts` — `generateCallArguments()`
- `packages/compiler/src/il/generator/control-flow.ts` — `generateConditionWithBranch()`

### Optimizer (Bugs L1-L3, O1, O2)
- `packages/compiler/src/optimizer/passes/loop-unroll/base.ts`
- `packages/compiler/src/optimizer/passes/loop-unroll/analysis.ts`
- `packages/compiler/src/optimizer/passes/loop-unroll/loop-unroll-pass.ts`

### Inlining (Bugs I1-I4)
- `packages/compiler/src/optimizer/passes/function-inlining.ts`
- `packages/compiler/src/optimizer/passes/dead-function-elim.ts`
- `packages/compiler/src/optimizer/passes/il-peephole.ts`

## Bug Reference

Full bug catalog with ASM evidence: [`bug-list.md`](../../bug-list.md)
