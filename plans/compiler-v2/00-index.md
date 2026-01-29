# Compiler v2 Implementation Plan

> **Project**: Blend65 Compiler v2  
> **Architecture**: Static Frame Allocation (SFA)  
> **Status**: Planning Complete  
> **Created**: January 29, 2026

## Overview

This plan describes the implementation of the Blend65 v2 compiler using Static Frame Allocation (SFA) instead of SSA. The v2 compiler will be implemented as a new package (`packages/compiler-v2/`) to ensure a clean start while salvaging reusable components from v1.

## Key Decisions

| Decision | Outcome |
|----------|---------|
| Architecture | Static Frame Allocation (SFA) |
| Recursion | Forbidden (compile error) |
| @map syntax | Removed |
| Migration | New package, salvage from v1 |
| Optimizer | Two slots (IL empty, ASM active) |

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document - overview |
| 01 | [Requirements](01-requirements.md) | What we're building |
| 02 | [Salvage Analysis](02-salvage-analysis.md) | What to reuse from v1 |
| 03 | [Package Setup](03-package-setup.md) | New package structure |
| 04 | [Lexer Migration](04-lexer-migration.md) | Lexer changes |
| 05 | [Parser Migration](05-parser-migration.md) | Parser changes |
| 06 | [Semantic Migration](06-semantic-migration.md) | Semantic analyzer changes |
| 07 | [Frame Allocator](07-frame-allocator.md) | NEW: SFA implementation |
| 08 | [IL Generator](08-il-generator.md) | NEW: Simple linear IL |
| 09 | [Code Generator](09-code-generator.md) | NEW: SFA-based codegen |
| 10 | [ASM Optimizer](10-asm-optimizer.md) | Peephole optimization |
| 99 | [Execution Plan](99-execution-plan.md) | Phases and sessions |

## Estimated Effort

| Category | Tasks | Sessions | Time |
|----------|-------|----------|------|
| Setup & Migration | 25-30 | 6-8 | 6-8 hours |
| New Components | 40-50 | 12-15 | 12-15 hours |
| Testing & Polish | 15-20 | 4-6 | 4-6 hours |
| **Total** | **80-100** | **22-29** | **22-29 hours** |

## Comparison with v1 Fix Plan

| Metric | v1 Codegen Fixes | v2 Rewrite |
|--------|------------------|------------|
| Tasks | 352 | 80-100 |
| Sessions | 67-89 | 22-29 |
| Complexity | Fighting SSA | Working with 6502 |
| Result | Patched SSA | Clean SFA |

**v2 is ~75% less effort with a cleaner result.**

## Quick Start

To begin implementation:

1. Read [99-execution-plan.md](99-execution-plan.md)
2. Start new chat session
3. Reference: "Implement Phase 1, Session 1.1 per plans/compiler-v2/99-execution-plan.md"

## Success Criteria

The v2 compiler is complete when:

1. ✅ All phases completed
2. ✅ All tests passing
3. ✅ Can compile example programs
4. ✅ Output runs correctly in VICE
5. ✅ No regressions from v1 features
6. ✅ Documentation updated