# Compiler Stress Testing & Bug Fix Plan

> **Feature**: Comprehensive bug fixes + real-world full-pipeline E2E stress tests
> **Status**: ✅ COMPLETE
> **Created**: 2025-10-02
> **Completed**: 2025-11-02
> **Triggered by**: sprite-test.blend and border-cycle compilation failures
> **Final Results**: 6 bugs fixed, 20 E2E scenarios, 8568 tests passing (0 failures)

## Overview

This plan addresses **6 confirmed bugs** discovered when compiling real-world C64 programs
(sprite-test.blend, border-cycle/main.blend) and creates a comprehensive **real-world
stress test suite** that exercises the ENTIRE compiler pipeline (lexer → parser → semantic →
frame → IL → optimizer → codegen → asmOpt → emit) using realistic C64 game/demo scenarios.

**Key Principle:** Isolated unit tests DO NOT catch interaction bugs between compiler phases.
Only real-world representative programs exercising multiple phases simultaneously will expose
the deep interaction bugs that cause wrong code generation.

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document - overview and navigation |
| 01 | [Requirements](01-requirements.md) | All bugs, gap categories, and test requirements |
| 02 | [Current State](02-current-state.md) | Confirmed bugs with root cause analysis |
| 03 | [Bug Fixes](03-bug-fixes.md) | Technical fix specifications for all 6 bugs |
| 04 | [Test Scenarios](04-test-scenarios.md) | Real-world E2E test programs (40+ scenarios) |
| 07 | [Testing Strategy](07-testing-strategy.md) | Assembly verification approach |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### Confirmed Bugs

| # | Bug | Phase | Root Cause |
|---|-----|-------|-----------|
| 1 | False "unused variable 'i'" warning | Semantic | UsageWalker missing scope tracking for 7 constructs |
| 2 | "Expected address operand" crash | Codegen | No dynamic-address POKE/PEEK handler |
| 3 | Inlined function not removed | Optimizer | DFE runs before inlining, never after |
| 4 | `color += 1` missing from assembly | Codegen/Optimizer | Compound assignment lost |
| 5 | `color = 0` stores wrong value | Codegen | Missing LDA #$00 before STA |
| 6 | Inlined loop counters don't re-init | Optimizer/Inlining | Init code outside loop not re-executed |

### Bug Classes to Test (ALL CRITICAL)

| Class | Category | Coverage |
|-------|----------|----------|
| 1 | Type Coercion / Width Promotion | byte↔word, signed/unsigned, overflow |
| 2 | Register State / Accumulator Tracking | A/X/Y clobbering across boundaries |
| 3 | Control Flow Correctness | break/continue/return in nested scopes |
| 4 | Memory Layout / Frame Allocation | ZP collisions, array bounds, globals |
| 5 | Multi-Module Interaction | imports, cross-module constants |
| 6 | Optimizer Phase Interactions | DFE+inline, DCE+side-effects, CSE+volatile |
| 7 | Complex Expression Codegen | nested ternary, compound assignment |
| 8 | ASM-Level / Peephole Optimizer | pattern correctness, branch distance |
| 9 | Intrinsic Edge Cases | nested poke/peek, barrier, volatile |
| 10 | Stack / Calling Convention | parameter passing, return values, recursion |

## Related Files

- `examples/sprite-test/sprite-test.blend` — triggered Bugs 1, 2
- `examples/border-cycle/main.blend` — triggered Bugs 3, 4, 5, 6
- `packages/compiler/src/semantic/analysis/advanced-analyzer.ts` — Bug 1 fix
- `packages/compiler/src/codegen/generator/intrinsics.ts` — Bug 2 fix
- `packages/compiler/src/optimizer/passes/function-inlining.ts` — Bug 3 fix
- `packages/compiler/src/il/generator/expressions.ts` — Bug 2 IL side
- `packages/compiler/src/optimizer/options.ts` — Bug 3 pass ordering
