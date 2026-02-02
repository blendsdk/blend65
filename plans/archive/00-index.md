# Beyond God-Level IL Generator Implementation Plan

> **Feature**: SFA-Integrated IL Generator with Advanced Optimization Hints
> **Status**: Planning Complete
> **Created**: 2025-02-02
> **Goal**: Create an IL Generator that makes Blend65 miles ahead of CC65, KickC, Oscar64, and Prog8

---

## Overview

This plan describes the implementation of a **"Beyond God-Level" IL Generator** that fully leverages the Static Frame Allocation (SFA) system. Unlike any competing 6502 compiler, our IL will carry rich contextual information from the semantic analysis phase all the way through to code generation.

### The Competitive Advantage

| Feature | CC65 | KickC | Oscar64 | Prog8 | **Blend65** |
|---------|------|-------|---------|-------|-------------|
| Static frame allocation | ❌ | ✅ | ✅ | ✅ | ✅ |
| ZP-aware IL | ❌ | Partial | ❌ | ❌ | **✅** |
| Slot-centric IL | ❌ | ❌ | ❌ | ❌ | **✅** |
| Live range annotations | ❌ | Late | ❌ | ❌ | **✅** |
| Cost model annotations | ❌ | ❌ | ❌ | ❌ | **✅** |
| Addressing mode hints | ❌ | Late | ❌ | ❌ | **✅** |
| Loop structure in IL | ❌ | Partial | Partial | ❌ | **✅** |
| Coalesce awareness | ❌ | ✅ | ❌ | ❌ | **✅** |
| Register params | ❌ | ✅ | ✅ | ❌ | **✅** |

### Design Philosophy

1. **Move Intelligence Earlier** - Optimization decisions made at IL generation, not codegen
2. **Simple Linear IL** - No SSA complexity, fast compilation (unlike KickC)
3. **Full SFA Context** - Every instruction knows its memory characteristics
4. **Deterministic & Debuggable** - Reproducible, inspectable output

---

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document - overview and navigation |
| 01 | [Requirements](01-requirements.md) | Feature requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of current SFA and IL implementations |
| 03 | [IL Types](03-il-types.md) | Core IL type definitions and opcodes |
| 04 | [Slot Integration](04-slot-integration.md) | SFA slot-centric operand design |
| 05 | [Optimization Hints](05-optimization-hints.md) | Live ranges, costs, addressing hints |
| 06 | [Loop Structure](06-loop-structure.md) | Loop-aware IL representation |
| 07 | [IL Builder](07-il-builder.md) | Builder pattern for IL construction |
| 08 | [IL Generator](08-il-generator.md) | AST → IL generation logic |
| 09 | [Testing Strategy](09-testing-strategy.md) | Test cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

---

## Quick Reference

### What Makes This "Beyond God-Level"

1. **Slot-Centric Operands**: IL references `FrameSlot` objects, not raw addresses
2. **ZP Awareness**: Every memory access knows if it's ZP (3-cycle) or absolute (4-cycle)
3. **Live Range Annotations**: Variables tracked for dead store elimination
4. **Cost Model**: Estimated cycles/bytes for optimization decisions
5. **Addressing Hints**: Pre-computed optimal 6502 addressing modes
6. **Loop Structure**: Loop boundaries preserved for loop-specific optimizations

### Key Decisions

| Decision | Outcome | Rationale |
|----------|---------|-----------|
| IL Structure | Simple linear | Fast compilation, easy debugging |
| Operand Model | Slot-centric | Full SFA context available |
| Optimization Hints | In IL | Early decisions, better optimization |
| Register Params | Supported | Zero-cost first parameters |
| Coalesce Awareness | Yes | Cross-function optimization hints |

---

## Related Files

### SFA Implementation (Already Done)
- `packages/compiler-v2/src/frame/types.ts` - FrameSlot, Frame types
- `packages/compiler-v2/src/frame/allocator/frame-allocator.ts` - Main allocator
- `packages/compiler-v2/src/frame/allocator/frame-calculator.ts` - Frame calculation
- `packages/compiler-v2/src/frame/allocator/zp-allocator.ts` - ZP allocation

### IL Implementation (To Be Created)
- `packages/compiler-v2/src/il/types.ts` - IL types and opcodes
- `packages/compiler-v2/src/il/builder.ts` - IL instruction builder
- `packages/compiler-v2/src/il/generator.ts` - AST → IL generator
- `packages/compiler-v2/src/il/index.ts` - Module exports

### Test Files
- `packages/compiler-v2/src/__tests__/il/types.test.ts`
- `packages/compiler-v2/src/__tests__/il/builder.test.ts`
- `packages/compiler-v2/src/__tests__/il/generator.test.ts`
- `packages/compiler-v2/src/__tests__/il/e2e/` - End-to-end IL tests

---

## Implementation Phases Summary

| Phase | Title | Sessions | Focus |
|-------|-------|----------|-------|
| 7a | Core IL with SFA Integration | 3 | Types, builder, basic generation |
| 7b | Optimization Hints | 2 | Live ranges, costs, addressing |
| 7c | Advanced Features | 2 | Loop structure, coalesce hints |
| 7d | Testing & Validation | 1 | Comprehensive test coverage |

**Total**: 8 sessions, ~16-20 hours

---

## Success Criteria

The IL Generator is complete when:

1. ✅ All IL types defined with slot-centric operands
2. ✅ Builder emits all 25+ opcodes correctly
3. ✅ Generator handles all expression types
4. ✅ Generator handles all statement types
5. ✅ Generator handles all control flow
6. ✅ Generator handles function calls with register params
7. ✅ Live range annotations computed
8. ✅ Cost model annotations added
9. ✅ Addressing hints computed
10. ✅ Loop structure preserved
11. ✅ All tests passing (targeting 95%+ coverage)
12. ✅ Integration with semantic analyzer verified

---

*This plan builds upon the SFA research (CC65, KickC, Oscar64, Prog8) and the approved SFA-IMPLEMENTATION-SUMMARY.md design.*