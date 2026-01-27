# Go-Intrinsics Implementation Plan

> **Feature**: Complete Code Generation for All Intrinsics
> **Status**: Planning Complete
> **Created**: January 26, 2026
> **Estimated Time**: ~2 hours
> **Sessions**: 1-2

## Overview

This plan completes the intrinsics implementation in the Blend65 compiler. The IL generator layer is fully implemented (all 18 intrinsics), but the code generator layer is missing handlers for 6 intrinsics that currently fall through to placeholder generation.

The work is straightforward: add switch cases to `instruction-generator.ts` for the missing intrinsics and generate appropriate 6502 assembly.

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document - overview and navigation |
| 01 | [Requirements](01-requirements.md) | Feature requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of current implementation |
| 03 | [Codegen Implementation](03-codegen-implementation.md) | Technical specification |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### The 6 Missing Intrinsics

| Intrinsic | IL Opcode | 6502 Output | Complexity |
|-----------|-----------|-------------|------------|
| `brk()` | CPU_BRK | `BRK` | Trivial |
| `barrier()` | OPT_BARRIER | Comment only | Trivial |
| `lo()` | INTRINSIC_LO | Low byte extract | Simple |
| `hi()` | INTRINSIC_HI | High byte extract | Simple |
| `volatile_read()` | VOLATILE_READ | `LDA` (forced) | Simple |
| `volatile_write()` | VOLATILE_WRITE | `STA` (forced) | Simple |

### Key Decisions

| Decision | Outcome |
|----------|---------|
| Optimization barrier implementation | Comment only (no code) |
| Volatile operations | Same as peek/poke with comments |
| lo/hi for runtime values | Use zero-page indirect or existing value location |

## Related Files

### Files to Modify

- `packages/compiler/src/codegen/instruction-generator.ts` - Add 6 switch cases

### Files to Create

- `packages/compiler/src/__tests__/codegen/instruction-generator-intrinsics.test.ts` - Test coverage

### Reference Files

- `packages/compiler/src/il/intrinsics/registry.ts` - Intrinsic definitions
- `packages/compiler/src/il/instructions.ts` - IL instruction types
- `examples/lib/system.blend` - Intrinsic declarations

## Success Criteria

- [ ] All 18 intrinsics generate proper 6502 assembly (no placeholders)
- [ ] All existing tests continue to pass (6,500+)
- [ ] New tests added for the 6 previously missing intrinsics
- [ ] End-to-end compilation works for programs using all intrinsics