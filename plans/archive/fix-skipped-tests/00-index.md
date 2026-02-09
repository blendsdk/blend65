# Fix 22 Skipped Tests — Implementation Plan

> **Feature**: Convert all 22 skipped/todo tests to real passing tests
> **Status**: Planning Complete
> **Created**: 2025-02-09
> **Validated**: All intrinsic, shift, and 3-variable tests pass in pipeline validation

## Overview

The Blend65 compiler has 22 skipped tests (`it.skip` and `it.todo`) across 6 test files.
Analysis revealed that **20 of 22** already work through the pipeline — they just need
test bodies written. The remaining 2 are real implementation gaps (parser module-level
break/continue, cross-file frame allocation).

## Key Discovery

The IL generator's `tryResolveConstantAddress()` method (added in a previous session)
successfully emits address operands for peek/poke/peekw/pokew/volatile_read intrinsics
with constant addresses. The codegen handles these correctly. Additionally, shift operations
and 3-variable expressions work through the complex operand fallback path.

**Validated via `scripts/debug-intrinsics-pipeline.ts`** — All 8 pipeline scenarios pass.

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | Requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of current 22 skipped tests |
| 03 | [Intrinsics Tests](03-intrinsics-tests.md) | Phase 1: Write 15 intrinsic test bodies |
| 04 | [Shift & 3-Var Tests](04-shift-and-3var.md) | Phase 2: Write 3 shift/3-var test bodies |
| 05 | [Parser Break/Continue](05-parser-break-continue.md) | Phase 3: Fix parser module-level handling |
| 06 | [Cross-File Frames](06-cross-file-frames.md) | Phase 4: Fix frame allocator multi-module |
| 07 | [Testing Strategy](07-testing-strategy.md) | Testing strategy |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, task checklist |

## Quick Reference

### Test Categories

| Category | Tests | Status | Fix |
|----------|-------|--------|-----|
| Intrinsics (peek/poke/peekw/pokew/volatile) | 15 | Pipeline works ✅ | Write test bodies |
| Shift operations (<<, >>) | 2 | Pipeline works ✅ | Write test bodies |
| 3-variable expression | 1 | Pipeline works ✅ | Write test body |
| Parser break/continue at module level | 2 | Real gap ❌ | Parser fix needed |
| Cross-file frame allocation | 2 | Real gap ❌ | Frame phase fix needed |

### Key Decisions

| Decision | Outcome |
|----------|---------|
| Intrinsics approach | Write test bodies only — IL generator already fixed |
| Shift approach | Write test bodies only — complex operand path works |
| Parser fix approach | Add break/continue recognition at module scope |
| Frame fix approach | Iterate all modules in FramePhase, not just primary |

## Related Files

- `packages/compiler/src/il/generator/expressions.ts` — IL generator (has tryResolveConstantAddress)
- `packages/compiler/src/codegen/generator/intrinsics.ts` — Codegen intrinsics
- `packages/compiler/src/pipeline/frame-phase.ts` — Frame phase (single-module limitation)
- `packages/compiler/src/parser/` — Parser module-level handling
- `scripts/debug-intrinsics-pipeline.ts` — Validation script (all 8 pass)
