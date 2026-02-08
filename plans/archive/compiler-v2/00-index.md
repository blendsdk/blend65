# Compiler v2 Implementation Plan

> **Project**: Blend65 Compiler v2
> **Architecture**: Static Frame Allocation (SFA)
> **Status**: Phases 1-8 Complete, Phase 9-10 Pending
> **Created**: January 29, 2026
> **Last Updated**: July 2, 2026

## Overview

The Blend65 v2 compiler uses Static Frame Allocation (SFA) instead of SSA. Implemented as `packages/compiler-v2/`.

## Key Decisions

| Decision | Outcome |
|----------|---------|
| Architecture | Static Frame Allocation (SFA) |
| Recursion | Forbidden (compile error) |
| @map syntax | Removed — use peek/poke intrinsics |
| Migration | New package, salvaged from v1 |
| IL Optimizer | 5 passes (DCE, const-fold, const-prop, copy-prop, peephole) |
| CPU Targets | Strategy pattern (6502 + 65C02) |

## Document Index

### Core Plan Documents

| # | Document | Description | Status |
|---|----------|-------------|--------|
| 00 | [Index](00-index.md) | This document — overview | ✅ |
| 01 | [Requirements](01-requirements.md) | Scope, requirements, acceptance criteria | ✅ |
| 02 | [Salvage Analysis](02-salvage-analysis.md) | What to reuse from v1 (55% reuse) | ✅ |
| 03 | [Package Setup](03-package-setup.md) | New package structure | ✅ |
| 04 | [Lexer Migration](04-lexer-migration.md) | Lexer changes (95% reuse) | ✅ |
| 05 | [Parser Migration](05-parser-migration.md) | Parser changes (85% reuse) | ✅ |
| 06 | [Semantic Migration](06-semantic-migration.md) | Semantic + call graph + recursion check | ✅ |
| 07 | [Frame Allocator](07-frame-allocator.md) | SFA implementation | ✅ |
| 08 | [IL Generator](08-il-generator.md) | Simple linear IL (~25 opcodes) | ✅ |
| 09 | [Code Generator](09-code-generator.md) | SFA-based codegen | ✅ |
| 10 | [ASM Optimizer](10-asm-optimizer.md) | Peephole optimization (O1) | ✅ |
| 11 | [Semantic E2E Fixes](11-semantic-e2e-fixes.md) | Semantic integration fixes | ✅ |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, task checklist | ✅ |

### Sub-Plans (Detailed)

| Sub-Plan | Location | Status | Description |
|----------|----------|--------|-------------|
| **Codegen** | [codegen/](codegen/99-execution-plan.md) | ✅ 100% Complete | 10 phases (CGT1-CGT10), 300+ tests |
| **IL Optimizer** | [il-optimizer/](il-optimizer/99-execution-plan.md) | ✅ 100% Complete | 7 phases, 5 passes, 200+ tests |
| **65C02 Support** | [65c02-support/](65c02-support/99-execution-plan.md) | ✅ 100% Complete | CPU strategy pattern, 170+ tests |
| **ASM-IL Optimizer** | [asm-il-optimizer/](asm-il-optimizer/99-execution-plan.md) | ⬜ 0% Not Started | 7 phases, 32 tasks, 8 optimization passes |

## Current Progress

| Phase | Title | Status |
|-------|-------|--------|
| 1 | Package Setup | ✅ Complete |
| 2 | Lexer Migration | ✅ Complete |
| 3 | Parser Migration | ✅ Complete |
| 4 | AST Migration | ✅ Complete |
| 5 | Semantic Analyzer | ✅ Complete |
| 5B | Edge Case Testing | ✅ Complete |
| 6 | Frame Allocator | ✅ Complete |
| 7 | IL Generator | ✅ Complete |
| 7.5 | IL Optimizer (sub-plan) | ✅ Complete |
| 8 | Code Generator (sub-plan) | ✅ Complete |
| 8.5 | 65C02 Support (sub-plan) | ✅ Complete |
| 9 | ASM-IL Optimizer (sub-plan) | ⬜ Not Started |
| 10 | Integration & Testing | ⬜ Not Started |

**Tests:** 6,534 total — 6,524 passing, 0 failed, 10 skipped

## Remaining Work

1. **ASM-IL Optimizer** — `plans/compiler-v2/asm-il-optimizer/99-execution-plan.md`
2. **Phase 10: Integration** — `plans/compiler-v2/99-execution-plan.md` (Phase 10)

## Quick Start

To continue implementation:

1. Read the relevant execution plan
2. Start new chat session
3. Reference: `exec_plan compiler-v2` or the specific sub-plan

## Success Criteria

The v2 compiler is complete when:

1. ✅ All phases completed
2. ✅ All tests passing
3. ✅ Can compile example programs
4. ✅ Output runs correctly in VICE
5. ✅ No regressions from v1 features
6. ✅ Documentation updated
