# Compiler-Wide Optimization Initiative

> **Feature**: Systematic optimization improvements across all compiler stages
> **Status**: Planning Complete
> **Created**: 2026-02-16
> **Source**: External analysis of `spinning-line` O3 output + internal compiler audit

## Overview

An external analysis of the spinning-line example's O3 assembly output revealed several optimization opportunities. Cross-referencing with the compiler's actual infrastructure uncovered both gaps and existing capabilities that aren't fully utilized.

This plan addresses **compiler-wide quality improvements** — not isolated O3 patches. Each optimization is implemented at the correct compiler stage and enabled at the appropriate optimization levels. The improvements benefit ALL Blend programs, not just spinning-line.

## Optimization Themes

| ID | Theme | Compiler Stage | Opt Level | Impact |
|----|-------|---------------|-----------|--------|
| **A** | Label arithmetic folding through inlined params | IL Optimizer | O1+ | ⭐ Very High |
| **C** | Power-of-2 modulo → AND bitmask | IL Peephole | O1+ | ⭐ High |
| **F** | Post-inlining parameter store/reload elimination | IL Peephole / Inliner | O1+ | ⭐ High |
| **G** | SHR_WORD narrowing when followed by LO() | IL Peephole | O1+ | Medium |
| **H** | For-loop register promotion (INC+CMP → DEX/BNE) | ASM Optimizer | O1+ | ⭐ Very High |
| **J** | Constant propagation through inlined arguments | IL Optimizer | O1+ | Medium |
| **CG** | SHR_WORD codegen quality improvement | Codegen | ALL (O0+) | High |

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | Optimization requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of current compiler capabilities |
| 03 | [Codegen Quality](03-codegen-quality.md) | SHR_WORD and code generation improvements |
| 04 | [IL Optimizer](04-il-optimizer.md) | Label folding, modulo→mask, SHR+LO, const prop |
| 05 | [ASM Optimizer](05-asm-optimizer.md) | Register promotion, backend peepholes |
| 06 | [Inliner Improvements](06-inliner.md) | Post-inlining store/reload cleanup |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test programs and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Key Decisions

| Decision | Outcome |
|----------|---------|
| Implementation order | Codegen (O0) → IL Optimizer (O1+) → ASM Optimizer → Inliner |
| Test strategy | New targeted example programs + existing spinning-line/balloon-sprite |
| Scope | ALL optimization levels where relevant, not just O3 |
| Negative tests | Must verify non-power-of-2 modulo is NOT optimized |

## Related Files

### Existing Infrastructure
- `packages/compiler/src/optimizer/passes/il-peephole.ts` — IL peephole pass
- `packages/compiler/src/optimizer/passes/constant-fold.ts` — Constant folding
- `packages/compiler/src/optimizer/passes/constant-prop.ts` — Constant propagation
- `packages/compiler/src/optimizer/passes/function-inlining.ts` — Function inliner
- `packages/compiler/src/optimizer/passes/licm/` — Loop invariant code motion
- `packages/compiler/src/codegen/generator/bitwise.ts` — SHR_WORD codegen
- `packages/compiler/src/codegen/asm-il/optimizer/passes/register-promote.ts` — Register promotion
- `packages/compiler/src/codegen/asm-il/optimizer/passes/store-load.ts` — Store/load elimination

### Existing Plans (overlap)
- `plans/spinning-line-diag-fixes/` — Bug #2 (store/reload) is a subset of Theme F
- `plans/codegen-audit-fixes/` — Some inlining fixes overlap with Theme F

### Test Programs
- `examples/spinning-line/main.blend` — Primary benchmark (existing)
- `examples/balloon-sprite/main.blend` — Secondary benchmark (existing)
- New targeted test programs in testing strategy document
