# Spinning-Line Diagnostic Fixes Implementation Plan

> **Feature**: Fix 4 bugs found by `diag_app` on `examples/spinning-line/main.blend`
> **Status**: Planning Complete
> **Created**: 2026-02-16
> **Source Diagnostic**: `build/diag/spinning-line/`

## Overview

The `diag_app` diagnostic on `spinning-line` revealed **4 bugs** (1 Critical, 3 High). This plan addresses all of them in priority order:

1. **Bug #1 (Critical — REG):** DCE incorrectly removes parameter stores (`STA $02`) before function calls at O1/Os/Oz, causing `getSpriteFrame` to read stale data
2. **Bug #2 (High — REDUN):** Redundant store/reload of `spriteAddr` in `getSpriteFrame` at all optimization levels — value stored to `$07/$08` and immediately reloaded
3. **Bug #3 (High — REDUN):** Jump-to-next-instruction after inlined `delay()` return at O1
4. **Bug #4 (High — REDUN):** Dead loads at O1/Os/Oz (secondary effect of Bug #1, auto-fixed)

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | Bug descriptions and fix requirements |
| 02 | [Current State](02-current-state.md) | Root cause analysis for each bug |
| 03 | [DCE Parameter Fix](03-dce-parameter-fix.md) | Technical spec for Bug #1 (Critical) |
| 04 | [Store-Reload & JMP Fix](04-store-reload-jmp-fix.md) | Technical spec for Bugs #2 and #3 |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### Key Decisions

| Decision | Outcome |
|----------|---------|
| Fix approach for Bug #1 | Propagate parameter slot uses into CALL instruction defUse metadata |
| Fix approach for Bug #2 | Investigate why StoreLoadPass misses the pattern; fix if needed |
| Fix approach for Bug #3 | Add JMP-to-next elimination in IL peephole or inliner cleanup |
| Priority order | Bug #1 first (Critical), then Bugs #2/#3 (High) |

## Related Files

### Bug #1 (DCE Parameter Store)
- `packages/compiler/src/il/analysis.ts` — `isDeadStore()`, `computeLiveRanges()`
- `packages/compiler/src/optimizer/passes/dce.ts` — DCE pass
- `packages/compiler/src/il/` — IL instruction generation (CALL defUse)

### Bug #2 (Redundant Store/Reload)
- `packages/compiler/src/codegen/asm-il/optimizer/passes/store-load.ts` — StoreLoadPass
- `packages/compiler/src/codegen/generator/functions.ts` — Function codegen

### Bug #3 (JMP-to-Next)
- `packages/compiler/src/optimizer/passes/function-inlining.ts` — `replaceReturnsWithJump()`
- `packages/compiler/src/optimizer/passes/il-peephole.ts` — IL peephole pass
