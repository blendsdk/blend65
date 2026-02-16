# Composite Optimization Levels Implementation Plan

> **Feature**: Expand optimization levels from 6 to 10 with composite s/z modifiers
> **Status**: Planning Complete
> **Created**: 2025-02-16

## Overview

Currently the Blend65 compiler supports 6 optimization levels: O0, O1, O2, O3, Os, Oz.
The levels Os and Oz are implicitly "O2 + size focus" and "O2 + min-size focus", but
there is no way to express "O1 + size focus" or "O3 + size focus".

This feature adds 4 new composite levels (O1s, O1z, O3s, O3z) that combine an
aggressiveness base (O1/O2/O3) with a size modifier (s/z). It also updates the CLI
help, adds input validation, and expands `diag_app.sh` to test all 10 viable levels.

**Mental model for developers:**
- Pick your aggressiveness: O1, O2, O3
- Optionally add a size modifier: `s` (optimize for size) or `z` (minimize size)
- Result: O1, O1s, O1z, O2, Os(=O2s), Oz(=O2z), O3, O3s, O3z — plus O0 for no optimization

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | Feature requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of current implementation |
| 03 | [Config Types](03-config-types.md) | OptimizationLevelId expansion |
| 04 | [IL Optimizer](04-il-optimizer.md) | IL pass mapping for new levels |
| 05 | [AsmIL Optimizer](05-asm-optimizer.md) | AsmIL pass mapping for new levels |
| 06 | [CLI & Diag](06-cli-diag.md) | CLI help, validation, diag_app expansion |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, task checklist |

## Quick Reference

### New Levels

| Level | Base | Modifier | New? |
|-------|------|----------|------|
| O0 | None | — | Existing |
| O1 | Basic | Speed | Existing |
| O1s | Basic | Size | **New** |
| O1z | Basic | Min-size | **New** |
| O2 | Standard | Speed | Existing |
| Os | Standard | Size | Existing (alias: O2s) |
| Oz | Standard | Min-size | Existing (alias: O2z) |
| O3 | Aggressive | Speed | Existing |
| O3s | Aggressive | Size | **New** |
| O3z | Aggressive | Min-size | **New** |

### Key Decisions

| Decision | Outcome |
|----------|---------|
| O2s/O2z aliases | Accept silently, normalize to Os/Oz |
| O0s/O0z | Reject with helpful error |
| ZP slots for O1s/O1z | Yes, 4 slots (ZP instructions are smaller) |
| diag_app levels | All 10 viable levels |

## Related Files

### Compiler Config
- `packages/compiler/src/config/types.ts` — `OptimizationLevelId` type

### IL Optimizer
- `packages/compiler/src/optimizer/options.ts` — Pass maps per level

### AsmIL Optimizer
- `packages/compiler/src/codegen/asm-il/optimizer/options.ts` — `OptimizationLevel` enum + defaults
- `packages/compiler/src/codegen/asm-il/optimizer/pass-factory.ts` — Pass creation logic

### CLI
- `packages/cli/src/commands/build.ts` — CLI flag handling + help text

### Diagnostic Script
- `scripts/diag_app.sh` — Diagnostic tool

### Compiler Pipeline
- `packages/compiler/src/compiler.ts` — Level resolution and pass-through
